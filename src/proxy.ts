import { NextResponse, type NextRequest } from "next/server";
import { isHttps, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";

// Chemins accessibles sans cookie de session : eux-mêmes exactement, ou leurs sous-chemins ("/login/x", pas "/login-x").
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/auth/logout"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Défense CSRF : un <form enctype="text/plain"> cross-site échappe au préflight CORS et peut POSTer avec un cookie.
// Sec-Fetch-Site (navigateurs modernes) puis Origin/Host sont la ceinture, le content-type refusé pour text/plain est les bretelles.
function rejectCrossSite(req: NextRequest): NextResponse | null {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!originHost || (host && originHost !== host)) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
  }

  const contentLength = req.headers.get("content-length");
  const hasBody = contentLength !== null && contentLength !== "0";
  if (hasBody) {
    const contentType = req.headers.get("content-type") ?? "";
    const allowed = contentType.startsWith("application/json") || contentType.startsWith("multipart/form-data");
    if (!allowed) return NextResponse.json({ error: "Format de requête non pris en charge." }, { status: 415 });
  }

  return null;
}

// Contrôle optimiste (présence du cookie) ; la vraie vérification est dans requireUser()/requireStudent().
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && req.method !== "GET" && req.method !== "HEAD") {
    const rejected = rejectCrossSite(req);
    if (rejected) return rejected;
  } else if (isApi) {
    // GET aussi : le cookie SameSite=Lax part sur une navigation cross-site, et certains GET coûtent
    // (prononciation ElevenLabs). Les pages de l'appli appellent l'API en same-origin ; "none" = URL tapée.
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }

  if (isPublic(pathname)) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    // Renouvellement glissant côté navigateur, en miroir de la prolongation en base (auth.ts) : un cookie
    // invalide reste refusé par requireUser(), le reposer ne donne aucun accès.
    const res = NextResponse.next();
    if (!isApi) res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(isHttps(req)));
    return res;
  }
  if (isApi) {
    return NextResponse.json({ error: "Connecte-toi pour continuer." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
