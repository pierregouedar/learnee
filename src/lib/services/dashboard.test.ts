import { beforeEach, expect, test } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createAttempt, finishAttempt, insertSet } from "@/lib/repo/grammar";
import { buildDashboard } from "./dashboard";

const wednesday = new Date(2026, 9, 7, 18);
const item = { format: "gap" as const, prompt: "We ___ (launch) it.", accepted: ["launched"], explanation: "Prétérit." };

beforeEach(() => resetDbForTests());

test("week runs Monday to Sunday and marks today's finished grammar set as done (and « au choix »)", () => {
  const setId = insertSet("articles", "A2", [item], wednesday);
  const attempt = createAttempt(setId, "articles", wednesday);
  finishAttempt(attempt.id, 90, new Date(2026, 9, 7, 17));

  const d = buildDashboard(wednesday);
  expect(d.week.map((w) => new Date(w.date).getDate())).toEqual([5, 6, 7, 8, 9, 10, 11]);
  expect(d.week[2].isToday).toBe(true);
  expect(d.week.slice(0, 2).every((w) => w.isPast)).toBe(true);
  expect(d.doneToday).toEqual(expect.arrayContaining(["grammar", "choice"]));
  expect(d.week[1].done).toEqual([]);
  expect(d.grammar.points).toHaveLength(19);
  expect(d.grammar.points.find((p) => p.point === "articles")?.state).toBe("practised");
  expect(d.errors).toEqual([]);
});
