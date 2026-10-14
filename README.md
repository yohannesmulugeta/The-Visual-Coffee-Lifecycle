# Hayked coffee lifecycle discussion demo

This static site explains the flow and listed service tariffs in Coffee Processing and Warehousing Contract #001/2018. It is a **discussion demo**, not a transactional ERP or a payable invoice system.

## Open locally

Open `index.html` in a browser. It has no build step or database. Styling and fonts currently load from Tailwind CDN and Google Fonts, so they need a network connection.

## What it demonstrates

- Branching client journeys for export preparation, storage-only, quality rework, and raw-coffee ownership transfer.
- The contract's grade, special-service, storage, bag printing, and 41 labor tariffs.
- A draft estimate for ordinary washed/unwashed export preparation or storage-only, with explicit quantity validation, optional actual labor, a separate rework line, and an optional illustrative tax input.
- Visible notices for the unresolved calendar-month convention, modifier quantity basis, and sub-50-bag printing.

The estimate uses 90 days as a **stated illustration** of a three-month storage bracket. It uses a single bag count throughout each entered period and therefore does not handle dated partial processing or dispatch. Empty-bag rent is illustrated only through day 160 because the later rate needs agreement. It does not calculate grade-improvement rent, transfers, generator fuel, or all special processing services. Those tariffs remain visible in the catalog and require reviewed job records before invoicing.

## Verify

From this directory, run `node --test test/calculator.test.cjs`. Also review the flow and estimate in a browser at desktop and mobile widths before publishing. The static page has no type-check, lint, or production build command.

## Before any payable invoice

Hayked operations and finance must confirm the unresolved contract questions: unclear Article 13.1.13 label, the printed grade-4/grade-5 prices, the exact storage month/date rules, minimum charge and add-on bases, transfer liability, grade-improvement and late empty-bag rates, labor overlap, tax treatment, rounding, and actual signed documents. A real ERP would additionally need durable stock movements, authorization, audit history, payment reconciliation, and safe posting rules.

See [CONTRACT_DECISIONS.md](CONTRACT_DECISIONS.md) for the review list and the demo's current handling of each item.
