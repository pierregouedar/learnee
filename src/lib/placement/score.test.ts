import { expect, test } from "vitest";
import { levelFromPercent, placementDue, placementOutcome } from "./score";

const grammar = (wrongPoints: string[], total = 20) =>
  Array.from({ length: total }, (_, i) => ({ point: (wrongPoints[i] ?? "articles") as never, correct: i >= wrongPoints.length }));

test("tier 1 by default, 2 and 3 when all three skills are there", () => {
  expect(placementOutcome({ grammar: grammar(["articles", "passive", "modals", "questions", "past_simple", "futures", "relatives", "connectors", "modals", "passive"]), readingPct: 50, writingLevel: "B1" }).tier).toBe(1);
  expect(placementOutcome({ grammar: grammar(["passive", "modals", "passive", "articles", "questions"]), readingPct: 50, writingLevel: "B1" }).tier).toBe(2);
  expect(placementOutcome({ grammar: grammar(["passive", "modals", "passive", "articles", "questions"]), readingPct: 50, writingLevel: "A2" }).tier).toBe(1);
  expect(placementOutcome({ grammar: grammar(["passive", "modals"]), readingPct: 75, writingLevel: "B2" }).tier).toBe(3);
  expect(placementOutcome({ grammar: grammar(["passive", "modals"]), readingPct: 75, writingLevel: "B1+" }).tier).toBe(2);
});

test("priorities: most frequent mistakes first, programme order on ties, at most 3", () => {
  const out = placementOutcome({ grammar: grammar(["passive", "modals", "passive", "articles", "questions"]), readingPct: 50, writingLevel: "B1" });
  expect(out.priorities).toEqual(["passive", "questions", "articles"]);
  expect(out.grammarPct).toBe(75);
  expect(placementOutcome({ grammar: grammar([]), readingPct: 100, writingLevel: "C1" }).priorities).toEqual([]);
});

test("levels per skill, listening « non testée » when skipped", () => {
  const out = placementOutcome({ grammar: grammar(["passive", "modals", "passive", "articles", "questions"]), readingPct: 100, writingLevel: "B1", listeningPct: 33 });
  expect(out.levels).toEqual({ Grammaire: "B1+", "Compréhension écrite": "B2", "Expression écrite": "B1", "Compréhension orale": "A2" });
  expect(placementOutcome({ grammar: grammar([]), readingPct: 0, writingLevel: "A1" }).levels["Compréhension orale"]).toBe("non testée");
  expect([0, 39, 40, 59, 60, 79, 80, 100].map(levelFromPercent)).toEqual(["A2", "A2", "B1", "B1", "B1+", "B1+", "B2", "B2"]);
});

test("placementDue: first launch, then January and April", () => {
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
  expect(placementDue(d(2026, 9, 22))).toBe(true);
  expect(placementDue(d(2026, 11, 5), d(2026, 9, 22).toISOString())).toBe(false);
  expect(placementDue(d(2027, 1, 4), d(2026, 9, 22).toISOString())).toBe(true);
  expect(placementDue(d(2027, 1, 20), d(2027, 1, 4).toISOString())).toBe(false);
  expect(placementDue(d(2027, 2, 1), d(2026, 9, 22).toISOString())).toBe(false);
  expect(placementDue(d(2027, 4, 2), d(2027, 1, 4).toISOString())).toBe(true);
});
