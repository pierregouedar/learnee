import { db } from "@/lib/db";
import type { Correction, VocabItem } from "@/lib/schemas";
import { normalizeKey } from "@/lib/text";
import type { Tier } from "@/lib/tiers";

export type SessionStatus = "draft" | "correcting" | "corrected" | "abandoned";

export type Session = {
  id: string;
  subjectId: string;
  tier: Tier;
  isMock: boolean;
  examMode: boolean; // F11 : chrono 2 h + dictionnaire et mots clés masqués
  lookups: VocabItem[]; // mots gardés via le dictionnaire (spec §9)
  cr: string; // compte rendu FR
  pe: string; // écrit EN
  status: SessionStatus;
  result?: Correction;
  error?: string;
  startedAt: string;
  updatedAt: string;
  correctedAt?: string;
};

export type HistoryEntry = Session & { subjectTitle: string };

type Row = {
  id: string;
  subject_id: string;
  tier: number;
  is_mock: number;
  exam_mode: number;
  lookups: string;
  cr: string;
  pe: string;
  status: SessionStatus;
  result: string | null;
  error: string | null;
  started_at: string;
  updated_at: string;
  corrected_at: string | null;
};

const toSession = (r: Row): Session => ({
  id: r.id,
  subjectId: r.subject_id,
  tier: r.tier as Tier,
  isMock: r.is_mock === 1,
  examMode: r.exam_mode === 1,
  lookups: JSON.parse(r.lookups),
  cr: r.cr,
  pe: r.pe,
  status: r.status,
  result: r.result ? JSON.parse(r.result) : undefined,
  error: r.error ?? undefined,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  correctedAt: r.corrected_at ?? undefined,
});

const now = () => new Date().toISOString();

export class ActiveSessionExistsError extends Error {
  constructor() {
    super("Tu as déjà un sujet en cours.");
  }
}

export function createSession(subjectId: string, tier: Tier, examMode = false): Session {
  const id = crypto.randomUUID();
  const t = now();
  try {
    db()
      .prepare(`INSERT INTO sessions (id, subject_id, tier, exam_mode, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, subjectId, tier, examMode ? 1 : 0, t, t);
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") throw new ActiveSessionExistsError();
    throw e;
  }
  return getSession(id)!;
}

export function getSession(id: string): Session | undefined {
  const row = db().prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Row | undefined;
  return row && toSession(row);
}

export function getActiveSession(): Session | undefined {
  const row = db().prepare(`SELECT * FROM sessions WHERE status IN ('draft', 'correcting') LIMIT 1`).get() as
    | Row
    | undefined;
  return row && toSession(row);
}

export function saveDraft(id: string, draft: { cr: string; pe: string }): boolean {
  return (
    db()
      .prepare(`UPDATE sessions SET cr = ?, pe = ?, updated_at = ? WHERE id = ? AND status = 'draft'`)
      .run(draft.cr, draft.pe, now(), id).changes === 1
  );
}

export function abandonSession(id: string): boolean {
  return (
    db().prepare(`UPDATE sessions SET status = 'abandoned', updated_at = ? WHERE id = ? AND status = 'draft'`).run(now(), id)
      .changes === 1
  );
}

export function setCorrecting(id: string): boolean {
  return (
    db()
      .prepare(`UPDATE sessions SET status = 'correcting', error = NULL, updated_at = ? WHERE id = ? AND status = 'draft'`)
      .run(now(), id).changes === 1
  );
}

export function saveCorrection(id: string, result: Correction) {
  const t = now();
  db()
    .prepare(
      `UPDATE sessions SET status = 'corrected', result = ?, error = NULL, corrected_at = ?, updated_at = ?
       WHERE id = ? AND status = 'correcting'`,
    )
    .run(JSON.stringify(result), t, t, id);
}

export function failCorrection(id: string, message: string) {
  db()
    .prepare(`UPDATE sessions SET status = 'draft', error = ?, updated_at = ? WHERE id = ? AND status = 'correcting'`)
    .run(message, now(), id);
}

export function recoverInterruptedCorrections(): number {
  return db()
    .prepare(
      `UPDATE sessions SET status = 'draft', error = 'La correction a été interrompue. Tu peux la relancer.'
       WHERE status = 'correcting'`,
    )
    .run().changes;
}

export function listCorrected(): HistoryEntry[] {
  const rows = db()
    .prepare(
      `SELECT s.*, j.title AS subject_title FROM sessions s JOIN subjects j ON j.id = s.subject_id
       WHERE s.status = 'corrected' ORDER BY s.corrected_at`,
    )
    .all() as (Row & { subject_title: string })[];
  return rows.map((r) => ({ ...toSession(r), subjectTitle: r.subject_title }));
}

export function addLookup(id: string, item: VocabItem): boolean {
  const session = getSession(id);
  if (!session) return false;
  const key = normalizeKey(item.en);
  if (session.lookups.some((l) => normalizeKey(l.en) === key)) return true;
  db().prepare(`UPDATE sessions SET lookups = ? WHERE id = ?`).run(JSON.stringify([...session.lookups, item]), id);
  return true;
}
