import { beforeEach, expect, test } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getTier, setTier } from "./settings";
import { getSubject, insertSubject, listReadySubjects, markSubjectUsed, type NewSubject } from "./subjects";

const base: NewSubject = {
  domain: "ia",
  source: "topic",
  sourceRef: "IA et pub",
  tier: 1,
  title: "AI ads",
  article: "Some article.",
  task: "Rédigez un courriel.",
  guideQuestions: ["Qui ?", "Quoi ?"],
  keywords: [{ word: "brand", definition: "a company name" }],
  structure: "Objet, salutation, corps, formule",
};

beforeEach(() => resetDbForTests());

test("tier defaults to 1 and can be changed", () => {
  expect(getTier()).toBe(1);
  setTier(2);
  expect(getTier()).toBe(2);
});

test("insert and read back a subject with JSON fields", () => {
  const s = insertSubject(base);
  expect(s.status).toBe("ready");
  expect(getSubject(s.id)).toEqual(s);
  expect(s.keywords[0].word).toBe("brand");
});

test("list ready subjects filtered by domain, used ones excluded", () => {
  const a = insertSubject(base);
  insertSubject({ ...base, domain: "auto" });
  expect(listReadySubjects()).toHaveLength(2);
  expect(listReadySubjects("auto")).toHaveLength(1);
  markSubjectUsed(a.id);
  expect(listReadySubjects("ia")).toHaveLength(0);
});
