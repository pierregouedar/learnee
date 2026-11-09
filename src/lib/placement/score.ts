import { getProgramme, type GrammarPoint } from "@/lib/grammar-programme";
import type { Tier } from "@/lib/tiers";

export const WRITING_LEVELS = ["A1", "A2", "B1", "B1+", "B2", "C1"] as const;
export type WritingLevel = (typeof WRITING_LEVELS)[number];

export const levelFromPercent = (pct: number): string => (pct < 40 ? "A2" : pct < 60 ? "B1" : pct < 80 ? "B1+" : "B2");

export type PlacementOutcome = { tier: Tier; priorities: GrammarPoint[]; levels: Record<string, string>; grammarPct: number };

export function placementOutcome(input: {
  grammar: { point: GrammarPoint; correct: boolean }[];
  readingPct: number;
  writingLevel: WritingLevel;
  listeningPct?: number;
}): PlacementOutcome {
  const { grammar, readingPct, writingLevel, listeningPct } = input;
  const grammarPct = grammar.length ? Math.round((100 * grammar.filter((g) => g.correct).length) / grammar.length) : 0;
  const writing = WRITING_LEVELS.indexOf(writingLevel);
  const tier: Tier =
    grammarPct >= 80 && readingPct >= 75 && writing >= WRITING_LEVELS.indexOf("B2")
      ? 3
      : grammarPct >= 55 && readingPct >= 50 && writing >= WRITING_LEVELS.indexOf("B1")
        ? 2
        : 1;

  const keys = getProgramme().points.map((p) => p.key);
  const wrong = new Map<GrammarPoint, number>();
  for (const g of grammar) if (!g.correct) wrong.set(g.point, (wrong.get(g.point) ?? 0) + 1);
  const priorities = [...wrong]
    .sort((a, b) => b[1] - a[1] || keys.indexOf(a[0]) - keys.indexOf(b[0]))
    .slice(0, 3)
    .map(([point]) => point);

  return {
    tier,
    priorities,
    grammarPct,
    levels: {
      Grammaire: levelFromPercent(grammarPct),
      "Compréhension écrite": levelFromPercent(readingPct),
      "Expression écrite": writingLevel,
      "Compréhension orale": listeningPct === undefined ? "non testée" : levelFromPercent(listeningPct),
    },
  };
}

// Au premier lancement, puis en janvier et en avril (§19.1).
export function placementDue(now: Date, lastAt?: string): boolean {
  if (!lastAt) return true;
  const month = now.getMonth() + 1;
  if (month !== 1 && month !== 4) return false;
  return Date.parse(lastAt) < new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
