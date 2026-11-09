import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { db, resetDbForTests } from "@/lib/db";
import { createSession, saveCorrection, setCorrecting } from "@/lib/repo/sessions";
import { insertSubject } from "@/lib/repo/subjects";
import type { Correction, ErrorItem } from "@/lib/schemas";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));
const mail = vi.hoisted(() => ({ configured: false, send: vi.fn() }));
vi.mock("@/lib/mail", () => ({ mailConfigured: () => mail.configured, sendMail: (...a: unknown[]) => mail.send(...a) }));

const { buildWeeklyReport, formatWeeklyReport, latestAdvice, sendWeeklyReport } = await import("./weekly-report");

const e = (categorie: ErrorItem["categorie"], type: ErrorItem["type"] = "grammaire"): ErrorItem => ({
  extrait: "x", correction: "y", explication: "z", type, categorie,
});
const correction = (notes: [number, number], erreurs: ErrorItem[]): Correction => ({
  compte_rendu: { note: notes[0], commentaire: "c", idees_manquantes: [] },
  expression: { note: notes[1], niveau: "B1", erreurs, points_forts: [], version_amelioree: "v" },
  vocabulaire: [],
  conseil: "k",
});

function seed() {
  const subjectId = insertSubject({ domain: "libre", source: "topic", tier: 1, title: "Les pubs IA", article: "A", task: "C", guideQuestions: [], keywords: [] }).id;
  const ids: string[] = [];
  for (const [notes, erreurs, mock] of [
    [[6, 7], [e("articles"), e("articles"), e(undefined, "vocabulaire")], false],
    [[5, 5.5], [e("articles")], true],
  ] as const) {
    const s = createSession(subjectId, 1);
    if (mock) db().prepare(`UPDATE sessions SET is_mock = 1 WHERE id = ?`).run(s.id);
    setCorrecting(s.id);
    saveCorrection(s.id, correction([...notes], [...erreurs]));
    ids.push(s.id);
  }
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO grammar_sets (id, point, level, created_at) VALUES ('g', 'passive', 'A2', ?)`).run(now);
  db().prepare(`INSERT INTO grammar_attempts (id, set_id, point, score, started_at, finished_at) VALUES ('a', 'g', 'passive', 50, ?, ?)`).run(now, now);
  db().prepare(`INSERT INTO rewrites (id, session_id, pe, result, created_at) VALUES ('r', ?, 'pe', ?, ?)`).run(ids[0], JSON.stringify({ rate: 67 }), now);
}

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  mail.send.mockReset();
  mail.configured = false;
  vi.stubEnv("LLM_MODEL_WEEKLY_REPORT", "a/gratuit:free,b/secours:free");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("the report gathers the week's work", () => {
  seed();
  const r = buildWeeklyReport(new Date(Date.now() + 1000));
  expect(r.writing).toEqual([
    { title: "Les pubs IA", total: 13, isMock: false },
    { title: "Les pubs IA", total: 10.5, isMock: true },
  ]);
  expect(r.grammar).toEqual([{ point: "passive", score: 50 }]);
  expect(r.weakPoints).toEqual(["passive"]);
  expect(r.rewrites).toEqual([67]);
  expect(r.recurringErrors).toEqual([{ label: "Articles", count: 3 }]);
  expect(r.listening).toEqual([]);
  expect(r.wordsAcquired).toBe(0);
});

test("older work is left out", () => {
  seed();
  const r = buildWeeklyReport(new Date(Date.now() + 8 * 86_400_000));
  expect(r.writing).toEqual([]);
  expect(r.grammar).toEqual([]);
});

test("the text version reads well in French", () => {
  seed();
  const text = formatWeeklyReport(buildWeeklyReport(new Date(Date.now() + 1000)), "Travailler les articles.");
  expect(text).toContain("Sujets écrits : 2");
  expect(text).toContain("- Les pubs IA : 10,5/20 (examen blanc)");
  expect(text).toContain("Écoutes : 0");
  expect(text).toContain("- Voix passive : 50 %");
  expect(text).toContain("Réécritures : 1 (erreurs corrigées : 67 %)");
  expect(text).toContain("Erreurs récurrentes : Articles (3)");
  expect(text).toContain("Points de grammaire en difficulté : Voix passive");
  expect(text).toContain("Mots acquis (total) : 0");
  expect(text).toContain("À travailler à l’oral cette semaine : Travailler les articles.");
});

test("Sunday job: advice stored, e-mail sent when SMTP is configured", async () => {
  seed();
  mail.configured = true;
  callJson.mockResolvedValueOnce({ conseil: "Travailler les articles." });
  const now = new Date(Date.now() + 1000);
  await sendWeeklyReport(now);
  expect(callJson).toHaveBeenCalledWith("weekly_report", expect.stringContaining("Sujets écrits : 2"), expect.anything());
  expect(mail.send).toHaveBeenCalledWith({
    subject: "Learnee · bilan de la semaine",
    text: expect.stringContaining("À travailler à l’oral cette semaine : Travailler les articles."),
  });
  expect(latestAdvice(now)).toBe("Travailler les articles.");
  expect(latestAdvice(new Date(now.getTime() + 8 * 86_400_000))).toBeUndefined();
});

test("without SMTP nothing is sent; an LLM failure only drops the advice", async () => {
  callJson.mockRejectedValueOnce(new Error("panne"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  await sendWeeklyReport(new Date());
  expect(mail.send).not.toHaveBeenCalled();
  mail.configured = true;
  callJson.mockRejectedValueOnce(new Error("panne"));
  await sendWeeklyReport(new Date());
  expect(mail.send).toHaveBeenCalledWith({ subject: "Learnee · bilan de la semaine", text: expect.not.stringContaining("À travailler") });
});

test("a paid model in the list: the scheduled job never calls it", async () => {
  vi.stubEnv("LLM_MODEL_WEEKLY_REPORT", "a/gratuit:free,openai/payant");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mail.configured = true;
  await sendWeeklyReport(new Date());
  expect(callJson).not.toHaveBeenCalled();
  expect(mail.send).toHaveBeenCalledWith({ subject: "Learnee · bilan de la semaine", text: expect.not.stringContaining("À travailler") });
});
