import { Check, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ACTIVITY_ICONS, CopySheet, ErrorsToWork, GrammarProgramme, Ledger, NewsPanel, SECTION_TITLE, TierTimeline, WeekStrip } from "@/components/dashboard";
import { MockExamButton } from "@/components/mock-exam-button";
import { TierBanner } from "@/components/tier-banner";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { domainLabels, getProfile, isExamGoal, needsOnboarding } from "@/lib/profile";
import { buildDashboard } from "@/lib/services/dashboard";
import { buildToday, type Today } from "@/lib/services/today";
import { TIERS } from "@/lib/tiers";
import { TASK_LABELS, type TodayTask } from "@/lib/week-plan";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// `action` reçoit `primary` : un seul bouton plein par bloc, sur la première tâche à faire.
type Row = { icon: LucideIcon; title: string; description: string; done?: boolean; action?: (primary: boolean) => React.ReactNode };

function PlanRow({ icon: Icon, title, description, done, action, primary }: Row & { primary: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
      <span aria-hidden className="grid w-6 shrink-0 place-items-center self-start pt-0.5">
        {done ? <Check className="size-5 text-primary" /> : <Icon className={cn("size-5", primary ? "text-foreground" : "text-muted-foreground")} />}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className={cn("font-medium", done && "text-muted-foreground line-through decoration-primary/60")}>{title}</p>
        <p className="text-sm text-muted-foreground">{done ? "Fait aujourd’hui." : description}</p>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action(primary)}</div>}
    </li>
  );
}

const go = (href: string, label: string, variant: "default" | "outline" = "default") => (
  <Button asChild variant={variant} size="sm">
    <Link href={href}>{label}</Link>
  </Button>
);

function taskRow(task: TodayTask, today: Today, canAct: boolean, done: boolean): Row {
  const description: Record<TodayTask, string> = {
    writing: `Un sujet complet, ${TIERS[today.tier].label.toLowerCase()}.`,
    grammar: "Une série courte avec sa leçon, 10 à 15 minutes.",
    listening: "Un audio, trois écoutes au maximum, puis ton compte rendu.",
    rewrite: today.rewriteHref ? "Corrige toi-même les erreurs de ta dernière copie." : "Aucune copie à réécrire pour l’instant.",
    choice: "Grammaire ou sujet écrit, selon ton envie.",
    mock: "Format examen complet : 2 heures, sans les définitions.",
  };
  const variant = (primary: boolean) => (primary && !done ? "default" : "outline");
  const action: Record<TodayTask, Row["action"]> = {
    writing: (p) => go("/ecrit", done ? "Un autre" : "Commencer", variant(p)),
    grammar: (p) => go("/grammaire", done ? "Une autre" : "Commencer", variant(p)),
    listening: (p) => go("/ecoute", done ? "Une autre" : "Commencer", variant(p)),
    rewrite: today.rewriteHref ? (p) => go(today.rewriteHref!, "Réécrire", variant(p)) : undefined,
    choice: (p) => (
      <>
        {go("/grammaire", "Grammaire", variant(p))}
        {go("/ecrit", "Sujet écrit", "outline")}
      </>
    ),
    mock: canAct ? (p) => <MockExamButton variant={variant(p)} /> : undefined,
  };
  return { icon: ACTIVITY_ICONS[task], title: TASK_LABELS[task], description: description[task], done, action: action[task] };
}

const pct = (x: number | null) => (x === null ? "" : `${Math.round(x * 100)} %`);
const note = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
// Écart avec la note précédente, signé : « +1,5 par rapport à la précédente ».
const delta = (values: number[]) => {
  if (values.length < 2) return undefined;
  const d = values.at(-1)! - values.at(-2)!;
  return d === 0 ? "comme la précédente" : `${d > 0 ? "+" : "−"}${note(Math.abs(d))} par rapport à la précédente`;
};

