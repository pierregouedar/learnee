import { z } from "zod";
import { db } from "@/lib/db";
import { programmeProgress, type Progress } from "@/lib/generation-progress";
import { generateProgramme, getProgramme } from "@/lib/grammar-programme";
import { callJson } from "@/lib/llm/client";
import { refreshHeadlines } from "@/lib/news/headlines";
import { DEFAULT_PROFILE, getProfile, GOAL_PRESET_KEYS, languageEn, saveProfile, TARGET_LEVELS, type Profile } from "@/lib/profile";

// Ce que l'écran « Ton objectif » envoie : la clé d'un thème est facultative (thème ajouté à la main).
export const ProfileInput = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/),
    goal: z.object({ preset: z.enum(GOAL_PRESET_KEYS), description: z.string().trim().max(300).optional() }),
    level: z.enum(TARGET_LEVELS),
    interests: z
      .array(z.object({ key: z.string().regex(/^[a-z0-9_-]{1,30}$/).optional(), label: z.string().trim().min(1).max(40) }))
      .min(1)
      .max(4),
  })
  .refine((p) => p.goal.preset !== "custom" || Boolean(p.goal.description));
export type ProfileInput = z.infer<typeof ProfileInput>;

export class ProfileInputError extends Error {}

/** Clé ASCII d'un thème (« Cinéma » → « cinema ») ; « libre » est réservé aux sujets hors thème. */
export function interestKey(label: string, taken: Set<string>): string {
  const base = label.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "theme";
  let key = base === "libre" ? "theme" : base;
  for (let i = 2; taken.has(key); i++) key = `${base.slice(0, 27)}-${i}`;
  taken.add(key);
  return key;
}

const QueriesSchema = z.object({
  interests: z.array(z.object({ key: z.string(), label: z.string(), query: z.string().trim().min(1).max(200) })),
});

export function buildInterestsPrompt(language: string, interests: { key: string; label: string }[]): string {
  return `A French learner of ${language} wants daily news about these themes (labels in French).
For each theme, keep "key" and "label" unchanged and write "query": a Google News search
query IN ${language.toUpperCase()}, 2 to 6 ${language} keywords or short phrases joined with OR,
that finds recent news on that theme in ${language}-language media.
Themes: ${JSON.stringify(interests)}
Reply with only JSON:
{"interests": [{"key": "...", "label": "...", "query": "..."}]}`;
}

type Step = (p: Progress) => void;

/**
 * Enregistre le profil : requêtes des thèmes dans la langue étudiée (modèle gratuit, seulement pour les
 * thèmes nouveaux), puis, pour une langue sans programme, préparation du programme de grammaire (payant, une fois).
 * Changement de langue : les titres non traités de l'ancienne langue disparaissent et les flux sont relus.
 */
export async function saveProfileFromInput(input: ProfileInput, emit: Step = () => {}): Promise<Profile> {
  const name = languageEn(input.code);
  if (!name) throw new ProfileInputError("Ce code de langue est inconnu.");
  if (input.code === "fr") throw new ProfileInputError("Le français est ta langue : choisis la langue que tu étudies.");
  const previous = getProfile();

  // Requête déjà connue : thème par défaut en anglais, ou thème inchangé de la même langue.
  const known = new Map<string, string>();
  if (input.code === "en") for (const i of DEFAULT_PROFILE.interests) known.set(`${i.key}|${i.label}`, i.query);
  if (previous.target.code === input.code) for (const i of previous.interests) known.set(`${i.key}|${i.label}`, i.query);

  const taken = new Set<string>();
  const labelled = input.interests.map((i) => {
    if (!i.key || i.key === "libre" || taken.has(i.key)) return { key: interestKey(i.label, taken), label: i.label };
    taken.add(i.key);
    return { key: i.key, label: i.label };
  });
  const missing = labelled.filter((i) => !known.has(`${i.key}|${i.label}`));
  if (missing.length > 0) {
    emit({ label: "Traduction des thèmes", pct: 5 });
    try {
      const out = await callJson("define", buildInterestsPrompt(name, missing), QueriesSchema);
      const labelOf = new Map(missing.map((m) => [m.key, m.label]));
      for (const i of out.interests) if (labelOf.has(i.key)) known.set(`${i.key}|${labelOf.get(i.key)}`, i.query);
    } catch (e) {
      // Sans traduction, le libellé sert de requête : les actualités restent possibles, moins ciblées.
      console.error("[profile] traduction des thèmes impossible", e);
    }
  }

  emit({ label: "Enregistrement", pct: 15 });
  const profile: Profile = {
    target: { code: input.code, name },
    goal: { preset: input.goal.preset, ...(input.goal.description ? { description: input.goal.description } : {}) },
    level: input.level,
    interests: labelled.map((i) => ({ ...i, query: known.get(`${i.key}|${i.label}`) ?? i.label })),
  };
  saveProfile(profile);

  if (previous.target.code !== profile.target.code) {
    db().prepare(`DELETE FROM news_items WHERE used = 0`).run();
    void refreshHeadlines(true).catch((e) => console.error("[profile] relecture des flux", e));
  }

  if (profile.target.code !== "en" && getProgramme(profile).points.length === 0) {
    emit({ label: "Programme de grammaire", pct: 20 });
    await generateProgramme(profile, (text) => emit(programmeProgress(text)));
  }
  return profile;
}
