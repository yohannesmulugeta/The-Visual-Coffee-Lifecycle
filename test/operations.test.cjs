const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scenarios, replay, releaseReasons } = require("../operations.js");

const scenario = id => scenarios.find(item => item.id === id);

test("all fictional journeys replay without invalid stock movements", () => {
  for (const item of scenarios) assert.equal(replay(item.events).error, null, item.id);
});

test("export release needs quality, payment and document, then leaves rejects", () => {
  const item = scenario("EXPORT");
  const before = replay(item.events, 3);
  assert.equal(before.stock[item.owner].clean, 325);
  assert.match(releaseReasons(before, item.owner, "clean", 200).join(" "), /Finance clearance/);
  const ready = replay(item.events, 5);
  assert.deepEqual(releaseReasons(ready, item.owner, "clean", 200), []);
  const after = replay(item.events);
  assert.deepEqual(after.stock[item.owner], { raw: 0, clean: 0, reject: 12 });
});

test("storage-only partial releases preserve nonnegative owner balance", () => {
  const item = scenario("STORAGE");
  assert.equal(replay(item.events, 4).stock[item.owner].raw, 180);
  assert.equal(replay(item.events).stock[item.owner].raw, 0);
});

test("failed quality blocks clean release until a separate rerun is accepted", () => {
  const item = scenario("REWORK");
  const failed = replay(item.events, 3);
  assert.match(releaseReasons(failed, item.owner, "clean", 1).join(" "), /Accepted quality result/);
  assert.equal(replay(item.events, 4).quality[item.owner], "PENDING");
  assert.equal(replay(item.events, 5).quality[item.owner], "PASS");
});

test("transfer separates owners and holds the new owner for billing review", () => {
  const item = scenario("TRANSFER");
  const state = replay(item.events);
  assert.equal(state.stock["Example Client A"].raw, 180);
  assert.equal(state.stock["Example Client B"].raw, 120);
  assert.match(releaseReasons(state, "Example Client B", "raw", 60).join(" "), /Article 15.4/);
});

test("duplicate IDs and overdrawn dispatches are rejected", () => {
  const item = scenario("STORAGE");
  const duplicate = [...item.events.slice(0, 1), { ...item.events[0], date: "2026-02-03" }];
  assert.match(replay(duplicate).error, /Duplicate/);
  const overdrawn = [...item.events.slice(0, 3), { ...item.events[3], bags: 301 }];
  assert.match(replay(overdrawn).error, /Insufficient/);
  const invalidDate = [{ ...item.events[0], date: "2026-02-31" }];
  assert.match(replay(invalidDate).error, /valid ISO dates/);
});

test("reject coffee stays on hold for route-specific authority review", () => {
  const item = scenario("EXPORT");
  const ready = replay(item.events, 5);
  assert.match(releaseReasons(ready, item.owner, "reject", 1).join(" "), /authority document review/);
});
