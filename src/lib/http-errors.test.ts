import { expect, test, vi } from "vitest";
import { AudioError } from "@/lib/audio/errors";
import { errorResponse } from "@/lib/http-errors";
import { LlmError } from "@/lib/llm/client";

test("maps known errors to French JSON with the right status", async () => {
  const r1 = errorResponse(new AudioError("invalid", "L'extrait doit durer entre 1 et 4 minutes."));
  expect(r1.status).toBe(400);
  expect(await r1.json()).toEqual({ error: "L'extrait doit durer entre 1 et 4 minutes." });
  expect(errorResponse(new AudioError("unavailable", "x")).status).toBe(503);
  expect(errorResponse(new AudioError("provider", "x")).status).toBe(502);
  expect(errorResponse(new LlmError("rate_limited", "x")).status).toBe(429);
  expect(errorResponse(new LlmError("provider", "x")).status).toBe(502);
});

test("unknown errors are logged and hidden", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const r = errorResponse(new Error("secret stack"));
  expect(r.status).toBe(500);
  expect(await r.json()).toEqual({ error: "Une erreur est survenue. Réessaie plus tard." });
  expect(log).toHaveBeenCalled();
});
