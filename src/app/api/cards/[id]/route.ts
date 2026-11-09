import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { setSuspended } from "@/lib/cards";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = z.object({ suspended: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Demande invalide." }, { status: 400 });
  return setSuspended((await params).id, body.data.suspended)
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Mot introuvable." }, { status: 404 });
}
