import { db } from "@/lib/db";
import type { PlacementAnswers, PlacementContent, PlacementResult } from "@/lib/placement/schema";
import { getListening, listReadyListenings } from "@/lib/repo/listenings";

export type Placement = {
  id: string;
  status: "in_progress" | "done";
  content: PlacementContent;
  answers?: PlacementAnswers;
  result?: PlacementResult;
  createdAt: string;
  finishedAt?: string;
};

type Row = {
  id: string; status: Placement["status"]; content: string; answers: string | null; result: string | null;
  created_at: string; finished_at: string | null;
};

const toPlacement = (r: Row): Placement => ({
  id: r.id,
  status: r.status,
  content: JSON.parse(r.content),
  answers: r.answers ? JSON.parse(r.answers) : undefined,
  result: r.result ? JSON.parse(r.result) : undefined,
  createdAt: r.created_at,
  finishedAt: r.finished_at ?? undefined,
});

export function insertPlacement(content: PlacementContent, now = new Date()): Placement {
  const id = crypto.randomUUID();
  db().prepare(`INSERT INTO placements (id, content, created_at) VALUES (?, ?, ?)`).run(id, JSON.stringify(content), now.toISOString());
  return getPlacement(id)!;
}

export function getPlacement(id: string): Placement | undefined {
  const row = db().prepare(`SELECT * FROM placements WHERE id = ?`).get(id) as Row | undefined;
  return row && toPlacement(row);
}

export function getInProgressPlacement(): Placement | undefined {
  const row = db().prepare(`SELECT * FROM placements WHERE status = 'in_progress' ORDER BY created_at DESC LIMIT 1`).get() as Row | undefined;
  return row && toPlacement(row);
}

export function listDonePlacements(): Placement[] {
  return (db().prepare(`SELECT * FROM placements WHERE status = 'done' ORDER BY finished_at`).all() as Row[]).map(toPlacement);
}

export function lastPlacementAt(): string | undefined {
  const row = db().prepare(`SELECT MAX(finished_at) AS at FROM placements WHERE status = 'done'`).get() as { at: string | null };
  return row.at ?? undefined;
}

export function savePlacementResult(id: string, answers: PlacementAnswers, result: PlacementResult, now = new Date()): boolean {
  return (
    db()
      .prepare(`UPDATE placements SET status = 'done', answers = ?, result = ?, finished_at = ? WHERE id = ? AND status = 'in_progress'`)
      .run(JSON.stringify(answers), JSON.stringify(result), now.toISOString(), id).changes === 1
  );
}

// Brouillon du test en cours (réponses partielles), tant qu'il n'est pas terminé.
export function savePlacementDraft(id: string, answers: PlacementAnswers): boolean {
  return (
    db().prepare(`UPDATE placements SET answers = ? WHERE id = ? AND status = 'in_progress'`).run(JSON.stringify(answers), id)
      .changes === 1
  );
}

export const listeningAudioUrl = (id: string) => `/api/listening/${id}/audio`;

// Audio de CO (plan 3) le plus court parmi ceux prêts ; aucun (pas de clé ElevenLabs) = partie écoute sautée.
export function findPlacementAudio(): { listeningId: string; transcript: string } | undefined {
  const shortest = [...listReadyListenings()].sort((a, b) => a.durationSec - b.durationSec)[0];
  const listening = shortest && getListening(shortest.id);
  if (!listening) return undefined;
  return { listeningId: listening.id, transcript: listening.script.map((s) => s.text).join(" ") };
}
