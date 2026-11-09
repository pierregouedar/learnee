import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { AudioError } from "./errors";

// Un segment de nom (dossier ou fichier) : alphanumérique, pas de "..", pas de "/", pas d'octet nul.
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
// Le brief ne stocke que du mp3 (ElevenLabs + concat ffmpeg produisent tous du mp3).
const FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.mp3$/;

/** Chemin d'un fichier audio sous DATA_DIR/audio (dossiers créés au besoin). */
export function audioFile(name: string): string {
  const parts = name.split("/");
  const filename = parts.at(-1) ?? "";
  const dirParts = parts.slice(0, -1);
  const valid = parts.length <= 2 && FILENAME.test(filename) && dirParts.every((p) => SEGMENT.test(p));
  if (!valid) throw new AudioError("invalid", "Nom de fichier audio invalide.");

  const dir = path.resolve(process.env.DATA_DIR || "data", "audio");
  const file = path.resolve(dir, name);
  if (file !== dir && !file.startsWith(dir + path.sep)) {
    throw new AudioError("invalid", "Nom de fichier audio invalide.");
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return "invalid";
  let start: number;
  let end: number;
  if (!m[1]) {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? "invalid" : { start, end };
}

/** Sert un fichier avec prise en charge de Range : indispensable pour se déplacer dans un <audio>. */
export async function serveFile(req: Request, file: string, contentType: string): Promise<Response> {
  const stat = await fs.promises.stat(file).catch(() => null);
  if (!stat) return Response.json({ error: "Fichier audio introuvable." }, { status: 404 });
  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
  }
  const { start, end } = range ?? { start: 0, end: stat.size - 1 };
  const body = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
  return new Response(body, { status: range ? 206 : 200, headers });
}
