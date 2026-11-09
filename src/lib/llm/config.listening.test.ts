import { afterEach, expect, test, vi } from "vitest";
import { routeFor } from "./config";

afterEach(() => vi.unstubAllEnvs());

test("listening correction falls back to the correction model, then to its own env var", () => {
  vi.stubEnv("LLM_MODEL_LISTENING_CORRECT", "");
  vi.stubEnv("LLM_MODEL_CORRECT", "corr/model");
  expect(routeFor("listening_correct")).toMatchObject({ model: "corr/model", temperature: 0 });
  vi.stubEnv("LLM_MODEL_LISTENING_CORRECT", "own/model");
  expect(routeFor("listening_correct").model).toBe("own/model");
});
