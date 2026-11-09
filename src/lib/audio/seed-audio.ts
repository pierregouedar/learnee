import { AudioError } from "./errors";
import { readAudioBody } from "./elevenlabs";

// Valeur par défaut au chargement, utilisée par les consommateurs (ex. métadonnées Task 9) ;
// seedAudioScene relit process.env.SEED_AUDIO_MODEL à chaque appel (voir ci-dessous).
export const SEED_MODEL = process.env.SEED_AUDIO_MODEL || "seed-audio-1.0";
// tarif moyen des revendeurs au 22/09/2026 (§15.6.2) ; à ajuster au fournisseur retenu après le test §15.6.4.
export const SEED_USD_PER_SEC = 0.0025;

export const hasSeedAudio = () =>
  process.env.TTS_PROVIDER === "seed-audio" && Boolean(process.env.SEED_AUDIO_URL && process.env.SEED_AUDIO_API_KEY);

// contrat HTTP générique (POST JSON → octets audio). Adapter cette seule fonction à l'API du revendeur choisi
// (BytePlus, Venice, AIMLAPI…) ; le reste du pipeline (découpe, WER, repli) n'en dépend pas.
export async function seedAudioScene(prompt: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(process.env.SEED_AUDIO_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SEED_AUDIO_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.SEED_AUDIO_MODEL || "seed-audio-1.0", prompt, format: "mp3" }),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e) {
    throw new AudioError("provider", "Seed Audio ne répond pas.", { cause: e });
  }
  if (!res.ok) throw new AudioError("provider", "Seed Audio a renvoyé une erreur.", { cause: await res.text().catch(() => "") });
  return readAudioBody(res);
}
