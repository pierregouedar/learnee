import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { migrations } from "./migrations";

const names = (rows: unknown[]) => (rows as { name: string }[]).map((r) => r.name);

test("migration 1 creates plan 2 tables and session columns", () => {
  resetDbForTests();
  const conn = db();
  expect(conn.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(2);
  expect(names(conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all())).toEqual(
    expect.arrayContaining(["users", "auth_sessions", "definitions", "cards", "card_contexts", "review_logs", "news_items"]),
  );
  expect(names(conn.prepare(`PRAGMA table_info(sessions)`).all())).toEqual(expect.arrayContaining(["lookups", "exam_mode"]));
});

test("migration 1 upgrades an MVP database without losing sessions", () => {
  const conn = new Database(":memory:");
  conn.exec(migrations[0]);
  conn.exec(`INSERT INTO subjects (id, domain, source, tier, title, article, task, created_at) VALUES ('s', 'libre', 'topic', 1, 'T', 'A', 'C', 'x')`);
  conn.exec(`INSERT INTO sessions (id, subject_id, tier, status, started_at, updated_at) VALUES ('a', 's', 1, 'corrected', 'x', 'x')`);
  conn.exec(migrations[1]);
  expect(conn.prepare(`SELECT lookups, exam_mode FROM sessions WHERE id = 'a'`).get()).toEqual({ lookups: "[]", exam_mode: 0 });
  conn.close();
});
