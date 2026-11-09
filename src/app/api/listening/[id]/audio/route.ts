import { audioFile, serveFile } from "@/lib/audio/files";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http-errors";
import { getListening } from "@/lib/repo/listenings";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const listening = getListening((await params).id);
  if (!listening) return Response.json({ error: "Exercice introuvable." }, { status: 404 });
  // Le nom vient toujours de la ligne en base, jamais de la requête ; audioFile le revalide quand même.
  try {
    return await serveFile(req, audioFile(listening.audioPath), "audio/mpeg");
  } catch (e) {
    return errorResponse(e);
  }
}
