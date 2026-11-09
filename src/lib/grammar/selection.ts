import { getProgramme, programmeUpTo, type GrammarPoint } from "@/lib/grammar-programme";
import type { MasteryState } from "./schema";

export const MASTERY_THRESHOLD = 85;
export const MASTERY_GAP_DAYS = 3;
export const REVIEW_AFTER_DAYS = 21;
export const ERROR_TRIGGER = 3; // « dépasse 3 occurrences »
export const DAY_MS = 86_400_000;
const KEPT_SCORES = 10;

export const emptyMastery = (point: GrammarPoint): MasteryState => ({ point, scores: [] });

const inDays = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS).toISOString();

export function applyScore(state: MasteryState, score: number, now: Date): MasteryState {
  const at = now.toISOString();
  const scores = [...state.scores, { score, at }].slice(-KEPT_SCORES);
  if (state.masteredAt) {
    return score >= MASTERY_THRESHOLD
      ? { point: state.point, scores, masteredAt: state.masteredAt, nextReviewAt: inDays(now, REVIEW_AFTER_DAYS) }
      : { point: state.point, scores };
  }
  const earlierSuccess = state.scores.some(
    (s) => s.score >= MASTERY_THRESHOLD && now.getTime() - Date.parse(s.at) >= MASTERY_GAP_DAYS * DAY_MS,
  );
  if (score >= MASTERY_THRESHOLD && earlierSuccess) {
    return { point: state.point, scores, masteredAt: at, nextReviewAt: inDays(now, REVIEW_AFTER_DAYS) };
  }
  return { point: state.point, scores };
}

export type SelectionInput = {
  now: Date;
  corrections: { correctedAt: string; categories: GrammarPoint[] }[]; // les 5 dernières copies corrigées
  mastery: MasteryState[];
  lastPracticed: Partial<Record<GrammarPoint, string>>; // fin de la dernière série terminée, par point
  priorities: GrammarPoint[]; // issues du dernier test de positionnement
};

export type Selection = { point: GrammarPoint; reason: "errors" | "review" | "programme"; count?: number };

// null : programme vide (langue pas encore préparée).
export function selectPoint({ now, corrections, mastery, lastPracticed, priorities }: SelectionInput): Selection | null {
  const all = getProgramme();
  if (all.points.length === 0) return null;
  const order = (p: GrammarPoint) => all.points.findIndex((q) => q.key === p);
  // 1-2. Erreurs réelles : une catégorie qui dépasse 3 occurrences.
  const counts = new Map<GrammarPoint, number>();
  for (const c of corrections) {
    for (const point of c.categories) {
      const practiced = lastPracticed[point];
      if (practiced && practiced >= c.correctedAt) continue; // déjà retravaillé depuis cette copie
      counts.set(point, (counts.get(point) ?? 0) + 1);
    }
  }
  const top = [...counts]
    .filter(([, n]) => n > ERROR_TRIGGER)
    .sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))[0];
  if (top) return { point: top[0], reason: "errors", count: top[1] };

  // 4. Révision d'un point maîtrisé, 3 semaines plus tard.
  const due = mastery
    .filter((m) => m.masteredAt && m.nextReviewAt && Date.parse(m.nextReviewAt) <= now.getTime())
    .sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!))[0];
  if (due) return { point: due.point, reason: "review" };

  // 3. Programme de la période (et des périodes précédentes).
  const programme = programmeUpTo(now, all);
  const masteredPoints = new Set(mastery.filter((m) => m.masteredAt).map((m) => m.point));
  const open = programme.filter((p) => !masteredPoints.has(p));
  const pool = open.length > 0 ? open : programme;
  const rank = (p: GrammarPoint): [number, string, number] => [
    priorities.includes(p) ? 0 : 1,
    lastPracticed[p] ?? "", // "" = jamais travaillé, passe en premier
    programme.indexOf(p),
  ];
  const [point] = [...pool].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1].localeCompare(rb[1]) || ra[2] - rb[2];
  });
  return { point, reason: "programme" };
}
