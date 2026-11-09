import { beforeEach, expect, test } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { getJsonSetting, getTier, setJsonSetting, setTier } from "./settings";

beforeEach(() => resetDbForTests());

test("JSON settings round-trip and fall back when missing", () => {
  expect(getJsonSetting("week_plan", { a: 1 })).toEqual({ a: 1 });
  setJsonSetting("week_plan", { mon: ["writing"] });
  expect(getJsonSetting("week_plan", null)).toEqual({ mon: ["writing"] });
  setJsonSetting("week_plan", { mon: [] });
  expect(getJsonSetting("week_plan", null)).toEqual({ mon: [] });
});

test("getJsonSetting returns fallback on corrupt JSON", () => {
  db()
    .prepare(`INSERT INTO settings (key, value) VALUES ('corrupt', '{"a":')`)
    .run();
  expect(getJsonSetting("corrupt", { fallback: true })).toEqual({ fallback: true });
});

test("tier setting still defaults to 1", () => {
  expect(getTier()).toBe(1);
  setTier(2);
  expect(getTier()).toBe(2);
});
