import { expect, test } from "vitest";
import { progressResponse, wantsProgress } from "./progress-response";

const lines = async (res: Response) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));

test("streams deduplicated progress lines, then the outcome with its real status", async () => {
  const res = progressResponse(async (emit) => {
    emit({ label: "Article : 10 mots", pct: 20.2 });
    emit({ label: "Article : 10 mots", pct: 20.4 }); // même ligne une fois arrondie : pas renvoyée
    emit({ label: "Consigne", pct: 80 });
    return { status: 502, body: { error: "Le service ne répond pas." } };
  });
  expect(res.headers.get("content-type")).toContain("application/x-ndjson");
  expect(await lines(res)).toEqual([
    { progress: { label: "Article : 10 mots", pct: 20 } },
    { progress: { label: "Consigne", pct: 80 } },
    { done: { status: 502, body: { error: "Le service ne répond pas." } } },
  ]);
});

test("an unexpected error becomes a French 500 outcome, not a broken stream", async () => {
  const res = progressResponse(async () => {
    throw new Error("boom");
  });
  expect((await lines(res)).at(-1)).toEqual({ done: { status: 500, body: { error: "Une erreur est survenue. Réessaie." } } });
});

test("only requests asking for ndjson get the stream", () => {
  expect(wantsProgress(new Request("http://x", { headers: { Accept: "application/x-ndjson" } }))).toBe(true);
  expect(wantsProgress(new Request("http://x"))).toBe(false);
  expect(wantsProgress()).toBe(false);
});
