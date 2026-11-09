import { requireStudent } from "@/lib/auth";
import { saveWeekPlan } from "@/lib/repo/week-plan";
import { WeekPlanSchema } from "@/lib/week-plan";

export async function PUT(req: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  const body = WeekPlanSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Planning invalide." }, { status: 400 });
  saveWeekPlan(body.data);
  return new Response(null, { status: 204 });
}
