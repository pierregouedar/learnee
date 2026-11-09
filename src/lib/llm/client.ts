import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/lib/db";
import { routeFor, type LlmTask } from "./config";
import { extractJson } from "./json";

export const LLM_HOURLY_LIMIT = 30;
// Quota séparé : 30 recherches de mots ne doivent pas bloquer une correction.
export const DEFINE_HOURLY_LIMIT = 60;

// `fallbacks` : modèles essayés par OpenRouter si le premier est saturé ou indisponible (429, panne).
// `serviceTier` : "flex" = tarif OpenAI réduit de moitié, plus lent, sans garantie de capacité.
// `onDelta` : réponse en flux, rappelé avec le texte reçu jusque-là (pour afficher l'avancement).
export type ChatRequest = {
  model: string; fallbacks?: string[]; serviceTier?: string; temperature: number; prompt: string; jsonSchema: object; name: string; timeoutMs: number;
  onDelta?: (text: string) => void;
};
// `model` / `serviceTier` : ce que le fournisseur a réellement servi (peut différer de la demande).
export type ChatResult = { content: string; inputTokens: number; outputTokens: number; costUsd: number; model?: string; serviceTier?: string };
export type ChatFn = (req: ChatRequest) => Promise<ChatResult>;

export class LlmError extends Error {
  constructor(
    readonly code: "rate_limited" | "provider" | "invalid_json",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

// OpenRouter refuse plus de 3 modèles par requête (400 « models array must have 3 items or fewer »).
const MAX_MODELS = 3;

const isFree = (model: string) => model.endsWith(":free");

let openai: OpenAI | undefined;

const openRouterChat: ChatFn = async (req) => {
  openai ??= new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    maxRetries: 1,
  });
  const params = {
      model: req.model,
      ...(req.fallbacks?.length ? { models: [req.model, ...req.fallbacks] } : {}),
      temperature: req.temperature,
      messages: [{ role: "user", content: req.prompt }],
      // OpenAI impose son mode strict aux json_schema (pas de champ libre ni optionnel) : mode JSON simple,
      // la forme attendue est dans le prompt et zod valide la réponse.
      response_format: req.model.startsWith("openai/")
        ? { type: "json_object" }
        : { type: "json_schema", json_schema: { name: req.name, schema: req.jsonSchema as Record<string, unknown> } },
      // Extensions OpenRouter : coût réel dans usage, pas de rétention des copies par les hébergeurs (spec §12),
      // sauf opt-in explicite (les modèles gratuits exigent la collecte).
      ...({
        usage: { include: true },
        // Tier flex : propre à OpenAI.
        ...(req.serviceTier && req.model.startsWith("openai/") ? { service_tier: req.serviceTier } : {}),
        // Les modèles gratuits exigent la collecte : autorisée pour eux seuls, jamais pour les payants.
        provider: { data_collection: isFree(req.model) || process.env.LLM_ALLOW_DATA_COLLECTION === "true" ? "allow" : "deny" },
      } as object),
  } as OpenAI.ChatCompletionCreateParamsNonStreaming;
  const options = {
      // Délai par tâche (config.ts) : les modèles gratuits « à raisonnement » mettent 3-4 min sur une correction.
      timeout: req.timeoutMs,
      // define : réponse déjà attendue en direct par l'utilisateur, une relance auto doublerait l'attente.
      ...(req.name === "define" ? { maxRetries: 0 } : {}),
  };
  type Usage = OpenAI.CompletionUsage & { cost?: number };
  let content = "";
  let model: string | undefined;
  let served: string | undefined;
  let usage: Usage | undefined;
  if (req.onDelta) {
    const stream = await openai.chat.completions.create({ ...params, stream: true }, options);
    for await (const chunk of stream) {
      model ??= chunk.model;
      served ??= chunk.service_tier ?? undefined;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
        req.onDelta(content);
      }
      if (chunk.usage) usage = chunk.usage as Usage; // OpenRouter l'envoie dans le dernier morceau
    }
  } else {
    const res = await openai.chat.completions.create(params, options);
    content = res.choices[0]?.message?.content ?? "";
    model = res.model;
    served = res.service_tier ?? undefined;
    usage = res.usage as Usage | undefined;
  }
  return {
    content,
    model,
    serviceTier: served,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    costUsd: usage?.cost ?? 0,
  };
};

let chat: ChatFn = openRouterChat;

export function setChatForTests(fn: ChatFn) {
  chat = fn;
}

