import Database from "better-sqlite3";
import { beforeEach, expect, test, vi } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { migrations } from "@/lib/db/migrations";
import type { ListeningResult } from "@/lib/listening/schemas";
import {
  countGeneratedSince, countReadyListenings, failAttemptCorrection, getAttempt, getListening, getSlowSpeedOverride,
  insertListening, listCorrectedAttempts, listeningSourceRefs, listReadyListenings, markListeningUsed,
  recoverInterruptedListeningCorrections, registerPlay, saveAttemptDraft, saveAttemptResult, setAttemptCorrecting,
  startAttempt, type NewListening,
} from "./listenings";

const sampleListening = (over: Partial<NewListening> = {}): NewListening => ({
  id: crypto.randomUUID(),
  domain: "comm",
  source: "generated",
  sourceRef: "subj-1",
  format: "interview",
  level: "B1",
  title: "Brands on TikTok",
  context: "Tu travailles dans une agence.",
  script: [{ speaker: "A", text: "Hello.", startMs: 0, endMs: 800 }],
  audioPath: "x.mp3",
  durationSec: 95,
  voices: ["v1", "v2"],
  tts: { provider: "elevenlabs", model: "eleven_flash_v2_5", characters: 6, costUsd: 0.0003, attempts: 1 },
  ...over,
});

const result: ListeningResult = { note: 6.5, comprises: ["a"], manquees: ["b"], contresens: [], conseil: "c" };

beforeEach(() => resetDbForTests());

test("insert and read back, ready list hides the script", () => {
  const l = insertListening(sampleListening());
  expect(getListening(l.id)).toMatchObject({ title: "Brands on TikTok", script: [{ text: "Hello." }], status: "ready" });
  const ready = listReadyListenings();
  expect(ready).toHaveLength(1);
  expect("script" in ready[0]).toBe(false);
  expect(countReadyListenings()).toBe(1);
  expect(listeningSourceRefs()).toEqual(["subj-1"]);
  markListeningUsed(l.id);
  expect(countReadyListenings()).toBe(0);
});

test("countGeneratedSince ignores uploads and old rows", () => {
  insertListening(sampleListening());
  insertListening(sampleListening({ source: "upload" }));
  expect(countGeneratedSince(new Date(Date.now() - 86_400_000).toISOString())).toBe(1);
  expect(countGeneratedSince(new Date(Date.now() + 60_000).toISOString())).toBe(0);
});

test("startAttempt resumes the active attempt for the same audio", () => {
  const l = insertListening(sampleListening());
  const a = startAttempt(l.id);
  expect(startAttempt(l.id).id).toBe(a.id);
  expect(a).toMatchObject({ plays: 0, notes: "", summary: "", status: "draft" });
});

test("plays: server-side cap at 3, only while draft", () => {
  const a = startAttempt(insertListening(sampleListening()).id);
  expect(registerPlay(a.id)).toBe(1);
  expect(registerPlay(a.id)).toBe(2);
  expect(registerPlay(a.id)).toBe(3);
  expect(registerPlay(a.id)).toBeUndefined();
  expect(getAttempt(a.id)?.plays).toBe(3);
});

test("registerPlay does not bump updated_at (playing isn't editing the draft)", async () => {
  const a = startAttempt(insertListening(sampleListening()).id);
  const before = getAttempt(a.id)!.updatedAt;
  await new Promise((r) => setTimeout(r, 5));
  registerPlay(a.id);
  expect(getAttempt(a.id)!.updatedAt).toBe(before);
});

test("startAttempt is race-safe: a concurrent insert winning between the guard SELECT and the INSERT is recovered, not thrown", () => {
  const l = insertListening(sampleListening());
  const raw = db();
  const originalPrepare = raw.prepare.bind(raw);
  let interceptNextGuard = true;
  const spy = vi.spyOn(raw, "prepare").mockImplementation((sql: string) => {
    if (interceptNextGuard && /SELECT \* FROM listening_attempts WHERE listening_id = \? AND status IN/.test(sql)) {
      interceptNextGuard = false;
      // Le SELECT de garde ne voit rien (comme si une autre requête n'avait pas encore commité)…
      return {
        get: () => {
          // …puis cette autre requête insère avant que notre INSERT ne s'exécute : la contrainte unique se déclenche.
          originalPrepare(`INSERT INTO listening_attempts (id, listening_id, started_at, updated_at) VALUES (?, ?, ?, ?)`).run(
            crypto.randomUUID(), l.id, new Date().toISOString(), new Date().toISOString(),
          );
          return undefined;
        },
      } as unknown as ReturnType<typeof raw.prepare>;
    }
    return originalPrepare(sql);
  });
  try {
    const a = startAttempt(l.id);
    expect(a.listeningId).toBe(l.id);
    expect(a.status).toBe("draft");
  } finally {
    spy.mockRestore();
  }
});

