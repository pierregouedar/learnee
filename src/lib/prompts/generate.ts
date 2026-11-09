import { learningContext } from "@/lib/profile";
import { TIERS, type Tier } from "@/lib/tiers";

const TIER_RULES: Record<Tier, string> = {
  1: "Difficulty tier 1/3: short sentences, common vocabulary (B1), no idioms.",
  2: "Difficulty tier 2/3: B1+/B2 vocabulary, a few business expressions.",
  3: "Difficulty tier 3/3: real exam format, B2.",
};

const tier1Fields = (target: string) => `,
 "guide_questions": ["3 or 4 questions IN FRENCH that guide a summary of the key ideas"],
 "keywords": [{"word": "a key word from the article", "definition": "simple ${target} definition"}],
 "structure": "a 3-5 line outline IN FRENCH of the expected ${target} text"`;

const tier1Rule = (target: string) => `Also return "guide_questions" (3 or 4 questions IN FRENCH), "keywords" (5 or 6 key
words of the article with a simple ${target} definition) and "structure" (a short outline
IN FRENCH of the expected ${target} text).`;

function taskHeader(tier: Tier, taskType: string): string {
  const t = TIERS[tier];
  const ctx = learningContext();
  return `The student is ${ctx.native}. Goal: ${ctx.goalLine}
(target level ${ctx.level} of the CEFR). The production task must be: ${taskType}.
Write the task instructions IN FRENCH, as in the real exam: ${ctx.taskSetting}, say who writes to whom and why, list 2 or
3 points to include, and ask for ${t.peWords[0]} to ${t.peWords[1]} words in ${ctx.target}.`;
}

export function topicBlock(topic: string): string {
  return `The topic chosen by the student: "${topic}". Use only well-established general knowledge; do not invent specific recent events or figures.`;
}

// Spec §8.1, mode Actu : le brief (titre + résumé RSS + source + date) est la seule source de faits.
export function newsBlock(brief: string): string {
  return `Base the article ONLY on these facts from recent news (you may add general background knowledge, but no new specific facts, figures or events): """${brief}"""`;
}

export function buildGeneratePrompt({ tier, taskType, sourceBlock }: { tier: Tier; taskType: string; sourceBlock: string }): string {
  const t = TIERS[tier];
  const { target } = learningContext();
  return `${taskHeader(tier, taskType)}

Write an original press article in ${target} for exam training.
${sourceBlock}
Requirements: ${t.articleWords[0]} to ${t.articleWords[1]} words, ${t.paragraphs} paragraphs, the style of a quality
newspaper or trade magazine, ${t.vocab} vocabulary, several points of view. Never invent quotations
attributed to real named people; if you need a quote, attribute it to an unnamed
"analyst" or "marketing consultant".
${TIER_RULES[tier]}
${tier === 1 ? tier1Rule(target) : ""}

Reply with only JSON:
{"title": "${target} headline", "article": "paragraphs separated by a blank line",
 "task": "the task instructions in French"${tier === 1 ? tier1Fields(target) : ""}}`;
}

export function buildPastePrompt({ tier, taskType, article }: { tier: Tier; taskType: string; article: string }): string {
  const { target } = learningContext();
  return `${taskHeader(tier, taskType)}

Here is a real ${target} article the student will work on: """${article}"""
${TIER_RULES[tier]}
${tier === 1 ? tier1Rule(target) : ""}

Reply with only JSON:
{"title": "${target} headline", "task": "the task instructions in French"${tier === 1 ? tier1Fields(target) : ""}}`;
}
