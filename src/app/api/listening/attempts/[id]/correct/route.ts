import { after } from "next/server";
import { requireStudent } from "@/lib/auth";
import { ListeningCorrectionRefused, runListeningCorrection, startListeningCorrection } from "@/lib/services/correct-listening";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  const { id } = await params;
  try {
    startListeningCorrection(id);
  } catch (e) {
    if (e instanceof ListeningCorrectionRefused) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  // tâche en mémoire du process ; au redémarrage, instrumentation.ts remet le compte rendu en brouillon.
  after(() => runListeningCorrection(id));
  return new Response(null, { status: 202 });
}
