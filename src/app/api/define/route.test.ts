import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { resetDbForTests } = await import("@/lib/db");
const { signInAs } = await import("@/lib/testing/auth");
const { LlmError } = await import("@/lib/llm/client");
const { POST } = await import("./route");

const req = (body: unknown) =>
  new Request("http://t/api/define", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
});

test("student gets a definition for a cleaned selection", async () => {
  signInAs("student");
  callJson.mockResolvedValueOnce({ definition: "d", exemple: "e", fr: "f" });
  const res = await POST(req({ word: " “brand,” ", sentence: "The brand grew." }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ definition: "d", exemple: "e", fr: "f" });
  expect(callJson.mock.calls[0][1]).toContain('Define "brand"');
});

test("5 words refused without calling the model; viewer forbidden; LLM failure → 502", async () => {
  signInAs("student");
  expect((await POST(req({ word: "one two three four five", sentence: "s" }))).status).toBe(400);
  expect(callJson).not.toHaveBeenCalled();
  callJson.mockRejectedValueOnce(new LlmError("provider", "Le service ne répond pas."));
  const res = await POST(req({ word: "brand", sentence: "s" }));
  expect(res.status).toBe(502);
  expect((await res.json()).error).toBe("Le service ne répond pas.");
  signInAs("viewer");
  expect((await POST(req({ word: "brand", sentence: "s" }))).status).toBe(403);
});