export default async function TodayPage() {
  const user = await requireUser();
  const canAct = user.role === "student";
  // Premier passage : l'élève choisit d'abord sa langue et son objectif (une installation déjà utilisée garde l'anglais / BTS).
  if (needsOnboarding() && canAct) redirect("/objectif");
  const profile = getProfile();
  const now = new Date();
  const today = buildToday(now);
  const dash = buildDashboard(now);
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const rows: Row[] = [];
  if (today.placement)
    rows.push({
      icon: Target,
      title: today.placement === "first" ? "Test de positionnement" : "Refaire le test de positionnement",
      description:
        today.placement === "first"
          ? "20 à 25 minutes pour régler ton palier et tes priorités de grammaire. À faire en premier."
          : "C’est le moment de mesurer tes progrès.",
      action: canAct ? (p) => go("/positionnement", "Faire le test", p ? "default" : "outline") : undefined,
    });
  const resumeIcon = (href: string) =>
    href.startsWith("/ecoute") ? ACTIVITY_ICONS.listening : href.startsWith("/grammaire") ? ACTIVITY_ICONS.grammar : href.startsWith("/positionnement") ? Target : ACTIVITY_ICONS.writing;
  for (const r of today.resume) rows.push({ icon: resumeIcon(r.href), title: r.label, description: "Reprends là où tu en étais.", action: (p) => go(r.href, "Reprendre", p ? "default" : "outline") });
  rows.push({
    icon: ACTIVITY_ICONS.review,
    title: "Révisions de vocabulaire",
    description:
      today.dueCards > 0
        ? `${today.dueCards} ${today.dueCards > 1 ? "cartes" : "carte"} à revoir, environ ${today.reviewMinutes} min.`
        : "Aucune carte à revoir. Garde des mots en lisant pour en ajouter.",
    done: today.dueCards === 0 && dash.doneToday.includes("review"),
    action: today.dueCards > 0 ? (p) => go("/revisions", "Réviser", p ? "default" : "outline") : undefined,
  });
  for (const task of today.tasks) rows.push(taskRow(task, today, canAct, dash.doneToday.includes(task)));

  const doneCount = rows.filter((r) => r.done).length;
  const primaryRow = rows.findIndex((r) => !r.done && r.action);
  const lastListening = dash.listening.notes.at(-1);

  return (
    <div className="space-y-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <h1 className="font-article text-4xl font-normal tracking-tight first-letter:uppercase sm:text-5xl">{date}</h1>
        <Link href="/profil" className="pb-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
          {TIERS[today.tier].label}
        </Link>
      </header>

      {today.proposal && <TierBanner proposal={today.proposal} tier={today.tier} canAct={canAct} />}

      <div className="grid gap-12 lg:grid-cols-5">
        <div className="space-y-12 lg:col-span-3">
          <section aria-labelledby="plan-title" className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="plan-title" className={SECTION_TITLE}>Au programme aujourd’hui</h2>
              <p className="text-sm tabular-nums text-muted-foreground">
                {doneCount} sur {rows.length} fait{doneCount > 1 ? "s" : ""}
              </p>
            </div>
            <ol className="divide-y border-y">
              {rows.map((r, i) => (
                <PlanRow key={i} {...r} primary={i === primaryRow} />
              ))}
            </ol>
            {today.tasks.length === 0 && <p className="text-sm text-muted-foreground">Jour de repos : seules les révisions sont au programme.</p>}
          </section>
          <WeekStrip week={dash.week} />
        </div>

        <div className="space-y-12 lg:col-span-2">
          <section aria-labelledby="stats-title" className="space-y-4">
            <h2 id="stats-title" className={SECTION_TITLE}>Tes progrès</h2>
            <CopySheet copy={dash.lastCopy} change={delta(dash.writing.notes.map((n) => n.total))} lang={profile.target.code} />
            <Ledger
              rows={[
                { label: "Mots acquis", value: String(dash.vocab.acquired), hint: `sur ${dash.vocab.total} mots gardés` },
                {
                  label: "Réussite en révision",
                  value: pct(dash.vocab.successRate7d),
                  hint: dash.vocab.reviews7d ? `${dash.vocab.reviews7d} cartes sur 7 jours, cible 85 à 90 %` : "cible 85 à 90 %",
                },
                {
                  label: "Dernière écoute",
                  value: lastListening !== undefined ? `${note(lastListening)}/10` : "",
                  hint: delta(dash.listening.notes) ?? (lastListening !== undefined ? "ta première écoute notée" : "aucune écoute corrigée"),
                },
                ...(dash.levels
                  ? Object.entries(dash.levels.levels).map(([skill, level]) => ({
                      label: skill,
                      value: level,
                      hint: `au test du ${new Date(dash.levels!.at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
                    }))
                  : []),
              ]}
            />
            {!dash.levels && <p className="text-sm text-muted-foreground">Ton niveau par compétence s’affichera ici après le test de positionnement.</p>}
          </section>
          <NewsPanel news={dash.news} domains={domainLabels(profile)} lang={profile.target.code} />
        </div>
      </div>

      <TierTimeline tier={dash.tier} exam={isExamGoal(profile)} notes={dash.writing.notes} />

      <div className="grid items-start gap-12 lg:grid-cols-2">
        {dash.grammar.points.length > 0 && <GrammarProgramme grammar={dash.grammar} />}
        <ErrorsToWork errors={dash.errors} />
      </div>

      <nav aria-label="Autres liens" className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm">
        <Link href="/historique" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Historique</Link>
        <Link href="/bilan" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Bilan de la semaine</Link>
        <Link href="/vocabulaire" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Tous mes mots</Link>
        <Link href="/?visite=1" scroll={false} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Revoir la présentation</Link>
      </nav>
    </div>
  );
}
