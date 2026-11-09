import { db } from "@/lib/db";
import { pointLabel } from "@/lib/grammar-programme";
import { placementDue } from "@/lib/placement/score";
import { getOpenAttempt } from "@/lib/repo/grammar";
import { getInProgressPlacement, lastPlacementAt } from "@/lib/repo/placements";
import { currentTierProposal } from "@/lib/repo/progression";
import { latestRewritableSession } from "@/lib/repo/rewrites";
import { getActiveSession } from "@/lib/repo/sessions";
import { getTier } from "@/lib/repo/settings";
import { getWeekPlan } from "@/lib/repo/week-plan";
import { countDue } from "@/lib/review";
import { lastMockAt, mockExamDue } from "@/lib/services/mock-exam";
import type { TierProposal } from "@/lib/tier-rules";
import type { Tier } from "@/lib/tiers";
import { todayTasks, type TodayTask } from "@/lib/week-plan";

export const SECONDS_PER_CARD = 10;

export type Today = {
  dueCards: number;
  reviewMinutes: number;
  tasks: TodayTask[];
  resume: { href: string; label: string }[];
  rewriteHref?: string;
  placement: "first" | "redo" | null;
  proposal: TierProposal;
  tier: Tier;
};

function listeningInProgress(): string | undefined {
  const row = db().prepare(`SELECT id FROM listening_attempts WHERE status IN ('draft', 'correcting') ORDER BY started_at DESC LIMIT 1`).get() as
    | { id: string }
    | undefined;
  return row?.id;
}

export function buildToday(now = new Date()): Today {
  const dueCards = countDue(now);
  const resume: Today["resume"] = [];
  const session = getActiveSession();
  if (session) resume.push({ href: "/rediger", label: session.isMock ? "Reprendre l’examen blanc" : "Reprendre ma copie" });
  const grammar = getOpenAttempt(now);
  if (grammar) resume.push({ href: `/grammaire/${grammar.id}`, label: `Reprendre la série : ${pointLabel(grammar.point)}` });
  const listening = listeningInProgress();
  if (listening) resume.push({ href: `/ecoute/${listening}`, label: "Reprendre l’écoute en cours" });
  const placementOpen = getInProgressPlacement();
  if (placementOpen) resume.push({ href: "/positionnement", label: "Reprendre le test de positionnement" });

  const lastPlacement = lastPlacementAt();
  const rewriteId = latestRewritableSession();
  return {
    dueCards,
    reviewMinutes: Math.ceil((dueCards * SECONDS_PER_CARD) / 60),
    tasks: todayTasks(now, getWeekPlan(), mockExamDue(now, lastMockAt())),
    resume,
    ...(rewriteId ? { rewriteHref: `/sessions/${rewriteId}/reecrire` } : {}),
    placement: placementOpen ? null : !lastPlacement ? "first" : placementDue(now, lastPlacement) ? "redo" : null,
    proposal: currentTierProposal(),
    tier: getTier(),
  };
}
