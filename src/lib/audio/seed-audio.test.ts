import { afterEach, expect, test, vi } from "vitest";
import { hasSeedAudio, seedAudioScene } from "./seed-audio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("only active behind TTS_PROVIDER=seed-audio with URL and key", () => {
  vi.stubEnv("SEED_AUDIO_URL", "https://seed.example/v1/audio");
  vi.stubEnv("SEED_AUDIO_API_KEY", "s");
  vi.stubEnv("TTS_PROVIDER", "elevenlabs");
  expect(hasSeedAudio()).toBe(false);
  vi.stubEnv("TTS_PROVIDER", "seed-audio");
  expect(hasSeedAudio()).toBe(true);
  vi.stubEnv("SEED_AUDIO_API_KEY", "");
  expect(hasSeedAudio()).toBe(false);
});

test("posts the scene prompt with a bearer token and returns audio bytes", async () => {
  vi.stubEnv("SEED_AUDIO_URL", "https://seed.example/v1/audio");
  vi.stubEnv("SEED_AUDIO_API_KEY", "s");
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([9])));
  vi.stubGlobal("fetch", fetchMock);
  expect([...(await seedAudioScene("A: Hi."))]).toEqual([9]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://seed.example/v1/audio");
  expect(init.headers.Authorization).toBe("Bearer s");
  expect(JSON.parse(init.body)).toMatchObject({ prompt: "A: Hi.", format: "mp3" });
});
