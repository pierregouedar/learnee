import { db } from "@/lib/db";
import { MAX_PLAYS } from "@/lib/listening/player";
import type { ListeningFormat, ListeningLevel, ListeningResult, Segment } from "@/lib/listening/schemas";
import type { Domain } from "@/lib/repo/subjects";

export type TtsInfo = {
  provider: "elevenlabs" | "seed-audio";
  via?: string;
  model: string;
  characters?: number;
  seconds?: number;
  costUsd: number;
  wer?: number;
  attempts: number;
};

export type Listening = {
  id: string;
  domain: Domain;
  source: "generated" | "upload";
  sourceRef?: string;
  format: ListeningFormat;
  level: ListeningLevel;
  title: string;
  context: string;
  script: Segment[];
  audioPath: string;
  durationSec: number;
  voices: string[];
  tts?: TtsInfo;
  status: "ready" | "used" | "expired";
  createdAt: string;
};

export type ListeningSummary = Omit<Listening, "script">;
export type NewListening = Omit<Listening, "status" | "createdAt">;

type Row = {
  id: string;
  domain: Domain;
  source: Listening["source"];
  source_ref: string | null;
  format: ListeningFormat;
  level: ListeningLevel;
  title: string;
  context: string;
  script: string;
  audio_path: string;
  duration_sec: number;
  voices: string;
  tts: string | null;
  status: Listening["status"];
  created_at: string;
};

const toListening = (r: Row): Listening => ({
  id: r.id,
  domain: r.domain,
  source: r.source,
  sourceRef: r.source_ref ?? undefined,
  format: r.format,
  level: r.level,
  title: r.title,
  context: r.context,
  script: JSON.parse(r.script),
  audioPath: r.audio_path,
  durationSec: r.duration_sec,
  voices: JSON.parse(r.voices),
  tts: r.tts ? JSON.parse(r.tts) : undefined,
  status: r.status,
  createdAt: r.created_at,
});

/** Version sans script : la seule envoyée au navigateur avant la correction. */
export function toSummary(l: Listening): ListeningSummary {
  const { script, ...rest } = l;
  void script;
  return rest;
}

const now = () => new Date().toISOString();
const count = (sql: string, ...args: unknown[]) => (db().prepare(sql).get(...args) as { n: number }).n;

export function insertListening(l: NewListening): Listening {
  db()
    .prepare(
      `INSERT INTO listenings (id, domain, source, source_ref, format, level, title, context, script, audio_path,
         duration_sec, voices, tts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      l.id, l.domain, l.source, l.sourceRef ?? null, l.format, l.level, l.title, l.context, JSON.stringify(l.script),
      l.audioPath, l.durationSec, JSON.stringify(l.voices), l.tts ? JSON.stringify(l.tts) : null, now(),
    );
  return getListening(l.id)!;
}

export function getListening(id: string): Listening | undefined {
  const row = db().prepare(`SELECT * FROM listenings WHERE id = ?`).get(id) as Row | undefined;
  return row && toListening(row);
}

export function listReadyListenings(): ListeningSummary[] {
  const rows = db().prepare(`SELECT * FROM listenings WHERE status = 'ready' ORDER BY created_at DESC`).all() as Row[];
  return rows.map((r) => toSummary(toListening(r)));
}

export const countReadyListenings = () => count(`SELECT COUNT(*) AS n FROM listenings WHERE status = 'ready'`);

export const countGeneratedSince = (iso: string) =>
  count(`SELECT COUNT(*) AS n FROM listenings WHERE source = 'generated' AND created_at >= ?`, iso);

export const listeningSourceRefs = () =>
  (db().prepare(`SELECT source_ref FROM listenings WHERE source_ref IS NOT NULL`).all() as { source_ref: string }[]).map(
    (r) => r.source_ref,
  );

export function markListeningUsed(id: string) {
  db().prepare(`UPDATE listenings SET status = 'used' WHERE id = ? AND status = 'ready'`).run(id);
}

export function getSlowSpeedOverride(): string | undefined {
  const row = db().prepare(`SELECT value FROM settings WHERE key = 'listening_slow_speed'`).get() as { value: string } | undefined;
  return row?.value;
}

// --- Exercices (tentatives) ---

export type AttemptStatus = "draft" | "correcting" | "corrected";

export type ListeningAttempt = {
  id: string;
  listeningId: string;
  plays: number;
  notes: string;
  summary: string; // compte rendu FR
  status: AttemptStatus;
  result?: ListeningResult;
  error?: string;
  startedAt: string;
  updatedAt: string;
  correctedAt?: string;
};

export type AttemptHistoryEntry = ListeningAttempt & { title: string };

type AttemptRow = {
  id: string;
  listening_id: string;
  plays: number;
  notes: string;
  summary: string;
  status: AttemptStatus;
  result: string | null;
  error: string | null;
  started_at: string;
  updated_at: string;
  corrected_at: string | null;
};

const toAttempt = (r: AttemptRow): ListeningAttempt => ({
  id: r.id,
  listeningId: r.listening_id,
  plays: r.plays,
  notes: r.notes,
  summary: r.summary,
  status: r.status,
  result: r.result ? JSON.parse(r.result) : undefined,
  error: r.error ?? undefined,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  correctedAt: r.corrected_at ?? undefined,
});

export function getAttempt(id: string): ListeningAttempt | undefined {
  const row = db().prepare(`SELECT * FROM listening_attempts WHERE id = ?`).get(id) as AttemptRow | undefined;
  return row && toAttempt(row);
}

const activeAttemptFor = (listeningId: string) =>
  db()
    .prepare(`SELECT * FROM listening_attempts WHERE listening_id = ? AND status IN ('draft', 'correcting')`)
    .get(listeningId) as AttemptRow | undefined;

/** Protégé par l'index unique `listening_attempts_one_active` : deux requêtes concurrentes sur le même audio
 * peuvent toutes deux passer le SELECT avant que l'une des deux n'insère ; on récupère alors l'attempt gagnant
 * plutôt que de laisser remonter l'erreur SQLite. */
export function startAttempt(listeningId: string): ListeningAttempt {
  const active = activeAttemptFor(listeningId);
  if (active) return toAttempt(active);
  const id = crypto.randomUUID();
  const t = now();
  try {
    db()
      .prepare(`INSERT INTO listening_attempts (id, listening_id, started_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(id, listeningId, t, t);
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed/.test(e.message)) {
      const winner = activeAttemptFor(listeningId);
      if (winner) return toAttempt(winner);
    }
    throw e;
  }
  return getAttempt(id)!;
}

