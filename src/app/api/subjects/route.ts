import { z } from "zod";
import { getCurrentUser, requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { isInterest } from "@/lib/profile";
import { progressResponse, wantsProgress, type Emit, type Outcome } from "@/lib/progress-response";
import { listReadySubjects } from "@/lib/repo/subjects";
import { generateSubject } from "@/lib/services/generate-subject";

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("topic"), topic: z.string().trim().min(3).max(200) }),
  z.object({ mode: z.literal("paste"), article: z.string().trim().min(200).max(12_000) }),
]);

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const domain = new URL(req.url).searchParams.get("domain");
  const valid = domain && (domain === "libre" || isInterest(domain)) ? domain : undefined;
  return Response.json(listReadySubjects(valid));
}

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Thème de 3 à 200 caractères, ou article de 200 à 12 000 caractères." }, { status: 400 });
  }
  const input = body.data;
  const generate = async (emit?: Emit): Promise<Outcome> => {
    try {
      return { status: 201, body: await generateSubject(input, undefined, emit) };
    } catch (e) {
      if (e instanceof LlmError) return { status: e.code === "rate_limited" ? 429 : 502, body: { error: e.message } };
      throw e;
    }
  };
  if (wantsProgress(req)) return progressResponse(generate);
  const out = await generate();
  return Response.json(out.body, { status: out.status });
}
