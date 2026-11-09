import { z } from "zod";
import { learningContext } from "@/lib/profile";

export const WeeklyAdviceSchema = z.object({ conseil: z.string().min(1) });

export function buildWeeklyAdvicePrompt(report: string): string {
  const ctx = learningContext();
  return `You help the tutor of a ${ctx.native} student of ${ctx.target} (goal: ${ctx.goalLine},
target level ${ctx.level}). Here is her week in the training app, in French:
"""${report}"""
In 2 or 3 sentences IN FRENCH, addressed to the tutor, say what to work on with her
during ${ctx.oralPractice}: one grammar or vocabulary focus
and one listening or speaking focus, based only on this report.
Reply with only JSON: {"conseil": "..."}`;
}
