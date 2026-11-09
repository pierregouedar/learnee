import { z } from "zod";
import { getProfile, learningContext } from "@/lib/profile";
import { FORMAT_BRIEFS, type ListeningPeriod } from "@/lib/listening/period";
import {
  ListeningContextSchema, ListeningResultSchema, ListeningScriptSchema, type ListeningFormat,
} from "@/lib/listening/schemas";

const schemaOf = (s: z.ZodType) => JSON.stringify(z.toJSONSchema(s, { io: "input", unrepresentable: "any" }));
const SCRIPT_SCHEMA = schemaOf(ListeningScriptSchema);
const RESULT_SCHEMA = schemaOf(ListeningResultSchema);
const CONTEXT_SCHEMA = schemaOf(ListeningContextSchema);

export function topicBrief(topic: string): string {
  return `The topic chosen by the student: "${topic}". Use only well-established general knowledge; do not invent specific recent events or figures.`;
}

// Spec §15.8, variables {level}/{pace_rule}/{minutes}/{chars} tirées de la période (§15.3).
export function buildListeningScriptPrompt({ period, format, brief }: { period: ListeningPeriod; format: ListeningFormat; brief: string }): string {
  const f = FORMAT_BRIEFS[format];
  const speakers =
    f.speakers === 1 ? "Use 1 speaker (a presenter)." : `Use ${f.speakers} speakers with distinct roles (e.g. host and guest).`;
  const ctx = learningContext();
  return `Write a script for a listening exercise in ${ctx.target} (${ctx.native} student, goal: ${ctx.goalLine},
target level ${period.level}). Format: ${f.description}. Duration: about ${period.minutes}
minutes when spoken (roughly ${period.chars} characters). Base it ONLY on these facts:
"""${brief}"""
${speakers} Natural
spoken ${ctx.target}: contractions, discourse markers, a few rephrasings. ${period.paceRule}
Never invent quotations attributed to real named people.
Also write, IN FRENCH, a short context (2-3 sentences) placing the
student in ${ctx.situation} linked to this audio.
Each segment is one turn of speech; "speaker" is a letter (A, B, C). Never exceed
3800 characters in total across all segments.
Reply with only JSON:
{"title": "...", "context": "...",
 "segments": [{"speaker": "A", "role": "host", "text": "..."}]}
It must match this JSON schema:
${SCRIPT_SCHEMA}`;
}

export function buildListeningCorrectionPrompt({ plays, transcript, summary }: { plays: number; transcript: string; summary: string }): string {
  const ctx = learningContext();
  return `You are ${ctx.examiner}. A ${ctx.native} student (target level ${ctx.level}) listened to the
${ctx.target} audio ${plays} time(s) and wrote a summary IN FRENCH. Compare it with the
transcript. Write all feedback in simple French.

TRANSCRIPT:
"""${transcript}"""

STUDENT SUMMARY:
"""${summary}"""

Grade out of 10 (half points allowed) on: main ideas understood, key details,
absence of misunderstandings. Reply with only JSON:
{"note": 0, "comprises": ["..."], "manquees": ["..."],
 "contresens": [{"idee": "what she wrote", "explication": "what was actually said"}],
 "conseil": "one priority piece of advice, 1-2 sentences"}
It must match this JSON schema:
${RESULT_SCHEMA}`;
}

// Audio réel (F13) : le modèle ne produit que le titre et la mise en situation (§15.2 B.3).
export function buildListeningContextPrompt(transcript: string): string {
  const profile = getProfile();
  const ctx = learningContext(profile);
  const domains = [...profile.interests.map((i) => `${i.key} (${i.query})`), "libre (anything else)"].join(", ");
  return `Here is the transcript of a real ${ctx.target} audio clip (advert, podcast, news report or
brand video) that a ${ctx.native} student (goal: ${ctx.goalLine}, target level ${ctx.level}) will use
for a listening exercise.

TRANSCRIPT:
"""${transcript}"""

Write:
- "title": a short ${ctx.target} title for the clip (max 10 words);
- "context": IN FRENCH, a short context (2-3 sentences) placing the
  student in ${ctx.situation} linked to this audio: who is speaking and in what
  situation, without summarising what is said;
- "format": one of interview, podcast, debate, radio_ad, news;
- "domain": one of ${domains}.
Reply with only JSON matching this JSON schema:
${CONTEXT_SCHEMA}`;
}
