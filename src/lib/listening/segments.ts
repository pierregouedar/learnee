import type { ScriptLine, Segment } from "./schemas";

export const MAX_SCRIPT_CHARS = 4000;

// Horodatage Scribe (secondes), réutilisé pour l'alignement Seed Audio.
export type TimedWord = { text: string; start: number; end: number; type: string; speaker_id?: string };

const SENTENCE_END = /[.!?…]["”’)]?$/;
const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Garde les premières répliques tant que le total reste ≤ max (spec §15.7 : 4 000 caractères maximum). */
export function capScript(lines: ScriptLine[], max = MAX_SCRIPT_CHARS): ScriptLine[] {
  const out: ScriptLine[] = [];
  let total = 0;
  for (const l of lines) {
    total += l.text.length;
    if (total > max) break;
    out.push(l);
  }
  return out;
}

/** Après concaténation : chaque réplique dure `durationsMs[i]`, puis un silence de `gapMs`. */
export function computeTimestamps(lines: ScriptLine[], durationsMs: number[], gapMs: number): Segment[] {
  let t = 0;
  return lines.map((l, i) => {
    const startMs = t;
    const endMs = Math.round(startMs + durationsMs[i]);
    t = endMs + gapMs;
    return { speaker: l.speaker, text: l.text, startMs, endMs };
  });
}

/** Découpe chaque réplique en phrases et répartit sa durée au prorata des caractères. */
// « Mr. Smith » est coupé après « Mr. » ; sans gravité (une phrase courte de plus), liste d'abréviations si ça gêne.
export function splitSentences(segments: Segment[]): Segment[] {
  return segments.flatMap((s) => {
    const parts = s.text.split(/(?<=[.!?…]["”’)]?)\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return [s];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const span = s.endMs - s.startMs;
    let acc = 0;
    return parts.map((text) => {
      const startMs = s.startMs + Math.round((span * acc) / total);
      acc += text.length;
      return { speaker: s.speaker, text, startMs, endMs: s.startMs + Math.round((span * acc) / total) };
    });
  });
}

/** Transcription Scribe → phrases horodatées : coupure à chaque fin de phrase ou changement de locuteur. */
export function segmentsFromWords(words: TimedWord[]): Segment[] {
  const letters = new Map<string, string>();
  const letter = (id = "speaker_0") => {
    if (!letters.has(id)) letters.set(id, String.fromCharCode(65 + letters.size));
    return letters.get(id)!;
  };
  const out: Segment[] = [];
  let cur: Segment | undefined;
  for (const w of words) {
    if (w.type !== "word") continue;
    const speaker = letter(w.speaker_id);
    if (!cur || cur.speaker !== speaker) {
      cur = { speaker, text: w.text, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) };
      out.push(cur);
    } else {
      cur.text += ` ${w.text}`;
      cur.endMs = Math.round(w.end * 1000);
    }
    if (SENTENCE_END.test(w.text)) cur = undefined;
  }
  return out;
}

/** Seed Audio : répartit les mots transcrits sur les répliques du script au prorata de leur nombre de mots. */
export function alignSegments(lines: ScriptLine[], words: TimedWord[]): Segment[] {
  const spoken = words.filter((w) => w.type === "word");
  const counts = lines.map((l) => wordCount(l.text));
  const ratio = spoken.length / Math.max(1, counts.reduce((a, b) => a + b, 0));
  let cum = 0;
  return lines.map((l, i) => {
    const first = Math.min(spoken.length - 1, Math.round(cum * ratio));
    cum += counts[i];
    const last = Math.max(first, Math.min(spoken.length - 1, Math.round(cum * ratio) - 1));
    return {
      speaker: l.speaker,
      text: l.text,
      startMs: Math.round(spoken[first].start * 1000),
      endMs: Math.round(spoken[last].end * 1000),
    };
  });
}

/** Regroupe des répliques consécutives en morceaux de ≤ maxChars (Seed Audio : 120 s maximum par requête). */
export function chunkLines(lines: ScriptLine[], maxChars: number): ScriptLine[][] {
  const chunks: ScriptLine[][] = [];
  let size = Infinity;
  for (const l of lines) {
    if (size + l.text.length > maxChars) {
      chunks.push([]);
      size = 0;
    }
    chunks.at(-1)!.push(l);
    size += l.text.length;
  }
  return chunks;
}

export const transcriptText = (segments: { speaker: string; text: string }[]) =>
  segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
