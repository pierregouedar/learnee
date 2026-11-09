import { z } from "zod";
import { db } from "@/lib/db";
import { getJsonSetting, setJsonSetting } from "@/lib/repo/settings";
import { ALL_TASK_TYPES } from "@/lib/tiers";

export const GOAL_PRESET_KEYS = ["bts-com", "certification", "bac", "b2", "pro", "custom"] as const;
export type GoalPreset = (typeof GOAL_PRESET_KEYS)[number];

export const TARGET_LEVELS = ["B1", "B2", "C1"] as const;

export const ProfileSchema = z
  .object({
    // code ISO 639-1 ("en", "es"…), name = nom anglais de la langue, pour les prompts
    target: z.object({ code: z.string().regex(/^[a-z]{2,3}$/), name: z.string().trim().min(2).max(40) }),
    goal: z.object({ preset: z.enum(GOAL_PRESET_KEYS), description: z.string().trim().max(300).optional() }),
    level: z.enum(TARGET_LEVELS),
    interests: z
      .array(z.object({ key: z.string().regex(/^[a-z0-9_-]+$/), label: z.string().trim().min(1).max(40), query: z.string().trim().min(1).max(200) }))
      .min(1)
      .max(4),
  })
  .refine((p) => p.goal.preset !== "custom" || Boolean(p.goal.description), { message: "Décris ton objectif." });
export type Profile = z.infer<typeof ProfileSchema>;

type GoalInfo = {
  label: string; // FR, pour l'interface
  hint: string; // FR, une ligne sous le libellé dans l'écran « Ton objectif »
  exam: boolean; // objectif d'examen : l'interface parle de « l'examen », sinon de « ton objectif »
  promptLine: string; // EN, décrit l'objectif au modèle
  examiner: (target: string) => string; // EN, rôle du correcteur
  taskTypes: readonly string[]; // FR, types de textes à écrire
  themes: string; // EN, univers des phrases d'exercice
  taskSetting: string; // EN, mise en situation des consignes d'écriture
  situation: string; // EN, mise en situation des écoutes
  oralPractice: string; // EN, séance d'oral avec le tuteur
};

const GENERIC_SETTING = {
  themes: "everyday life, studies, work and current affairs",
  taskSetting: "set a realistic context linked to the article",
  situation: "a realistic everyday or work situation",
  oralPractice: "this week's oral practice",
};

const teacher = (target: string) => `an experienced ${target} teacher`;
const GENERIC_TASKS = [
  "un courriel",
  "un message à un ami ou à un collègue",
  "un court article de blog",
  "un texte argumenté (pour ou contre)",
] as const;

export const GOAL_PRESETS: Record<GoalPreset, GoalInfo> = {
  "bts-com": {
    label: "BTS Communication",
    hint: "L’épreuve écrite E21 en anglais, sujets de communication.",
    exam: true,
    promptLine: "preparing the BTS Communication written English exam (épreuve E21)",
    examiner: () => "an experienced BTS examiner in France",
    taskTypes: ALL_TASK_TYPES,
    themes: "professional communication (campaigns, clients, social media, events, press)",
    taskSetting: "set a realistic professional context (the student works in communication for a French company, agency or brand linked to the article)",
    situation: "a communication job",
    oralPractice: "this week's oral practice (E22 simulation)",
  },
  certification: {
    label: "Certification de langue",
    hint: "TOEIC, TOEFL, IELTS, Cambridge, DELE, Goethe…",
    exam: true,
    promptLine: "preparing an official language certification exam (reading and writing)",
    examiner: (target) => `an experienced ${target} certification examiner`,
    taskTypes: ["un courriel formel", "un courriel informel", "un essai argumenté", "une lettre de réclamation"],
    ...GENERIC_SETTING,
  },
  bac: {
    label: "Baccalauréat",
    hint: "L’épreuve de langue vivante du bac.",
    exam: true,
    promptLine: "preparing the French baccalauréat foreign language exam",
    examiner: (target) => `an experienced ${target} teacher and baccalauréat examiner in France`,
    taskTypes: ["un essai argumenté", "un courriel", "un article de journal lycéen", "un dialogue"],
    ...GENERIC_SETTING,
    themes: "topics of the French lycée programme (society, environment, technology, culture)",
  },
  b2: {
    label: "Niveau B2 général",
    hint: "Un bon niveau général, sans examen précis.",
    exam: false,
    promptLine: "working towards a solid general level in the language",
    examiner: teacher,
    taskTypes: GENERIC_TASKS,
    ...GENERIC_SETTING,
  },
  pro: {
    label: "Usage professionnel",
    hint: "Courriels, réunions, comptes rendus.",
    exam: false,
    promptLine: "improving the language for professional use (emails, meetings, reports)",
    examiner: (target) => `an experienced business ${target} trainer`,
    taskTypes: ["un courriel professionnel", "un compte rendu de réunion", "une présentation de projet", "une réponse à un client"],
    themes: "professional life (clients, meetings, projects, emails)",
    taskSetting: "set a realistic professional context linked to the article",
    situation: "a professional situation",
    oralPractice: "this week's oral practice",
  },
  custom: {
    label: "Objectif personnel",
    hint: "Tu le décris en une phrase.",
    exam: false,
    promptLine: "learning the language for a personal goal",
    examiner: teacher,
    taskTypes: GENERIC_TASKS,
    ...GENERIC_SETTING,
  },
};

