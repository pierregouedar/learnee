import { Headphones } from "lucide-react";
import { domainLabels } from "@/lib/profile";
import Link from "next/link";
import { Sparkline, StatTile } from "@/components/dashboard";
import { GradeBadge } from "@/components/grade-badge";
import { listeningMeta } from "@/components/ecoute/meta";
import { ListeningNew, StartListening } from "@/components/listening-new";
import { EmptyState, IconBadge, PageHeader, SectionTitle } from "@/components/page";
import { Button } from "@/components/ui/button";
import { hasElevenLabs } from "@/lib/audio/elevenlabs";
import { requireUser } from "@/lib/auth";
import { MAX_PLAYS } from "@/lib/listening/player";
import { listCorrectedAttempts, listReadyListenings } from "@/lib/repo/listenings";
import { targetLanguage } from "@/lib/profile";

export const dynamic = "force-dynamic";

const note = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default async function EcoutePage() {
  const user = await requireUser();
  const readOnly = user.role !== "student";
  const { code: lang, nameFr } = targetLanguage();
  const ready = listReadyListenings();
  const done = listCorrectedAttempts();
  // done est trié du plus récent au plus ancien ; la courbe se lit de gauche (ancien) à droite (récent).
  const notes = done.slice(0, 8).map((a) => a.result!.note).reverse();
  const last = done[0];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Écoute"
        description={`Écoute un document en ${nameFr} (${MAX_PLAYS} écoutes au maximum), prends des notes, puis résume-le en français. La transcription s’affiche après la correction.`}
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <section aria-labelledby="ready-title" className="space-y-3 lg:col-span-3">
          <SectionTitle id="ready-title" aside={ready.length > 0 ? `${ready.length} prêt${ready.length > 1 ? "s" : ""}` : undefined}>
            Exercices prêts
          </SectionTitle>
          {ready.length === 0 ? (
            <EmptyState
              icon={Headphones}
              title="Aucun exercice prêt pour le moment"
              description={
                readOnly
                  ? "Deux nouveaux exercices sont préparés chaque semaine."
                  : "Deux nouveaux exercices sont préparés chaque semaine. Tu peux aussi en créer un avec « Nouvel exercice »."
              }
            />
          ) : (
            <ul className="divide-y border-y">
              {ready.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                  <IconBadge icon={Headphones} />
                  <div className="min-w-0 flex-1 basis-48">
                    <p lang={lang} className="font-medium break-words">{l.title}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{listeningMeta(l)}</p>
                  </div>
                  {!readOnly && (
                    <div className="ml-auto">
                      <StartListening listeningId={l.id} variant={i === 0 ? "default" : "outline"} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-8 lg:col-span-2">
          <section aria-labelledby="results-title" className="space-y-3">
            <h2 id="results-title" className="font-article text-xl font-normal">Tes résultats</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Dernière note"
                value={last ? `${note(last.result!.note)}/10` : ""}
                hint={last ? `le ${new Date(last.correctedAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "aucune écoute corrigée"}
              >
                <Sparkline values={notes} max={10} label={`Notes des dernières écoutes : ${notes.map(note).join(", ")} sur 10`} />
              </StatTile>
              <StatTile label="Écoutes corrigées" value={String(done.length)} hint="depuis le début" />
            </div>
          </section>

          {!readOnly && <ListeningNew audioEnabled={hasElevenLabs()} domains={domainLabels()} />}
        </div>
      </div>

      {done.length > 0 && (
        <section aria-labelledby="done-title" className="space-y-3">
          <SectionTitle id="done-title">Exercices corrigés</SectionTitle>
          <ul className="divide-y border-y">
            {done.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                <IconBadge icon={Headphones} tone="muted" />
                <div className="min-w-0 flex-1 basis-48">
                  <p lang={lang} className="font-medium break-words">{a.title}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    Corrigé le {new Date(a.correctedAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })},{" "}
                    {a.plays} {a.plays > 1 ? "écoutes" : "écoute"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <GradeBadge value={a.result!.note} max={10} />
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/ecoute/${a.id}`} aria-label={`Revoir la correction : ${a.title}`}>Revoir</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
