import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE, signIn } from "@/lib/auth";
import { isHttps, sessionCookieOptions } from "@/lib/session-cookie";

const Body = z.object({ login: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Renseigne ton identifiant et ton mot de passe." }, { status: 400 });
  // IP du visiteur : seul l'en-tête posé par le proxy de confiance compte (CF-Connecting-IP derrière Cloudflare,
  // X-Forwarded-For derrière Caddy). Sans proxy devant l'app, le client écrirait lui-même ces en-têtes.
  const header = process.env.TRUSTED_IP_HEADER;
  const ip = (header && req.headers.get(header)?.split(",")[0]?.trim()) || "inconnue";
  const result = await signIn(body.data.login, body.data.password, ip);
  if (!result.ok) {
    return result.reason === "blocked"
      ? Response.json({ error: "Trop d'essais. Réessaie plus tard." }, { status: 429 })
      : Response.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(isHttps(req)));
  return new Response(null, { status: 204 });
}
