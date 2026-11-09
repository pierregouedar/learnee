import { describe, expect, test } from "vitest";
import { ENGLISH_PROGRAMME, type GrammarPoint } from "@/lib/grammar-programme";
import type { MasteryState } from "./schema";
import { applyScore, DAY_MS, emptyMastery, selectPoint, type SelectionInput } from "./selection";

const now = new Date(2026, 9, 1, 12); // 1er octobre 2026
const daysAgo = (n: number, from = now) => new Date(from.getTime() - n * DAY_MS).toISOString();
const input = (over: Partial<SelectionInput> = {}): SelectionInput => ({
  now, corrections: [], mastery: [], lastPracticed: {}, priorities: [], ...over,
});
const mastered = (point: GrammarPoint, nextReviewInDays = 10): MasteryState => ({
  point, scores: [], masteredAt: daysAgo(5), nextReviewAt: new Date(now.getTime() + nextReviewInDays * DAY_MS).toISOString(),
});

describe("selectPoint", () => {
  test("a category seen 4 times in the last corrections triggers a dedicated session (§18.8)", () => {
    const s = selectPoint(input({
      corrections: [
        { correctedAt: daysAgo(5), categories: ["articles", "articles"] },
        { correctedAt: daysAgo(3), categories: ["articles", "past_simple"] },
        { correctedAt: daysAgo(1), categories: ["articles"] },
      ],
    }));
    expect(s).toEqual({ point: "articles", reason: "errors", count: 4 });
  });

  test("3 occurrences are not enough", () => {
    const s = selectPoint(input({
      corrections: [{ correctedAt: daysAgo(2), categories: ["articles", "articles", "articles"] }],
    }));
    expect(s?.reason).toBe("programme");
  });

  test("the most frequent category wins", () => {
    const s = selectPoint(input({
      corrections: [{ correctedAt: daysAgo(2), categories: ["passive", "passive", "passive", "passive", "modals", "modals", "modals", "modals", "modals"] }],
    }));
    expect(s).toEqual({ point: "modals", reason: "errors", count: 5 });
  });

  test("errors from copies older than the last session on that point are not counted again", () => {
    const s = selectPoint(input({
      corrections: [
        { correctedAt: daysAgo(4), categories: ["articles", "articles", "articles"] },
        { correctedAt: daysAgo(1), categories: ["articles"] },
      ],
      lastPracticed: { articles: daysAgo(2) },
    }));
    expect(s?.reason).toBe("programme");
  });

  test("a mastered point due for review comes before the programme", () => {
    const s = selectPoint(input({ mastery: [{ point: "questions", scores: [], masteredAt: daysAgo(22), nextReviewAt: daysAgo(1) }] }));
    expect(s).toEqual({ point: "questions", reason: "review" });
  });

  test("errors still come before reviews", () => {
    const s = selectPoint(input({
      corrections: [{ correctedAt: daysAgo(1), categories: ["modals", "modals", "modals", "modals"] }],
      mastery: [{ point: "questions", scores: [], masteredAt: daysAgo(22), nextReviewAt: daysAgo(1) }],
    }));
    expect(s?.point).toBe("modals");
  });

  test("in September the first never-practised point of the programme comes first", () => {
    expect(selectPoint(input({ now: new Date(2026, 8, 15) }))).toEqual({ point: "present_simple_continuous", reason: "programme" });
  });

  test("rotates to the least recently practised point", () => {
    const s = selectPoint(input({
      lastPracticed: {
        present_simple_continuous: daysAgo(1), past_simple: daysAgo(2), present_perfect: daysAgo(6),
        irregular_verbs: daysAgo(3), questions: daysAgo(4), articles: daysAgo(5),
      },
    }));
    expect(s?.point).toBe("present_perfect");
  });

  test("mastered points are skipped", () => {
    const s = selectPoint(input({
      mastery: (["present_simple_continuous", "past_simple", "present_perfect", "irregular_verbs", "questions"] as const).map((p) => mastered(p)),
    }));
    expect(s?.point).toBe("articles");
  });

  test("placement priorities come first within the programme", () => {
    const s = selectPoint(input({ priorities: ["articles"], lastPracticed: { articles: daysAgo(1) } }));
    expect(s?.point).toBe("articles");
  });

  test("priorities from later periods wait for their period", () => {
    const s = selectPoint(input({ priorities: ["passive"] }));
    expect(s?.point).toBe("present_simple_continuous");
  });

  test("in November, earlier periods stay in play and new points appear", () => {
    const nov = new Date(2026, 10, 10);
    const s = selectPoint(input({
      now: nov,
      mastery: (["present_simple_continuous", "past_simple", "present_perfect", "irregular_verbs", "questions", "articles"] as const).map((p) => mastered(p, 60)),
    }));
    expect(s?.point).toBe("futures");
  });

  test("in May the whole programme is in play", () => {
    const may = new Date(2027, 4, 10);
    const s = selectPoint(input({
      now: may,
      mastery: ENGLISH_PROGRAMME.points.map((p) => p.key).filter((p) => p !== "opinion_nuance").map((p) => ({ ...mastered(p), nextReviewAt: new Date(2027, 5, 30).toISOString() })),
    }));
    expect(s?.point).toBe("opinion_nuance");
  });

  test("when everything is mastered and nothing is due, keep practising the least recent point", () => {
    const s = selectPoint(input({
      mastery: (["present_simple_continuous", "past_simple", "present_perfect", "irregular_verbs", "questions", "articles"] as const).map((p) => mastered(p)),
      lastPracticed: {
        present_simple_continuous: daysAgo(1), past_simple: daysAgo(9), present_perfect: daysAgo(2),
        irregular_verbs: daysAgo(3), questions: daysAgo(4), articles: daysAgo(5),
      },
    }));
    expect(s).toEqual({ point: "past_simple", reason: "programme" });
  });
});

