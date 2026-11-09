// Logique pure du lecteur de CO, partagée par le client et le serveur (spec §15.4).
export const MAX_PLAYS = 3;
export const BACK_SECONDS = 5;

export type PlayState = { plays: number; inPlay: boolean };

/** Une écoute = lecture lancée depuis l'arrêt (début, ou après la fin). Pause/reprise et −5 s ne comptent pas. */
export function startPlayback(s: PlayState): { state: PlayState; allowed: boolean; counted: boolean } {
  if (s.inPlay) return { state: s, allowed: true, counted: false };
  if (s.plays >= MAX_PLAYS) return { state: s, allowed: false, counted: false };
  return { state: { plays: s.plays + 1, inPlay: true }, allowed: true, counted: true };
}

export const endPlayback = (s: PlayState): PlayState => ({ ...s, inPlay: false });

export const canPlay = (s: PlayState) => s.inPlay || s.plays < MAX_PLAYS;

const TYPING = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"];

export function playerKeyAction(key: string, target: { tagName: string; isContentEditable?: boolean }): "toggle" | "back" | null {
  if (target.isContentEditable || TYPING.includes(target.tagName)) return null;
  if (key === " ") return "toggle";
  if (key === "ArrowLeft") return "back";
  return null;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
