import { callJson } from "@/lib/llm/client";
import { buildRewritePrompt, RewriteCheckSchema } from "@/lib/prompts/rewrite";
import { insertRewrite, type Rewrite } from "@/lib/repo/rewrites";
import { getSession } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";
import { countWords } from "@/lib/text";

const MIN_WORDS = 10;

export class RewriteRefused extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export function rewriteRate(total: number, erreurs: { index: number; statut: string }[]) {
  const fixed = new Set(erreurs.filter((e) => e.statut === "corrigee" && e.index >= 0 && e.index < total).map((e) => e.index));
  return { corrected: fixed.size, total, rate: total ? Math.round((100 * fixed.size) / total) : 0 };
}

export async function submitRewrite(sessionId: string, pe: string, now = new Date()): Promise<Rewrite> {
  const session = getSession(sessionId);
  if (!session) throw new RewriteRefused("Copie introuvable.", 404);
  if (session.status !== "corrected" || !session.result) throw new RewriteRefused("Cette copie n’est pas encore corrigée.", 409);
  const errors = session.result.expression.erreurs;
  if (errors.length === 0) throw new RewriteRefused("Aucune erreur à corriger sur cette copie.", 400);
  if (countWords(pe) < MIN_WORDS) throw new RewriteRefused("Écris ta nouvelle version avant de l’envoyer.", 400);

  const subject = getSubject(session.subjectId)!;
  const raw = await callJson(
    "rewrite_check",
    buildRewritePrompt({ task: subject.task, first: session.pe, errors, rewrite: pe }),
    RewriteCheckSchema,
    sessionId,
  );
  const seen = new Set<number>();
  const erreurs = raw.erreurs.filter((e) => e.index >= 0 && e.index < errors.length && !seen.has(e.index) && seen.add(e.index));
  return insertRewrite(sessionId, pe, { ...raw, erreurs, ...rewriteRate(errors.length, erreurs) }, now);
}
