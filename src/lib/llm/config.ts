export type LlmTask =
  | "generate"
  | "correct"
  | "define"
  | "classify"
  | "listening_script"
  | "listening_correct"
  | "listening_context"
  | "grammar_set"
  | "grammar_check"
  | "rewrite_check"
  | "placement"
  | "weekly_report";

type Route = { env: string; fallback: string; temperature: number; timeoutMs?: number };

// Modèle piloté par env pour changer sans toucher au code (spec §6.1).
// Chaque tâche : LLM_MODEL_<TÂCHE>, sinon LLM_MODEL_CORRECT, sinon LLM_MODEL_GENERATE, sinon `fallback`.
export const ROUTES: Record<LlmTask, Route> = {
  generate: { env: "LLM_MODEL_GENERATE", fallback: "openai/gpt-6-luna", temperature: 0.8 },
  correct: { env: "LLM_MODEL_CORRECT", fallback: "openai/gpt-6-luna", temperature: 0 },
  // 60 s fixes ; le modèle gratuit « à raisonnement » répond en 10-40 s, au-delà on préfère un message clair.
  define: { env: "LLM_MODEL_DEFINE", fallback: "openai/gpt-6-luna", temperature: 0, timeoutMs: 60_000 },
  classify: { env: "LLM_MODEL_CLASSIFY", fallback: "openai/gpt-6-luna", temperature: 0 },
  listening_script: { env: "LLM_MODEL_LISTENING_SCRIPT", fallback: "openai/gpt-6-luna", temperature: 0.8 },
  listening_correct: { env: "LLM_MODEL_LISTENING_CORRECT", fallback: "openai/gpt-6-luna", temperature: 0 },
  listening_context: { env: "LLM_MODEL_LISTENING_CONTEXT", fallback: "openai/gpt-6-luna", temperature: 0.3 },
  grammar_set: { env: "LLM_MODEL_GRAMMAR_SET", fallback: "openai/gpt-6-luna", temperature: 0.7 },
  grammar_check: { env: "LLM_MODEL_GRAMMAR_CHECK", fallback: "openai/gpt-6-luna", temperature: 0 },
  rewrite_check: { env: "LLM_MODEL_REWRITE_CHECK", fallback: "openai/gpt-6-luna", temperature: 0 },
  placement: { env: "LLM_MODEL_PLACEMENT", fallback: "openai/gpt-6-luna", temperature: 0.4 },
  weekly_report: { env: "LLM_MODEL_WEEKLY_REPORT", fallback: "openai/gpt-6-luna", temperature: 0.3 },
};

// Une variable peut lister plusieurs modèles séparés par des virgules : le premier, puis les secours.
export function routeFor(task: LlmTask) {
  const r = ROUTES[task];
  const e = process.env;
  const models = (e[r.env] || e.LLM_MODEL_CORRECT || e.LLM_MODEL_GENERATE || r.fallback)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    model: models[0],
    models,
    temperature: r.temperature,
    timeoutMs: r.timeoutMs ?? (Number(e.LLM_TIMEOUT_MS) || 300_000),
  };
}
