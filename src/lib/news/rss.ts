import type { Profile } from "@/lib/profile";

// Domaine d'une actualité : clé d'un thème d'intérêt du profil.
export type NewsDomain = string;

// Paramètres de langue de Google News : édition du pays de référence de la langue.
const EDITIONS: Record<string, [hl: string, gl: string, ceid?: string]> = {
  en: ["en-GB", "GB"],
  es: ["es", "ES"],
  de: ["de", "DE"],
  it: ["it", "IT"],
  pt: ["pt-PT", "PT", "PT:pt-150"],
  nl: ["nl", "NL"],
  ja: ["ja", "JP"],
  zh: ["zh-CN", "CN", "CN:zh-Hans"],
  ko: ["ko", "KR"],
  ar: ["ar", "EG"],
  ru: ["ru", "RU"],
  pl: ["pl", "PL"],
  sv: ["sv", "SE"],
  fr: ["fr", "FR"],
  el: ["el", "GR"],
  tr: ["tr", "TR"],
  uk: ["uk", "UA"],
  cs: ["cs", "CZ"],
  no: ["no", "NO"],
  da: ["da", "DK"],
  fi: ["fi", "FI"],
  he: ["he", "IL"],
  hi: ["hi", "IN"],
};

export function googleNewsParams(code: string): string {
  const [hl, gl, ceid = `${gl}:${code}`] = EDITIONS[code] ?? [code, code.toUpperCase()];
  return `hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

export const googleNewsUrl = (query: string, code: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${googleNewsParams(code)}`;

/** Un flux par thème d'intérêt du profil, dans la langue étudiée. */
export const newsFeeds = (profile: Profile): { domain: NewsDomain; url: string }[] =>
  profile.interests.map((i) => ({ domain: i.key, url: googleNewsUrl(i.query, profile.target.code) }));

export type RssItem = { title: string; link: string; pubDate?: string; source?: string; description?: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  });
}

// Texte brut : entités décodées, balises HTML retirées (la description Google News est du HTML échappé).
function plain(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const text = decodeEntities(decodeEntities(cdata ? cdata[1] : raw).replace(/<[^>]+>/g, " "));
  return text.replace(/\s+/g, " ").trim() || undefined;
}

function tag(block: string, name: string): string | undefined {
  return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1];
}

// parseur minimal pour le RSS 2.0 « à plat » de Google News ; un flux Atom ou imbriqué demanderait fast-xml-parser.
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const block of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    let title = plain(tag(block, "title"));
    const link = plain(tag(block, "link"));
    if (!title || !link) continue;
    const source = plain(tag(block, "source"));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const item: RssItem = { title, link };
    const pubDate = plain(tag(block, "pubDate"));
    const description = plain(tag(block, "description"));
    if (pubDate) item.pubDate = pubDate;
    if (source) item.source = source;
    if (description) item.description = description;
    items.push(item);
  }
  return items;
}

export async function fetchFeed(url: string, fetchFn: typeof fetch = fetch): Promise<RssItem[]> {
  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "Learnee/1.0 (usage personnel)" },
  });
  if (!res.ok) throw new Error(`Flux RSS indisponible (${res.status})`);
  return parseRss(await res.text());
}
