export type Segment = { text: string; errorIndex?: number };

type Range = { start: number; end: number; errorIndex: number };

export function annotate(text: string, extraits: string[]): { segments: Segment[]; missing: number[] } {
  const ranges: Range[] = [];
  const missing: number[] = [];

  extraits.forEach((extrait, errorIndex) => {
    if (!extrait) return void missing.push(errorIndex);
    for (let from = 0; ; ) {
      const start = text.indexOf(extrait, from);
      if (start === -1) return void missing.push(errorIndex);
      const end = start + extrait.length;
      if (!ranges.some((r) => start < r.end && end > r.start)) {
        return void ranges.push({ start, end, errorIndex });
      }
      from = start + 1;
    }
  });

  ranges.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) segments.push({ text: text.slice(pos, r.start) });
    segments.push({ text: text.slice(r.start, r.end), errorIndex: r.errorIndex });
    pos = r.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return { segments, missing };
}

/** Passage de `text` qui commence à la phrase de la première erreur trouvée (sinon au début), coupé à un mot vers `max` caractères. */
export function excerpt(text: string, extraits: string[], max = 280): string {
  const hits = extraits.map((e) => (e ? text.indexOf(e) : -1)).filter((i) => i >= 0);
  const at = hits.length ? Math.min(...hits) : 0;
  const dot = text.lastIndexOf(". ", at);
  const start = Math.max(dot < 0 ? 0 : dot + 2, text.lastIndexOf("\n", at) + 1);
  const rest = text.slice(start).trim();
  if (rest.length <= max) return rest;
  const cut = rest.lastIndexOf(" ", max);
  return `${rest.slice(0, cut > 0 ? cut : max).trimEnd()}…`;
}
