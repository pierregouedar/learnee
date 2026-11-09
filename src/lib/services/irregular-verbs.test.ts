import { beforeEach, expect, test } from "vitest";
import { getCard, keepWord } from "@/lib/cards";
import { db, resetDbForTests } from "@/lib/db";
import { IRREGULAR_VERBS } from "@/lib/grammar/irregular-verbs";
import { dueCards } from "@/lib/review";
import { addIrregularVerbCards, gapSentence, verbKey } from "./irregular-verbs";

const t0 = new Date(2026, 8, 21, 4); // lundi 21 septembre 2026, 4 h
const DAY = 86_400_000;
const verbCards = () =>
  db().prepare(`SELECT id, term, term_key FROM cards WHERE source_kind = 'irregular_verb' ORDER BY created_at, rowid`).all() as {
    id: string; term: string; term_key: string;
  }[];

beforeEach(() => resetDbForTests());

test("the list has 100 distinct verbs, each example contains one of its forms", () => {
  expect(IRREGULAR_VERBS).toHaveLength(100);
  expect(new Set(IRREGULAR_VERBS.map((v) => v.base)).size).toBe(100);
  for (const v of IRREGULAR_VERBS) expect(gapSentence(v), v.base).toContain("___");
});

test("gapSentence hides the past or participle form, whole words only", () => {
  const begin = IRREGULAR_VERBS.find((v) => v.base === "begin")!;
  expect(gapSentence(begin)).toBe("The campaign ___ last Monday.");
  const learn = IRREGULAR_VERBS.find((v) => v.base === "learn")!;
  expect(gapSentence(learn)).toBe("We ___ a lot from the survey.");
});

test("adds 10 cards at once, then waits a week", () => {
  expect(addIrregularVerbCards(t0)).toBe(10);
  expect(verbCards().map((c) => c.term)).toEqual(IRREGULAR_VERBS.slice(0, 10).map((v) => v.base));
  expect(addIrregularVerbCards(new Date(t0.getTime() + 6 * DAY))).toBe(0);
  expect(addIrregularVerbCards(new Date(t0.getTime() + 7 * DAY))).toBe(10);
  expect(verbCards()).toHaveLength(20);
});

test("a verb card: base on the front with a gapped sentence, forms and translation on the back", () => {
  addIrregularVerbCards(t0);
  const be = getCard(verbCards()[0].id)!;
  expect(be).toMatchObject({
    term: "be", termKey: verbKey("be"), definition: "be – was / were – been", fr: "être",
    example: "The launch was a great success.", sourceKind: "irregular_verb", suspended: false,
  });
  expect(be.fsrs).toMatchObject({ reps: 0, state: 0 });
  expect(be.contexts).toEqual([
    { sentence: "The launch ___ a great success.", sourceType: "reading", sourceId: "irregular-verbs", sourceTitle: "Verbes irréguliers" },
  ]);
});

test("a word kept from an article never collides with a verb card", () => {
  keepWord({ term: "read", definition: "look at words", fr: "lire", context: { sentence: "I read it.", sourceType: "reading", sourceId: "s", sourceTitle: "T" } });
  for (let week = 0; week < 10; week++) addIrregularVerbCards(new Date(t0.getTime() + week * 7 * DAY));
  expect(verbCards()).toHaveLength(100);
  expect(verbCards().some((c) => c.term === "read")).toBe(true);
  expect(addIrregularVerbCards(new Date(t0.getTime() + 80 * DAY))).toBe(0);
});

test("new verb cards reach plan 3's review queue", () => {
  addIrregularVerbCards(t0);
  expect(dueCards(new Date(t0.getTime() + 3_600_000)).some((c) => c.term === "be")).toBe(true);
});
