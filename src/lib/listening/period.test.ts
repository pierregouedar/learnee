import { expect, test } from "vitest";
import { listeningPeriod, slowSpeedAvailable } from "./period";

test("sept.-déc.: B1, slow pace rule from the spec, short formats", () => {
  const p = listeningPeriod(new Date(2026, 9, 15));
  expect(p.level).toBe("B1");
  expect(p.paceRule).toBe("Keep sentences short and vocabulary at B1 level; avoid idioms.");
  expect(p.formats).toEqual(["news", "interview"]);
  expect(p.minutes).toBe("1.5 to 2");
});

test("janv.-mars: B1+, natural pace", () => {
  const p = listeningPeriod(new Date(2027, 1, 10));
  expect(p.level).toBe("B1+");
  expect(p.formats).toEqual(["interview", "podcast"]);
});

test("avr.-examen: B2 with the spec's end-of-year pace rule", () => {
  const p = listeningPeriod(new Date(2027, 4, 2));
  expect(p.level).toBe("B2");
  expect(p.paceRule).toBe("Use natural pace and B2 vocabulary, including some idioms and business expressions.");
  expect(p.chars).toBeLessThanOrEqual(4000);
});

test("0.85x offered until December, hidden after, overridable", () => {
  expect(slowSpeedAvailable(new Date(2026, 11, 31))).toBe(true);
  expect(slowSpeedAvailable(new Date(2027, 0, 1))).toBe(false);
  expect(slowSpeedAvailable(new Date(2027, 0, 1), "on")).toBe(true);
  expect(slowSpeedAvailable(new Date(2026, 10, 1), "off")).toBe(false);
});
