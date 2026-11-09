#!/usr/bin/env node
// Crée ou met à jour un compte : pnpm user:add <identifiant> <student|viewer>
// En prod : docker compose exec app node scripts/user-add.mjs <identifiant> <student|viewer>
// Plain Node (pas de TypeScript) pour tourner aussi dans l'image de prod.
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

// Format lu par verifyPassword() dans src/lib/auth.ts : scrypt$<sel base64>$<hash base64> (N=16384, r=8, p=1, 64 octets).
export function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;
}

export function upsertUser(conn, login, role, password) {
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) {
    throw new Error("Identifiant : 2 à 32 caractères parmi a-z, 0-9, point, tiret et tiret bas.");
  }
  if (role !== "student" && role !== "viewer") throw new Error("Rôle : student (élève) ou viewer (lecture seule).");
  if (password.length < 8) throw new Error("Mot de passe : 8 caractères minimum.");
  const ready = conn.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'`).get();
  if (!ready) throw new Error("Base non initialisée : démarre l'appli une fois (pnpm dev), puis relance cette commande.");
  const existing = conn.prepare(`SELECT id FROM users WHERE login = ?`).get(login);
  const id = existing?.id ?? randomUUID();
  conn
    .prepare(
      `INSERT INTO users (id, login, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET role = excluded.role, password_hash = excluded.password_hash`,
    )
    .run(id, login, role, hashPassword(password), new Date().toISOString());
  conn.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(id);
  return existing ? "updated" : "created";
}

async function main() {
  const [rawLogin, role] = process.argv.slice(2);
  if (!rawLogin || !role) {
    console.error("Usage : pnpm user:add <identifiant> <student|viewer>");
    process.exit(1);
  }
  const isTTY = Boolean(process.stdin.isTTY);
  let password, confirm;
  if (isTTY) {
    // node:readline/promises n'appelle jamais _writeToOutput (donc pas de masquage possible) : on utilise
    // l'API legacy à callback, qui elle passe par _writeToOutput en mode terminal.
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    // Masque la saisie du mot de passe (on ne laisse passer que le retour à la ligne).
    rl._writeToOutput = (s) => {
      if (!muted) rl.output.write(s);
      else if (s.includes("\n") || s.includes("\r")) rl.output.write("\n");
    };
    const ask = (question) =>
      new Promise((resolve) => {
        muted = false;
        rl.question(question, (answer) => resolve(answer));
        muted = true;
      });
    password = await ask("Mot de passe : ");
    confirm = await ask("Confirme le mot de passe : ");
    rl.close();
  } else {
    // Entrée non interactive (pipe/script) : readline perd les 'line' events suivants quand on chaîne
    // plusieurs question() sur un flux non-TTY, donc on lit le flux brut et on découpe nous-mêmes.
    // Rien à masquer ici : il n'y a pas d'écho clavier sur une entrée non interactive.
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const lines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
    [password, confirm] = lines;
    password ??= "";
    confirm ??= "";
  }
  if (password !== confirm) throw new Error("Les deux mots de passe sont différents.");

  const file = process.env.DATABASE_PATH ?? "data/app.db";
  let conn;
  try {
    conn = new Database(file, { fileMustExist: true });
  } catch {
    throw new Error(`Base introuvable (${file}) : démarre l'appli une fois, puis relance cette commande.`);
  }
  conn.pragma("busy_timeout = 5000");
  const login = rawLogin.trim().toLowerCase();
  const result = upsertUser(conn, login, role, password);
  conn.close();
  console.log(`${result === "created" ? "Compte créé" : "Compte mis à jour"} : ${login} (${role === "student" ? "élève" : "lecture seule"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
