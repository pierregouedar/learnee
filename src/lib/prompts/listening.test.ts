import { expect, test } from "vitest";
import { listeningPeriod } from "@/lib/listening/period";
import { buildListeningContextPrompt, buildListeningCorrectionPrompt, buildListeningScriptPrompt, topicBrief } from "./listening";

test("script prompt carries level, pace rule, format, brief, cap and schema", () => {
  const p = buildListeningScriptPrompt({ period: listeningPeriod(new Date(2026, 9, 1)), format: "interview", brief: "FACTS HERE" });
  expect(p).toContain("target level B1");
  expect(p).toContain("Keep sentences short and vocabulary at B1 level; avoid idioms.");
  expect(p).toContain("a radio interview between a host and one guest");
  expect(p).toContain('"""FACTS HERE"""');
  expect(p).toContain("Use 2 speakers");
  expect(p).toContain("Never invent quotations attributed to real named people.");
  expect(p).toContain("3800 characters");
  expect(p).toContain("Reply with only JSON");
  expect(p).toContain('"segments"');
});

test("one-speaker formats ask for a single presenter", () => {
  const p = buildListeningScriptPrompt({ period: listeningPeriod(new Date(2026, 9, 1)), format: "news", brief: "x" });
  expect(p).toContain("Use 1 speaker (a presenter)");
});

test("correction prompt: plays, transcript, summary, French feedback, schema", () => {
  const p = buildListeningCorrectionPrompt({ plays: 2, transcript: "A: Hello.", summary: "Il dit bonjour." });
  expect(p).toContain("listened to the\nEnglish audio 2 time(s)");
  expect(p).toContain('"""A: Hello."""');
  expect(p).toContain('"""Il dit bonjour."""');
  expect(p).toContain("Write all feedback in simple French.");
  expect(p).toContain('"contresens"');
});

test("upload context prompt and topic brief", () => {
  const p = buildListeningContextPrompt("A: Buy now.");
  expect(p).toContain('"""A: Buy now."""');
  expect(p).toContain("IN FRENCH");
  expect(p).toContain("radio_ad");
  expect(topicBrief("EV prices")).toContain('"EV prices"');
});
