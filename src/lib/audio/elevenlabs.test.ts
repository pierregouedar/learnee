import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { DEFAULT_PROFILE, saveProfile } from "@/lib/profile";
import { hasElevenLabs, MAX_AUDIO_BYTES, readAudioBody, transcribe, ttsMp3, voicePool } from "./elevenlabs";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("ELEVENLABS_API_KEY", "k");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("no key: clear French error and no HTTP call", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  expect(hasElevenLabs()).toBe(false);
  await expect(ttsMp3("Hi", "v1")).rejects.toMatchObject({
    code: "unavailable",
    message: "L'audio n'est pas disponible : la clé ElevenLabs n'est pas configurée.",
  });
  await expect(transcribe(Buffer.from("x"), "a.mp3")).rejects.toMatchObject({ code: "unavailable" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("TTS: Flash v2.5, key header, mp3 bytes back", async () => {
  fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  const buf = await ttsMp3("Hello there.", "voice 1");
  expect([...buf]).toEqual([1, 2, 3]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice%201?output_format=mp3_44100_128");
  expect(init.method).toBe("POST");
  expect(init.headers["xi-api-key"]).toBe("k");
  expect(JSON.parse(init.body)).toEqual({ text: "Hello there.", model_id: "eleven_flash_v2_5", language_code: "en" });
});

test("provider errors become AudioError provider; bad key is explicit", async () => {
  fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
  await expect(ttsMp3("Hi", "v1")).rejects.toMatchObject({ code: "provider" });
  fetchMock.mockResolvedValueOnce(new Response("no", { status: 401 }));
  await expect(ttsMp3("Hi", "v1")).rejects.toMatchObject({ message: "La clé ElevenLabs est refusée." });
  fetchMock.mockRejectedValueOnce(new TypeError("network"));
  await expect(ttsMp3("Hi", "v1")).rejects.toMatchObject({ code: "provider" });
});

test("Scribe: multipart with model, word timestamps and diarization", async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json({ text: "Hi.", words: [{ text: "Hi.", start: 0.1, end: 0.4, type: "word", speaker_id: "speaker_0" }] }),
  );
  const words = await transcribe(Buffer.from("x"), "a.mp3");
  expect(words).toEqual([{ text: "Hi.", start: 0.1, end: 0.4, type: "word", speaker_id: "speaker_0" }]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
  const form = init.body as FormData;
  expect(form.get("model_id")).toBe("scribe_v2");
  expect(form.get("timestamps_granularity")).toBe("word");
  expect(form.get("diarize")).toBe("true");
  expect(form.get("file")).toBeInstanceOf(Blob);
});

test("voice pool from env", () => {
  vi.stubEnv("ELEVENLABS_VOICES", " a, b ,,c ");
  expect(voicePool()).toEqual(["a", "b", "c"]);
});

test("readAudioBody: rejects an oversized content-length before reading the body", async () => {
  const res = new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-length": String(MAX_AUDIO_BYTES + 1) },
  });
  await expect(readAudioBody(res)).rejects.toMatchObject({
    code: "provider",
    message: "Le fichier audio reçu est trop volumineux.",
  });
});

test("readAudioBody: aborts a chunked oversized body with no content-length", async () => {
  const chunk = new Uint8Array(5 * 1024 * 1024);
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= MAX_AUDIO_BYTES + chunk.byteLength) {
        controller.close();
        return;
      }
      sent += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const res = new Response(stream);
  expect(res.headers.get("content-length")).toBeNull();
  await expect(readAudioBody(res)).rejects.toMatchObject({
    code: "provider",
    message: "Le fichier audio reçu est trop volumineux.",
  });
});

test("readAudioBody: returns the full buffer for a normal body", async () => {
  const res = new Response(new Uint8Array([1, 2, 3, 4]));
  const buf = await readAudioBody(res);
  expect([...buf]).toEqual([1, 2, 3, 4]);
});

test("TTS and Scribe use the language of the profile", async () => {
  resetDbForTests();
  saveProfile({ ...DEFAULT_PROFILE, target: { code: "es", name: "Spanish" } });
  fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1])));
  await ttsMp3("Hola.", "v1");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).language_code).toBe("es");
  fetchMock.mockResolvedValueOnce(Response.json({ words: [] }));
  await transcribe(Buffer.from("x"), "a.mp3");
  expect((fetchMock.mock.calls[1][1].body as FormData).get("language_code")).toBe("es");
  resetDbForTests();
});
