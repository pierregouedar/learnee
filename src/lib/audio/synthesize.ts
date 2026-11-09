import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ScriptLine, Segment } from "@/lib/listening/schemas";
import { alignSegments, chunkLines, computeTimestamps } from "@/lib/listening/segments";
import { wer, WER_MAX } from "@/lib/listening/wer";
import { getProfile } from "@/lib/profile";
import type { TtsInfo } from "@/lib/repo/listenings";
import { TTS_MODEL, transcribe, ttsMp3, voicePool } from "./elevenlabs";
import { AudioError } from "./errors";
import { concatWithGaps, probeDurationMs } from "./ffmpeg";
import { audioFile } from "./files";
import { hasSeedAudio, SEED_MODEL, SEED_USD_PER_SEC, seedAudioScene } from "./seed-audio";

export const GAP_MS = 400; // silence entre deux répliques
const FLASH_USD_PER_CHAR = 0.05 / 1000; // spec §15.6.1
const SEED_CHUNK_CHARS = 1600; // ≈ 100 s de parole, sous la limite de 120 s par requête

export type SynthResult = { audioPath: string; segments: Segment[]; durationSec: number; voices: string[]; tts: TtsInfo };

export function pickVoices(speakers: string[], pool: string[], rand = Math.random): Record<string, string> {
  if (pool.length < speakers.length) {
    throw new AudioError("unavailable", "Pas assez de voix configurées (ELEVENLABS_VOICES).");
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return Object.fromEntries(speakers.map((s, i) => [s, shuffled[i]]));
}

async function withTmpDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "learnee-audio-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/** ElevenLabs : un segment par réplique, une voix par locuteur, horodatage déduit des durées (spec §15.5). */
async function elevenLabs(id: string, lines: ScriptLine[]): Promise<SynthResult> {
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const voices = pickVoices(speakers, voicePool());
  return withTmpDir(async (dir) => {
    const files: string[] = [];
    for (const [i, l] of lines.entries()) {
      const file = path.join(dir, `${String(i).padStart(3, "0")}.mp3`);
      await fs.writeFile(file, await ttsMp3(l.text, voices[l.speaker]));
      files.push(file);
    }
    const durations: number[] = [];
    for (const f of files) durations.push(await probeDurationMs(f));
    const audioPath = `${id}.mp3`;
    const out = audioFile(audioPath);
    await concatWithGaps(files, GAP_MS, out);
    let segments = computeTimestamps(lines, durations, GAP_MS);
    const finalMs = await probeDurationMs(out);
    // Le réencodage du concat peut légèrement dériver de la somme calculée à partir des morceaux ; on recale
    // les horodatages proportionnellement pour que la réécoute d'une phrase reste précise à moins d'1 s.
    const computedTotalMs = segments.at(-1)?.endMs ?? 0;
    if (computedTotalMs > 0 && finalMs !== computedTotalMs) {
      const ratio = finalMs / computedTotalMs;
      segments = segments.map((s) => ({ ...s, startMs: Math.round(s.startMs * ratio), endMs: Math.round(s.endMs * ratio) }));
    }
    const characters = lines.reduce((n, l) => n + l.text.length, 0);
    return {
      audioPath,
      segments,
      durationSec: Math.round(finalMs / 1000),
      voices: speakers.map((s) => voices[s]),
      tts: { provider: "elevenlabs", model: TTS_MODEL, characters, costUsd: characters * FLASH_USD_PER_CHAR, attempts: 1 },
    };
  });
}

function scenePrompt(lines: ScriptLine[]): string {
  return `A realistic ${getProfile().target.name} radio scene with light background ambience. The speakers say these lines EXACTLY,
word for word, in this order, without adding, removing or changing anything:
${lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")}`;
}

/** Seed Audio (spec §15.6.2) : 2 essais maximum, acceptés si WER ≤ 5 %. Renvoie le dernier WER en cas de rejet. */
// pas de banque de voix de référence entre morceaux (§15.6.2 point 2) ; à ajouter si le test d'écoute retient Seed Audio.
async function seedAudio(id: string, lines: ScriptLine[]): Promise<SynthResult | number> {
  const reference = lines.map((l) => l.text).join(" ");
  let lastWer = 1;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const accepted = await withTmpDir(async (dir): Promise<SynthResult | null> => {
      const files: string[] = [];
      for (const [i, chunk] of chunkLines(lines, SEED_CHUNK_CHARS).entries()) {
        const file = path.join(dir, `chunk-${i}.mp3`);
        await fs.writeFile(file, await seedAudioScene(scenePrompt(chunk)));
        files.push(file);
      }
      const scene = path.join(dir, "scene.mp3");
      await concatWithGaps(files, 0, scene);
      const words = await transcribe(await fs.readFile(scene), `${id}.mp3`);
      lastWer = wer(reference, words.filter((w) => w.type === "word").map((w) => w.text).join(" "));
      console.info(`[seed-audio] ${id} essai ${attempt} : WER ${(lastWer * 100).toFixed(1)} %`);
      if (lastWer > WER_MAX) return null;
      const audioPath = `${id}.mp3`;
      const out = audioFile(audioPath);
      await fs.copyFile(scene, out);
      const seconds = Math.round((await probeDurationMs(out)) / 1000);
      return {
        audioPath,
        segments: alignSegments(lines, words),
        durationSec: seconds,
        voices: [],
        tts: {
          provider: "seed-audio", via: process.env.SEED_AUDIO_VIA || undefined, model: SEED_MODEL, seconds,
          costUsd: seconds * SEED_USD_PER_SEC, wer: lastWer, attempts: attempt,
        },
      };
    });
    if (accepted) return accepted;
  }
  return lastWer;
}

export async function synthesizeScript(id: string, lines: ScriptLine[]): Promise<SynthResult> {
  if (!hasSeedAudio()) return elevenLabs(id, lines);
  const seed = await seedAudio(id, lines).catch((e) => {
    console.error("[seed-audio] échec, bascule sur ElevenLabs", e);
    return 1;
  });
  if (typeof seed !== "number") return seed;
  console.info(`[seed-audio] ${id} rejeté (WER ${(seed * 100).toFixed(1)} %), repli ElevenLabs`);
  const fallback = await elevenLabs(id, lines);
  // 2 essais Seed Audio rejetés + 1 ElevenLabs : le taux de rejet se lit dans `tts` (spec §15.6.2 point 5).
  return { ...fallback, tts: { ...fallback.tts, wer: seed, attempts: 3 } };
}
