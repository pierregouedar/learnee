import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { abandonSession, createSession, getSession } from "@/lib/repo/sessions";
import { insertSubject, markSubjectUsed, type NewSubject } from "@/lib/repo/subjects";

const generateSubject = vi.fn();
vi.mock("@/lib/services/generate-subject", () => ({ generateSubject: (...a: unknown[]) => generateSubject(...a) }));

const { MockExamRefused, lastMockAt, mockExamDue, startMockExam } = await import("./mock-exam");

const subject = (tier: 1 | 2 | 3): NewSubject => ({
  domain: "libre", source: "topic", tier, title: `T${tier}`, article: "A", task: "C", guideQuestions: [], keywords: [],
});
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10);

describe("mockExamDue", () => {
  test("never before January", () => {
    expect(mockExamDue(at(2026, 9, 25))).toBe(false);
    expect(mockExamDue(at(2026, 12, 31))).toBe(false);
  });

  test("January to March: one per calendar month", () => {
    expect(mockExamDue(at(2027, 1, 9))).toBe(true);
    expect(mockExamDue(at(2027, 1, 23), at(2027, 1, 9).toISOString())).toBe(false);
    expect(mockExamDue(at(2027, 2, 1), at(2027, 1, 31).toISOString())).toBe(true);
    expect(mockExamDue(at(2027, 3, 31), at(2027, 3, 1).toISOString())).toBe(false);
  });

  test("April to June: every two weeks", () => {
    expect(mockExamDue(at(2027, 4, 10), at(2027, 3, 30).toISOString())).toBe(false);
    expect(mockExamDue(at(2027, 4, 13), at(2027, 3, 30).toISOString())).toBe(true);
    expect(mockExamDue(at(2027, 4, 14), at(2027, 3, 31).toISOString())).toBe(true); // passage à l'heure d'été le 28 mars
    expect(mockExamDue(at(2027, 6, 5))).toBe(true);
  });

  test("nothing after the exam season", () => {
    expect(mockExamDue(at(2027, 7, 3))).toBe(false);
  });
});

describe("startMockExam", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(2027, 1, 9));
    resetDbForTests();
    generateSubject.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  test("starts on a ready tier-3 subject, exam mode on, marked as mock", async () => {
    insertSubject(subject(1));
    const t3 = insertSubject(subject(3));
    const s = await startMockExam();
    expect(s).toMatchObject({ subjectId: t3.id, tier: 3, isMock: true, examMode: true, status: "draft" });
    expect(lastMockAt()).toBe(s.startedAt);
    expect(generateSubject).not.toHaveBeenCalled();
  });

  test("generates a tier-3 subject when none is ready", async () => {
    const t3 = insertSubject(subject(3));
    markSubjectUsed(t3.id); // plus « prêt » : il faut en générer un
    generateSubject.mockResolvedValueOnce({ ...t3 });
    await startMockExam();
    expect(generateSubject).toHaveBeenCalledWith({ mode: "topic", topic: expect.any(String) }, 3, undefined);
  });

  test("refused when not due, or when a copy is in progress; an abandoned mock does not count", async () => {
    vi.setSystemTime(at(2026, 11, 14));
    await expect(startMockExam()).rejects.toBeInstanceOf(MockExamRefused);

    vi.setSystemTime(at(2027, 1, 9));
    const draft = createSession(insertSubject(subject(1)).id, 1);
    await expect(startMockExam()).rejects.toMatchObject({ status: 409, message: expect.stringContaining("copie en cours") });
    abandonSession(draft.id);

    insertSubject(subject(3));
    const mock = await startMockExam();
    abandonSession(mock.id);
    expect(lastMockAt()).toBeUndefined();
    insertSubject(subject(3));
    const again = await startMockExam();
    expect(getSession(again.id)?.isMock).toBe(true);
    abandonSession(again.id);
  });

  test("one mock a month: a second one in January is refused", async () => {
    insertSubject(subject(3));
    const first = await startMockExam();
    abandonSession(first.id); // abandonnée : ne compte pas
    insertSubject(subject(3));
    const second = await startMockExam();
    expect(second.isMock).toBe(true);
    vi.setSystemTime(at(2027, 1, 20));
    await expect(startMockExam()).rejects.toMatchObject({ message: "Pas d’examen blanc prévu pour l’instant." });
  });
});
