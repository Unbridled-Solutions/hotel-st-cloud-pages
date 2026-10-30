# Upgrade: Project Builder 2.8.0 → 2.9.0

**Date:** 2026-10-30. **Update package:** `fm-project-builder-update-2.8.0-to-2.9.0.zip`. It holds only the files listed below.

1. Start from 2.8.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

The rules are unchanged: beside the existing tool, flag `fm_phase1`, legacy data read-only, styles scoped to `.fm-p1`.

## What changed, in the owner's words
- **"A status for projects we'd delete":** **Test / Void**, for Full access only. The project leaves every total, list and report, and can be restored. It is separate from voiding a signed contract.
- **"The contract packet doesn't pull in all our contract language":** every packet now prints the full **Customer Sales Agreement** from the signed Willow Creek and Penrose packets. The pages follow the signed packets' order. The wording is updated for the new tool, and **the owner approved it on Oct 30**.
- **"Deposit in the past with no way to fix it":** the deposit is due on signing, so an old date never blocks. Contract details and due dates can be edited on the Ready card. Every problem has a Fix link, and the "!" is gone.
- **"Acknowledge and send without elevations complete":** tick "Send without complete elevations". The packet then marks the drawings as preliminary.
- **"Adjust the payment schedule because stuff changes":** **Adjust schedule** on the Invoices tab moves dates, moves money between invoices, and splits or removes unpaid invoices.
- **"Tweak markup, G&A, labor… in a change order, and markup at a SKU level":** each change order can have its own pricing, plus a printable change order for the buyer to sign.
- **Willow Creek change order 1** is applied from the executed PDFs: 14 lines, its own pricing, $8,740.71.

## Files

| File | Status | Why |
|---|---|---|
| `src/fm-phase2-agreement.js` | **new** | `window.FMAgreement`: the Customer Sales Agreement wording. `SIGNED` holds the signed packets' text, `GOODS` the owner's Goods clause, and `CHANGES` every difference (all approved). Loads before `fm-phase1-docs.js`. |
| `src/fm-phase2-schedule.js` | **new** | `window.FMSchedule`: checks and applies payment schedule changes after signing (`draftFrom`, `check`, `apply`, `split`). |
| `tests/schedule.test.js` | **new** | 6 tests |
| `docs/contract-language-review.md` | **new** | Old vs new wording, clause by clause. Approved by the owner. |
| `src/fm-phase1-docs.js` | changed (1.3.0) | `renderAgreementDoc`, `renderBuilderOrderDoc` and `renderChangeOrderDoc` are new. The packet order is now builder order, agreement, schedule, invoices, quotes, elevations; the summary page is gone. Schedule rows have their one-line descriptions. There is a preliminary-elevations flag and a "Schedule revised" field. |
| `src/fm-phase1-print.css` | changed | Agreement sections, signature blocks, the preliminary flag |
| `src/fm-phase2-contract.js` | changed (0.5.0) | Readiness: the deposit is due on signing, so its stored date never blocks. Later invoices raise `duePast` and `dueOrder`. `depositPast` and `depositLate` are removed. Dates print as "Oct 29, 2026". |
| `src/fm-phase2-changeorder.js` | changed (0.3.0) | `priceChange` takes `settings.labor` and returns `lines`, `summary`, `taxCents` and `costCents` |
| `src/fm-phase2-store.js` | changed (0.2.0) | `jobs()` and `books()` leave out Test / Void jobs. `jobs({ all: true })`, `markTestVoid` and `restore` are new. The seed applies Willow Creek change order 1 (lines, pricing, tax, cost, two documents). |
| `src/fm-phase2-books.js`, `src/fm-phase2-reports.js` | changed | Every function drops `testVoid` jobs |
| `preview/willow-creek-full-order.js` | changed | `changeOrders[0]`: Willow Creek change order 1 from the owner's PDFs |
| `preview/phase2-flows.js` | changed | Ready card details, schedule and Fix links. Elevations checkbox. Change order Price step with its own settings and per-line markup. Open change order. Job codes count Test / Void jobs. |
| `preview/phase2-elevations.js` | changed | `contractAck`, `contractBlocker`, `prelim` (completeness against the quote) |
| `preview/phase2-app.js` | changed | Test / Void (button, banner, filter, pill). Adjust schedule panel. `packetOpts(j)` for the packet. Fix and reset links handled. |
| `phase2.html`, `preview.html` | changed | Load the two new modules, plus CSS for the new pieces |
| `tests/contract.test.js`, `tests/changeorder.test.js`, `tests/docs.test.js`, `tests/store.test.js` | changed | Updated and new tests (see Check) |
| `HANDOFF.md` | changed | "Current state" rewritten; §29 is new |
| `HERMES-LAUNCH.md` | changed | 2.9.0, test table, screens, decisions, the two new PDFs |
| `MANIFEST.json` | changed | 2.9.0, file list and checksums |
| `UPGRADE-2.8.0-to-2.9.0.md` | **new** | This note |

