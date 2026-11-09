import { matchesAccepted, normalizeAnswer } from "./answers";
import { GeneratedItemSchema, MAX_ITEMS, type GeneratedItem } from "./schema";

const clean = (values: string[] | undefined) => [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))];

export function reorderWords(sentence: string): string[] {
  return sentence.trim().replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean);
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.join(" ") !== items.join(" ")) return out;
  }
  return [...items].reverse();
}

// Validation serveur §18.6 : réponse attendue non vide, pas de doublon ; un item invalide est écarté.
export function validateItems(raw: unknown[], random: () => number = Math.random): GeneratedItem[] {
  const seen = new Set<string>();
  const out: GeneratedItem[] = [];
  for (const candidate of raw) {
    const parsed = GeneratedItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const { format } = parsed.data;
    const prompt = parsed.data.prompt.trim();
    const explanation = parsed.data.explanation.trim();
    const accepted = clean(parsed.data.accepted);
    // translate : accepted peut être vide (§18.7, la correction se fait par LLM, pas par comparaison).
    if (!prompt || !explanation || (accepted.length === 0 && format !== "translate")) continue;

    const key = `${normalizeAnswer(prompt)}|${normalizeAnswer(accepted[0] ?? "")}`;
    if (seen.has(key)) continue;

    let options: string[] | undefined;
    if (format === "mcq") {
      options = clean(parsed.data.options);
      const distinct = parsed.data.options?.length === options.length;
      if (!distinct || options.length < 3 || options.length > 4 || !options.some((o) => matchesAccepted(o, accepted))) continue;
    } else if (format === "reorder") {
      const words = reorderWords(accepted[0]);
      if (words.length < 3) continue;
      options = shuffled(words, random);
    } else if (format === "error_spot" && matchesAccepted(prompt, accepted)) {
      continue; // la phrase « fautive » est déjà correcte
    }

    seen.add(key);
    out.push({ format, prompt, accepted, explanation, ...(options ? { options } : {}) });
    if (out.length === MAX_ITEMS) break;
  }
  return out;
}
