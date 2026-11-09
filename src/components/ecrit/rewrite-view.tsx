import { Check, X } from "lucide-react";
import Link from "next/link";
import { StatTile } from "@/components/dashboard";
import { PageHeader, Panel } from "@/components/page";
import { RewriteForm } from "@/components/rewrite-form";
import { targetLanguage } from "@/lib/profile";
import type { Rewrite } from "@/lib/repo/rewrites";
import type { Subject } from "@/lib/repo/subjects";
import type { ErrorItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

function RewriteResultView({ rewrite, errors }: { rewrite: Rewrite; errors: ErrorItem[] }) {
  const lang = targetLanguage().code;
  const r = rewrite.result;
  return (
    <Panel id="resultat" title="Résultat de ta réécriture" description={r.conseil}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Erreurs corrigées" value={`${r.corrected}/${r.total}`} hint={`soit ${r.rate} % de tes erreurs`} />
        <StatTile label="Nouvelles erreurs" value={String(r.nouvelles.length)} hint={r.nouvelles.length ? "apparues en réécrivant" : "aucune, bravo"} />
      </div>
      <ol className="divide-y border-t text-sm">
        {errors.map((e, i) => {
          const status = r.erreurs.find((x) => x.index === i);
          const fixed = status?.statut === "corrigee";
          return (
            <li key={i} className="flex gap-3 py-3">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-md",
                  fixed ? "bg-primary text-primary-foreground" : "bg-destructive/10 text-destructive",
                )}
              >
                {fixed ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p>
                  <span className={cn("font-medium", fixed ? "text-primary" : "text-destructive")}>{fixed ? "Corrigée" : "Encore là"}</span>{" "}
                  <span lang={lang} className="font-article break-words">« {e.extrait} »</span>
                </p>
                {status?.commentaire && <p className="break-words text-muted-foreground">{status.commentaire}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {r.nouvelles.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">Nouvelles erreurs</h3>
          <ul className="divide-y text-sm">
            {r.nouvelles.map((n, i) => (
              <li key={i} className="space-y-0.5 py-2 break-words first:pt-0 last:pb-0">
                <p lang={lang} className="font-article">
                  <span className="text-destructive line-through">{n.extrait}</span>{" "}
                  <span className="font-medium text-primary">{n.correction}</span>
                </p>
                <p className="text-muted-foreground">{n.explication}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** Page « Réécrire ma copie » : erreurs à reprendre, dernier résultat, formulaire. */
export function RewriteView({
  sessionId, subject, errors, last, initial, canAct,
}: {
  sessionId: string; subject: Subject; errors: ErrorItem[]; last?: Rewrite; initial: string; canAct: boolean;
}) {
  const { code: lang, nameFr } = targetLanguage();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <Link href={`/sessions/${sessionId}`} className="underline-offset-4 hover:text-foreground hover:underline">
            Retour à la correction
          </Link>
        }
        title="Réécrire ma copie"
        description={`Reprends ton texte en ${nameFr} et corrige toi-même les erreurs signalées. Pas de nouvelle note : on mesure la part d’erreurs corrigées.`}
      />

      <div className="grid items-start gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:sticky lg:top-6 lg:col-span-2 lg:col-start-4 lg:row-start-1">
          <Panel title="Erreurs à corriger" actions={<span className="text-sm tabular-nums text-muted-foreground">{errors.length}</span>}>
            <ol className="divide-y text-sm">
              {errors.map((e, i) => (
                <li key={i} className="flex gap-3 py-3 break-words first:pt-0 last:pb-0">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p lang={lang} className="font-article text-base font-medium text-destructive line-through decoration-destructive/70">{e.extrait}</p>
                    <p className="text-muted-foreground">{e.explication}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <details open className="rounded-xl border bg-card">
            <summary className="cursor-pointer p-5 font-article text-xl font-normal">Consigne du sujet</summary>
            <p className="border-t p-5 text-sm whitespace-pre-wrap break-words">{subject.task}</p>
          </details>
        </div>

        <div className="space-y-8 lg:col-span-3 lg:col-start-1 lg:row-start-1">
          {last && <RewriteResultView rewrite={last} errors={errors} />}
          {canAct && errors.length > 0 && <RewriteForm sessionId={sessionId} initial={initial} />}
        </div>
      </div>
    </div>
  );
}