describe("applyScore", () => {
  const t0 = new Date(2026, 9, 1, 12);
  const later = (days: number) => new Date(t0.getTime() + days * DAY_MS);

  test("one good session is not mastery", () => {
    const m = applyScore(emptyMastery("passive"), 90, t0);
    expect(m.masteredAt).toBeUndefined();
    expect(m.scores).toEqual([{ score: 90, at: t0.toISOString() }]);
  });

  test("two good sessions less than 3 days apart are not mastery", () => {
    const m = applyScore(applyScore(emptyMastery("passive"), 90, t0), 95, later(2));
    expect(m.masteredAt).toBeUndefined();
  });

  test("two sessions ≥ 85 % at least 3 days apart: mastered, review in 3 weeks", () => {
    const m = applyScore(applyScore(emptyMastery("passive"), 85, t0), 88, later(3));
    expect(m.masteredAt).toBe(later(3).toISOString());
    expect(m.nextReviewAt).toBe(later(24).toISOString());
  });

  test("a failed session in between does not erase the earlier success", () => {
    let m = applyScore(emptyMastery("passive"), 90, t0);
    m = applyScore(m, 60, later(1));
    m = applyScore(m, 90, later(4));
    expect(m.masteredAt).toBeDefined();
  });

  test("a score below 85 % never masters", () => {
    const m = applyScore(applyScore(emptyMastery("passive"), 90, t0), 84, later(5));
    expect(m.masteredAt).toBeUndefined();
  });

  test("a passed review pushes the next review 3 weeks later", () => {
    const m = applyScore({ point: "passive", scores: [], masteredAt: t0.toISOString(), nextReviewAt: later(21).toISOString() }, 90, later(22));
    expect(m.masteredAt).toBe(t0.toISOString());
    expect(m.nextReviewAt).toBe(later(43).toISOString());
  });

  test("a failed review sends the point back to learning", () => {
    const m = applyScore({ point: "passive", scores: [], masteredAt: t0.toISOString(), nextReviewAt: later(21).toISOString() }, 70, later(22));
    expect(m.masteredAt).toBeUndefined();
    expect(m.nextReviewAt).toBeUndefined();
  });

  test("keeps the last 10 scores only", () => {
    let m = emptyMastery("passive");
    for (let i = 0; i < 12; i++) m = applyScore(m, 50 + i, later(i));
    expect(m.scores).toHaveLength(10);
    expect(m.scores[0].score).toBe(52);
  });
});
