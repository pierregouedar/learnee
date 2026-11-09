import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

import { resetDbForTests } from "@/lib/db";
import { signInAs } from "@/lib/testing/auth";
import { testCookies } from "@/lib/testing/next-headers";
import { POST as login } from "./auth/login/route";
import { POST as logout } from "./auth/logout/route";
import { PATCH as patchCard } from "./cards/[id]/route";
import { POST as postCard } from "./cards/route";
import { POST as define } from "./define/route";
import { DELETE as deleteSession, GET as getSession, PATCH as patchSession } from "./sessions/[id]/route";
import { POST as correct } from "./sessions/[id]/correct/route";
import { GET as listSessions, POST as postSession } from "./sessions/route";
import { GET as listSubjects, POST as postSubject } from "./subjects/route";
import { db } from "@/lib/db";
import { hashPassword } from "../../../scripts/user-add.mjs";

const json = (body: unknown, method = "POST") =>
  new Request("http://t/api", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: "nope" }) };

beforeEach(() => resetDbForTests());

const mutating: [string, () => Promise<Response>][] = [
  ["POST /api/subjects", () => postSubject(json({}))],
  ["POST /api/sessions", () => postSession(json({}))],
  ["PATCH /api/sessions/:id", () => patchSession(json({}, "PATCH"), ctx)],
  ["DELETE /api/sessions/:id", () => deleteSession(new Request("http://t", { method: "DELETE" }), ctx)],
  ["POST /api/sessions/:id/correct", () => correct(new Request("http://t", { method: "POST" }), ctx)],
  ["POST /api/define", () => define(json({}))],
  ["POST /api/cards", () => postCard(json({}))],
  ["PATCH /api/cards/:id", () => patchCard(json({}, "PATCH"), ctx)],
];

test.each(mutating)("%s: 401 signed out, 403 viewer, allowed for student", async (_name, call) => {
  signInAs(null);
  expect((await call()).status).toBe(401);
  signInAs("viewer");
  expect((await call()).status).toBe(403);
  signInAs("student");
  expect([401, 403]).not.toContain((await call()).status);
});

test("GET routes: 401 signed out, open to the viewer", async () => {
  signInAs(null);
  expect((await listSessions(new Request("http://t/api/sessions"))).status).toBe(401);
  expect((await listSubjects(new Request("http://t/api/subjects"))).status).toBe(401);
  expect((await getSession(new Request("http://t"), ctx)).status).toBe(401);
  signInAs("viewer");
  expect((await listSessions(new Request("http://t/api/sessions"))).status).toBe(200);
  expect((await listSubjects(new Request("http://t/api/subjects"))).status).toBe(200);
  expect((await getSession(new Request("http://t"), ctx)).status).toBe(404);
});

test("login sets the session cookie, logout clears it", async () => {
  db()
    .prepare(`INSERT INTO users (id, login, role, password_hash, created_at) VALUES ('u', 'eleve', 'student', ?, 'x')`)
    .run(hashPassword("motdepasse1"));
  signInAs(null);
  expect((await login(json({ login: "eleve", password: "faux" }))).status).toBe(401);
  expect((await login(json({ login: "", password: "" }))).status).toBe(400);
  expect((await login(json({ login: "Eleve", password: "motdepasse1" }))).status).toBe(204);
  expect(testCookies.get("learnee_session")).toBeTruthy();
  expect((await listSessions(new Request("http://t/api/sessions"))).status).toBe(200);
  expect((await logout()).status).toBe(204);
  expect(testCookies.has("learnee_session")).toBe(false);
});

// Balayage statique : toute route mutante en dehors de /api/auth doit appeler requireStudent(),
// pour ne pas dépendre uniquement de ce que la liste `mutating` ci-dessus pense à couvrir.
function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findRouteFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

test("every mutating API route (outside /api/auth) calls requireStudent(", () => {
  const apiDir = join(__dirname);
  const files = findRouteFiles(apiDir).filter((f) => !f.includes(`${join("api", "auth")}${"/"}`));
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const mutates = /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/.test(src);
    if (mutates && !src.includes("requireStudent(")) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
