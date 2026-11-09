// Contraintes du dictionnaire (spec §8.3), partagées par le composant et par /api/define.
export const MAX_LOOKUP_CHARS = 60;
export const MAX_LOOKUP_WORDS = 4;
export const MAX_SENTENCE_CHARS = 400;

export function cleanSelection(raw: string): string | null {
  const text = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!text || text.length > MAX_LOOKUP_CHARS || !/\p{L}/u.test(text)) return null;
  if (text.split(" ").length > MAX_LOOKUP_WORDS) return null;
  return text;
}

// découpe sur . ! ? suivis d'un espace ; « Mr. Smith » coupe trop tôt, sans gravité pour une définition.
export function sentenceAround(text: string, offset: number): string {
  const boundary = /[.!?]["'”’)\]]*\s+/g;
  let start = 0;
  let end = text.length;
  for (let m = boundary.exec(text); m; m = boundary.exec(text)) {
    const after = m.index + m[0].length;
    if (after <= offset) start = after;
    else {
      end = m.index + m[0].trimEnd().length;
      break;
    }
  }
  return text.slice(start, end).trim().slice(0, MAX_SENTENCE_CHARS);
}
