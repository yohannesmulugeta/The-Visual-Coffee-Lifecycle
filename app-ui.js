const selectedLaborJobs = [];

function readEstimateNumber(id) {
  const value = document.getElementById(id).value.trim();
  return value === "" ? NaN : Number(value);
}

function renderSelectedLabor() {
  const container = document.getElementById("sim-labor-selected");
  container.replaceChildren();
  if (!selectedLaborJobs.length) {
    container.textContent = "No labor activity selected. Add only work actually performed.";
    return;
  }
  selectedLaborJobs.forEach(job => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2";
    const label = document.createElement("span");
    label.textContent = `${job.code} · ${job.name} · ${job.quantity} × ${job.rate} ETB`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-red-700 font-semibold";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove labor activity ${job.code}`);
    remove.addEventListener("click", () => {
      selectedLaborJobs.splice(selectedLaborJobs.indexOf(job), 1);
      renderSelectedLabor();
      runSimulation();
    });
    row.append(label, remove);
    container.append(row);
  });
}

function addLabor() {
  const code = document.getElementById("sim-labor-code").value;
  const item = laborServices.find(service => service.code === code);
  const quantity = readEstimateNumber("sim-labor-quantity");
  const needsWholeUnits = item && !item.unit.includes("Quintal");
  if (!item || !Number.isFinite(quantity) || quantity <= 0 || (needsWholeUnits && !Number.isInteger(quantity)) || selectedLaborJobs.some(job => job.code === code)) {
    document.getElementById("sim-labor-quantity").setCustomValidity("Enter a positive quantity and select each activity only once.");
    document.getElementById("sim-labor-quantity").reportValidity();
    return;
  }
  document.getElementById("sim-labor-quantity").setCustomValidity("");
  selectedLaborJobs.push({ code, name: item.desc.split(" (")[0], unit: item.unit, rate: item.rate, quantity });
  renderSelectedLabor();
  runSimulation();
}

function initializeEstimate() {
  const select = document.getElementById("sim-labor-code");
  laborServices.forEach(item => {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = `${item.code} · ${item.desc.split(" (")[0]} · ${item.rate} ETB / ${item.unit}`;
    select.append(option);
  });
  renderSelectedLabor();
  runSimulation();
}

function runSimulation() {
  const route = document.getElementById("sim-route").value;
  const isExport = route === "EXPORT";
  document.getElementById("sim-route-note").textContent = isExport
    ? "Processing, output, printing and storage fields contribute to this draft when applicable."
    : "Storage-only uses the received coffee and empty-bag counts and their storage days. Processing, output, printing and rework fields are ignored.";
  const gradeSelect = document.getElementById("sim-grade");
  const grade = gradeSelect.options[gradeSelect.selectedIndex];
  const screen = document.getElementById("sim-screen").value;
  const taxField = document.getElementById("sim-tax-rate").value.trim();
  const input = {
    route,
    rawMT: readEstimateNumber("sim-raw-mt"),
    rawBags: readEstimateNumber("sim-raw-bags"),
    cleanMT: isExport ? readEstimateNumber("sim-clean-mt") : 0,
    rejectMT: isExport ? readEstimateNumber("sim-reject-mt") : 0,
    leftoverMT: isExport ? readEstimateNumber("sim-leftover-mt") : 0,
    parchmentMT: isExport ? readEstimateNumber("sim-parchment-mt") : 0,
    dustMT: isExport ? readEstimateNumber("sim-dust-mt") : 0,
    cleanBags: isExport ? readEstimateNumber("sim-clean-bags") : 0,
    rejectBags: isExport ? readEstimateNumber("sim-reject-bags") : 0,
    daysRaw: readEstimateNumber("sim-days-raw"),
    daysClean: isExport ? readEstimateNumber("sim-days-clean") : 0,
    daysReject: isExport ? readEstimateNumber("sim-days-reject") : 0,
    emptyBundles: readEstimateNumber("sim-empty-bundles"),
    daysEmpty: readEstimateNumber("sim-days-empty"),
    emptyDelay: readEstimateNumber("sim-empty-delay"),
    printBags: isExport ? readEstimateNumber("sim-print-bags") : 0,
    baseRate: Number(grade.getAttribute(screen === "15" ? "data-s15" : "data-s14")),
    isWashed: grade.getAttribute("data-washed") === "true",
    rework: document.getElementById("sim-rework").value,
    grainpro: isExport && document.getElementById("sim-grainpro").checked,
    certified: isExport && document.getElementById("sim-certified").checked,
    blending: isExport && document.getElementById("sim-blending").checked,
    container: isExport ? document.getElementById("sim-container").value : "NONE",
    taxRate: taxField === "" ? null : Number(taxField),
    labor: selectedLaborJobs
  };
  const result = CoffeeCalculator.calculateEstimate(input);
  const errors = document.getElementById("sim-errors");
  errors.classList.toggle("hidden", !result.errors.length);
  errors.replaceChildren();
  result.errors.forEach(error => {
    const row = document.createElement("p");
    row.textContent = error;
    errors.append(row);
  });

  const mass = document.getElementById("sim-mass-balance");
  mass.replaceChildren();
  const accounted = input.cleanMT + input.rejectMT + input.leftoverMT + input.parchmentMT + input.dustMT;
  mass.textContent = isExport
    ? `Received: ${input.rawMT} MT. Clean: ${input.cleanMT}, reject: ${input.rejectMT}, leftover: ${input.leftoverMT}, parchment: ${input.parchmentMT}, dust/loss: ${input.dustMT} MT. Accounted total: ${accounted.toFixed(2)} MT.`
    : `Storage-only: ${input.rawMT} MT in ${input.rawBags} bags; no processing yield is calculated.`;
  const notices = document.getElementById("sim-notices");
  notices.replaceChildren();
  [...result.pending, ...result.warnings].forEach(message => {
    const p = document.createElement("p");
    p.className = "rounded-lg bg-amber-50 p-2";
    p.textContent = message;
    notices.append(p);
  });

  const lineContainer = document.getElementById("sim-invoice-lines");
  const totalContainer = document.getElementById("sim-invoice-totals");
  lineContainer.replaceChildren();
  totalContainer.replaceChildren();
  if (result.errors.length) {
    totalContainer.textContent = "Fix the inputs above before using this estimate.";
    return;
  }
  result.lines.forEach(line => {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-3 border-b border-slate-100 py-2";
    const label = document.createElement("span");
    label.textContent = `${line.label} (Art. ${line.clause})`;
    const amount = document.createElement("strong");
    amount.className = "whitespace-nowrap";
    amount.textContent = `${fmt(line.amount)} ETB`;
    row.append(label, amount);
    lineContainer.append(row);
  });
  const totals = [
    ["Pre-tax illustrative subtotal", result.subtotal],
    ...(result.tax === null ? [] : [["Illustrative tax", result.tax], ["Illustrative total", result.total]])
  ];
  totals.forEach(([label, amount]) => {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-2 py-1 font-semibold";
    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("span");
    right.className = "whitespace-nowrap";
    right.textContent = `${fmt(amount)} ETB`;
    row.append(left, right);
    totalContainer.append(row);
  });
}
