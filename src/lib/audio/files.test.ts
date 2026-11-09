import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AudioError } from "./errors";
import { audioFile, parseRange, serveFile } from "./files";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "learnee-files-"));
  vi.stubEnv("DATA_DIR", dir);
});
afterEach(() => vi.unstubAllEnvs());

test("audioFile lives under DATA_DIR/audio and creates folders", () => {
  const f = audioFile("pronounce/abc.mp3");
  expect(f).toBe(path.join(dir, "audio", "pronounce", "abc.mp3"));
  expect(fs.existsSync(path.dirname(f))).toBe(true);
});

test("audioFile rejects path traversal and invalid names", () => {
  for (const bad of ["../x.mp3", "a/../../x.mp3", "/etc/passwd", "x.mp3\0"]) {
    expect(() => audioFile(bad)).toThrow(AudioError);
  }
});

test("parseRange", () => {
  expect(parseRange(null, 100)).toBeNull();
  expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
  expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
  expect(parseRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
  expect(parseRange("bytes=-30", 100)).toEqual({ start: 70, end: 99 });
  expect(parseRange("bytes=100-", 100)).toBe("invalid");
  expect(parseRange("bytes=5-2", 100)).toBe("invalid");
  expect(parseRange("items=0-1", 100)).toBe("invalid");
});

test("serveFile: full body, partial body, 416 and 404", async () => {
  const f = audioFile("t.mp3");
  fs.writeFileSync(f, "0123456789");
  const full = await serveFile(new Request("http://x/a"), f, "audio/mpeg");
  expect(full.status).toBe(200);
  expect(full.headers.get("accept-ranges")).toBe("bytes");
  expect(await full.text()).toBe("0123456789");

  const part = await serveFile(new Request("http://x/a", { headers: { range: "bytes=2-4" } }), f, "audio/mpeg");
  expect(part.status).toBe(206);
  expect(part.headers.get("content-range")).toBe("bytes 2-4/10");
  expect(await part.text()).toBe("234");

  const bad = await serveFile(new Request("http://x/a", { headers: { range: "bytes=50-" } }), f, "audio/mpeg");
  expect(bad.status).toBe(416);

  const missing = await serveFile(new Request("http://x/a"), path.join(dir, "nope.mp3"), "audio/mpeg");
  expect(missing.status).toBe(404);
});
