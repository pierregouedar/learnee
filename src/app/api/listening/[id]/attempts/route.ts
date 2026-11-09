import { requireStudent } from "@/lib/auth";
import { getListening, startAttempt } from "@/lib/repo/listenings";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  const listening = getListening((await params).id);
  if (!listening) return Response.json({ error: "Exercice introuvable." }, { status: 404 });
  return Response.json(startAttempt(listening.id), { status: 201 });
}
