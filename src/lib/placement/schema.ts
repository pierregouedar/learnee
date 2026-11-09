import { z } from "zod";
import { getProgramme, isProgrammePoint, type GrammarGroup } from "@/lib/grammar-programme";
import { WRITING_LEVELS, type PlacementOutcome, type WritingLevel } from "./score";

export const McqSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(3).max(4),
  answer: z.number().int().min(0),
});
export type Mcq = z.infer<typeof McqSchema>;

export const PlacementGrammarItemSchema = z.object({
  point: z.string().refine((p) => isProgrammePoint(p)),
  format: z.enum(["mcq", "gap"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  accepted: z.array(z.string().min(1)).min(1),
});
export type PlacementGrammarItem = z.infer<typeof PlacementGrammarItemSchema>;

export const GeneratedPlacementSchema = z.object({
  grammar: z.array(z.unknown()),
  reading: z.object({ title: z.string().min(1), text: z.string().min(1), questions: z.array(McqSchema) }),
  writing: z.object({ task: z.string().min(1) }),
  listening: z.object({ questions: z.array(McqSchema) }).optional(),
});
export type GeneratedPlacement = z.infer<typeof GeneratedPlacementSchema>;

export type PlacementContent = {
  grammar: PlacementGrammarItem[];
  reading: { title: string; text: string; questions: Mcq[] };
  writing: { task: string };
  listening?: { listeningId: string; audioUrl: string; questions: Mcq[] };
};

export const PlacementAnswersSchema = z.object({
  grammar: z.array(z.string().max(300)).max(25),
  reading: z.array(z.number().int().nullable()).max(4),
  writing: z.string().max(5000),
  listening: z.array(z.number().int().nullable()).max(3).optional(),
});
export type PlacementAnswers = z.infer<typeof PlacementAnswersSchema>;

export const WritingEvalSchema = z.object({ niveau: z.enum(WRITING_LEVELS), commentaire: z.string() });

export type PlacementResult = PlacementOutcome & {
  scores: { grammar: number; reading: number; listening?: number };
  writing: { niveau: WritingLevel; commentaire: string };
  listeningSkipped: boolean;
  startingTier: boolean; // premier test : le palier a été appliqué
};

export type PublicQuestion = { question: string; options: string[] };
export type PublicPlacement = {
  grammar: { format: "mcq" | "gap"; prompt: string; options: string[]; group: GrammarGroup }[];
  reading: { title: string; text: string; questions: PublicQuestion[] };
  writing: { task: string };
  listening?: { audioUrl: string; questions: PublicQuestion[] };
};

// Ce qui part au navigateur : ni réponses attendues, ni index des bonnes réponses.
export function publicPlacement(c: PlacementContent): PublicPlacement {
  const question = (m: Mcq): PublicQuestion => ({ question: m.question, options: m.options });
  const groups = new Map(getProgramme().points.map((p) => [p.key, p.group]));
  return {
    grammar: c.grammar.map((g) => ({
      format: g.format,
      prompt: g.prompt,
      options: g.format === "mcq" ? (g.options ?? []) : [], // jamais d'indice caché sur un trou
      group: groups.get(g.point) ?? "sentence",
    })),
    reading: { title: c.reading.title, text: c.reading.text, questions: c.reading.questions.map(question) },
    writing: { task: c.writing.task },
    ...(c.listening ? { listening: { audioUrl: c.listening.audioUrl, questions: c.listening.questions.map(question) } } : {}),
  };
}
