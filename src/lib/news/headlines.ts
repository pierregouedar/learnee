import { db } from "@/lib/db";
import type { Progress } from "@/lib/generation-progress";
import type { Subject } from "@/lib/repo/subjects";
import { generateSubject } from "@/lib/services/generate-subject";
import { normalizeKey } from "@/lib/text";
import { getProfile } from "@/lib/profile";
import { fetchFeed, newsFeeds, type NewsDomain, type RssItem } from "./rss";

// Actualités à la demande : les titres viennent des flux RSS (gratuit, sans modèle) quand la page Écrit s'ouvre,
// et un sujet n'est rédigé par le modèle (payant) que pour le titre choisi.
export const REFRESH_MS = 60 * 60_000; // un même flux n'est pas relu plus d'une fois par heure
const FORCE_MIN_MS = 60_000; // ?refresh=1 : au plus une relecture forcée par minute
// Heure de la dernière relecture forcée : fetched_at ne bouge pas quand aucun titre n'est nouveau, il ne suffit pas.
let lastForced = 0;
export const RECENT_DAYS = 3;
export const PER_DOMAIN = 6;
const KEEP_DAYS = 30; // un titre déjà traité ne revient pas avant 30 jours
const MAX_AGE_DAYS = 14; // les flux mêlent de vieux articles : au-delà, ce n'est plus de l'actualité

export type Headline = { id: number; domain: NewsDomain; title: string; source?: string; publishedAt?: string };

// Spec §7.3 : en base, seulement titre et URL. Le résumé et la source du flux restent en mémoire, pour le brief.
const details = new Map<string, Pick<RssItem, "description" | "source" | "pubDate">>();

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function lastFetch(): string | undefined {
  return (db().prepare(`SELECT MAX(fetched_at) AS at FROM news_items`).get() as { at: string | null }).at ?? undefined;
}

/** Relit les flux si la dernière lecture a plus d'une heure (ou si `force`, au plus une fois par minute). Un flux en panne n'empêche pas les autres. */
export async function refreshHeadlines(force = false, fetchFn: typeof fetch = fetch, now = new Date()): Promise<void> {
  const last = lastFetch();
  if (force ? now.getTime() - lastForced < FORCE_MIN_MS : last && now.getTime() - Date.parse(last) < REFRESH_MS) return;
  if (force) lastForced = now.getTime();
  db().prepare(`DELETE FROM news_items WHERE fetched_at < ?`).run(daysAgo(now, KEEP_DAYS));
  const exists = db().prepare(`SELECT 1 FROM news_items WHERE url = ? OR title_key = ?`);
  const insert = db().prepare(
    `INSERT INTO news_items (domain, title, title_key, url, published_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  await Promise.all(
    newsFeeds(getProfile()).map(async ({ domain, url }) => {
      try {
        for (const item of await fetchFeed(url, fetchFn)) {
          const key = normalizeKey(item.title);
          details.set(item.link, { description: item.description, source: item.source, pubDate: item.pubDate });
          if (!key || exists.get(item.link, key)) continue;
          insert.run(domain, item.title, key, item.link, item.pubDate ?? null, now.toISOString());
        }
      } catch (e) {
        console.error(`[news] flux ${domain} indisponible`, e);
      }
    }),
  );
}

/** Titres récents non encore traités des thèmes du profil, les plus récents d'abord, PER_DOMAIN par domaine. Lecture base seule. */
export function listHeadlines(now = new Date()): Headline[] {
  const rows = db()
    .prepare(
      `SELECT id, domain, title, url, published_at, fetched_at FROM news_items WHERE used = 0 AND fetched_at >= ? ORDER BY id DESC`,
    )
    .all(daysAgo(now, RECENT_DAYS)) as { id: number; domain: NewsDomain; title: string; url: string; published_at: string | null; fetched_at: string }[];
  // Dates RSS en texte (« Wed, 23 Sep 2026… ») : le tri se fait sur la date lue, pas en SQL.
  const at = (r: (typeof rows)[number]) => (r.published_at && Date.parse(r.published_at)) || Date.parse(r.fetched_at);
  rows.sort((a, b) => at(b) - at(a));
  const domains = new Set(getProfile().interests.map((i) => i.key));
  const perDomain = new Map<NewsDomain, number>();
  const out: Headline[] = [];
  const oldest = now.getTime() - MAX_AGE_DAYS * 86_400_000;
  for (const r of rows) {
    const published = r.published_at ? Date.parse(r.published_at) : NaN;
    if (published < oldest || !domains.has(r.domain)) continue;
    const n = perDomain.get(r.domain) ?? 0;
    if (n >= PER_DOMAIN) continue;
    perDomain.set(r.domain, n + 1);
    const source = details.get(r.url)?.source;
    out.push({ id: r.id, domain: r.domain, title: r.title, ...(source ? { source } : {}), ...(r.published_at ? { publishedAt: r.published_at } : {}) });
  }
  return out;
}

export function buildBrief(item: RssItem): string {
  return [
    `Headline: ${item.title}`,
    item.description && `Summary: ${item.description.slice(0, 500)}`,
    item.source && `Source: ${item.source}`,
    item.pubDate && `Date: ${item.pubDate}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export class HeadlineNotFound extends Error {}

/** Titre encore disponible, avec son brief pour le modèle (sujet écrit ou script d'écoute). */
export function headlineBrief(id: number): { domain: NewsDomain; title: string; url: string; brief: string } {
  const row = db().prepare(`SELECT domain, title, url FROM news_items WHERE id = ? AND used = 0`).get(id) as
    | { domain: NewsDomain; title: string; url: string }
    | undefined;
  if (!row) throw new HeadlineNotFound("Cette actualité n’est plus disponible. Actualise la liste.");
  return { ...row, brief: buildBrief({ title: row.title, link: row.url, ...details.get(row.url) }) };
}

/** Rédige le sujet du titre choisi (seul appel payant du parcours actualités) et retire le titre de la liste. */
export async function subjectFromHeadline(id: number, onProgress?: (p: Progress) => void): Promise<Subject> {
  const { domain, url, brief } = headlineBrief(id);
  const subject = await generateSubject({ mode: "rss", domain, brief, url }, undefined, onProgress);
  db().prepare(`UPDATE news_items SET used = 1 WHERE id = ?`).run(id);
  return subject;
}
