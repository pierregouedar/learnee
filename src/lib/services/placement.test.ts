import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { ENGLISH_PROGRAMME } from "@/lib/grammar-programme";
import { publicPlacement } from "@/lib/placement/schema";
import { placementPriorities } from "@/lib/repo/grammar";
import { savePlacementDraft } from "@/lib/repo/placements";
import { getTierHistory } from "@/lib/repo/progression";
import { getTier } from "@/lib/repo/settings";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));
const audio = vi.hoisted(() => ({ ready: [] as { id: string; durationSec: number }[], script: [] as { text: string }[], used: [] as string[] }));
vi.mock("@/lib/repo/listenings", () => ({
  listReadyListenings: () => audio.ready,
  getListening: (id: string) => (audio.ready.some((l) => l.id === id) ? { id, script: audio.script } : undefined),
  markListeningUsed: (id: string) => audio.used.push(id),
}));

const { PlacementError, createPlacement, submitPlacement } = await import("./placement");

const mcq = { question: "De quoi parle le texte ?", options: ["d’un salon", "d’une campagne", "d’un recrutement"], answer: 1 };
const generated = (over: object = {}) => ({
  grammar: Array.from({ length: 20 }, (_, i) => ({
    point: ENGLISH_PROGRAMME.points[i % ENGLISH_PROGRAMME.points.length].key, format: "gap", prompt: `We ___ (launch) product ${i}.`, accepted: ["launched"],
  })),
  reading: { title: "A new campaign", text: "Paragraph one.\n\nParagraph two.", questions: [mcq, mcq, mcq, mcq] },
  writing: { task: "Écrivez un court courriel à un client (environ 60 mots)." },
  ...over,
});
const sixty = Array.from({ length: 60 }, () => "word").join(" ");
const now = new Date(2026, 8, 22, 18);

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
  audio.ready = [];
  audio.script = [];
});

test("without a ready audio: no listening part; the public view hides every answer", async () => {
  callJson.mockResolvedValueOnce(generated());
  const p = await createPlacement(now);
  expect(callJson.mock.calls[0][0]).toBe("placement");
  expect(callJson.mock.calls[0][1]).not.toContain('"listening"');
  expect(p.content.listening).toBeUndefined();
  const pub = JSON.stringify(publicPlacement(p.content));
  expect(pub).not.toContain("launched");
  expect(pub).not.toContain('"answer"');
  expect(pub).not.toContain('"point"');
});

test("with ready audios: 3 questions on the shortest one", async () => {
  audio.ready = [{ id: "long", durationSec: 200 }, { id: "short", durationSec: 90 }];
  audio.script = [{ text: "Welcome to the show." }, { text: "Today: influencers." }];
  callJson.mockResolvedValueOnce(generated({ listening: { questions: [mcq, mcq, mcq] } }));
  const p = await createPlacement(now);
  expect(callJson.mock.calls[0][1]).toContain('"""Welcome to the show. Today: influencers."""');
  expect(p.content.listening).toMatchObject({ listeningId: "short", audioUrl: "/api/listening/short/audio" });
  expect(audio.used).toEqual(["short"]); // plus proposé ensuite comme exercice d'écoute
});

test("an incomplete test is regenerated once, then refused", async () => {
  const short = generated({ grammar: generated().grammar.slice(0, 10) });
  callJson.mockResolvedValue(short);
  await expect(createPlacement(now)).rejects.toBeInstanceOf(PlacementError);
  expect(callJson).toHaveBeenCalledTimes(2);
});

test("an unfinished test is resumed with its draft answers", async () => {
  callJson.mockResolvedValueOnce(generated());
  const a = await createPlacement(now);
  const draft = { grammar: ["launched"], reading: [1, null, null, null], writing: "Dear" };
  expect(savePlacementDraft(a.id, draft)).toBe(true);
  const b = await createPlacement(now);
  expect(b.id).toBe(a.id);
  expect(b.answers).toEqual(draft);
  expect(callJson).toHaveBeenCalledTimes(1);
});

test("first test: starting tier applied, 3 priorities stored for the grammar module", async () => {
  callJson.mockResolvedValueOnce(generated());
  const p = await createPlacement(now);
  callJson.mockResolvedValueOnce({ niveau: "B1", commentaire: "Message clair, quelques fautes." });
  const answers = { grammar: Array.from({ length: 20 }, (_, i) => (i < 5 ? "launch" : "Launched")), reading: [1, 1, 1, 1], writing: sixty };
  const r = await submitPlacement(p.id, answers, now);
  expect(callJson).toHaveBeenLastCalledWith("placement", expect.stringContaining(sixty), expect.anything(), p.id);
  expect(r).toMatchObject({
    tier: 2, startingTier: true, listeningSkipped: true,
    scores: { grammar: 75, reading: 100 },
    priorities: ["present_simple_continuous", "past_simple", "present_perfect"],
    writing: { niveau: "B1" },
  });
  expect(getTier()).toBe(2);
  expect(getTierHistory()).toHaveLength(1);
  expect(placementPriorities()).toEqual(r.priorities);
  await expect(submitPlacement(p.id, answers, now)).rejects.toMatchObject({ status: 409 });
  expect(savePlacementDraft(p.id, answers)).toBe(false);
});

test("later tests only suggest a tier; a too-short text is not sent to the model", async () => {
  callJson.mockResolvedValueOnce(generated());
  const first = await createPlacement(now);
  callJson.mockResolvedValueOnce({ niveau: "B1", commentaire: "ok" });
  await submitPlacement(first.id, { grammar: Array(20).fill("launched"), reading: [1, 1, 1, 1], writing: sixty }, now);
  callJson.mockResolvedValueOnce(generated());
  const second = await createPlacement(new Date(2027, 0, 5));
  const calls = callJson.mock.calls.length;
  const r = await submitPlacement(second.id, { grammar: [], reading: [null, null, null, null], writing: "Hello." }, new Date(2027, 0, 5));
  expect(callJson.mock.calls.length).toBe(calls);
  expect(r).toMatchObject({ tier: 1, startingTier: false, writing: { niveau: "A1" } });
  expect(getTier()).toBe(2);
});
