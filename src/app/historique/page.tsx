import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ACTIVITY_ICONS, StatTile } from "@/components/dashboard";
import { formatNote, GradeBadge } from "@/components/grade-badge";
import { EmptyState, IconBadge, PageHeader, Panel } from "@/components/page";
import { ScoreChart } from "@/components/score-chart";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listCorrectedAttempts } from "@/lib/repo/listenings";
import { listCorrected } from "@/lib/repo/sessions";
import { reviewStats } from "@/lib/review";
import { TIERS } from "@/lib/tiers";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

const total = (e: { result?: { compte_rendu: { note: number }; expression: { note: number } } }) =>
  (e.result?.compte_rendu.note ?? 0) + (e.result?.expression.note ?? 0);
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function HistoryRow({ href, icon, title, meta, grade, lang }: { href: string; icon: typeof ACTIVITY_ICONS.writing; title: string; meta: string; grade: React.ReactNode; lang?: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-4 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <IconBadge icon={icon} tone="muted" />
        <div className="min-w-0 flex-1">
          <p lang={lang} className="font-medium break-words">{title}</p>
          <p className="text-sm text-muted-foreground">{meta}</p>
        </div>
        {grade}
        <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground sm:block" />
      </Link>
    </li>
  );
}

export default async function HistoriquePage() {
  await requireUser();
  const lang = getProfile().target.code;
  const entries = listCorrected();
  const listenings = listCorrectedAttempts();
  const stats = reviewStats();
  const totals = entries.map(total);
  const last = totals.at(-1);
  const lastListening = listenings[0]?.result?.note;

  return (
    <div className="space-y-10">
      <PageHeader title="Historique" description="Tes copies et tes écoutes corrigées, de la plus récente à la plus ancienne. Ouvre une ligne pour relire la correction." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Dernière copie" value={last !== undefined ? `${formatNote(last)}/20` : ""} hint={`${entries.length} ${entries.length > 1 ? "copies corrigées" : "copie corrigée"}`} />
        <StatTile label="Meilleure copie" value={totals.length ? `${formatNote(Math.max(...totals))}/20` : ""} hint="sur toutes tes copies" />
        <StatTile label="Dernière écoute" value={lastListening !== undefined ? `${formatNote(lastListening)}/10` : ""} hint={`${listenings.length} ${listenings.length > 1 ? "écoutes corrigées" : "écoute corrigée"}`} />
        <StatTile
          label="Mots acquis"
          value={String(stats.acquired)}
          hint={stats.successRate7d !== null ? `réussite en révision sur 7 jours : ${Math.round(stats.successRate7d * 100)} %` : "en révision"}
        />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={ACTIVITY_ICONS.writing}
          title="Aucune copie corrigée pour l’instant"
          description="Ta courbe de notes et la liste de tes copies apparaîtront ici après ta première correction."
          action={
            <Button asChild size="sm">
              <Link href="/ecrit">Commencer un sujet</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Panel className="graph-paper" title="Notes des copies" description="Ta note sur 20 à chaque copie corrigée. La ligne pointillée marque 12/20.">
            <ScoreChart points={entries.map((e) => ({ total: total(e), tier: e.tier, isMock: e.isMock, label: e.subjectTitle, date: e.correctedAt }))} />
          </Panel>

          <section aria-labelledby="copies-title" className="space-y-3">
            <h2 id="copies-title" className="font-article text-xl font-normal">Copies</h2>
            <ul className="divide-y border-y">
              {[...entries].reverse().map((e) => (
                <HistoryRow
                  key={e.id}
                  href={`/sessions/${e.id}`}
                  icon={e.isMock ? ACTIVITY_ICONS.mock : ACTIVITY_ICONS.writing}
                  title={e.subjectTitle}
                  lang={lang}
                  meta={`${day(e.correctedAt!)}, ${e.isMock ? "Examen blanc" : TIERS[e.tier].label}`}
                  grade={<GradeBadge value={total(e)} max={20} />}
                />
              ))}
            </ul>
          </section>
        </>
      )}

      {listenings.length > 0 && (
        <section aria-labelledby="listenings-title" className="space-y-3">
          <h2 id="listenings-title" className="font-article text-xl font-normal">Écoutes</h2>
          <ul className="divide-y border-y">
            {listenings.map((a) => (
              <HistoryRow
                key={a.id}
                href={`/ecoute/${a.id}`}
                icon={ACTIVITY_ICONS.listening}
                title={a.title}
                lang={lang}
                meta={a.plays > 0 ? `${day(a.correctedAt!)}, ${a.plays} ${a.plays > 1 ? "écoutes" : "écoute"}` : day(a.correctedAt!)}
                grade={<GradeBadge value={a.result!.note} max={10} />}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
