import { normalizeKey } from "@/lib/text";

export const CHOICE_COUNT = 4;

// Petit générateur déterministe : les options d'une carte ne bougent pas d'un rendu à l'autre.
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * QCM façon Duolingo : la bonne traduction + 3 autres traductions tirées des autres cartes.
 * Retourne null s'il n'y a pas assez de traductions différentes (la carte reste en mode « retourner »).
 */
export function buildChoices(cardId: string, answer: string, pool: string[]): string[] | null {
  const key = normalizeKey(answer);
  if (!key) return null;
  const rand = seeded(cardId);
  const seen = new Set([key]);
  const others: string[] = [];
  for (const fr of [...pool].sort(() => rand() - 0.5)) {
    const k = normalizeKey(fr);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    others.push(fr);
    if (others.length === CHOICE_COUNT - 1) break;
  }
  if (others.length < CHOICE_COUNT - 1) return null;
  const choices = [answer, ...others];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
