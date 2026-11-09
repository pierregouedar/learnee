// Séparé de auth.ts pour que proxy.ts puisse l'importer sans charger SQLite.
export const SESSION_COOKIE = "learnee_session";
export const SESSION_DAYS = 30;

/** Requête arrivée en https, directement ou derrière un proxy/tunnel (Cloudflare envoie X-Forwarded-Proto). */
export function isHttps(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto ? proto === "https" : new URL(req.url).protocol === "https:";
}

/**
 * Options du cookie de session : posé à la connexion, reposé à chaque page pour un renouvellement glissant.
 * `Secure` seulement en https : sinon le navigateur jette le cookie et l'accès en réseau local (http://nas:3100)
 * ne permet jamais de rester connecté.
 */
export const sessionCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
});
