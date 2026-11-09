import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

import { resetDbForTests } from "@/lib/db";
import { insertSubject, type NewSubject } from "@/lib/repo/subjects";
import { signInAs } from "@/lib/testing/auth";
import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://t/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => resetDbForTests());

test("exam mode is stored on the new session, off by default", async () => {
  signInAs("student");
  const base: NewSubject = { domain: "libre", source: "topic", tier: 1, title: "T", article: "A", task: "C", guideQuestions: [], keywords: [] };
  const exam = await POST(req({ subjectId: insertSubject(base).id, examMode: true }));
  expect(exam.status).toBe(201);
  const created = await exam.json();
  expect(created.examMode).toBe(true);
  const { abandonSession } = await import("@/lib/repo/sessions");
  abandonSession(created.id);
  expect((await (await POST(req({ subjectId: insertSubject(base).id }))).json()).examMode).toBe(false);
});