export const DEFAULT_PROFILE: Profile = {
  target: { code: "en", name: "English" },
  goal: { preset: "bts-com" },
  level: "B2",
  interests: [
    { key: "comm", label: "Comm", query: "advertising campaign OR brand marketing OR influencer" },
    { key: "ia", label: "IA", query: "artificial intelligence business OR generative AI" },
    { key: "auto", label: "Auto", query: "carmaker OR electric vehicles Europe" },
  ],
};

const KEY = "profile";

export function hasSavedProfile(): boolean {
  return getJsonSetting<unknown>(KEY, null) !== null;
}

// Profil illisible (ancienne forme, JSON abîmé) : profil par défaut plutôt qu'une page en erreur.
export function getProfile(): Profile {
  const parsed = ProfileSchema.safeParse(getJsonSetting<unknown>(KEY, null));
  return parsed.success ? parsed.data : DEFAULT_PROFILE;
}

export function saveProfile(profile: Profile) {
  setJsonSetting(KEY, ProfileSchema.parse(profile));
}

/**
 * Premier passage sur l'accueil : sans profil enregistré ni activité, l'élève choisit son objectif.
 * Une installation déjà utilisée (copies, cartes, grammaire, test) garde l'anglais / BTS sans rien demander.
 */
export function needsOnboarding(): boolean {
  if (hasSavedProfile()) return false;
  const { active } = db()
    .prepare(
      `SELECT EXISTS (SELECT 1 FROM sessions) OR EXISTS (SELECT 1 FROM cards)
         OR EXISTS (SELECT 1 FROM grammar_attempts) OR EXISTS (SELECT 1 FROM placements) AS active`,
    )
    .get() as { active: number };
  if (!active) return true;
  saveProfile(DEFAULT_PROFILE);
  return false;
}

export const isExamGoal = (profile: Profile = getProfile()): boolean => GOAL_PRESETS[profile.goal.preset].exam;

/** Nom français de la langue, en minuscules (« anglais », « espagnol ») ; le code s'il est inconnu. */
export const languageFr = (code: string): string => (new Intl.DisplayNames("fr", { type: "language" }).of(code) ?? code).toLowerCase();

/** Nom anglais de la langue (« Spanish »), pour les prompts ; undefined si le code est inconnu. */
export function languageEn(code: string): string | undefined {
  try {
    const name = new Intl.DisplayNames("en", { type: "language", fallback: "none" }).of(code);
    return name && name.toLowerCase() !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

export type LearningContext = {
  target: string; // "English"
  targetFr: string; // "anglais"
  native: string; // "French"
  goalLine: string;
  examiner: string;
  level: Profile["level"];
  themes: string;
  taskSetting: string;
  situation: string;
  oralPractice: string;
};

export function learningContext(profile: Profile = getProfile()): LearningContext {
  const goal = GOAL_PRESETS[profile.goal.preset];
  const target = profile.target.name;
  return {
    target,
    targetFr: languageFr(profile.target.code),
    native: "French",
    goalLine: profile.goal.preset === "custom" && profile.goal.description ? profile.goal.description : goal.promptLine,
    examiner: goal.examiner(target),
    level: profile.level,
    themes: goal.themes,
    taskSetting: goal.taskSetting,
    situation: goal.situation,
    oralPractice: goal.oralPractice,
  };
}

// Voix du navigateur : l'anglais reste en britannique, comme avant.
export const bcp47 = (code: string): string => (code === "en" ? "en-GB" : code);

// Langue étudiée telle que l'interface en a besoin (attribut lang, voix, textes).
export type TargetLanguage = { code: string; name: string; nameFr: string; bcp47: string };

export function targetLanguage(profile: Profile = getProfile()): TargetLanguage {
  const { code, name } = profile.target;
  return { code, name, nameFr: languageFr(code), bcp47: bcp47(code) };
}

// Domaine d'un sujet ou d'une actualité : clé d'un thème d'intérêt du profil, ou "libre".
export const domainLabels = (profile: Profile = getProfile()): Record<string, string> => ({
  ...Object.fromEntries(profile.interests.map((i) => [i.key, i.label])),
  libre: "Libre",
});

export const domainLabel = (key: string, profile: Profile = getProfile()): string => domainLabels(profile)[key] ?? key;

export const isInterest = (key: string, profile: Profile = getProfile()): boolean => profile.interests.some((i) => i.key === key);
