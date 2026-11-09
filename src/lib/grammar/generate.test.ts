import { beforeEach, expect, test, vi } from "vitest";
import { buildGrammarSetPrompt, buildTranslateCheckPrompt } from "@/lib/prompts/grammar";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const { GrammarGenerationError, generateSet } = await import("./generate");

const gap = (i: number) => ({
  format: "gap",
  prompt: `We ___ (launch) campaign number ${i} last week.`,
  accepted: ["launched"],
  explanation: "Prétérit : action terminée à un moment passé précis.",
});

const lesson = {
  summary: "Prétérit pour un moment passé daté, present perfect pour un lien avec maintenant.",
  forms: [
    { name: "Prétérit", use: "Action finie à un moment précis.", form: "verbe + -ed", signals: ["yesterday"], examples: [{ en: "We launched it.", fr: "Nous l'avons lancé." }] },
    { name: "Present perfect", use: "Lien avec maintenant.", form: "have/has + participe passé", signals: ["already"], examples: [{ en: "We have launched it.", fr: "Nous l'avons lancé." }] },
  ],
  pitfalls: [{ wrong: "We have launched it yesterday.", right: "We launched it yesterday.", why: "Date précise : prétérit." }],
};

beforeEach(() => callJson.mockReset());

test("set prompt follows §18.6: level, point, formats, professional context, French explanation, JSON", () => {
  const p = buildGrammarSetPrompt({ point: "present_perfect", level: "A2" });
  expect(p).toContain("level A2");
  expect(p).toContain("present_perfect");
  expect(p).toContain("Prétérit ou present perfect");
  expect(p).toContain("Contrast past simple"); // la leçon couvre les deux temps
  expect(p).toContain("12 items");
  for (const f of ["gap", "error_spot", "transform", "translate", "reorder", "mcq"]) expect(p).toContain(f);
  expect(p).toContain("professional communication");
  expect(p).toContain("IN FRENCH");
  expect(p).toContain("Reply with only JSON");
});

test("translation check prompt embeds the French sentence, references and answer", () => {
  const p = buildTranslateCheckPrompt({
    point: "past_simple", french: "Nous avons lancé la campagne hier.", references: ["We launched the campaign yesterday."], answer: "We have launched the campaign yesterday.",
  });
  expect(p).toContain('"""Nous avons lancé la campagne hier."""');
  expect(p).toContain('"We launched the campaign yesterday."');
  expect(p).toContain('"""We have launched the campaign yesterday."""');
  expect(p).toContain('"correct"');
});

test("returns validated items from the model", async () => {
  callJson.mockResolvedValueOnce({ lesson, items: Array.from({ length: 10 }, (_, i) => gap(i)) });
  const set = await generateSet("past_simple", "A2");
  expect(set.items).toHaveLength(10);
  expect(set.lesson).toEqual(lesson);
  expect(callJson).toHaveBeenCalledWith("grammar_set", expect.any(String), expect.anything(), "past_simple");
});

test("retries once when too few valid items, then gives up with a French error", async () => {
  callJson.mockResolvedValueOnce({ lesson, items: [gap(1)] }).mockResolvedValueOnce({ lesson, items: Array.from({ length: 9 }, (_, i) => gap(i)) });
  expect((await generateSet("past_simple", "A2")).items).toHaveLength(9);
});

test("retries when the lesson is missing", async () => {
  const items = Array.from({ length: 9 }, (_, i) => gap(i));
  callJson.mockResolvedValueOnce({ items }).mockResolvedValueOnce({ lesson, items });
  expect((await generateSet("past_simple", "A2")).lesson).toEqual(lesson);
  expect(callJson).toHaveBeenCalledTimes(2);
  expect(callJson).toHaveBeenCalledTimes(2);

  callJson.mockReset();
  callJson.mockResolvedValue({ items: [gap(1), gap(2)] });
  await expect(generateSet("past_simple", "A2")).rejects.toBeInstanceOf(GrammarGenerationError);
  expect(callJson).toHaveBeenCalledTimes(2);
});
