import type { GrammarPoint } from "@/lib/grammar-programme";
import { matchesAccepted } from "@/lib/grammar/answers";
import { generateSet } from "@/lib/grammar/generate";
import { LEVEL_BY_TIER, TranslateCheckSchema, type GrammarLevel } from "@/lib/grammar/schema";
import { applyScore, selectPoint, type Selection } from "@/lib/grammar/selection";
import { callJson } from "@/lib/llm/client";
import { buildTranslateCheckPrompt } from "@/lib/prompts/grammar";
import {
  createAttempt, findUnusedSet, finishAttempt, flagItem, getAttempt, getItem, getMastery,
  getOpenAttempt, insertSet, lastPracticed, listItems, listMastery, placementPriorities, recentCorrections, rescoreAttempt,
  saveAnswers, saveMastery, type GrammarAttempt,
} from "@/lib/repo/grammar";
import { getTier } from "@/lib/repo/settings";

export class GrammarError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409,
  ) {
    super(message);
  }
}

export type AnswerResult = {
  correct: boolean;
  expected: string;
  explanation: string;
  feedback?: string;
  done: boolean;
  score?: number;
};

export const currentLevel = (): GrammarLevel => LEVEL_BY_TIER[getTier()];

export function nextSelection(now = new Date()): Selection | null {
  return selectPoint({
    now,
    corrections: recentCorrections(5),
    mastery: listMastery(),
    lastPracticed: lastPracticed(),
    priorities: placementPriorities(),
  });
}

export async function startGrammarAttempt(point: GrammarPoint, now = new Date()): Promise<GrammarAttempt> {
  const open = getOpenAttempt(now);
  if (open) return open;
  const level = currentLevel();
  let setId = findUnusedSet(point, level);
  if (!setId) {
    const { items, lesson } = await generateSet(point, level);
    setId = insertSet(point, level, items, now, lesson);
  }
  return createAttempt(setId, point, now);
}

function finishIfComplete(attemptId: string, now: Date): { done: boolean; score?: number } {
  const attempt = getAttempt(attemptId)!;
  const live = listItems(attempt.setId);
  const liveIds = new Set(live.map((i) => i.id));
  const answered = attempt.answers.filter((a) => liveIds.has(a.itemId));
  if (answered.length < live.length) return { done: false };
  if (live.length === 0) {
    finishAttempt(attemptId, null, now); // tout a été signalé : pas de note, pas d'effet sur la maîtrise
    return { done: true };
  }
  const score = Math.round((100 * answered.filter((a) => a.correct).length) / live.length);
  finishAttempt(attemptId, score, now);
  saveMastery(applyScore(getMastery(attempt.point), score, now));
  return { done: true, score };
}

export async function answerItem(attemptId: string, itemId: string, answer: string, now = new Date()): Promise<AnswerResult> {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new GrammarError("Série introuvable.", 404);
  if (attempt.finishedAt) throw new GrammarError("Cette série est terminée.", 409);
  const item = getItem(itemId);
  if (!item || item.setId !== attempt.setId || item.flaggedAt) throw new GrammarError("Exercice introuvable.", 404);
  if (attempt.answers.some((a) => a.itemId === itemId)) throw new GrammarError("Tu as déjà répondu à cette question.", 409);

  let correct: boolean;
  let expected = item.accepted[0];
  let feedback: string | undefined;
  if (item.format === "translate") {
    const check = await callJson(
      "grammar_check",
      buildTranslateCheckPrompt({ point: attempt.point, french: item.prompt, references: item.accepted, answer }),
      TranslateCheckSchema,
      attemptId,
    );
    correct = check.correct;
    feedback = check.feedback;
    expected = check.correction.trim() || expected;
  } else {
    correct = matchesAccepted(answer, item.accepted);
  }

  // Relu après l'appel LLM : une autre réponse a pu être enregistrée pendant la vérification de la traduction.
  const fresh = getAttempt(attemptId)!;
  if (fresh.finishedAt) throw new GrammarError("Cette série est terminée.", 409);
  if (fresh.answers.some((a) => a.itemId === itemId)) throw new GrammarError("Tu as déjà répondu à cette question.", 409);
  saveAnswers(attemptId, [...fresh.answers, { itemId, answer, correct, expected, ...(feedback ? { feedback } : {}) }]);
  return { correct, expected, explanation: item.explanation, ...(feedback ? { feedback } : {}), ...finishIfComplete(attemptId, now) };
}

/** Signalement après la dernière réponse : la note et la maîtrise sont recalculées sans l'item signalé. */
function rescoreFinished(attempt: GrammarAttempt, itemId: string): { done: boolean; score?: number } {
  if (!attempt.answers.some((a) => a.itemId === itemId)) return { done: true, ...(attempt.score === undefined ? {} : { score: attempt.score }) };
  const answers = attempt.answers.filter((a) => a.itemId !== itemId);
  saveAnswers(attempt.id, answers);
  const live = listItems(attempt.setId);
  const score = live.length ? Math.round((100 * answers.filter((a) => a.correct).length) / live.length) : null;
  rescoreAttempt(attempt.id, score);
  const at = attempt.finishedAt!;
  const m = getMastery(attempt.point);
  const before = { point: m.point, scores: m.scores.filter((s) => s.at !== at), ...(m.masteredAt && m.masteredAt !== at ? { masteredAt: m.masteredAt, nextReviewAt: m.nextReviewAt } : {}) };
  saveMastery(score === null ? before : applyScore(before, score, new Date(at)));
  return { done: true, ...(score === null ? {} : { score }) };
}

export function flagGrammarItem(itemId: string, attemptId?: string, now = new Date()): { done: boolean; score?: number } {
  if (!flagItem(itemId, now)) throw new GrammarError("Exercice introuvable.", 404);
  console.info(`[grammaire] item signalé ${itemId}`);
  const attempt = attemptId ? getAttempt(attemptId) : undefined;
  if (!attempt) return { done: false };
  if (attempt.finishedAt) return rescoreFinished(attempt, itemId);
  saveAnswers(attempt.id, attempt.answers.filter((a) => a.itemId !== itemId));
  return finishIfComplete(attempt.id, now);
}
