import { db } from "@/lib/db";
import { getProgramme, isProgrammePoint, pointLabel, type GrammarPoint } from "@/lib/grammar-programme";
import { callJson } from "@/lib/llm/client";
import { routeFor } from "@/lib/llm/config";
import { mailConfigured, sendMail } from "@/lib/mail";
import { buildWeeklyAdvicePrompt, WeeklyAdviceSchema } from "@/lib/prompts/weekly-report";
import { listCorrectedAttempts } from "@/lib/repo/listenings";
import { listCorrected } from "@/lib/repo/sessions";
import { getJsonSetting, setJsonSetting } from "@/lib/repo/settings";
import { reviewStats } from "@/lib/review";

const DAY_MS = 86_400_000;
const REPORT_KEY = "weekly_report";
const SUBJECT = "Learnee · bilan de la semaine";

export type WeeklyReport = {
  from: string;
  to: string;
  writing: { title: string; total: number; isMock: boolean }[];
  listening: number[];
  grammar: { point: GrammarPoint; score: number }[];
  rewrites: number[];
  recurringErrors: { label: string; count: number }[];
  weakPoints: GrammarPoint[];
  wordsAcquired: number;
};

export const ERROR_TYPE_LABELS: Record<string, string> = {
  grammaire: "Grammaire (autre)",
  vocabulaire: "Vocabulaire",
  orthographe: "Orthographe",
  registre: "Registre",
  structure: "Structure",
};

export function buildWeeklyReport(now = new Date()): WeeklyReport {
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const until = now.toISOString();
  const inWeek = (iso?: string) => Boolean(iso && iso >= since && iso <= until);

  const programme = getProgramme();
  const labels = new Map(programme.points.map((p) => [p.key, p.label]));
  const copies = listCorrected().filter((s) => inWeek(s.correctedAt) && s.result);
  const errors = new Map<string, number>();
  for (const s of copies) {
    for (const e of s.result!.expression.erreurs) {
      const label = labels.get(e.categorie ?? "") ?? ERROR_TYPE_LABELS[e.type];
      errors.set(label, (errors.get(label) ?? 0) + 1);
    }
  }

  const grammar = (
    db()
      .prepare(`SELECT point, score FROM grammar_attempts WHERE finished_at >= ? AND finished_at <= ? AND score IS NOT NULL ORDER BY finished_at`)
      .all(since, until) as { point: string; score: number }[]
  )
    .filter((r) => isProgrammePoint(r.point, programme))
    .map((r) => ({ point: r.point as GrammarPoint, score: r.score }));

  const rewrites = (
    db().prepare(`SELECT result FROM rewrites WHERE created_at >= ? AND created_at <= ? ORDER BY created_at`).all(since, until) as { result: string }[]
  ).map((r) => (JSON.parse(r.result) as { rate: number }).rate);

  return {
    from: since,
    to: until,
    writing: copies.map((s) => ({ title: s.subjectTitle, total: s.result!.compte_rendu.note + s.result!.expression.note, isMock: s.isMock })),
    listening: listCorrectedAttempts()
      .filter((a) => inWeek(a.correctedAt) && a.result)
      .map((a) => a.result!.note),
    grammar,
    rewrites,
    recurringErrors: [...errors]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count })),
    weakPoints: [...new Set(grammar.filter((g) => g.score < 60).map((g) => g.point))],
    wordsAcquired: reviewStats(now).acquired,
  };
}

const num = (n: number) => n.toLocaleString("fr-FR");
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function formatWeeklyReport(r: WeeklyReport, advice?: string): string {
  const lines = [`Bilan de la semaine du ${day(r.from)} au ${day(r.to)}`, ""];
  lines.push(`Sujets écrits : ${r.writing.length}`);
  for (const w of r.writing) lines.push(`- ${w.title} : ${num(w.total)}/20${w.isMock ? " (examen blanc)" : ""}`);
  lines.push(`Écoutes : ${r.listening.length}${r.listening.length ? ` (notes : ${r.listening.map((n) => `${num(n)}/10`).join(", ")})` : ""}`);
  lines.push(`Séries de grammaire : ${r.grammar.length}`);
  for (const g of r.grammar) lines.push(`- ${pointLabel(g.point)} : ${g.score} %`);
  lines.push(`Réécritures : ${r.rewrites.length}${r.rewrites.length ? ` (erreurs corrigées : ${r.rewrites.map((x) => `${x} %`).join(", ")})` : ""}`);
  lines.push("");
  lines.push(`Erreurs récurrentes : ${r.recurringErrors.length ? r.recurringErrors.map((e) => `${e.label} (${e.count})`).join(", ") : "aucune"}`);
  lines.push(`Points de grammaire en difficulté : ${r.weakPoints.length ? r.weakPoints.map((p) => pointLabel(p)).join(", ") : "aucun"}`);
  lines.push(`Mots acquis (total) : ${r.wordsAcquired}`);
  if (advice) lines.push("", `À travailler à l’oral cette semaine : ${advice}`);
  return lines.join("\n");
}

type StoredReport = { generatedAt: string; advice?: string };

export function latestAdvice(now = new Date()): string | undefined {
  const stored = getJsonSetting<StoredReport | null>(REPORT_KEY, null);
  return stored && now.getTime() - Date.parse(stored.generatedAt) < 7 * DAY_MS ? stored.advice : undefined;
}

// Tâche du dimanche soir : conseil LLM facultatif, e-mail si SMTP configuré, sinon lecture sur /bilan.
export async function sendWeeklyReport(now = new Date()): Promise<void> {
  const report = buildWeeklyReport(now);
  let advice: string | undefined;
  // Tâche automatique : rien de payant ne doit partir sans clic, donc pas de conseil si un modèle de la liste est payant.
  if (!routeFor("weekly_report").models.every((m) => m.endsWith(":free"))) {
    console.warn("[bilan] conseil ignoré : LLM_MODEL_WEEKLY_REPORT doit lister uniquement des modèles :free");
  } else {
    try {
      advice = (await callJson("weekly_report", buildWeeklyAdvicePrompt(formatWeeklyReport(report)), WeeklyAdviceSchema)).conseil;
    } catch (e) {
      console.error("[bilan] conseil indisponible", e);
    }
  }
  setJsonSetting(REPORT_KEY, { generatedAt: now.toISOString(), ...(advice ? { advice } : {}) } satisfies StoredReport);
  if (mailConfigured()) await sendMail({ subject: SUBJECT, text: formatWeeklyReport(report, advice) });
}
