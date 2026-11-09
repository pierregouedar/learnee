import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { resetDbForTests } from "@/lib/db";
import { insertListening } from "@/lib/repo/listenings";
import { signInAs } from "@/lib/testing/auth";
import { GET as audio } from "./[id]/audio/route";
import { POST as startAttempt } from "./[id]/attempts/route";
import { GET as getAttempt, PATCH as patchAttempt } from "./attempts/[id]/route";
import { POST as correct } from "./attempts/[id]/correct/route";
import { GET as list, POST as generate } from "./route";
import { POST as upload } from "./upload/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://t/api", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetDbForTests();
  vi.stubEnv("DATA_DIR", fs.mkdtempSync(path.join(os.tmpdir(), "learnee-api-")));
});
afterEach(() => vi.unstubAllEnvs());

const addListening = () => {
  fs.mkdirSync(path.join(process.env.DATA_DIR!, "audio"), { recursive: true });
  fs.writeFileSync(path.join(process.env.DATA_DIR!, "audio", "demo.mp3"), Buffer.alloc(1000));
  return insertListening({
    id: "demo", domain: "comm", source: "upload", format: "news", level: "B1", title: "Demo", context: "Tu écoutes.",
    script: [{ speaker: "A", text: "SECRET transcript", startMs: 0, endMs: 1000 }], audioPath: "demo.mp3",
    durationSec: 70, voices: [],
  });
};

const mutating: [string, () => Promise<Response>][] = [
  ["POST /api/listening", () => generate(json({}))],
  ["POST /api/listening/upload", () => upload(new Request("http://t", { method: "POST", body: new FormData() }))],
  ["POST /api/listening/:id/attempts", () => startAttempt(new Request("http://t", { method: "POST" }), ctx("nope"))],
  ["PATCH /api/listening/attempts/:id", () => patchAttempt(json({ play: true }, "PATCH"), ctx("nope"))],
  ["POST /api/listening/attempts/:id/correct", () => correct(new Request("http://t", { method: "POST" }), ctx("nope"))],
];

test.each(mutating)("%s: 401 signed out, 403 viewer, allowed for student", async (_name, call) => {
  signInAs(null);
  expect((await call()).status).toBe(401);
  signInAs("viewer");
  expect((await call()).status).toBe(403);
  signInAs("student");
  expect([401, 403]).not.toContain((await call()).status);
});

test("GET routes: 401 signed out, open to the viewer, never the script", async () => {
  addListening();
  signInAs(null);
  expect((await list(new Request("http://t/api/listening"))).status).toBe(401);
  expect((await audio(new Request("http://t"), ctx("demo"))).status).toBe(401);
  expect((await getAttempt(new Request("http://t"), ctx("x"))).status).toBe(401);
  signInAs("viewer");
  const res = await list(new Request("http://t/api/listening?domain=comm"));
  expect(await res.text()).not.toContain("SECRET");
  expect(await (await list(new Request("http://t/api/listening?domain=ia"))).json()).toEqual([]);
});

test("upload rejects an oversized body before reading it, and a missing file", async () => {
  signInAs("student");
  const big = new Request("http://t", { method: "POST", headers: { "content-length": "11000000" }, body: "x" });
  expect((await upload(big)).status).toBe(413);
  expect((await upload(new Request("http://t", { method: "POST", body: new FormData() }))).status).toBe(400);
});

test("audio: 404 unknown id, Range served from the stored name", async () => {
  addListening();
  signInAs("viewer");
  expect((await audio(new Request("http://t"), ctx("../etc"))).status).toBe(404);
  const res = await audio(new Request("http://t", { headers: { Range: "bytes=0-99" } }), ctx("demo"));
  expect(res.status).toBe(206);
  expect(res.headers.get("Content-Range")).toBe("bytes 0-99/1000");
});

test("attempt: resumes, caps plays at 3, hides the script, locks after correction", async () => {
  addListening();
  signInAs("student");
  const a = await (await startAttempt(new Request("http://t", { method: "POST" }), ctx("demo"))).json();
  expect((await (await startAttempt(new Request("http://t", { method: "POST" }), ctx("demo"))).json()).id).toBe(a.id);
  const plays = [];
  for (let i = 0; i < 4; i++) plays.push((await patchAttempt(json({ play: true }, "PATCH"), ctx(a.id))).status);
  expect(plays).toEqual([200, 200, 200, 409]);
  expect(await (await getAttempt(new Request("http://t"), ctx(a.id))).text()).not.toContain("SECRET");
  expect((await correct(new Request("http://t", { method: "POST" }), ctx(a.id))).status).toBe(400); // résumé trop court
  const summary = "mot ".repeat(25);
  expect((await patchAttempt(json({ notes: "n", summary }, "PATCH"), ctx(a.id))).status).toBe(204);
  expect((await correct(new Request("http://t", { method: "POST" }), ctx(a.id))).status).toBe(202);
  expect((await patchAttempt(json({ notes: "n", summary }, "PATCH"), ctx(a.id))).status).toBe(409);
  expect((await correct(new Request("http://t", { method: "POST" }), ctx(a.id))).status).toBe(409);
});

test("generate from a news headline: unknown headline is a French 404, a known one reaches audio generation", async () => {
  await signInAs("student");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  const missing = await generate(json({ headlineId: 999 }));
  expect(missing.status).toBe(404);
  expect((await missing.json()).error).toMatch(/actualité/);
  const { db } = await import("@/lib/db");
  const id = Number(
    db()
      .prepare(`INSERT INTO news_items (domain, title, title_key, url, fetched_at) VALUES ('comm', 'Brand story', 'brand story', 'https://n/1', ?)`)
      .run(new Date().toISOString()).lastInsertRowid,
  );
  const res = await generate(json({ headlineId: id }));
  expect(res.status).toBe(503); // pas de clé ElevenLabs dans ce test : le brief a bien été trouvé
});
