import { ChevronDown, Lightbulb } from "lucide-react";
import Link from "next/link";
import { AnnotatedText } from "@/components/annotated-text";
import { ACTIVITY_ICONS, StatTile } from "@/components/dashboard";
import { InkCircle } from "@/components/ink";
import { IconBadge, PageHeader, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { targetLanguage } from "@/lib/profile";
import type { Rewrite } from "@/lib/repo/rewrites";
import type { Session } from "@/lib/repo/sessions";
import type { Subject } from "@/lib/repo/subjects";
import { ERROR_TYPES, type Correction } from "@/lib/schemas";
import { TIERS } from "@/lib/tiers";

const formatNote = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Page de correction : note, conseil, copie annotée, version améliorée, vocabulaire, suite. */
export function ResultView({
  session, subject, result: r, rewrite, canRewrite,
}: {
  session: Session; subject: Subject; result: Correction; rewrite?: Rewrite; canRewrite: boolean;
}) {
  const { code: lang, nameFr } = targetLanguage();
  const total = r.compte_rendu.note + r.expression.note;
  const errors = r.expression.erreurs;
  const byType = ERROR_TYPES.map((t) => [t, errors.filter((e) => e.type === t).length] as const).filter(([, n]) => n > 0);
  const eyebrow = [TIERS[session.tier].label, session.isMock && "examen blanc", session.examMode && !session.isMock && "mode examen"]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Correction, ${eyebrow}`}
        title={<span lang={lang} className="font-article">{subject.title}</span>}
        actions={
          <InkCircle className="mr-4 mb-2 -rotate-6 font-article text-4xl text-primary tabular-nums">
            <span>
              {formatNote(total)}
              <span className="text-lg">/20</span>
            </span>
          </InkCircle>
        }
      />

      <section aria-label="Notes" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Niveau estimé" value={r.expression.niveau} hint={`note globale ${formatNote(total)}/20`} />
        <StatTile label="Compte rendu" value={`${formatNote(r.compte_rendu.note)}/10`} hint="en français" />
        <StatTile label={`Écrit en ${nameFr}`} value={`${formatNote(r.expression.note)}/10`} hint="expression personnelle" />
        <StatTile
          label="Erreurs relevées"
          value={String(errors.length)}
          hint={rewrite ? `${rewrite.result.corrected} corrigées au second jet` : errors.length ? "à corriger en réécrivant" : "rien à reprendre"}
        />
      </section>

      <div className="flex gap-4 border-l-2 border-primary py-1 pl-5">
        <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 space-y-1">
          <h2 className="font-article text-xl font-normal">Le conseil pour ta prochaine copie</h2>
          <p className="measure break-words">{r.conseil}</p>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <Panel
            id="copie"
            title={`Ta copie en ${nameFr}`}
            description={errors.length ? "Barré : ce que tu as écrit. En vert : la correction. Touche une correction pour lire l’explication." : undefined}
          >
            {byType.length > 0 && (
              <ul aria-label="Erreurs par type" className="flex flex-wrap gap-1.5">
                {byType.map(([t, n]) => (
                  <li key={t} className="rounded-md bg-muted px-2 py-0.5 text-sm">
                    {t} <span className="tabular-nums text-muted-foreground">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-lg">
              <AnnotatedText text={session.pe} errors={errors} />
            </div>
          </Panel>

          <details className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 space-y-1">
                <span className="block font-article text-xl font-normal">Version améliorée</span>
                <span className="block text-sm text-muted-foreground">
                  {rewrite || !canRewrite ? "Ta copie reformulée par le correcteur." : "Conseil : réécris d’abord ta copie, puis compare."}
                </span>
              </span>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p lang={lang} className="font-article measure border-t p-5 text-lg leading-relaxed whitespace-pre-wrap break-words">
              {r.expression.version_amelioree}
            </p>
          </details>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Panel title={`Compte rendu, ${formatNote(r.compte_rendu.note)}/10`}>
            <p className="text-sm break-words">{r.compte_rendu.commentaire}</p>
            {r.compte_rendu.idees_manquantes.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Idées oubliées</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {r.compte_rendu.idees_manquantes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {r.expression.points_forts.length > 0 && (
            <Panel title="Points forts">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {r.expression.points_forts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Vocabulaire"
            description="Ces mots sont ajoutés à tes révisions."
            actions={
              <Link href="/vocabulaire" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Les gérer
              </Link>
            }
          >
            <dl className="divide-y">
              {r.vocabulaire.map((v) => (
                <div key={v.en} className="space-y-0.5 py-2.5 first:pt-0 last:pb-0">
                  <dt lang={lang} className="font-medium break-words">{v.en}</dt>
                  <dd className="text-sm text-muted-foreground">
                    {v.fr}
                    {v.exemple && (
                      <span lang={lang} className="block italic break-words">
                        {v.exemple}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      <section aria-labelledby="next-title" className="space-y-3">
        <h2 id="next-title" className="font-article text-xl font-normal">Et maintenant ?</h2>
        <ul className="divide-y border-y">
          {(canRewrite || rewrite) && (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
              <IconBadge icon={ACTIVITY_ICONS.rewrite} tone={rewrite ? "primary" : "accent"} />
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium">{rewrite ? "Second jet fait" : "Réécrire ma copie"}</p>
                <p className="text-sm text-muted-foreground">
                  {rewrite
                    ? `${plural(rewrite.result.corrected, "erreur corrigée", "erreurs corrigées")} sur ${rewrite.result.total} (${rewrite.result.rate} %).`
                    : "Corrige toi-même tes erreurs : c’est comme ça qu’elles restent."}
                </p>
              </div>
              <Button asChild size="sm" variant={rewrite ? "outline" : "default"}>
                <Link href={`/sessions/${session.id}/reecrire`}>{rewrite ? "Voir" : "Réécrire"}</Link>
              </Button>
            </li>
          )}
          <li className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
            <IconBadge icon={ACTIVITY_ICONS.writing} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">Nouveau sujet</p>
              <p className="text-sm text-muted-foreground">Un autre article, une autre copie.</p>
            </div>
            <Button asChild size="sm" variant={canRewrite && !rewrite ? "outline" : "default"}>
              <Link href="/ecrit">Choisir</Link>
            </Button>
          </li>
        </ul>
      </section>
    </div>
  );
}
