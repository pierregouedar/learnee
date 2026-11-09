import { CalendarDays, Lightbulb } from "lucide-react";
import Link from "next/link";
import { ACTIVITY_ICONS, StatTile } from "@/components/dashboard";
import { formatNote, GradeBadge } from "@/components/grade-badge";
import { EmptyState, IconBadge, PageHeader, Panel } from "@/components/page";
import { requireUser } from "@/lib/auth";
import { pointLabel } from "@/lib/grammar-programme";
import { buildWeeklyReport, latestAdvice } from "@/lib/services/weekly-report";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default async function BilanPage() {
  await requireUser(); // compte élève et compte « lecture seule »
  const now = new Date();
  const r = buildWeeklyReport(now);
  const advice = latestAdvice(now);
  const empty = !r.writing.length && !r.listening.length && !r.grammar.length && !r.rewrites.length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Du ${day(r.from)} au ${day(r.to)}`}
        title="Bilan de la semaine"
        description="Ce que tu as fait ces 7 derniers jours et ce qui reste à travailler."
        actions={
          <Link href="/vocabulaire" className="rounded-lg border bg-card px-3 py-1.5 text-sm tabular-nums transition-colors hover:bg-muted">
            {plural(r.wordsAcquired, "mot acquis", "mots acquis")} au total
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Sujets écrits" value={String(r.writing.length)} hint={r.writing.length ? `moyenne ${formatNote(avg(r.writing.map((w) => w.total)))}/20` : "aucun cette semaine"} />
        <StatTile label="Écoutes" value={String(r.listening.length)} hint={r.listening.length ? `notes : ${r.listening.map((n) => `${formatNote(n)}/10`).join(", ")}` : "aucune cette semaine"} />
        <StatTile label="Séries de grammaire" value={String(r.grammar.length)} hint={r.grammar.length ? `moyenne ${Math.round(avg(r.grammar.map((g) => g.score)))} %` : "aucune cette semaine"} />
        <StatTile
          label="Réécritures"
          value={String(r.rewrites.length)}
          hint={r.rewrites.length ? `erreurs corrigées : ${r.rewrites.map((x) => `${x} %`).join(", ")}` : "aucune cette semaine"}
        />
      </div>

      {advice && (
        <section aria-labelledby="advice-title" className="flex gap-4 border-l-2 border-primary py-1 pl-5">
          <IconBadge icon={Lightbulb} tone="primary" />
          <div className="min-w-0 space-y-1">
            <h2 id="advice-title" className="font-article text-xl font-normal">À travailler à l’oral cette semaine</h2>
            <p className="measure">{advice}</p>
          </div>
        </section>
      )}

      {empty ? (
        <EmptyState
          icon={CalendarDays}
          title="Rien de corrigé cette semaine"
          description="Tes copies, écoutes, séries de grammaire et réécritures des 7 derniers jours apparaîtront ici."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {r.writing.length > 0 && (
            <Panel title="Sujets écrits">
              <ul className="-mx-6 -mb-6 divide-y border-t">
                {r.writing.map((w, i) => (
                  <li key={i} className="flex items-center gap-4 px-6 py-3">
                    <IconBadge icon={w.isMock ? ACTIVITY_ICONS.mock : ACTIVITY_ICONS.writing} tone="muted" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{w.title}</p>
                      {w.isMock && <p className="text-sm text-muted-foreground">Examen blanc</p>}
                    </div>
                    <GradeBadge value={w.total} max={20} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {r.grammar.length > 0 && (
            <Panel title="Séries de grammaire">
              <ul className="-mx-6 -mb-6 divide-y border-t">
                {r.grammar.map((g, i) => (
                  <li key={i} className="flex items-center gap-4 px-6 py-3">
                    <IconBadge icon={ACTIVITY_ICONS.grammar} tone="muted" />
                    <p className="min-w-0 flex-1 font-medium break-words">{pointLabel(g.point)}</p>
                    <span
                      className={cn(
                        "shrink-0 font-article text-xl tabular-nums",
                        g.score >= 60 ? "text-primary" : "text-foreground",
                      )}
                    >
                      {g.score} %
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Panel title="Points à surveiller" description="Erreurs qui reviennent au moins deux fois dans tes copies, et séries de grammaire sous 60 %.">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm text-muted-foreground">Erreurs récurrentes</h3>
            {r.recurringErrors.length ? (
              <ul className="space-y-1.5">
                {r.recurringErrors.map((e) => (
                  <li key={e.label} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="break-words">{e.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{e.count} fois</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">Aucune</p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm text-muted-foreground">Points de grammaire en difficulté</h3>
            {r.weakPoints.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {r.weakPoints.map((p) => (
                  <li key={p} className="rounded-md bg-muted px-2 py-0.5 text-sm">
                    {pointLabel(p)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">Aucun</p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
