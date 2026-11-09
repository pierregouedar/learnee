import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

import { db, resetDbForTests } from "@/lib/db";
import { signInAs } from "@/lib/testing/auth";
import { hashPassword, upsertUser } from "../../scripts/user-add.mjs";
import {
  getCurrentUser, MAX_DAILY_FAILURES, MAX_IP_FAILURES, MAX_LOGIN_FAILURES, requireStudent, resetLoginFailuresForTests, safeNextPath, signIn, signOut,
  userForToken, verifyPassword,
} from "./auth";

beforeEach(() => {
  resetDbForTests();
  resetLoginFailuresForTests();
});

test("CLI hash is verified by the app, wrong or malformed fails", async () => {
  const h = hashPassword("motdepasse1");
  expect(h).toMatch(/^scrypt\$/);
  expect(await verifyPassword("motdepasse1", h)).toBe(true);
  expect(await verifyPassword("autre", h)).toBe(false);
  expect(await verifyPassword("x", "garbage")).toBe(false);
});

test("upsertUser validates input, creates then updates and revokes sessions", async () => {
  expect(() => upsertUser(db(), "A!", "student", "motdepasse1")).toThrow(/Identifiant/);
  expect(() => upsertUser(db(), "eleve", "admin", "motdepasse1")).toThrow(/Rôle/);
  expect(() => upsertUser(db(), "eleve", "student", "court")).toThrow(/8 caractères/);
  expect(upsertUser(db(), "eleve", "student", "motdepasse1")).toBe("created");
  const first = await signIn("Eleve", "motdepasse1");
  expect(first.ok).toBe(true);
  expect(upsertUser(db(), "eleve", "viewer", "nouveaumdp1")).toBe("updated");
  expect(userForToken(first.ok ? first.token : "")).toBeNull();
  const second = await signIn("eleve", "nouveaumdp1");
  expect(second.ok && userForToken(second.token)).toMatchObject({ login: "eleve", role: "viewer" });
});

test("sign in, current user from cookie, sign out", async () => {
  upsertUser(db(), "eleve", "student", "motdepasse1");
  expect(await signIn("eleve", "mauvais")).toEqual({ ok: false, reason: "invalid" });
  expect(await signIn("personne", "motdepasse1")).toEqual({ ok: false, reason: "invalid" });
  const r = await signIn("eleve", "motdepasse1");
  if (!r.ok) throw new Error("login failed");
  expect(userForToken(r.token)).toMatchObject({ login: "eleve", role: "student" });
  signOut(r.token);
  expect(userForToken(r.token)).toBeNull();
  expect(userForToken(undefined)).toBeNull();
});

test("expired sessions are ignored", async () => {
  const user = signInAs("student")!;
  expect(await getCurrentUser()).toMatchObject({ id: user.id });
  db().prepare(`UPDATE auth_sessions SET expires_at = '2000-01-01T00:00:00.000Z'`).run();
  expect(await getCurrentUser()).toBeNull();
});

test("requireStudent: 401 signed out, 403 viewer, user for student", async () => {
  signInAs(null);
  const out = (await requireStudent()) as Response;
  expect(out.status).toBe(401);
  expect((await out.json()).error).toBe("Connecte-toi pour continuer.");
  signInAs("viewer");
  expect(((await requireStudent()) as Response).status).toBe(403);
  const student = signInAs("student")!;
  expect(await requireStudent()).toEqual(student);
});

test("login is blocked after too many failures, even with the right password", async () => {
  upsertUser(db(), "bloque", "student", "motdepasse1");
  for (let i = 0; i < MAX_LOGIN_FAILURES; i++) await signIn("bloque", "faux");
  expect(await signIn("bloque", "motdepasse1")).toEqual({ ok: false, reason: "blocked" });
});

test("concurrent sign-in attempts cannot bypass the lockout", async () => {
  upsertUser(db(), "concu", "student", "motdepasse1");
  const results = await Promise.all(Array.from({ length: 10 }, () => signIn("concu", "faux")));
  const invalid = results.filter((r) => !r.ok && r.reason === "invalid");
  const blocked = results.filter((r) => !r.ok && r.reason === "blocked");
  expect(invalid.length).toBeLessThanOrEqual(MAX_LOGIN_FAILURES);
  expect(invalid.length + blocked.length).toBe(10);
  expect(blocked.length).toBeGreaterThan(0);
});

