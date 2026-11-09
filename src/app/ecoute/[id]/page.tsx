import { ArrowLeft, Check, CircleDashed, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatTile } from "@/components/dashboard";
import { listeningMeta } from "@/components/ecoute/meta";
import { ListeningExercise } from "@/components/listening-exercise";
import { ListeningTranscript } from "@/components/listening-transcript";
import { PageHeader, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { slowSpeedAvailable } from "@/lib/listening/period";
import { MAX_PLAYS } from "@/lib/listening/player";
import { splitSentences } from "@/lib/listening/segments";
import { getAttempt, getListening, getSlowSpeedOverride } from "@/lib/repo/listenings";
import { cn } from "@/lib/utils";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

function IdeaList({ title, items, icon: Icon, iconClass }: { title: string; items: string[]; icon: LucideIcon; iconClass: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-medium">
        {title} <span className="font-normal tabular-nums text-muted-foreground">({items.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
            <span className="min-w-0 break-words">{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ListeningAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const attempt = getAttempt((await params).id);
  if (!attempt) notFound();
  const listening = getListening(attempt.listeningId);
  if (!listening) notFound();
  const audioSrc = `/api/listening/${listening.id}/audio`;
  const corrected = attempt.status === "corrected" && !!attempt.result;

  const header = (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/ecoute" className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
            <ArrowLeft aria-hidden className="size-3.5" />
            Écoute
          </Link>
        }
        title={<span lang={getProfile().target.code} className="font-article">{listening.title}</span>}
        description={<span className="tabular-nums">{listeningMeta(listening)}</span>}
        actions={
          corrected ? (
            <Button asChild variant="outline">
              <Link href="/ecoute">Autres exercices</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="measure border-l-2 border-primary py-1 pl-5">
        <h2 className="text-sm font-medium">Mise en situation</h2>
        <p className="mt-1">{listening.context}</p>
      </div>
    </div>
  );

  if (!corrected) {
    // Le script n'est jamais transmis au navigateur avant la correction (spec §15.4).
    return (
      <div className="space-y-8">
        {header}
        <ListeningExercise
          attempt={attempt}
          audioSrc={audioSrc}
          durationSec={listening.durationSec}
          slowSpeed={slowSpeedAvailable(new Date(), getSlowSpeedOverride())}
          readOnly={user.role !== "student"}
        />
      </div>
    );
  }

  const r = attempt.result!;
  const contresens = r.contresens ?? []; // garde contre un résultat incomplet (données de démo), le schéma l'exige
  return (
    <div className="space-y-8">
      {header}

      <section aria-labelledby="result-title" className="space-y-3">
        <h2 id="result-title" className="font-article text-xl font-normal">Ton résultat</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Note"
            value={`${r.note.toLocaleString("fr-FR")}/10`}
            hint={`${attempt.plays} ${attempt.plays > 1 ? "écoutes utilisées" : "écoute utilisée"} sur ${MAX_PLAYS}`}
          />
          {r.conseil && (
            <div className="rounded-xl border bg-card p-4 sm:col-span-2">
              <p className="text-sm text-muted-foreground">Conseil pour la prochaine fois</p>
              <p className="measure mt-1">{r.conseil}</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel id="summary" title="Ton compte rendu">
          <p className="whitespace-pre-wrap break-words">{attempt.summary || <span className="text-muted-foreground">Compte rendu vide.</span>}</p>
        </Panel>
        <Panel id="correction" title="Correction">
          <div className="space-y-4 text-sm">
            {r.comprises.length + r.manquees.length + contresens.length === 0 && (
              <p className="text-muted-foreground">Pas de détail pour cette correction.</p>
            )}
            <IdeaList title="Idées bien comprises" items={r.comprises} icon={Check} iconClass="text-primary" />
            <IdeaList title="Idées manquées" items={r.manquees} icon={CircleDashed} iconClass="text-muted-foreground" />
            {contresens.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">
                  Contresens <span className="font-normal tabular-nums text-muted-foreground">({contresens.length})</span>
                </h3>
                <ul className="space-y-2">
                  {contresens.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <X aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <div className="min-w-0 break-words">
                        <p className="line-through decoration-destructive">{c.idee}</p>
                        <p className="text-muted-foreground">{c.explication}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        id="transcript"
        title="Transcription"
        description="Clique sur une phrase pour la réécouter. Sélectionne un mot pour voir sa définition."
      >
        <ListeningTranscript
          sentences={splitSentences(listening.script)}
          audioSrc={audioSrc}
          listeningId={listening.id}
          title={listening.title}
          readOnly={user.role !== "student"}
        />
      </Panel>
    </div>
  );
}
