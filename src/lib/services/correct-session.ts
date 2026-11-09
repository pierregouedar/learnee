import { importCorrectionVocab } from "@/lib/cards";
import { callJson, LlmError } from "@/lib/llm/client";
import { buildCorrectionPrompt } from "@/lib/prompts/correct";
import { failCorrection, getSession, saveCorrection, setCorrecting } from "@/lib/repo/sessions";
import { getSubject, markSubjectUsed } from "@/lib/repo/subjects";
import { CorrectionSchema, type Correction } from "@/lib/schemas";
import { countWords, roundNote } from "@/lib/text";

export const MIN_WORDS = 20;

export class CorrectionRefused extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export function normalizeCorrection(c: Correction, parts: { cr: string; pe: string }): Correction {
  return {
    ...c,
    compte_rendu: { ...c.compte_rendu, note: countWords(parts.cr) === 0 ? 0 : roundNote(c.compte_rendu.note) },
    expression: { ...c.expression, note: countWords(parts.pe) === 0 ? 0 : roundNote(c.expression.note) },
  };
}

export function startCorrection(id: string) {
  const session = getSession(id);
  if (!session) throw new CorrectionRefused("Copie introuvable.", 404);
  if (countWords(session.cr) + countWords(session.pe) < MIN_WORDS) {
    throw new CorrectionRefused(`Écris au moins ${MIN_WORDS} mots avant de demander une correction.`, 400);
  }
  if (!setCorrecting(id)) throw new CorrectionRefused("Cette copie est déjà en correction ou terminée.", 409);
}

export async function runCorrection(id: string): Promise<void> {
  try {
    const session = getSession(id)!;
    const subject = getSubject(session.subjectId)!;
    const raw = await callJson(
      "correct",
      buildCorrectionPrompt({
        tier: session.tier, article: subject.article, task: subject.task,
        cr: session.cr, pe: session.pe, guideQuestions: subject.guideQuestions,
      }),
      CorrectionSchema,
      id,
    );
    saveCorrection(id, normalizeCorrection(raw, session));
    markSubjectUsed(subject.id);
    importCorrectionVocab(id); // spec §16.1 : chaque item de vocabulaire devient une carte, sans manipulation
  } catch (e) {
    failCorrection(id, e instanceof LlmError ? e.message : "La correction a échoué. Ton brouillon est conservé, tu peux réessayer.");
  }
}
