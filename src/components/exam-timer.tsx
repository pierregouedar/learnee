"use client";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClock, remainingMs } from "@/lib/exam";

export function ExamTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // setTimeout(0), pas d'appel direct : la valeur n'existe qu'après montage côté client
    // (évite le mismatch d'hydratation) sans déclencher react-hooks/set-state-in-effect.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) {
    return (
      <p role="timer" aria-label="Temps restant" className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm tabular-nums">
        <Timer aria-hidden className="size-4 text-muted-foreground" />
        Temps restant <span className="font-semibold">--:--:--</span>
      </p>
    );
  }
  const left = remainingMs(startedAt, now);
  return (
    <p role="timer" aria-label="Temps restant" className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm tabular-nums">
      {left > 0 ? (
        <>
          <Timer aria-hidden className="size-4 text-muted-foreground" />
          Temps restant <span className="font-semibold">{formatClock(left)}</span>
        </>
      ) : (
        "Temps écoulé : tu peux terminer et demander la correction."
      )}
    </p>
  );
}
