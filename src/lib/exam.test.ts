import { expect, test } from "vitest";
import { EXAM_DURATION_MS, formatClock, remainingMs } from "./exam";

test("remaining time counts down from 2 h and stops at 0", () => {
  const start = "2026-09-22T08:00:00.000Z";
  const t0 = Date.parse(start);
  expect(remainingMs(start, t0)).toBe(EXAM_DURATION_MS);
  expect(remainingMs(start, t0 + 60_000)).toBe(EXAM_DURATION_MS - 60_000);
  expect(remainingMs(start, t0 + 3 * 3_600_000)).toBe(0);
});

test("clock format h:mm:ss, rounded up to the second", () => {
  expect(formatClock(7_200_000)).toBe("2:00:00");
  expect(formatClock(7_199_001)).toBe("2:00:00");
  expect(formatClock(3_599_000)).toBe("0:59:59");
  expect(formatClock(0)).toBe("0:00:00");
});
