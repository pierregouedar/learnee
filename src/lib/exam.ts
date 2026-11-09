export const EXAM_DURATION_MS = 2 * 60 * 60 * 1000; // F11 : chrono de 2 h

export function remainingMs(startedAt: string, now: number): number {
  return Math.max(0, Date.parse(startedAt) + EXAM_DURATION_MS - now);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}
