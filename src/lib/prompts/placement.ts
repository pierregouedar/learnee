import { getProgramme } from "@/lib/grammar-programme";
import { getProfile, learningContext } from "@/lib/profile";

export function buildPlacementPrompt({ transcript }: { transcript?: string }): string {
  const ctx = learningContext();
  const t = ctx.target;
  const en = getProfile().target.code === "en";
  const listening = transcript
    ? `4. "listening": exactly 3 multiple-choice questions IN FRENCH, same shape as the
reading questions, about this audio transcript: """${transcript}"""
`
    : "";
  return `Create a placement test for a ${ctx.native} student of ${t} (goal: ${ctx.goalLine},
target level ${ctx.level}). Everything relates to ${ctx.themes}.

1. "grammar": exactly 20 short items covering these grammar points, about one item
per point, from easy to hard: ${getProgramme().points.map((p) => p.key).join(", ")}.
Each item: {"point": one of the keys above, "format": "gap" or "mcq",
"prompt": one ${t} sentence with "___", "options": exactly 3 choices (mcq only),
"accepted": every correct answer (only the missing words)}.
STRICT rules so that every item has ONE clear answer:
- Verb items (tenses, irregular verbs, passive, conditionals, reported speech,
  gerund/infinitive): format "gap", and the base verb MUST be written in brackets
  right after the blank${en ? `, e.g. "She ___ (work) here since 2022." or
  "We enjoy ___ (meet) new customers."` : "."} The student only conjugates that verb.
- All other items (articles, prepositions, relatives, comparatives, modals,
  questions, connectors, opinion): format "mcq" with exactly 3 options, exactly ONE
  of which is correct. Never a free gap for them.
- Never write an item where several different words could fit.
2. "reading": an original ${t} text of 200 to 250 words for tier 1 (short
sentences, common B1 vocabulary, no idioms, 3 or 4 paragraphs separated by a blank
line), with a "title" and exactly 4 multiple-choice "questions" IN FRENCH on its key
ideas: {"question": "...", "options": ["3 options IN FRENCH"], "answer": index of the
right option, starting at 0}.
3. "writing": {"task": "instructions IN FRENCH for a short professional email or
message of about 60 words in ${t}"}.
${listening}Never invent quotations attributed to real named people.
Reply with only JSON:
{"grammar": [...], "reading": {"title": "...", "text": "...", "questions": [...]},
 "writing": {"task": "..."}${transcript ? ', "listening": {"questions": [...]}' : ""}}`;
}

export function buildPlacementWritingPrompt({ task, text }: { task: string; text: string }): string {
  const ctx = learningContext();
  return `You are ${ctx.examiner}. Estimate the CEFR level of this short ${ctx.target} text
written by a ${ctx.native} student for this task (in French): ${task}
Text: """${text}"""
Judge the range and accuracy of the ${ctx.target} only. Write the comment in simple French.
Reply with only JSON:
{"niveau": "A1" | "A2" | "B1" | "B1+" | "B2" | "C1", "commentaire": "1 or 2 sentences IN FRENCH"}`;
}
