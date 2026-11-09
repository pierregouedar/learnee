"use client";
import { Check, Lock, Pause, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WordCounter } from "@/components/word-counter";
import {
  BACK_SECONDS, canPlay, endPlayback, formatClock, MAX_PLAYS, playerKeyAction, startPlayback, type PlayState,
} from "@/lib/listening/player";
import type { ListeningAttempt } from "@/lib/repo/listenings";
import { countWords } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useTargetLanguage } from "@/components/profile-provider";

const MIN_WORDS = 20; // miroir de services/correct-listening.ts (le serveur revalide)
const SUMMARY_TARGET = [80, 150] as const;
const SLOW_RATE = 0.85;

type Draft = { notes: string; summary: string };
type Props = { attempt: ListeningAttempt; audioSrc: string; durationSec: number; slowSpeed: boolean; readOnly: boolean };

// Autosave : même schéma durci que components/editor.tsx (localStorage à chaque frappe, PATCH après 1 s,
// envoi keepalive à la mise en arrière-plan et au démontage, reprise sur `online`, alerte dédiée sur 401).
export function ListeningExercise({ attempt, audioSrc, durationSec, slowSpeed, readOnly }: Props) {
  const { nameFr } = useTargetLanguage();
  const router = useRouter();
  const storageKey = `listening:${attempt.id}`;
  const audio = useRef<HTMLAudioElement>(null);
  const [play, setPlay] = useState<PlayState>({ plays: attempt.plays, inPlay: false });
  const playRef = useRef(play);
  const playPending = useRef(false); // un seul PATCH { play } à la fois (double appui sur Espace)
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [slow, setSlow] = useState(false);
  const [draft, setDraft] = useState<Draft>({ notes: attempt.notes, summary: attempt.summary });
  const latest = useRef<Draft>(draft);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [saveState, setSaveState] = useState<"saved" | "pending" | "offline">("saved");
  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);
  const [correcting, setCorrecting] = useState(attempt.status === "correcting");
  const correctingRef = useRef(correcting);
  useEffect(() => {
    correctingRef.current = correcting;
  }, [correcting]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(attempt.error ?? null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiredRef = useRef(false);

  const updatePlay = (s: PlayState) => {
    playRef.current = s;
    setPlay(s);
  };

  const flush = useCallback(
    async (keepalive = false): Promise<boolean> => {
      clearTimeout(timer.current);
      timer.current = undefined;
      try {
        const res = await fetch(`/api/listening/attempts/${attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latest.current),
          keepalive,
        });
        // 401 : session expirée, pas un problème de connexion. Le texte reste dans localStorage.
        if (res.status === 401) {
          expiredRef.current = true;
          setSessionExpired(true);
          return false;
        }
        expiredRef.current = false;
        setSaveState(res.ok ? "saved" : "offline");
        return res.ok;
      } catch {
        expiredRef.current = false;
        setSaveState("offline");
        return false;
      }
    },
    [attempt.id],
  );

  const update = useCallback(
    (patch: Partial<Draft>) => {
      if (readOnly) return;
      const next = { ...latest.current, ...patch };
      latest.current = next;
      setDraft(next);
      setSaveState("pending");
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...next, savedAt: new Date().toISOString() }));
      } catch {}
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1000);
    },
    [flush, readOnly, storageKey],
  );

  // Copie locale plus récente que le serveur (onglet fermé avant l'envoi) : on la reprend.
  useEffect(() => {
    if (readOnly || attempt.status !== "draft") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const local = JSON.parse(raw) as Draft & { savedAt: string };
      if (local.savedAt > attempt.updatedAt && (local.notes !== attempt.notes || local.summary !== attempt.summary)) {
        update({ notes: local.notes, summary: local.summary });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retente l'envoi dès que la connexion revient si le dernier envoi n'a pas abouti.
  useEffect(() => {
    const onOnline = () => {
      if (!readOnly && saveStateRef.current !== "saved") void flush();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush, readOnly]);

  // Ne perd pas le texte tapé juste avant une navigation côté client : on force l'envoi.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHide = () => {
      // Pas d'envoi pendant la correction (compte rendu verrouillé côté serveur, 409) ni en lecture seule.
      if (document.visibilityState === "hidden" && !correctingRef.current && !readOnly) void flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush, readOnly]);

  const toggle = useCallback(async () => {
    const a = audio.current;
    if (!a || readOnly || playPending.current) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    const r = startPlayback(playRef.current);
    if (!r.allowed) return;
    if (r.counted) {
      // Une écoute est comptée par le serveur AVANT de démarrer : c'est lui qui refuse la 4e.
      playPending.current = true;
      try {
        const res = await fetch(`/api/listening/attempts/${attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ play: true }),
        }).catch(() => null);
        if (res?.status === 401) {
          setSessionExpired(true);
          return;
        }
        const body = (await res?.json().catch(() => ({}))) as { plays?: number; error?: string } | undefined;
        if (!res?.ok) {
          setError(body?.error ?? "Impossible de lancer l'écoute. Vérifie ta connexion.");
          if (res?.status === 409) updatePlay({ plays: MAX_PLAYS, inPlay: false });
          return;
        }
        updatePlay({ plays: body?.plays ?? r.state.plays, inPlay: true });
      } finally {
        playPending.current = false;
      }
      a.currentTime = 0;
    }
    a.playbackRate = slow ? SLOW_RATE : 1;
    try {
      await a.play();
      setError(null);
    } catch {
      setError("Impossible de lire l'audio.");
    }
  }, [attempt.id, slow, readOnly]);

  const back = useCallback(() => {
    const a = audio.current;
    if (a && playRef.current.inPlay) a.currentTime = Math.max(0, a.currentTime - BACK_SECONDS);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = playerKeyAction(e.key, e.target as HTMLElement);
      if (!action || correcting || readOnly || starting) return;
      e.preventDefault();
      if (action === "toggle") void toggle();
      else back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, back, correcting, readOnly, starting]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = slow ? SLOW_RATE : 1;
  }, [slow]);

  useEffect(() => {
    if (!correcting) return;
    const poll = setInterval(async () => {
      const res = await fetch(`/api/listening/attempts/${attempt.id}`).catch(() => null);
      if (!res?.ok) return;
      const a = (await res.json()) as ListeningAttempt;
      if (a.status === "corrected") {
        clearInterval(poll);
        try { localStorage.removeItem(storageKey); } catch {}
        router.refresh();
      } else if (a.status === "draft") {
        setCorrecting(false);
        setError(a.error ?? "La correction a échoué. Ton compte rendu est conservé.");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [correcting, router, attempt.id, storageKey]);

  async function submit() {
    if (starting || correcting) return;
    setStarting(true);
    setError(null);
    try {
      audio.current?.pause();
      if (!(await flush())) {
        // Session expirée : l'alerte dédiée suffit, pas le message "connexion".
        if (!expiredRef.current) {
          setError("Ton compte rendu n'a pas pu être envoyé au serveur. Vérifie ta connexion et réessaie.");
        }
        return;
      }
      const res = await fetch(`/api/listening/attempts/${attempt.id}/correct`, { method: "POST" });
      if (res.status === 202) {
        setCorrecting(true);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Impossible de lancer la correction.");
    } catch {
      setError("Impossible de lancer la correction.");
    } finally {
      setStarting(false);
    }
  }

  if (readOnly) {
    return (
      <EmptyState
        icon={Lock}
        title="Compte en lecture seule"
        description="La transcription et la correction s’afficheront ici une fois le compte rendu corrigé."
      />
    );
  }

  const words = countWords(draft.summary);
  const tooShort = words < MIN_WORDS;
  const locked = !canPlay(play);
  const left = Math.max(0, MAX_PLAYS - play.plays);
  const progress = durationSec > 0 ? Math.min(100, (time / durationSec) * 100) : 0;
  const steps: { label: string; done: boolean; current: boolean }[] = [
    { label: "Écouter", done: play.plays > 0, current: play.plays === 0 },
    { label: "Noter", done: draft.notes.trim().length > 0, current: false },
    { label: "Résumer", done: !tooShort, current: !correcting && play.plays > 0 && tooShort },
    { label: "Correction", done: false, current: correcting },
  ];

  return (
    <div className="space-y-8">
      <ol aria-label="Étapes de l’exercice" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.label}
            aria-current={s.current ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm",
              s.current && "border-primary bg-accent/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums",
                s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("min-w-0", !s.done && !s.current && "text-muted-foreground")}>
              {s.label}
              {s.done && <span className="sr-only"> (fait)</span>}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-2">
        {sessionExpired && (
          <div role="alert" className="col-span-full rounded-xl border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
            <p>Ta session a expiré. Reconnecte-toi : ton texte est gardé sur cet appareil.</p>
            <Link href={`/login?next=/ecoute/${attempt.id}`} className="font-medium underline underline-offset-2">
              Se reconnecter
            </Link>
          </div>
        )}
        <div className="space-y-6">
          <Step n={1} title="Écouter" description={`${MAX_PLAYS} écoutes au maximum. La transcription et les définitions s’afficheront après l’envoi de ton compte rendu.`}>
            <section className="space-y-4" aria-label="Lecteur audio">
              <audio
                ref={audio}
                src={audioSrc}
                preload="auto"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  setPlaying(false);
                  updatePlay(endPlayback(playRef.current));
                }}
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              />
              <div className="space-y-3 rounded-lg bg-muted/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void toggle()} disabled={correcting || (!playing && locked)} aria-keyshortcuts="Space">
                    {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {playing ? "Pause" : play.inPlay ? "Reprendre" : "Écouter"}
                  </Button>
                  <Button variant="outline" onClick={back} disabled={!play.inPlay} aria-keyshortcuts="ArrowLeft" aria-label="Reculer de 5 secondes">
                    <RotateCcw className="size-4" /> 5 s
                  </Button>
                  {slowSpeed && (
                    <Button variant={slow ? "secondary" : "outline"} aria-pressed={slow} onClick={() => setSlow(!slow)}>
                      Vitesse 0,85×
                    </Button>
                  )}
                  <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                    {formatClock(time)} / {formatClock(durationSec)}
                  </span>
                </div>
                <div aria-hidden className="h-1 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium tabular-nums" aria-live="polite">
                  Écoutes : {play.plays} / {MAX_PLAYS}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({left > 1 ? `${left} restantes` : left === 1 ? "1 restante" : "aucune restante"})
                  </span>
                </p>
                <span aria-hidden className="flex gap-1">
                  {Array.from({ length: MAX_PLAYS }, (_, i) => (
                    <span key={i} className={cn("h-1.5 w-6 rounded-full", i < play.plays ? "bg-primary" : "bg-muted")} />
                  ))}
                </span>
              </div>
              {locked && !playing && (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Tu as utilisé tes {MAX_PLAYS} écoutes. Termine ton compte rendu puis envoie-le.
                </p>
              )}
              <p className="text-xs text-muted-foreground">Espace : lecture ou pause. Flèche gauche : reculer de 5 secondes.</p>
            </section>
          </Step>

          <Step n={2} title={<label htmlFor="listening-notes">Prendre des notes</label>} description={`En ${nameFr} ou en français, comme tu veux. Elles ne sont pas notées.`}>
            <Textarea
              id="listening-notes"
              rows={8}
              className="min-h-40"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              value={draft.notes}
              disabled={correcting || starting}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </Step>
        </div>

        <Step
          n={3}
          title={<label htmlFor="listening-summary">Résumer en français</label>}
          description={`Au moins ${MIN_WORDS} mots, idéalement ${SUMMARY_TARGET[0]} à ${SUMMARY_TARGET[1]}.`}
        >
          <Textarea
            id="listening-summary"
            lang="fr"
            rows={12}
            className="min-h-64"
            value={draft.summary}
            disabled={correcting || starting}
            onChange={(e) => update({ summary: e.target.value })}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <WordCounter count={words} target={SUMMARY_TARGET} />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {!sessionExpired && saveState === "saved" && "Brouillon enregistré"}
              {!sessionExpired && saveState === "pending" && "Enregistrement…"}
              {!sessionExpired && saveState === "offline" && "Enregistré sur cet appareil, envoi au serveur dès que possible"}
            </p>
          </div>
          {correcting && (
            <p role="status" className="animate-pulse rounded-lg border bg-accent/50 p-3 text-sm motion-reduce:animate-none">
              Correction en cours, cela peut prendre quelques minutes. Tu peux laisser la page ouverte.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button onClick={submit} disabled={correcting || starting || tooShort}>Envoyer mon compte rendu</Button>
            {tooShort && <span className="text-xs text-muted-foreground">Au moins {MIN_WORDS} mots</span>}
          </div>
        </Step>
      </div>
    </div>
  );
}

/** Carte d'une étape numérotée. Le titre peut être un <label> pour rester l'étiquette visible du champ. */
function Step({
  n, title, description, children,
}: {
  n: number; title: React.ReactNode; description?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex min-w-0 gap-3">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground tabular-nums">
          {n}
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="font-article text-xl font-normal">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
