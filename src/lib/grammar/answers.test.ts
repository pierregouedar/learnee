import { describe, expect, test } from "vitest";
import { answerVariants, matchesAccepted, normalizeAnswer } from "./answers";

describe("normalizeAnswer", () => {
  test("case, spaces and final punctuation", () => {
    expect(normalizeAnswer("  She   HAS worked here.  ")).toBe("she has worked here");
    expect(normalizeAnswer("Really?!")).toBe("really");
    expect(normalizeAnswer("However, we launched it; then we stopped.")).toBe("however we launched it then we stopped");
  });

  test("typographic apostrophes, quotes and dashes", () => {
    expect(normalizeAnswer("don’t")).toBe("do not");
    expect(normalizeAnswer("don‘t")).toBe("do not");
    expect(normalizeAnswer("donʼt")).toBe("do not");
    expect(normalizeAnswer("don`t")).toBe("do not");
    expect(normalizeAnswer("“Hello,” she said")).toBe("hello she said");
    expect(normalizeAnswer("a well‑known brand")).toBe("a well-known brand");
    expect(normalizeAnswer("launch date")).toBe("launch date");
  });

  test("unambiguous contractions are expanded", () => {
    expect(normalizeAnswer("doesn't")).toBe("does not");
    expect(normalizeAnswer("didn't")).toBe("did not");
    expect(normalizeAnswer("haven't")).toBe("have not");
    expect(normalizeAnswer("won't")).toBe("will not");
    expect(normalizeAnswer("can't")).toBe("cannot");
    expect(normalizeAnswer("can not")).toBe("cannot");
    expect(normalizeAnswer("shan't")).toBe("shall not");
    expect(normalizeAnswer("I'm")).toBe("i am");
    expect(normalizeAnswer("they're")).toBe("they are");
    expect(normalizeAnswer("we've")).toBe("we have");
    expect(normalizeAnswer("she'll")).toBe("she will");
    expect(normalizeAnswer("let's")).toBe("let us");
  });

  test("keeps what must not change", () => {
    expect(normalizeAnswer("3.5 million")).toBe("3.5 million");
    expect(normalizeAnswer("at 5 o’clock")).toBe("at 5 o'clock");
    expect(normalizeAnswer("the client's logo")).toBe("the client's logo");
    expect(normalizeAnswer("its logo")).toBe("its logo");
  });
});

describe("answerVariants", () => {
  test("ambiguous 's and 'd give both readings", () => {
    expect(answerVariants("He's left")).toEqual(["he is left", "he has left"]);
    expect(answerVariants("I'd go")).toEqual(["i would go", "i had go"]);
  });

  test("possessive 's is not expanded", () => {
    expect(answerVariants("the brand's logo")).toEqual(["the brand's logo"]);
  });

  test("empty answer has no variant", () => {
    expect(answerVariants("   ")).toEqual([]);
  });

  test("variants stay bounded", () => {
    expect(answerVariants("he's she's it's that's what's who's I'd we'd you'd").length).toBeLessThanOrEqual(32);
  });
});

describe("matchesAccepted", () => {
  test("contractions never cause false negatives (§18.8)", () => {
    expect(matchesAccepted("don’t", ["do not"])).toBe(true);
    expect(matchesAccepted("do not", ["don't"])).toBe(true);
    expect(matchesAccepted("She doesn’t like the logo.", ["She does not like the logo."])).toBe(true);
    expect(matchesAccepted("They won't come", ["they will not come"])).toBe(true);
    expect(matchesAccepted("We can't", ["we cannot"])).toBe(true);
    expect(matchesAccepted("It’s been a success", ["It has been a success"])).toBe(true);
    expect(matchesAccepted("He's working", ["he is working"])).toBe(true);
    expect(matchesAccepted("I'd already sent it", ["I had already sent it"])).toBe(true);
    expect(matchesAccepted("I would", ["I'd"])).toBe(true);
  });

  test("case, spaces and final punctuation are ignored", () => {
    expect(matchesAccepted("  has worked ", ["has worked"])).toBe(true);
    expect(matchesAccepted("The campaign was launched.", ["the campaign was launched"])).toBe(true);
  });

  test("any accepted answer can match", () => {
    expect(matchesAccepted("has been working", ["has worked", "has been working"])).toBe(true);
  });

  test("real mistakes are still wrong", () => {
    expect(matchesAccepted("have worked", ["has worked"])).toBe(false);
    expect(matchesAccepted("worked", ["has worked"])).toBe(false);
    expect(matchesAccepted("its", ["it's"])).toBe(false);
    expect(matchesAccepted("the client is logo", ["the client's logo"])).toBe(false);
    expect(matchesAccepted("35 million", ["3.5 million"])).toBe(false);
  });

  test("an empty answer never matches", () => {
    expect(matchesAccepted("", ["do not"])).toBe(false);
    expect(matchesAccepted("   ", [""])).toBe(false);
  });
});