export function saveAttemptDraft(id: string, d: { notes: string; summary: string }): boolean {
  return (
    db()
      .prepare(`UPDATE listening_attempts SET notes = ?, summary = ?, updated_at = ? WHERE id = ? AND status = 'draft'`)
      .run(d.notes, d.summary, now(), id).changes === 1
  );
}

/** +1 écoute, refusé au-delà de MAX_PLAYS ou hors brouillon. Ne touche pas updated_at (pas une modif du brouillon). Renvoie le nouveau total. */
export function registerPlay(id: string): number | undefined {
  const ok =
    db()
      .prepare(`UPDATE listening_attempts SET plays = plays + 1 WHERE id = ? AND status = 'draft' AND plays < ?`)
      .run(id, MAX_PLAYS).changes === 1;
  return ok ? getAttempt(id)!.plays : undefined;
}

export function setAttemptCorrecting(id: string): boolean {
  return (
    db()
      .prepare(`UPDATE listening_attempts SET status = 'correcting', error = NULL, updated_at = ? WHERE id = ? AND status = 'draft'`)
      .run(now(), id).changes === 1
  );
}

export function saveAttemptResult(id: string, result: ListeningResult) {
  const t = now();
  db()
    .prepare(
      `UPDATE listening_attempts SET status = 'corrected', result = ?, error = NULL, corrected_at = ?, updated_at = ?
       WHERE id = ? AND status = 'correcting'`,
    )
    .run(JSON.stringify(result), t, t, id);
}

export function failAttemptCorrection(id: string, message: string) {
  db()
    .prepare(`UPDATE listening_attempts SET status = 'draft', error = ?, updated_at = ? WHERE id = ? AND status = 'correcting'`)
    .run(message, now(), id);
}

export function recoverInterruptedListeningCorrections(): number {
  return db()
    .prepare(
      `UPDATE listening_attempts SET status = 'draft', error = 'La correction a été interrompue. Tu peux la relancer.'
       WHERE status = 'correcting'`,
    )
    .run().changes;
}

export function listCorrectedAttempts(): AttemptHistoryEntry[] {
  const rows = db()
    .prepare(
      `SELECT a.*, l.title AS title FROM listening_attempts a JOIN listenings l ON l.id = a.listening_id
       WHERE a.status = 'corrected' ORDER BY a.corrected_at DESC`,
    )
    .all() as (AttemptRow & { title: string })[];
  return rows.map((r) => ({ ...toAttempt(r), title: r.title }));
}
