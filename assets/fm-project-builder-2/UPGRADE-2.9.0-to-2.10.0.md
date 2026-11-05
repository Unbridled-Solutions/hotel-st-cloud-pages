# Upgrade: Project Builder 2.9.0 → 2.10.0

**Date:** 2026-11-05. **Update package:** `fm-project-builder-update-2.9.0-to-2.10.0.zip`, which holds only the files listed below.

1. Start from 2.9.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

## Read first: where it lives (owner, Nov 5)
- **The new Project Builder goes at `tools.fremontmakers.com/projectbuilder`.**
- **The existing tool stays live at `tools.fremontmakers.com/quote`, exactly as it is.** Don't override, redirect or change it. The same goes for `/contract`, `/elevation` and `/sales-agreement`.
- From the switch-over day the owner picks, the team treats `/quote` as "do not use": no new entries, but still open for looking things up.
- On that day, take a final read-only copy of its data and import it.
- `HERMES-LAUNCH.md` §0 has the steps, and two security fixes for the old tool that are server-only:
  - put its open data address behind sign-in
  - treat its page passwords as known

The rules are otherwise unchanged: flag `fm_phase1`, legacy data read-only, styles scoped to `.fm-p1`.

## What changed, in the owner's words
- **"Review the live tool in detail for discrepancies":** the live tool was reviewed screen by screen and in its code and data, in a copy with saving turned off. 2.10.0 fixes what blocks launch:
  - **It reads the real data.** The old tool keeps everything in one cloud bundle, not the guessed shape in HANDOFF §4. `FMLegacy.read` turns it into the jobs this package uses. On the Nov 5 copy it gives the same jobs, balances and gross profit the package was built on.
  - **Company P&L and Balance sheet carried over.** The old tool had the company's monthly expenses through net income, and a Balance Sheet. Both are now in Company books, with the owner's numbers, editable by Full access only.
  - **Data brought up to Nov 5:**
    - Penrose invoice 3 was paid Nov 4 (check 2980).
    - Willow Creek change order 1's invoice was paid Oct 28 (check 5568).
    - That change order's real cost is $5,388.73.
- **Nov 4 work, released here (HANDOFF §30):**
  - gross profit drill-down, with cabinet cost less the manufacturer's discount
  - P&L revenue broken out
  - the Penrose refund ($62.91 absorbed)
  - Elevation / Layout / 3D views
  - sketching elevations without SKUs

## Files

| File | Status | Why |
|---|---|---|
| `src/fm-phase2-legacy.js` | **new** | `window.FMLegacy` (1.0.0): reads the old tool's cloud bundle into jobs, details, company books and a skipped list (§31) |
| `src/fm-phase2-company.js` | **new** | `window.FMCompany` (1.0.0): Company P&L by month and the Balance Sheet, with edits that check Full access and are logged (§31). Loads after `fm-phase2-books.js`. |
| `preview/phase2-company.js` | **new** | The Company P&L and Balance sheet screens (`#/books/company`, `#/books/balance`) |
| `preview/company-books.js` | **new** | The owner's P&L months and Balance Sheet from the old tool, in cents (what `FMLegacy.read(...).company` gives) |
| `tests/legacy.test.js` | **new** | 10 tests |
| `tests/company.test.js` | **new** | 8 tests |
| `tests/fixtures/legacy-bundle-2026-11-05.js` | **new** | The old tool's data as read Nov 5, trimmed (test fixture only; don't serve it) |
| `src/fm-phase1-ledger.js` | changed | `normalizeLegacyProject` reads change orders kept inside a job (`changeOrders[]`) and links each to its invoice |
| `src/fm-phase2-store.js` | changed | Company books (`company()`, `saveCompany`, `seed({ company })`). `upgrade()` fills in later payments and replaces an estimated change order cost. `charges()` (§30). |
| `src/fm-phase2-books.js`, `src/fm-phase2-reports.js` | changed | §30: net cabinet cost, the charge breakdown, CSV columns |
| `src/fm-phase2-elevations.js`, `src/fm-phase1-docs.js` | changed | §30: standard and custom sizes, six colors, "Layout" pages |
| `preview/phase2-app.js` | changed | Sidebar: Job P&L, Company P&L, Job balances, Balance sheet. P&L revenue breakdown (§30). Company books wired in. |
| `preview/phase2-flows.js`, `preview/phase2-elevations.js` | changed | §30: view toggles, sketch mode, Add SKUs |
| `preview/phase2-reports.js` | changed | §30 CSV columns. The note points to the Company P&L. |
| `preview/sample-data.js` | changed | Today is Nov 5. Penrose invoice 3 and the Willow Creek change order invoice are paid. |
| `preview/braddy-penrose-order.js` | changed | Supplier refund $1,589.79 (§30). Invoice 3 paid Nov 4. |
| `preview/willow-creek-full-order.js` | changed | Change order 1 lines carry `unitCost`. Cost $5,388.73, no longer an estimate. |
| `phase2.html` | changed | Loads the new modules and adds CSS for the company books and §30 |
| `tests/store.test.js`, `ledger`, `activity`, `docs`, `schedule`, `books`, `changeorder`, `elevations` | changed | Updated for Nov 5. Open-invoice scenarios use an "as of Oct 27" copy. |
| `HANDOFF.md` | changed | "Current state" rewritten. §0 rule 2 now gives `/projectbuilder`. §4 is marked superseded. §31 is new. |
| `HERMES-LAUNCH.md` | changed | §0 covers the address, do-not-use and security fixes. Real-data import, new test table, expected numbers. |
| `MANIFEST.json` | changed | 2.10.0, file list and checksums |
| `UPGRADE-2.9.0-to-2.10.0.md` | **new** | This note |

