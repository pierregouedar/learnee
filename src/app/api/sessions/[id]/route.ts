import { z } from "zod";
import { getCurrentUser, requireStudent } from "@/lib/auth";
import { abandonSession, getSession, saveDraft } from "@/lib/repo/sessions";

type Ctx = { params: Promise<{ id: string }> };

const Draft = z.object({ cr: z.string().max(20_000), pe: z.string().max(20_000) });

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const session = getSession((await params).id);
  return session ? Response.json(session) : Response.json({ error: "Copie introuvable." }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Draft.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Brouillon invalide." }, { status: 400 });
  return saveDraft((await params).id, body.data)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Cette copie n'est plus modifiable." }, { status: 409 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  return abandonSession((await params).id)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Cette copie ne peut pas être abandonnée." }, { status: 409 });
}
