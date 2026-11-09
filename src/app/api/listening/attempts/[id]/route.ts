import { z } from "zod";
import { getCurrentUser, requireStudent } from "@/lib/auth";
import { getAttempt, registerPlay, saveAttemptDraft } from "@/lib/repo/listenings";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.union([
  z.object({ play: z.literal(true) }),
  z.object({ notes: z.string().max(20_000), summary: z.string().max(20_000) }),
]);

// L'exercice (ListeningAttempt) ne contient jamais le script : rien à masquer avant la correction (spec §15.4).
export async function GET(_req: Request, { params }: Ctx) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const attempt = getAttempt((await params).id);
  return attempt ? Response.json(attempt) : Response.json({ error: "Exercice introuvable." }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  const { id } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Brouillon invalide." }, { status: 400 });
  if ("play" in body.data) {
    const plays = registerPlay(id);
    return plays === undefined
      ? Response.json({ error: "Tu as déjà utilisé tes 3 écoutes." }, { status: 409 })
      : Response.json({ plays });
  }
  return saveAttemptDraft(id, body.data)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Ce compte rendu n'est plus modifiable." }, { status: 409 });
}
