import { requireStudent } from "@/lib/auth";
import { errorResponse } from "@/lib/http-errors";
import { toSummary } from "@/lib/repo/listenings";
import { MAX_UPLOAD_BYTES, uploadListening } from "@/lib/services/upload-listening";

// Fichier + enveloppe multipart : refusé avant de lire le corps s'il annonce nettement plus que la limite du fichier.
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 500_000;

export async function POST(req: Request) {
  const u = await requireStudent();
  if (u instanceof Response) return u;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "Fichier trop lourd (10 Mo maximum)." }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choisis un fichier audio." }, { status: 400 });
  try {
    return Response.json(toSummary(await uploadListening(file)), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
