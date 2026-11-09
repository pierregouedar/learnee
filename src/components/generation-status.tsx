"use client";
import { useEffect, useState } from "react";
import type { Progress } from "@/lib/generation-progress";

/** Suivi d'une génération : étape en cours lue dans la réponse du modèle, barre, temps écoulé. */
export function GenerationStatus({ progress, fallback }: { progress: Progress | null; fallback: string }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.round((now - started) / 1000);
  const pct = progress?.pct ?? 1;

  return (
    <div role="status" aria-live="polite" className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words">{progress?.label ?? fallback}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{seconds} s</span>
      </div>
      <div
        role="progressbar"
        aria-label="Avancement de la préparation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
