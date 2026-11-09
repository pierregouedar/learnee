import { matchesAccepted } from "@/lib/grammar/answers";
import { placementProgress, type Progress } from "@/lib/generation-progress";
import { callJson } from "@/lib/llm/client";
import {
  GeneratedPlacementSchema, PlacementGrammarItemSchema, WritingEvalSchema,
  type GeneratedPlacement, type Mcq, type PlacementAnswers, type PlacementContent, type PlacementResult,
} from "@/lib/placement/schema";
import { placementOutcome } from "@/lib/placement/score";
import { buildPlacementPrompt, buildPlacementWritingPrompt } from "@/lib/prompts/placement";
import {
  findPlacementAudio, getInProgressPlacement, getPlacement, insertPlacement, lastPlacementAt, listeningAudioUrl,
  savePlacementResult, type Placement,
} from "@/lib/repo/placements";
import { markListeningUsed } from "@/lib/repo/listenings";
import { changeTier } from "@/lib/repo/progression";
import { countWords } from "@/lib/text";

const GRAMMAR_COUNT = 20;
const MIN_GRAMMAR = 16;
const MIN_WRITING_WORDS = 15;

export class PlacementError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 502,
  ) {
    super(message);
  }
}

const validMcq = (q: Mcq) => q.answer < q.options.length;

function toContent(data: GeneratedPlacement, audio?: { listeningId: string }): PlacementContent | null {
  const grammar = data.grammar
    .flatMap((raw) => {
      const parsed = PlacementGrammarItemSchema.safeParse(raw);
      if (!parsed.success) return [];
      const item = parsed.data;
      if (item.format === "mcq") {
        const options = [...new Set(item.options ?? [])];
        // Exactement une bonne option : sinon la question est ambiguë.
        if (options.length < 3 || options.filter((o) => matchesAccepted(o, item.accepted)).length !== 1) return [];
        return [{ ...item, options }];
      }
      // Trou libre seulement pour conjuguer un verbe donné entre parenthèses, sinon plusieurs mots peuvent convenir.
      if (!/___\s*\([^)]+\)/.test(item.prompt)) return [];
      return [item];
    })
    .slice(0, GRAMMAR_COUNT);
  if (grammar.length < MIN_GRAMMAR) return null;
  if (data.reading.questions.length !== 4 || !data.reading.questions.every(validMcq)) return null;
  const questions = data.listening?.questions;
  const listening =
    audio && questions && questions.length === 3 && questions.every(validMcq)
      ? { listeningId: audio.listeningId, audioUrl: listeningAudioUrl(audio.listeningId), questions }
      : undefined;
  return { grammar, reading: data.reading, writing: data.writing, ...(listening ? { listening } : {}) };
}

export async function createPlacement(now = new Date(), onProgress?: (p: Progress) => void): Promise<Placement> {
  const open = getInProgressPlacement();
  if (open) return open;
  const audio = findPlacementAudio();
  const prompt = buildPlacementPrompt({ transcript: audio?.transcript });
  const onText = onProgress && ((text: string) => onProgress(placementProgress(text, GRAMMAR_COUNT)));
  for (let attempt = 0; attempt < 2; attempt++) {
    onProgress?.({ label: attempt ? "Test incomplet, nouvelle préparation" : "Préparation du test", pct: 2 });
    const content = toContent(await callJson("placement", prompt, GeneratedPlacementSchema, undefined, onText), audio);
    if (!content) continue;
    // Déjà entendu pendant le test : ne plus le proposer comme exercice d'écoute « neuf ».
    if (content.listening) markListeningUsed(content.listening.listeningId);
    return insertPlacement(content, now);
  }
  throw new PlacementError("Le test préparé était incomplet. Réessaie dans un instant.", 502);
}

const percent = (questions: Mcq[], given: (number | null)[]) =>
  questions.length ? Math.round((100 * questions.filter((q, i) => given[i] === q.answer).length) / questions.length) : 0;

export async function submitPlacement(id: string, answers: PlacementAnswers, now = new Date()): Promise<PlacementResult> {
  const p = getPlacement(id);
  if (!p) throw new PlacementError("Test introuvable.", 404);
  if (p.status === "done") throw new PlacementError("Ce test est déjà terminé.", 409);

  const grammar = p.content.grammar.map((g, i) => ({ point: g.point, correct: matchesAccepted(answers.grammar[i] ?? "", g.accepted) }));
  const readingPct = percent(p.content.reading.questions, answers.reading);
  const listeningPct = p.content.listening ? percent(p.content.listening.questions, answers.listening ?? []) : undefined;
  const writing =
    countWords(answers.writing) < MIN_WRITING_WORDS
      ? { niveau: "A1" as const, commentaire: "Texte trop court pour être évalué." }
      : await callJson("placement", buildPlacementWritingPrompt({ task: p.content.writing.task, text: answers.writing }), WritingEvalSchema, id);

  const outcome = placementOutcome({ grammar, readingPct, writingLevel: writing.niveau, listeningPct });
  const startingTier = !lastPlacementAt();
  const result: PlacementResult = {
    ...outcome,
    scores: { grammar: outcome.grammarPct, reading: readingPct, ...(listeningPct === undefined ? {} : { listening: listeningPct }) },
    writing,
    listeningSkipped: !p.content.listening,
    startingTier,
  };
  if (!savePlacementResult(id, answers, result, now)) throw new PlacementError("Ce test est déjà terminé.", 409);
  if (startingTier) changeTier(result.tier, now); // ensuite, jamais de changement automatique (§17.3)
  return result;
}
