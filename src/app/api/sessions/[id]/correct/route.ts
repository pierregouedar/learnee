import { after } from "next/server";
import { requireStudent } from "@/lib/auth";
import { CorrectionRefused, runCorrection, startCorrection } from "@/lib/services/correct-session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const { id } = await params;
  try {
    startCorrection(id);
  } catch (e) {
    if (e instanceof CorrectionRefused) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  // tâche en mémoire du process ; si le serveur redémarre, instrumentation.ts remet la copie en brouillon.
  after(() => runCorrection(id));
  return new Response(null, { status: 202 });
}
