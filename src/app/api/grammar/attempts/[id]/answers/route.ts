import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { answerItem, GrammarError } from "@/lib/services/grammar";

const Body = z.object({ itemId: z.string().min(1), answer: z.string().trim().min(1).max(500) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Écris une réponse avant de valider." }, { status: 400 });
  try {
    return Response.json(await answerItem((await params).id, body.data.itemId, body.data.answer));
  } catch (e) {
    if (e instanceof GrammarError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
    throw e;
  }
}
