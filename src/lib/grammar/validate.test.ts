import { expect, test } from "vitest";
import { reorderWords, shuffled, validateItems } from "./validate";

const gap = (i: number) => ({
  format: "gap",
  prompt: `She ___ (work) here since 20${10 + i}.`,
  accepted: ["has worked", "has been working"],
  explanation: "Since + point de départ : present perfect.",
});

test("keeps well-formed items and trims fields", () => {
  const items = validateItems([{ ...gap(1), prompt: "  She ___ (work) here since 2022.  ", accepted: [" has worked ", ""] }]);
  expect(items).toEqual([
    { format: "gap", prompt: "She ___ (work) here since 2022.", accepted: ["has worked"], explanation: "Since + point de départ : present perfect." },
  ]);
});

test("drops items without expected answer, prompt or explanation, and unknown formats", () => {
  expect(
    validateItems([
      { ...gap(1), accepted: [] },
      { ...gap(2), accepted: ["  "] },
      { ...gap(3), prompt: " " },
      { ...gap(4), explanation: "" },
      { ...gap(5), format: "essay" },
      "not an object",
    ]),
  ).toEqual([]);
});

test("removes duplicates within the set (same prompt and answer, normalized)", () => {
  const items = validateItems([gap(1), { ...gap(1), prompt: gap(1).prompt.toUpperCase() }, gap(2)]);
  expect(items).toHaveLength(2);
});

test("two reorder items with the same instruction but different sentences are both kept", () => {
  const items = validateItems([
    { format: "reorder", prompt: "Remettez les mots dans l’ordre.", accepted: ["We launched the campaign yesterday."], explanation: "Ordre sujet-verbe-complément." },
    { format: "reorder", prompt: "Remettez les mots dans l’ordre.", accepted: ["The client has approved the logo."], explanation: "Ordre sujet-verbe-complément." },
  ]);
  expect(items).toHaveLength(2);
});

test("mcq needs 3-4 distinct options including an accepted one", () => {
  const mcq = { format: "mcq", prompt: "They ___ the ad last week.", accepted: ["launched"], explanation: "Last week : prétérit." };
  expect(validateItems([{ ...mcq, options: ["launched", "have launched", "launch"] }])).toHaveLength(1);
  expect(validateItems([{ ...mcq, options: ["launched", "launch"] }])).toHaveLength(0);
  expect(validateItems([{ ...mcq, options: ["have launched", "launch", "launching"] }])).toHaveLength(0);
  expect(validateItems([{ ...mcq, options: ["launched", "launched", "launch"] }])).toHaveLength(0);
});

test("reorder options are built by the server from the accepted sentence", () => {
  const [item] = validateItems([
    { format: "reorder", prompt: "Remettez les mots dans l’ordre.", accepted: ["We launched the campaign yesterday."], options: ["ignored"], explanation: "e" },
  ]);
  expect([...item.options!].sort()).toEqual(["We", "campaign", "launched", "the", "yesterday"].sort());
  expect(item.options!.join(" ")).not.toBe("We launched the campaign yesterday");
});

test("reorder needs at least 3 words", () => {
  expect(validateItems([{ format: "reorder", prompt: "Ordre", accepted: ["Thank you."], explanation: "e" }])).toHaveLength(0);
});

test("an error_spot item must actually contain an error", () => {
  const spot = { format: "error_spot", explanation: "Accord à la 3e personne." };
  expect(validateItems([{ ...spot, prompt: "He don't like the logo.", accepted: ["He doesn't like the logo."] }])).toHaveLength(1);
  expect(validateItems([{ ...spot, prompt: "He does not like the logo.", accepted: ["He doesn't like the logo."] }])).toHaveLength(0);
});

test("caps the set at 15 items", () => {
  expect(validateItems(Array.from({ length: 20 }, (_, i) => gap(i)))).toHaveLength(15);
});

test("translate items may have an empty accepted (LLM-checked), other formats may not", () => {
  const translate = { format: "translate", prompt: "Traduisez : Nous avons lancé la campagne hier.", accepted: [], explanation: "Prétérit : action terminée." };
  expect(validateItems([translate])).toEqual([translate]);
  expect(validateItems([{ ...gap(1), accepted: [] }])).toHaveLength(0);
});

test("reorderWords strips final punctuation; shuffled is a permutation that differs", () => {
  expect(reorderWords(" We launched it today! ")).toEqual(["We", "launched", "it", "today"]);
  const words = ["a", "b", "c", "d"];
  const out = shuffled(words, () => 0.99); // Fisher-Yates with j = i → identity, so the fallback reverses
  expect([...out].sort()).toEqual(words);
  expect(out).not.toEqual(words);
});
