import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));
const refreshHeadlines = vi.fn(async () => {});
vi.mock("@/lib/news/headlines", () => ({ refreshHeadlines: (...args: unknown[]) => refreshHeadlines(...(args as [])) }));

const { db, resetDbForTests } = await import("@/lib/db");
const { getProgramme } = await import("@/lib/grammar-programme");
const { DEFAULT_PROFILE, getProfile, hasSavedProfile } = await import("@/lib/profile");
const { signInAs } = await import("@/lib/testing/auth");
const { POST } = await import("./route");

const post = (body: unknown, progress = false) =>
  POST(
    new Request("http://t/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(progress ? { Accept: "application/x-ndjson" } : {}) },
      body: JSON.stringify(body),
    }),
  );

const english = {
  code: "en",
  goal: { preset: "bts-com" },
  level: "B2",
  interests: [
    { key: "comm", label: "Comm" },
    { key: "ia", label: "IA" },
    { key: "auto", label: "Auto" },
  ],
};

const programme = {
  points: Array.from({ length: 16 }, (_, i) => ({ key: `punto_${i}`, label: `Point ${i}`, focus: "F.", group: "verbs", period: i % 4 })),
  verbs: [],
};

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  refreshHeadlines.mockClear();
});

test("student only: 401 signed out, 403 viewer, nothing saved", async () => {
  signInAs(null);
  expect((await post(english)).status).toBe(401);
  signInAs("viewer");
  expect((await post(english)).status).toBe(403);
  expect(hasSavedProfile()).toBe(false);
});

test("validation: interests 1 to 4, a custom goal needs a description, known language only", async () => {
  signInAs("student");
  expect((await post({ ...english, interests: [] })).status).toBe(400);
  expect((await post({ ...english, interests: Array(5).fill({ label: "Sport" }) })).status).toBe(400);
  expect((await post({ ...english, goal: { preset: "custom" } })).status).toBe(400);
  expect((await post({ ...english, level: "A1" })).status).toBe(400);
  const unknown = await post({ ...english, code: "zz" });
  expect(unknown.status).toBe(400);
  expect((await unknown.json()).error).toMatch(/inconnu/);
  expect((await post({ ...english, code: "fr" })).status).toBe(400);
  expect(hasSavedProfile()).toBe(false);
  expect(callJson).not.toHaveBeenCalled();
});

test("English with the default themes keeps the default queries, without any model call", async () => {
  signInAs("student");
  const res = await post({ ...english, level: "C1" });
  expect(res.status).toBe(200);
  expect(callJson).not.toHaveBeenCalled();
  expect(getProfile()).toEqual({ ...DEFAULT_PROFILE, level: "C1" });
  expect(refreshHeadlines).not.toHaveBeenCalled(); // même langue : les actualités restent
});

test("a new theme gets a query from the free model; a failed translation falls back to the label", async () => {
  signInAs("student");
  callJson.mockResolvedValueOnce({ interests: [{ key: "cinema", label: "Cinéma", query: "film industry OR box office" }] });
  await post({ ...english, interests: [{ key: "comm", label: "Comm" }, { label: "Cinéma" }] });
  expect(callJson).toHaveBeenCalledTimes(1);
  expect(callJson.mock.calls[0][0]).toBe("define");
  expect(getProfile().interests).toEqual([DEFAULT_PROFILE.interests[0], { key: "cinema", label: "Cinéma", query: "film industry OR box office" }]);

  callJson.mockRejectedValueOnce(new Error("down"));
  await post({ ...english, interests: [{ label: "Voyages" }] });
  expect(getProfile().interests).toEqual([{ key: "voyages", label: "Voyages", query: "Voyages" }]);
});

test("a new language: themes translated, programme prepared with live progress, old headlines dropped", async () => {
  signInAs("student");
  const now = new Date().toISOString();
  const news = db().prepare(`INSERT INTO news_items (domain, title, title_key, url, used, fetched_at) VALUES ('comm', ?, ?, ?, ?, ?)`);
  news.run("Old", "old", "https://n/1", 0, now);
  news.run("Used", "used", "https://n/2", 1, now);
  callJson.mockImplementation(async (task: string, _prompt: string, _schema: unknown, _ref: unknown, onText?: (t: string) => void) => {
    if (task === "define") return { interests: [{ key: "comm", label: "Comm", query: "publicidad OR marketing" }] };
    onText?.('{"points": [{"key": "a"}, {"key": "b"}');
    return programme;
  });

  const res = await post({ ...english, code: "es", goal: { preset: "custom", description: "Voyager au Mexique" }, interests: [{ key: "comm", label: "Comm" }] }, true);
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  const labels = events.filter((e) => e.progress).map((e) => e.progress.label);
  expect(labels).toEqual(["Traduction des thèmes", "Enregistrement", "Programme de grammaire", "Programme de grammaire : 2 points"]);
  expect(events.at(-1).done.status).toBe(200);

  expect(getProfile()).toMatchObject({ target: { code: "es", name: "Spanish" }, interests: [{ key: "comm", query: "publicidad OR marketing" }] });
  expect(getProgramme().points).toHaveLength(16);
  expect(db().prepare(`SELECT title FROM news_items`).all()).toEqual([{ title: "Used" }]);
  expect(refreshHeadlines).toHaveBeenCalledWith(true);

  // Programme déjà prêt : le réenregistrement ne le refait pas.
  callJson.mockClear();
  await post({ ...english, code: "es", goal: { preset: "b2" }, interests: [{ key: "comm", label: "Comm" }] });
  expect(callJson).not.toHaveBeenCalled();
});
