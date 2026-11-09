import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { HeadlineNotFound, subjectFromHeadline } from "@/lib/news/headlines";
import { progressResponse, wantsProgress, type Emit, type Outcome } from "@/lib/progress-response";

// Rédige le sujet d'une actualité choisie : le seul moment où le parcours actualités coûte un appel au modèle.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const id = Number((await params).id);
  const generate = async (emit?: Emit): Promise<Outcome> => {
    try {
      return { status: 201, body: await subjectFromHeadline(id, emit) };
    } catch (e) {
      if (e instanceof HeadlineNotFound) return { status: 404, body: { error: e.message } };
      if (e instanceof LlmError) return { status: e.code === "rate_limited" ? 429 : 502, body: { error: e.message } };
      throw e;
    }
  };
  if (wantsProgress(req)) return progressResponse(generate);
  const out = await generate();
  return Response.json(out.body, { status: out.status });
}
