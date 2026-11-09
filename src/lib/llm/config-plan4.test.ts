import { afterEach, expect, test } from "vitest";
import { routeFor } from "./config";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

test.each(["grammar_set", "grammar_check", "rewrite_check", "placement", "weekly_report"] as const)(
  "%s has its own env var and falls back to LLM_MODEL_CORRECT",
  (task) => {
    const own = `LLM_MODEL_${task.toUpperCase()}`;
    process.env.LLM_MODEL_CORRECT = "test/correct";
    delete process.env[own];
    expect(routeFor(task).model).toBe("test/correct");
    process.env[own] = "test/own";
    expect(routeFor(task).model).toBe("test/own");
  },
);
