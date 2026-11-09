import { expect, test } from "vitest";
import { partialField, placementProgress, programmeProgress, subjectProgress } from "./generation-progress";

test("partialField reads an unfinished string value, escapes included", () => {
  expect(partialField('{"title": "A", "article": "Brands are \\"bold\\" and', "article")).toBe('Brands are \\"bold\\" and');
  expect(partialField('{"title": "A"', "article")).toBeUndefined();
});

test("placement: grammar count, then reading text, reading questions, writing, listening", () => {
  expect(placementProgress('{"grammar": [{"prompt": "a"}, {"prompt": "b"', 20).label).toBe("Questions de grammaire : 2 sur 20");
  expect(placementProgress('{"grammar": [], "reading": {"title": "T", "text": "one two three', 20)).toMatchObject({ label: "Texte de lecture : 3 mots" });
  expect(placementProgress('{"reading": {"text": "x", "questions": [{"question": "q1"}, {"question": "q2"', 20).label).toBe("Questions de lecture : 2 sur 4");
  expect(placementProgress('{"reading": {}, "writing": {"task": "', 20).label).toBe("Sujet d’expression écrite");
  const pcts = ['{"grammar": [', '{"reading": {"text": "a', '{"writing": {', '{"listening": {'].map((j) => placementProgress(j, 20).pct);
  expect([...pcts].sort((a, b) => a - b)).toEqual(pcts); // l'avancement ne recule pas
});

test("subject: title, article word count against the target, task, then keywords", () => {
  expect(subjectProgress('{"title": "Br', 400).label).toBe("Titre de l’article");
  expect(subjectProgress('{"title": "B", "article": "one two three four', 400)).toMatchObject({ label: "Article : 4 mots sur environ 400" });
  expect(subjectProgress('{"article": "x", "task": "Écris', 400).label).toBe("Consigne d’écriture");
  expect(subjectProgress('{"task": "x", "keywords": [', 400).pct).toBe(90);
});

test("programme: points counted as they arrive, then verbs, never going back", () => {
  expect(programmeProgress('{"points": [').label).toBe("Programme de grammaire : 0 point");
  expect(programmeProgress('{"points": [{"key": "a", "label": "x"}, {"key": "b').label).toBe("Programme de grammaire : 2 points");
  expect(programmeProgress('{"points": [{"key": "a"}], "verbs": [{"base": "ser"}, {"base": "ir"').label).toBe("Verbes à retenir : 2");
  const pcts = ['{"points": [', '{"points": [{"key": "a"}' + ', {"key": "b"}'.repeat(19), '{"points": [], "verbs": [', '{"verbs": [' + '{"base": "x"},'.repeat(60)].map(
    (j) => programmeProgress(j).pct,
  );
  expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
  expect(pcts.at(-1)).toBeLessThanOrEqual(95);
});
