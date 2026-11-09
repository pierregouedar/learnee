import { ListeningResultSchema } from "@/lib/listening/schemas";
import { transcriptText } from "@/lib/listening/segments";
import { callJson, LlmError } from "@/lib/llm/client";
import { buildListeningCorrectionPrompt } from "@/lib/prompts/listening";
import {
  failAttemptCorrection, getAttempt, getListening, markListeningUsed, saveAttemptResult, setAttemptCorrecting,
} from "@/lib/repo/listenings";
import { countWords, roundNote } from "@/lib/text";

export const MIN_SUMMARY_WORDS = 20;

export class ListeningCorrectionRefused extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export function startListeningCorrection(id: string) {
  const attempt = getAttempt(id);
  if (!attempt) throw new ListeningCorrectionRefused("Exercice introuvable.", 404);
  if (countWords(attempt.summary) < MIN_SUMMARY_WORDS) {
    throw new ListeningCorrectionRefused(`Écris au moins ${MIN_SUMMARY_WORDS} mots avant d'envoyer ton compte rendu.`, 400);
  }
  if (!setAttemptCorrecting(id)) throw new ListeningCorrectionRefused("Ce compte rendu est déjà en correction ou terminé.", 409);
}

export async function runListeningCorrection(id: string): Promise<void> {
  try {
    const attempt = getAttempt(id)!;
    const listening = getListening(attempt.listeningId)!;
    const raw = await callJson(
      "listening_correct",
      buildListeningCorrectionPrompt({ plays: attempt.plays, transcript: transcriptText(listening.script), summary: attempt.summary }),
      ListeningResultSchema,
      id,
    );
    saveAttemptResult(id, { ...raw, note: roundNote(raw.note) });
    markListeningUsed(listening.id);
  } catch (e) {
    if (!(e instanceof LlmError)) console.error("[listening_correct] échec inattendu", e);
    failAttemptCorrection(
      id,
      e instanceof LlmError ? e.message : "La correction a échoué. Ton compte rendu est conservé, tu peux réessayer.",
    );
  }
}
