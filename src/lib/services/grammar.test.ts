import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { validateItems } from "@/lib/grammar/validate";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/llm/client")>()),
  callJson: (...args: unknown[]) => callJson(...args),
}));

const svc = await import("./grammar");
const repo = await import("@/lib/repo/grammar");

const gap = (i: number) => ({
  format: "gap",
  prompt: `We ___ (launch) campaign number ${i} last week.`,
  accepted: ["launched"],
  explanation: "Prétérit : action terminée à un moment passé précis.",
});
const translate = {
  format: "translate",
  prompt: "Nous avons lancé la campagne hier.",
  accepted: ["We launched the campaign yesterday."],
  explanation: "Avec « hier », on emploie le prétérit.",
};
const lesson = {
  summary: "Prétérit pour un moment passé daté, present perfect pour un lien avec maintenant.",
  forms: [
    { name: "Prétérit", use: "Action finie à un moment précis.", form: "verbe + -ed", signals: ["yesterday"], examples: [{ en: "We launched it.", fr: "Nous l'avons lancé." }] },
    { name: "Present perfect", use: "Lien avec maintenant.", form: "have/has + participe passé", signals: ["already"], examples: [{ en: "We have launched it.", fr: "Nous l'avons lancé." }] },
  ],
  pitfalls: [{ wrong: "We have launched it yesterday.", right: "We launched it yesterday.", why: "Date précise : prétérit." }],
};
const setJson = { point: "past_simple", lesson, items: [...Array.from({ length: 9 }, (_, i) => gap(i)), translate] };
const now = new Date("2026-10-05T09:00:00.000Z");

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
});

async function started() {
  callJson.mockResolvedValueOnce(setJson);
  const attempt = await svc.startGrammarAttempt("past_simple", now);
  return { attempt, items: repo.listItems(attempt.setId) };
}

test("starts on a freshly generated set when none is ready", async () => {
  const { attempt, items } = await started();
  expect(callJson).toHaveBeenCalledWith("grammar_set", expect.stringContaining("past_simple"), expect.anything(), "past_simple");
  expect(items).toHaveLength(10);
  expect(attempt.point).toBe("past_simple");
  expect(repo.getLesson(attempt.setId)).toEqual(lesson);
});

test("resumes the open attempt instead of creating another", async () => {
  const { attempt } = await started();
  const again = await svc.startGrammarAttempt("articles", now);
  expect(again.id).toBe(attempt.id);
  expect(callJson).toHaveBeenCalledTimes(1);
});

test("uses a pre-generated set without calling the model", async () => {
  const setId = repo.insertSet("articles", "A2", validateItems(setJson.items), now);
  const attempt = await svc.startGrammarAttempt("articles", now);
  expect(attempt.setId).toBe(setId);
  expect(callJson).not.toHaveBeenCalled();
});

test("deterministic check: accepted answers pass, others show the expected answer and explanation", async () => {
  const { attempt, items } = await started();
  const ok = await svc.answerItem(attempt.id, items[0].id, "  Launched. ", now);
  expect(ok).toMatchObject({ correct: true, done: false });
  const ko = await svc.answerItem(attempt.id, items[1].id, "have launched", now);
  expect(ko).toMatchObject({ correct: false, expected: "launched", explanation: gap(1).explanation, done: false });
  expect(callJson).toHaveBeenCalledTimes(1); // génération seulement
});

test("translations are checked by the model", async () => {
  const { attempt, items } = await started();
  callJson.mockResolvedValueOnce({ correct: false, feedback: "Avec « hier », pas de present perfect.", correction: "We launched the campaign yesterday." });
  const r = await svc.answerItem(attempt.id, items[9].id, "We have launched the campaign yesterday.", now);
  expect(callJson).toHaveBeenLastCalledWith("grammar_check", expect.stringContaining("Nous avons lancé"), expect.anything(), attempt.id);
  expect(r).toMatchObject({ correct: false, expected: "We launched the campaign yesterday.", feedback: "Avec « hier », pas de present perfect." });
});

