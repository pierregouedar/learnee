import { z } from "zod";

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof WEEK_DAYS)[number];

export const PLAN_TASKS = ["writing", "grammar", "listening", "rewrite", "choice"] as const;
export type PlanTask = (typeof PLAN_TASKS)[number];
export type TodayTask = PlanTask | "mock";
export type WeekPlan = Record<DayKey, PlanTask[]>;

// Semaine type §19.3 (modifiable dans /profil). La révision du vocabulaire s'ajoute chaque jour.
export const DEFAULT_WEEK_PLAN: WeekPlan = {
  mon: ["writing"],
  tue: ["grammar", "listening"],
  wed: ["grammar", "rewrite"],
  thu: ["writing"],
  fri: ["listening"],
  sat: ["choice"],
  sun: [],
};

const Tasks = z.array(z.enum(PLAN_TASKS)).max(PLAN_TASKS.length * 2);
export const WeekPlanSchema = z.object({ mon: Tasks, tue: Tasks, wed: Tasks, thu: Tasks, fri: Tasks, sat: Tasks, sun: Tasks });

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Lundi", tue: "Mardi", wed: "Mercredi", thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
};

export const TASK_LABELS: Record<TodayTask, string> = {
  writing: "Sujet écrit",
  grammar: "Grammaire",
  listening: "Écoute",
  rewrite: "Réécriture de la dernière copie",
  choice: "Grammaire ou sujet écrit, au choix",
  mock: "Examen blanc",
};

export const dayKey = (date: Date): DayKey => WEEK_DAYS[(date.getDay() + 6) % 7];

// À partir de janvier, le samedi où un examen blanc est dû devient « examen blanc » (§19.3, §17.4).
export function todayTasks(now: Date, plan: WeekPlan, mockDue: boolean): TodayTask[] {
  const day = dayKey(now);
  if (day === "sat" && mockDue) return ["mock"];
  return [...new Set(plan[day])];
}
