import type { Tier } from "@/lib/tiers";

export const UP_THRESHOLD = 12; // /20, §17.3
export const DOWN_THRESHOLD = 8;
export const STREAK = 3;

export type TierProposal = { direction: "up" | "down"; to: Tier } | null;

/** `totals` : notes /20 des copies du palier courant, de la plus ancienne à la plus récente. */
export function tierProposal(tier: Tier, totals: number[]): TierProposal {
  const last = totals.slice(-STREAK);
  if (last.length < STREAK) return null;
  if (tier < 3 && last.every((t) => t >= UP_THRESHOLD)) return { direction: "up", to: (tier + 1) as Tier };
  if (tier > 1 && last.every((t) => t < DOWN_THRESHOLD)) return { direction: "down", to: (tier - 1) as Tier };
  return null;
}

/** Copies d'affilée à UP_THRESHOLD ou plus à la fin de `totals` (0 à STREAK) : ce qui compte déjà pour monter. */
export function upStreak(totals: number[]): number {
  const last = totals.slice(-STREAK);
  return last.length - (last.findLastIndex((t) => t < UP_THRESHOLD) + 1);
}
