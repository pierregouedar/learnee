import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  ttsMp3: vi.fn(),
  transcribe: vi.fn(),
  voicePool: vi.fn(),
  probeDurationMs: vi.fn(),
  concatWithGaps: vi.fn(),
  hasSeedAudio: vi.fn(),
  seedAudioScene: vi.fn(),
}));
vi.mock("./elevenlabs", () => ({ TTS_MODEL: "eleven_flash_v2_5", ttsMp3: m.ttsMp3, transcribe: m.transcribe, voicePool: m.voicePool }));
vi.mock("./ffmpeg", () => ({ probeDurationMs: m.probeDurationMs, concatWithGaps: m.concatWithGaps }));
vi.mock("./seed-audio", () => ({
  SEED_MODEL: "seed-audio-1.0", SEED_USD_PER_SEC: 0.0025, hasSeedAudio: m.hasSeedAudio, seedAudioScene: m.seedAudioScene,
}));

const { GAP_MS, pickVoices, synthesizeScript } = await import("./synthesize");

const lines = [
  { speaker: "A", text: "Hello and welcome." },
  { speaker: "B", text: "Thanks for having me." },
  { speaker: "A", text: "Let's start." },
];
const wordsOf = (text: string) =>
  text.split(" ").map((t, i) => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4, type: "word" }));

let dataDir: string;
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "learnee-synth-"));
  vi.stubEnv("DATA_DIR", dataDir);
  m.voicePool.mockReturnValue(["v1", "v2", "v3"]);
  m.ttsMp3.mockResolvedValue(Buffer.from("mp3"));
  m.concatWithGaps.mockImplementation(async (_files: string[], _gap: number, out: string) => fs.promises.writeFile(out, "audio"));
  m.hasSeedAudio.mockReturnValue(false);
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

test("ElevenLabs: one call per line, one stable voice per speaker, timestamps from durations", async () => {
  m.probeDurationMs.mockResolvedValueOnce(1000).mockResolvedValueOnce(2000).mockResolvedValueOnce(1500).mockResolvedValueOnce(5300);
  const r = await synthesizeScript("abc", lines);
  expect(m.ttsMp3).toHaveBeenCalledTimes(3);
  const voiceA = m.ttsMp3.mock.calls[0][1];
  expect(m.ttsMp3.mock.calls[2][1]).toBe(voiceA);
  expect(m.ttsMp3.mock.calls[1][1]).not.toBe(voiceA);
  expect(m.concatWithGaps.mock.calls[0][1]).toBe(GAP_MS);
  expect(r.segments.map((s) => [s.startMs, s.endMs])).toEqual([
    [0, 1000],
    [1000 + GAP_MS, 3000 + GAP_MS],
    [3000 + 2 * GAP_MS, 4500 + 2 * GAP_MS],
  ]);
  expect(r.durationSec).toBe(5);
  expect(r.audioPath).toBe("abc.mp3");
  expect(fs.existsSync(path.join(dataDir, "audio", "abc.mp3"))).toBe(true);
  expect(r.voices).toHaveLength(2);
  const characters = lines.reduce((n, l) => n + l.text.length, 0);
  expect(r.tts).toMatchObject({ provider: "elevenlabs", model: "eleven_flash_v2_5", characters, attempts: 1 });
});

test("ElevenLabs: rescales segment timestamps when the concat's real duration drifts from the computed sum", async () => {
  // Mêmes durées par morceau que le test précédent (somme calculée = 5300 ms), mais le fichier concaténé
  // fait réellement 5830 ms (dérive de 10 % due au réencodage) : chaque horodatage doit être recalé d'autant.
  m.probeDurationMs.mockResolvedValueOnce(1000).mockResolvedValueOnce(2000).mockResolvedValueOnce(1500).mockResolvedValueOnce(5830);
  const r = await synthesizeScript("abc", lines);
  expect(r.segments.map((s) => [s.startMs, s.endMs])).toEqual([
    [0, 1100],
    [1540, 3740],
    [4180, 5830],
  ]);
  expect(r.durationSec).toBe(6);
});

test("Seed Audio accepted when WER ≤ 5 %: no ElevenLabs TTS, aligned segments", async () => {
  m.hasSeedAudio.mockReturnValue(true);
  m.seedAudioScene.mockResolvedValue(Buffer.from("scene"));
  m.transcribe.mockResolvedValue(wordsOf("Hello and welcome. Thanks for having me. Let's start."));
  m.probeDurationMs.mockResolvedValue(4600);
  const r = await synthesizeScript("s1", lines);
  expect(m.ttsMp3).not.toHaveBeenCalled();
  expect(m.concatWithGaps.mock.calls[0][1]).toBe(0);
  expect(r.tts).toMatchObject({ provider: "seed-audio", wer: 0, attempts: 1 });
  expect(r.segments[1]).toMatchObject({ speaker: "B", startMs: 1500, endMs: 3400 });
  expect(fs.existsSync(path.join(dataDir, "audio", "s1.mp3"))).toBe(true);
});

test("Seed Audio rejected twice: falls back to ElevenLabs and records the WER", async () => {
  m.hasSeedAudio.mockReturnValue(true);
  m.seedAudioScene.mockResolvedValue(Buffer.from("scene"));
  m.transcribe.mockResolvedValue(wordsOf("something completely different was said"));
  m.probeDurationMs.mockResolvedValueOnce(1000).mockResolvedValueOnce(2000).mockResolvedValueOnce(1500).mockResolvedValueOnce(5300);
  const r = await synthesizeScript("s2", lines);
  expect(m.seedAudioScene).toHaveBeenCalledTimes(2);
  expect(m.ttsMp3).toHaveBeenCalledTimes(3);
  expect(r.tts.provider).toBe("elevenlabs");
  expect(r.tts.attempts).toBe(3);
  expect(r.tts.wer).toBeGreaterThan(0.05);
});

test("pickVoices: distinct voices, refuses when the pool is too small", () => {
  const v = pickVoices(["A", "B", "C"], ["v1", "v2", "v3"]);
  expect(new Set(Object.values(v)).size).toBe(3);
  expect(() => pickVoices(["A", "B"], ["v1"])).toThrow("Pas assez de voix configurées");
});
