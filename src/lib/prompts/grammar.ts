import { getProgramme, pointLabel, type GrammarPoint } from "@/lib/grammar-programme";
import { getProfile, learningContext } from "@/lib/profile";
import { SET_SIZE, type GrammarLevel } from "@/lib/grammar/schema";

export function buildGrammarSetPrompt({ point, level }: { point: GrammarPoint; level: GrammarLevel }): string {
  const entry = getProgramme().points.find((p) => p.key === point);
  const ctx = learningContext();
  const t = ctx.target;
  // Exemples concrets en anglais seulement ; pour une autre langue, consignes neutres.
  const en = getProfile().target.code === "en";
  return `Create a grammar practice set for a ${ctx.native} learner of ${t} (level ${level},
goal: ${ctx.goalLine}). Grammar point: ${point} (${entry?.label ?? point}). ${SET_SIZE} items, formats:
gap, error_spot, transform, translate, reorder, mcq (about 2 of each, at most 2 translate).
All sentences must relate to ${ctx.themes}. For each item give the prompt, all accepted
answers, and a short explanation IN FRENCH of the rule.

Start with a lesson IN FRENCH, written for a student who is about to practise
(plain words, explain any grammar term). Lesson focus: ${entry?.focus ?? ""}
- "summary": ONE sentence giving the key idea to remember (for a contrast: how to choose).
- "forms": one block per form or use in the focus (a contrast of two tenses = two
  blocks, covering BOTH equally). Each block: "name" (${en ? 'e.g. "Prétérit"' : "a short French name"}), "use"
  (when, 1 or 2 sentences), "form" (the concrete structure with auxiliaries and
  endings, ${en ? `never just "verbe au prétérit": e.g. "have/has + participe passé",
  "verbe + -ed (irréguliers : 2e colonne)"` : "never just the name of the tense"}), "signals" (${t} trigger words, may be empty), "examples" (2 short
  ${t} sentences with their French translation). Only use the forms
  of the focus in the examples.
- "pitfalls": 2 or 3 DIFFERENT typical mistakes of ${ctx.native} speakers on this point (not
  the same mistake twice), often caused by translating from French: "wrong" and "right" ${t} sentences, "why" in French.

Format rules:
- gap: one ${t} sentence with "___" and the base verb or a hint in brackets${en ? `,
  e.g. "She ___ (work) here since 2022."` : " right after the blank"}; "accepted" lists every correct filling
  (only the missing words).
- error_spot: one ${t} sentence with exactly one grammar error; "accepted" lists
  the full corrected sentence(s).
- transform: an instruction IN FRENCH followed by a sentence in ${t}, e.g.
  ${en ? '"Mettez à la voix passive : The agency launched the campaign."' : `"Mettez au passé : " followed by a ${t} sentence`}; "accepted" lists
  every correct full sentence.
- translate: a French sentence to translate into ${t}; "accepted" gives 1 to 3
  good translations.
- reorder: "prompt" is "Remettez les mots dans l’ordre."; "accepted" gives the one
  correct ${t} sentence; no options.
- mcq: one ${t} sentence with "___" and 3 or 4 "options"; "accepted" lists the
  correct option(s), copied exactly.
${en ? "Contracted and full forms (don't / do not) are accepted automatically: list one of them.\n" : ""}
Reply with only JSON:
{"point": "${point}",
 "lesson": {"summary": "...", "forms": [{"name": "...", "use": "...", "form": "...", "signals": ["..."],
   "examples": [{"en": "...", "fr": "..."}]}], "pitfalls": [{"wrong": "...", "right": "...", "why": "..."}]},
 "items": [{"format": "gap", "prompt": "...", "options": ["only for mcq"],
  "accepted": ["..."], "explanation": "..."}]}`;
}

export function buildTranslateCheckPrompt(input: {
  point: GrammarPoint;
  french: string;
  references: string[];
  answer: string;
}): string {
  const ctx = learningContext();
  return `You check a ${ctx.native} learner's translation into ${ctx.target} (goal: ${ctx.goalLine},
grammar point practised: ${pointLabel(input.point)}).
French sentence: """${input.french}"""
Reference translations: ${input.references.map((r) => `"${r}"`).join(" / ")}
Student's translation: """${input.answer}"""
Accept any correct and natural ${ctx.target} translation with the same meaning, even if
it differs from the references. Ignore capital letters and final punctuation.
Reject grammar errors, especially on the grammar point practised.
Reply with only JSON:
{"correct": true, "feedback": "1 or 2 short sentences IN FRENCH for the student",
 "correction": "a correct translation, as close as possible to the student's wording"}`;
}
