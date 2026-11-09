import { expect, test } from "vitest";
import { canPlay, endPlayback, formatClock, MAX_PLAYS, playerKeyAction, startPlayback, type PlayState } from "./player";

test("a play is counted only when starting from a stopped state", () => {
  let s: PlayState = { plays: 0, inPlay: false };
  let r = startPlayback(s);
  expect(r).toMatchObject({ allowed: true, counted: true });
  s = r.state;
  // pause then resume inside the same play: not counted
  r = startPlayback(s);
  expect(r).toMatchObject({ allowed: true, counted: false, state: { plays: 1 } });
  s = endPlayback(r.state);
  expect(s).toEqual({ plays: 1, inPlay: false });
});

test("the 4th play is refused", () => {
  let s: PlayState = { plays: 0, inPlay: false };
  for (let i = 0; i < MAX_PLAYS; i++) s = endPlayback(startPlayback(s).state);
  expect(s.plays).toBe(3);
  expect(canPlay(s)).toBe(false);
  expect(startPlayback(s)).toEqual({ state: s, allowed: false, counted: false });
});

test("resuming the 3rd play is still allowed", () => {
  const s = { plays: 3, inPlay: true };
  expect(canPlay(s)).toBe(true);
  expect(startPlayback(s).allowed).toBe(true);
});

test("keyboard: space toggles, left arrow goes back, never while typing", () => {
  expect(playerKeyAction(" ", { tagName: "BODY" })).toBe("toggle");
  expect(playerKeyAction("ArrowLeft", { tagName: "DIV" })).toBe("back");
  expect(playerKeyAction(" ", { tagName: "TEXTAREA" })).toBeNull();
  expect(playerKeyAction(" ", { tagName: "INPUT" })).toBeNull();
  expect(playerKeyAction(" ", { tagName: "BUTTON" })).toBeNull(); // le bouton gère déjà l'espace
  expect(playerKeyAction(" ", { tagName: "DIV", isContentEditable: true })).toBeNull();
  expect(playerKeyAction("a", { tagName: "BODY" })).toBeNull();
});

test("clock format", () => {
  expect(formatClock(0)).toBe("0:00");
  expect(formatClock(125.7)).toBe("2:05");
});
