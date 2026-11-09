import { BookOpen, Headphones, Newspaper, PenLine } from "lucide-react";
import { IconBadge, PageHeader, Panel } from "@/components/page";
import { PlacementTest, StartPlacementButton } from "@/components/placement-test";
import { requireUser } from "@/lib/auth";
import { pointLabel } from "@/lib/grammar-programme";
import { publicPlacement } from "@/lib/placement/schema";
import { getInProgressPlacement, listDonePlacements, type Placement } from "@/lib/repo/placements";
import { TIERS } from "@/lib/tiers";
import { targetLanguage } from "@/lib/profile";

export const dynamic = "force-dynamic";

const parts = (nameFr: string) => [
  { icon: BookOpen, title: "Grammaire", detail: "20 questions courtes" },
  { icon: Newspaper, title: "Lecture", detail: "Un texte court et 4 questions" },
  { icon: PenLine, title: `Écrit en ${nameFr}`, detail: "Environ 60 mots" },
  { icon: Headphones, title: "Écoute", detail: "3 questions, si un audio est disponible" },
];

function Intro({ canAct, again }: { canAct: boolean; again: boolean }) {
  return (
    <Panel
      id="placement-intro"
      title={again ? "Refaire le test" : "Comment se passe le test"}
      description="20 à 25 minutes, sans dictionnaire. À refaire en janvier et en avril pour mesurer tes progrès."
    >
      <ol className="grid gap-3 sm:grid-cols-2">
        {parts(targetLanguage().nameFr).map((p) => (
          <li key={p.title} className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
            <IconBadge icon={p.icon} />
            <div className="min-w-0">
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-muted-foreground">{p.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {canAct && (
        <div className="border-t pt-4">
          <StartPlacementButton />
        </div>
      )}
    </Panel>
  );
}

function ResultView({ placement }: { placement: Placement }) {
  const r = placement.result!;
  const date = new Date(placement.finishedAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Panel title={`Résultat du ${date}`}>
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-accent/60 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary text-xl font-semibold tabular-nums text-primary-foreground">
          {r.tier}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="font-semibold">{r.startingTier ? "Ton palier de départ" : "Palier suggéré par le test"} : {TIERS[r.tier].label}</p>
          {!r.startingTier && (
            <p className="text-sm text-muted-foreground">Ton palier change seulement si tu acceptes une proposition après tes copies.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Niveau par compétence</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(r.levels).map(([skill, level]) => (
            <div key={skill} className="flex flex-col-reverse gap-1 rounded-xl border p-4">
              <dt className="text-sm text-muted-foreground">{skill}</dt>
              <dd className="font-article text-2xl font-normal tabular-nums">{level}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-6 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Points de grammaire prioritaires</h3>
          {r.priorities.length > 0 ? (
            <ol className="space-y-1.5 text-sm">
              {r.priorities.map((p, i) => (
                <li key={p} className="flex items-center gap-2.5">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  {pointLabel(p)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune erreur de grammaire dans ce test.</p>
          )}
        </div>
        {r.writing.commentaire && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Ton écrit</h3>
            <p className="text-sm text-muted-foreground">{r.writing.commentaire}</p>
          </div>
        )}
      </div>
      {r.listeningSkipped && (
        <p className="text-sm text-muted-foreground">Partie écoute non faite : aucun audio n’était disponible.</p>
      )}
    </Panel>
  );
}

export default async function PositionnementPage() {
  const user = await requireUser();
  const canAct = user.role === "student";
  const open = getInProgressPlacement();
  const last = listDonePlacements().at(-1);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Test de positionnement"
        description={
          open
            ? "Réponds sans dictionnaire et sans te presser. Tes réponses sont enregistrées au fur et à mesure."
            : "Il règle ton palier et tes priorités de grammaire."
        }
      />
      {open ? (
        <PlacementTest id={open.id} content={publicPlacement(open.content)} saved={open.answers} canAct={canAct} />
      ) : (
        <>
          {last && <ResultView placement={last} />}
          {(canAct || !last) && <Intro canAct={canAct} again={Boolean(last)} />}
        </>
      )}
    </div>
  );
}
