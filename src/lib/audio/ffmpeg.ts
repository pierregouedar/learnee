import { execFile } from "node:child_process";
import { AudioError } from "./errors";

const FFPROBE_TIMEOUT_MS = 30_000;
const FFMPEG_TIMEOUT_MS = 180_000; // assez pour un concat de 4 minutes

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGKILL" },
      (err, stdout, stderr) => {
        if (!err) return resolve(String(stdout));
        const errno = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string | null };
        if (errno.code === "ENOENT") {
          return reject(new AudioError("unavailable", "ffmpeg est introuvable sur le serveur.", { cause: err }));
        }
        if (errno.killed === true || errno.signal) {
          return reject(new AudioError("provider", "Le traitement audio a pris trop de temps.", { cause: err }));
        }
        reject(new AudioError("provider", "Le traitement audio a échoué.", { cause: String(stderr) || err }));
      },
    );
  });
}

export async function probeDurationMs(file: string, timeoutMs = FFPROBE_TIMEOUT_MS): Promise<number> {
  // -protocol_whitelist file : le fichier probé peut être un upload non encore validé (couche 1/2, cf. toMp3).
  const out = await run(
    "ffprobe",
    ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    timeoutMs,
  );
  const sec = Number.parseFloat(out.trim());
  if (!Number.isFinite(sec)) throw new AudioError("invalid", "Ce fichier n'est pas un audio lisible.");
  return Math.round(sec * 1000);
}

/** Concatène des mp3 en un seul, avec `gapMs` de silence après chaque morceau (réencodage : durées fiables). */
export async function concatWithGaps(
  files: string[],
  gapMs: number,
  out: string,
  timeoutMs = FFMPEG_TIMEOUT_MS,
): Promise<void> {
  const pad = gapMs > 0 ? `,apad=pad_dur=${gapMs / 1000}` : "";
  const inputs = files.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono${pad}[a${i}]`);
  const filter = `${inputs.join(";")};${files.map((_, i) => `[a${i}]`).join("")}concat=n=${files.length}:v=0:a=1[out]`;
  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      ...files.flatMap((f) => ["-i", f]),
      "-filter_complex", filter,
      "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "96k",
      out,
    ],
    timeoutMs,
  );
}

// Conteneurs légitimes seulement : bloque hls/concat/autres démuxeurs playlist même renommés en .mp3.
const ALLOWED_CONTAINER_FORMATS = new Set([
  "mp3", "mov", "mp4", "m4a", "3gp", "3g2", "mj2", "wav", "ogg", "flac", "matroska", "webm", "aac",
]);

/** Rejette tout ce qui n'est pas un conteneur audio/vidéo connu (mesure défensive contre ffmpeg -i sur des bytes non fiables). */
async function assertKnownContainer(input: string): Promise<void> {
  let out: string;
  try {
    // default=nw=1:nk=1 (pas csv) : csv quote les listes à virgules ("matroska,webm" serait un seul token à part).
    out = await run(
      "ffprobe",
      ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=format_name", "-of", "default=nw=1:nk=1", input],
      FFPROBE_TIMEOUT_MS,
    );
  } catch (e) {
    if (e instanceof AudioError && e.code === "unavailable") throw e;
    throw new AudioError("invalid", "Ce fichier n'est pas un audio lisible.", { cause: e });
  }
  const formats = out.trim().split(",").map((f) => f.trim());
  if (!formats.some((f) => ALLOWED_CONTAINER_FORMATS.has(f))) {
    throw new AudioError("invalid", "Ce fichier n'est pas un audio lisible.");
  }
}

/** Convertit n'importe quel audio ou vidéo en mp3 mono (la vidéo est ignorée). */
export async function toMp3(input: string, out: string, timeoutMs = FFMPEG_TIMEOUT_MS): Promise<void> {
  await assertKnownContainer(input);
  try {
    await run(
      "ffmpeg",
      ["-y", "-v", "error", "-protocol_whitelist", "file", "-i", input, "-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", out],
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof AudioError && (e.code === "unavailable" || e.message === "Le traitement audio a pris trop de temps.")) {
      throw e;
    }
    throw new AudioError("invalid", "Ce fichier n'est pas un audio lisible.", { cause: e });
  }
}
