import { afterEach, expect, test, vi } from "vitest";
import { routeFor } from "./config";

afterEach(() => vi.unstubAllEnvs());

test("task env var wins", () => {
  vi.stubEnv("LLM_MODEL_DEFINE", "m/define");
  vi.stubEnv("LLM_MODEL_CORRECT", "m/correct");
  expect(routeFor("define").model).toBe("m/define");
});

test("new tasks fall back to LLM_MODEL_CORRECT, then LLM_MODEL_GENERATE", () => {
  vi.stubEnv("LLM_MODEL_CLASSIFY", "");
  vi.stubEnv("LLM_MODEL_CORRECT", "m/correct");
  vi.stubEnv("LLM_MODEL_GENERATE", "m/generate");
  expect(routeFor("classify").model).toBe("m/correct");
  vi.stubEnv("LLM_MODEL_CORRECT", "");
  expect(routeFor("classify").model).toBe("m/generate");
});

test("hard-coded fallback when nothing is set", () => {
  for (const k of ["LLM_MODEL_GENERATE", "LLM_MODEL_CORRECT", "LLM_MODEL_DEFINE"]) vi.stubEnv(k, "");
  expect(routeFor("define").model).toBe("openai/gpt-6-luna");
});

test("timeouts: define has its own, others use LLM_TIMEOUT_MS or 5 min", () => {
  vi.stubEnv("LLM_TIMEOUT_MS", "");
  expect(routeFor("correct").timeoutMs).toBe(300_000);
  vi.stubEnv("LLM_TIMEOUT_MS", "1234");
  expect(routeFor("generate").timeoutMs).toBe(1234);
  expect(routeFor("define").timeoutMs).toBe(60_000);
});

test("a comma-separated list gives the primary model and its fallbacks", () => {
  vi.stubEnv("LLM_MODEL_GENERATE", " a/one:free , b/two:free,,c/three ");
  vi.stubEnv("LLM_MODEL_CORRECT", "");
  expect(routeFor("generate")).toMatchObject({ model: "a/one:free", models: ["a/one:free", "b/two:free", "c/three"] });
});
