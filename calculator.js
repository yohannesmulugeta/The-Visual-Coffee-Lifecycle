(function (root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  root.CoffeeCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

  function calculateEstimate(input) {
    const errors = [];
    const warnings = [];
    const pending = [];
    const lines = [];
    const isExport = input.route === "EXPORT";
    const isStorage = input.route === "STORAGE";
    if (!isExport && !isStorage) errors.push("Choose export preparation or storage-only.");

    const values = [
      ["Raw coffee MT", input.rawMT], ["Raw bags", input.rawBags],
      ["Clean output MT", input.cleanMT], ["Reject output MT", input.rejectMT],
      ["Leftover MT", input.leftoverMT], ["Parchment MT", input.parchmentMT],
      ["Dust/loss MT", input.dustMT], ["Clean bags", input.cleanBags],
      ["Reject bags", input.rejectBags], ["Raw days", input.daysRaw],
      ["Clean days", input.daysClean], ["Reject days", input.daysReject],
      ["Print bags", input.printBags], ["Empty bundles", input.emptyBundles],
      ["Empty bag days", input.daysEmpty], ["Empty exit delay days", input.emptyDelay]
    ];
    for (const [label, value] of values) {
      if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be a nonnegative number.`);
    }
    for (const [label, value] of values.filter(([label]) => /bags|days|bundles/i.test(label))) {
      if (Number.isFinite(value) && !Number.isInteger(value)) errors.push(`${label} must be a whole number.`);
    }
    if (input.rawMT <= 0 || input.rawBags <= 0) errors.push("Enter a positive received coffee weight and bag count.");
    if (input.emptyBundles > 0 && input.daysEmpty > 160) {
      errors.push("Empty-bag rent beyond the illustrated four-month later bracket needs an agreed rate.");
    }
    if (input.emptyBundles === 0 && (input.daysEmpty > 0 || input.emptyDelay > 0)) {
      errors.push("Enter empty jute bundles before adding their storage days or delayed-exit days.");
    }
    if (input.taxRate !== null && (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 100)) {
      errors.push("Illustrative tax rate must be between 0 and 100%.");
    }
    if (!Number.isFinite(input.baseRate) || input.baseRate < 0) errors.push("Select a valid grade rate.");

    if (isExport) {
      if (input.cleanMT <= 0) errors.push("A completed export run needs positive clean output.");
      if (input.cleanBags <= 0) errors.push("Enter the clean output bag count.");
      const accounted = input.cleanMT + input.rejectMT + input.leftoverMT + input.parchmentMT + input.dustMT;
      if (accounted > input.rawMT + 0.005) errors.push("Output and losses exceed the received raw weight.");
      if (accounted < input.rawMT - 0.005) errors.push("Account for all received weight as output, leftover, parchment, or dust/loss.");
      if (!input.isWashed && input.parchmentMT > 0) errors.push("Unwashed coffee cannot include washed parchment.");
      if (input.rawMT > 0) {
        const parchmentPct = input.parchmentMT / input.rawMT * 100;
        const dustPct = input.dustMT / input.rawMT * 100;
        if (input.isWashed && parchmentPct > 20.005) errors.push("Washed parchment exceeds the contract's 20% allowance.");
        if (dustPct > 2.505) errors.push("Dust/loss exceeds the contract's 2.5% allowance.");
      }
      // shortcut: the demo checks stated tolerances, not approved stock write-offs.
      if (Math.abs(input.cleanBags * 60 / 1000 - input.cleanMT) > 0.01) {
        warnings.push("Clean bag count does not match the displayed 60 kg bag assumption.");
      }
    } else if (isStorage && [input.cleanMT, input.rejectMT, input.leftoverMT, input.parchmentMT, input.dustMT].some(x => x > 0)) {
      warnings.push("Output fields are ignored for a storage-only route.");
    }

    const selectedLabor = input.labor || [];
    const laborCodes = new Set();
    for (const job of selectedLabor) {
      if (laborCodes.has(job.code)) errors.push(`Labor activity ${job.code} is selected twice.`);
      laborCodes.add(job.code);
      if (!Number.isFinite(job.quantity) || job.quantity <= 0 || !Number.isFinite(job.rate) || job.rate < 0) {
        errors.push(`Enter a positive quantity and valid rate for labor ${job.code}.`);
      }
      if (job.unit && !job.unit.includes("Quintal") && Number.isFinite(job.quantity) && !Number.isInteger(job.quantity)) {
        errors.push(`Labor ${job.code} requires a whole bag, bundle, or carton count.`);
      }
    }
    if (errors.length) return { errors, warnings, pending, lines, subtotal: null, tax: null, total: null };

    const add = (label, amount, clause) => {
      if (amount > 0) lines.push({ label, amount: money(amount), clause });
    };
    const afterGrace = (days, free, tierDays, firstRate, laterRate, count) => {
      const paid = Math.max(0, days - free);
      return count * (Math.min(paid, tierDays) * firstRate + Math.max(0, paid - tierDays) * laterRate);
    };

    if (isExport) {
      const billableMT = Math.max(19.2, input.cleanMT);
      add(`Initial grade processing: ${billableMT.toFixed(2)} MT × ${input.baseRate}`,
        billableMT * input.baseRate, "13.1, 13.7");
      if (input.rework === "ECTA" || input.rework === "CLIENT") {
        const factor = input.rework === "ECTA" ? 0.75 : 1;
        add(`Additional ${input.rework === "ECTA" ? "quality-failure" : "client-requested"} rework: ${billableMT.toFixed(2)} MT × ${input.baseRate} × ${factor}`,
          billableMT * input.baseRate * factor, "13.5");
        warnings.push("Rework quantity uses the same clean-output estimate; confirm actual second-run output.");
      }
      if (input.grainpro) add(`Double bag / liner: ${input.cleanMT.toFixed(2)} MT × 500`, input.cleanMT * 500, "13.8");
      if (input.certified) add(`Certified preparation: ${input.cleanMT.toFixed(2)} MT × 1,000`, input.cleanMT * 1000, "13.14");
      if (input.blending) add(`Machine blending: ${input.cleanMT.toFixed(2)} MT × 1,000`, input.cleanMT * 1000, "13.10");
      if (input.grainpro || input.certified || input.blending) {
        warnings.push("Add-ons use actual clean MT here; their minimum-charge basis requires client confirmation.");
      }
      add("Raw export-preparation storage", afterGrace(input.daysRaw, 20, 90, 2.75, 3.5, input.rawBags), "15");
      add("Clean coffee storage", afterGrace(input.daysClean, 15, 90, 3, input.certified ? 6 : 5, input.cleanBags), "17");
      add("Reject coffee storage", afterGrace(input.daysReject, 10, 20, 4, 6, input.rejectBags), "18");
    } else {
      add("Unprocessed coffee storage", afterGrace(input.daysRaw, 0, 90, 5, 7, input.rawBags), "14");
    }
    if (input.emptyBundles > 0) {
      const firstDays = Math.max(0, Math.min(input.daysEmpty, 40) - 10);
      const laterDays = Math.max(0, input.daysEmpty - 40);
      add("Empty jute bag storage", input.emptyBundles * (firstDays * 4 + laterDays * 5), "16.1–16.3");
      add("Uncollected empty-bag exit document penalty", input.emptyDelay * 100, "16.4");
      if (input.daysEmpty > 40) warnings.push("The four-month empty-bag bracket is illustrated as days 41–160; confirm calendar dates.");
    }
    warnings.push("For this illustration, three consecutive months are treated as 90 days. The contract needs a calendar rule decision.");

    if (input.printBags > 0 && input.printBags < 50) {
      pending.push("Bag printing below 50 bags needs a separate agreed price (19.2.1.4); no amount is included.");
    } else if (input.printBags >= 50 && isExport) {
      const rate = input.printBags >= 160 ? 43.48 : input.printBags >= 100 ? 55.65 : 69.57;
      add(`Bag printing: ${input.printBags} × ${rate}`, input.printBags * rate, "19.2");
    }
    for (const job of selectedLabor) add(`${job.code} ${job.name}: ${job.quantity} × ${job.rate}`, job.quantity * job.rate, job.code);
    if (isExport && input.container === "BULK20") add("20 ft bulk blower", 10000, "13.20");
    if (isExport && input.container === "BULK40") add("40 ft bulk blower", 16000, "13.20");

    const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));
    const tax = input.taxRate === null ? null : money(subtotal * input.taxRate / 100);
    const total = tax === null ? null : money(subtotal + tax);
    if (tax === null) pending.push("VAT/TOT treatment requires finance confirmation; only the pre-tax subtotal is shown.");
    else warnings.push(`The ${input.taxRate}% tax input is illustrative; it is not a rate stated in the contract.`);
    return { errors, warnings, pending, lines, subtotal, tax, total };
  }

  return { calculateEstimate };
});
