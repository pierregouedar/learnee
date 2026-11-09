import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { migrations } from "./migrations";

// un seul fichier SQLite, une seule connexion synchrone — largement suffisant pour un seul compte élève.
const g = globalThis as { __redacDb?: Database.Database };

function migrate(conn: Database.Database) {
  const current = conn.pragma("user_version", { simple: true }) as number;
  for (let i = current; i < migrations.length; i++) {
    conn.transaction(() => {
      conn.exec(migrations[i]);
      conn.pragma(`user_version = ${i + 1}`);
    })();
  }
}

export function db(): Database.Database {
  if (!g.__redacDb) {
    const file = process.env.DATABASE_PATH ?? "data/app.db";
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    const conn = new Database(file);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    conn.pragma("busy_timeout = 5000");
    migrate(conn);
    g.__redacDb = conn;
  }
  return g.__redacDb;
}

export function resetDbForTests() {
  g.__redacDb?.close();
  g.__redacDb = undefined;
}
