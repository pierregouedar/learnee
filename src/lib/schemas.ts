import { z } from "zod";

export const VocabItemSchema = z.object({ en: z.string(), fr: z.string(), exemple: z.string().optional() });
export type VocabItem = z.infer<typeof VocabItemSchema>;

export const ERROR_TYPES = ["grammaire", "vocabulaire", "orthographe", "registre", "structure"] as const;

export const ErrorItemSchema = z.object({
  extrait: z.string(),
  correction: z.string(),
  explication: z.string(),
  type: z.enum(ERROR_TYPES),
  // Clé du programme de grammaire ; une catégorie hors programme est ignorée là où elle sert.
  categorie: z.string().optional().catch(undefined),
});
export type ErrorItem = z.infer<typeof ErrorItemSchema>;

export const CorrectionSchema = z.object({
  compte_rendu: z.object({
    note: z.number(),
    commentaire: z.string(),
    idees_manquantes: z.array(z.string()),
  }),
  expression: z.object({
    note: z.number(),
    niveau: z.enum(["A2", "B1", "B1+", "B2", "C1"]),
    erreurs: z.array(ErrorItemSchema),
    points_forts: z.array(z.string()),
    version_amelioree: z.string(),
  }),
  vocabulaire: z.array(VocabItemSchema),
  conseil: z.string(),
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const KeywordSchema = z.object({ word: z.string(), definition: z.string() });

export const GeneratedSubjectSchema = z.object({
  title: z.string().min(1),
  article: z.string().min(1),
  task: z.string().min(1),
  guide_questions: z.array(z.string()).optional(),
  keywords: z.array(KeywordSchema).optional(),
  structure: z.string().optional(),
});
export type GeneratedSubject = z.infer<typeof GeneratedSubjectSchema>;

export const PastedSubjectSchema = GeneratedSubjectSchema.omit({ article: true });
export type PastedSubject = z.infer<typeof PastedSubjectSchema>;
