import { beforeEach, expect, test } from "vitest";
import { buildDefinePrompt } from "@/lib/define";
import { resetDbForTests } from "@/lib/db";
import { listeningPeriod } from "@/lib/listening/period";
import { DEFAULT_PROFILE, domainLabel, saveProfile, type Profile } from "@/lib/profile";
import { taskTypesFor } from "@/lib/services/generate-subject";
import { buildCorrectionPrompt } from "./correct";
import { buildGeneratePrompt, buildPastePrompt, topicBlock } from "./generate";
import { buildGrammarSetPrompt, buildTranslateCheckPrompt } from "./grammar";
import { buildListeningContextPrompt, buildListeningCorrectionPrompt, buildListeningScriptPrompt } from "./listening";
import { buildPlacementPrompt, buildPlacementWritingPrompt } from "./placement";
import { buildRewritePrompt } from "./rewrite";
import { buildWeeklyAdvicePrompt } from "./weekly-report";

const SPANISH: Profile = {
  target: { code: "es", name: "Spanish" },
  goal: { preset: "custom", description: "Voyager en Amérique latine" },
  level: "B1",
  interests: [{ key: "cine", label: "Cinéma", query: "cine latinoamericano" }],
};

const allPrompts = () => [
  buildCorrectionPrompt({ tier: 2, article: "A", task: "T", cr: "C", pe: "P", guideQuestions: [] }),
  buildGeneratePrompt({ tier: 1, taskType: "un courriel", sourceBlock: topicBlock("x") }),
  buildPastePrompt({ tier: 1, taskType: "un courriel", article: "A" }),
  buildGrammarSetPrompt({ point: "ser_estar", level: "B1" }),
  buildTranslateCheckPrompt({ point: "ser_estar", french: "Je suis là.", references: ["Estoy aquí."], answer: "Estoy aquí." }),
  buildListeningScriptPrompt({ period: listeningPeriod(new Date(2026, 9, 1)), format: "podcast", brief: "b" }),
  buildListeningCorrectionPrompt({ plays: 1, transcript: "t", summary: "s" }),
  buildListeningContextPrompt("t"),
  buildPlacementPrompt({ transcript: "t" }),
  buildPlacementWritingPrompt({ task: "t", text: "x" }),
  buildRewritePrompt({ task: "t", first: "f", errors: [], rewrite: "r" }),
  buildWeeklyAdvicePrompt("r"),
  buildDefinePrompt("casa", "Mi casa."),
];

beforeEach(() => resetDbForTests());

test("default profile: prompts keep English and the BTS Communication goal", () => {
  const prompts = allPrompts();
  for (const p of prompts) expect(p).toContain("English");
  expect(prompts[0]).toContain("an experienced BTS examiner in France");
  expect(prompts[0]).toContain("épreuve E21");
  expect(prompts[1]).toContain("the student works in communication");
  expect(prompts[11]).toContain("E22 simulation");
  expect(prompts[3]).toContain("don't / do not");
  expect(prompts[3]).toContain('e.g. "She ___ (work) here since 2022."');
});

test("a Spanish profile with a personal goal: Spanish wording, no English, no BTS", () => {
  saveProfile(SPANISH);
  for (const p of allPrompts()) {
    expect(p).toContain("Spanish");
    expect(p).not.toMatch(/English|BTS|E21|E22/);
    expect(p).not.toMatch(/don't|She ___ \(work\)|The agency launched/); // exemples anglais réservés à l'anglais
  }
  expect(buildGeneratePrompt({ tier: 2, taskType: "un courriel", sourceBlock: "" })).toContain("Goal: Voyager en Amérique latine");
  expect(buildListeningContextPrompt("t")).toContain("cine (cine latinoamericano), libre (anything else)");
});

test("writing task types follow the goal; tier 1 keeps the short BTS tasks", () => {
  expect(taskTypesFor(1, DEFAULT_PROFILE)).toContain("un courriel professionnel court");
  expect(taskTypesFor(3, DEFAULT_PROFILE)).toContain("un post LinkedIn pour une marque");
  expect(taskTypesFor(1, { ...SPANISH, goal: { preset: "bac" } })).toContain("un article de journal lycéen");
});

test("domain labels come from the profile interests", () => {
  expect(domainLabel("comm")).toBe("Comm");
  expect(domainLabel("libre")).toBe("Libre");
  saveProfile(SPANISH);
  expect(domainLabel("cine")).toBe("Cinéma");
  expect(domainLabel("inconnu")).toBe("inconnu");
});
