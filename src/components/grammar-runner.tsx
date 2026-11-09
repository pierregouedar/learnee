"use client";
import { ArrowRight, BookOpen, Check, ChevronDown, CircleCheck, CircleX, Flag, Trophy } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GrammarLesson } from "@/components/grammar-lesson";
import { IconBadge } from "@/components/page";
import { SessionProgress } from "@/components/session-progress";
import type { Lesson } from "@/lib/grammar/schema";
import { postJson } from "@/lib/post-json";
import type { PublicItem } from "@/lib/repo/grammar";
import type { AnswerResult } from "@/lib/services/grammar";
import { cn } from "@/lib/utils";
import { useTargetLanguage } from "@/components/profile-provider";

type Props = { attemptId: string; items: PublicItem[]; answered: string[]; score?: number; finished: boolean; lesson?: Lesson };

const NO_ASSIST = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

const INSTRUCTIONS: Record<PublicItem["format"], string> = {
  gap: "Complète la phrase",
  error_spot: "Trouve l’erreur et corrige la phrase",
  transform: "Transforme la phrase",
  translate: "Traduis en",
  reorder: "Remets les mots dans l’ordre",
  mcq: "Choisis la bonne réponse",
};

const initialAnswer = (item?: PublicItem) => (item?.format === "error_spot" ? item.prompt : "");

