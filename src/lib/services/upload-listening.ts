import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { hasElevenLabs, transcribe } from "@/lib/audio/elevenlabs";
import { AudioError, NO_KEY_MESSAGE } from "@/lib/audio/errors";
import { probeDurationMs, toMp3 } from "@/lib/audio/ffmpeg";
import { audioFile } from "@/lib/audio/files";
import { listeningPeriod } from "@/lib/listening/period";
import { ListeningContextSchema } from "@/lib/listening/schemas";
import { segmentsFromWords, transcriptText } from "@/lib/listening/segments";
import { callJson } from "@/lib/llm/client";
import { isInterest } from "@/lib/profile";
import { buildListeningContextPrompt } from "@/lib/prompts/listening";
import { insertListening, type Listening } from "@/lib/repo/listenings";

// 10 Mo décimaux : reste sous la limite de 10 Mio que Next applique aux corps traversant src/proxy.ts.
export const MAX_UPLOAD_BYTES = 10_000_000;
const MIN_MS = 60_000;
const MAX_MS = 240_000;
// Première ligne de défense (couche 1/2, ffmpeg fait le vrai contrôle de conteneur en couche 2/2) : ne filtre
// que sur le type déclaré et l'extension, ne prouve rien sur le contenu réel.
const ALLOWED_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".webm", ".mp4", ".mov", ".flac"]);

function isAllowedUpload(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  const type = file.type;
  // Le navigateur (ou curl) laisse parfois file.type vide : ffprobe reste le vrai contrôle en couche 2/2.
  return type === "" || type.startsWith("audio/") || type.startsWith("video/");
}

export async function uploadListening(file: File, now = new Date()): Promise<Listening> {
  if (!hasElevenLabs()) throw new AudioError("unavailable", NO_KEY_MESSAGE);
  if (file.size > MAX_UPLOAD_BYTES) throw new AudioError("invalid", "Fichier trop lourd (10 Mo maximum).");
  if (!isAllowedUpload(file)) throw new AudioError("invalid", "Format non pris en charge (audio ou vidéo uniquement).");
  const id = crypto.randomUUID();
  const audioPath = `${id}.mp3`;
  const out = audioFile(audioPath);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "learnee-upload-"));
  try {
    const ext = path.extname(file.name).replace(/[^.a-z0-9]/gi, "").slice(0, 8);
    const src = path.join(dir, `source${ext}`);
    await fs.writeFile(src, Buffer.from(await file.arrayBuffer()));
    // Contrôle précoce sur le fichier brut (déclaré par le conteneur) : évite de lancer une conversion coûteuse
    // pour un extrait hors bornes. ffprobe reste borné au protocole file (voir toMp3/assertKnownContainer).
    const inputMs = await probeDurationMs(src);
    if (inputMs < MIN_MS || inputMs > MAX_MS) throw new AudioError("invalid", "L'extrait doit durer entre 1 et 4 minutes.");
    await toMp3(src, out); // accepte aussi une vidéo : la piste son seule est gardée
    const ms = await probeDurationMs(out);
    if (ms < MIN_MS || ms > MAX_MS) throw new AudioError("invalid", "L'extrait doit durer entre 1 et 4 minutes.");
    const segments = segmentsFromWords(await transcribe(await fs.readFile(out), audioPath));
    if (segments.length === 0) throw new AudioError("invalid", "Aucune parole n'a été détectée dans cet extrait.");
    const meta = await callJson("listening_context", buildListeningContextPrompt(transcriptText(segments)), ListeningContextSchema, id);
    return insertListening({
      id,
      domain: isInterest(meta.domain) ? meta.domain : "libre",
      source: "upload",
      sourceRef: file.name.slice(0, 200),
      format: meta.format,
      level: listeningPeriod(now).level,
      title: meta.title,
      context: meta.context,
      script: segments,
      audioPath,
      durationSec: Math.round(ms / 1000),
      voices: [],
    });
  } catch (e) {
    await fs.rm(out, { force: true });
    throw e;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
