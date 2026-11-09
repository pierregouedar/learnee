import { excerpt } from "@/lib/annotate";
import { db } from "@/lib/db";
import { getProgramme, type GrammarPoint } from "@/lib/grammar-programme";
import { lastPracticed, listMastery } from "@/lib/repo/grammar";
import { listHeadlines, type Headline } from "@/lib/news/headlines";
import { listCorrectedAttempts } from "@/lib/repo/listenings";
import { listDonePlacements } from "@/lib/repo/placements";
import { getTierHistory, proposalSince, type TierChange } from "@/lib/repo/progression";
import { getTier } from "@/lib/repo/settings";
import { listCorrected, type HistoryEntry } from "@/lib/repo/sessions";
import { getWeekPlan } from "@/lib/repo/week-plan";
import { reviewStats } from "@/lib/review";
import { nextSelection } from "@/lib/services/grammar";
import { ERROR_TYPE_LABELS } from "@/lib/services/weekly-report";
import { STREAK } from "@/lib/tier-rules";
import type { Tier } from "@/lib/tiers";
import { WEEK_DAYS, dayKey, type DayKey, type PlanTask } from "@/lib/week-plan";

const DAY_MS = 86_400_000;
const ERRORS_WINDOW_DAYS = 30;

export type Activity = PlanTask | "review" | "mock";
export type WeekDay = { key: DayKey; date: string; planned: PlanTask[]; done: Activity[]; isToday: boolean; isPast: boolean };
export type GrammarState = "mastered" | "practised" | "todo";

export type Dashboard = {
  week: WeekDay[];
  doneToday: Activity[];
  grammar: { points: { point: GrammarPoint; label: string; state: GrammarState }[]; next: GrammarPoint | null };
  vocab: { acquired: number; total: number; successRate7d: number | null; reviews7d: number };
  writing: { notes: { total: number; at: string; title: string }[] };
  /** Dernière copie corrigée (hors examen blanc) : passage du texte en anglais et ses erreurs, pour l'aperçu annoté. */
  lastCopy?: { id: string; title: string; total: number; at: string; excerpt: string; errors: { extrait: string; correction: string }[] };
  listening: { notes: number[] };
  levels?: { levels: Record<string, string>; at: string };
  errors: { label: string; count: number }[];
  /** `recent` : notes /20 des dernières copies du palier actuel (celles qui décident d'un changement de palier). */
  tier: { current: Tier; history: TierChange[]; recent: number[] };
  news: Headline[];
};

// Clé de jour dans le fuseau du serveur (Europe/Paris en prod).
const dayOf = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function activityDays(since: string): Map<string, Set<Activity>> {
  const rows = db()
    .prepare(
      `SELECT CASE WHEN is_mock = 1 THEN 'mock' ELSE 'writing' END AS kind, corrected_at AS at FROM sessions WHERE status = 'corrected' AND corrected_at >= @since
       UNION ALL SELECT 'grammar', finished_at FROM grammar_attempts WHERE finished_at >= @since
       UNION ALL SELECT 'listening', corrected_at FROM listening_attempts WHERE status = 'corrected' AND corrected_at >= @since
       UNION ALL SELECT 'rewrite', created_at FROM rewrites WHERE created_at >= @since
       UNION ALL SELECT 'review', reviewed_at FROM review_logs WHERE reviewed_at >= @since`,
    )
    .all({ since }) as { kind: Activity; at: string }[];
  const byDay = new Map<string, Set<Activity>>();
  for (const r of rows) {
    const key = dayOf(new Date(r.at));
    byDay.set(key, (byDay.get(key) ?? new Set()).add(r.kind));
  }
  return byDay;
}

/** Palier actuel, historique, et notes /20 des dernières copies du palier (celles qui décident d'un passage). */
export function tierProgress(copies = listCorrected()): Dashboard["tier"] {
  const current = getTier();
  const history = getTierHistory();
  const since = proposalSince();
  return {
    current,
    history,
    recent: copies
      .filter((c) => !c.isMock && c.tier === current && c.result && (c.correctedAt ?? "") > since)
      .slice(-STREAK)
      .map((c) => c.result!.compte_rendu.note + c.result!.expression.note),
  };
}

function lastCopyPreview(copies: HistoryEntry[]): Pick<Dashboard, "lastCopy"> {
  const c = copies.filter((s) => !s.isMock && s.result).at(-1);
  if (!c) return {};
  const errors = c.result!.expression.erreurs.map(({ extrait, correction }) => ({ extrait, correction }));
  return {
    lastCopy: {
      id: c.id,
      title: c.subjectTitle,
      total: c.result!.compte_rendu.note + c.result!.expression.note,
      at: c.correctedAt!,
      excerpt: excerpt(c.pe, errors.map((e) => e.extrait)),
      errors,
    },
  };
}

export function buildDashboard(now = new Date()): Dashboard {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - WEEK_DAYS.indexOf(dayKey(now)));
  const activity = activityDays(monday.toISOString());
  const plan = getWeekPlan();
  const week = WEEK_DAYS.map((key, i): WeekDay => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const done = [...(activity.get(dayOf(date)) ?? [])];
    // « Au choix » est fait dès qu'une séance de grammaire ou d'écrit a eu lieu.
    if (done.includes("grammar") || done.includes("writing")) done.push("choice");
    return { key, date: date.toISOString(), planned: [...new Set(plan[key])], done, isToday: dayOf(date) === dayOf(now), isPast: date < now && dayOf(date) !== dayOf(now) };
  });

  const mastered = new Set(listMastery().filter((m) => m.masteredAt).map((m) => m.point));
  const practised = lastPracticed();

  const programme = getProgramme();
  const labels = new Map(programme.points.map((p) => [p.key, p.label]));
  const copies = listCorrected();
  const since = new Date(now.getTime() - ERRORS_WINDOW_DAYS * DAY_MS).toISOString();
  const errors = new Map<string, number>();
  for (const s of copies.filter((c) => (c.correctedAt ?? "") >= since)) {
    for (const e of s.result?.expression.erreurs ?? []) {
      const label = labels.get(e.categorie ?? "") ?? ERROR_TYPE_LABELS[e.type];
      if (label) errors.set(label, (errors.get(label) ?? 0) + 1);
    }
  }

  const { n: total } = db().prepare(`SELECT COUNT(*) AS n FROM cards WHERE suspended = 0`).get() as { n: number };
  const last = listDonePlacements().at(-1);

  return {
    week,
    doneToday: week.find((d) => d.isToday)?.done ?? [],
    grammar: {
      points: programme.points.map(({ key: point, label }) => ({
        point,
        label,
        state: mastered.has(point) ? "mastered" : practised[point] ? "practised" : "todo",
      })),
      next: nextSelection(now)?.point ?? null,
    },
    vocab: { ...reviewStats(now), total },
    writing: {
      notes: copies
        .filter((c) => !c.isMock && c.result)
        .slice(-8)
        .map((c) => ({ total: c.result!.compte_rendu.note + c.result!.expression.note, at: c.correctedAt!, title: c.subjectTitle })),
    },
    ...lastCopyPreview(copies),
    listening: { notes: listCorrectedAttempts().flatMap((a) => (a.result ? [a.result.note] : [])).slice(0, 8).reverse() },
    ...(last?.result && last.finishedAt ? { levels: { levels: last.result.levels, at: last.finishedAt } } : {}),
    errors: [...errors].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, count]) => ({ label, count })),
    tier: tierProgress(copies),
    // Titres déjà lus (base seule, aucun appel réseau ni modèle) ; Écrit relit les flux à l'ouverture.
    news: listHeadlines(now).slice(0, 3),
  };
}
