import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { PlacementAnswersSchema } from "@/lib/placement/schema";
import { savePlacementDraft } from "@/lib/repo/placements";
import { PlacementError, submitPlacement } from "@/lib/services/placement";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = PlacementAnswersSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Réponses illisibles." }, { status: 400 });
  return savePlacementDraft((await params).id, body.data)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Ce test n’est plus modifiable." }, { status: 409 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = PlacementAnswersSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Réponses illisibles. Recharge la page et réessaie." }, { status: 400 });
  try {
    return Response.json(await submitPlacement((await params).id, body.data));
  } catch (e) {
    if (e instanceof PlacementError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
    throw e;
  }
}
