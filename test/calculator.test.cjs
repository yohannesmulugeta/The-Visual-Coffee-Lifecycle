const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateEstimate } = require("../calculator.js");

function example(changes = {}) {
  return {
    route: "EXPORT", rawMT: 25.5, rawBags: 300,
    cleanMT: 19.5, rejectMT: 0.8, leftoverMT: 0,
    parchmentMT: 5.1, dustMT: 0.1, cleanBags: 325, rejectBags: 12,
    daysRaw: 28, daysClean: 18, daysReject: 14, printBags: 325,
    emptyBundles: 0, daysEmpty: 0, emptyDelay: 0,
    baseRate: 3700, isWashed: true, rework: "1",
    grainpro: false, certified: false, blending: false,
    container: "NONE", taxRate: null, labor: [],
    ...changes
  };
}

test("the default draft shows traceable pre-tax charges", () => {
  const result = calculateEstimate(example());
  assert.deepEqual(result.errors, []);
  assert.equal(result.subtotal, 95998);
  assert.equal(result.tax, null);
  assert.equal(result.lines.length, 5);
});

test("printing below 50 is pending, while tier boundaries use the printed rates", () => {
  const at = count => calculateEstimate(example({ printBags: count, daysRaw: 0, daysClean: 0, daysReject: 0 })).lines
    .find(line => line.clause === "19.2")?.amount;
  const below = calculateEstimate(example({ printBags: 49 }));
  assert.equal(below.lines.some(line => line.clause === "19.2"), false);
  assert.match(below.pending.join(" "), /separate agreed price/);
  assert.equal(at(50), 3478.5);
  assert.equal(at(99), 6887.43);
  assert.equal(at(100), 5565);
  assert.equal(at(159), 8848.35);
  assert.equal(at(160), 6956.8);
});

test("invalid stock balances cannot produce an estimate", () => {
  assert.match(calculateEstimate(example({ rawMT: -1 })).errors.join(" "), /nonnegative/);
  assert.match(calculateEstimate(example({ cleanMT: 30 })).errors.join(" "), /exceed/);
  assert.match(calculateEstimate(example({ parchmentMT: 0 })).errors.join(" "), /Account for all/);
});

test("quality rework is an additional charge and labor is never automatic", () => {
  const rerun = calculateEstimate(example({ rework: "ECTA", printBags: 0 }));
  assert.equal(rerun.lines.filter(line => line.clause === "13.5").length, 1);
  assert.equal(rerun.lines.find(line => line.clause === "13.5").amount, 54112.5);
  assert.equal(rerun.lines.some(line => line.clause.startsWith("19.1")), false);
  const withLabor = calculateEstimate(example({
    labor: [{ code: "19.1.1", name: "Unloading", rate: 12, quantity: 300 }]
  }));
  assert.equal(withLabor.subtotal, 99598);
});

test("storage-only has no processing charge and starts rent on day one", () => {
  const storage = calculateEstimate(example({
    route: "STORAGE", cleanMT: 0, rejectMT: 0, leftoverMT: 0,
    parchmentMT: 0, dustMT: 0, cleanBags: 0, rejectBags: 0,
    daysRaw: 1, daysClean: 0, daysReject: 0, printBags: 0
  }));
  assert.deepEqual(storage.errors, []);
  assert.equal(storage.subtotal, 1500);
  assert.equal(storage.lines.some(line => line.clause.startsWith("13.1")), false);
});

test("empty-bag rent and exit delay are separate, with an unresolved upper boundary", () => {
  const result = calculateEstimate(example({ emptyBundles: 2, daysEmpty: 41, emptyDelay: 3 }));
  assert.deepEqual(result.errors, []);
  assert.equal(result.lines.find(line => line.clause === "16.1–16.3").amount, 250);
  assert.equal(result.lines.find(line => line.clause === "16.4").amount, 300);
  assert.match(calculateEstimate(example({ emptyBundles: 2, daysEmpty: 161 })).errors.join(" "), /agreed rate/);
  assert.match(calculateEstimate(example({ emptyBundles: 1.5, daysEmpty: 12 })).errors.join(" "), /whole number/);
});

test("labor quantities respect the unit used by the selected activity", () => {
  const fractionalBags = calculateEstimate(example({ labor: [{ code: "19.1.1", name: "Unloading", unit: "Per Bag", rate: 12, quantity: 1.5 }] }));
  assert.match(fractionalBags.errors.join(" "), /whole bag/);
  const fractionalQuintals = calculateEstimate(example({ labor: [{ code: "19.1.36", name: "Drying", unit: "Per Quintal", rate: 20, quantity: 1.5 }] }));
  assert.deepEqual(fractionalQuintals.errors, []);
});
