import { formatClock } from "@/lib/listening/player";
import { FORMAT_LABELS } from "@/lib/listening/schemas";
import type { ListeningSummary } from "@/lib/repo/listenings";

/** Ligne de détails d'une écoute : « B1, Interview, audio réel, 2:00 ». Un format inconnu est ignoré. */
export function listeningMeta(l: Pick<ListeningSummary, "level" | "format" | "source" | "durationSec">, withDuration = true) {
  return [
    l.level,
    FORMAT_LABELS[l.format],
    l.source === "upload" ? "audio réel" : "audio généré",
    withDuration ? formatClock(l.durationSec) : null,
  ]
    .filter(Boolean)
    .join(", ");
}
