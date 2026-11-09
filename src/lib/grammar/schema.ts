import { z } from "zod";
import type { GrammarPoint } from "@/lib/grammar-programme";
import type { Tier } from "@/lib/tiers";

export const GRAMMAR_FORMATS = ["gap", "error_spot", "transform", "translate", "reorder", "mcq"] as const;
export type GrammarFormat = (typeof GRAMMAR_FORMATS)[number];

export type GrammarLevel = "A2" | "B1" | "B1+" | "B2";
export const LEVEL_BY_TIER: Record<Tier, GrammarLevel> = { 1: "A2", 2: "B1", 3: "B2" };

export const SET_SIZE = 12; // demandé au modèle (§18.1 : 10 à 15 items)
export const MIN_ITEMS = 8; // en dessous, la série est rejetée
export const MAX_ITEMS = 15;

export const GeneratedItemSchema = z.object({
  format: z.enum(GRAMMAR_FORMATS),
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  accepted: z.array(z.string()),
  explanation: z.string(),
});
export type GeneratedItem = z.infer<typeof GeneratedItemSchema>;

// Leçon affichée avant la première question de la série.
const Example = z.object({ en: z.string().min(1), fr: z.string().min(1) });
export const LessonSchema = z.object({
  summary: z.string().min(10), // FR : l'idée à retenir
  forms: z
    .array(z.object({ name: z.string().min(1), use: z.string().min(1), form: z.string().min(1), signals: z.array(z.string()).default([]), examples: z.array(Example).min(1) }))
    .min(1)
    .max(4),
  pitfalls: z.array(z.object({ wrong: z.string().min(1), right: z.string().min(1), why: z.string().min(1) })).min(1).max(4),
});
export type Lesson = z.infer<typeof LessonSchema>;

// Items validés un par un (validate.ts) : un item mal formé ne fait pas rejeter toute la série.
export const GeneratedSetSchema = z.object({ lesson: z.unknown().optional(), items: z.array(z.unknown()) });

export const TranslateCheckSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
  correction: z.string(),
});

export type MasteryState = {
  point: GrammarPoint;
  scores: { score: number; at: string }[];
  masteredAt?: string;
  nextReviewAt?: string;
};
