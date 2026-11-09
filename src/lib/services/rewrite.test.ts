import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createSession, saveCorrection, setCorrecting } from "@/lib/repo/sessions";
import { insertSubject } from "@/lib/repo/subjects";
import type { Correction, ErrorItem } from "@/lib/schemas";
import { buildRewritePrompt } from "@/lib/prompts/rewrite";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { RewriteRefused, rewriteRate, submitRewrite } = await import("./rewrite");
const { latestRewrite, latestRewritableSession } = await import("@/lib/repo/rewrites");

const err = (extrait: string, correction: string): ErrorItem => ({ extrait, correction, explication: "Accord du verbe.", type: "grammaire" });
const correction = (erreurs: ErrorItem[]): Correction => ({
  compte_rendu: { note: 5, commentaire: "c", idees_manquantes: [] },
  expression: { note: 5, niveau: "B1", erreurs, points_forts: [], version_amelioree: "MODEL VERSION" },
  vocabulaire: [],
  conseil: "k",
});
const PE = "He don't like the logo and we has launch the campaign yesterday with many clients and partners.";
const REWRITE = "He doesn't like the logo and we launched the campaign yesterday with many clients and partner.";

let subjectId = "";
function corrected(erreurs: ErrorItem[]) {
  const s = createSession(subjectId, 1);
  setCorrecting(s.id);
  saveCorrection(s.id, correction(erreurs));
  return s.id;
}

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  subjectId = insertSubject({ domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "Écrivez un courriel.", guideQuestions: [], keywords: [] }).id;
});

test("rewriteRate counts each original error once, ignores unknown indexes", () => {
  expect(rewriteRate(3, [{ index: 0, statut: "corrigee" }, { index: 1, statut: "restante" }, { index: 2, statut: "corrigee" }])).toEqual({ corrected: 2, total: 3, rate: 67 });
  expect(rewriteRate(2, [{ index: 0, statut: "corrigee" }, { index: 0, statut: "corrigee" }, { index: 5, statut: "corrigee" }])).toEqual({ corrected: 1, total: 2, rate: 50 });
  expect(rewriteRate(0, [])).toEqual({ corrected: 0, total: 0, rate: 0 });
});

test("prompt lists numbered errors and both texts, never asks for a mark", () => {
  const p = buildRewritePrompt({ task: "Écrivez un courriel.", first: PE, errors: [err("don't", "doesn't"), err("has launch", "launched")], rewrite: REWRITE });
  expect(p).toContain('0. "don\'t" → doesn\'t');
  expect(p).toContain('1. "has launch" → launched');
  expect(p).toContain(`"""${REWRITE}"""`);
  expect(p).toContain("Do not grade");
  expect(p).toContain("Reply with only JSON");
});

test("a rewrite is checked, stored with its rate, and the copy is no longer « to rewrite »", async () => {
  const id = corrected([err("don't", "doesn't"), err("has launch", "launched")]);
  expect(latestRewritableSession()).toBe(id);
  callJson.mockResolvedValueOnce({
    erreurs: [{ index: 0, statut: "corrigee", commentaire: "Bien." }, { index: 1, statut: "corrigee", commentaire: "Bien." }, { index: 7, statut: "corrigee", commentaire: "?" }],
    nouvelles: [{ extrait: "partner", correction: "partners", explication: "Pluriel après many." }],
    conseil: "Relis les pluriels.",
  });
  const r = await submitRewrite(id, REWRITE);
  expect(callJson).toHaveBeenCalledWith("rewrite_check", expect.stringContaining(REWRITE), expect.anything(), id);
  expect(r.result).toMatchObject({ corrected: 2, total: 2, rate: 100, conseil: "Relis les pluriels." });
  expect(r.result.erreurs).toHaveLength(2);
  expect(latestRewrite(id)?.pe).toBe(REWRITE);
  expect(latestRewritableSession()).toBeUndefined();
});

test("refusals: unknown copy, draft copy, no errors, empty rewrite", async () => {
  await expect(submitRewrite("nope", REWRITE)).rejects.toMatchObject({ status: 404 });
  const draft = createSession(subjectId, 1);
  await expect(submitRewrite(draft.id, REWRITE)).rejects.toMatchObject({ status: 409 });
  setCorrecting(draft.id);
  saveCorrection(draft.id, correction([]));
  await expect(submitRewrite(draft.id, REWRITE)).rejects.toMatchObject({ status: 400 });
  expect(latestRewritableSession()).toBeUndefined();
  const id = corrected([err("don't", "doesn't")]);
  await expect(submitRewrite(id, "Too short.")).rejects.toBeInstanceOf(RewriteRefused);
  expect(callJson).not.toHaveBeenCalled();
});
