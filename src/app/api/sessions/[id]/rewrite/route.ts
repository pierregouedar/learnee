import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { RewriteRefused, submitRewrite } from "@/lib/services/rewrite";

const Body = z.object({ pe: z.string().max(20_000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Texte illisible." }, { status: 400 });
  try {
    return Response.json(await submitRewrite((await params).id, body.data.pe), { status: 201 });
  } catch (e) {
    if (e instanceof RewriteRefused) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
    throw e;
  }
}
