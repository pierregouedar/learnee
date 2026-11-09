import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { migrations } from "./migrations";

test("plan 4 appends exactly one migration, at index 3, creating its tables", () => {
  resetDbForTests();
  expect(migrations.length).toBeGreaterThanOrEqual(4);
  const tables = (db().prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
    (r) => r.name,
  );
  for (const t of ["grammar_sets", "grammar_items", "grammar_attempts", "grammar_mastery", "placements", "rewrites"]) {
    expect(tables).toContain(t);
  }
  expect(db().pragma("user_version", { simple: true })).toBe(migrations.length);
});

test("upgrades a user_version 3 DB that already holds data, keeping it intact and adding plan 4 tables", () => {
  resetDbForTests();
  const conn = new Database(":memory:");
  conn.pragma("foreign_keys = ON");
  for (let i = 0; i < 3; i++) {
    conn.transaction(() => {
      conn.exec(migrations[i]);
      conn.pragma(`user_version = ${i + 1}`);
    })();
  }
  conn.prepare(`INSERT INTO settings (key, value) VALUES ('tier', '2')`).run();
  expect(conn.pragma("user_version", { simple: true })).toBe(3);

  conn.transaction(() => {
    conn.exec(migrations[3]);
    conn.pragma("user_version = 4");
  })();

  expect(conn.pragma("user_version", { simple: true })).toBe(4);
  const row = conn.prepare(`SELECT value FROM settings WHERE key = 'tier'`).get() as { value: string };
  expect(row.value).toBe("2");
  const tables = (conn.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
    (r) => r.name,
  );
  for (const t of ["grammar_sets", "grammar_items", "grammar_attempts", "grammar_mastery", "placements", "rewrites"]) {
    expect(tables).toContain(t);
  }
  conn.close();
});
