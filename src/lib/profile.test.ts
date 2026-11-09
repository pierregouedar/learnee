import { beforeEach, expect, test } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { ALL_TASK_TYPES } from "@/lib/tiers";
import { insertPlacement } from "@/lib/repo/placements";
import { bcp47, DEFAULT_PROFILE, getProfile, GOAL_PRESETS, hasSavedProfile, isExamGoal, languageEn, learningContext, needsOnboarding, saveProfile, targetLanguage, type Profile } from "./profile";

beforeEach(() => resetDbForTests());

test("without a saved profile: English, BTS Communication, B2", () => {
  expect(hasSavedProfile()).toBe(false);
  expect(getProfile()).toEqual(DEFAULT_PROFILE);
  expect(DEFAULT_PROFILE.interests.map((i) => i.key)).toEqual(["comm", "ia", "auto"]);
  expect(GOAL_PRESETS["bts-com"].taskTypes).toBe(ALL_TASK_TYPES);
});

test("the profile round-trips through the settings", () => {
  const p: Profile = { ...DEFAULT_PROFILE, target: { code: "es", name: "Spanish" }, goal: { preset: "custom", description: "Voyager en Amérique latine" }, level: "B1" };
  saveProfile(p);
  expect(hasSavedProfile()).toBe(true);
  expect(getProfile()).toEqual(p);
});

test("an invalid profile is refused on save and ignored on read", () => {
  expect(() => saveProfile({ ...DEFAULT_PROFILE, goal: { preset: "custom" } })).toThrow();
  expect(() => saveProfile({ ...DEFAULT_PROFILE, interests: [] })).toThrow();
  db().prepare(`INSERT INTO settings (key, value) VALUES ('profile', '{"target":"en"}')`).run();
  expect(getProfile()).toEqual(DEFAULT_PROFILE);
});

test("learningContext describes the goal to the model", () => {
  expect(learningContext(DEFAULT_PROFILE)).toMatchObject({
    target: "English",
    targetFr: "anglais",
    native: "French",
    goalLine: "preparing the BTS Communication written English exam (épreuve E21)",
    examiner: "an experienced BTS examiner in France",
    level: "B2",
  });
  const custom = learningContext({ ...DEFAULT_PROFILE, target: { code: "de", name: "German" }, goal: { preset: "custom", description: "Travailler à Berlin" } });
  expect(custom.targetFr).toBe("allemand");
  expect(custom.goalLine).toBe("Travailler à Berlin");
  expect(custom.examiner).toBe("an experienced German teacher");
});

test("bcp47 keeps British English for the browser voice", () => {
  expect(bcp47("en")).toBe("en-GB");
  expect(bcp47("es")).toBe("es");
});

test("onboarding: asked when nothing is saved and nothing was done yet", () => {
  expect(needsOnboarding()).toBe(true);
  expect(hasSavedProfile()).toBe(false);
  saveProfile({ ...DEFAULT_PROFILE, level: "C1" });
  expect(needsOnboarding()).toBe(false);
});

test("onboarding: an install already in use silently keeps the default profile", () => {
  insertPlacement({ grammar: [], reading: { title: "t", text: "x", questions: [] }, writing: { task: "w" } }, new Date());
  expect(needsOnboarding()).toBe(false);
  expect(hasSavedProfile()).toBe(true);
  expect(getProfile()).toEqual(DEFAULT_PROFILE);
});

test("language names and exam goals for the interface", () => {
  expect(targetLanguage(DEFAULT_PROFILE)).toEqual({ code: "en", name: "English", nameFr: "anglais", bcp47: "en-GB" });
  expect(languageEn("ja")).toBe("Japanese");
  expect(languageEn("zz")).toBeUndefined();
  expect(isExamGoal(DEFAULT_PROFILE)).toBe(true);
  expect(isExamGoal({ ...DEFAULT_PROFILE, goal: { preset: "pro" } })).toBe(false);
});
