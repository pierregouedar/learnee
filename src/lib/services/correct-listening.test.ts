import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getAttempt, getListening, insertListening, registerPlay, saveAttemptDraft, startAttempt } from "@/lib/repo/listenings";

const m = vi.hoisted(() => ({ callJson: vi.fn() }));
vi.mock("@/lib/llm/client", async (orig) => ({ ...(await orig<typeof import("@/lib/llm/client")>()), callJson: m.callJson }));

const { ListeningCorrectionRefused, runListeningCorrection, startListeningCorrection } = await import("./correct-listening");
const { LlmError } = await import("@/lib/llm/client");

const words = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
let listeningId: string;
let attemptId: string;

beforeEach(() => {
  resetDbForTests();
  m.callJson.mockReset();
  listeningId = insertListening({
    id: crypto.randomUUID(), domain: "comm", source: "generated", format: "interview", level: "B1", title: "T",
    context: "C", script: [{ speaker: "A", text: "Hello there.", startMs: 0, endMs: 900 }], audioPath: "a.mp3",
    durationSec: 90, voices: [],
  }).id;
  attemptId = startAttempt(listeningId).id;
});

test("refuses under 20 words without calling the model", () => {
  saveAttemptDraft(attemptId, { notes: "", summary: words(19) });
  expect(() => startListeningCorrection(attemptId)).toThrow(ListeningCorrectionRefused);
  expect(getAttempt(attemptId)?.status).toBe("draft");
  expect(m.callJson).not.toHaveBeenCalled();
});

test("404 for unknown attempt, 409 when started twice", () => {
  expect(() => startListeningCorrection("nope")).toThrow(expect.objectContaining({ status: 404 }));
  saveAttemptDraft(attemptId, { notes: "", summary: words(30) });
  startListeningCorrection(attemptId);
  expect(() => startListeningCorrection(attemptId)).toThrow(expect.objectContaining({ status: 409 }));
});

test("success: prompt has plays and transcript, note rounded, audio marked used", async () => {
  registerPlay(attemptId);
  registerPlay(attemptId);
  saveAttemptDraft(attemptId, { notes: "", summary: words(30) });
  startListeningCorrection(attemptId);
  m.callJson.mockResolvedValueOnce({ note: 6.3, comprises: ["a"], manquees: [], contresens: [], conseil: "k" });
  await runListeningCorrection(attemptId);
  const [task, prompt] = m.callJson.mock.calls[0];
  expect(task).toBe("listening_correct");
  expect(prompt).toContain("2 time(s)");
  expect(prompt).toContain("A: Hello there.");
  expect(getAttempt(attemptId)).toMatchObject({ status: "corrected", result: { note: 6.5 } });
  expect(getListening(listeningId)?.status).toBe("used");
});

test("LLM failure: back to draft with the French message, summary kept", async () => {
  saveAttemptDraft(attemptId, { notes: "n", summary: words(30) });
  startListeningCorrection(attemptId);
  m.callJson.mockRejectedValueOnce(new LlmError("provider", "Le service ne répond pas."));
  await runListeningCorrection(attemptId);
  expect(getAttempt(attemptId)).toMatchObject({ status: "draft", error: "Le service ne répond pas.", summary: words(30) });
});
