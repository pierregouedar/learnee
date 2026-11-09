import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { progressResponse, wantsProgress, type Emit, type Outcome } from "@/lib/progress-response";
import { ProfileInput, ProfileInputError, saveProfileFromInput } from "@/lib/services/save-profile";

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = ProfileInput.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Choisis une langue, un objectif (décrit s’il est personnel), un niveau et 1 à 4 thèmes." }, { status: 400 });
  }
  const save = async (emit?: Emit): Promise<Outcome> => {
    try {
      return { status: 200, body: await saveProfileFromInput(body.data, emit) };
    } catch (e) {
      if (e instanceof ProfileInputError) return { status: 400, body: { error: e.message } };
      if (e instanceof LlmError) {
        return {
          status: e.code === "rate_limited" ? 429 : 502,
          body: { error: "Ton objectif est enregistré, mais le programme de grammaire n’a pas pu être préparé. Enregistre à nouveau pour réessayer." },
        };
      }
      throw e;
    }
  };
  if (wantsProgress(req)) return progressResponse(save);
  const out = await save();
  return Response.json(out.body, { status: out.status });
}
