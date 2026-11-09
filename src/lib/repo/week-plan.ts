import { getJsonSetting, setJsonSetting } from "@/lib/repo/settings";
import { DEFAULT_WEEK_PLAN, WeekPlanSchema, type WeekPlan } from "@/lib/week-plan";

const KEY = "week_plan";

export function getWeekPlan(): WeekPlan {
  const stored = WeekPlanSchema.safeParse(getJsonSetting<unknown>(KEY, null));
  return stored.success ? stored.data : DEFAULT_WEEK_PLAN;
}

export function saveWeekPlan(plan: WeekPlan) {
  setJsonSetting(KEY, plan);
}
