import { z } from "zod";

export const LISTENING_FORMATS = ["interview", "podcast", "debate", "radio_ad", "news"] as const;
export type ListeningFormat = (typeof LISTENING_FORMATS)[number];
export type ListeningLevel = "B1" | "B1+" | "B2";

export const FORMAT_LABELS: Record<ListeningFormat, string> = {
  interview: "Interview",
  podcast: "Podcast",
  debate: "Débat",
  radio_ad: "Spot radio",
  news: "Bulletin d'info",
};

// Une réplique du script, avant synthèse.
export type ScriptLine = { speaker: string; text: string };
// Une réplique (ou une phrase) horodatée dans l'audio final.
export type Segment = { speaker: string; text: string; startMs: number; endMs: number };

export const ListeningScriptSchema = z.object({
  title: z.string().min(1),
  context: z.string().min(1),
  segments: z
    .array(z.object({ speaker: z.string().min(1), role: z.string().optional(), text: z.string().min(1) }))
    .min(1),
});

export const ListeningResultSchema = z.object({
  note: z.number(),
  comprises: z.array(z.string()),
  manquees: z.array(z.string()),
  contresens: z.array(z.object({ idee: z.string(), explication: z.string() })),
  conseil: z.string(),
});
export type ListeningResult = z.infer<typeof ListeningResultSchema>;

// Audio réel importé : le modèle ne produit que le titre et la mise en situation.
export const ListeningContextSchema = z.object({
  title: z.string().min(1),
  context: z.string().min(1),
  format: z.enum(LISTENING_FORMATS).catch("podcast"),
  domain: z.string().catch("libre"), // clé d'un thème du profil, sinon ramenée à "libre" par le service
});