export function GrammarRunner({ attemptId, items, answered, score: initialScore, finished, lesson }: Props) {
  const { code: lang, nameFr } = useTargetLanguage();
  const firstOpen = items.findIndex((i) => !answered.includes(i.id));
  const start = finished || firstOpen === -1 ? items.length : firstOpen;
  const [index, setIndex] = useState(start);
  const [answer, setAnswer] = useState(() => initialAnswer(items[start]));
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState(initialScore);
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false); // garde anti double envoi, indépendante du rendu
  // Leçon en plein écran avant la première question ; ensuite repliable au-dessus des exercices.
  const [inLesson, setInLesson] = useState(Boolean(lesson) && answered.length === 0 && !finished);

  const item = items[index];
  if (!item) return <Summary score={score} />;
  if (lesson && inLesson) {
    return (
      <div className="space-y-10">
        <GrammarLesson lesson={lesson} lang={lang} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6">
          <Button autoFocus size="lg" className="px-5" onClick={() => setInLesson(false)}>
            Commencer les exercices
            <ArrowRight aria-hidden />
          </Button>
          <p className="text-sm tabular-nums text-muted-foreground">{items.length} questions, corrigées une par une</p>
        </div>
      </div>
    );
  }

  const value = item.format === "reorder" ? picked.map((i) => item.options[i]).join(" ") : answer;
  const locked = busy || result !== null;

  async function send<T>(url: string, body: unknown, onDone: (r: T) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      onDone(await postJson<T>(url, body));
    } catch (err) {
      setError((err as Error).message); // la réponse reste dans le champ : elle peut réessayer
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (result || !value.trim()) return;
    void send<AnswerResult>(`/api/grammar/attempts/${attemptId}/answers`, { itemId: item.id, answer: value }, (r) => {
      setResult(r);
      if (r.done) setScore(r.score);
    });
  }

  function flag() {
    void send<{ done: boolean; score?: number }>(`/api/grammar/items/${item.id}/flag`, { attemptId }, (r) => {
      setFlagged(true);
      if (r.done) setScore(r.score);
    });
  }

  function next() {
    const n = index + 1;
    setIndex(n);
    setAnswer(initialAnswer(items[n]));
    setPicked([]);
    setResult(null);
    setFlagged(false);
    setError(null);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <SessionProgress label={`Question ${index + 1} sur ${items.length}`} value={index + (result ? 1 : 0)} max={items.length} />

      <section aria-labelledby="question-title" className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
        <div className="space-y-3">
          <h2 id="question-title" className="text-sm font-medium text-muted-foreground">
            {INSTRUCTIONS[item.format]}{item.format === "translate" && ` ${nameFr}`}
          </h2>
          {item.format === "translate" || item.format === "transform" || item.format === "reorder" ? (
            <p className="measure text-xl leading-snug break-words">{item.prompt}</p>
          ) : (
            <p lang={lang} className="font-article measure text-xl leading-snug break-words">
              {item.prompt}
            </p>
          )}
        </div>

        {item.format === "mcq" && (
          <div role="radiogroup" aria-label="Réponses possibles" className="grid gap-2 sm:grid-cols-2">
            {item.options.map((o) => (
              <Button
                key={o}
                type="button"
                role="radio"
                aria-checked={answer === o}
                variant="outline"
                disabled={locked}
                className={cn(
                  "h-auto min-h-12 justify-start px-4 py-3 text-left text-base whitespace-normal break-words disabled:opacity-100",
                  answer === o && "border-primary bg-accent text-accent-foreground hover:bg-accent dark:border-primary dark:bg-accent dark:hover:bg-accent",
                  result && !result.correct && answer === o && "border-destructive bg-destructive/10 text-foreground dark:border-destructive dark:bg-destructive/10",
                  result && o === result.expected && "border-primary bg-accent text-accent-foreground dark:border-primary dark:bg-accent",
                  locked && answer !== o && !(result && o === result.expected) && "opacity-60 disabled:opacity-60",
                )}
                onClick={() => setAnswer(o)}
              >
                <span lang={lang}>{o}</span>
              </Button>
            ))}
          </div>
        )}

        {item.format === "reorder" && (
          <div className="space-y-3">
            <div aria-live="polite" className="flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-dashed bg-background p-2.5">
              {picked.length === 0 ? (
                <span className="px-1 text-sm text-muted-foreground">Clique sur les mots dans l’ordre.</span>
              ) : (
                picked.map((wordIndex, k) => (
                  <button
                    key={k}
                    type="button"
                    lang={lang}
                    disabled={locked}
                    aria-label={`Retirer « ${item.options[wordIndex]} »`}
                    onClick={() => setPicked(picked.filter((_, j) => j !== k))}
                    className="rounded-md bg-accent px-2.5 py-1.5 font-article text-accent-foreground transition-colors hover:bg-accent/70 disabled:opacity-60"
                  >
                    {item.options[wordIndex]}
                  </button>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {item.options.map((word, i) =>
                picked.includes(i) ? null : (
                  <Button key={i} type="button" variant="outline" className="h-auto py-1.5 font-article text-base" disabled={locked} onClick={() => setPicked([...picked, i])}>
                    <span lang={lang}>{word}</span>
                  </Button>
                ),
              )}
            </div>
          </div>
        )}

        {item.format === "translate" && (
          <div className="grid gap-2">
            <label htmlFor="answer" className="text-sm font-medium">
              Ta traduction
            </label>
            <Textarea id="answer" rows={3} className="text-base" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={locked} lang={lang} {...NO_ASSIST} />
          </div>
        )}

        {(item.format === "gap" || item.format === "error_spot" || item.format === "transform") && (
          <div className="grid gap-2">
            <label htmlFor="answer" className="text-sm font-medium">
              {item.format === "gap" ? "Les mots manquants" : "Ta phrase"}
            </label>
            <Input id="answer" className="h-10 text-base" value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={locked} lang={lang} {...NO_ASSIST} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!result && (
          <div className="space-y-2">
            <Button type="submit" size="lg" className="px-5" disabled={busy || !value.trim()}>
              {busy ? (item.format === "translate" ? "Vérification en cours…" : "Vérification…") : error ? "Réessayer" : "Valider"}
            </Button>
            {busy && item.format === "translate" && (
              <p role="status" className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">
                Ta traduction est relue, cela peut prendre quelques secondes.
              </p>
            )}
          </div>
        )}
      </section>

      {result && (
        <div
          role="status"
          className={cn("space-y-4 rounded-xl border p-5 sm:p-6", result.correct ? "border-primary/40 bg-accent/40" : "border-destructive/40 bg-destructive/5")}
        >
          <p className={cn("flex items-center gap-2 text-lg font-semibold", result.correct ? "text-primary" : "text-destructive")}>
            {result.correct ? <CircleCheck aria-hidden className="size-5" /> : <CircleX aria-hidden className="size-5" />}
            {result.correct ? "Bonne réponse" : "Pas tout à fait"}
          </p>
          {!result.correct && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">La bonne réponse</p>
              <p lang={lang} className="font-article text-lg font-medium break-words">
                {result.expected}
              </p>
            </div>
          )}
          {result.feedback && <p className="break-words">{result.feedback}</p>}
          <p className="measure text-sm leading-relaxed text-muted-foreground">{result.explanation}</p>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button type="button" size="lg" className="px-5" onClick={next} disabled={busy}>
              {index + 1 < items.length ? "Suivant" : "Voir le résultat"}
            </Button>
            {flagged ? (
              <p className="text-sm text-muted-foreground">Merci, cet exercice est retiré de tes séries.</p>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={flag}>
                <Flag aria-hidden />
                Cette correction me semble fausse
              </Button>
            )}
          </div>
        </div>
      )}

      {lesson && (
        <details className="group rounded-xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <BookOpen aria-hidden className="size-4 text-muted-foreground" />
            Revoir la leçon
            <ChevronDown aria-hidden className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="border-t p-4 sm:p-6">
            <GrammarLesson lesson={lesson} lang={lang} />
          </div>
        </details>
      )}
    </form>
  );
}

function Summary({ score }: { score?: number }) {
  const good = score !== undefined && score >= 85;
  return (
    <section aria-labelledby="summary-title" className="space-y-6 rounded-xl border bg-card p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <IconBadge icon={good ? Trophy : Check} tone={good ? "primary" : "accent"} />
        <div className="space-y-1">
          <h2 id="summary-title" className="font-article text-2xl font-normal">
            Série terminée
          </h2>
          <p className="measure text-muted-foreground">
            {score === undefined
              ? "Tous les exercices de cette série ont été retirés."
              : good
                ? "Très bien ! Refais ce point dans quelques jours pour le valider."
                : "Ce point reviendra dans une prochaine série."}
          </p>
        </div>
      </div>
      {score !== undefined && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Ton score</p>
          <p className="font-article text-5xl font-normal tabular-nums">{score} %</p>
          <p className="text-sm text-muted-foreground">Un point est validé après deux séries à 85 % ou plus, à trois jours d’écart.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-t pt-5">
        <Button asChild size="lg" className="px-5">
          <Link href="/grammaire">Retour à la grammaire</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Aujourd’hui</Link>
        </Button>
      </div>
    </section>
  );
}
