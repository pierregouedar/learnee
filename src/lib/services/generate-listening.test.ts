import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getListening } from "@/lib/repo/listenings";

const m = vi.hoisted(() => ({
  callJson: vi.fn(), synthesizeScript: vi.fn(), hasElevenLabs: vi.fn(), insertListening: vi.fn(),
  realInsertListening: undefined as typeof import("@/lib/repo/listenings").insertListening | undefined,
}));
vi.mock("@/lib/llm/client", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/client")>()), callJson: m.callJson }));
vi.mock("@/lib/audio/synthesize", () => ({ synthesizeScript: m.synthesizeScript }));
vi.mock("@/lib/audio/elevenlabs", () => ({ hasElevenLabs: m.hasElevenLabs }));
vi.mock("@/lib/repo/listenings", async (orig) => {
  const actual = await orig<typeof import("@/lib/repo/listenings")>();
  m.realInsertListening = actual.insertListening;
  return { ...actual, insertListening: m.insertListening };
});

const { audioFile } = await import("@/lib/audio/files");
const { generateListening } = await import("./generate-listening");

const october = new Date(2026, 9, 1);
let dataDir: string;

beforeEach(() => {
  resetDbForTests();
  m.callJson.mockReset();
  m.synthesizeScript.mockReset();
  m.hasElevenLabs.mockReset();
  m.insertListening.mockReset();
  m.hasElevenLabs.mockReturnValue(true);
  m.insertListening.mockImplementation(m.realInsertListening!);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "learnee-generate-"));
  vi.stubEnv("DATA_DIR", dataDir);
});
afterEach(() => vi.unstubAllEnvs());

test("no ElevenLabs key: French error, no LLM call", async () => {
  m.hasElevenLabs.mockReturnValue(false);
  await expect(generateListening({ domain: "comm", brief: "b" }, october)).rejects.toMatchObject({ code: "unavailable" });
  expect(m.callJson).not.toHaveBeenCalled();
});

test("script from the period prompt, capped at 4000 chars, synthesized and stored", async () => {
  m.callJson.mockResolvedValueOnce({
    title: "EV sales",
    context: "Tu travailles pour un constructeur.",
    segments: [
      { speaker: "A", role: "host", text: "x".repeat(3000) },
      { speaker: "B", role: "guest", text: "y".repeat(1500) },
    ],
  });
  const segments = [{ speaker: "A", text: "x".repeat(3000), startMs: 0, endMs: 60_000 }];
  m.synthesizeScript.mockImplementationOnce(async (id: string) => ({
    audioPath: `${id}.mp3`, segments, durationSec: 60, voices: ["v1"],
    tts: { provider: "elevenlabs", model: "eleven_flash_v2_5", characters: 3000, costUsd: 0.15, attempts: 1 },
  }));

  const l = await generateListening({ domain: "auto", brief: "FACTS", sourceRef: "subj-9" }, october, () => 0);

  const [task, prompt] = m.callJson.mock.calls[0];
  expect(task).toBe("listening_script");
  expect(prompt).toContain("target level B1");
  expect(prompt).toContain('"""FACTS"""');
  expect(m.synthesizeScript.mock.calls[0][1]).toEqual([{ speaker: "A", text: "x".repeat(3000) }]);
  expect(getListening(l.id)).toMatchObject({
    domain: "auto", source: "generated", sourceRef: "subj-9", format: "news", level: "B1", title: "EV sales",
    script: segments, audioPath: `${l.id}.mp3`, durationSec: 60, status: "ready",
  });
});

test("insert failure after synthesis: the mp3 is removed and the error rethrown", async () => {
  m.callJson.mockResolvedValueOnce({
    title: "EV sales", context: "Tu travailles pour un constructeur.",
    segments: [{ speaker: "A", role: "host", text: "hello" }],
  });
  let generatedId = "";
  m.synthesizeScript.mockImplementationOnce(async (id: string) => {
    generatedId = id;
    await fs.promises.writeFile(audioFile(`${id}.mp3`), "mp3");
    return {
      audioPath: `${id}.mp3`, segments: [{ speaker: "A", text: "hello", startMs: 0, endMs: 500 }],
      durationSec: 1, voices: ["v1"],
      tts: { provider: "elevenlabs", model: "eleven_flash_v2_5", characters: 5, costUsd: 0.01, attempts: 1 },
    };
  });
  m.insertListening.mockImplementationOnce(() => {
    throw new Error("db down");
  });

  await expect(generateListening({ domain: "auto", brief: "FACTS" }, october, () => 0)).rejects.toThrow("db down");

  expect(generatedId).not.toBe("");
  expect(fs.existsSync(audioFile(`${generatedId}.mp3`))).toBe(false);
});
