import { expect, test } from "vitest";
import { normalizeWords, wer, WER_MAX } from "./wer";

test("normalization ignores case, punctuation and curly apostrophes", () => {
  expect(normalizeWords("Don’t STOP, café-owners!")).toEqual(["don't", "stop", "café", "owners"]);
  expect(wer("Hello, world.", "hello world")).toBe(0);
});

test("substitution, deletion and insertion each count as one error", () => {
  expect(wer("the cat sat down", "the dog sat down")).toBe(0.25);
  expect(wer("the cat sat down", "the cat down")).toBe(0.25);
  expect(wer("the cat sat down", "the cat sat right down")).toBe(0.25);
});

test("empty cases", () => {
  expect(wer("", "")).toBe(0);
  expect(wer("", "noise")).toBe(1);
  expect(wer("some words", "")).toBe(1);
});

test("one error in 20 words sits exactly on the acceptance threshold", () => {
  const ref = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
  const hyp = ref.replace("w7", "x");
  expect(wer(ref, hyp)).toBe(0.05);
  expect(wer(ref, hyp) <= WER_MAX).toBe(true);
});
