import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/session-cookie";

export { SESSION_COOKIE, SESSION_DAYS };
export type Role = "student" | "viewer";
export type User = { id: string; login: string; role: Role };

// Anti-force brute : par couple identifiant + IP, 5 échecs / 15 min ET 20 / 24 h (une attaque lente ne passe pas) ;
// par adresse IP, 20 échecs / heure tous comptes confondus (une IP ne peut pas arroser plusieurs comptes).
// Compter par couple et non par compte : sinon n'importe qui connaissant l'identifiant bloque l'élève 24 h.
export const MAX_LOGIN_FAILURES = 5;
export const MAX_DAILY_FAILURES = 20;
export const MAX_IP_FAILURES = 20;
const FAILURE_WINDOW_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const IP_WINDOW_MS = 60 * 60_000;

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Hash factice : un identifiant inconnu coûte le même temps qu'un mauvais mot de passe.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

// Format écrit par scripts/user-add.mjs : scrypt$<sel>$<hash>
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const saltBuf = Buffer.from(salt, "base64");
  const expected = Buffer.from(hash, "base64");
  if (saltBuf.length === 0 || expected.length !== 64) return false;
  const actual = await scrypt(password, saltBuf, expected.length);
  return timingSafeEqual(actual, expected);
}

const LOGIN_FORMAT = /^[a-z0-9._-]{2,32}$/;

// compteur en mémoire par identifiant ; remis à zéro au redémarrage, suffisant pour deux comptes.
type FailureEntry = { times: number[]; real: boolean };
const failures = new Map<string, FailureEntry>();
const MAX_TRACKED_LOGINS = 1000;

const ipFailures = new Map<string, number[]>();

export function resetLoginFailuresForTests() {
  failures.clear();
  ipFailures.clear();
}

function recentIpFailures(ip: string, now: number): number[] {
  const recent = (ipFailures.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length > 0) ipFailures.set(ip, recent);
  else ipFailures.delete(ip);
  return recent;
}

function recordIpFailure(ip: string, now: number) {
  // plafond de taille grossier ; au-delà, on repart de zéro plutôt que de laisser la mémoire grossir.
  if (!ipFailures.has(ip) && ipFailures.size >= MAX_TRACKED_LOGINS * 10) ipFailures.clear();
  ipFailures.set(ip, [...recentIpFailures(ip, now), now]);
}

function recentFailures(login: string, now: number): number[] {
  const entry = failures.get(login);
  if (!entry) return [];
  const recent = entry.times.filter((t) => now - t < DAY_MS);
  if (recent.length > 0) failures.set(login, { ...entry, times: recent });
  else failures.delete(login);
  return recent;
}

function isBlocked(times: number[], now: number): boolean {
  return times.length >= MAX_DAILY_FAILURES || times.filter((t) => now - t < FAILURE_WINDOW_MS).length >= MAX_LOGIN_FAILURES;
}

// Retire toutes les entrées expirées de la map (pas seulement celle demandée) : appelé quand la map est
// pleine, avant de refuser ou d'évincer quoi que ce soit.
function sweepExpiredFailures(now: number) {
  for (const [login, entry] of failures) {
    const recent = entry.times.filter((t) => now - t < DAY_MS);
    if (recent.length > 0) failures.set(login, { ...entry, times: recent });
    else failures.delete(login);
  }
}

