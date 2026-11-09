import { randomUUID } from "node:crypto";
import { createAuthSession, SESSION_COOKIE, type Role, type User } from "@/lib/auth";
import { db } from "@/lib/db";
import { testCookies } from "./next-headers";

// Connecte un utilisateur neuf dans le faux cookie (null = déconnecté). À appeler après resetDbForTests().
export function signInAs(role: Role | null): User | null {
  testCookies.clear();
  if (!role) return null;
  const user: User = { id: randomUUID(), login: `${role}-${randomUUID().slice(0, 8)}`, role };
  db()
    .prepare(`INSERT INTO users (id, login, role, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)`)
    .run(user.id, user.login, role, new Date().toISOString());
  testCookies.set(SESSION_COOKIE, createAuthSession(user.id));
  return user;
}
