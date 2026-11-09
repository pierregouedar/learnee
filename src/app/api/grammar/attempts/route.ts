import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { isProgrammePoint } from "@/lib/grammar-programme";
import { GrammarGenerationError } from "@/lib/grammar/generate";
import { LlmError } from "@/lib/llm/client";
import { startGrammarAttempt } from "@/lib/services/grammar";

const Body = z.object({ point: z.string().refine((p) => isProgrammePoint(p)) });

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Point de grammaire inconnu." }, { status: 400 });
  try {
    const attempt = await startGrammarAttempt(body.data.point);
    return Response.json({ id: attempt.id }, { status: 201 });
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
    if (e instanceof GrammarGenerationError) return Response.json({ error: e.message }, { status: 502 });
    throw e;
  }
}
