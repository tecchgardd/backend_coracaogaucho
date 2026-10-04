import assert from "node:assert/strict";
import test from "node:test";
import { calculateEventUnitPrice, collectCursorPages } from "./public.service.js";

test("collectCursorPages follows next_cursor beyond 400 resources and removes duplicates", async () => {
  const all = Array.from({ length: 450 }, (_, index) => ({ public_id: `album/photo-${String(index).padStart(3, "0")}` }));
  const calls: Array<string | undefined> = [];
  const result = await collectCursorPages(async (cursor) => {
    calls.push(cursor);
    if (!cursor) return { resources: all.slice(0, 200), next_cursor: "page-2" };
    if (cursor === "page-2") return { resources: [all[199], ...all.slice(200, 400)], next_cursor: "page-3" };
    return { resources: all.slice(400) };
  });

  assert.deepEqual(calls, [undefined, "page-2", "page-3"]);
  assert.equal(result.length, 450);
  assert.equal(new Set(result.map((item) => item.public_id)).size, 450);
});

test("collectCursorPages handles an empty album", async () => {
  const result = await collectCursorPages(async () => ({ resources: [] }));
  assert.deepEqual(result, []);
});

test("calculateEventUnitPrice handles paid, early-bird and free events", () => {
  const now = new Date("2026-07-10T12:00:00Z");
  assert.equal(calculateEventUnitPrice({ preco: 50, precoAntecipado: 30, dataLimiteAntecipado: new Date("2026-07-11T12:00:00Z") }, now), 30);
  assert.equal(calculateEventUnitPrice({ preco: 50, precoAntecipado: 30, dataLimiteAntecipado: new Date("2026-07-09T12:00:00Z") }, now), 50);
  assert.equal(calculateEventUnitPrice({ preco: 0, precoAntecipado: null, dataLimiteAntecipado: null }, now), 0);
});
