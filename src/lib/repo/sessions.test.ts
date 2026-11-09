import { beforeEach, expect, test } from "vitest";
import { resetDbForTests } from "@/lib/db";
import type { Correction } from "@/lib/schemas";
import { insertSubject } from "./subjects";
import {
  ActiveSessionExistsError,
  abandonSession,
  addLookup,
  createSession,
  failCorrection,
  getActiveSession,
  getSession,
  listCorrected,
  recoverInterruptedCorrections,
  saveCorrection,
  saveDraft,
  setCorrecting,
} from "./sessions";

const correction: Correction = {
  compte_rendu: { note: 6, commentaire: "Bien", idees_manquantes: [] },
  expression: { note: 5.5, niveau: "B1", erreurs: [], points_forts: [], version_amelioree: "..." },
  vocabulaire: [],
  conseil: "Relis-toi.",
};

let subjectId: string;
beforeEach(() => {
  resetDbForTests();
  subjectId = insertSubject({
    domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C",
    guideQuestions: [], keywords: [],
  }).id;
});

test("only one active session at a time", () => {
  const s = createSession(subjectId, 1);
  expect(getActiveSession()?.id).toBe(s.id);
  expect(() => createSession(subjectId, 1)).toThrow(ActiveSessionExistsError);
  setCorrecting(s.id);
  expect(() => createSession(subjectId, 1)).toThrow(ActiveSessionExistsError);
  abandonSession(s.id); // no-op: not a draft anymore
  failCorrection(s.id, "x");
  expect(abandonSession(s.id)).toBe(true);
  expect(createSession(subjectId, 1).status).toBe("draft");
});

test("draft save only while draft, updates updatedAt", () => {
  const s = createSession(subjectId, 1);
  expect(saveDraft(s.id, { cr: "Bonjour", pe: "Hello" })).toBe(true);
  const saved = getSession(s.id)!;
  expect(saved.cr).toBe("Bonjour");
  expect(saved.updatedAt >= s.updatedAt).toBe(true);
  setCorrecting(s.id);
  expect(saveDraft(s.id, { cr: "x", pe: "y" })).toBe(false);
});

test("correction success path and history", () => {
  const s = createSession(subjectId, 1);
  expect(setCorrecting(s.id)).toBe(true);
  expect(setCorrecting(s.id)).toBe(false);
  saveCorrection(s.id, correction);
  const done = getSession(s.id)!;
  expect(done.status).toBe("corrected");
  expect(done.result?.expression.note).toBe(5.5);
  expect(getActiveSession()).toBeUndefined();
  expect(listCorrected().map((h) => h.subjectTitle)).toEqual(["T"]);
});

test("failure returns to draft with error, retry clears it", () => {
  const s = createSession(subjectId, 1);
  setCorrecting(s.id);
  failCorrection(s.id, "Panne");
  expect(getSession(s.id)).toMatchObject({ status: "draft", error: "Panne" });
  setCorrecting(s.id);
  expect(getSession(s.id)?.error).toBeUndefined();
});

test("recover interrupted corrections at boot", () => {
  const s = createSession(subjectId, 1);
  setCorrecting(s.id);
  expect(recoverInterruptedCorrections()).toBe(1);
  expect(getSession(s.id)?.status).toBe("draft");
  expect(getSession(s.id)?.error).toMatch(/interrompue/);
});

test("new sessions have no lookups, exam mode off unless asked", () => {
  const s = createSession(subjectId, 1);
  expect(s).toMatchObject({ lookups: [], examMode: false });
  abandonSession(s.id);
  expect(createSession(subjectId, 1, true).examMode).toBe(true);
});

test("addLookup appends once per normalized word", () => {
  const s = createSession(subjectId, 1);
  expect(addLookup(s.id, { en: "Brand", fr: "marque" })).toBe(true);
  expect(addLookup(s.id, { en: "brand.", fr: "marque" })).toBe(true);
  expect(addLookup(s.id, { en: "reach", fr: "portée", exemple: "Our reach grew." })).toBe(true);
  expect(getSession(s.id)?.lookups).toEqual([
    { en: "Brand", fr: "marque" },
    { en: "reach", fr: "portée", exemple: "Our reach grew." },
  ]);
  expect(addLookup("nope", { en: "x", fr: "x" })).toBe(false);
});
