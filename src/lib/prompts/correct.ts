import { z } from "zod";
import { getProgramme } from "@/lib/grammar-programme";
import { learningContext } from "@/lib/profile";
import { CorrectionSchema } from "@/lib/schemas";
import { TIERS, type Tier } from "@/lib/tiers";

const CORRECTION_JSON_SCHEMA = JSON.stringify(z.toJSONSchema(CorrectionSchema, { io: "input", unrepresentable: "any" }));

type Input = { tier: Tier; article: string; task: string; cr: string; pe: string; guideQuestions: string[] };

export function buildCorrectionPrompt({ tier, article, task, cr, pe, guideQuestions }: Input): string {
  const t = TIERS[tier];
  const ctx = learningContext();
  const part1 = t.crWords
    ? `PART 1 – compte rendu written in French (should give the essential ideas in about
${t.crWords[0]}-${t.crWords[1]} words, no personal opinion, no word-for-word translation):`
    : `PART 1 – guided compte rendu written in French: the student answers these questions
about the article, in short sentences:
${guideQuestions.map((q) => `- ${q}`).join("\n")}`;

  return `You are ${ctx.examiner} correcting a practice paper
(${ctx.target}, expected level ${ctx.level}; the student's goal: ${ctx.goalLine}). Be demanding but
encouraging, and write ALL comments and explanations in simple French for the
student.

ARTICLE:
"""${article}"""

${part1}
"""${cr}"""

PART 2 – task: ${task}
Student's ${ctx.target} text (expected ${t.peWords[0]}-${t.peWords[1]} words):
"""${pe}"""

The student is at tier ${tier}/3 (1 = guided, 3 = real exam). Grade against what
is expected at this tier, not against the final exam, and say in the comment
what would be needed to reach the next tier.

Grade each part out of 10 (half points allowed) using these criteria:
part 1 = understanding and restitution of key ideas, organisation, clarity;
part 2 = task completion, coherence, range and accuracy of ${ctx.target}, appropriate
register. An empty part gets 0.
For part 2, list up to 12 of the most useful errors. "extrait" must be copied
EXACTLY, character for character, from the student's text (keep it short: the
few words that are wrong). "correction" is the corrected wording. Classify each
"type" as one of: grammaire, vocabulaire, orthographe, registre, structure.
For each error of type "grammaire", set "categorie" to one of:
${getProgramme().points.map((p) => p.key).join(", ")}.
"niveau" is your estimate of the CEFR level of the ${ctx.target} text.
"version_amelioree" is a corrected, improved version of the student's ${ctx.target} text
at the level expected for this tier.
Give 6 to 10 vocabulary items (${ctx.target} word or expression from the article or the
topic, French translation, short ${ctx.target} example).
Reply with only JSON matching this JSON schema:
${CORRECTION_JSON_SCHEMA}`;
}
