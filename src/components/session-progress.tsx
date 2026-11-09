/** Barre d'avancement d'une série (grammaire, révisions) : « Question 3 sur 10 » + barre sans piste chargée. */
export function SessionProgress({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {label}
      </p>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
