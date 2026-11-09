import { subjectProgress, type Progress } from "@/lib/generation-progress";
import { callJson } from "@/lib/llm/client";
import { getProfile, GOAL_PRESETS, type Profile } from "@/lib/profile";
import { buildGeneratePrompt, buildPastePrompt, newsBlock, topicBlock } from "@/lib/prompts/generate";
import { getTier } from "@/lib/repo/settings";
import { insertSubject, type Subject } from "@/lib/repo/subjects";
import { GeneratedSubjectSchema, PastedSubjectSchema } from "@/lib/schemas";
import { countWords, isArticleLengthOk } from "@/lib/text";
import { TIERS, type Tier } from "@/lib/tiers";

export type GenerateInput =
  | { mode: "topic"; topic: string }
  | { mode: "paste"; article: string }
  | { mode: "rss"; domain: string; brief: string; url: string };

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

// BTS Communication : types de textes du palier (courts au palier 1). Autre objectif : ceux de l'objectif.
export const taskTypesFor = (tier: Tier, profile: Profile = getProfile()): readonly string[] =>
  profile.goal.preset === "bts-com" ? TIERS[tier].taskTypes : GOAL_PRESETS[profile.goal.preset].taskTypes;

export async function generateSubject(input: GenerateInput, tier: Tier = getTier(), onProgress?: (p: Progress) => void): Promise<Subject> {
  const taskType = pick(taskTypesFor(tier));
  const [min, max] = TIERS[tier].articleWords;
  const onText = onProgress && ((text: string) => onProgress(subjectProgress(text, Math.round((min + max) / 2))));
  onProgress?.({ label: "Préparation du sujet", pct: 2 });

  if (input.mode === "paste") {
    const data = await callJson("generate", buildPastePrompt({ tier, taskType, article: input.article }), PastedSubjectSchema, undefined, onText);
    return insertSubject({
      domain: "libre", source: "paste", tier, title: data.title, article: input.article, task: data.task,
      guideQuestions: data.guide_questions ?? [], keywords: data.keywords ?? [], structure: data.structure,
    });
  }

  const sourceBlock = input.mode === "rss" ? newsBlock(input.brief) : topicBlock(input.topic);
  const prompt = buildGeneratePrompt({ tier, taskType, sourceBlock });
  let data = await callJson("generate", prompt, GeneratedSubjectSchema, undefined, onText);
  // Longueur hors palier ±15 % : une relance, puis on garde (spec §8.1).
  if (!isArticleLengthOk(countWords(data.article), TIERS[tier].articleWords)) {
    onProgress?.({ label: "Article hors longueur, nouvelle rédaction", pct: 5 });
    data = await callJson("generate", prompt, GeneratedSubjectSchema, undefined, onText);
  }
  return insertSubject({
    domain: input.mode === "rss" ? input.domain : "libre",
    source: input.mode,
    sourceRef: input.mode === "rss" ? input.url : input.topic,
    tier, title: data.title, article: data.article, task: data.task,
    guideQuestions: data.guide_questions ?? [], keywords: data.keywords ?? [], structure: data.structure,
  });
}