function assertUnderRateLimit(task: LlmTask) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const isDefine = task === "define";
  const { n } = db()
    .prepare(`SELECT COUNT(*) AS n FROM llm_calls WHERE created_at > ? AND (task = 'define') = ?`)
    .get(since, isDefine ? 1 : 0) as { n: number };
  if (n >= (isDefine ? DEFINE_HOURLY_LIMIT : LLM_HOURLY_LIMIT)) {
    throw new LlmError("rate_limited", "Trop de demandes en une heure. Réessaie un peu plus tard, ton travail est conservé.");
  }
}

function logCall(entry: { task: LlmTask; model: string; refId?: string; ok: boolean; latencyMs: number } & Omit<ChatResult, "content">) {
  db()
    .prepare(
      `INSERT INTO llm_calls (task, model, ref_id, ok, input_tokens, output_tokens, cost_usd, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.task,
      entry.model,
      entry.refId ?? null,
      entry.ok ? 1 : 0,
      entry.inputTokens,
      entry.outputTokens,
      entry.costUsd,
      entry.latencyMs,
      new Date().toISOString(),
    );
}

function tryExtract(content: string): unknown {
  try {
    return extractJson(content);
  } catch {
    return undefined;
  }
}

export async function callJson<S extends z.ZodType>(
  task: LlmTask, prompt: string, schema: S, refId?: string, onText?: (text: string) => void,
): Promise<z.infer<S>> {
  assertUnderRateLimit(task);
  const { models, temperature, timeoutMs } = routeFor(task);
  const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  let serviceTier = process.env.LLM_SERVICE_TIER || undefined;
  let lastError: unknown;

  // Une seule relance si le JSON est invalide (spec §6.1).
  // La relance passe au modèle suivant de la liste : un modèle qui renvoie du JSON illisible le refera souvent.
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    const order = [...models.slice(attempt % models.length), ...models.slice(0, attempt % models.length)];
    const model = order[0];
    let out: ChatResult;
    try {
      const req = { model, fallbacks: order.slice(1, MAX_MODELS), temperature, prompt, jsonSchema, name: task, timeoutMs, ...(onText ? { onDelta: onText } : {}) };
      try {
        out = await chat({ ...req, ...(serviceTier ? { serviceTier } : {}) });
      } catch (e) {
        // Flex sans capacité disponible (429) : on repasse au tarif normal plutôt que d'échouer.
        if (!serviceTier || (e as { status?: number } | undefined)?.status !== 429) throw e;
        console.warn(`[llm] ${serviceTier} indisponible pour ${task}, tarif normal`);
        serviceTier = undefined;
        out = await chat(req);
      }
    } catch (e) {
      logCall({ task, model, refId, ok: false, latencyMs: Date.now() - started, inputTokens: 0, outputTokens: 0, costUsd: 0 });
      const status = (e as { status?: number } | undefined)?.status;
      const message = e instanceof Error ? e.message : String(e);
      // Jamais la clé API : seulement statut/message de l'erreur remontée par le fournisseur.
      console.error(`[llm] provider error task=${task} model=${model} status=${status ?? "?"} message=${message}`);
      if (status === 429) {
        throw new LlmError("rate_limited", "Trop de demandes en une heure. Réessaie un peu plus tard, ton travail est conservé.", { cause: e });
      }
      throw new LlmError("provider", "Le service ne répond pas pour le moment. Ton travail est conservé, tu peux réessayer.", { cause: e });
    }
    const parsed = schema.safeParse(tryExtract(out.content));
    const usage = { inputTokens: out.inputTokens, outputTokens: out.outputTokens, costUsd: out.costUsd };
    // Une ligne par appel dans la console du serveur : de quoi suivre en direct (tail -f) modèle, durée et coût.
    console.info(
      `[llm] ${task} ${out.model ?? model} tier=${out.serviceTier ?? (model.startsWith("openai/") ? serviceTier : undefined) ?? "-"} ${parsed.success ? "ok" : "JSON invalide"} ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s ${out.inputTokens}+${out.outputTokens} tokens $${out.costUsd.toFixed(5)}`,
    );
    logCall({ task, model: out.model ?? model, refId, ok: parsed.success, latencyMs: Date.now() - started, ...usage });
    if (parsed.success) return parsed.data;
    lastError = parsed.error;
  }
  throw new LlmError("invalid_json", "La réponse reçue était illisible. Ton travail est conservé, tu peux réessayer.", { cause: lastError });
}
