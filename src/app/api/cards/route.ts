import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { keepWord } from "@/lib/cards";
import { MAX_LOOKUP_CHARS, MAX_SENTENCE_CHARS } from "@/lib/lookup";
import { addLookup } from "@/lib/repo/sessions";

const Body = z.object({
  term: z.string().trim().min(1).max(MAX_LOOKUP_CHARS),
  definition: z.string().trim().max(500),
  example: z.string().trim().max(500).optional(),
  fr: z.string().trim().min(1).max(200),
  context: z.object({
    sentence: z.string().max(MAX_SENTENCE_CHARS),
    sourceType: z.enum(["reading", "listening"]),
    sourceId: z.string().max(100),
    sourceTitle: z.string().max(300),
  }),
});

export async function POST(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Mot invalide." }, { status: 400 });
  const card = keepWord(body.data);
  // En lecture, la source est la copie en cours : on garde aussi le mot dans session.lookups (spec §9).
  if (body.data.context.sourceType === "reading") {
    addLookup(body.data.context.sourceId, { en: body.data.term, fr: body.data.fr, exemple: body.data.example || undefined });
  }
  return Response.json(card, { status: 201 });
}