test("draft, correction success, history", () => {
  const l = insertListening(sampleListening());
  const a = startAttempt(l.id);
  expect(saveAttemptDraft(a.id, { notes: "n", summary: "résumé" })).toBe(true);
  expect(setAttemptCorrecting(a.id)).toBe(true);
  expect(setAttemptCorrecting(a.id)).toBe(false);
  expect(saveAttemptDraft(a.id, { notes: "x", summary: "y" })).toBe(false);
  saveAttemptResult(a.id, result);
  expect(getAttempt(a.id)).toMatchObject({ status: "corrected", result: { note: 6.5 }, summary: "résumé" });
  expect(listCorrectedAttempts().map((h) => h.title)).toEqual(["Brands on TikTok"]);
  // a new attempt on the same audio is allowed once the previous one is corrected
  expect(startAttempt(l.id).id).not.toBe(a.id);
});

test("failure goes back to draft with the message; boot recovery", () => {
  const a = startAttempt(insertListening(sampleListening()).id);
  setAttemptCorrecting(a.id);
  failAttemptCorrection(a.id, "Panne");
  expect(getAttempt(a.id)).toMatchObject({ status: "draft", error: "Panne" });
  setAttemptCorrecting(a.id);
  expect(recoverInterruptedListeningCorrections()).toBe(1);
  expect(getAttempt(a.id)?.error).toMatch(/interrompue/);
});

test("slow speed override read from settings", () => {
  expect(getSlowSpeedOverride()).toBeUndefined();
  db().prepare(`INSERT INTO settings (key, value) VALUES ('listening_slow_speed', 'on')`).run();
  expect(getSlowSpeedOverride()).toBe("on");
});

test("migration 2 upgrades a plan 2 database (user_version 2) without losing existing data", () => {
  const conn = new Database(":memory:");
  conn.exec(migrations[0]);
  conn.exec(migrations[1]);
  conn.pragma("user_version = 2");
  conn.exec(`INSERT INTO subjects (id, domain, source, tier, title, article, task, created_at) VALUES ('s', 'libre', 'topic', 1, 'T', 'A', 'C', 'x')`);
  conn.exec(`INSERT INTO sessions (id, subject_id, tier, status, started_at, updated_at) VALUES ('a', 's', 1, 'corrected', 'x', 'x')`);
  conn.exec(`INSERT INTO users (id, login, role, password_hash, created_at) VALUES ('u', 'eleve', 'student', 'h', 'x')`);

  expect(conn.pragma("user_version", { simple: true })).toBe(2);
  conn.exec(migrations[2]);
  conn.pragma("user_version = 3");

  expect(conn.pragma("user_version", { simple: true })).toBe(3);
  const names = (conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name);
  expect(names).toEqual(expect.arrayContaining(["listenings", "listening_attempts"]));
  expect(conn.prepare(`SELECT title FROM subjects WHERE id = 's'`).get()).toEqual({ title: "T" });
  expect(conn.prepare(`SELECT id FROM sessions WHERE id = 'a'`).get()).toEqual({ id: "a" });
  expect(conn.prepare(`SELECT id FROM users WHERE id = 'u'`).get()).toEqual({ id: "u" });

  conn.exec(`INSERT INTO listenings (id, domain, source, format, level, title, context, script, audio_path, duration_sec, created_at)
    VALUES ('l', 'comm', 'generated', 'interview', 'B1', 'T', 'C', '[]', 'x.mp3', 60, 'x')`);
  conn.exec(`INSERT INTO listening_attempts (id, listening_id, started_at, updated_at) VALUES ('att', 'l', 'x', 'x')`);
  expect(conn.prepare(`SELECT status FROM listening_attempts WHERE id = 'att'`).get()).toEqual({ status: "draft" });
  conn.close();
});