## New owner decisions (Oct 30)
- **Test / Void** is **Full access only**. It is separate from voiding a signed contract.
- **Contract wording approved** as in `docs/contract-language-review.md`. **Goods** no longer lists "no design professional services, no field measuring": those are offered as needed and neither assumed included nor excluded. The rest of that list still says plainly what is not included.
- **Moving money between invoices after signing needs Full access.** Changes to dates only can be saved by anyone. Who asked and why are required either way.
- A contract may go out with **incomplete elevations** once someone ticks the box. The packet marks them as preliminary.

## Data and server changes
- **Jobs gain these fields:**
  - `testVoid {reason, by, on, paidCents}`: **every list, total, report and export query must leave these jobs out.** Job-code numbering must still count them.
  - `elevAck {by, on}`
  - `scheduleRevisions[] {on, by, askedBy, askedName, reason, changes[], moved}`
- **Ready card edits** change `customer`, `projectName`, `contacts.signer`, `contacts.buyerEmail`, `installAddr` and `installAddress`, `deliveryDate`, and invoice `dueDate`, each logged.
- **Change orders gain** `pricing {markupPct, discountPctOfCost, gaPct, taxPct, labor[]}`, `differsFromJob[]`, and `priced {lines[], summary{}}`. Tax and cost come from `priced`. Legacy Willow Creek change order 1 has `priced.printed: true`, with numbers as printed on the PDF. Its cost, $5,388.80, is worked back from the discount (`costIsEstimate`).
- **Schedule changes** can add invoices (new ids continue `-invN`) and remove unpaid ones. Change-order invoices are never touched. Write each change as one transaction, and check Full access on the server when money moves.
- **Contract packet:** call `renderPacket` with the options built in `packetOpts(j)` (`preview/phase2-app.js`).
- **Two new originals** for file storage, or the preview's `files/` folder. They are sent with this update, and their checksums are in `preview/willow-creek-full-order.js` → `changeOrders[0].documents`:
  - `FM-2609-276 · Willow Creek Estates.pdf`: 2 pages, the change order with lines
  - `COR FM-2609-276 · Willow Creek Estates.pdf`: 1 page, its invoice
- **Books:** Willow Creek's tax and cost now include change order 1 ($620.80 tax, $5,388.80 cost). P&L gross profit for the job is now $19,426.73. Before, the change order counted as revenue with no cost.

## Check
1. All tests pass: 17 files, **189 tests**. `schedule` 6 is new; `contract` 22, `changeorder` 15, `docs` 10 and `store` 8 were updated. See `HERMES-LAUNCH.md` §1.
2. In `phase2.html` (click **Reset sample data** first):
   - **Sample quote, Contract tab:** Fix on "Add the signer's email" jumps to the email box. Fill in the address, pick the Fremont Makers signer and tick "Send without complete elevations". The card shows "✓ Everything checks out". The packet shows "Preliminary drawings: 9 of 12 quoted cabinets shown…".
   - **Sample quote:** Mark Test / Void with a reason. Open quotes on the Dashboard drops to $0.00 and the project shows only under "Test / void · 1". Restore brings it back.
   - **Willow Creek, Change orders:** Open change order shows 14 lines, discount 5% −$269.44, assembly $102.50, G&A $159.21, tax $620.80, **$8,740.71**.
   - **Penrose, new change order:** add the #1000173203 PDF and, on Price, set the discount to 0, 2 h assembly, and VDC42RS markup 50. This change: **$2,569.65**.
   - **Penrose, Invoices:** Adjust schedule, split invoice 3, name the new invoice, date it Nov 30, add a reason and save. Two invoices of $1,121.87, and "Invoice 3 · 10.2%".
   - **Willow Creek, contract packet:** the Builder order page, then the Customer Sales Agreement with all seven sections, then the schedule.
