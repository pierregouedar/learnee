import { beforeEach, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getSubject } from "@/lib/repo/subjects";

const callJson = vi.fn();
vi.mock("@/lib/llm/client", () => ({ callJson: (...args: unknown[]) => callJson(...args) }));

const { generateSubject } = await import("./generate-subject");

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

beforeEach(() => {
  resetDbForTests();
  callJson.mockReset();
});

test("topic mode: retries once when article length is off, stores tier-1 aids", async () => {
  callJson
    .mockResolvedValueOnce({ title: "T", article: words(90), task: "Consigne" })
    .mockResolvedValueOnce({
      title: "T2", article: words(220), task: "Consigne 2",
      guide_questions: ["Qui ?"], keywords: [{ word: "brand", definition: "d" }], structure: "Plan",
    });
  const s = await generateSubject({ mode: "topic", topic: "IA et pub" });
  expect(callJson).toHaveBeenCalledTimes(2);
  expect(getSubject(s.id)).toMatchObject({
    title: "T2", source: "topic", sourceRef: "IA et pub", domain: "libre", tier: 1,
    guideQuestions: ["Qui ?"], structure: "Plan",
  });
});

test("topic mode: keeps second answer even if still off", async () => {
  callJson.mockResolvedValue({ title: "T", article: words(90), task: "C" });
  const s = await generateSubject({ mode: "topic", topic: "x" });
  expect(callJson).toHaveBeenCalledTimes(2);
  expect(s.title).toBe("T");
});

test("paste mode: keeps the pasted article, single call", async () => {
  callJson.mockResolvedValueOnce({ title: "Pasted", task: "C" });
  const s = await generateSubject({ mode: "paste", article: "Real article text" });
  expect(callJson).toHaveBeenCalledTimes(1);
  expect(s).toMatchObject({ article: "Real article text", source: "paste", guideQuestions: [], keywords: [] });
});

test("rss mode: news brief in the prompt, source rss with URL and domain", async () => {
  callJson.mockResolvedValueOnce({
    title: "EV price war", article: words(220), task: "C", guide_questions: ["Q ?"], keywords: [], structure: "P",
  });
  const s = await generateSubject({ mode: "rss", domain: "auto", brief: "Headline: Ford cuts EV prices", url: "https://news/x" });
  expect(callJson.mock.calls[0][1]).toContain('"""Headline: Ford cuts EV prices"""');
  expect(getSubject(s.id)).toMatchObject({ source: "rss", sourceRef: "https://news/x", domain: "auto", title: "EV price war" });
});
