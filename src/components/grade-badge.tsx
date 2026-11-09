import { cn } from "@/lib/utils";

export const formatNote = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Note écrite à l'encre : verte à partir de la moyenne haute (12/20, 6/10), sinon encre noire. */
export function GradeBadge({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-baseline font-article text-xl tabular-nums", value / max >= 0.6 ? "text-primary" : "text-foreground", className)}>
      {formatNote(value)}
      <span className="text-xs font-normal">/{max}</span>
    </span>
  );
}
