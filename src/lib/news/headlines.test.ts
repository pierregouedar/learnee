import { beforeEach, expect, test, vi } from "vitest";
import { db, resetDbForTests } from "@/lib/db";

const generateSubject = vi.fn();
vi.mock("@/lib/services/generate-subject", () => ({ generateSubject: (...a: unknown[]) => generateSubject(...a) }));
const { buildBrief, HeadlineNotFound, listHeadlines, PER_DOMAIN, refreshHeadlines, subjectFromHeadline } = await import("./headlines");

const rss = (domain: string, n: number) =>
  `<rss><channel>${Array.from(
    { length: n },
    (_, i) =>
      `<item><title>${domain} story ${i} - Daily</title><link>https://news.example/${domain}/${i}</link><source url="x">Daily</source><description>About ${domain} ${i}</description></item>`,
  ).join("")}</channel></rss>`;
const feeds = (n = 3, fail?: string) =>
  vi.fn(async (url: string) => {
    const domain = url.includes("carmaker") ? "auto" : url.includes("advertising") ? "comm" : "ia";
    return domain === fail ? new Response("down", { status: 503 }) : new Response(rss(domain, n));
  }) as unknown as typeof fetch;
const now = new Date("2026-09-24T09:00:00.000Z");

beforeEach(() => {
  resetDbForTests();
  generateSubject.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

test("headlines come from the feeds only (no model), at most PER_DOMAIN per domain, title and URL stored", async () => {
  await refreshHeadlines(false, feeds(PER_DOMAIN + 2), now);
  const list = listHeadlines(now);
  expect(list).toHaveLength(3 * PER_DOMAIN);
  expect(list[0]).toMatchObject({ title: expect.stringMatching(/story/), source: "Daily" });
  expect(generateSubject).not.toHaveBeenCalled();
  expect(db().prepare(`SELECT title, url FROM news_items WHERE url = ?`).get("https://news.example/comm/0")).toEqual({
    title: "comm story 0",
    url: "https://news.example/comm/0",
  });
});

test("feeds are read at most once an hour unless forced, forced at most once a minute; a broken feed does not stop the others", async () => {
  const fetchFn = feeds(2, "ia");
  await refreshHeadlines(false, fetchFn, now);
  await refreshHeadlines(false, fetchFn, new Date(now.getTime() + 10 * 60_000));
  expect(fetchFn).toHaveBeenCalledTimes(3);
  await refreshHeadlines(true, fetchFn, new Date(now.getTime() + 20 * 60_000));
  expect(fetchFn).toHaveBeenCalledTimes(6);
  await refreshHeadlines(true, fetchFn, new Date(now.getTime() + 20 * 60_000 + 30_000));
  expect(fetchFn).toHaveBeenCalledTimes(6);
  // Requêtes simultanées et flux sans titre nouveau : une seule relecture par minute.
  const later = new Date(now.getTime() + 25 * 60_000);
  await Promise.all([refreshHeadlines(true, fetchFn, later), refreshHeadlines(true, fetchFn, later)]);
  expect(fetchFn).toHaveBeenCalledTimes(9);
  expect(listHeadlines(now).map((h) => h.domain).sort()).toEqual(["auto", "auto", "comm", "comm"]);
});

test("choosing a headline generates its subject once, with the brief, then removes it from the list", async () => {
  await refreshHeadlines(false, feeds(1), now);
  const [first] = listHeadlines(now);
  generateSubject.mockResolvedValueOnce({ id: "s1" });
  await expect(subjectFromHeadline(first.id)).resolves.toEqual({ id: "s1" });
  expect(generateSubject).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "rss", brief: expect.stringContaining(`Headline: ${first.title}`) }),
    undefined,
    undefined,
  );
  expect(listHeadlines(now).some((h) => h.id === first.id)).toBe(false);
  await expect(subjectFromHeadline(first.id)).rejects.toBeInstanceOf(HeadlineNotFound);
});

test("brief keeps only headline, summary, source and date", () => {
  expect(buildBrief({ title: "T", link: "L", source: "S", pubDate: "D", description: "Sum" })).toBe(
    "Headline: T\nSummary: Sum\nSource: S\nDate: D",
  );
  expect(buildBrief({ title: "T", link: "L" })).toBe("Headline: T");
});

test("articles published more than 14 days ago are not offered", async () => {
  const old = `<rss><channel><item><title>Old story</title><link>https://news.example/old</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item><item><title>Fresh story</title><link>https://news.example/fresh</link><pubDate>Wed, 23 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  await refreshHeadlines(false, vi.fn(async () => new Response(old)) as unknown as typeof fetch, now);
  expect(listHeadlines(now).map((h) => h.title)).toEqual(["Fresh story"]);
});

test("most recent first, by real publication date", async () => {
  const xml = ["Mon, 21 Sep 2026", "Wed, 23 Sep 2026", "Tue, 22 Sep 2026"]
    .map((d, i) => `<item><title>Story ${i}</title><link>https://news.example/${i}</link><pubDate>${d} 10:00:00 GMT</pubDate></item>`)
    .join("");
  await refreshHeadlines(false, vi.fn(async () => new Response(`<rss><channel>${xml}</channel></rss>`)) as unknown as typeof fetch, now);
  expect(listHeadlines(now).map((h) => h.title)).toEqual(["Story 1", "Story 2", "Story 0"]);
});