test(
  "cap eviction on the failure counter never resets a real account's lockout",
  async () => {
    upsertUser(db(), "victime", "student", "motdepasse1");
    for (let i = 0; i < MAX_LOGIN_FAILURES; i++) await signIn("victime", "faux");
    expect(await signIn("victime", "motdepasse1")).toEqual({ ok: false, reason: "blocked" });

    // Un attaquant qui pulvérise 1000+ identifiants bidons ne doit pas pouvoir faire évincer,
    // et donc réinitialiser, le compteur de la victime.
    await Promise.all(Array.from({ length: 1100 }, (_, i) => signIn(`junk${i}`, "faux")));

    expect(await signIn("victime", "motdepasse1")).toEqual({ ok: false, reason: "blocked" });
  },
  20_000,
);

test("safeNextPath only keeps same-site paths", () => {
  expect(safeNextPath("/historique?x=1#a")).toBe("/historique?x=1#a");
  expect(safeNextPath(undefined)).toBe("/");
  expect(safeNextPath("https://evil.example")).toBe("/");
  expect(safeNextPath("//evil.example")).toBe("/");
  expect(safeNextPath("/\\evil.example")).toBe("/");
  expect(safeNextPath("/\t/evil.com")).toBe("/");
  expect(safeNextPath("/\n/evil.com")).toBe("/");
  // "%09" is the already-percent-encoded form of a tab: URL parsing (WHATWG, same as browsers) keeps it
  // as a literal path segment on the same origin — it never becomes a host, so it is not an open redirect.
  expect(safeNextPath("/%09/evil.com")).toBe("/%09/evil.com");
  // Dot segments: the URL parser collapses "/.." against the base, turning the remainder into a
  // protocol-relative "//evil.com" path, which router.replace() would treat as an external host.
  expect(safeNextPath("/..//evil.com")).toBe("/");
  expect(safeNextPath("/a/..//evil.com")).toBe("/");
  expect(safeNextPath("/./\\evil.com")).toBe("/");
  expect(safeNextPath("/%2e%2e//evil.com")).toBe("/");
  // Array input (e.g. a repeated ?next= query param) must not throw.
  expect(safeNextPath(["/a", "/b"])).toBe("/");
});

test("slow brute force: past the daily cap the login stays blocked from that IP even when spaced out", async () => {
  upsertUser(db(), "lent", "student", "motdepasse1");
  vi.useFakeTimers();
  try {
    for (let i = 0; i < MAX_DAILY_FAILURES; i++) {
      await signIn("lent", "faux", "10.0.0.1");
      if ((i + 1) % MAX_LOGIN_FAILURES === 0) vi.advanceTimersByTime(61 * 60_000); // sous les seuils 15 min et IP/heure
    }
    expect(await signIn("lent", "motdepasse1", "10.0.0.1")).toEqual({ ok: false, reason: "blocked" });
    vi.advanceTimersByTime(24 * 60 * 60_000);
    expect((await signIn("lent", "motdepasse1", "10.0.0.1")).ok).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test("failures from an attacker's IP never lock the student out from another IP", async () => {
  upsertUser(db(), "eleve2", "student", "motdepasse1");
  for (let i = 0; i < MAX_LOGIN_FAILURES; i++) await signIn("eleve2", "faux", "6.6.6.7");
  expect(await signIn("eleve2", "motdepasse1", "6.6.6.7")).toEqual({ ok: false, reason: "blocked" });
  expect((await signIn("eleve2", "motdepasse1", "192.0.2.10")).ok).toBe(true);
});

test("one IP cannot spray many accounts: blocked after MAX_IP_FAILURES, other IPs unaffected", async () => {
  upsertUser(db(), "cible", "student", "motdepasse1");
  for (let i = 0; i < MAX_IP_FAILURES; i++) await signIn(`compte${i}`, "faux", "6.6.6.6");
  expect(await signIn("cible", "motdepasse1", "6.6.6.6")).toEqual({ ok: false, reason: "blocked" });
  expect((await signIn("cible", "motdepasse1", "1.2.3.4")).ok).toBe(true);
});
