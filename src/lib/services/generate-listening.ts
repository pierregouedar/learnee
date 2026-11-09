import fs from "node:fs/promises";
import { hasElevenLabs } from "@/lib/audio/elevenlabs";
import { AudioError, NO_KEY_MESSAGE } from "@/lib/audio/errors";
import { audioFile } from "@/lib/audio/files";
import { synthesizeScript } from "@/lib/audio/synthesize";
import { listeningPeriod } from "@/lib/listening/period";
import { ListeningScriptSchema } from "@/lib/listening/schemas";
import { capScript } from "@/lib/listening/segments";
import { callJson } from "@/lib/llm/client";
import { buildListeningScriptPrompt } from "@/lib/prompts/listening";
import { insertListening, type Listening } from "@/lib/repo/listenings";
import type { Domain } from "@/lib/repo/subjects";

export type GenerateListeningInput = { domain: Domain; brief: string; sourceRef?: string };

export async function generateListening(input: GenerateListeningInput, now = new Date(), rand = Math.random): Promise<Listening> {
  // Scribe (contrôle Seed Audio) et TTS passent tous deux par ElevenLabs.
  if (!hasElevenLabs()) throw new AudioError("unavailable", NO_KEY_MESSAGE);
  const period = listeningPeriod(now);
  const format = period.formats[Math.floor(rand() * period.formats.length)];
  const id = crypto.randomUUID();
  const script = await callJson(
    "listening_script",
    buildListeningScriptPrompt({ period, format, brief: input.brief }),
    ListeningScriptSchema,
    id,
  );
  // 4 000 caractères maximum (spec §15.7) : on coupe aux dernières répliques entières.
  const lines = capScript(script.segments.map(({ speaker, text }) => ({ speaker, text })));
  if (lines.length === 0) throw new AudioError("invalid", "Le script généré est inutilisable. Réessaie.");
  try {
    const audio = await synthesizeScript(id, lines);
    return insertListening({
      id,
      domain: input.domain,
      source: "generated",
      sourceRef: input.sourceRef,
      format,
      level: period.level,
      title: script.title,
      context: script.context,
      script: audio.segments,
      audioPath: audio.audioPath,
      durationSec: audio.durationSec,
      voices: audio.voices,
      tts: audio.tts,
    });
  } catch (e) {
    await fs.rm(audioFile(`${id}.mp3`), { force: true });
    throw e;
  }
}
