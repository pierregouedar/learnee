import { expect, test } from "vitest";
import { extractJson } from "./json";

test("plain JSON", () => {
  expect(extractJson('{"a":1}')).toEqual({ a: 1 });
});

test("fenced code block", () => {
  expect(extractJson('Voici :\n```json\n{"a":2}\n```\nFin')).toEqual({ a: 2 });
});

test("prose around braces", () => {
  expect(extractJson('Sure! {"a":{"b":3}} hope it helps')).toEqual({ a: { b: 3 } });
});

test("no JSON throws", () => {
  expect(() => extractJson("désolé")).toThrow();
});
