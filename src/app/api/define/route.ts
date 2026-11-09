import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { define } from "@/lib/define";
import { LlmError } from "@/lib/llm/client";
import { cleanSelection } from "@/lib/lookup";

const Body = z.object({ word: z.string().max(200), sentence: z.string().max(2_000) });

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  const word = body.success ? cleanSelection(body.data.word) : null;
  if (!body.success || !word) {
    return Response.json({ error: "Sélectionne de 1 à 4 mots (60 caractères au maximum)." }, { status: 400 });
  }
  try {
    return Response.json(await define(word, body.data.sentence));
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
    throw e;
  }
}
