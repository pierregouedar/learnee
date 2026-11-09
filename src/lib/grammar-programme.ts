import { z } from "zod";
import { ENGLISH_POINTS } from "@/lib/grammar-points";
import { IRREGULAR_VERBS, type IrregularVerb } from "@/lib/grammar/irregular-verbs";
import { callJson } from "@/lib/llm/client";
import { getProfile, learningContext, type Profile } from "@/lib/profile";
import { getJsonSetting, setJsonSetting } from "@/lib/repo/settings";

// Clé d'un point du programme (« present_perfect »…) : texte libre, le programme dépend de la langue étudiée.
export type GrammarPoint = string;
export type GrammarGroup = "verbs" | "sentence" | "words";

export type ProgrammePoint = {
  key: string;
  label: string; // FR
  focus: string; // EN, consigne de leçon
  group: GrammarGroup;
  period: 0 | 1 | 2 | 3;
};
export type Programme = { language: string; points: ProgrammePoint[]; verbs: IrregularVerb[] };

export const ENGLISH_PROGRAMME: Programme = { language: "en", points: ENGLISH_POINTS, verbs: IRREGULAR_VERBS };

const settingKey = (code: string) => `grammar_programme:${code}`;

// Anglais : programme écrit à la main. Autre langue : programme préparé une fois (generateProgramme), vide sinon.
export function getProgramme(profile: Profile = getProfile()): Programme {
  const code = profile.target.code;
  if (code === "en") return ENGLISH_PROGRAMME;
  return getJsonSetting<Programme>(settingKey(code), { language: code, points: [], verbs: [] });
}

export const isProgrammePoint = (value: unknown, programme = getProgramme()): value is GrammarPoint =>
  programme.points.some((p) => p.key === value);

export const pointLabel = (point: GrammarPoint, programme = getProgramme()): string =>
  programme.points.find((p) => p.key === point)?.label ?? point;

// Périodes de l'année scolaire : sept.-oct., nov.-déc., janv.-févr., mars-avril ; de mai à août, tout le programme.
export const PERIOD_MONTHS: readonly (readonly number[])[] = [[9, 10], [11, 12], [1, 2], [3, 4]];

/** Points vus jusqu'à la période de `date` incluse, dans l'ordre du programme. */
export function programmeUpTo(date: Date, programme = getProgramme()): GrammarPoint[] {
  const month = date.getMonth() + 1;
  const index = PERIOD_MONTHS.findIndex((m) => m.includes(month));
  const last = index === -1 ? PERIOD_MONTHS.length - 1 : index;
  return programme.points.filter((p) => p.period <= last).map((p) => p.key);
}

const GeneratedProgrammeSchema = z.object({
  points: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9_]+$/),
        label: z.string().min(1),
        focus: z.string().min(1),
        group: z.enum(["verbs", "sentence", "words"]),
        period: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      }),
    )
    .min(15)
    .max(20)
    .refine((ps) => new Set(ps.map((p) => p.key)).size === ps.length, { message: "duplicate keys" }),
  verbs: z
    .array(z.object({ base: z.string().min(1), past: z.string().min(1), participle: z.string().min(1), fr: z.string().min(1), example: z.string().min(1) }))
    .max(60),
});

export function buildProgrammePrompt(profile: Profile): string {
  const ctx = learningContext(profile);
  return `Design a ${ctx.target} grammar programme for a ${ctx.native} learner (target level ${ctx.level},
goal: ${ctx.goalLine}). The school year has 4 periods: 0 = September-October,
1 = November-December, 2 = January-February, 3 = March-April.

"points": 15 to 20 grammar points, ordered from the most basic to the most advanced,
spread over the 4 periods (period never decreases along the list). Each point:
- "key": a short unique ASCII slug in snake_case (e.g. "past_tense", "articles");
- "label": a short name IN FRENCH for the student (e.g. "Le passé composé");
- "focus": 1 to 3 sentences IN ENGLISH saying what a lesson on this point must cover
  (forms, contrasts, typical mistakes of ${ctx.native} speakers);
- "group": "verbs" (tenses, conjugation, verb forms), "sentence" (word order, questions,
  clauses, connectors) or "words" (articles, prepositions, small words, agreement);
- "period": 0, 1, 2 or 3.

"verbs": up to 60 of the most useful irregular or common verbs to memorise, from the most
frequent, each {"base": infinitive, "past": main past form, "participle": past participle or
second key form, "fr": French translation, "example": one short ${ctx.target} sentence using the
past or participle form}. Use an empty list if ${ctx.target} has no irregular verbs to learn.

Reply with only JSON:
{"points": [{"key": "...", "label": "...", "focus": "...", "group": "verbs", "period": 0}],
 "verbs": [{"base": "...", "past": "...", "participle": "...", "fr": "...", "example": "..."}]}`;
}

// Tâche payante, lancée une seule fois par langue ; le résultat est gardé dans les réglages.
export async function generateProgramme(profile: Profile = getProfile(), onText?: (text: string) => void): Promise<Programme> {
  const code = profile.target.code;
  const data = await callJson("grammar_set", buildProgrammePrompt(profile), GeneratedProgrammeSchema, settingKey(code), onText);
  // L'ordre du programme suit les périodes, même si le modèle les a mélangées (tri stable).
  const points = [...data.points].sort((a, b) => a.period - b.period);
  const programme: Programme = { language: code, points, verbs: data.verbs };
  setJsonSetting(settingKey(code), programme);
  return programme;
}
