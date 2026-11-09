import { schedule, validate } from "node-cron";

type Job = { name: string; cron: string; fn: () => Promise<void> };

export const JOBS_TIMEZONE = "Europe/Paris";

// globalThis : survit aux rechargements à chaud de `next dev` (sinon les tâches seraient programmées deux fois).
const g = globalThis as { __learneeJobs?: Job[]; __learneeJobsStarted?: boolean };
const jobs = (g.__learneeJobs ??= []);

export function registerJob(name: string, cron: string, fn: () => Promise<void>) {
  if (!validate(cron)) throw new Error(`Expression cron invalide pour ${name} : ${cron}`);
  if (jobs.some((j) => j.name === name)) return;
  jobs.push({ name, cron, fn });
}

export async function runJob(job: Job) {
  const started = Date.now();
  try {
    await job.fn();
    console.info(`[jobs] ${job.name} terminé en ${Date.now() - started} ms`);
  } catch (e) {
    console.error(`[jobs] ${job.name} a échoué`, e);
  }
}

export function startJobs() {
  if (g.__learneeJobsStarted) return;
  g.__learneeJobsStarted = true;
  for (const job of jobs) {
    schedule(job.cron, () => runJob(job), { name: job.name, timezone: JOBS_TIMEZONE, noOverlap: true });
  }
}

export function resetJobsForTests() {
  jobs.length = 0;
  g.__learneeJobsStarted = false;
}
