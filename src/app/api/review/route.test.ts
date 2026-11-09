import { beforeEach, expect, test, vi } from "vitest";
vi.mock("next/headers", () => import("@/lib/testing/next-headers"));

import { keepWord } from "@/lib/cards";
import { resetDbForTests } from "@/lib/db";
import { signInAs } from "@/lib/testing/auth";
import { POST } from "./[cardId]/route";
import { GET } from "./due/route";

const ctx = { sentence: "The brand launched a bold campaign.", sourceType: "reading" as const, sourceId: "s1", sourceTitle: "Bold brands" };
const add = (term: string) => keepWord({ term, definition: "def", fr: "fr", context: ctx }).id;
const post = (cardId: string, body: unknown) =>
  POST(new Request("http://t", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ cardId }),
  });

beforeEach(() => resetDbForTests());

test("GET due: 401 signed out, cards + stats signed in", async () => {
  add("campaign");
  expect((await GET()).status).toBe(401);
  signInAs("student");
  const res = await GET();
  expect(res.status).toBe(200);
  const body = (await res.json()) as { cards: { term: string }[]; stats: { acquired: number } };
  expect(body.cards[0]).toMatchObject({ term: "campaign" });
  expect(body.stats).toMatchObject({ acquired: 0 });
});

test("POST rate: 401 signed out, 403 viewer, 400 invalid rating, 404 unknown card, 200 recomputes queue", async () => {
  const id = add("campaign");
  expect((await post(id, { rating: 3 })).status).toBe(401);
  signInAs("viewer");
  expect((await post(id, { rating: 3 })).status).toBe(403);
  signInAs("student");
  expect((await post(id, { rating: 7 })).status).toBe(400);
  expect((await post("nope", { rating: 3 })).status).toBe(404);
  const res = await post(id, { rating: 3, elapsedMs: 4000 });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { queue: unknown[] };
  expect(Array.isArray(body.queue)).toBe(true);
});

test("POST suspend: card removed from due queue, 404 on unknown card", async () => {
  const id = add("campaign");
  signInAs("student");
  const res = await post(id, { action: "suspend" });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { queue: { id: string }[] };
  expect(body.queue.find((c) => c.id === id)).toBeUndefined();
  expect((await post("nope", { action: "suspend" })).status).toBe(404);
});
