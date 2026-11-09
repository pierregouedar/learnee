import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { buildDefinePrompt, define } = await import("./define");
const answer = { definition: "the name of a product", exemple: "A famous brand.", fr: "marque" };

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  callJson.mockResolvedValue(answer);
});

test("prompt follows spec §8.3", () => {
  const p = buildDefinePrompt("brand", "The brand grew.");
  expect(p).toContain('Define "brand" as it is used in this context: "The brand grew."');
  expect(p).toContain("Reply with only JSON");
  expect(p).toContain('"fr": "French translation of \"brand\" only'); // le mot, pas toute la phrase
});

test("cached by lowercased word + sentence", async () => {
  expect(await define("Brand", "The brand grew.")).toEqual(answer);
  expect(await define("brand", "The brand grew.")).toEqual(answer);
  expect(callJson).toHaveBeenCalledTimes(1);
  expect(callJson.mock.calls[0][0]).toBe("define");
  await define("brand", "Another sentence.");
  expect(callJson).toHaveBeenCalledTimes(2);
});

test("sentence capped at 400 characters in the prompt", async () => {
  await define("x", "y".repeat(1000));
  expect(callJson.mock.calls[0][1]).toContain(`"${"y".repeat(400)}"`);
  expect(callJson.mock.calls[0][1]).not.toContain("y".repeat(401));
});
