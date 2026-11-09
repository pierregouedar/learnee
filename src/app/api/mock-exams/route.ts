import { requireStudent } from "@/lib/auth";
import { LlmError } from "@/lib/llm/client";
import { progressResponse, wantsProgress, type Emit, type Outcome } from "@/lib/progress-response";
import { ActiveSessionExistsError } from "@/lib/repo/sessions";
import { MockExamRefused, startMockExam } from "@/lib/services/mock-exam";

async function start(emit?: Emit): Promise<Outcome> {
  try {
    return { status: 201, body: await startMockExam(new Date(), emit) };
  } catch (e) {
    if (e instanceof MockExamRefused || e instanceof ActiveSessionExistsError) return { status: 409, body: { error: e.message } };
    if (e instanceof LlmError) return { status: e.code === "rate_limited" ? 429 : 502, body: { error: e.message } };
    throw e;
  }
}

export async function POST(req?: Request) {
  const user = await requireStudent();
  if (user instanceof Response) return user;
  if (wantsProgress(req)) return progressResponse(start);
  const out = await start();
  return Response.json(out.body, { status: out.status });
}
