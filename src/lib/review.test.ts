import { createEmptyCard, State, type Card } from "ts-fsrs";
import { beforeEach, expect, test } from "vitest";
import { keepWord } from "@/lib/cards";
import { db, resetDbForTests } from "@/lib/db";
import {
  boldTerm, buildQueue, dueCards, NEW_PER_DAY, rateCard, REVIEWS_PER_DAY, reviewStats, suspendCard, type QueueCard,
} from "./review";

const now = new Date(2026, 8, 22, 12, 0);
const at = (h: number, min = 0, dayOffset = 0) => new Date(2026, 8, 22 + dayOffset, h, min);
const qc = (id: string, state: State, due: Date, createdAt = "2026-09-01T00:00:00.000Z"): QueueCard => ({
  id, createdAt, fsrs: { ...createEmptyCard(due), state, due } as Card,
});
const none = { newToday: 0, reviewsToday: 0 };

test("new cards: at most 15 per day, oldest first, minus those already started today", () => {
  const cards = Array.from({ length: 20 }, (_, i) => qc(`n${i}`, State.New, now, `2026-09-01T00:00:${String(i).padStart(2, "0")}.000Z`));
  expect(buildQueue(cards, now, none)).toHaveLength(NEW_PER_DAY);
  expect(buildQueue(cards, now, none)[0]).toBe("n0");
  expect(buildQueue(cards, now, { newToday: 10, reviewsToday: 0 })).toHaveLength(5);
  expect(buildQueue(cards, now, { newToday: 40, reviewsToday: 0 })).toHaveLength(0);
});

test("reviews: at most 100 per day, due any time today, not tomorrow", () => {
  const cards = Array.from({ length: 120 }, (_, i) => qc(`r${i}`, State.Review, at(8)));
  expect(buildQueue(cards, now, none)).toHaveLength(REVIEWS_PER_DAY);
  expect(buildQueue(cards, now, { newToday: 0, reviewsToday: 95 })).toHaveLength(5);
  expect(buildQueue([qc("late", State.Review, at(23, 30))], now, none)).toEqual(["late"]);
  expect(buildQueue([qc("tomorrow", State.Review, at(0, 30, 1))], now, none)).toEqual([]);
});

test("order: learning due now, reviews, new, then learning due within 20 min", () => {
  const q = buildQueue(
    [
      qc("new", State.New, now),
      qc("ahead", State.Learning, at(12, 10)),
      qc("far", State.Relearning, at(13)),
      qc("review", State.Review, at(9)),
      qc("learnNow", State.Relearning, at(11, 59)),
    ],
    now,
    none,
  );
  expect(q).toEqual(["learnNow", "review", "new", "ahead"]);
});

test("boldTerm finds the kept word case-insensitively", () => {
  expect(boldTerm("The Brand launched it.", "brand")).toEqual({ before: "The ", match: "Brand", after: " launched it." });
  expect(boldTerm("Nothing here.", "brand")).toEqual({ before: "Nothing here.", match: "", after: "" });
});

const ctx = { sentence: "The brand launched a bold campaign.", sourceType: "reading" as const, sourceId: "s1", sourceTitle: "Bold brands" };
const add = (term: string) => keepWord({ term, definition: "def", fr: "fr", context: ctx }).id;

beforeEach(() => resetDbForTests());

test("a kept word is due as a new card, with its sentence and the word in bold", () => {
  add("campaign");
  const [card] = dueCards(now);
  expect(card).toMatchObject({ term: "campaign", isNew: true, definition: "def", fr: "fr" });
  expect(card.context).toEqual({ before: "The brand launched a bold ", match: "campaign", after: ".", sourceTitle: "Bold brands" });
});

test("rating is stored and the daily new-card limit is enforced from the logs", () => {
  const ids = Array.from({ length: NEW_PER_DAY + 1 }, (_, i) => add(`word${i}`));
  for (const id of ids.slice(0, NEW_PER_DAY)) expect(rateCard(id, 4, now, 1500)).toBe(true);
  const logs = db().prepare(`SELECT COUNT(*) AS n FROM review_logs`).get() as { n: number };
  expect(logs.n).toBe(NEW_PER_DAY);
  expect(dueCards(now)).toEqual([]); // 15 new cards already started today
  expect(dueCards(at(12, 0, 1)).map((c) => c.id)).toEqual([ids[NEW_PER_DAY]]); // next day: the 16th
});

test("Again puts the card back in the session within minutes", () => {
  const id = add("pitch");
  rateCard(id, 1, now);
  expect(dueCards(now).map((c) => c.id)).toEqual([id]);
  expect(dueCards(now)[0].isNew).toBe(false);
});

test("suspended cards leave the queue and cannot be rated", () => {
  const id = add("brand");
  expect(suspendCard(id)).toBe(true);
  expect(dueCards(now)).toEqual([]);
  expect(rateCard(id, 3, now)).toBe(false);
  expect(rateCard("nope", 3, now)).toBe(false);
});

test("stats: acquired = stability > 21 days, 7-day success rate", () => {
  const a = add("alpha");
  const b = add("beta");
  expect(reviewStats(now)).toEqual({ acquired: 0, successRate7d: null, reviews7d: 0 });
  rateCard(a, 1, now);
  rateCard(b, 3, now);
  db().prepare(`UPDATE cards SET fsrs = json_set(fsrs, '$.stability', 30) WHERE id = ?`).run(b);
  expect(reviewStats(now)).toEqual({ acquired: 1, successRate7d: 0.5, reviews7d: 2 });
  expect(reviewStats(at(12, 0, 8)).reviews7d).toBe(0);
});

test("word cards get 4 choices; irregular-verb cards stay flip cards (their forms, not the translation)", () => {
  for (const w of ["campaign", "brand", "client", "launch"]) add(w);
  db().prepare(`UPDATE cards SET fr = term || '-fr'`).run();
  db().prepare(`UPDATE cards SET source_kind = 'irregular_verb' WHERE term = 'launch'`).run();
  const cards = dueCards(now);
  expect(cards.find((c) => c.term === "campaign")?.choices).toHaveLength(4);
  expect(cards.find((c) => c.term === "launch")?.choices).toBeUndefined();
});
