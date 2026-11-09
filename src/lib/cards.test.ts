import { beforeEach, expect, test } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createSession, saveCorrection, setCorrecting } from "@/lib/repo/sessions";
import { insertSubject } from "@/lib/repo/subjects";
import type { Correction } from "@/lib/schemas";
import { cardsToCsv, getCard, importAllCorrectionVocab, importCorrectionVocab, keepWord, listCards, setSuspended } from "./cards";

const ctx = (sentence: string, sourceId = "s1") => ({ sentence, sourceType: "reading" as const, sourceId, sourceTitle: "AI ads" });
const word = (term: string, sentence: string, sourceId?: string) => ({
  term, definition: "how well people know a brand", example: "Ads build awareness.", fr: "notoriété", context: ctx(sentence, sourceId),
});

beforeEach(() => resetDbForTests());

test("keepWord creates a new FSRS card with its context", () => {
  const before = Date.now();
  const c = keepWord(word("Brand awareness", "The campaign boosted brand awareness."));
  expect(c).toMatchObject({ term: "Brand awareness", termKey: "brand awareness", origin: "kept", suspended: false, sourceKind: "word" });
  expect(c.fsrs).toMatchObject({ reps: 0, lapses: 0, state: 0 });
  expect(c.fsrs.due).toBeInstanceOf(Date);
  expect(c.fsrs.due.getTime()).toBeGreaterThanOrEqual(before - 1000);
  expect(c.contexts).toEqual([ctx("The campaign boosted brand awareness.")]);
});

test("same normalized word: no duplicate, new sentence appended once", () => {
  const a = keepWord(word("brand awareness", "First sentence."));
  const b = keepWord(word("Brand-awareness!", "Second sentence.", "s2"));
  keepWord(word("brand awareness", "Second sentence.", "s2"));
  expect(b.id).toBe(a.id);
  expect(listCards()).toHaveLength(1);
  expect(getCard(a.id)?.contexts.map((x) => x.sentence)).toEqual(["First sentence.", "Second sentence."]);
});

test("correction vocab becomes cards once, keeping a word upgrades it", () => {
  const subjectId = insertSubject({
    domain: "libre", source: "topic", tier: 1, title: "EV sales", article: "A", task: "C", guideQuestions: [], keywords: [],
  }).id;
  const s = createSession(subjectId, 1);
  setCorrecting(s.id);
  const correction: Correction = {
    compte_rendu: { note: 5, commentaire: "c", idees_manquantes: [] },
    expression: { note: 5, niveau: "B1", erreurs: [], points_forts: [], version_amelioree: "v" },
    vocabulaire: [{ en: "carmaker", fr: "constructeur automobile", exemple: "The carmaker cut prices." }, { en: "to launch", fr: "lancer" }],
    conseil: "k",
  };
  saveCorrection(s.id, correction);
  importCorrectionVocab(s.id);
  importAllCorrectionVocab();
  const cards = listCards();
  expect(cards).toHaveLength(2);
  const carmaker = cards.find((c) => c.term === "carmaker")!;
  expect(carmaker).toMatchObject({ origin: "correction", definition: "", example: "The carmaker cut prices." });
  expect(carmaker.contexts).toEqual([{ sentence: "The carmaker cut prices.", sourceType: "reading", sourceId: s.id, sourceTitle: "EV sales" }]);
  expect(cards.find((c) => c.term === "to launch")!.contexts).toEqual([]);

  setSuspended(carmaker.id, true);
  importAllCorrectionVocab();
  expect(getCard(carmaker.id)?.suspended).toBe(true);

  const kept = keepWord({ term: "Carmaker", definition: "a company that makes cars", fr: "constructeur", context: ctx("Carmakers compete.") });
  expect(kept).toMatchObject({ id: carmaker.id, origin: "kept", suspended: false, definition: "a company that makes cars", fr: "constructeur automobile" });
});

test("setSuspended returns false for an unknown card", () => {
  const c = keepWord(word("reach", "Our reach grew."));
  expect(setSuspended(c.id, true)).toBe(true);
  expect(getCard(c.id)?.suspended).toBe(true);
  expect(setSuspended("nope", true)).toBe(false);
});

test("CSV for Anki: header lines, quoting, first context", () => {
  const c = keepWord({ term: 'say "hi"', definition: "greet, briefly", fr: "saluer", context: ctx("She said hi.") });
  const csv = cardsToCsv([c]);
  expect(csv).toBe(
    "#separator:Comma\n#html:false\n#columns:Mot,Définition,Exemple,Traduction,Phrase,Source\n" +
      '"say ""hi""","greet, briefly","","saluer","She said hi.","AI ads"\n',
  );
});
