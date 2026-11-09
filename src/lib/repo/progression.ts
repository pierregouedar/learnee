import { db } from "@/lib/db";
import { listCorrected } from "@/lib/repo/sessions";
import { getJsonSetting, getTier, setJsonSetting, setTier } from "@/lib/repo/settings";
import { tierProposal, type TierProposal } from "@/lib/tier-rules";
import type { Tier } from "@/lib/tiers";

export type TierChange = { tier: Tier; from: string };

const HISTORY_KEY = "tier_history";
const DECLINED_KEY = "tier_declined_at";

export function getTierHistory(): TierChange[] {
  return getJsonSetting<TierChange[]>(HISTORY_KEY, []);
}

export function changeTier(tier: Tier, now = new Date()) {
  setTier(tier);
  // Les actualités préparées pour l'ancien palier sortent du stock : le rattrapage en prépare au nouveau.
  db().prepare(`UPDATE subjects SET status = 'expired' WHERE status = 'ready' AND source = 'rss' AND tier != ?`).run(tier);
  const history = getTierHistory();
  if (history.at(-1)?.tier !== tier) setJsonSetting(HISTORY_KEY, [...history, { tier, from: now.toISOString() }]);
}

export function declineTierProposal(now = new Date()) {
  setJsonSetting(DECLINED_KEY, now.toISOString());
}

/** Seules les copies après le dernier changement de palier ou le dernier refus décident d'une proposition. */
export function proposalSince(): string {
  return [getTierHistory().at(-1)?.from ?? "", getJsonSetting<string>(DECLINED_KEY, "")].sort().at(-1)!;
}

export function currentTierProposal(): TierProposal {
  const tier = getTier();
  const since = proposalSince();
  const totals = listCorrected()
    .filter((s) => !s.isMock && s.tier === tier && s.result && s.correctedAt! > since)
    .map((s) => s.result!.compte_rendu.note + s.result!.expression.note);
  return tierProposal(tier, totals);
}
