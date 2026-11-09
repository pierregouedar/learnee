import { db } from "@/lib/db";
import { getProgramme, isProgrammePoint, type GrammarPoint } from "@/lib/grammar-programme";
import { LessonSchema, MIN_ITEMS, type GeneratedItem, type GrammarFormat, type GrammarLevel, type Lesson, type MasteryState } from "@/lib/grammar/schema";
import type { Correction } from "@/lib/schemas";

export type GrammarItem = {
  id: string;
  setId: string;
  position: number;
  format: GrammarFormat;
  prompt: string;
  options: string[];
  accepted: string[]; // jamais envoyé au navigateur
  explanation: string; // FR
  flaggedAt?: string;
};
export type PublicItem = Pick<GrammarItem, "id" | "format" | "prompt" | "options">;
export type GrammarAnswer = { itemId: string; answer: string; correct: boolean; expected: string; feedback?: string };
export type GrammarAttempt = {
  id: string;
  setId: string;
  point: GrammarPoint;
  answers: GrammarAnswer[];
  score?: number; // % de réussite
  startedAt: string;
  finishedAt?: string;
};

type ItemRow = {
  id: string; set_id: string; position: number; format: GrammarFormat; prompt: string;
  options: string; accepted: string; explanation: string; flagged_at: string | null;
};
type AttemptRow = {
  id: string; set_id: string; point: GrammarPoint; answers: string; score: number | null;
  started_at: string; finished_at: string | null;
};
type MasteryRow = { point: GrammarPoint; scores: string; mastered_at: string | null; next_review_at: string | null };

const toItem = (r: ItemRow): GrammarItem => ({
  id: r.id,
  setId: r.set_id,
  position: r.position,
  format: r.format,
  prompt: r.prompt,
  options: JSON.parse(r.options),
  accepted: JSON.parse(r.accepted),
  explanation: r.explanation,
  flaggedAt: r.flagged_at ?? undefined,
});

const toAttempt = (r: AttemptRow): GrammarAttempt => ({
  id: r.id,
  setId: r.set_id,
  point: r.point,
  answers: JSON.parse(r.answers),
  score: r.score ?? undefined,
  startedAt: r.started_at,
  finishedAt: r.finished_at ?? undefined,
});

export const toPublicItem = ({ id, format, prompt, options }: GrammarItem): PublicItem => ({ id, format, prompt, options });

