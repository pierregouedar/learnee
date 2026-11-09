import type { Progress } from "@/lib/generation-progress";

export type Emit = (p: Progress) => void;
export type Outcome = { status: number; body: unknown };

export const PROGRESS_TYPE = "application/x-ndjson";

/** Le navigateur demande l'avancement (`Accept: application/x-ndjson`) ; sinon la route répond en JSON comme avant. */
export const wantsProgress = (req?: Request) => Boolean(req?.headers.get("accept")?.includes(PROGRESS_TYPE));

/**
 * Réponse en flux, une ligne JSON par événement : `{"progress": {label, pct}}` puis `{"done": {status, body}}`.
 * Le statut HTTP est déjà 200 quand le travail commence : le vrai statut voyage dans `done`.
 * Un `ping` toutes les 15 s garde la connexion ouverte (le tunnel Cloudflare coupe au bout de 100 s de silence).
 */
export function progressResponse(run: (emit: Emit) => Promise<Outcome>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let last = "";
      const emit: Emit = ({ label, pct }) => {
        const rounded = Math.round(pct);
        if (`${label}|${rounded}` === last) return;
        last = `${label}|${rounded}`;
        send({ progress: { label, pct: rounded } });
      };
      const ping = setInterval(() => send({ ping: true }), 15_000);
      try {
        send({ done: await run(emit) });
      } catch (e) {
        console.error("[progress]", e);
        send({ done: { status: 500, body: { error: "Une erreur est survenue. Réessaie." } } });
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": `${PROGRESS_TYPE}; charset=utf-8`, "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
