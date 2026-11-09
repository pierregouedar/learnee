import { BookOpen, Check, FilePen, Headphones, Layers, PenLine, Shuffle, Timer, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { InkCircle } from "@/components/ink";
import { ScoreChart } from "@/components/score-chart";
import { Button } from "@/components/ui/button";
import { annotate } from "@/lib/annotate";
import type { Activity, Dashboard, GrammarState, WeekDay } from "@/lib/services/dashboard";
import { STREAK, UP_THRESHOLD, upStreak } from "@/lib/tier-rules";
import { TIERS, type Tier } from "@/lib/tiers";
import { DAY_LABELS } from "@/lib/week-plan";
import { cn } from "@/lib/utils";

export const ACTIVITY_ICONS: Record<Activity, LucideIcon> = {
  writing: PenLine,
  grammar: BookOpen,
  listening: Headphones,
  rewrite: FilePen,
  choice: Shuffle,
  review: Layers,
  mock: Timer,
};

const ACTIVITY_LABELS: Record<Activity, string> = {
  writing: "Sujet écrit",
  grammar: "Grammaire",
  listening: "Écoute",
  rewrite: "Réécriture",
  choice: "Au choix",
  review: "Révisions",
  mock: "Examen blanc",
};

/** Titre de section du cahier : serif, sans graisse, comme un intitulé écrit à la main. */
export const SECTION_TITLE = "font-article text-xl font-normal";
const QUIET_LINK = "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

const TIER_NAMES: Record<Tier, string> = { 1: "Guidé", 2: "Intermédiaire", 3: "Format examen" };
const range = ([a, b]: readonly [number, number]) => `${a} à ${b}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const grade = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <section aria-labelledby="week-title" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="week-title" className={SECTION_TITLE}>Ta semaine</h2>
        <Link href="/profil" className={QUIET_LINK}>
          Modifier
        </Link>
      </div>
      <ol className="grid grid-cols-7 divide-x border-y">
        {week.map((day) => {
          const date = new Date(day.date);
          return (
            <li key={day.key} aria-current={day.isToday ? "date" : undefined} className={cn("flex min-h-28 flex-col items-center gap-3 px-1 py-4", day.isPast && "opacity-60")}>
              <span className="text-xs text-muted-foreground">
                <span className="sm:hidden">{DAY_LABELS[day.key].slice(0, 1)}</span>
                <span className="hidden sm:inline">{DAY_LABELS[day.key].slice(0, 3)}.</span>
              </span>
              <span className="font-article text-2xl tabular-nums">{day.isToday ? <InkCircle className="min-w-[1.6em]">{date.getDate()}</InkCircle> : date.getDate()}</span>
              {day.planned.length === 0 ? (
                <span className="mt-auto text-xs text-muted-foreground">Repos</span>
              ) : (
                <ul className="mt-auto flex flex-wrap justify-center gap-1.5">
                  {day.planned.map((task) => {
                    const Icon = ACTIVITY_ICONS[task];
                    const done = day.done.includes(task);
                    return (
                      <li key={task} title={`${ACTIVITY_LABELS[task]}${done ? " : fait" : ""}`}>
                        {done ? <Check aria-hidden className="size-4 text-primary" /> : <Icon aria-hidden className="size-4 text-muted-foreground" />}
                        <span className="sr-only">
                          {ACTIVITY_LABELS[task]}
                          {done ? " (fait)" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function StatTile({ label, value, hint, children, className }: { label: string; value: string; hint: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 border-t pt-3", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      {value ? (
        <p className="font-article text-3xl font-normal tabular-nums">{value}</p>
      ) : (
        <p className="py-1.5 text-lg text-muted-foreground">Pas encore</p>
      )}
      {children}
      <p className="mt-auto pt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Une série, la tendance et pas le détail (le détail est dans l'historique) : l'échelle suit les notes, ±1 point. */
export function Sparkline({ values, max, label }: { values: number[]; max: number; label: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const lo = Math.max(0, Math.min(...values) - 1);
  const hi = Math.min(max, Math.max(...values) + 1);
  const y = (v: number) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, y(v)] as const);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full max-w-32 text-primary" role="img" aria-label={label}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3" fill="currentColor" stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}

// Corrections montrées sur l'aperçu : deux suffisent à donner l'idée, la copie complète est à un clic.
const SHEET_MARKS = 2;

/** La dernière copie comme une feuille rendue : lignes de cahier, marge, erreurs barrées et corrigées à l'encre, note entourée. */
export function CopySheet({ copy, change, lang }: { copy?: Dashboard["lastCopy"]; change?: string; lang: string }) {
  if (!copy) {
    return (
      <figure className="rounded-xl border bg-card">
        <div className="ruled relative h-40 pl-14">
          <span aria-hidden className="absolute inset-y-0 left-10 w-px bg-primary/25" />
          <p className="pr-6 leading-8 text-muted-foreground">Ta première copie corrigée apparaîtra ici, annotée.</p>
        </div>
      </figure>
    );
  }
  const { segments } = annotate(copy.excerpt, copy.errors.map((e) => e.extrait));
  return (
    <figure className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <figcaption className="flex items-start justify-between gap-6 px-6 pt-5 pb-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Ta dernière copie, corrigée le {shortDate(copy.at)}</p>
          <p lang={lang} className="font-article text-lg leading-snug break-words">
            {copy.title}
          </p>
          {change && <p className="text-xs text-muted-foreground">{change}</p>}
        </div>
        <InkCircle className="mt-3 mr-3 shrink-0 -rotate-6 font-article text-3xl text-primary tabular-nums">
          <span>
            {grade(copy.total)}
            <span className="text-base">/20</span>
          </span>
        </InkCircle>
      </figcaption>
      <div className="ruled relative border-t pr-6 pb-8 pl-14">
        <span aria-hidden className="absolute inset-y-0 left-10 w-px bg-primary/25" />
        <p lang={lang} className="font-article leading-8 break-words">
          {segments.map((seg, i) => {
            const err = seg.errorIndex !== undefined && seg.errorIndex < SHEET_MARKS ? copy.errors[seg.errorIndex] : undefined;
            if (!err) return <span key={i}>{seg.text}</span>;
            return (
              <span key={i}>
                <del className="text-muted-foreground decoration-primary decoration-[1.5px]">{seg.text}</del>{" "}
                <ins className="text-primary no-underline">{err.correction}</ins>
              </span>
            );
          })}
        </p>
      </div>
      <div className="flex justify-end border-t px-6 py-3">
        <Link href={`/sessions/${copy.id}`} className={QUIET_LINK}>
          Relire toute la correction
        </Link>
      </div>
    </figure>
  );
}

/** Chiffres de progrès en registre : une ligne par chiffre, libellé à gauche, valeur en serif à droite. */
export function Ledger({ rows }: { rows: { label: string; value: string; hint: string }[] }) {
  return (
    <dl className="divide-y border-y">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
          <dt className="min-w-0">
            <span className="block text-sm">{r.label}</span>
            <span className="block text-xs text-muted-foreground">{r.hint}</span>
          </dt>
          <dd className={cn("shrink-0 font-article tabular-nums", r.value ? "text-2xl" : "text-base text-muted-foreground")}>{r.value || "Pas encore"}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATE_STYLE: Record<GrammarState, string> = {
  mastered: "bg-primary",
  practised: "bg-primary/35",
  todo: "bg-muted-foreground/20",
};
const STATE_LABEL: Record<GrammarState, string> = { mastered: "Validé", practised: "En cours", todo: "À voir" };

export function GrammarProgramme({ grammar }: { grammar: Dashboard["grammar"] }) {
  const count = (s: GrammarState) => grammar.points.filter((p) => p.state === s).length;
  const next = grammar.points.find((p) => p.point === grammar.next)!;
  const practised = grammar.points.filter((p) => p.state === "practised");
  return (
    <section aria-labelledby="grammar-title" className="space-y-5 border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="grammar-title" className={SECTION_TITLE}>Programme de grammaire</h2>
        <p className="text-sm tabular-nums text-muted-foreground">
          {count("mastered")} validés sur {grammar.points.length}
        </p>
      </div>
      <ol className="flex h-2 gap-0.5" aria-label="Avancement point par point">
        {grammar.points.map((p) => (
          <li key={p.point} title={`${p.label} : ${STATE_LABEL[p.state].toLowerCase()}`} className={cn("flex-1 first:rounded-l-full last:rounded-r-full", STATE_STYLE[p.state], p.point === grammar.next && "outline-2 outline-offset-2 outline-primary")}>
            <span className="sr-only">
              {p.label} : {STATE_LABEL[p.state]}
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {(["mastered", "practised", "todo"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", STATE_STYLE[s])} />
            {STATE_LABEL[s]} <span className="tabular-nums">({count(s)})</span>
          </li>
        ))}
      </ul>
      {practised.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">En cours : </span>
          {practised.map((p) => p.label).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Prochain point conseillé : </span>
          <span className="font-medium">{next.label}</span>
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/grammaire">Voir le programme</Link>
        </Button>
      </div>
    </section>
  );
}

export function ErrorsToWork({ errors }: { errors: Dashboard["errors"] }) {
  const max = Math.max(1, ...errors.map((e) => e.count));
  return (
    <section aria-labelledby="errors-title" className="space-y-5 border-t pt-6">
      <div className="space-y-1">
        <h2 id="errors-title" className={SECTION_TITLE}>À travailler</h2>
        <p className="text-sm text-muted-foreground">Tes erreurs les plus fréquentes dans tes copies des 30 derniers jours.</p>
      </div>
      {errors.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien à signaler pour l’instant : corrige une copie pour voir apparaître tes points faibles.</p>
      ) : (
        <ul className="space-y-3">
          {errors.map((e, i) => (
            <li key={e.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="break-words">{e.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{e.count} fois</span>
              </div>
              <div aria-hidden className={cn("h-1 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/25")} style={{ width: `${(e.count / max) * 100}%` }} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ton parcours : la courbe des notes sur papier millimétré, la série vers le palier suivant, puis la frise des 3 paliers. */
export function TierTimeline({ tier, exam = true, notes }: { tier: Dashboard["tier"]; exam?: boolean; notes?: Dashboard["writing"]["notes"] }) {
  const since = (t: Tier) => [...tier.history].reverse().find((h) => h.tier === t)?.from;
  const leftAt = (t: Tier) => {
    const i = tier.history.findLastIndex((h) => h.tier === t);
    return i >= 0 ? tier.history[i + 1]?.from : undefined;
  };
  const streak = upStreak(tier.recent);
  const missing = STREAK - streak;
  const hasChart = Boolean(notes?.length);
  return (
    <section aria-labelledby="tiers-title" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="tiers-title" className={SECTION_TITLE}>Ton parcours</h2>
        <p className="text-sm text-muted-foreground">{exam ? "3 paliers jusqu’au format de l’examen" : "3 paliers jusqu’à ton objectif"}</p>
      </div>
      {(hasChart || tier.current < 3) && (
        <div className={cn("grid gap-10", hasChart && "lg:grid-cols-5")}>
          {hasChart && (
            <figure className="graph-paper space-y-4 rounded-xl border bg-card p-6 lg:col-span-3">
              <figcaption className="text-sm text-muted-foreground">Tes dernières copies, notées sur 20</figcaption>
              <ScoreChart points={notes!.map((n) => ({ total: n.total, tier: tier.current, isMock: false, label: n.title, date: n.at }))} />
            </figure>
          )}
          {tier.current < 3 && (
            <div className={cn("flex flex-col justify-center gap-5", hasChart && "lg:col-span-2")}>
              <p className="text-sm text-muted-foreground">Passage au palier {tier.current + 1}</p>
              <p className="font-article text-5xl font-normal tabular-nums">
                {streak} <span className="text-2xl text-muted-foreground">sur {STREAK}</span>
              </p>
              <p className="text-sm">copies d’affilée à {UP_THRESHOLD}/20 ou plus</p>
              <ol className="flex items-center gap-8 py-2" aria-label="Dernières copies du palier">
                {Array.from({ length: STREAK }, (_, k) => tier.recent[k]).map((n, k) => (
                  <li key={k} className="font-article text-xl tabular-nums">
                    {n === undefined ? (
                      <span className="inline-block w-12 border-b border-dashed border-muted-foreground/60">
                        <span className="sr-only">Pas encore de copie</span>
                      </span>
                    ) : k >= tier.recent.length - streak ? (
                      <InkCircle className="text-primary">{grade(n)}</InkCircle>
                    ) : (
                      <span className="text-muted-foreground">{grade(n)}</span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-sm text-muted-foreground">
                {missing > 0
                  ? `Encore ${missing} ${missing > 1 ? "copies" : "copie"} à ${UP_THRESHOLD}/20 ou plus, sans note plus basse entre elles.`
                  : "Le passage au palier suivant te sera proposé."}
              </p>
            </div>
          )}
        </div>
      )}
      <ol className="grid gap-x-8 md:grid-cols-3">
        {([1, 2, 3] as const).map((t) => {
          const state = t < tier.current ? "past" : t === tier.current ? "current" : "next";
          const cfg = TIERS[t];
          return (
            <li
              key={t}
              aria-current={state === "current" ? "step" : undefined}
              className={cn("flex flex-col gap-2 pb-5", state === "next" ? "border-t pt-[22px]" : cn("border-t-[3px] pt-5", state === "current" ? "border-primary" : "border-primary/40"))}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p>
                  <span className="block text-xs text-muted-foreground">Palier {t}</span>
                  <span className="font-article text-lg">{TIER_NAMES[t]}</span>
                </p>
                <span className={cn("text-xs", state === "current" ? "font-medium text-primary" : "text-muted-foreground")}>
                  {state === "past" ? "Passé" : state === "current" ? "Actuel" : "À venir"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Articles de {range(cfg.articleWords)} mots, écrit de {range(cfg.peWords)} mots,{" "}
                {cfg.crWords ? `compte rendu de ${range(cfg.crWords)} mots.` : "compte rendu guidé par des questions."}
              </p>
              <p className="text-sm text-muted-foreground">
                {state === "past" && (leftAt(t) ? `Terminé le ${shortDate(leftAt(t)!)}.` : "Terminé.")}
                {state === "current" && (since(t) ? `Depuis le ${shortDate(since(t)!)}.` : "Ton palier de départ.")}
                {state === "next" && (t === tier.current + 1 ? `Après ${STREAK} copies d’affilée à ${UP_THRESHOLD}/20 ou plus.` : `Après le palier ${t - 1}.`)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function NewsPanel({ news, domains, lang }: { news: Dashboard["news"]; domains: Record<string, string>; lang: string }) {
  return (
    <section aria-labelledby="news-title" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="news-title" className={SECTION_TITLE}>Actualités du jour</h2>
        <Link href="/ecrit" className={QUIET_LINK}>
          Tous les sujets
        </Link>
      </div>
      {news.length === 0 ? (
        <p className="border-y py-4 text-sm text-muted-foreground">Ouvre Écrit pour voir les titres du jour : l’article est rédigé quand tu en choisis un.</p>
      ) : (
        <ul className="divide-y border-y">
          {news.map((n) => (
            <li key={n.id}>
              <Link href="/ecrit" className="group block space-y-1 py-3">
                <span lang={lang} className="block font-article leading-snug break-words underline-offset-4 group-hover:underline">
                  {n.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {[domains[n.domain] ?? n.domain, n.source, n.publishedAt && !Number.isNaN(Date.parse(n.publishedAt)) ? shortDate(n.publishedAt) : null]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