## New owner decisions
- **Nov 5:**
  - The new tool lives at `/projectbuilder`.
  - `/quote` stays live and unchanged, and becomes do-not-use for team operations.
  - The Company P&L and Balance Sheet come over.
- **Nov 4:**
  - Cabinet cost is the supplier's quoted cost less the manufacturer's discount.
  - Assembly labor and G&A count fully as gross profit.
  - Penrose change order 1: the shop absorbed $62.91 after the supplier refund.

## Data and server changes
- **Import from the old tool:**
  1. `GET /api/planner/bundle?ns=fm-quotes` returns `{ success, data }`.
  2. Run `FMLegacy.read(data)`.
  3. Then `FMStore.seed({ sample: { today, legacyProjects }, willow, braddy, company: FMCompany.fromLegacy(read.company) })`.
  4. Send the owner the reconciliation report and the `skipped` list.
  The import only reads; it's safe to repeat.
- **Company books:**
  - store `company { months, standard, balance, log }`
  - every write checks Full access and is logged with the user and time
- **Jobs:** store `charges.parts` and recompute it whenever a quote is priced or repriced (§30). Quotes may have no lines while `elevations.sketch` is set (§30).
- **Old tool, server only:** require sign-in for `/quote` and `/api/planner/bundle`. Don't change its files.

## Check
1. All tests pass: **19 files, 211 tests**.
   - New: `legacy` 10 and `company` 8.
   - Changed: `store` 11, `elevations` 21.
   - Updated for Nov 5: `ledger`, `activity`, `docs`, `schedule`.
   - See `HERMES-LAUNCH.md` §1.
2. In `phase2.html`, click **Reset sample data** first, then check:
   - **Company books → Company P&L:** November 2026 shows "estimate", operating expenses **$21,996.68** and net income **−$24,111.82**. **Quarter 2026-Q3:** September net income is **−$13,475.20**. Under **Edit numbers**, changing October's rent to 2,300 marks October entered and adds a line to Recent changes.
   - **Company books → Balance sheet:** total assets **$5,407.72**, "Off by $100,000.00", and the note "Customer invoices not yet paid, from the jobs: $36,783.01."
   - **Job P&L, year to date:** gross profit **$30,558.34** (35.7%), with Willow Creek at $25,747.54 and Penrose at $4,810.80.
   - **Penrose → Invoices:** all three paid; invoice 3 shows check 2980 on Nov 4.
   - **Willow Creek → Invoices:** change order 1 invoice paid Oct 28, check 5568. Invoice 2, $36,783.01, is due Nov 20.
   - **Elevations (a job):** the Elevation / Layout / 3D toggles. **New project → "No, sketch first"** opens the sketch panel.
