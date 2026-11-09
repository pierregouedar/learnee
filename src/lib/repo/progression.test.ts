import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import type { Correction } from "@/lib/schemas";
import type { Tier } from "@/lib/tiers";
import { changeTier, currentTierProposal, declineTierProposal, getTierHistory } from "./progression";
import { createSession, saveCorrection, setCorrecting } from "./sessions";
import { getTier } from "./settings";
import { insertSubject } from "./subjects";

let clock = 0;
let subjectId = "";
const tick = () => {
  clock += 3_600_000;
  vi.setSystemTime(clock);
  return new Date(clock);
};
const correction = (total: number): Correction => ({
  compte_rendu: { note: total / 2, commentaire: "c", idees_manquantes: [] },
  expression: { note: total / 2, niveau: "B1", erreurs: [], points_forts: [], version_amelioree: "v" },
  vocabulaire: [],
  conseil: "k",
});
function copy(total: number, opts: { tier?: Tier; mock?: boolean } = {}) {
  tick();
  const s = createSession(subjectId, opts.tier ?? getTier());
  if (opts.mock) db().prepare(`UPDATE sessions SET is_mock = 1 WHERE id = ?`).run(s.id);
  setCorrecting(s.id);
  saveCorrection(s.id, correction(total));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock = new Date(2026, 9, 1, 8).getTime();
  vi.setSystemTime(clock);
  resetDbForTests();
  subjectId = insertSubject({ domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [] }).id;
});
afterEach(() => vi.useRealTimers());

test("proposal after three good copies of the current tier, mocks and other tiers ignored", () => {
  copy(12);
  copy(13);
  expect(currentTierProposal()).toBeNull();
  copy(5, { mock: true });
  copy(4, { tier: 2 });
  copy(14);
  expect(currentTierProposal()).toEqual({ direction: "up", to: 2 });
});

test("« Rester au palier » hides the proposal until three new good copies", () => {
  copy(12);
  copy(12);
  copy(12);
  declineTierProposal(tick());
  expect(currentTierProposal()).toBeNull();
  copy(15);
  copy(15);
  expect(currentTierProposal()).toBeNull();
  copy(15);
  expect(currentTierProposal()).toEqual({ direction: "up", to: 2 });
});

test("accepting changes the tier, records the history, and starts a new window", () => {
  copy(12);
  copy(12);
  copy(12);
  const at = tick();
  changeTier(2, at);
  expect(getTier()).toBe(2);
  expect(getTierHistory()).toEqual([{ tier: 2, from: at.toISOString() }]);
  expect(currentTierProposal()).toBeNull();
  copy(6);
  copy(7);
  copy(5);
  expect(currentTierProposal()).toEqual({ direction: "down", to: 1 });
});

test("changing to the same tier does not duplicate the history", () => {
  changeTier(1, tick());
  changeTier(1, tick());
  expect(getTierHistory()).toHaveLength(1);
});

test("changing tier retires ready news subjects prepared for another tier", () => {
  const news = (tier: Tier) =>
    insertSubject({ domain: "ia", source: "rss", sourceRef: `u${tier}`, tier, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [] });
  const old = news(1);
  const fresh = news(2);
  changeTier(2, tick());
  const status = (id: string) => (db().prepare(`SELECT status FROM subjects WHERE id = ?`).get(id) as { status: string }).status;
  expect(status(old.id)).toBe("expired");
  expect(status(fresh.id)).toBe("ready");
});
