import { describe, expect, test } from "vitest";
import { countWords, isArticleLengthOk, normalizeKey, roundNote } from "./text";

describe("countWords", () => {
  test("empty and whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n ")).toBe(0);
  });
  test("counts across newlines and apostrophes", () => {
    expect(countWords("Dear Sir,\n\nI'm writing  to you.")).toBe(6);
    expect(countWords("l'entreprise a lancé")).toBe(3);
  });
});

describe("roundNote", () => {
  test("rounds to half points", () => {
    expect(roundNote(6.3)).toBe(6.5);
    expect(roundNote(6.2)).toBe(6);
    expect(roundNote(7.75)).toBe(8);
  });
  test("clamps and handles NaN", () => {
    expect(roundNote(12)).toBe(10);
    expect(roundNote(-1)).toBe(0);
    expect(roundNote(Number.NaN)).toBe(0);
  });
});

describe("isArticleLengthOk", () => {
  test("accepts ±15 % around the range", () => {
    expect(isArticleLengthOk(170, [200, 250])).toBe(true);
    expect(isArticleLengthOk(169, [200, 250])).toBe(false);
    expect(isArticleLengthOk(287, [200, 250])).toBe(true);
    expect(isArticleLengthOk(288, [200, 250])).toBe(false);
  });
});

test("normalizeKey: lowercase, no punctuation, single spaces", () => {
  expect(normalizeKey("  Brand-new, “Buzz”!  ")).toBe("brand new buzz");
  expect(normalizeKey("Don’t  GIVE up.")).toBe("don t give up");
  expect(normalizeKey("...")).toBe("");
});
