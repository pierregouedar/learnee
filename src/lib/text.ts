export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function roundNote(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n * 2) / 2));
}

export function isArticleLengthOk(words: number, [min, max]: readonly [number, number]): boolean {
  return words >= Math.floor(min * 0.85) && words <= Math.floor(max * 1.15);
}

// Forme normalisée pour dédupliquer (cartes §16.3, titres d'actu §7.2) : minuscules, sans ponctuation.
export function normalizeKey(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
