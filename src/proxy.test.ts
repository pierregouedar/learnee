import { NextRequest } from "next/server";
import { expect, test } from "vitest";
import { proxy } from "./proxy";

test("page without cookie → /login with next", () => {
  const res = proxy(new NextRequest("http://localhost/historique?x=1"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost/login?next=%2Fhistorique%3Fx%3D1");
});

test("API without cookie → 401 JSON in French", async () => {
  const res = proxy(new NextRequest("http://localhost/api/sessions"));
  expect(res.status).toBe(401);
  expect((await res.json()).error).toBe("Connecte-toi pour continuer.");
});

test("cookie present → request goes through (real check in requireUser)", () => {
  const res = proxy(new NextRequest("http://localhost/", { headers: { cookie: "learnee_session=abc" } }));
  expect(res.headers.get("x-middleware-next")).toBe("1");
  // Renouvellement glissant : le cookie est reposé pour 30 jours à chaque page.
  expect(res.headers.get("set-cookie")).toMatch(/learnee_session=abc;.*Max-Age=2592000/i);
});

test("cross-site Sec-Fetch-Site on a mutation → 403", async () => {
  const res = proxy(
    new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site", cookie: "learnee_session=abc" },
    }),
  );
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Requête refusée.");
});

test("cross-site navigation to a paid API GET (ElevenLabs pronunciation) → 403; same-origin and typed URL pass", async () => {
  const get = (site: string) =>
    proxy(new NextRequest("http://localhost/api/pronounce?word=ditch", { headers: { "sec-fetch-site": site, cookie: "learnee_session=abc" } }));
  expect(get("cross-site").status).toBe(403);
  expect(get("same-site").status).toBe(403);
  expect(get("same-origin").headers.get("x-middleware-next")).toBe("1");
  expect(get("none").headers.get("x-middleware-next")).toBe("1");
});

test("foreign Origin on a mutation → 403", async () => {
  const res = proxy(
    new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { origin: "http://evil.example", host: "localhost", cookie: "learnee_session=abc" },
    }),
  );
  expect(res.status).toBe(403);
  expect((await res.json()).error).toBe("Requête refusée.");
});

test("text/plain body on a mutation → 415", async () => {
  const res = proxy(
    new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "text/plain", "content-length": "9", cookie: "learnee_session=abc" },
      body: "cr=&pe=x",
    }),
  );
  expect(res.status).toBe(415);
  expect((await res.json()).error).toBe("Format de requête non pris en charge.");
});

test("same-origin JSON mutation → passes through", () => {
  const res = proxy(
    new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        host: "localhost",
        "content-type": "application/json",
        "content-length": "2",
        cookie: "learnee_session=abc",
      },
      body: "{}",
    }),
  );
  expect(res.headers.get("x-middleware-next")).toBe("1");
});

test("empty-body DELETE → passes through", () => {
  const res = proxy(
    new NextRequest("http://localhost/api/sessions/abc", { method: "DELETE", headers: { cookie: "learnee_session=abc" } }),
  );
  expect(res.headers.get("x-middleware-next")).toBe("1");
});

test("signed-out logout → not redirected, not blocked", () => {
  const res = proxy(new NextRequest("http://localhost/api/auth/logout", { method: "POST" }));
  expect(res.headers.get("x-middleware-next")).toBe("1");
});

test("/login-x is not treated as the public login page", () => {
  const res = proxy(new NextRequest("http://localhost/login-x"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/login?next=");
});

test("session cookie is Secure only over https (direct or via X-Forwarded-Proto), so LAN http access keeps the login", () => {
  const cookie = (url: string, headers: Record<string, string> = {}) =>
    proxy(new NextRequest(url, { headers: { cookie: "learnee_session=abc", ...headers } })).headers.get("set-cookie") ?? "";
  expect(cookie("http://nas.local:3100/")).not.toMatch(/secure/i);
  expect(cookie("http://nas.local:3100/", { "x-forwarded-proto": "https" })).toMatch(/secure/i);
  expect(cookie("https://learnee.example/")).toMatch(/secure/i);
});
