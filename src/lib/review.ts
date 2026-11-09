import { fsrs, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import { setSuspended } from "@/lib/cards";
import { db } from "@/lib/db";
import { buildChoices } from "@/lib/review-choices";

// Spec §16.3 : pas d'avalanche après une semaine chargée.
export const NEW_PER_DAY = 15;
export const REVIEWS_PER_DAY = 100;
const LEARN_AHEAD_MS = 20 * 60_000;
const DAY_MS = 86_400_000;

export type ReviewRating = 1 | 2 | 3 | 4; // À revoir, Difficile, Correct, Facile
export type QueueCard = { id: string; fsrs: FsrsCard; createdAt: string };
export type ReviewCard = {
  id: string;
  term: string;
  definition: string;
  example?: string;
  fr: string;
  isNew: boolean;
  /** QCM : 4 traductions dont `fr` ; absent s'il n'y a pas assez de cartes. */
  choices?: string[];
  context?: { before: string; match: string; after: string; sourceTitle: string };
};
export type ReviewStats = { acquired: number; successRate7d: number | null; reviews7d: number };

/** L'état ts-fsrs est stocké en JSON (plan 2) : les dates redeviennent des Date. */
export function parseFsrs(json: string): FsrsCard {
  const o = JSON.parse(json);
  return { ...o, due: new Date(o.due), last_review: o.last_review ? new Date(o.last_review) : undefined };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function buildQueue(cards: QueueCard[], now: Date, done: { newToday: number; reviewsToday: number }): string[] {
  const t = now.getTime();
  const endOfDay = startOfDay(now).getTime() + DAY_MS;
  const due = (c: QueueCard) => c.fsrs.due.getTime();
  const byDue = (a: QueueCard, b: QueueCard) => due(a) - due(b);
  const learning = cards.filter((c) => c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning).sort(byDue);
  const learnNow = learning.filter((c) => due(c) <= t);
  const learnAhead = learning.filter((c) => due(c) > t && due(c) <= t + LEARN_AHEAD_MS);
  const reviews = cards
    .filter((c) => c.fsrs.state === State.Review && due(c) < endOfDay)
    .sort(byDue)
    .slice(0, Math.max(0, REVIEWS_PER_DAY - done.reviewsToday));
  const fresh = cards
    .filter((c) => c.fsrs.state === State.New)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, NEW_PER_DAY - done.newToday));
  return [...learnNow, ...reviews, ...fresh, ...learnAhead].map((c) => c.id);
}

/** Recto : la phrase d'origine avec le mot en gras (spec §16.2). */
export function boldTerm(sentence: string, term: string) {
  const i = sentence.toLowerCase().indexOf(term.toLowerCase());
  return i < 0
    ? { before: sentence, match: "", after: "" }
    : { before: sentence.slice(0, i), match: sentence.slice(i, i + term.length), after: sentence.slice(i + term.length) };
}

function doneToday(now: Date) {
  const since = startOfDay(now).toISOString();
  const { n: newToday } = db()
    .prepare(`SELECT COUNT(*) AS n FROM (SELECT MIN(reviewed_at) AS first FROM review_logs GROUP BY card_id) WHERE first >= ?`)
    .get(since) as { n: number };
  const { n: reviewsToday } = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM review_logs l WHERE l.reviewed_at >= ?
         AND EXISTS (SELECT 1 FROM review_logs p WHERE p.card_id = l.card_id AND p.reviewed_at < ?)`,
    )
    .get(since, since) as { n: number };
  return { newToday, reviewsToday };
}

type CardRow = {
  id: string;
  term: string;
  definition: string;
  example: string | null;
  fr: string;
  fsrs: string;
  created_at: string;
  source_kind: "word" | "irregular_verb";
  sentence: string | null;
  source_title: string | null;
};

// charge toutes les cartes actives à chaque appel ; quelques centaines de lignes, index sur fsrs.due si ça grossit.
export function dueCards(now: Date = new Date()): ReviewCard[] {
  const rows = db()
    .prepare(
      `SELECT c.id, c.term, c.definition, c.example, c.fr, c.fsrs, c.created_at, c.source_kind, x.sentence, x.source_title
       FROM cards c
       LEFT JOIN card_contexts x ON x.id = (SELECT MAX(id) FROM card_contexts WHERE card_id = c.id)
       WHERE c.suspended = 0`,
    )
    .all() as CardRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const queueCards = rows.map((r) => ({ id: r.id, createdAt: r.created_at, fsrs: parseFsrs(r.fsrs) }));
  const states = new Map(queueCards.map((c) => [c.id, c.fsrs.state]));
  const pool = rows.map((r) => r.fr);
  return buildQueue(queueCards, now, doneToday(now)).map((id) => {
    const r = byId.get(id)!;
    return {
      id,
      term: r.term,
      definition: r.definition,
      example: r.example ?? undefined,
      fr: r.fr,
      isNew: states.get(id) === State.New,
      // Verbes irréguliers : on veut les formes (went / gone), pas la traduction ; carte à retourner.
      choices: r.source_kind === "irregular_verb" ? undefined : (buildChoices(id, r.fr, pool) ?? undefined),
      context: r.sentence ? { ...boldTerm(r.sentence, r.term), sourceTitle: r.source_title ?? "" } : undefined,
    };
  });
}

export const countDue = (now: Date = new Date()) => dueCards(now).length;

const scheduler = fsrs();

export function rateCard(cardId: string, rating: ReviewRating, now: Date = new Date(), elapsedMs = 0): boolean {
  const row = db().prepare(`SELECT fsrs FROM cards WHERE id = ? AND suspended = 0`).get(cardId) as { fsrs: string } | undefined;
  if (!row) return false;
  const { card } = scheduler.next(parseFsrs(row.fsrs), now, rating as Grade);
  db().transaction(() => {
    db().prepare(`UPDATE cards SET fsrs = ? WHERE id = ?`).run(JSON.stringify(card), cardId);
    db()
      .prepare(`INSERT INTO review_logs (id, card_id, rating, reviewed_at, elapsed_ms) VALUES (?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), cardId, rating, now.toISOString(), Math.max(0, Math.round(elapsedMs)));
  })();
  return true;
}

/** « Je connais déjà » (spec §16.3). */
export const suspendCard = (cardId: string): boolean => setSuspended(cardId, true);

/** Spec §16.5 sans la série de jours (pas de gamification, §2). */
export function reviewStats(now: Date = new Date()): ReviewStats {
  const { n: acquired } = db()
    .prepare(`SELECT COUNT(*) AS n FROM cards WHERE suspended = 0 AND json_extract(fsrs, '$.stability') > 21`)
    .get() as { n: number };
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const { total, ok } = db()
    .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(rating > 1), 0) AS ok FROM review_logs WHERE reviewed_at >= ? AND reviewed_at <= ?`)
    .get(since, now.toISOString()) as { total: number; ok: number };
  return { acquired, successRate7d: total ? ok / total : null, reviews7d: total };
}
