import type { TimedWord } from "@/lib/listening/segments";
import { getProfile } from "@/lib/profile";
import { AudioError, NO_KEY_MESSAGE } from "./errors";

const API = "https://api.elevenlabs.io/v1";
export const TTS_MODEL = "eleven_flash_v2_5";
// 25 Mo : très au-dessus d'un mp3 128 kbps de 4 min (~4 Mo), garde-fou contre une réponse anormale.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const hasElevenLabs = () => Boolean(process.env.ELEVENLABS_API_KEY);

/** Lit le corps audio d'une réponse en flux, borné à MAX_AUDIO_BYTES (content-length ou taille réelle). */
export async function readAudioBody(res: Response): Promise<Buffer> {
  const contentLength = Number(res.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    throw new AudioError("provider", "Le fichier audio reçu est trop volumineux.");
  }
  if (!res.body) return Buffer.from(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_AUDIO_BYTES) {
      await reader.cancel().catch(() => {});
      throw new AudioError("provider", "Le fichier audio reçu est trop volumineux.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** 6 à 8 voix aux accents variés (spec §15.2), séparées par des virgules. La première sert aussi à la prononciation. */
export function voicePool(): string[] {
  return (process.env.ELEVENLABS_VOICES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function call(pathname: string, init: { method: "POST"; headers?: Record<string, string>; body: BodyInit }): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new AudioError("unavailable", NO_KEY_MESSAGE);
  let res: Response;
  try {
    res = await fetch(`${API}${pathname}`, {
      ...init,
      headers: { "xi-api-key": apiKey, ...init.headers },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    throw new AudioError("provider", "Le service audio ne répond pas. Réessaie plus tard.", { cause: e });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = res.status === 401 ? "La clé ElevenLabs est refusée." : "Le service audio a renvoyé une erreur. Réessaie plus tard.";
    throw new AudioError("provider", message, { cause: `${res.status} ${detail}` });
  }
  return res;
}

export async function ttsMp3(text: string, voiceId: string): Promise<Buffer> {
  const res = await call(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: TTS_MODEL, language_code: getProfile().target.code }),
  });
  return readAudioBody(res);
}

/** Scribe : transcription avec horodatage par mot et séparation des locuteurs. */
export async function transcribe(audio: Buffer, filename: string): Promise<TimedWord[]> {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_SCRIBE_MODEL || "scribe_v2");
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), filename);
  form.append("language_code", getProfile().target.code);
  form.append("diarize", "true");
  form.append("timestamps_granularity", "word");
  const res = await call("/speech-to-text", { method: "POST", body: form });
  const data = (await res.json()) as { words?: TimedWord[] };
  return data.words ?? [];
}
