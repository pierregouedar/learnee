import { getCurrentUser } from "@/lib/auth";
import { listHeadlines, refreshHeadlines } from "@/lib/news/headlines";

// Titres du jour, lus dans les flux RSS au plus une fois par heure. ?refresh=1 force la relecture, pour le compte élève seulement. Aucun appel au modèle.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  await refreshHeadlines(user.role === "student" && new URL(req.url).searchParams.get("refresh") === "1");
  return Response.json(listHeadlines());
}