test("the last answer finishes the set, stores the score and updates mastery", async () => {
  const { attempt, items } = await started();
  for (const item of items.slice(0, 8)) await svc.answerItem(attempt.id, item.id, "launched", now);
  await svc.answerItem(attempt.id, items[8].id, "launch", now);
  callJson.mockResolvedValueOnce({ correct: true, feedback: "Parfait.", correction: "We launched the campaign yesterday." });
  const last = await svc.answerItem(attempt.id, items[9].id, "We launched the campaign yesterday", now);
  expect(last).toMatchObject({ done: true, score: 90 });
  expect(repo.getAttempt(attempt.id)?.finishedAt).toBe(now.toISOString());
  expect(repo.getMastery("past_simple").scores).toEqual([{ score: 90, at: now.toISOString() }]);
  expect(repo.lastPracticed().past_simple).toBe(now.toISOString());
});

test("a flagged item leaves the attempt, does not count, and is never served again", async () => {
  const { attempt, items } = await started();
  await svc.answerItem(attempt.id, items[0].id, "wrong", now);
  expect(svc.flagGrammarItem(items[0].id, attempt.id, now)).toEqual({ done: false });
  expect(repo.getAttempt(attempt.id)?.answers).toEqual([]);
  expect(repo.listItems(attempt.setId).map((i) => i.id)).not.toContain(items[0].id);
  await expect(svc.answerItem(attempt.id, items[0].id, "launched", now)).rejects.toMatchObject({ status: 404 });
  for (const item of items.slice(1, 9)) await svc.answerItem(attempt.id, item.id, "launched", now);
  expect(svc.flagGrammarItem(items[9].id, attempt.id, now)).toEqual({ done: true, score: 100 });
});

test("answering twice, or after the end, is refused", async () => {
  const { attempt, items } = await started();
  await svc.answerItem(attempt.id, items[0].id, "launched", now);
  await expect(svc.answerItem(attempt.id, items[0].id, "launched", now)).rejects.toMatchObject({ status: 409 });
  await expect(svc.answerItem("nope", items[0].id, "x", now)).rejects.toMatchObject({ status: 404 });
});



test("nextSelection uses the recent copies, mastery and the programme", () => {
  expect(svc.nextSelection(new Date(2026, 8, 20))).toEqual({ point: "present_simple_continuous", reason: "programme" });
});

test("nextSelection feeds selectPoint only the last 5 corrections", () => {
  const spy = vi.spyOn(repo, "recentCorrections");
  svc.nextSelection(new Date(2026, 8, 20));
  expect(spy).toHaveBeenCalledWith(5);
  spy.mockRestore();
});

test("an answer saved while a translation is being checked is not lost", async () => {
  const { attempt, items } = await started();
  let release!: (v: unknown) => void;
  callJson.mockImplementationOnce(() => new Promise((r) => (release = r)));
  const slow = svc.answerItem(attempt.id, items[9].id, "We launched it yesterday.", now);
  await svc.answerItem(attempt.id, items[0].id, "launched", now); // pendant l'appel LLM
  release({ correct: true, feedback: "Bien.", correction: "" });
  await slow;
  expect(repo.getAttempt(attempt.id)!.answers.map((a) => a.itemId).sort()).toEqual([items[0].id, items[9].id].sort());
});

test("flagging a wrong last answer lifts the finished score", async () => {
  const { attempt, items } = await started();
  callJson.mockResolvedValue({ correct: true, feedback: "", correction: "" });
  for (const item of items.slice(0, 8)) await svc.answerItem(attempt.id, item.id, "launched", now);
  await svc.answerItem(attempt.id, items[9].id, "ok", now);
  await svc.answerItem(attempt.id, items[8].id, "launch", now); // faux, dernière réponse : série terminée à 90 %
  expect(repo.getAttempt(attempt.id)!.score).toBe(90);
  expect(svc.flagGrammarItem(items[8].id, attempt.id, now)).toEqual({ done: true, score: 100 });
  expect(repo.getAttempt(attempt.id)!.score).toBe(100);
  expect(repo.getMastery("past_simple").scores.map((s) => s.score)).toEqual([100]);
});
