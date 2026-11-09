import { expect, test } from "vitest";
import { buildCorrectionPrompt } from "./correct";
import { buildGeneratePrompt, buildPastePrompt, newsBlock, topicBlock } from "./generate";

test("generation prompt carries tier lengths and tier-1 extras", () => {
  const p = buildGeneratePrompt({ tier: 1, taskType: "un courriel professionnel court", sourceBlock: topicBlock("IA et pub") });
  expect(p).toContain("200 to 250 words");
  expect(p).toContain("60 to 80 words in English");
  expect(p).toContain('"guide_questions"');
  expect(p).toContain("IA et pub");
  expect(p).toContain("Never invent quotations");
});

test("tier 3 prompt has no guided extras", () => {
  const p = buildGeneratePrompt({ tier: 3, taskType: "un court communiqué de presse", sourceBlock: topicBlock("x") });
  expect(p).toContain("450 to 600 words");
  expect(p).not.toContain('"guide_questions"');
});

test("paste prompt embeds the article and never asks for one", () => {
  const p = buildPastePrompt({ tier: 2, taskType: "un post LinkedIn pour une marque", article: "REAL ARTICLE" });
  expect(p).toContain('"""REAL ARTICLE"""');
  expect(p).not.toContain('"article":');
});

test("correction prompt: tier, guide questions, categories, schema, exact extracts", () => {
  const p = buildCorrectionPrompt({
    tier: 1, article: "ART", task: "TASK", cr: "CR", pe: "PE", guideQuestions: ["Qui lance la campagne ?"],
  });
  expect(p).toContain("tier 1/3");
  expect(p).toContain("Qui lance la campagne ?");
  expect(p).toContain("present_perfect");
  expect(p).toContain("character for character");
  expect(p).toContain('"version_amelioree"');
});

test("news block limits the model to the brief's facts", () => {
  const p = buildGeneratePrompt({ tier: 2, taskType: "un courriel professionnel", sourceBlock: newsBlock("Headline: Ford cuts prices") });
  expect(p).toContain('Base the article ONLY on these facts from recent news');
  expect(p).toContain('"""Headline: Ford cuts prices"""');
});
