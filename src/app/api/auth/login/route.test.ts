import { afterEach, beforeEach, expect, test, vi } from "vitest";

// Mock local, séparé de src/lib/testing/next-headers.ts : celui-ci jette les options de cookie,
// on a besoin de les capturer pour vérifier httpOnly/sameSite/path/maxAge.
const setCalls: Array<[string, string, Record<string, unknown>]> = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    has: () => false,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push([name, value, options]);
    },
    delete: () => {},
  }),
}));

import { resetLoginFailuresForTests, SESSION_DAYS } from "@/lib/auth";
import { db, resetDbForTests } from "@/lib/db";
import { hashPassword } from "../../../../../scripts/user-add.mjs";
import { POST as login } from "./route";

const attempt = (loginValue: string, password: string, headers: Record<string, string> = {}) =>
  login(
    new Request("http://t/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ login: loginValue, password }),
    }),
  );

beforeEach(() => {
  resetDbForTests();
  setCalls.length = 0;
  resetLoginFailuresForTests();
  db()
    .prepare(`INSERT INTO users (id, login, role, password_hash, created_at) VALUES ('u', 'eleve', 'student', ?, 'x')`)
    .run(hashPassword("motdepasse1"));
});

test("login sets a hardened session cookie", async () => {
  const res = await attempt("eleve", "motdepasse1");
  expect(res.status).toBe(204);
  expect(setCalls).toHaveLength(1);
  const [name, value, options] = setCalls[0];
  expect(name).toBe("learnee_session");
  expect(value).toBeTruthy();
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86_400 });
});

test("login is blocked after too many failures, with the French message", async () => {
  for (let i = 0; i < 5; i++) await attempt("eleve", "faux");
  const res = await attempt("eleve", "faux");
  expect(res.status).toBe(429);
  expect((await res.json()).error).toBe("Trop d'essais. Réessaie plus tard.");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// 20 échecs répartis sur 5 comptes (sous le seuil par compte), chacun avec une IP différente annoncée.
test.each([
  { trusted: undefined, status: 429 },
  { trusted: "cf-connecting-ip", status: 204 },
])("IP limit with TRUSTED_IP_HEADER=$trusted: next login gets $status", async ({ trusted, status }) => {
  if (trusted) vi.stubEnv("TRUSTED_IP_HEADER", trusted);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  for (let i = 0; i < 20; i++) await attempt(`inconnu${i % 5}`, "faux", { "CF-Connecting-IP": `203.0.113.${i}` });
  expect((await attempt("eleve", "motdepasse1", { "CF-Connecting-IP": "198.51.100.1" })).status).toBe(status);
});
