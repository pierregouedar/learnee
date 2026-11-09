import { expect, test } from "vitest";
import {
  alignSegments, capScript, chunkLines, computeTimestamps, segmentsFromWords, splitSentences, transcriptText,
  type TimedWord,
} from "./segments";

const lines = [
  { speaker: "A", text: "Hello and welcome." },
  { speaker: "B", text: "Thanks for having me." },
  { speaker: "A", text: "Let's start." },
];

test("capScript keeps whole lines while the total stays under the cap", () => {
  const long = [{ speaker: "A", text: "x".repeat(3000) }, { speaker: "B", text: "y".repeat(1500) }, { speaker: "A", text: "z" }];
  expect(capScript(long, 4000)).toEqual([long[0]]);
  expect(capScript(lines)).toEqual(lines);
});

test("timestamps: cumulative durations with a gap after each line", () => {
  expect(computeTimestamps(lines, [1000, 2000, 1500], 400)).toEqual([
    { speaker: "A", text: "Hello and welcome.", startMs: 0, endMs: 1000 },
    { speaker: "B", text: "Thanks for having me.", startMs: 1400, endMs: 3400 },
    { speaker: "A", text: "Let's start.", startMs: 3800, endMs: 5300 },
  ]);
});

test("splitSentences splits on end punctuation and shares time by length", () => {
  const out = splitSentences([{ speaker: "A", text: "Hi there. How are you? Good!", startMs: 1000, endMs: 3800 }]);
  expect(out.map((s) => s.text)).toEqual(["Hi there.", "How are you?", "Good!"]);
  expect(out[0].startMs).toBe(1000);
  expect(out[2].endMs).toBe(3800);
  expect(out[1].startMs).toBe(out[0].endMs);
  // 9 + 12 + 5 = 26 chars over 2800 ms
  expect(out[0].endMs).toBe(1000 + Math.round((2800 * 9) / 26));
});

test("splitSentences leaves decimals and single sentences alone", () => {
  const s = { speaker: "A", text: "Sales grew 3.5 percent in May.", startMs: 0, endMs: 900 };
  expect(splitSentences([s])).toEqual([s]);
});

const w = (text: string, start: number, speaker_id = "speaker_0"): TimedWord => ({ text, start, end: start + 0.4, type: "word", speaker_id });

test("Scribe words become sentences, cut on punctuation and speaker change", () => {
  const words: TimedWord[] = [
    w("Welcome", 0), { text: " ", start: 0.4, end: 0.5, type: "spacing" }, w("back.", 0.5), w("Today", 1),
    w("we", 1.5), w("talk", 2), w("Great", 3, "speaker_1"), w("idea.", 3.5, "speaker_1"),
  ];
  expect(segmentsFromWords(words)).toEqual([
    { speaker: "A", text: "Welcome back.", startMs: 0, endMs: 900 },
    { speaker: "A", text: "Today we talk", startMs: 1000, endMs: 2400 },
    { speaker: "B", text: "Great idea.", startMs: 3000, endMs: 3900 },
  ]);
});

test("alignSegments maps transcript words onto script lines by word count", () => {
  const words = "Hello and welcome. Thanks for having me. Let's start."
    .split(" ")
    .map((t, i) => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4, type: "word" }));
  const out = alignSegments(lines, words);
  expect(out.map((s) => [s.startMs, s.endMs])).toEqual([[0, 1400], [1500, 3400], [3500, 4400]]);
  expect(out[1].text).toBe("Thanks for having me.");
});

test("chunkLines groups consecutive lines under the size limit", () => {
  expect(chunkLines(lines, 40).map((c) => c.length)).toEqual([2, 1]);
  expect(chunkLines(lines, 1000)).toEqual([lines]);
});

test("transcriptText labels speakers", () => {
  expect(transcriptText(lines.slice(0, 2))).toBe("A: Hello and welcome.\nB: Thanks for having me.");
});
