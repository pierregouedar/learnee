import { beforeEach, expect, test, vi } from "vitest";

const { schedule } = vi.hoisted(() => ({ schedule: vi.fn() })); // vi.mock est remonté en tête de fichier
vi.mock("node-cron", () => ({ schedule, validate: (e: string) => e !== "bad" }));

const { registerJob, resetJobsForTests, startJobs } = await import("./scheduler");

beforeEach(() => {
  schedule.mockReset();
  resetJobsForTests();
});

test("jobs are scheduled once, in Paris time, without overlap", () => {
  registerJob("news", "0 3 * * *", async () => {});
  registerJob("news", "0 3 * * *", async () => {}); // ré-import en dev : ignoré
  startJobs();
  startJobs();
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(schedule).toHaveBeenCalledWith("0 3 * * *", expect.any(Function), {
    name: "news", timezone: "Europe/Paris", noOverlap: true,
  });
});

test("a failing job is logged, never thrown", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  registerJob("boom", "* * * * *", async () => {
    throw new Error("x");
  });
  startJobs();
  const tick = schedule.mock.calls[0][1] as () => Promise<void>;
  await expect(tick()).resolves.toBeUndefined();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("invalid cron expression is rejected at registration", () => {
  expect(() => registerJob("x", "bad", async () => {})).toThrow("cron");
});