export function insertSet(point: GrammarPoint, level: GrammarLevel, items: GeneratedItem[], now = new Date(), lesson?: Lesson): string {
  const id = crypto.randomUUID();
  const conn = db();
  conn.transaction(() => {
    conn
      .prepare(`INSERT INTO grammar_sets (id, point, level, lesson, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, point, level, lesson ? JSON.stringify(lesson) : null, now.toISOString());
    const insert = conn.prepare(
      `INSERT INTO grammar_items (id, set_id, position, format, prompt, options, accepted, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    items.forEach((item, i) =>
      insert.run(crypto.randomUUID(), id, i, item.format, item.prompt, JSON.stringify(item.options ?? []), JSON.stringify(item.accepted), item.explanation),
    );
  })();
  return id;
}

export function getLesson(setId: string): Lesson | undefined {
  const row = db().prepare(`SELECT lesson FROM grammar_sets WHERE id = ?`).get(setId) as { lesson: string | null } | undefined;
  // safeParse : une leçon d'un ancien format n'est simplement pas affichée.
  return row?.lesson ? LessonSchema.safeParse(JSON.parse(row.lesson)).data : undefined;
}

export function listItems(setId: string): GrammarItem[] {
  const rows = db()
    .prepare(`SELECT * FROM grammar_items WHERE set_id = ? AND flagged_at IS NULL ORDER BY position`)
    .all(setId) as ItemRow[];
  return rows.map(toItem);
}

export function getItem(id: string): GrammarItem | undefined {
  const row = db().prepare(`SELECT * FROM grammar_items WHERE id = ?`).get(id) as ItemRow | undefined;
  return row && toItem(row);
}

// « Cette correction me semble fausse » : l'item est retiré pour toujours, la date sert de journal.
export function flagItem(id: string, now = new Date()): boolean {
  return (
    db().prepare(`UPDATE grammar_items SET flagged_at = COALESCE(flagged_at, ?) WHERE id = ?`).run(now.toISOString(), id).changes === 1
  );
}

const UNUSED_SETS = `
  SELECT s.id FROM grammar_sets s
  WHERE s.point = ? AND s.level = ?
    AND NOT EXISTS (SELECT 1 FROM grammar_attempts a WHERE a.set_id = s.id)
    AND (SELECT COUNT(*) FROM grammar_items i WHERE i.set_id = s.id AND i.flagged_at IS NULL) >= ${MIN_ITEMS}
  ORDER BY s.created_at`;

// Le niveau compte : après un changement de palier, les séries d'avance de l'ancien niveau ne sont plus servies.
export function findUnusedSet(point: GrammarPoint, level: GrammarLevel): string | undefined {
  const row = db().prepare(`${UNUSED_SETS} LIMIT 1`).get(point, level) as { id: string } | undefined;
  return row?.id;
}

export function countUnusedSets(point: GrammarPoint, level: GrammarLevel): number {
  return (db().prepare(UNUSED_SETS).all(point, level) as unknown[]).length;
}

export function createAttempt(setId: string, point: GrammarPoint, now = new Date()): GrammarAttempt {
  const id = crypto.randomUUID();
  db()
    .prepare(`INSERT INTO grammar_attempts (id, set_id, point, started_at) VALUES (?, ?, ?, ?)`)
    .run(id, setId, point, now.toISOString());
  return getAttempt(id)!;
}

export function getAttempt(id: string): GrammarAttempt | undefined {
  const row = db().prepare(`SELECT * FROM grammar_attempts WHERE id = ?`).get(id) as AttemptRow | undefined;
  return row && toAttempt(row);
}

// Série commencée depuis moins de 24 h et non terminée ; au-delà, on la considère abandonnée.
export function getOpenAttempt(now = new Date()): GrammarAttempt | undefined {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const row = db()
    .prepare(`SELECT * FROM grammar_attempts WHERE finished_at IS NULL AND started_at > ? ORDER BY started_at DESC LIMIT 1`)
    .get(since) as AttemptRow | undefined;
  return row && toAttempt(row);
}

export function saveAnswers(id: string, answers: GrammarAnswer[]) {
  db().prepare(`UPDATE grammar_attempts SET answers = ? WHERE id = ?`).run(JSON.stringify(answers), id);
}

/** Recalcul après un signalement sur une série déjà terminée. */
export function rescoreAttempt(id: string, score: number | null) {
  db().prepare(`UPDATE grammar_attempts SET score = ? WHERE id = ?`).run(score, id);
}

export function finishAttempt(id: string, score: number | null, now = new Date()) {
  db()
    .prepare(`UPDATE grammar_attempts SET score = ?, finished_at = ? WHERE id = ? AND finished_at IS NULL`)
    .run(score, now.toISOString(), id);
}

export function lastPracticed(): Partial<Record<GrammarPoint, string>> {
  const rows = db()
    .prepare(`SELECT point, MAX(finished_at) AS at FROM grammar_attempts WHERE finished_at IS NOT NULL GROUP BY point`)
    .all() as { point: string; at: string }[];
  const programme = getProgramme();
  return Object.fromEntries(rows.filter((r) => isProgrammePoint(r.point, programme)).map((r) => [r.point, r.at]));
}

const toMastery = (r: MasteryRow): MasteryState => ({
  point: r.point,
  scores: JSON.parse(r.scores),
  ...(r.mastered_at ? { masteredAt: r.mastered_at } : {}),
  ...(r.next_review_at ? { nextReviewAt: r.next_review_at } : {}),
});

export function getMastery(point: GrammarPoint): MasteryState {
  const row = db().prepare(`SELECT * FROM grammar_mastery WHERE point = ?`).get(point) as MasteryRow | undefined;
  return row ? toMastery(row) : { point, scores: [] };
}

export function listMastery(): MasteryState[] {
  const programme = getProgramme();
  return (db().prepare(`SELECT * FROM grammar_mastery`).all() as MasteryRow[]).filter((r) => isProgrammePoint(r.point, programme)).map(toMastery);
}

export function saveMastery(m: MasteryState) {
  db()
    .prepare(
      `INSERT INTO grammar_mastery (point, scores, mastered_at, next_review_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(point) DO UPDATE SET scores = excluded.scores, mastered_at = excluded.mastered_at,
         next_review_at = excluded.next_review_at`,
    )
    .run(m.point, JSON.stringify(m.scores), m.masteredAt ?? null, m.nextReviewAt ?? null);
}

// Catégories grammaticales (champ `categorie` des erreurs de type grammaire) des dernières copies corrigées.
export function recentCorrections(limit = 5): { correctedAt: string; categories: GrammarPoint[] }[] {
  const rows = db()
    .prepare(`SELECT corrected_at, result FROM sessions WHERE status = 'corrected' AND result IS NOT NULL ORDER BY corrected_at DESC, rowid DESC LIMIT ?`)
    .all(limit) as { corrected_at: string; result: string }[];
  const programme = getProgramme();
  return rows.map((r) => ({
    correctedAt: r.corrected_at,
    categories: (JSON.parse(r.result) as Correction).expression.erreurs
      .filter((e) => e.type === "grammaire" && isProgrammePoint(e.categorie, programme))
      .map((e) => e.categorie as GrammarPoint),
  }));
}

export function placementPriorities(): GrammarPoint[] {
  const row = db()
    .prepare(`SELECT result FROM placements WHERE status = 'done' AND result IS NOT NULL ORDER BY finished_at DESC LIMIT 1`)
    .get() as { result: string } | undefined;
  if (!row) return [];
  const priorities = (JSON.parse(row.result) as { priorities?: unknown[] }).priorities ?? [];
  const programme = getProgramme();
  return priorities.filter((p) => isProgrammePoint(p, programme));
}
