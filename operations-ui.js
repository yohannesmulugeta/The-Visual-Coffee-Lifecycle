let operationsCursor = 0;
const operationsStoreKey = "hayked-coffee-discussion-demo-v1";

function currentOperationsScenario() {
  return CoffeeOperations.scenarios.find(item => item.id === document.getElementById("ops-scenario").value);
}

function saveOperationsProgress() {
  try {
    localStorage.setItem(operationsStoreKey, JSON.stringify({ scenario: currentOperationsScenario().id, cursor: operationsCursor }));
  } catch (_) {
    // The walkthrough still works when browser storage is disabled.
  }
}

function renderOperations() {
  const scenario = currentOperationsScenario();
  const state = CoffeeOperations.replay(scenario.events, operationsCursor);
  const next = scenario.events[operationsCursor];
  document.getElementById("ops-note").textContent = scenario.note;
  document.getElementById("ops-next").textContent = state.error
    ? `Simulation stopped: ${state.error}`
    : next ? `Next: ${next.date} · ${next.detail} Evidence: ${next.evidence}.`
      : "Example complete. Reset or choose another journey to explore its decisions.";
  document.getElementById("ops-next-button").disabled = !!state.error || !next;

  const stockList = document.getElementById("ops-stock");
  stockList.replaceChildren();
  const owners = Object.keys(state.stock);
  if (!owners.length) stockList.textContent = "No receipt has been recorded in this example yet.";
  owners.forEach(owner => {
    const card = document.createElement("div");
    card.className = "rounded-lg border border-slate-200 bg-slate-50 p-3";
    const title = document.createElement("strong");
    title.textContent = owner;
    const balance = document.createElement("p");
    balance.className = "mt-1";
    balance.textContent = `Raw ${state.stock[owner].raw} · Clean ${state.stock[owner].clean} · Reject ${state.stock[owner].reject} bags`;
    card.append(title, balance);
    stockList.append(card);
  });

  const available = state.stock[scenario.owner]?.[scenario.releaseKind] || 0;
  const reasons = CoffeeOperations.releaseReasons(state, scenario.owner, scenario.releaseKind, Math.max(1, available));
  const release = document.getElementById("ops-release");
  release.className = `mt-2 rounded-lg p-3 text-sm ${reasons.length ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`;
  release.textContent = reasons.length
    ? `Hold ${scenario.owner}'s ${scenario.releaseKind} coffee: ${reasons.join(" ")}`
    : `Ready for a simulated release of up to ${available} ${scenario.releaseKind} bags for ${scenario.owner}. A real release still requires verified signed records.`;

  const history = document.getElementById("ops-history");
  history.replaceChildren();
  if (!state.history.length) history.textContent = "No example events recorded yet.";
  state.history.forEach(event => {
    const item = document.createElement("li");
    item.className = "rounded-lg border border-slate-200 p-3";
    const title = document.createElement("strong");
    title.textContent = `${event.date} · ${event.kind.replaceAll("_", " ")}`;
    const detail = document.createElement("p");
    detail.className = "mt-1";
    detail.textContent = event.detail;
    const evidence = document.createElement("p");
    evidence.className = "mt-1 text-xs text-slate-500";
    evidence.textContent = `Example evidence: ${event.evidence}`;
    item.append(title, detail, evidence);
    history.append(item);
  });
  return state;
}

function changeOperationsScenario() {
  operationsCursor = 0;
  const scenario = currentOperationsScenario();
  document.getElementById("journey-route").value = scenario.id;
  changeJourney();
  saveOperationsProgress();
  renderOperations();
}

function advanceOperations() {
  const scenario = currentOperationsScenario();
  if (operationsCursor >= scenario.events.length) return;
  const candidate = CoffeeOperations.replay(scenario.events, operationsCursor + 1);
  if (candidate.error) {
    document.getElementById("ops-next").textContent = `Simulation stopped: ${candidate.error}`;
    return;
  }
  operationsCursor += 1;
  saveOperationsProgress();
  renderOperations();
}

function completeOperations() {
  const scenario = currentOperationsScenario();
  const candidate = CoffeeOperations.replay(scenario.events);
  if (candidate.error) {
    document.getElementById("ops-next").textContent = `Simulation stopped: ${candidate.error}`;
    return;
  }
  operationsCursor = scenario.events.length;
  saveOperationsProgress();
  renderOperations();
}

function resetOperations() {
  operationsCursor = 0;
  saveOperationsProgress();
  renderOperations();
}

function initializeOperations() {
  const select = document.getElementById("ops-scenario");
  CoffeeOperations.scenarios.forEach(scenario => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.title;
    select.append(option);
  });
  try {
    const stored = JSON.parse(localStorage.getItem(operationsStoreKey) || "null");
    const scenario = CoffeeOperations.scenarios.find(item => item.id === stored?.scenario);
    if (scenario && Number.isInteger(stored.cursor) && stored.cursor >= 0 && stored.cursor <= scenario.events.length) {
      select.value = scenario.id;
      operationsCursor = stored.cursor;
    }
  } catch (_) {
    // Invalid or unavailable browser storage begins a fresh fictional scenario.
  }
  renderOperations();
}
