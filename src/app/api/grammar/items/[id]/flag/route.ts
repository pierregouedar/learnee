import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { flagGrammarItem, GrammarError } from "@/lib/services/grammar";

const Body = z.object({ attemptId: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  try {
    return Response.json(flagGrammarItem((await params).id, body.success ? body.data.attemptId : undefined));
  } catch (e) {
    if (e instanceof GrammarError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