// Enregistre AVANT l'attente de verifyPassword : sans ça, des requêtes concurrentes lisent
// toutes le même compteur avant qu'aucune n'ait rien écrit et contournent le blocage.
// `real` indique si `login` correspond à un compte existant.
function recordFailure(login: string, now: number, real: boolean) {
  const recent = [...recentFailures(login, now), now];
  if (!failures.has(login) && failures.size >= MAX_TRACKED_LOGINS) sweepExpiredFailures(now);
  if (!failures.has(login) && failures.size >= MAX_TRACKED_LOGINS) {
    if (!real) {
      // Toujours pleine après nettoyage, et cet identifiant ne correspond à aucun compte : un
      // identifiant inconnu ne peut pas être brute-forcé, inutile de le suivre.
      return;
    }
    // Compte réel : on fait de la place en évinçant un identifiant qui NE correspond PAS à un compte
    // existant (jamais celui d'un compte réel — sinon un attaquant pourrait spammer des identifiants
    // bidons pour faire évincer, donc réinitialiser, le compteur de sa victime).
    for (const [k, entry] of failures) {
      if (!entry.real) {
        failures.delete(k);
        break;
      }
    }
  }
  failures.set(login, { times: recent, real });
}

function clearFailures(login: string) {
  failures.delete(login);
}

export function createAuthSession(userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  db().prepare(`DELETE FROM auth_sessions WHERE expires_at < ?`).run(now.toISOString());
  db()
    .prepare(`INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run(sha256(token), userId, new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(), now.toISOString());
  return token;
}

export async function signIn(
  login: string,
  password: string,
  ip = "inconnue",
): Promise<{ ok: true; token: string } | { ok: false; reason: "invalid" | "blocked" }> {
  const key = login.trim().toLowerCase();
  const pair = `${key}|${ip}`;
  const now = Date.now();
  // Format invalide : jamais un identifiant réel, donc on ne fait pas grossir la map de compteurs pour ça.
  const trackable = LOGIN_FORMAT.test(key);
  if (recentIpFailures(ip, now).length >= MAX_IP_FAILURES || (trackable && isBlocked(recentFailures(pair, now), now))) {
    console.warn(`[auth] connexion bloquée login=${key.slice(0, 32)} ip=${ip}`);
    return { ok: false, reason: "blocked" };
  }
  const row = trackable
    ? (db().prepare(`SELECT id, password_hash FROM users WHERE login = ?`).get(key) as
        | { id: string; password_hash: string }
        | undefined)
    : undefined;
  if (trackable) recordFailure(pair, now, Boolean(row));
  recordIpFailure(ip, now);
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !valid) {
    console.warn(`[auth] échec de connexion login=${key.slice(0, 32)} ip=${ip}`);
    return { ok: false, reason: "invalid" };
  }
  clearFailures(pair);
  ipFailures.delete(ip);
  return { ok: true, token: createAuthSession(row.id) };
}

const RENEWAL_THRESHOLD_MS = 7 * 86_400_000;

export function userForToken(token: string | undefined): User | null {
  if (!token) return null;
  const now = new Date();
  const hash = sha256(token);
  const row = db()
    .prepare(
      `SELECT u.id, u.login, u.role, s.expires_at FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hash, now.toISOString()) as (User & { expires_at: string }) | undefined;
  if (!row) return null;
  // Renouvellement glissant : moins de 7 jours restants, on repousse l'expiration.
  if (new Date(row.expires_at).getTime() - now.getTime() < RENEWAL_THRESHOLD_MS) {
    db()
      .prepare(`UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?`)
      .run(new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(), hash);
  }
  return { id: row.id, login: row.login, role: row.role };
}

export function signOut(token: string | undefined) {
  if (token) db().prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).run(sha256(token));
}

export async function getCurrentUser(): Promise<User | null> {
  return userForToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStudent(): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  if (user.role !== "student") return Response.json({ error: "Ce compte peut seulement consulter, pas modifier." }, { status: 403 });
  return user;
}

// Never decode the result: it is returned exactly as the URL parser normalised it.
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  try {
    const u = new URL(next, "http://x");
    const out = u.pathname + u.search + u.hash;
    if (u.origin !== "http://x" || !out.startsWith("/") || out.startsWith("//") || out.startsWith("/\\")) return "/";
    return new URL(out, "http://x").origin === "http://x" ? out : "/";
  } catch {
    return "/";
  }
}
