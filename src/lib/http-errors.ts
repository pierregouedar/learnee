import { AudioError } from "@/lib/audio/errors";
import { LlmError } from "@/lib/llm/client";

const AUDIO_STATUS = { invalid: 400, unavailable: 503, provider: 502 } as const;

export function errorResponse(e: unknown): Response {
  if (e instanceof AudioError) return Response.json({ error: e.message }, { status: AUDIO_STATUS[e.code] });
  if (e instanceof LlmError) return Response.json({ error: e.message }, { status: e.code === "rate_limited" ? 429 : 502 });
  console.error(e);
  return Response.json({ error: "Une erreur est survenue. Réessaie plus tard." }, { status: 500 });
}
