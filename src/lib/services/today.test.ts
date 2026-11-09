import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createAttempt, insertSet } from "@/lib/repo/grammar";
import { insertPlacement } from "@/lib/repo/placements";
import { createSession, saveCorrection, setCorrecting } from "@/lib/repo/sessions";
import { insertSubject } from "@/lib/repo/subjects";
import { saveWeekPlan } from "@/lib/repo/week-plan";
import type { Correction } from "@/lib/schemas";
import { DEFAULT_WEEK_PLAN } from "@/lib/week-plan";

vi.mock("@/lib/review", () => ({ countDue: () => 12 }));
const { buildToday } = await import("./today");

const monday = new Date(2026, 9, 5, 9);
let subjectId = "";
beforeEach(() => {
  resetDbForTests();
  subjectId = insertSubject({ domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [] }).id;
});

test("first Monday: writing task, placement invitation, cards with an estimated duration", () => {
  expect(buildToday(monday)).toEqual({
    dueCards: 12, reviewMinutes: 2, tasks: ["writing"], resume: [], placement: "first", proposal: null, tier: 1,
  });
});

test("work in progress is offered first", () => {
  createSession(subjectId, 1);
  const setId = insertSet("articles", "A2", [{ format: "gap", prompt: "___ agency", accepted: ["the"], explanation: "Article défini." }], monday);
  const attempt = createAttempt(setId, "articles", monday);
  insertPlacement({ grammar: [], reading: { title: "t", text: "x", questions: [] }, writing: { task: "w" } }, monday);
  const t = buildToday(new Date(monday.getTime() + 3_600_000));
  expect(t.resume).toEqual([
    { href: "/rediger", label: "Reprendre ma copie" },
    { href: `/grammaire/${attempt.id}`, label: "Reprendre la série : Articles" },
    { href: "/positionnement", label: "Reprendre le test de positionnement" },
  ]);
  expect(t.placement).toBeNull();
});

test("a Saturday in January without a mock exam proposes it", () => {
  expect(buildToday(new Date(2027, 0, 9, 9)).tasks).toEqual(["mock"]);
});

test("Wednesday rewrite points to the last corrected copy with errors", () => {
  const s = createSession(subjectId, 1);
  setCorrecting(s.id);
  const correction: Correction = {
    compte_rendu: { note: 5, commentaire: "c", idees_manquantes: [] },
    expression: { note: 5, niveau: "B1", erreurs: [{ extrait: "he go", correction: "he goes", explication: "3e personne.", type: "grammaire" }], points_forts: [], version_amelioree: "v" },
    vocabulaire: [],
    conseil: "k",
  };
  saveCorrection(s.id, correction);
  saveWeekPlan({ ...DEFAULT_WEEK_PLAN, wed: ["rewrite"] });
  const t = buildToday(new Date(2026, 9, 7, 9));
  expect(t.tasks).toEqual(["rewrite"]);
  expect(t.rewriteHref).toBe(`/sessions/${s.id}/reecrire`);
});
