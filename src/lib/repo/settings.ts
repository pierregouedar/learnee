import { db } from "@/lib/db";
import type { Tier } from "@/lib/tiers";

export function getTier(): Tier {
  const row = db().prepare(`SELECT value FROM settings WHERE key = 'tier'`).get() as { value: string } | undefined;
  return (row ? Number(row.value) : 1) as Tier;
}

export function setTier(tier: Tier) {
  db()
    .prepare(`INSERT INTO settings (key, value) VALUES ('tier', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(String(tier));
}

export function getJsonSetting<T>(key: string, fallback: T): T {
  const row = db().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    console.error(`Failed to parse JSON setting for key: ${key}`);
    return fallback;
  }
}

export function setJsonSetting(key: string, value: unknown) {
  db()
    .prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, JSON.stringify(value));
}
