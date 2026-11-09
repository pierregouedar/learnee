import { getCurrentUser } from "@/lib/auth";
import { dueCards, reviewStats } from "@/lib/review";

export async function GET() {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const now = new Date();
  return Response.json({ cards: dueCards(now), stats: reviewStats(now) });
}
