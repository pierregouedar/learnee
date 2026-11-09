import { expect, test } from "vitest";
import { cleanSelection, sentenceAround } from "./lookup";

test("cleanSelection accepts 1 to 4 words, 60 chars max", () => {
  expect(cleanSelection(" brand ")).toBe("brand");
  expect(cleanSelection("“brand,”")).toBe("brand");
  expect(cleanSelection("  take\n off ")).toBe("take off");
  expect(cleanSelection("don't")).toBe("don't");
  expect(cleanSelection("a b c d")).toBe("a b c d");
  expect(cleanSelection("a b c d e")).toBeNull();
  expect(cleanSelection("x".repeat(61))).toBeNull();
  expect(cleanSelection("")).toBeNull();
  expect(cleanSelection("123")).toBeNull();
});

test("sentenceAround returns the sentence holding the offset", () => {
  const text = "Brands love AI. The campaign went viral! Sales rose.";
  expect(sentenceAround(text, text.indexOf("campaign"))).toBe("The campaign went viral!");
  expect(sentenceAround(text, 0)).toBe("Brands love AI.");
  expect(sentenceAround(text, text.indexOf("rose"))).toBe("Sales rose.");
  expect(sentenceAround("no final stop here", 3)).toBe("no final stop here");
  expect(sentenceAround("y ".repeat(300), 10)).toHaveLength(400);
});
