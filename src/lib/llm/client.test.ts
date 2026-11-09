import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { db, resetDbForTests } from "@/lib/db";
import { callJson, DEFINE_HOURLY_LIMIT, LLM_HOURLY_LIMIT, LlmError, setChatForTests, type ChatFn } from "./client";

const Schema = z.object({ ok: z.boolean() });
const reply = (content: string) => ({ content, inputTokens: 10, outputTokens: 5, costUsd: 0.0001 });
const calls = () => (db().prepare(`SELECT COUNT(*) AS n FROM llm_calls`).get() as { n: number }).n;

beforeEach(() => resetDbForTests());
afterEach(() => vi.unstubAllEnvs());

test("valid JSON on first try, call logged with ref", async () => {
  setChatForTests(async () => reply('{"ok":true}'));
  await expect(callJson("generate", "p", Schema, "ref-1")).resolves.toEqual({ ok: true });
  const row = db().prepare(`SELECT * FROM llm_calls`).get() as { ref_id: string; ok: number; cost_usd: number };
  expect(row).toMatchObject({ ref_id: "ref-1", ok: 1, cost_usd: 0.0001 });
});

test("invalid then valid: one retry", async () => {
  const answers = ["pas du json", '```json\n{"ok":false}\n```'];
  const fn: ChatFn = async () => reply(answers.shift()!);
  setChatForTests(fn);
  await expect(callJson("correct", "p", Schema)).resolves.toEqual({ ok: false });
  expect(calls()).toBe(2);
});

test("invalid twice: LlmError invalid_json", async () => {
  setChatForTests(async () => reply('{"ok":"yes"}'));
  const err = await callJson("correct", "p", Schema).catch((e) => e);
  expect(err).toBeInstanceOf(LlmError);
  expect(err.code).toBe("invalid_json");
  expect(calls()).toBe(2);
});

test("provider failure: LlmError provider, logged as failed", async () => {
  setChatForTests(async () => {
    throw new Error("503");
  });
  const err = await callJson("correct", "p", Schema).catch((e) => e);
  expect(err.code).toBe("provider");
  expect((db().prepare(`SELECT ok FROM llm_calls`).get() as { ok: number }).ok).toBe(0);
});

test("provider failure with status 429: mapped to rate_limited", async () => {
  setChatForTests(async () => {
    throw Object.assign(new Error("Too Many Requests"), { status: 429 });
  });
  const err = await callJson("correct", "p", Schema).catch((e) => e);
  expect(err).toBeInstanceOf(LlmError);
  expect(err.code).toBe("rate_limited");
  expect((db().prepare(`SELECT ok FROM llm_calls`).get() as { ok: number }).ok).toBe(0);
});

test("rate limit: refuses beyond the hourly limit without calling", async () => {
  let called = false;
  setChatForTests(async () => {
    called = true;
    return reply('{"ok":true}');
  });
  const insert = db().prepare(
    `INSERT INTO llm_calls (task, model, ok, input_tokens, output_tokens, cost_usd, latency_ms, created_at) VALUES ('x','m',1,0,0,0,0,?)`,
  );
  for (let i = 0; i < LLM_HOURLY_LIMIT; i++) insert.run(new Date().toISOString());
  const err = await callJson("generate", "p", Schema).catch((e) => e);
  expect(err.code).toBe("rate_limited");
  expect(called).toBe(false);
});

test("define has its own quota and its own timeout", async () => {
  const seen: number[] = [];
  setChatForTests(async (req) => {
    seen.push(req.timeoutMs);
    return reply('{"ok":true}');
  });
  const insert = db().prepare(
    `INSERT INTO llm_calls (task, model, ok, input_tokens, output_tokens, cost_usd, latency_ms, created_at) VALUES (?,'m',1,0,0,0,0,?)`,
  );
  for (let i = 0; i < LLM_HOURLY_LIMIT; i++) insert.run("correct", new Date().toISOString());
  await expect(callJson("define", "p", Schema)).resolves.toEqual({ ok: true });
  expect(seen).toEqual([60_000]);
  for (let i = 0; i < DEFINE_HOURLY_LIMIT; i++) insert.run("define", new Date().toISOString());
  const err = await callJson("define", "p", Schema).catch((e) => e);
  expect(err.code).toBe("rate_limited");
});

test("model list: OpenRouter gets the fallbacks, and the retry starts from the next model", async () => {
  vi.stubEnv("LLM_MODEL_GENERATE", "a/one,b/two,c/three,d/four");
  vi.stubEnv("LLM_MODEL_CORRECT", "");
  const seen: { model: string; fallbacks?: string[] }[] = [];
  const answers = ["pas du json", '{"ok":true}'];
  setChatForTests(async (req) => {
    seen.push({ model: req.model, fallbacks: req.fallbacks });
    return { ...reply(answers.shift()!), model: req.model };
  });
  await expect(callJson("generate", "p", Schema)).resolves.toEqual({ ok: true });
  expect(seen).toEqual([
    { model: "a/one", fallbacks: ["b/two", "c/three"] }, // 3 modèles au plus par requête
    { model: "b/two", fallbacks: ["c/three", "d/four"] },
  ]);
  const models = (db().prepare(`SELECT model FROM llm_calls ORDER BY id`).all() as { model: string }[]).map((r) => r.model);
  expect(models).toEqual(["a/one", "b/two"]);
});

test("flex tier: sent when configured, and a 429 falls back to the normal tier", async () => {
  vi.stubEnv("LLM_SERVICE_TIER", "flex");
  const tiers: (string | undefined)[] = [];
  setChatForTests(async (req) => {
    tiers.push(req.serviceTier);
    if (req.serviceTier) throw Object.assign(new Error("flex capacity"), { status: 429 });
    return reply('{"ok":true}');
  });
  await expect(callJson("generate", "p", Schema)).resolves.toEqual({ ok: true });
  expect(tiers).toEqual(["flex", undefined]);
});

test("onText is forwarded to the provider as a streaming callback", async () => {
  const seen: string[] = [];
  setChatForTests(async (req) => {
    req.onDelta?.('{"ok"');
    req.onDelta?.('{"ok":true}');
    return reply('{"ok":true}');
  });
  await callJson("generate", "p", Schema, undefined, (t) => seen.push(t));
  expect(seen).toEqual(['{"ok"', '{"ok":true}']);
});
