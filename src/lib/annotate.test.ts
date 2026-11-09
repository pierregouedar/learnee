import { expect, test } from "vitest";
import { annotate, excerpt } from "./annotate";

const join = (s: { text: string }[]) => s.map((x) => x.text).join("");

test("marks found extracts and keeps full text", () => {
  const text = "I am agree with you and he don't know.";
  const { segments, missing } = annotate(text, ["am agree", "don't"]);
  expect(join(segments)).toBe(text);
  expect(segments.filter((s) => s.errorIndex !== undefined).map((s) => [s.text, s.errorIndex])).toEqual([
    ["am agree", 0],
    ["don't", 1],
  ]);
  expect(missing).toEqual([]);
});

test("duplicate extracts take successive occurrences", () => {
  const text = "informations and informations";
  const { segments } = annotate(text, ["informations", "informations"]);
  const marked = segments.filter((s) => s.errorIndex !== undefined);
  expect(marked).toHaveLength(2);
  expect(join(segments)).toBe(text);
});

test("reports missing and empty extracts", () => {
  const { segments, missing } = annotate("Hello world", ["bonjour", "", "world"]);
  expect(missing).toEqual([0, 1]);
  expect(segments.find((s) => s.errorIndex === 2)?.text).toBe("world");
});

test("overlapping extract falls back to next occurrence or missing", () => {
  const { missing } = annotate("a big big dog", ["big big", "big dog"]);
  expect(missing).toEqual([1]);
});

test("the excerpt starts at the sentence of the first error found and cuts at a word", () => {
  const text = "Brands love AI. Many companies uses it every day. It is cheaper than a model.";
  expect(excerpt(text, ["absent", "uses it"])).toBe("Many companies uses it every day. It is cheaper than a model.");
  expect(excerpt(text, ["absent"])).toBe(text);
  expect(excerpt(text, ["uses it"], 30)).toBe("Many companies uses it every…");
  expect(excerpt("First line\nIt are wrong. Next.", ["It are"])).toBe("It are wrong. Next.");
});
