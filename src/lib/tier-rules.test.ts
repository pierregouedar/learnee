import { expect, test } from "vitest";
import { tierProposal, upStreak } from "./tier-rules";

test("three consecutive copies at 12/20 or more propose the next tier", () => {
  expect(tierProposal(1, [12, 14, 12])).toEqual({ direction: "up", to: 2 });
  expect(tierProposal(2, [5, 12, 13.5, 16])).toEqual({ direction: "up", to: 3 });
});

test("the last three must all qualify", () => {
  expect(tierProposal(1, [12, 14])).toBeNull();
  expect(tierProposal(1, [12, 11.5, 12])).toBeNull();
  expect(tierProposal(1, [12, 12, 12, 11])).toBeNull();
});

test("three consecutive copies under 8/20 propose the previous tier", () => {
  expect(tierProposal(2, [7.5, 6, 3])).toEqual({ direction: "down", to: 1 });
  expect(tierProposal(3, [7, 7, 7])).toEqual({ direction: "down", to: 2 });
  expect(tierProposal(2, [7.5, 8, 3])).toBeNull();
});

test("no tier above 3 or below 1", () => {
  expect(tierProposal(3, [18, 19, 20])).toBeNull();
  expect(tierProposal(1, [2, 3, 4])).toBeNull();
});

test("the up streak only counts qualifying copies after the last lower one", () => {
  expect(upStreak([])).toBe(0);
  expect(upStreak([12.5, 11.5, 13])).toBe(1);
  expect(upStreak([9, 12, 14])).toBe(2);
  expect(upStreak([5, 12, 12, 12])).toBe(3);
  expect(upStreak([12, 12, 11])).toBe(0);
});
