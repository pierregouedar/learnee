import { ArrowLeft, CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { GrammarLesson } from "@/components/grammar-lesson";
import { GrammarRunner } from "@/components/grammar-runner";
import { requireUser } from "@/lib/auth";
import { pointLabel } from "@/lib/grammar-programme";
import { getProfile } from "@/lib/profile";
import { getAttempt, getLesson, listItems, toPublicItem, type GrammarAnswer, type PublicItem } from "@/lib/repo/grammar";

export const dynamic = "force-dynamic";

export default async function GrammarAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const attempt = getAttempt((await params).id);
  if (!attempt) notFound();
  const items = listItems(attempt.setId).map(toPublicItem);
  const lesson = getLesson(attempt.setId);
  const lang = getProfile().target.code;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={
          <Link href="/grammaire" className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
            <ArrowLeft aria-hidden className="size-4" />
            Grammaire
          </Link>
        }
        title={pointLabel(attempt.point)}
      />
      {user.role === "student" ? (
        <GrammarRunner
          attemptId={attempt.id}
          items={items}
          answered={attempt.answers.map((a) => a.itemId)}
          score={attempt.score}
          finished={Boolean(attempt.finishedAt)}
          lesson={lesson}
        />
      ) : (
        <>
          {lesson && <GrammarLesson lesson={lesson} lang={lang} />}
          <ReadOnlyAttempt items={items} answers={attempt.answers} score={attempt.score} finished={Boolean(attempt.finishedAt)} />
        </>
      )}
    </div>
  );
}

// Vue lecture seule : la bonne réponse n'apparaît que pour les questions déjà répondues.
function ReadOnlyAttempt({ items, answers, score, finished }: { items: PublicItem[]; answers: GrammarAnswer[]; score?: number; finished: boolean }) {
  const lang = getProfile().target.code;
  const byItem = new Map(answers.map((a) => [a.itemId, a]));
  return (
    <section aria-labelledby="answers-title" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="answers-title" className="font-article text-xl font-normal">
          Réponses
        </h2>
        <p className="text-sm tabular-nums text-muted-foreground">
          {finished
            ? score === undefined
              ? "Série terminée."
              : `Série terminée : ${score} %.`
            : `En cours : ${items.filter((i) => byItem.has(i.id)).length} réponses sur ${items.length}.`}
        </p>
      </div>
      <ol className="divide-y border-y">
        {items.map((item, k) => {
          const a = byItem.get(item.id);
          return (
            <li key={item.id} className="flex gap-3 py-4">
              <span className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">{k + 1}.</span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="break-words">{item.prompt}</p>
                {a ? (
                  <p className="flex items-start gap-1.5 text-sm break-words">
                    {a.correct ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />}
                    <span>
                      <span className={a.correct ? "text-primary" : "text-destructive"}>{a.correct ? "Juste" : "Faux"}</span>
                      {" : "}
                      <span lang={lang}>{a.answer}</span>
                      {!a.correct && (
                        <>
                          {" "}
                          <span className="text-muted-foreground">(attendu : <span lang={lang}>{a.expected}</span>)</span>
                        </>
                      )}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas encore répondu.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
