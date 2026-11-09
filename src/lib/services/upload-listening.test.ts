import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";

const m = vi.hoisted(() => ({
  callJson: vi.fn(), toMp3: vi.fn(), probeDurationMs: vi.fn(), transcribe: vi.fn(), hasElevenLabs: vi.fn(),
}));
vi.mock("@/lib/llm/client", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/client")>()), callJson: m.callJson }));
vi.mock("@/lib/audio/ffmpeg", () => ({ toMp3: m.toMp3, probeDurationMs: m.probeDurationMs }));
vi.mock("@/lib/audio/elevenlabs", () => ({ hasElevenLabs: m.hasElevenLabs, transcribe: m.transcribe }));

const { MAX_UPLOAD_BYTES, uploadListening } = await import("./upload-listening");

const clip = () => new File([new Uint8Array([1, 2, 3])], "pub.mp3", { type: "audio/mpeg" });
let dataDir: string;

beforeEach(() => {
  resetDbForTests();
  Object.values(m).forEach((f) => f.mockReset());
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "learnee-upload-"));
  vi.stubEnv("DATA_DIR", dataDir);
  m.hasElevenLabs.mockReturnValue(true);
  m.toMp3.mockImplementation(async (_in: string, out: string) => fs.promises.writeFile(out, "mp3"));
});
afterEach(() => vi.unstubAllEnvs());

test("no key: French error before anything is written", async () => {
  m.hasElevenLabs.mockReturnValue(false);
  await expect(uploadListening(clip())).rejects.toMatchObject({ code: "unavailable" });
  expect(m.toMp3).not.toHaveBeenCalled();
});

test("too heavy", async () => {
  const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.mp3");
  await expect(uploadListening(big)).rejects.toMatchObject({ code: "invalid", message: "Fichier trop lourd (10 Mo maximum)." });
});

test("disallowed type/extension: rejected, ffmpeg never runs", async () => {
  const doc = new File([new Uint8Array([1, 2, 3])], "notes.txt", { type: "text/plain" });
  await expect(uploadListening(doc)).rejects.toMatchObject({
    code: "invalid", message: "Format non pris en charge (audio ou vidéo uniquement).",
  });
  expect(m.toMp3).not.toHaveBeenCalled();
});

test("mismatched MIME type despite an mp3 extension: rejected", async () => {
  const fake = new File([new Uint8Array([1, 2, 3])], "pub.mp3", { type: "text/html" });
  await expect(uploadListening(fake)).rejects.toMatchObject({
    code: "invalid", message: "Format non pris en charge (audio ou vidéo uniquement).",
  });
  expect(m.toMp3).not.toHaveBeenCalled();
});

test("empty file.type with an allowed extension: accepted, ffprobe/ffmpeg are the real check", async () => {
  const noType = new File([new Uint8Array([1, 2, 3])], "pub.mp3", { type: "" });
  m.probeDurationMs.mockResolvedValue(90_000);
  m.transcribe.mockResolvedValueOnce([{ text: "Hi.", start: 0, end: 0.4, type: "word", speaker_id: "speaker_0" }]);
  m.callJson.mockResolvedValueOnce({ title: "T", context: "C", format: "radio_ad", domain: "auto" });
  const l = await uploadListening(noType);
  expect(m.toMp3).toHaveBeenCalled();
  expect(l.durationSec).toBe(90);
});

test("too short (< 1 minute): refused before conversion, ffmpeg never runs", async () => {
  m.probeDurationMs.mockResolvedValueOnce(30_000);
  await expect(uploadListening(clip())).rejects.toMatchObject({ message: "L'extrait doit durer entre 1 et 4 minutes." });
  expect(m.toMp3).not.toHaveBeenCalled();
  expect(fs.readdirSync(path.join(dataDir, "audio"))).toEqual([]);
  expect(m.transcribe).not.toHaveBeenCalled();
});

test("outside 1-4 minutes: refused before conversion, ffmpeg never runs", async () => {
  m.probeDurationMs.mockResolvedValueOnce(300_000);
  await expect(uploadListening(clip())).rejects.toMatchObject({ message: "L'extrait doit durer entre 1 et 4 minutes." });
  expect(m.toMp3).not.toHaveBeenCalled();
  expect(fs.readdirSync(path.join(dataDir, "audio"))).toEqual([]);
  expect(m.transcribe).not.toHaveBeenCalled();
});

test("outside 1-4 minutes after conversion (container metadata lied): refused, converted file deleted", async () => {
  m.probeDurationMs.mockResolvedValueOnce(120_000).mockResolvedValueOnce(300_000);
  await expect(uploadListening(clip())).rejects.toMatchObject({ message: "L'extrait doit durer entre 1 et 4 minutes." });
  expect(m.toMp3).toHaveBeenCalled();
  expect(fs.readdirSync(path.join(dataDir, "audio"))).toEqual([]);
  expect(m.transcribe).not.toHaveBeenCalled();
});

test("Scribe failure: the converted mp3 and the tmp dir are both removed", async () => {
  m.probeDurationMs.mockResolvedValue(120_000);
  m.transcribe.mockRejectedValueOnce(new Error("Scribe down"));
  const before = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("learnee-upload-"));

  await expect(uploadListening(clip())).rejects.toThrow("Scribe down");

  expect(fs.readdirSync(path.join(dataDir, "audio"))).toEqual([]);
  const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("learnee-upload-"));
  expect(after).toEqual(before);
});

test("transcribed with Scribe, titled by the LLM, stored as an upload", async () => {
  m.probeDurationMs.mockResolvedValue(180_000);
  m.transcribe.mockResolvedValueOnce([
    { text: "Drive", start: 0, end: 0.4, type: "word", speaker_id: "speaker_0" },
    { text: "electric.", start: 0.5, end: 1, type: "word", speaker_id: "speaker_0" },
    { text: "Today.", start: 1.2, end: 1.6, type: "word", speaker_id: "speaker_1" },
  ]);
  m.callJson.mockResolvedValueOnce({ title: "EV ad", context: "Tu analyses une pub.", format: "radio_ad", domain: "auto" });

  const l = await uploadListening(clip(), new Date(2027, 1, 1));

  expect(m.callJson.mock.calls[0][0]).toBe("listening_context");
  expect(m.callJson.mock.calls[0][1]).toContain("A: Drive electric.\nB: Today.");
  expect(l).toMatchObject({
    source: "upload", sourceRef: "pub.mp3", format: "radio_ad", domain: "auto", level: "B1+", durationSec: 180,
    title: "EV ad", voices: [],
  });
  expect(l.script).toHaveLength(2);
  expect(fs.existsSync(path.join(dataDir, "audio", l.audioPath))).toBe(true);
});

test("silence only: refused", async () => {
  m.probeDurationMs.mockResolvedValue(90_000);
  m.transcribe.mockResolvedValueOnce([]);
  await expect(uploadListening(clip())).rejects.toMatchObject({ message: "Aucune parole n'a été détectée dans cet extrait." });
});
