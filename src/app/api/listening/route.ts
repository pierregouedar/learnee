import { z } from "zod";
import { getCurrentUser, requireStudent } from "@/lib/auth";
import { errorResponse } from "@/lib/http-errors";
import { topicBrief } from "@/lib/prompts/listening";
import { listReadyListenings, toSummary } from "@/lib/repo/listenings";
import { HeadlineNotFound, headlineBrief } from "@/lib/news/headlines";
import { generateListening, type GenerateListeningInput } from "@/lib/services/generate-listening";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const domain = new URL(req.url).searchParams.get("domain");
  return Response.json(listReadyListenings().filter((l) => !domain || l.domain === domain));
}

// Un thème libre, ou un titre d'actualité du jour (voir /api/news) qui sert de brief au script.
const Body = z.union([z.object({ topic: z.string().trim().min(3).max(200) }), z.object({ headlineId: z.number().int().positive() })]);

export async function POST(req: Request) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Écris un thème de 3 à 200 caractères, ou choisis une actualité." }, { status: 400 });
  try {
    let input: GenerateListeningInput;
    if ("headlineId" in body.data) {
      const h = headlineBrief(body.data.headlineId);
      input = { domain: h.domain, brief: h.brief, sourceRef: h.url };
    } else input = { domain: "libre", brief: topicBrief(body.data.topic), sourceRef: body.data.topic };
    const l = await generateListening(input);
    return Response.json(toSummary(l), { status: 201 });
  } catch (e) {
    if (e instanceof HeadlineNotFound) return Response.json({ error: e.message }, { status: 404 });
    return errorResponse(e);
  }
}
