import { cn } from "@/lib/utils";

export function WordCounter({ count, target }: { count: number; target: readonly [number, number] | null }) {
  const inRange = target ? count >= target[0] && count <= target[1] : false;
  return (
    <span aria-live="polite" className={cn("text-sm tabular-nums text-muted-foreground", inRange && "font-medium text-primary")}>
      {count} {count > 1 ? "mots" : "mot"}
      {target && ` · cible ${target[0]}-${target[1]}`}
    </span>
  );
}
