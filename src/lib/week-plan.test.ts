import { expect, test } from "vitest";
import { DEFAULT_WEEK_PLAN, WeekPlanSchema, dayKey, todayTasks } from "./week-plan";

const d = (day: number) => new Date(2026, 9, day, 9); // 5 octobre 2026 = lundi

test("dayKey maps Monday..Sunday", () => {
  expect([5, 6, 7, 8, 9, 10, 11].map((n) => dayKey(d(n)))).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
});

test("default week §19.3", () => {
  expect(todayTasks(d(5), DEFAULT_WEEK_PLAN, false)).toEqual(["writing"]);
  expect(todayTasks(d(6), DEFAULT_WEEK_PLAN, false)).toEqual(["grammar", "listening"]);
  expect(todayTasks(d(7), DEFAULT_WEEK_PLAN, false)).toEqual(["grammar", "rewrite"]);
  expect(todayTasks(d(9), DEFAULT_WEEK_PLAN, false)).toEqual(["listening"]);
  expect(todayTasks(d(10), DEFAULT_WEEK_PLAN, false)).toEqual(["choice"]);
  expect(todayTasks(d(11), DEFAULT_WEEK_PLAN, false)).toEqual([]);
});

test("a due mock exam replaces Saturday only", () => {
  expect(todayTasks(d(10), DEFAULT_WEEK_PLAN, true)).toEqual(["mock"]);
  expect(todayTasks(d(5), DEFAULT_WEEK_PLAN, true)).toEqual(["writing"]);
  expect(todayTasks(d(10), { ...DEFAULT_WEEK_PLAN, sat: [] }, true)).toEqual(["mock"]);
});

test("an edited plan is followed, duplicates removed", () => {
  expect(todayTasks(d(11), { ...DEFAULT_WEEK_PLAN, sun: ["grammar", "grammar"] }, false)).toEqual(["grammar"]);
});

test("the schema accepts the default plan and rejects unknown tasks or days", () => {
  expect(WeekPlanSchema.safeParse(DEFAULT_WEEK_PLAN).success).toBe(true);
  expect(WeekPlanSchema.safeParse({ ...DEFAULT_WEEK_PLAN, mon: ["sleep"] }).success).toBe(false);
  const noSunday = Object.fromEntries(Object.entries(DEFAULT_WEEK_PLAN).filter(([day]) => day !== "sun"));
  expect(WeekPlanSchema.safeParse(noSunday).success).toBe(false);
});
