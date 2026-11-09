import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { progressResponse, wantsProgress, type Emit, type Outcome } from "@/lib/progress-response";
import { createPlacement, PlacementError } from "@/lib/services/placement";

async function create(emit?: Emit): Promise<Outcome> {
  try {
    const placement = await createPlacement(new Date(), emit);
    return { status: 201, body: { id: placement.id } };
  } catch (e) {
    if (e instanceof PlacementError) return { status: e.status, body: { error: e.message } };
    if (e instanceof LlmError) return { status: e.code === "rate_limited" ? 429 : 502, body: { error: e.message } };
    throw e;
  }
}

export async function POST(req?: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  if (wantsProgress(req)) return progressResponse(create);
  const out = await create();
  return Response.json(out.body, { status: out.status });
}
