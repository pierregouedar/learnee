"use client";
import { useEffect, useRef, useState } from "react";
import { WordLookup } from "@/components/word-lookup";
import { BACK_SECONDS, playerKeyAction } from "@/lib/listening/player";
import type { Segment } from "@/lib/listening/schemas";
import { cn } from "@/lib/utils";
import { useTargetLanguage } from "@/components/profile-provider";

type Props = { sentences: Segment[]; audioSrc: string; listeningId: string; title: string; readOnly: boolean };
type Turn = { speaker: string; items: { s: Segment; i: number }[] };

export function ListeningTranscript({ sentences, audioSrc, listeningId, title, readOnly }: Props) {
  const { code: lang } = useTargetLanguage();
  const audio = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);
  const fromSentenceClick = useRef(false);
  const [timeMs, setTimeMs] = useState(-1);

  // Réécoute d'une phrase : on se place à son début et on s'arrête à sa fin.
  function playSentence(s: Segment) {
    if (window.getSelection()?.toString().trim()) return; // sélection pour le dictionnaire, pas une réécoute
    const a = audio.current;
    if (!a) return;
    a.currentTime = s.startMs / 1000;
    stopAt.current = s.endMs / 1000;
    fromSentenceClick.current = true;
    void a.play().catch(() => {});
  }

  function onTimeUpdate() {
    const a = audio.current!;
    setTimeMs(a.currentTime * 1000);
    if (stopAt.current !== null && a.currentTime >= stopAt.current) {
      stopAt.current = null;
      a.pause();
    }
  }

  // Une lecture native (barre de contrôle, reprise clavier globale) doit jouer jusqu'au bout, pas s'arrêter
  // à la fin de la phrase visée par le dernier clic.
  function onPlay() {
    if (!fromSentenceClick.current) stopAt.current = null;
    fromSentenceClick.current = false;
  }

  // Un déplacement manuel dans la piste annule l'arrêt programmé par playSentence.
  function onSeeking() {
    stopAt.current = null;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = playerKeyAction(e.key, e.target as HTMLElement);
      const a = audio.current;
      if (!action || !a) return;
      e.preventDefault();
      if (action === "back") a.currentTime = Math.max(0, a.currentTime - BACK_SECONDS);
      else if (a.paused) void a.play().catch(() => {});
      else a.pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const turns = sentences.reduce<Turn[]>((acc, s, i) => {
    const last = acc.at(-1);
    if (last && last.speaker === s.speaker) last.items.push({ s, i });
    else acc.push({ speaker: s.speaker, items: [{ s, i }] });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <audio
        ref={audio}
        src={audioSrc}
        controls
        preload="auto"
        className="w-full"
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onSeeking={onSeeking}
      />
      <WordLookup sourceType="listening" sourceId={listeningId} sourceTitle={title} disabled={readOnly}>
        <div lang={lang} className="font-article measure space-y-3 text-lg leading-relaxed break-words">
          {turns.map((t, k) => (
            <p key={k}>
              <span className="mr-2 font-sans text-sm font-medium text-muted-foreground">{t.speaker}</span>
              {t.items.map(({ s, i }) => (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => playSentence(s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") playSentence(s);
                    else if (e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      playSentence(s);
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-sm transition-colors hover:bg-accent",
                    timeMs >= s.startMs && timeMs < s.endMs && "bg-accent",
                  )}
                >
                  {s.text}{" "}
                </span>
              ))}
            </p>
          ))}
        </div>
      </WordLookup>
    </div>
  );
}
