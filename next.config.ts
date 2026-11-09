import type { NextConfig } from "next";

// En-têtes de sécurité sur toutes les réponses : pas d'affichage dans une iframe d'un autre site (clickjacking),
// pas de devinette de type de fichier, pas de fuite d'URL vers d'autres sites, pas d'accès caméra/position.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "node-cron"],
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
