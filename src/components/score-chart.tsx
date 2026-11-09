import type { Tier } from "@/lib/tiers";
import { formatNote } from "./grade-badge";
import { cn } from "@/lib/utils";

type Point = { total: number; tier: Tier; isMock: boolean; label: string; date?: string };

const TICKS = [0, 5, 10, 15, 20];
const TARGET = 12;
const top = (v: number) => `${(1 - v / 20) * 100}%`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

// une seule série en HTML + SVG étiré (les textes restent lisibles sur téléphone) ; une lib si on ajoute des séries.
export function ScoreChart({ points }: { points: Point[] }) {
  if (points.length === 0) return null;
  const n = points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const hasMock = points.some((p) => p.isMock);
  const first = points[0];
  const last = points.at(-1)!;
  const summary = `Notes des copies sur 20, de la plus ancienne à la plus récente : ${points.map((p) => formatNote(p.total)).join(", ")}. Repère à ${TARGET} sur 20.`;

  return (
    <figure className="space-y-3">
      <div role="img" aria-label={summary} className="relative ml-7 mr-10 h-44 sm:h-56">
        {TICKS.map((v) => (
          <div key={v} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ top: top(v) }}>
            <span className="absolute -left-7 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">{v}</span>
          </div>
        ))}
        <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-muted-foreground/60" style={{ top: top(TARGET) }}>
          <span className="absolute -right-10 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">{TARGET}/20</span>
        </div>
        {n > 1 && (
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-primary">
            <polyline
              points={points.map((p, i) => `${x(i)},${(1 - p.total / 20) * 100}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {points.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="group absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={{ left: `${x(i)}%`, top: top(p.total) }}
          >
            <span
              className={cn(
                "rounded-full ring-2 ring-card",
                p.isMock ? "size-3.5 border-2 border-primary bg-card" : "size-2.5 bg-primary",
              )}
            />
            {i === n - 1 && (
              <span className="absolute bottom-full text-xs font-semibold tabular-nums text-foreground group-hover:invisible">{formatNote(p.total)}</span>
            )}
            <span
              className={cn(
                "pointer-events-none invisible absolute bottom-full z-10 mb-1 w-max max-w-56 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm group-hover:visible",
                x(i) > 50 ? "right-0" : "left-0",
              )}
            >
              <span className="block font-semibold tabular-nums">
                {formatNote(p.total)}/20{p.isMock ? " · examen blanc" : ""}
              </span>
              <span className="block break-words text-muted-foreground">{p.label}</span>
            </span>
          </span>
        ))}
      </div>
      <figcaption className="ml-7 mr-10 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {first.date && <span>{shortDate(first.date)}</span>}
        {hasMock && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-primary" />
            Examen blanc
          </span>
        )}
        {n > 1 && last.date && <span>{shortDate(last.date)}</span>}
      </figcaption>
    </figure>
  );
}
