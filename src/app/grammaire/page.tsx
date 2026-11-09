import { BookOpen, Check, CircleDashed, PlayCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { StatTile } from "@/components/dashboard";
import { IconBadge, PageHeader, SectionTitle } from "@/components/page";
import { StartGrammarButton } from "@/components/start-grammar-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getProgramme, PERIOD_MONTHS, pointLabel, type GrammarPoint } from "@/lib/grammar-programme";
import type { Selection } from "@/lib/grammar/selection";
import { getOpenAttempt, lastPracticed, listMastery } from "@/lib/repo/grammar";
import { nextSelection } from "@/lib/services/grammar";

export const dynamic = "force-dynamic";

type State = "mastered" | "practised" | "todo";
const STATE: Record<State, { label: string; icon: LucideIcon; tone: "primary" | "accent" | "muted" }> = {
  mastered: { label: "Validé", icon: Check, tone: "primary" },
  practised: { label: "En cours", icon: BookOpen, tone: "accent" },
  todo: { label: "À voir", icon: CircleDashed, tone: "muted" },
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const periodLabel = (months: readonly number[]) => {
  const [a, b] = months.map((m) => MONTHS[m - 1]);
  return `${a[0].toUpperCase()}${a.slice(1)} et ${b}`;
};
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function reasonText(s: Selection): string {
  if (s.reason === "errors") return `Tu as fait ${s.count} erreurs de ce type dans tes dernières copies.`;
  if (s.reason === "review") return "Point validé il y a trois semaines : petite révision.";
  return "Prochain point du programme de la période.";
}

export default async function GrammairePage() {
  const user = await requireUser();
  const canAct = user.role === "student";
  const open = getOpenAttempt();
  const selection = nextSelection();
  const programme = getProgramme();
  const points = programme.points.map((p) => p.key);
  const periods = PERIOD_MONTHS.map((months, i) => ({ months, points: programme.points.filter((p) => p.period === i).map((p) => p.key) })).filter(
    (p) => p.points.length > 0,
  );
  const label = (p: GrammarPoint) => pointLabel(p, programme);
  const mastery = new Map(listMastery().map((m) => [m.point, m]));
  const practiced = lastPracticed();

  const stateOf = (p: GrammarPoint): State => (mastery.get(p)?.masteredAt ? "mastered" : practiced[p] ? "practised" : "todo");
  const count = (s: State) => points.filter((p) => stateOf(p) === s).length;
  const month = new Date().getMonth() + 1;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Grammaire"
        description="Des séries courtes de 10 à 15 minutes, un point à la fois : une leçon, puis des exercices corrigés tout de suite."
      />

      <div className="grid items-start gap-8 lg:grid-cols-5">
        {open ? (
          <section aria-labelledby="focus-title" className="space-y-5 rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] lg:col-span-3">
            <div className="flex items-start gap-4">
              <IconBadge icon={PlayCircle} tone="primary" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Série en cours</p>
                <h2 id="focus-title" className="font-article text-2xl font-normal break-words">{label(open.point)}</h2>
                <p className="text-sm text-muted-foreground">
                  {open.answers.length > 0 ? `${open.answers.length} réponse${open.answers.length > 1 ? "s" : ""} déjà donnée${open.answers.length > 1 ? "s" : ""}, tu reprends là où tu en étais.` : "Aucune réponse pour l’instant."}
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href={`/grammaire/${open.id}`}>{canAct ? "Reprendre la série" : "Voir la série"}</Link>
            </Button>
          </section>
        ) : selection ? (
          <section aria-labelledby="focus-title" className="space-y-5 rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] lg:col-span-3">
            <div className="flex items-start gap-4">
              <IconBadge icon={BookOpen} />
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Série conseillée</p>
                <h2 id="focus-title" className="font-article text-2xl font-normal break-words">{label(selection.point)}</h2>
                <p className="text-sm text-muted-foreground">{reasonText(selection)}</p>
              </div>
            </div>
            {canAct ? (
              <StartGrammarButton point={selection.point} label="Commencer" />
            ) : (
              <p className="text-sm text-muted-foreground">Lecture seule : seul le compte élève peut lancer une série.</p>
            )}
          </section>
        ) : (
          <section className="rounded-xl border bg-card p-5 sm:p-6 lg:col-span-3">
            <p className="text-sm text-muted-foreground">Le programme de grammaire de cette langue n’est pas encore prêt.</p>
          </section>
        )}

        <section aria-labelledby="progress-title" className="space-y-3 lg:col-span-2">
          <SectionTitle id="progress-title" aside={<span className="tabular-nums">{points.length} points</span>}>
            Ton avancement
          </SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Validés" value={String(count("mastered"))} hint="maîtrisés" />
            <StatTile label="En cours" value={String(count("practised"))} hint="déjà travaillés" />
            <StatTile label="À voir" value={String(count("todo"))} hint="pas commencés" />
          </div>
        </section>
      </div>

      <section aria-labelledby="programme-title" className="space-y-6">
        <div className="space-y-1">
          <h2 id="programme-title" className="font-article text-xl font-normal">Le programme de l’année</h2>
          <p className="text-sm text-muted-foreground">Les {points.length} points de ton programme, dans l’ordre de l’année. Tu peux t’entraîner sur n’importe lequel.</p>
        </div>

        <div className="grid items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        {periods.map((period) => {
          const current = period.months.includes(month);
          const done = period.points.filter((p) => stateOf(p) === "mastered").length;
          const id = `period-${period.months[0]}`;
          return (
            <section key={id} aria-labelledby={id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 id={id} className="font-article text-lg font-normal">{periodLabel(period.months)}</h3>
                {current && <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Période en cours</span>}
                <span className="ml-auto text-sm whitespace-nowrap tabular-nums text-muted-foreground">
                  {done} sur {period.points.length} validés
                </span>
              </div>
              <ul className="divide-y border-y">
                {period.points.map((p) => {
                  const s = STATE[stateOf(p)];
                  const last = mastery.get(p)?.scores.at(-1);
                  const recommended = !open && p === selection?.point;
                  const openHere = open?.point === p;
                  return (
                    <li key={p} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                      <IconBadge icon={s.icon} tone={s.tone} />
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="font-medium break-words">{label(p)}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.label}
                          {practiced[p] && `, dernière série le ${shortDate(practiced[p])}`}
                          {last && <span className="tabular-nums">{` (${last.score} %)`}</span>}
                          {recommended && ", conseillé maintenant"}
                          {openHere && ", série en cours"}
                        </p>
                      </div>
                      {canAct && !open && <StartGrammarButton point={p} label="S’entraîner" variant={recommended ? "outline" : "ghost"} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        </div>
        <p className="text-sm text-muted-foreground">De mai à août, les séries révisent tout le programme.</p>
      </section>
    </div>
  );
}
