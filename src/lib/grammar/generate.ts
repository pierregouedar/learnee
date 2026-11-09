import type { GrammarPoint } from "@/lib/grammar-programme";
import { callJson } from "@/lib/llm/client";
import { buildGrammarSetPrompt } from "@/lib/prompts/grammar";
import { GeneratedSetSchema, LessonSchema, MIN_ITEMS, type GeneratedItem, type GrammarLevel, type Lesson } from "./schema";
import { validateItems } from "./validate";

export class GrammarGenerationError extends Error {}

export async function generateSet(point: GrammarPoint, level: GrammarLevel): Promise<{ items: GeneratedItem[]; lesson: Lesson }> {
  const prompt = buildGrammarSetPrompt({ point, level });
  // Une relance si leçon absente ou trop d'items invalides (même règle que la longueur d'article, §8.1).
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await callJson("grammar_set", prompt, GeneratedSetSchema, point);
    const items = validateItems(data.items);
    const lesson = LessonSchema.safeParse(data.lesson);
    if (lesson.success && items.length >= MIN_ITEMS) return { items, lesson: lesson.data };
  }
  throw new GrammarGenerationError("La série préparée était incomplète. Réessaie dans un instant.");
}
