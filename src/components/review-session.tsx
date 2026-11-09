"use client";
import { CircleCheck, CircleX, EyeOff, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PronounceButton } from "@/components/pronounce-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page";
import { SessionProgress } from "@/components/session-progress";
import { cn } from "@/lib/utils";
import type { ReviewCard } from "@/lib/review";
import { useTargetLanguage } from "@/components/profile-provider";

const RATINGS = [
  { value: 1, label: "À revoir" },
  { value: 2, label: "Difficile" },
  { value: 3, label: "Correct" },
  { value: 4, label: "Facile" },
] as const;

export function ReviewSession({
  initial, readOnly, serverAudio = true,
}: {
  initial: ReviewCard[]; readOnly: boolean; serverAudio?: boolean;
}) {
  const { code: lang } = useTargetLanguage();
  const [queue, setQueue] = useState(initial);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const shownAt = useRef(0);
  const card = queue[0];

  useEffect(() => {
    shownAt.current = Date.now();
  }, [card?.id]);

  async function send(body: object) {
    if (!card || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible d'enregistrer ta réponse. Réessaie.");
        return;
      }
      setQueue(data.queue as ReviewCard[]);
      setRevealed(false);
      setPicked(null);
      setDone((d) => d + 1);
    } catch {
      setError("Impossible d'enregistrer ta réponse. Vérifie ta connexion.");
    } finally {
      setBusy(false);
    }
  }

  const rate = (rating: number) => send({ rating, elapsedMs: Date.now() - shownAt.current });

  // Lecture seule : on avance localement dans la queue chargée au chargement de la page, sans POST.
  const next = () => {
    setQueue((q) => q.slice(1));
    setPicked(null);
    setDone((d) => d + 1);
  };

  // QCM façon Duolingo : bonne réponse = « Correct » (3), mauvaise = « À revoir » (1).
  const choices = card?.choices;
  const pickedRight = choices && picked !== null ? choices[picked] === card.fr : null;
  const pick = (k: number) => {
    if (picked === null) setPicked(k);
  };
  const cont = () => (readOnly ? next() : void rate(pickedRight ? 3 : 1));

  const revealedNow = choices ? picked !== null : readOnly || revealed;

  // pas de tableau de dépendances — se réabonne à chaque rendu pour que `rate`/`revealed`
  // soient toujours à jour ; coût négligeable avec quelques écouteurs par carte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "BUTTON"].includes(tag)) return;
      if (choices) {
        if (picked === null && ["1", "2", "3", "4"].includes(e.key)) pick(Number(e.key) - 1);
        else if (picked !== null && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          cont();
        }
        return;
      }
      if (readOnly) {
        if (e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(Number(e.key));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return done > 0 ? (
      <EmptyState
        icon={CircleCheck}
        title="Session terminée, à demain"
        description={`${done} ${done > 1 ? "cartes revues" : "carte revue"} aujourd’hui. Les mots que tu gardes en lecture et en écoute arrivent ici automatiquement.`}
      />
    ) : (
      <EmptyState
        icon={Layers}
        title="Aucune carte à revoir aujourd’hui."
        description="Les mots que tu gardes en lecture et en écoute arrivent ici automatiquement."
      />
    );
  }

  return (
    <div className="space-y-5">
      <SessionProgress
        label={`${queue.length} ${queue.length > 1 ? "cartes restantes" : "carte restante"}${card.isNew ? ", nouvelle carte" : ""}`}
        value={done}
        max={done + queue.length}
      />

      <section aria-label="Carte à réviser" className="space-y-6 rounded-xl border bg-card p-5 sm:p-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p lang={lang} className="font-article text-3xl font-normal tracking-tight break-words sm:text-4xl">{card.term}</p>
            <PronounceButton word={card.term} serverAudio={serverAudio} />
          </div>
          {card.context && (
            <p lang={lang} className="font-article text-lg leading-relaxed break-words text-muted-foreground">
              {card.context.before}
              <strong className="font-semibold text-foreground">{card.context.match}</strong>
              {card.context.after}
            </p>
          )}
        </div>

        {choices && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Quelle est la traduction ?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {choices.map((c, k) => {
                const right = picked !== null && c === card.fr;
                const wrong = picked !== null && k === picked && c !== card.fr;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={picked !== null}
                    onClick={() => pick(k)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border bg-background p-3 text-left text-base transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:hover:border-border disabled:hover:bg-background",
                      right && "border-primary bg-accent text-accent-foreground disabled:hover:border-primary disabled:hover:bg-accent",
                      wrong && "border-destructive bg-destructive/10 disabled:hover:border-destructive disabled:hover:bg-destructive/10",
                      picked !== null && !right && !wrong && "opacity-60",
                    )}
                  >
                    <kbd className="grid size-6 shrink-0 place-items-center rounded-md border bg-card text-xs text-muted-foreground">{k + 1}</kbd>
                    <span className="min-w-0 flex-1 break-words">{c}</span>
                    {right && <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />}
                    {wrong && <CircleX aria-hidden className="size-5 shrink-0 text-destructive" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {choices && picked !== null && (
          <p role="status" className={cn("flex items-center gap-2 font-semibold", pickedRight ? "text-primary" : "text-destructive")}>
            {pickedRight ? <CircleCheck aria-hidden className="size-5" /> : <CircleX aria-hidden className="size-5" />}
            {pickedRight ? "Bonne réponse" : `Raté : « ${card.fr} »`}
          </p>
        )}
        {revealedNow && (
          <div className="space-y-2 border-t pt-5">
            <p className="text-xl font-semibold break-words">{card.fr}</p>
            {card.definition && <p lang={lang} className="break-words">{card.definition}</p>}
            {card.example && <p lang={lang} className="font-article italic break-words text-muted-foreground">{card.example}</p>}
            {card.context?.sourceTitle && <p className="pt-1 text-xs text-muted-foreground">Source : {card.context.sourceTitle}</p>}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {choices ? (
        picked !== null && (
          <div className="space-y-2">
            <Button autoFocus size="lg" className="w-full px-5 sm:w-auto" disabled={busy} onClick={cont}>
              Continuer
            </Button>
            {readOnly && <p className="text-sm text-muted-foreground">Lecture seule : les révisions ne sont pas enregistrées.</p>}
          </div>
        )
      ) : readOnly ? (
        <div className="space-y-2">
          <Button size="lg" className="px-5" onClick={next}>Carte suivante</Button>
          <p className="text-sm text-muted-foreground">Lecture seule : les révisions ne sont pas enregistrées.</p>
        </div>
      ) : !revealed ? (
        <Button size="lg" className="w-full px-5 sm:w-auto" onClick={() => setRevealed(true)}>Afficher la réponse</Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Tu t’en souvenais ?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <Button key={r.value} size="lg" variant={r.value === 3 ? "default" : "outline"} disabled={busy} onClick={() => void rate(r.value)}>
                <span className="mr-1 text-xs opacity-70">{r.value}</span>
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{choices ? "Touches 1 à 4 : choisir. Entrée : continuer." : "Espace : afficher la réponse. Touches 1 à 4 : noter."}</span>
          <Button variant="ghost" size="sm" className="ml-auto" disabled={busy} onClick={() => void send({ action: "suspend" })}>
            <EyeOff aria-hidden />
            Je connais déjà
          </Button>
        </div>
      )}
    </div>
  );
}
