import { beforeEach, expect, test } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import type { GeneratedItem } from "@/lib/grammar/schema";
import type { Correction, ErrorItem } from "@/lib/schemas";
import { createSession, saveCorrection, setCorrecting } from "./sessions";
import { insertSubject } from "./subjects";
import {
  countUnusedSets, createAttempt, findUnusedSet, finishAttempt, flagItem, getAttempt, getItem, getMastery,
  getOpenAttempt, insertSet, lastPracticed, listItems, listMastery, placementPriorities, recentCorrections,
  saveAnswers, saveMastery, toPublicItem,
} from "./grammar";

const items = (n: number): GeneratedItem[] =>
  Array.from({ length: n }, (_, i) => ({ format: "gap", prompt: `We ___ (launch) ad ${i}.`, accepted: ["launched"], explanation: "Prétérit." }));
const t0 = new Date("2026-10-05T09:00:00.000Z");

beforeEach(() => resetDbForTests());

test("a set keeps its items in order; public items hide the answers", () => {
  const setId = insertSet("past_simple", "A2", [
    ...items(8),
    { format: "mcq", prompt: "They ___ it.", options: ["did", "done", "do"], accepted: ["did"], explanation: "Prétérit." },
  ], t0);
  const list = listItems(setId);
  expect(list).toHaveLength(9);
  expect(list[0]).toMatchObject({ setId, position: 0, format: "gap", accepted: ["launched"], options: [] });
  expect(list[8].options).toEqual(["did", "done", "do"]);
  expect(toPublicItem(list[8])).toEqual({ id: list[8].id, format: "mcq", prompt: "They ___ it.", options: ["did", "done", "do"] });
});

test("unused sets: no attempt and enough unflagged items; flagged items disappear", () => {
  const a = insertSet("past_simple", "A2", items(9), t0);
  const b = insertSet("past_simple", "A2", items(9), new Date(t0.getTime() + 1000));
  expect(findUnusedSet("past_simple", "A2")).toBe(a);
  expect(countUnusedSets("past_simple", "A2")).toBe(2);
  createAttempt(a, "past_simple", t0);
  expect(findUnusedSet("past_simple", "A2")).toBe(b);
  const [first, second] = listItems(b);
  expect(flagItem(first.id, t0)).toBe(true);
  expect(listItems(b)).toHaveLength(8);
  expect(getItem(first.id)?.flaggedAt).toBe(t0.toISOString());
  expect(countUnusedSets("past_simple", "A2")).toBe(1);
  flagItem(second.id, t0);
  expect(findUnusedSet("past_simple", "A2")).toBeUndefined(); // 7 items < MIN_ITEMS
  expect(flagItem("nope")).toBe(false);
});

test("unused sets are served only at the requested level", () => {
  const a2 = insertSet("articles", "A2", items(9), t0);
  expect(findUnusedSet("articles", "B1")).toBeUndefined();
  expect(countUnusedSets("articles", "B1")).toBe(0);
  expect(findUnusedSet("articles", "A2")).toBe(a2);
});

test("attempts: answers, finish, open attempt window, last practised date", () => {
  const setId = insertSet("articles", "A2", items(8), t0);
  const attempt = createAttempt(setId, "articles", t0);
  expect(getOpenAttempt(new Date(t0.getTime() + 3_600_000))?.id).toBe(attempt.id);
  expect(getOpenAttempt(new Date(t0.getTime() + 25 * 3_600_000))).toBeUndefined();
  saveAnswers(attempt.id, [{ itemId: "x", answer: "a", correct: true, expected: "a" }]);
  expect(getAttempt(attempt.id)?.answers).toHaveLength(1);
  const end = new Date(t0.getTime() + 600_000);
  finishAttempt(attempt.id, 75, end);
  expect(getAttempt(attempt.id)).toMatchObject({ score: 75, finishedAt: end.toISOString() });
  expect(getOpenAttempt(end)).toBeUndefined();
  expect(lastPracticed()).toEqual({ articles: end.toISOString() });
});

test("mastery round-trips and defaults to empty", () => {
  expect(getMastery("passive")).toEqual({ point: "passive", scores: [] });
  saveMastery({ point: "passive", scores: [{ score: 90, at: t0.toISOString() }], masteredAt: t0.toISOString(), nextReviewAt: "2026-10-26T09:00:00.000Z" });
  expect(getMastery("passive").masteredAt).toBe(t0.toISOString());
  saveMastery({ point: "passive", scores: [] });
  expect(getMastery("passive").masteredAt).toBeUndefined();
  expect(listMastery()).toHaveLength(1);
});

const grammarError = (categorie?: ErrorItem["categorie"]): ErrorItem => ({ extrait: "x", correction: "y", explication: "z", type: "grammaire", categorie });
const correction = (erreurs: ErrorItem[]): Correction => ({
  compte_rendu: { note: 5, commentaire: "c", idees_manquantes: [] },
  expression: { note: 5, niveau: "B1", erreurs, points_forts: [], version_amelioree: "v" },
  vocabulaire: [],
  conseil: "k",
});

test("recentCorrections returns grammar categories of the latest corrected copies", () => {
  const subjectId = insertSubject({ domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [] }).id;
  for (const erreurs of [
    [grammarError("articles")],
    [grammarError("articles"), grammarError(undefined), { ...grammarError("passive"), type: "vocabulaire" as const }],
    [grammarError("modals")],
  ]) {
    const s = createSession(subjectId, 1);
    setCorrecting(s.id);
    saveCorrection(s.id, correction(erreurs));
  }
  const recent = recentCorrections(2);
  expect(recent.map((r) => r.categories)).toEqual([["modals"], ["articles"]]);
  expect(recent[0].correctedAt >= recent[1].correctedAt).toBe(true);
});

test("placementPriorities reads the latest finished placement", () => {
  expect(placementPriorities()).toEqual([]);
  db().prepare(`INSERT INTO placements (id, status, content, result, created_at, finished_at) VALUES ('p1', 'done', '{}', ?, ?, ?)`)
    .run(JSON.stringify({ priorities: ["articles", "bogus", "passive"] }), t0.toISOString(), t0.toISOString());
  expect(placementPriorities()).toEqual(["articles", "passive"]);
});
