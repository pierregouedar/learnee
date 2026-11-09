import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { DEFAULT_PROFILE, saveProfile, type Profile } from "@/lib/profile";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { ENGLISH_PROGRAMME, generateProgramme, getProgramme, isProgrammePoint, pointLabel, programmeUpTo } = await import("./grammar-programme");
const { selectPoint } = await import("@/lib/grammar/selection");

const spanish: Profile = { ...DEFAULT_PROFILE, target: { code: "es", name: "Spanish" }, goal: { preset: "b2" } };

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
});

const point = (i: number, period: number) => ({
  key: `punto_${i}`, label: `Point ${i}`, focus: `Focus ${i}.`, group: "verbs", period,
});
const generated = (n = 16) => ({
  points: Array.from({ length: n }, (_, i) => point(i, 3 - (i % 4))),
  verbs: [{ base: "ser", past: "fue", participle: "sido", fr: "être", example: "La campaña fue un éxito." }],
});

test("the English programme keeps the curated data: 19 points, labels, focus, groups, 100 verbs", () => {
  const keys = ENGLISH_PROGRAMME.points.map((p) => p.key);
  expect(keys).toHaveLength(19);
  expect(new Set(keys).size).toBe(19);
  for (const p of ENGLISH_PROGRAMME.points) {
    expect(p.label.length).toBeGreaterThan(3);
    expect(p.focus.length).toBeGreaterThan(20);
  }
  expect(pointLabel("present_perfect", ENGLISH_PROGRAMME)).toBe("Prétérit ou present perfect");
  expect(ENGLISH_PROGRAMME.points.find((p) => p.key === "articles")?.group).toBe("words");
  expect(ENGLISH_PROGRAMME.verbs).toHaveLength(100);
  expect(getProgramme()).toBe(ENGLISH_PROGRAMME); // profil par défaut : anglais
});

test("programmeUpTo follows the school year (§18.3)", () => {
  expect(programmeUpTo(new Date(2026, 8, 15))).toEqual([
    "present_simple_continuous", "past_simple", "present_perfect", "irregular_verbs", "questions", "articles",
  ]);
  expect(programmeUpTo(new Date(2026, 10, 3))).toContain("futures");
  expect(programmeUpTo(new Date(2026, 10, 3))).not.toContain("passive");
  const feb = programmeUpTo(new Date(2027, 1, 10));
  expect(feb).toContain("passive");
  expect(feb).toContain("articles");
  expect(feb).not.toContain("reported_speech");
  expect(programmeUpTo(new Date(2027, 3, 1))).toContain("reported_speech");
  expect(programmeUpTo(new Date(2027, 4, 20))).toHaveLength(19);
  expect(programmeUpTo(new Date(2027, 7, 20))).toHaveLength(19);
});

test("isProgrammePoint accepts only programme keys; unknown labels fall back to the key", () => {
  expect(isProgrammePoint("passive")).toBe(true);
  expect(isProgrammePoint("passive_voice")).toBe(false);
  expect(isProgrammePoint(undefined)).toBe(false);
  expect(pointLabel("passive_voice")).toBe("passive_voice");
});

test("a language not yet prepared has an empty programme, and no point is selected", () => {
  saveProfile(spanish);
  expect(getProgramme()).toEqual({ language: "es", points: [], verbs: [] });
  expect(isProgrammePoint("passive")).toBe(false);
  expect(selectPoint({ now: new Date(), corrections: [], mastery: [], lastPracticed: {}, priorities: [] })).toBeNull();
});

test("generateProgramme stores the programme of the profile language, ordered by period", async () => {
  saveProfile(spanish);
  callJson.mockResolvedValueOnce(generated());
  const programme = await generateProgramme();
  expect(callJson).toHaveBeenCalledWith("grammar_set", expect.stringContaining("Spanish grammar programme"), expect.anything(), "grammar_programme:es", undefined);
  expect(programme.points.map((p) => p.period)).toEqual([...programme.points.map((p) => p.period)].sort());
  expect(programme.points[0].key).toBe("punto_3"); // première du period 0, ordre d'origine gardé
  expect(getProgramme()).toEqual(programme);
  expect(getProgramme().verbs[0].base).toBe("ser");
});

test("the generated programme schema: 15-20 points, unique ascii slugs, periods 0-3, verbs may be empty", async () => {
  callJson.mockResolvedValue({ points: [], verbs: [] });
  await generateProgramme(spanish);
  const schema = callJson.mock.calls[0][2];
  expect(schema.safeParse(generated()).success).toBe(true);
  expect(schema.safeParse({ ...generated(), verbs: [] }).success).toBe(true);
  expect(schema.safeParse(generated(14)).success).toBe(false);
  expect(schema.safeParse(generated(21)).success).toBe(false);
  const dup = generated();
  dup.points[1].key = dup.points[0].key;
  expect(schema.safeParse(dup).success).toBe(false);
  const accent = generated();
  accent.points[0].key = "pretérito";
  expect(schema.safeParse(accent).success).toBe(false);
  const period = generated();
  period.points[0].period = 4;
  expect(schema.safeParse(period).success).toBe(false);
  const verbs = generated();
  verbs.verbs = Array.from({ length: 61 }, () => verbs.verbs[0]);
  expect(schema.safeParse(verbs).success).toBe(false);
});
