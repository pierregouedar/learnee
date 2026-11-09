import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { dueCards, rateCard, suspendCard } from "@/lib/review";

const Body = z.union([
  z.object({ action: z.literal("suspend") }),
  z.object({
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    elapsedMs: z.number().min(0).max(3_600_000).optional(),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  const { cardId } = await params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Réponse invalide." }, { status: 400 });
  const now = new Date();
  const ok = "action" in body.data ? suspendCard(cardId) : rateCard(cardId, body.data.rating, now, body.data.elapsedMs ?? 0);
  if (!ok) return Response.json({ error: "Carte introuvable." }, { status: 404 });
  return Response.json({ queue: dueCards(now) });
}
