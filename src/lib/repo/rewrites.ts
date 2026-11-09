import { db } from "@/lib/db";
import type { Correction } from "@/lib/schemas";

export type RewriteResult = {
  erreurs: { index: number; statut: "corrigee" | "restante"; commentaire: string }[];
  nouvelles: { extrait: string; correction: string; explication: string }[];
  conseil: string;
  corrected: number;
  total: number;
  rate: number; // % d'erreurs corrigées, pas une note
};
export type Rewrite = { id: string; sessionId: string; pe: string; result: RewriteResult; createdAt: string };

type Row = { id: string; session_id: string; pe: string; result: string; created_at: string };
const toRewrite = (r: Row): Rewrite => ({ id: r.id, sessionId: r.session_id, pe: r.pe, result: JSON.parse(r.result), createdAt: r.created_at });

export function insertRewrite(sessionId: string, pe: string, result: RewriteResult, now = new Date()): Rewrite {
  const id = crypto.randomUUID();
  db()
    .prepare(`INSERT INTO rewrites (id, session_id, pe, result, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, sessionId, pe, JSON.stringify(result), now.toISOString());
  return toRewrite(db().prepare(`SELECT * FROM rewrites WHERE id = ?`).get(id) as Row);
}

export function latestRewrite(sessionId: string): Rewrite | undefined {
  const row = db()
    .prepare(`SELECT * FROM rewrites WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get(sessionId) as Row | undefined;
  return row && toRewrite(row);
}

// « Réécriture de la dernière copie » (semaine type) : la dernière copie corrigée, si elle a des erreurs et pas encore de second jet.
export function latestRewritableSession(): string | undefined {
  const row = db()
    .prepare(`SELECT id, result FROM sessions WHERE status = 'corrected' AND result IS NOT NULL ORDER BY corrected_at DESC, rowid DESC LIMIT 1`)
    .get() as { id: string; result: string } | undefined;
  if (!row || (JSON.parse(row.result) as Correction).expression.erreurs.length === 0) return undefined;
  return latestRewrite(row.id) ? undefined : row.id;
}
