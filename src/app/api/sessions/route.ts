import { z } from "zod";
import { getCurrentUser, requireStudent } from "@/lib/auth";
import { ActiveSessionExistsError, createSession, getActiveSession, listCorrected } from "@/lib/repo/sessions";
import { getSubject } from "@/lib/repo/subjects";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status");
  if (status === "draft") {
    const active = getActiveSession();
    return Response.json(active ? [active] : []);
  }
  return Response.json(listCorrected());
}

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = z
    .object({ subjectId: z.string(), examMode: z.boolean().optional() })
    .safeParse(await req.json().catch(() => null));
  const subject = body.success ? getSubject(body.data.subjectId) : undefined;
  if (!subject) return Response.json({ error: "Sujet introuvable." }, { status: 404 });
  try {
    return Response.json(createSession(subject.id, subject.tier, body.data?.examMode ?? false), { status: 201 });
  } catch (e) {
    if (e instanceof ActiveSessionExistsError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
