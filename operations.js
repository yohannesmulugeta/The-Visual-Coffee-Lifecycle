(function (root, factory) {
  const operations = factory();
  if (typeof module === "object" && module.exports) module.exports = operations;
  root.CoffeeOperations = operations;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const scenarioList = [
    {
      id: "EXPORT", title: "Export lot with two partial releases", owner: "Example Client A", releaseKind: "clean",
      note: "Fictional dates and documents. The remaining reject bags stay on the stock balance.",
      events: [
        { id: "E1", date: "2026-01-02", kind: "RECEIPT", owner: "Example Client A", bags: 300, evidence: "Signed coffee receipt and movement document", detail: "Receive 300 raw bags." },
        { id: "E2", date: "2026-01-10", kind: "PROCESS", owner: "Example Client A", rawBags: 300, cleanBags: 325, rejectBags: 12, evidence: "Approved job and signed output receipts", detail: "Process raw lot; record clean and reject outputs separately." },
        { id: "E3", date: "2026-01-12", kind: "QUALITY", owner: "Example Client A", result: "PASS", evidence: "Quality result", detail: "Accept the processed lot." },
        { id: "E4", date: "2026-01-14", kind: "PAYMENT", owner: "Example Client A", evidence: "Illustrative finance clearance", detail: "Mark the example charges paid." },
        { id: "E5", date: "2026-01-14", kind: "RELEASE_DOC", owner: "Example Client A", evidence: "Official loading request", detail: "Record the client's release request." },
        { id: "E6", date: "2026-01-15", kind: "DISPATCH", owner: "Example Client A", stock: "clean", bags: 200, evidence: "Signed goods issue", detail: "Release the first 200 clean bags." },
        { id: "E7", date: "2026-01-16", kind: "DISPATCH", owner: "Example Client A", stock: "clean", bags: 125, evidence: "Signed goods issue", detail: "Release the remaining 125 clean bags." }
      ]
    },
    {
      id: "STORAGE", title: "Storage-only lot with partial release", owner: "Example Client A", releaseKind: "raw",
      note: "The event trail shows quantities; the draft estimate uses one fixed bag count and cannot bill these dated partial balances.",
      events: [
        { id: "S1", date: "2026-02-02", kind: "RECEIPT", owner: "Example Client A", bags: 300, evidence: "Signed coffee receipt", detail: "Receive 300 raw bags for storage only." },
        { id: "S2", date: "2026-02-06", kind: "PAYMENT", owner: "Example Client A", evidence: "Illustrative finance clearance", detail: "Mark the example charges paid." },
        { id: "S3", date: "2026-02-06", kind: "RELEASE_DOC", owner: "Example Client A", evidence: "Official release request", detail: "Record the client's release request." },
        { id: "S4", date: "2026-02-07", kind: "DISPATCH", owner: "Example Client A", stock: "raw", bags: 120, evidence: "Signed goods issue", detail: "Release 120 raw bags." },
        { id: "S5", date: "2026-02-12", kind: "DISPATCH", owner: "Example Client A", stock: "raw", bags: 180, evidence: "Signed goods issue", detail: "Release the remaining 180 raw bags." }
      ]
    },
    {
      id: "REWORK", title: "Quality failure and separate rerun", owner: "Example Client A", releaseKind: "clean",
      note: "The rerun is a separate job; its 75% illustrative price appears in the draft estimate, subject to the reviewed quantity basis.",
      events: [
        { id: "Q1", date: "2026-03-02", kind: "RECEIPT", owner: "Example Client A", bags: 300, evidence: "Signed coffee receipt", detail: "Receive 300 raw bags." },
        { id: "Q2", date: "2026-03-06", kind: "PROCESS", owner: "Example Client A", rawBags: 300, cleanBags: 325, rejectBags: 12, evidence: "Approved job and output receipts", detail: "Complete the original preparation job." },
        { id: "Q3", date: "2026-03-08", kind: "QUALITY", owner: "Example Client A", result: "FAIL", evidence: "Quality failure result", detail: "Record the failed inspection; release remains blocked." },
        { id: "Q4", date: "2026-03-09", kind: "REWORK", owner: "Example Client A", evidence: "Approved second job", detail: "Perform a separate quality-failure rerun at 75% of the applicable grade rate." },
        { id: "Q5", date: "2026-03-11", kind: "QUALITY", owner: "Example Client A", result: "PASS", evidence: "Accepted quality result", detail: "Accept the rerun." },
        { id: "Q6", date: "2026-03-12", kind: "PAYMENT", owner: "Example Client A", evidence: "Illustrative finance clearance", detail: "Mark the example charges paid." },
        { id: "Q7", date: "2026-03-12", kind: "RELEASE_DOC", owner: "Example Client A", evidence: "Official loading request", detail: "Record the client's release request." },
        { id: "Q8", date: "2026-03-13", kind: "DISPATCH", owner: "Example Client A", stock: "clean", bags: 325, evidence: "Signed goods issue", detail: "Release the accepted clean lot." }
      ]
    },
    {
      id: "TRANSFER", title: "Raw-coffee ownership transfer", owner: "Example Client B", releaseKind: "raw",
      note: "Article 15.4 billing is unresolved. The incoming owner's bags are visible, but release stays on hold for finance review.",
      events: [
        { id: "T1", date: "2026-04-02", kind: "RECEIPT", owner: "Example Client A", bags: 300, evidence: "Signed coffee receipt", detail: "Receive 300 raw bags for Client A." },
        { id: "T2", date: "2026-04-20", kind: "TRANSFER", owner: "Example Client A", toOwner: "Example Client B", bags: 120, evidence: "Written transfer authority and joint stock count", detail: "Transfer 120 raw bags from Client A to Client B; request Article 15.4 finance review." }
      ]
    }
  ];

  const newState = () => ({ stock: {}, quality: {}, paid: {}, releaseDocs: {}, transferReview: {}, history: [], error: null });
  const balance = (state, owner) => state.stock[owner] || (state.stock[owner] = { raw: 0, clean: 0, reject: 0 });
  const positiveWhole = value => Number.isInteger(value) && value > 0;

  function releaseReasons(state, owner, stock, bags) {
    const reasons = [];
    if (!positiveWhole(bags)) reasons.push("Enter a positive whole bag count.");
    if (!Number.isInteger(balance(state, owner)[stock]) || balance(state, owner)[stock] < bags) reasons.push("Insufficient owner stock for this release.");
    if (!state.paid[owner]) reasons.push("Finance clearance is missing.");
    if (!state.releaseDocs[owner]) reasons.push("Official release document is missing.");
    if (stock === "clean" && state.quality[owner] !== "PASS") reasons.push("Accepted quality result is missing.");
    if (stock === "reject") reasons.push("Reject release needs route-specific authority document review.");
    if (state.transferReview[owner]) reasons.push("Article 15.4 transfer billing review is pending.");
    return reasons;
  }

  function replay(events, count = events.length) {
    const state = newState();
    const ids = new Set();
    let previousDate = "";
    for (const event of events.slice(0, count)) {
      const stock = balance(state, event.owner);
      let error = null;
      if (!event.id || ids.has(event.id)) error = "Duplicate or missing event ID.";
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || Number.isNaN(Date.parse(`${event.date}T00:00:00Z`)) || new Date(`${event.date}T00:00:00Z`).toISOString().slice(0, 10) !== event.date || event.date < previousDate) error = "Event dates must be ordered and valid ISO dates.";
      else if (!event.evidence) error = "Each example event needs a document or evidence label.";
      else if (event.kind === "RECEIPT") {
        if (!positiveWhole(event.bags)) error = "Receipt bags must be positive whole units.";
        else stock.raw += event.bags;
      } else if (event.kind === "PROCESS") {
        if (![event.rawBags, event.cleanBags, event.rejectBags].every(Number.isInteger) || event.rawBags <= 0 || event.cleanBags < 0 || event.rejectBags < 0) error = "Invalid processing bag quantities.";
        else if (stock.raw < event.rawBags) error = "Processing would make raw stock negative.";
        else {
          stock.raw -= event.rawBags;
          stock.clean += event.cleanBags;
          stock.reject += event.rejectBags;
          state.quality[event.owner] = "PENDING";
        }
      } else if (event.kind === "QUALITY") {
        if (stock.clean <= 0 || !["PASS", "FAIL"].includes(event.result)) error = "Quality decision needs a processed lot and valid result.";
        else state.quality[event.owner] = event.result;
      } else if (event.kind === "REWORK") {
        if (state.quality[event.owner] !== "FAIL") error = "A quality-failure rerun needs a failed result.";
        else state.quality[event.owner] = "PENDING";
      } else if (event.kind === "TRANSFER") {
        if (!positiveWhole(event.bags) || !event.toOwner || event.toOwner === event.owner) error = "Invalid transfer request.";
        else if (stock.raw < event.bags) error = "Transfer would make raw stock negative.";
        else {
          stock.raw -= event.bags;
          balance(state, event.toOwner).raw += event.bags;
          state.transferReview[event.toOwner] = true;
        }
      } else if (event.kind === "PAYMENT") state.paid[event.owner] = true;
      else if (event.kind === "RELEASE_DOC") state.releaseDocs[event.owner] = true;
      else if (event.kind === "DISPATCH") {
        if (!["raw", "clean", "reject"].includes(event.stock)) error = "Unknown stock type.";
        else {
          const reasons = releaseReasons(state, event.owner, event.stock, event.bags);
          if (reasons.length) error = reasons.join(" ");
          else stock[event.stock] -= event.bags;
        }
      } else error = "Unknown event type.";
      if (error) { state.error = `${event.id || "Event"}: ${error}`; break; }
      ids.add(event.id);
      previousDate = event.date;
      state.history.push(event);
    }
    return state;
  }

  return { scenarios: scenarioList, replay, releaseReasons };
});
