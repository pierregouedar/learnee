import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

import { listCards } from "@/lib/cards";
import { resetDbForTests } from "@/lib/db";
import { createSession, getSession } from "@/lib/repo/sessions";
import { insertSubject } from "@/lib/repo/subjects";
import { signInAs } from "@/lib/testing/auth";
import { GET as exportCsv } from "../vocab.csv/route";
import { PATCH } from "./[id]/route";
import { POST } from "./route";

const req = (body: unknown, method = "POST") =>
  new Request("http://t/api/cards", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const word = (sourceId: string) => ({
  term: "brand awareness",
  definition: "how well people know a brand",
  example: "Ads build brand awareness.",
  fr: "notoriété",
  context: { sentence: "The campaign boosted brand awareness.", sourceType: "reading", sourceId, sourceTitle: "AI ads" },
});

let sessionId: string;
beforeEach(() => {
  resetDbForTests();
  const subjectId = insertSubject({
    domain: "libre", source: "topic", tier: 1, title: "AI ads", article: "A", task: "C", guideQuestions: [], keywords: [],
  }).id;
  sessionId = createSession(subjectId, 1).id;
});

test("student keeps a word: card created, lookup saved on the session", async () => {
  signInAs("student");
  const res = await POST(req(word(sessionId)));
  expect(res.status).toBe(201);
  expect(listCards()[0]).toMatchObject({ term: "brand awareness", origin: "kept" });
  expect(getSession(sessionId)?.lookups).toEqual([{ en: "brand awareness", fr: "notoriété", exemple: "Ads build brand awareness." }]);
});

test("invalid body 400, viewer 403", async () => {
  signInAs("student");
  expect((await POST(req({ term: "" }))).status).toBe(400);
  signInAs("viewer");
  expect((await POST(req(word(sessionId)))).status).toBe(403);
  expect(listCards()).toHaveLength(0);
});

test("PATCH suspends a card, 404 when unknown", async () => {
  signInAs("student");
  const card = (await (await POST(req(word(sessionId)))).json()) as { id: string };
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  expect((await PATCH(req({ suspended: true }, "PATCH"), ctx(card.id))).status).toBe(204);
  expect(listCards()[0].suspended).toBe(true);
  expect((await PATCH(req({ suspended: true }, "PATCH"), ctx("nope"))).status).toBe(404);
  expect((await PATCH(req({ suspended: "yes" }, "PATCH"), ctx(card.id))).status).toBe(400);
});

test("CSV export: signed out 401, viewer allowed, suspended cards left out", async () => {
  signInAs("student");
  await POST(req(word(sessionId)));
  const other = (await (await POST(req({ ...word(sessionId), term: "reach" }))).json()) as { id: string };
  await PATCH(req({ suspended: true }, "PATCH"), { params: Promise.resolve({ id: other.id }) });
  signInAs(null);
  expect((await exportCsv()).status).toBe(401);
  signInAs("viewer");
  const res = await exportCsv();
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(res.headers.get("content-disposition")).toBe('attachment; filename="learnee-vocabulaire.csv"');
  const body = await res.text();
  expect(body).toContain('"brand awareness"');
  expect(body).not.toContain('"reach"');
});
