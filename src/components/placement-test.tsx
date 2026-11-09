"use client";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/word-counter";
import { GRAMMAR_GROUPS } from "@/lib/grammar-points";
import type { PlacementAnswers, PublicPlacement, PublicQuestion } from "@/lib/placement/schema";
import { GenerationStatus } from "@/components/generation-status";
import type { Progress } from "@/lib/generation-progress";
import { postJson } from "@/lib/post-json";
import { postWithProgress } from "@/lib/post-progress";
import { countWords } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useTargetLanguage } from "@/components/profile-provider";

type Answers = { grammar: string[]; reading: (number | null)[]; writing: string; listening: (number | null)[] };

const NO_ASSIST = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", autoComplete: "off" } as const;

// fetch lève une TypeError en anglais quand le réseau tombe : on garde un message français.
const errorMessage = (e: unknown) =>
  e instanceof TypeError ? "Connexion perdue. Tes réponses sont conservées, réessaie dans un instant." : (e as Error).message;

export function StartPlacementButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setProgress(null);
    setError(null);
    try {
      await postWithProgress("/api/placement", {}, setProgress);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={busy}>
        Commencer le test
      </Button>
      {busy && <GenerationStatus progress={progress} fallback="Préparation du test…" />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const OPTION =
  "flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

function Choice(props: {
  name: string;
  question: string;
  options: string[];
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium break-words">{props.question}</legend>
      <div className="grid gap-2">
        {props.options.map((o, k) => (
          <label key={k} className={OPTION}>
            <input
              type="radio"
              name={props.name}
              className="mt-0.5 accent-primary"
              checked={props.value === k}
              onChange={() => props.onChange(k)}
              disabled={props.disabled}
            />
            <span className="break-words">{o}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** En-tête de partie : numéro, titre, consigne, compteur de réponses. */
function PartHeader({ id, n, title, hint, done, total }: { id: string; n: number; title: string; hint?: string; done: number; total: number }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b pb-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold tabular-nums text-accent-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 basis-48 space-y-0.5">
        <h2 id={id} className="font-article text-xl font-normal">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <p className="text-sm tabular-nums text-muted-foreground">
        {done} sur {total}
      </p>
    </div>
  );
}

type Props = { id: string; content: PublicPlacement; saved?: PlacementAnswers; canAct: boolean };

const MAX_PLACEMENT_PLAYS = 2;

export function PlacementTest({ id, content, saved, canAct }: Props) {
  const { code: lang, nameFr } = useTargetLanguage();
  const router = useRouter();
  const plays = useRef(0);
  const [audioLocked, setAudioLocked] = useState(false);
  const [answers, setAnswers] = useState<Answers>(() => ({
    grammar: content.grammar.map((_, i) => saved?.grammar[i] ?? ""),
    reading: content.reading.questions.map((_, i) => saved?.reading[i] ?? null),
    writing: saved?.writing ?? "",
    listening: (content.listening?.questions ?? []).map((_, i) => saved?.listening?.[i] ?? null),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const saveDraft = (next: Answers) =>
    void fetch(`/api/placement/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});

  // Brouillon enregistré sur le serveur (1 s après la dernière frappe) : fermer l'onglet ne fait rien perdre.
  function update(next: Answers) {
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(next), 1000);
  }

  const setGrammar = (i: number, v: string) => update({ ...answers, grammar: answers.grammar.map((g, j) => (j === i ? v : g)) });
  const choose = (part: "reading" | "listening", i: number, v: number) =>
    update({ ...answers, [part]: answers[part].map((x, j) => (j === i ? v : x)) });
  const locked = !canAct || busy;

  async function submit() {
    clearTimeout(timer.current);
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/placement/${id}`, { ...answers, ...(content.listening ? {} : { listening: undefined }) });
      router.refresh();
    } catch (e) {
      saveDraft(answers); // l'évaluation a échoué (429, modèle lent) : le brouillon serveur reste à jour
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  // Sections dans l'ordre conjugaison → construction → petits mots ; `i` reste l'index de la réponse, `n` le numéro affiché.
  let shown = 0;
  const grammarGroups = GRAMMAR_GROUPS.map((group) => ({
    ...group,
    items: content.grammar.flatMap((g, i) => (g.group === group.key ? [{ g, i, n: ++shown }] : [])),
  })).filter((group) => group.items.length > 0);

  const questions = (part: "reading" | "listening", list: PublicQuestion[]) => (
    <div className="space-y-6">
      {list.map((q, i) => (
        <Choice
          key={i}
          name={`${part}-${i}`}
          question={`${i + 1}. ${q.question}`}
          options={q.options}
          value={answers[part][i] ?? null}
          onChange={(v) => choose(part, i, v)}
          disabled={locked}
        />
      ))}
    </div>
  );

  const answered = (xs: (number | string | null)[]) => xs.filter((x) => (typeof x === "string" ? x.trim() !== "" : x !== null)).length;
  const words = countWords(answers.writing);
  const parts = [
    { id: "part-grammar", label: "Grammaire", done: answered(answers.grammar), total: content.grammar.length },
    { id: "part-reading", label: "Lecture", done: answered(answers.reading), total: content.reading.questions.length },
    { id: "part-writing", label: "Écrit", done: words > 0 ? 1 : 0, total: 1 },
    ...(content.listening ? [{ id: "part-listening", label: "Écoute", done: answered(answers.listening), total: content.listening.questions.length }] : []),
  ];
  const doneAll = parts.reduce((a, p) => a + p.done, 0);
  const totalAll = parts.reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-12">
      <nav aria-label="Parties du test" className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <ol className="flex flex-wrap gap-1.5 text-sm">
            {parts.map((p) => (
              <li key={p.id}>
                <a
                  href={`#${p.id}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors hover:bg-muted",
                    p.done === p.total ? "border-primary/40 bg-accent text-accent-foreground" : "bg-card",
                  )}
                >
                  {p.done === p.total && <Check aria-hidden className="size-3.5" />}
                  {p.label}
                  <span className="tabular-nums text-xs opacity-80">
                    {p.done}/{p.total}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="text-sm tabular-nums text-muted-foreground">
            {doneAll} réponses sur {totalAll}
          </p>
        </div>
        <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(doneAll / Math.max(1, totalAll)) * 100}%` }} />
        </div>
      </nav>

      <section aria-labelledby="part-grammar" className="scroll-mt-28 space-y-8">
        <PartHeader id="part-grammar" n={1} title="Grammaire" done={parts[0].done} total={parts[0].total} />
        {grammarGroups.map((group) => (
          <div key={group.key} className="space-y-4">
            <div className="space-y-0.5">
              <h3 className="font-article text-lg font-normal">{group.label}</h3>
              <p className="text-sm text-muted-foreground">{group.hint}</p>
            </div>
            <ol className="divide-y border-y">
              {group.items.map(({ g, i, n }) => (
                <li key={i} className="flex gap-3 py-4">
                  <span aria-hidden className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground">
                    {n}.
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <p lang={lang} className="font-article break-words">
                      <span className="sr-only">{n}. </span>
                      {g.prompt}
                    </p>
                    {g.format === "mcq" ? (
                      <div role="radiogroup" aria-label={`Question ${n}`} className="flex flex-wrap gap-2">
                        {g.options.map((o, k) => (
                          <label key={k} className={cn(OPTION, "items-center py-1.5")}>
                            <input
                              type="radio"
                              name={`grammar-${i}`}
                              className="mt-0 accent-primary"
                              checked={answers.grammar[i] === o}
                              onChange={() => setGrammar(i, o)}
                              disabled={locked}
                            />
                            <span lang={lang}>{o}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <Input
                        aria-label={`Réponse ${n}`}
                        placeholder="Forme du verbe"
                        className="max-w-xs"
                        value={answers.grammar[i] ?? ""}
                        onChange={(e) => setGrammar(i, e.target.value)}
                        disabled={locked}
                        lang={lang} {...NO_ASSIST}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section aria-labelledby="part-reading" className="scroll-mt-28 space-y-6">
        <PartHeader id="part-reading" n={2} title="Lecture" hint="Lis le texte, puis réponds aux questions." done={parts[1].done} total={parts[1].total} />
        <article className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
          <h3 lang={lang} className="font-article text-xl font-normal break-words">
            {content.reading.title}
          </h3>
          <div lang={lang} className="font-article measure space-y-4 text-lg leading-relaxed break-words">
            {content.reading.text.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
        {questions("reading", content.reading.questions)}
      </section>

      <section aria-labelledby="part-writing" className="scroll-mt-28 space-y-4">
        <PartHeader id="part-writing" n={3} title={`Écrit en ${nameFr}`} done={parts[2].done} total={parts[2].total} />
        <p className="measure">{content.writing.task}</p>
        <div className="grid gap-2">
          <label htmlFor="placement-writing" className="text-sm font-medium">
            Ton texte en {nameFr}
          </label>
          <Textarea
            id="placement-writing"
            rows={6}
            className="font-article text-base leading-relaxed"
            value={answers.writing}
            onChange={(e) => update({ ...answers, writing: e.target.value })}
            disabled={locked}
            lang={lang} {...NO_ASSIST}
          />
          <WordCounter count={words} target={[50, 70]} />
        </div>
      </section>

      {content.listening ? (
        <section aria-labelledby="part-listening" className="scroll-mt-28 space-y-6">
          <PartHeader
            id="part-listening"
            n={4}
            title="Écoute"
            hint="Écoute l’audio deux fois au maximum, puis réponds."
            done={parts[3].done}
            total={parts[3].total}
          />
          <audio
            controls
            preload="none"
            src={content.listening.audioUrl}
            className="w-full"
            onPlay={(e) => {
              // Deux écoutes au maximum : une 3e lecture est arrêtée (pas mémorisé au rechargement, c'est un garde-fou).
              if (e.currentTarget.currentTime < 0.5) plays.current += 1;
              if (plays.current > MAX_PLACEMENT_PLAYS) {
                e.currentTarget.pause();
                setAudioLocked(true);
              }
            }}
          />
          {audioLocked && (
            <p role="status" className="text-sm text-muted-foreground">
              Tu as déjà écouté l’audio deux fois. Réponds avec ce que tu as compris.
            </p>
          )}
          {questions("listening", content.listening.questions)}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Partie écoute non proposée : aucun audio n’est disponible pour l’instant. Elle sera ajoutée au prochain test.
        </p>
      )}

      {(canAct || error) && (
        <div className="space-y-3 rounded-xl border bg-card p-5">
          {canAct && (
            <p className="text-sm text-muted-foreground">
              {doneAll < totalAll
                ? `Il reste ${totalAll - doneAll} ${totalAll - doneAll > 1 ? "réponses" : "réponse"} à donner.`
                : "Tout est rempli. Relis-toi si tu veux, puis termine le test."}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {canAct && (
            <div className="space-y-2">
              <Button onClick={submit} disabled={busy}>
                Terminer le test
              </Button>
              {busy && (
                <p role="status" className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">
                  Évaluation en cours, environ une minute…
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
