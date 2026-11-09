import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

const ttsMp3 = vi.fn();
const voicePool = vi.fn();
const hasElevenLabs = vi.fn();
vi.mock("@/lib/audio/elevenlabs", async (orig) => ({
  ...(await orig<typeof import("@/lib/audio/elevenlabs")>()),
  ttsMp3: (...args: unknown[]) => ttsMp3(...args),
  voicePool: (...args: unknown[]) => voicePool(...args),
  hasElevenLabs: (...args: unknown[]) => hasElevenLabs(...args),
}));

const { resetDbForTests } = await import("@/lib/db");
const { signInAs } = await import("@/lib/testing/auth");
const { NO_KEY_MESSAGE } = await import("@/lib/audio/errors");
const { GET } = await import("./route");

const req = (word: string) => new Request(`http://t/api/pronounce?word=${encodeURIComponent(word)}`);

let dir: string;
beforeEach(() => {
  resetDbForTests();
  ttsMp3.mockReset();
  voicePool.mockReset();
  hasElevenLabs.mockReset();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "learnee-pronounce-"));
  vi.stubEnv("DATA_DIR", dir);
  hasElevenLabs.mockReturnValue(true);
  voicePool.mockReturnValue(["voice-1"]);
  ttsMp3.mockResolvedValue(Buffer.from("mp3-bytes"));
});

afterEach(() => vi.unstubAllEnvs());

test("401 when signed out", async () => {
  signInAs(null);
  const res = await GET(req("campaign"));
  expect(res.status).toBe(401);
});

test("400 on invalid word: digits, too long, too many words", async () => {
  signInAs("student");
  expect((await GET(req("camp4ign"))).status).toBe(400);
  expect((await GET(req("a".repeat(61)))).status).toBe(400);
  expect((await GET(req("one two three four five"))).status).toBe(400);
  expect(ttsMp3).not.toHaveBeenCalled();
});

test("student on a miss generates and caches; second request is a cache hit", async () => {
  signInAs("student");
  const res = await GET(req("campaign"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("audio/mpeg");
  expect(await res.arrayBuffer()).toEqual(Buffer.from("mp3-bytes").buffer);
  expect(ttsMp3).toHaveBeenCalledTimes(1);

  const res2 = await GET(req("campaign"));
  expect(res2.status).toBe(200);
  expect(ttsMp3).toHaveBeenCalledTimes(1);
});

test("viewer on a miss gets 403 without calling ElevenLabs", async () => {
  signInAs("viewer");
  const res = await GET(req("campaign"));
  expect(res.status).toBe(403);
  expect(ttsMp3).not.toHaveBeenCalled();
});

test("viewer on a cache hit gets 200", async () => {
  signInAs("student");
  expect((await GET(req("campaign"))).status).toBe(200);
  signInAs("viewer");
  const res = await GET(req("campaign"));
  expect(res.status).toBe(200);
  expect(ttsMp3).toHaveBeenCalledTimes(1);
});

test("no key: 503 with NO_KEY_MESSAGE", async () => {
  signInAs("student");
  hasElevenLabs.mockReturnValue(false);
  const res = await GET(req("campaign"));
  expect(res.status).toBe(503);
  expect((await res.json()).error).toBe(NO_KEY_MESSAGE);
  expect(ttsMp3).not.toHaveBeenCalled();
});
