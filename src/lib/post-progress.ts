import type { Progress } from "@/lib/generation-progress";

const FAILED = "Une erreur est survenue. Réessaie.";

/**
 * POST d'une génération longue : lit le flux d'avancement (voir progress-response.ts) et renvoie le corps final,
 * ou lève une Error avec le message français du serveur. Retombe sur le JSON classique (401, 400…).
 */
export async function postWithProgress<T>(url: string, body: unknown, onProgress: (p: Progress) => void): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? FAILED);
    return data as T;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { progress?: Progress; done?: { status: number; body: unknown } };
      if (event.progress) onProgress(event.progress);
      if (event.done) {
        if (event.done.status >= 400) throw new Error((event.done.body as { error?: string } | undefined)?.error ?? FAILED);
        return event.done.body as T;
      }
    }
  }
  throw new Error("La connexion a été coupée pendant la préparation. Réessaie.");
}
