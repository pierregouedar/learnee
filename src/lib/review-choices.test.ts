import { expect, test } from "vitest";
import { buildChoices } from "./review-choices";

const pool = ["marque", "campagne", "client", "lancer", "Marque !", "public"];

test("4 options, the answer included once, no duplicates, stable per card", () => {
  const a = buildChoices("card-1", "marque", pool)!;
  expect(a).toHaveLength(4);
  expect(a.filter((c) => c === "marque")).toHaveLength(1);
  expect(a).not.toContain("Marque !"); // même mot une fois normalisé
  expect(new Set(a).size).toBe(4);
  expect(buildChoices("card-1", "marque", pool)).toEqual(a);
});

test("not enough other translations → null (flip mode)", () => {
  expect(buildChoices("c", "marque", ["marque", "client"])).toBeNull();
  expect(buildChoices("c", "", pool)).toBeNull();
});
