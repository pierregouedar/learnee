import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { callJson } from "@/lib/llm/client";
import { MAX_SENTENCE_CHARS } from "@/lib/lookup";
import { learningContext } from "@/lib/profile";

export const DefinitionSchema = z.object({
  definition: z.string().min(1),
  exemple: z.string(),
  fr: z.string().min(1),
});
export type Definition = z.infer<typeof DefinitionSchema>;

// Spec §8.3
export function buildDefinePrompt(word: string, sentence: string): string {
  const { target } = learningContext();
  return `Act as a monolingual learner's dictionary for a B1 learner of ${target}.
Define "${word}" as it is used in this context: "${sentence}".
Reply with only JSON:
{"definition": "simple ${target} definition, max 20 words",
 "exemple": "a new short example sentence",
 "fr": "French translation of \"${word}\" only (1 to 4 words), as used in this context; never the whole sentence"}`;
}

export async function define(word: string, sentence: string): Promise<Definition> {
  const w = word.trim();
  const s = sentence.trim().slice(0, MAX_SENTENCE_CHARS);
  const key = `${w.toLowerCase()}:${createHash("sha1").update(s).digest("hex")}`;
  const hit = db().prepare(`SELECT definition, exemple, fr FROM definitions WHERE key = ?`).get(key) as Definition | undefined;
  if (hit) return hit;
  const d = await callJson("define", buildDefinePrompt(w, s), DefinitionSchema);
  db()
    .prepare(`INSERT OR REPLACE INTO definitions (key, word, definition, exemple, fr, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(key, w.toLowerCase(), d.definition, d.exemple, d.fr, new Date().toISOString());
  return d;
}
