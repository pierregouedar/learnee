import { db } from "@/lib/db";
import { createSession, getActiveSession, getSession, type Session } from "@/lib/repo/sessions";
import { listReadySubjects } from "@/lib/repo/subjects";
import type { Progress } from "@/lib/generation-progress";
import { generateSubject } from "@/lib/services/generate-subject";

const DAY_MS = 86_400_000;

export const MOCK_TOPICS = [
  "la publicité créée par l’intelligence artificielle",
  "les voitures électriques en Europe",
  "le marketing d’influence",
  "la communication de crise d’une grande marque",
  "les réseaux sociaux et les jeunes consommateurs",
  "la voiture autonome et la confiance du public",
] as const;

export class MockExamRefused extends Error {
  readonly status = 409;
}

// §17.4 : aucun avant janvier ; janvier-mars un par mois ; avril-juin un toutes les deux semaines.
export function mockExamDue(now: Date, lastMockAt?: string): boolean {
  const month = now.getMonth() + 1;
  if (month >= 1 && month <= 3) {
    if (!lastMockAt) return true;
    const last = new Date(lastMockAt);
    return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
  }
  if (month >= 4 && month <= 6) {
    return !lastMockAt || Math.round((now.getTime() - Date.parse(lastMockAt)) / DAY_MS) >= 14;
  }
  return false;
}

export function lastMockAt(): string | undefined {
  const row = db()
    .prepare(`SELECT MAX(started_at) AS at FROM sessions WHERE is_mock = 1 AND status <> 'abandoned'`)
    .get() as { at: string | null };
  return row.at ?? undefined;
}

export async function startMockExam(now = new Date(), onProgress?: (p: Progress) => void): Promise<Session> {
  if (!mockExamDue(now, lastMockAt())) throw new MockExamRefused("Pas d’examen blanc prévu pour l’instant.");
  if (getActiveSession()) throw new MockExamRefused("Termine ou abandonne ta copie en cours avant l’examen blanc.");
  const subject =
    listReadySubjects().find((s) => s.tier === 3) ??
    (await generateSubject({ mode: "topic", topic: MOCK_TOPICS[Math.floor(Math.random() * MOCK_TOPICS.length)] }, 3, onProgress));
  // Mode examen (plan 2) : chrono 2 h, sans définitions ; is_mock : point distinct dans l'historique.
  const session = createSession(subject.id, 3, true);
  db().prepare(`UPDATE sessions SET is_mock = 1 WHERE id = ?`).run(session.id);
  return getSession(session.id)!;
}
