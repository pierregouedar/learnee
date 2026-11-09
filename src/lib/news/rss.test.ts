import { expect, test, vi } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/profile";
import { fetchFeed, googleNewsParams, newsFeeds, parseRss } from "./rss";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Google News</title>
<item>
  <title>Ford &amp; VW team up on EVs - Reuters</title>
  <link>https://news.google.com/rss/articles/abc</link>
  <pubDate>Mon, 21 Sep 2026 07:00:00 GMT</pubDate>
  <description>&lt;a href="https://x"&gt;Ford &amp;amp; VW team up on EVs&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Reuters&lt;/font&gt;</description>
  <source url="https://www.reuters.com">Reuters</source>
</item>
<item>
  <title><![CDATA[Brands bet on "AI influencers"]]></title>
  <link>https://news.google.com/rss/articles/def</link>
  <description><![CDATA[<p>Short &amp; sweet</p>]]></description>
</item>
<item><title>No link here</title></item>
</channel></rss>`;

test("parses Google News items: entities, CDATA, source suffix removed, items without link skipped", () => {
  expect(parseRss(XML)).toEqual([
    {
      title: "Ford & VW team up on EVs",
      link: "https://news.google.com/rss/articles/abc",
      pubDate: "Mon, 21 Sep 2026 07:00:00 GMT",
      source: "Reuters",
      description: "Ford & VW team up on EVs Reuters",
    },
    { title: 'Brands bet on "AI influencers"', link: "https://news.google.com/rss/articles/def", description: "Short & sweet" },
  ]);
});

test("default feeds are Google News searches in British English", () => {
  const feeds = newsFeeds(DEFAULT_PROFILE);
  expect(feeds.map((f) => f.domain)).toEqual(["comm", "ia", "auto"]);
  expect(feeds[2].url).toBe(
    "https://news.google.com/rss/search?q=carmaker%20OR%20electric%20vehicles%20Europe&hl=en-GB&gl=GB&ceid=GB:en",
  );
});

test("feeds follow the profile language and interests", () => {
  const feeds = newsFeeds({ ...DEFAULT_PROFILE, target: { code: "es", name: "Spanish" }, interests: [{ key: "cine", label: "Cinéma", query: "cine español" }] });
  expect(feeds).toEqual([{ domain: "cine", url: "https://news.google.com/rss/search?q=cine%20espa%C3%B1ol&hl=es&gl=ES&ceid=ES:es" }]);
  expect(googleNewsParams("zh")).toBe("hl=zh-CN&gl=CN&ceid=CN:zh-Hans");
  expect(googleNewsParams("xx")).toBe("hl=xx&gl=XX&ceid=XX:xx");
});

test("fetchFeed passes a timeout signal and throws on HTTP errors", async () => {
  const ok = vi.fn(async () => new Response(XML));
  expect(await fetchFeed("https://feed", ok as unknown as typeof fetch)).toHaveLength(2);
  const init = (ok.mock.calls[0] as unknown[])[1] as RequestInit;
  expect(init.signal).toBeInstanceOf(AbortSignal);
  const ko = vi.fn(async () => new Response("nope", { status: 503 }));
  await expect(fetchFeed("https://feed", ko as unknown as typeof fetch)).rejects.toThrow("503");
});
