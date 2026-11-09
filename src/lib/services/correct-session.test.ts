import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createSession, getSession, saveDraft } from "@/lib/repo/sessions";
import { getSubject, insertSubject } from "@/lib/repo/subjects";
import type { Correction } from "@/lib/schemas";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { CorrectionRefused, runCorrection, startCorrection } = await import("./correct-session");
const { LlmError } = await import("@/lib/llm/client");

const correction: Correction = {
  compte_rendu: { note: 6.3, commentaire: "c", idees_manquantes: [] },
  expression: { note: 11, niveau: "B1", erreurs: [], points_forts: [], version_amelioree: "v" },
  vocabulaire: [],
  conseil: "k",
};
const words = (n: number) => Array.from({ length: n }, () => "mot").join(" ");

let sessionId: string;
let subjectId: string;
beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  subjectId = insertSubject({
    domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [],
  }).id;
  sessionId = createSession(subjectId, 1).id;
});

test("refuses under 20 words without calling the model", () => {
  saveDraft(sessionId, { cr: words(10), pe: words(9) });
  expect(() => startCorrection(sessionId)).toThrow(CorrectionRefused);
  expect(getSession(sessionId)?.status).toBe("draft");
  expect(callJson).not.toHaveBeenCalled();
});

test("refuses unknown session with 404 and double start with 409", () => {
  expect(() => startCorrection("nope")).toThrow(expect.objectContaining({ status: 404 }));
  saveDraft(sessionId, { cr: words(10), pe: words(10) });
  startCorrection(sessionId);
  expect(() => startCorrection(sessionId)).toThrow(expect.objectContaining({ status: 409 }));
});

test("success: notes rounded and clamped, subject marked used", async () => {
  saveDraft(sessionId, { cr: words(10), pe: words(10) });
  startCorrection(sessionId);
  callJson.mockResolvedValueOnce(correction);
  await runCorrection(sessionId);
  const s = getSession(sessionId)!;
  expect(s.status).toBe("corrected");
  expect(s.result?.compte_rendu.note).toBe(6.5);
  expect(s.result?.expression.note).toBe(10);
  expect(getSubject(subjectId)?.status).toBe("used");
});

test("empty part forced to 0", async () => {
  saveDraft(sessionId, { cr: "", pe: words(25) });
  startCorrection(sessionId);
  callJson.mockResolvedValueOnce(correction);
  await runCorrection(sessionId);
  expect(getSession(sessionId)?.result?.compte_rendu.note).toBe(0);
});

test("LLM failure: back to draft with the French message, draft kept", async () => {
  saveDraft(sessionId, { cr: words(10), pe: words(10) });
  startCorrection(sessionId);
  callJson.mockRejectedValueOnce(new LlmError("provider", "Le service ne répond pas."));
  await runCorrection(sessionId);
  expect(getSession(sessionId)).toMatchObject({ status: "draft", error: "Le service ne répond pas.", pe: words(10) });
});

test("success: correction vocabulary becomes cards", async () => {
  const { listCards } = await import("@/lib/cards");
  saveDraft(sessionId, { cr: words(10), pe: words(10) });
  startCorrection(sessionId);
  callJson.mockResolvedValueOnce({ ...correction, vocabulaire: [{ en: "brand", fr: "marque", exemple: "A strong brand." }] });
  await runCorrection(sessionId);
  expect(listCards().map((c) => [c.term, c.origin])).toEqual([["brand", "correction"]]);
});
