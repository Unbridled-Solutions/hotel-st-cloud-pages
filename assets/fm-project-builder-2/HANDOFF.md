# Handoff to Hermes: Project Builder Phase 1 + 2

**From:** Fremont Makers (Linds) via Claude · **Date:** 2026-10-30 · **Package version:** 2.9.0

## Current state (2.9.0, Oct 30 2026)

*Rewritten each release, so you don't need the history below. The numbered sections are the detail.*

- **What this is:** a new Project Builder (Phase 1 quote and ledger math, Phase 2 app `phase2.html`) that launches **beside** the existing tool behind the `fm_phase1` flag. **Nothing is live.** Follow `HERMES-LAUNCH.md`.
- **Screens:**
  - **Sidebar:** Projects (All projects, Elevations, Customers, Field measure); Company books (Dashboard, Pipeline, Deposits due, Reconcile, P&L, Balance sheet, Reports & exports); Company (Users).
  - **Job page** with tabs; New Project, change order and contract flows.
- **Pricing:** set per job, never per customer.
  - **Defaults:** 35% markup · 12% discount off cost · 2% G&A · 7.9% tax · 50/50 plan.
  - **Assembly:** hours × rate per home ($20.50/h, hours entered on each job).
  - Custom payment plans are allowed. A change order can use its own pricing (§29).
- **Contracts:**
  - Every packet prints the full **Customer Sales Agreement**, with the wording approved by the owner Oct 30 (`src/fm-phase2-agreement.js`, `docs/contract-language-review.md`).
  - The deposit is due on signing.
  - Contracts can go out with elevations marked preliminary.
  - The schedule can be adjusted after signing (§29).
- **Test / Void:** Full access only. These projects are left out of every total, list and report (§29).
- **Server work still to do (yours):** sign-in and access levels, the shared database, file storage with SHA-256, the supplier PDF import, Dropbox Sign, and field-measure sync (`HERMES-LAUNCH.md` §2).
- **Tests:** 17 files, 189 tests, all passing (`HERMES-LAUNCH.md` §1).
- **Waiting on the owner:**
  - Tayler's email
  - the accountant's answer on sales tax on lump-sum bid pages
  - confirming the field measure defaults (§24)
- **Since 2.8.0:** see `UPGRADE-2.8.0-to-2.9.0.md` and §29.

> **Start here: `HERMES-LAUNCH.md`.** Nothing is live yet (owner, Oct 28): Phase 1 and Phase 2 launch together, beside the existing tool. The launch guide lists the order of work.
>
> **2.0.0 adds the Phase 2 app** (`phase2.html`): sidebar with Projects and Company Books; All projects; a job page with tabs; New Project, change order and contract flows; payments; and six books pages designed fresh (Dashboard, Pipeline, Deposits due, Reconcile, P&L, Balance sheet). New: `src/fm-phase2-store.js`, `src/fm-phase2-books.js` (+12 tests), `preview/phase2-app.js`, `preview/phase2-flows.js`. Documents now show only the "making freedom" logo and leave more room above the initials line. See **§22**.
>
> **1.10.0 lets you open invoices, the contract packet and attached files from a job** (owner request). New `src/fm-phase1-docs.js` (`window.FMDocs`, 8 tests): invoice pages (share of the current total, due, paid with check #, PAID stamp), payment schedule, contract packet (summary, schedule, invoices, quote pages; bid jobs print the lump-sum page), all with the logo top left. Print styles added to `src/fm-phase1-print.css`. The preview has Open buttons and an in-page viewer with Print. See **§21**.

> **1.5.5 also records owner question 4:** factory order and delivery dates are filled in but treated as changeable estimates; nothing is automated off them. See **§8, question 4**. **And question 6:** new quotes use the corrected math (§12).
>
> **1.9.1 puts every Penrose SKU on the Braddy job** (owner request, from the 8:34 PM recording): all 18 lines verified against the quote screen, assembly $40 × 16 h, and the two cabinets Change Order 1 removed. Preview and test data only (`preview/braddy-penrose-order.js`, `preview/app.js`, `preview.html`, `tests/braddy.test.js` now 9); no shipped code changed. See **§14**.
>
> **1.9.0 uses the official Fremont Makers logo** (owner-supplied, recolored to the palette): `assets/brand/` has the F/M mark, the full "ESTD 2019" logo, the name with "making freedom", and the name alone, each in Juniper Shadow (#243A32) and Canyon Cream (#EFE8DA), trimmed to the artwork. Printed documents use the Juniper mark + lockup; screens use `.fmp1-logo` (theme CSS), which turns Juniper on Paper and Cream on Dark by itself. **Phase 1 files changed: `src/fm-phase1-quote.js` (1.4.2), `src/fm-phase1-print.css`, `src/fm-phase1-theme.css`, plus the new `assets/brand/` folder.** Redeploy those and serve `assets/brand/` next to `src/`. See **§20**.
>
> **1.8.1 puts the Fremont Makers logo top left on the Final Job Quote** (owner request): the F/M mark plus "FREMONT MAKERS · making freedom", where only the words were printed before. **This changes two shipped Phase 1 files: `src/fm-phase1-quote.js` (1.4.1, new `logoHTML`) and `src/fm-phase1-print.css`.** Redeploy both; nothing else changes. Every other customer document should use the same `logoHTML`. See **§12, Print layout**.
>
> **1.8.0 adds the Phase 2 change order flow** (from the owner's 8:57 PM recording): a Change orders tab on the job in four steps, whole-order PDFs split by color, adding never lowers a quantity, wrong-color cabinets flagged, priced with the job's own settings, nothing preselected, and **each change order gets its own invoice** (question 2, decided). `src/fm-phase2-changeorder.js` 0.2.0 (14 tests), `docs/change-order-flow.html`. Phase 2 only; no Phase 1 code changed. See **§19**.
>
> **1.7.0: owner decided question 7.** Bid-priced jobs print a lump-sum page (quantities, no prices, one agreed price); Penrose comes over at its signed total with one internal grandfathered line. New: `src/fm-phase2-bid.js`, `tests/bid.test.js` (6). Updates the New Project prototype's "Priced by bid" option. Phase 2 only; no Phase 1 code changed. See **§18**.
>
> **1.6.0 adds the Phase 2 plan for courtesy change orders** (no charge to the customer, cost absorbed by the shop, still on paper). From the owner's 8:34 PM recording of Penrose Change Order 1. New: `src/fm-phase2-changeorder.js`, `tests/changeorder.test.js` (8), and CO 1 in the Penrose data. Corrects §14 finding 2 and narrows owner question 8. Phase 2 only; no Phase 1 code changed. See **§17**.
>
> **1.5.5: supplier quote import lives only in the New Project flow and the change order flow** (owner decision), built once and shared, with no standalone Import Supplier Quote button. Handoff only; no code changed. See **§15, "Importing supplier quotes"**.
>
> **1.5.4: owner decided question 11.** Deposit due on signing, last payment at install, payments between spread evenly (already how `defaultDueDates` works). All owner questions for the contract flow (9–12) are now decided. Handoff only; no code changed. See **§16**.
>
> **1.5.3: who signs for Fremont Makers is picked per job, and question 12 is decided (upgrade the Dropbox Sign plan).** Each job stores `fmSigner` (name, email), chosen from the owner's list of approved signers; the ready check blocks a missing or unapproved signer, and the request, the frame and paper uploads all use that person (`src/fm-phase2-contract.js` 0.4.0-phase2, 22 tests). See **§16**.
>
> **1.5.2: owner decided question 10.** Fremont Makers countersigns every contract, after the buyer. `signatureRequest` now refuses to build a request without the company signer, and a paper upload needs the countersignature confirmed (`src/fm-phase2-contract.js` 0.3.0-phase2, 21 tests). The company signer's name and email are still to come from the owner. See **§16**.
>
> **1.5.1: owner decided question 9.** A job becomes Contracted only when everyone has signed, in Dropbox Sign or by uploading a wet-signed copy. Adds `recordPaperSigned` to `src/fm-phase2-contract.js` (now 0.2.0-phase2), 4 more tests (20), and the paper upload to the prototype. Phase 2 only; no Phase 1 code changed. See **§16, "Signed on paper"**.
>
> **1.5.0 adds the Phase 2 plan for contracts and e-signature with Dropbox Sign (HelloSign)**, including opening Dropbox Sign in a frame inside the job. New: `src/fm-phase2-contract.js`, `tests/contract.test.js` (16), `docs/contract-esign-flow.html`. Phase 2 only: nothing new ships in Phase 1, and no Phase 1 code changed. See **§16** and owner questions 9–12 (9 now decided).
>
> **1.4.1 adds the approved Phase 2 plan for the New Project flow** (five steps on one page, pricing set on each job, never per customer). Documentation and a reference prototype only (`docs/new-project-flow.html`); no Phase 1 code changed, nothing new ships. See **§15**.
>
> **1.4.0 adds the Braddy Builders · Penrose contract (FM-2609-314) and attaches the signed contracts to both jobs.** Every Penrose SKU, invoice and the Oct 9 supplier order are in `preview/braddy-penrose-order.js`; the quote module now handles "no charge" lines and a fixed assembly amount; each job in the preview has a Documents panel. The Penrose quote has a $2,188.06 gap and an unrecorded total change. See **§14**. No ledger, activity or theme logic changed.

> **1.3.1 (after Phase 1 went live) adds the Paper / Dark switch:** a two-button switch at the top of Phase 1 screens. Paper is the Canyon Cream background; Dark is now the Juniper Shadow green (#243A32) instead of near-black. See **§13**. Changed files: `src/fm-phase1-theme.css` (dark colors + switch styles), new `src/fm-phase1-theme-toggle.js`, new `tests/theme.test.js`, and the two preview pages. No ledger, pricing or quote logic changed.

> **1.3.0 fixes the customer-facing Final Job Quote:** every printed number now adds up (unit × qty, lines → Cabinets, summary → total), the manufacturer discount no longer shows a misleading "12%", and each house fits on one letter sheet (the packet drops from 27 sheets to one per page). Signed totals are kept, with any difference of a few cents shown as a rounding line. See **§12**. This replaces the packet guidance in §11.

> **1.2.0 adds the full Willow Creek order:** all 10 houses, 154 SKU lines, with unit cost, markup %, sell, manufacturer discount, assembly (rate × hours), G&A and tax, plus a pricing module that reproduces the signed contract to the cent. See **§11**.

> **1.1.0 adds Phase 1.1: activity timeline and audit trail** (team notes, factory delays, shipped/delivery/customer updates, tracked payment-schedule changes with owner approval, append-only hash-chained log). See **§10**.
> **⚠ Prerequisite for §10:** each employee must sign in, and the log must be stored on a **shared server database**. Today the Project Builder keeps its data in one browser's IndexedDB, where "who did it" can't be trusted and notes wouldn't reach other computers. Confirm with the owner how logins and a shared database will work before building §10. The ledger (§2) has no such dependency and can ship first.
>
> **1.0.1 change:** Invoice shares are measured against the **current contract total** (original + counted change orders), per the owner's decision. See §2, row 4.
**Target:** fremontmakers.com, alongside the existing Project Builder at `tools.fremontmakers.com`

---

## 0. Rules (read before anything else)

The existing Project Builder is in daily use and **must not be overridden, replaced, or changed in behavior.** Phase 1 ships *beside* it.

1. **Additive only.** Do not edit, rename, or delete any existing file, route, component, stylesheet, or data store of the current tool.
2. **Separate route.** Mount Phase 1 at its own path (suggested: `/project-builder/phase1/`). The current tool's URLs keep working exactly as today.
3. **Feature flag, off by default.** Phase 1 is reachable only when `fm_phase1=on` (env var or per-user setting). Turning the flag off must leave the site exactly as it is now.
4. **Read-only on legacy data.** Phase 1 reads the existing project records and never writes to them. The ledger never mutates its inputs; test `adapter never mutates legacy records` enforces this.
5. **Separate storage.** Anything Phase 1 saves (change-order links, stage history) goes in a **new** store named `fm_phase1`, keyed by legacy job code. Never write to the current tool's IndexedDB/database.
6. **Scoped styles.** All CSS is under `.fm-p1` with `--fmp1-*` variables. Don't add global rules, and don't load the theme on current-tool pages.
7. **Nothing is deleted.** A change order that was saved as its own project is *linked* to its parent in `fm_phase1`. The original record stays where it is.
8. **Owner sign-off before the flag is turned on for anyone but Linds.**

If any step below seems to require breaking a rule, stop and ask the owner.

---

## 1. What's in this package

| Path | What it is | Ships? |
|---|---|---|
| `src/fm-phase1-ledger.js` | All Phase 1 rules as pure functions. UMD: `require()` in Node, `window.FMPhase1` in a browser. No DOM, storage, or network. | **Yes** |
| `src/fm-phase1-activity.js` | Phase 1.1 activity timeline and audit trail. Pure functions; depends on the ledger. `window.FMActivity` in a browser. | **Yes** (§10) |
| `src/fm-phase1-theme.css` | Colorado palette, scoped to `.fm-p1`. Light + dark. | **Yes** |
| `tests/ledger.test.js` | 23 tests, no dependencies. `node tests/ledger.test.js` | CI |
| `tests/activity.test.js` | 13 tests. `node tests/activity.test.js` | CI |
| `src/fm-phase1-pricing.js` | House pricing (cost × markup, mfr discount, assembly, G&A, tax), matching the current tool's math. `window.FMPricing`. | **Yes** (§11) |
| `preview/willow-creek-full-order.js` | Every Willow Creek SKU by house, with cost, markup and the contract's printed figures. | Test fixture / import seed |
| `tests/pricing.test.js` | 11 tests. `node tests/pricing.test.js` | CI |
| `src/fm-phase1-theme-toggle.js` | Paper / Dark switch: applies `data-fm-theme` to a `.fm-p1` element and remembers the choice under its own key. `window.FMTheme`. | **Yes** (§13) |
| `tests/theme.test.js` | 5 tests. `node tests/theme.test.js` | CI |
| `src/fm-phase1-quote.js` | Final Job Quote math where every printed number adds up, signed-total reconciliation, printed-math checker, and the customer document renderer. `window.FMQuote`. | **Yes** (§12) |
| `src/fm-phase1-print.css` | One-house-per-letter-sheet layout for the quote document, scoped to `.fm-p1-doc` (plus a global `@page`, so load it on Phase 1 print pages only). | **Yes** (§12) |
| `tests/quote.test.js` | 15 tests, run against all five Willow Creek models. `node tests/quote.test.js` | CI |
| `preview/braddy-penrose-order.js` | Braddy Penrose: every SKU, invoices, supplier order, and the source-document list (with checksums) for both jobs. | Test fixture / import seed (§14) |
| `tests/braddy.test.js` | 9 tests. `node tests/braddy.test.js` | CI |
| `quote-preview.html`, `preview/quote-preview.js` | Quote check demo: each signed house quote's errors next to the corrected letter-size document. | Reference |
| `preview.html`, `preview/app.js` | Working demo of the Phase 1 screens on sample data. Use as the UI reference. | Reference |
| `preview/sample-data.js` | Records copied from the Oct 27 recording, in a **guessed** legacy shape (see §4). | Test fixture |
| `src/fm-phase2-contract.js` | Phase 2 contract logic: ready check, invoice dates and amounts, Dropbox Sign request bodies, frame options, callback events → job status. `window.FMContract`. | Phase 2 (§16), don't ship yet |
| `tests/contract.test.js` | 22 tests. `node tests/contract.test.js` | CI |
| `docs/change-order-flow.html` | Phase 2 change order flow proposal with a working prototype on Penrose. | Reference (§19), don't ship |
| `src/fm-phase2-changeorder.js` | Phase 2 change orders: the flow (merge, color check, whole-order split, pricing with the job's settings, own invoice; §19) and courtesy change orders (real cost, absorbed cost, owner approval, customer page without costs; §17). `window.FMChangeOrder`. | Phase 2 (§17), don't ship yet |
| `tests/changeorder.test.js` | 14 tests. `node tests/changeorder.test.js` | CI |
| `src/fm-phase2-bid.js` | Phase 2 bid pages (lump sum, no prices) and grandfathered signed totals for jobs brought over. `window.FMBid`. | Phase 2 (§18), don't ship yet |
| `tests/bid.test.js` | 6 tests. `node tests/bid.test.js` | CI |
| `docs/contract-esign-flow.html` | Phase 2 contract and e-sign proposal with a working prototype (Dropbox Sign simulated). | Reference (§16), don't ship |
| `docs/new-project-flow.html` | Approved Phase 2 New Project flow: findings, the five steps, and a working prototype that prices Penrose with `src/fm-phase1-quote.js`. Open through a static server from the package root. | Reference (§15), don't ship |
| `assets/brand/fm-{mark,full,tagline,wordmark}-{juniper,cream}.png` | Official Fremont Makers logos, recolored to Juniper Shadow and Canyon Cream, trimmed (§20). | **Yes** (serve next to `src/`) |
| `src/fm-phase1-docs.js` | Customer documents opened from a job: invoice, payment schedule, contract packet, bid quote page. `window.FMDocs`. Depends on the ledger and quote modules. | **Yes** (§21) |
| `tests/docs.test.js` | 9 tests. `node tests/docs.test.js` | CI |
| `HERMES-LAUNCH.md` | The launch guide: what to build, in what order, for Phase 1 + 2. | Read first |
| `phase2.html`, `preview/phase2-app.js`, `preview/phase2-flows.js` | The Phase 2 app preview: the screen reference for everything in §15–§22. | Reference |
| `src/fm-phase2-store.js` | Phase 2 data store: starts from legacy records (read-only), attaches change orders, pluggable storage, logged changes, payments. `window.FMStore`. | **Yes** (§22) |
| `src/fm-phase2-books.js` | Company Books: dashboard, pipeline, deposits due, reconcile, P&L, balance sheet. `window.FMBooks`. | **Yes** (§22) |
| `tests/books.test.js`, `tests/store.test.js` | 6 + 6 tests. | CI |
| `MANIFEST.json` | File list with SHA-256 checksums. | — |

Hosted preview: https://claude.ai/artifact/KuXs8ucoLNU8SkyjimgVcq (private; the owner can share it). It's the same files as `preview.html`. You can also open `preview.html` locally through any static server.

---

## 2. What Phase 1 changes

| # | Problem today | Phase 1 behavior | Function |
|---|---|---|---|
| 1 | Change Order 1 (+$8,740.71) never reaches Willow Creek's contract total. The job still reads $72,147.34. | Signed, invoiced, and paid COs add to the contract. Draft, sent, and void COs don't. | `contractSummary` |
| 2 | The CO is saved as its own **Proposed** project ("Willow Creek Change Order 10/23/26", FM-2610-475), which inflates Proposed and understates Contracted. | Detect COs saved as projects, propose a parent, and let the owner attach them. Once attached, the record is hidden from Phase 1 lists. | `detectLegacyChangeOrders`, `attachChangeOrder` |
| 3 | The packet's model totals are a penny off from the app's (e.g. San Luis $12,171.93 vs $12,171.94). | A model total is the sum of its house totals, and the packet must print the same values. | `modelTotals`, `compareModelTotals` |
| 4 | Invoices labeled "50%" don't match their amounts, and nothing shows what share of the job each invoice covers. | Show every invoice's real share of the **current contract total** (original + signed/invoiced/paid COs). Change-order invoices use the same basis, so a job's shares add up to 100% when billing matches the contract. Flag labels that disagree by more than 0.25 points. Draft, sent, and void COs don't change the basis. | `invoicePercent` |
| 5 | Status is a set of radio buttons, so one click can send a signed job back to Proposed. | Stage moves forward through actions that each need a date (or a reason). Guards block impossible moves. Contracted jobs lock line items. | `availableActions`, `applyAction`, `canEditLineItems` |

Stages: Quote → Contract signed → Deposit paid → Factory order placed → Delivered → Final payment → Complete, plus Lost.
Backward moves are limited to **Void contract** (only when no payments exist) and **Reopen quote** (from Lost). Both require a reason and are logged.

### Expected numbers (sample data, today = 2026-10-27, after attaching the CO)

| Figure | Current tool | Phase 1 |
|---|---|---|
| Contracted | $83,120.45 | **$91,861.16** |
| Proposed | $8,740.71 | **$0.00** |
| Outstanding balance | not shown | **$47,767.46** |
| Overdue | not shown | **$8,740.71** (CO 1 invoice, due Oct 26) |
| Willow Creek current total | $72,147.34 | **$80,888.05** = 72,147.34 + 8,740.71 |
| Willow Creek balance | — | **$45,523.72** |

---

## 3. Integration steps for Hermes

1. **Find the real data shape.** The current tool stores projects in the browser's IndexedDB under `https://tools.fremontmakers.com` (and/or a backend, if one exists). Export a copy from the owner's account. **Read only.**
2. **Write the adapter mapping.** `normalizeLegacyProject()` assumes the field names in §4. Change only the adapter so it reads the real fields. Leave the rest of the ledger as is. Re-run the tests against a fixture built from the real export.
3. **Create the `fm_phase1` store** (IndexedDB DB `fm_phase1`, or a table with the same name on the backend):
   - `co_links` · `{ legacyJobCode, parentJobCode, number, date, reason, status, linkedAt, linkedBy }`
   - `stage_history` · `{ jobCode, from, to, date, reason, by, at }`
   - `stage_current` · `{ jobCode, stage }`. Overrides the stage derived from legacy status. If missing, use the derived stage.
   On load: legacy records → `jobsFromLegacy` → apply `co_links` with `attachChangeOrder` → apply `stage_current`.
4. **Build the screens** at `/project-builder/phase1/`, wrapped in `<div class="fm-p1">`. Match `preview.html` (All projects with KPIs, the CO decision panel, the job header with stage bar and money strip, the CO ledger, invoices with real %, model totals). Use the Project Builder's existing fonts. Phase 1 changes color only.
5. **Packet totals.** Don't edit the current contract-packet template. If the packet needs fixing in Phase 1, render a *new* Phase 1 packet page that calls `modelTotals()`, and ask the owner before linking it anywhere.
6. **Add the flag** `fm_phase1`, default off. Add a link to Phase 1 from the current tool **only** if the owner approves. A link is the only change allowed on current-tool pages.
7. **Test.** `node tests/ledger.test.js` must print `23 passed, 0 failed`, `node tests/activity.test.js` must print `13 passed, 0 failed`, `node tests/pricing.test.js` must print `11 passed, 0 failed`, `node tests/quote.test.js` must print `15 passed, 0 failed`, `node tests/docs.test.js` must print `9 passed, 0 failed`, `node tests/theme.test.js` must print `5 passed, 0 failed`, `node tests/braddy.test.js` must print `9 passed, 0 failed`, `node tests/contract.test.js` (Phase 2 logic) must print `22 passed, 0 failed`, `node tests/changeorder.test.js` (Phase 2 logic) must print `14 passed, 0 failed`, and `node tests/bid.test.js` (Phase 2 logic) must print `6 passed, 0 failed`, `node tests/books.test.js` must print `7 passed, 0 failed`, and `node tests/store.test.js` must print `6 passed, 0 failed`. Then work through §5 on staging.
8. **Reconciliation report before launch.** For every real project, list Current tool total vs Phase 1 total, plus the reason for each difference (attached CO, etc.), and send it to the owner. Every difference must be explained by a Phase 1 fix.
9. **Ship** to staging, get owner sign-off, then turn on the flag for the owner only, and later for the team.

---

## 4. Assumed legacy field names (Hermes: confirm and map)

| Phase 1 reads | Assumed legacy field | Example |
|---|---|---|
| job code | `jobCode` | `FM-2609-276` |
| customer | `customer` | `Willow Creek Estates` |
| project name | `projectName` | `Penrose` |
| status | `status` ∈ Proposed / Contracted / Completed / Lost | `Contracted` |
| contract total | `total` (dollars) | `72147.34` |
| quote / delivery date | `quoteDate`, `deliveryDate` | `2026-10-01` |
| houses | `houses[] { jobCode, name, model, color, lines, total, address }` | 10 rows |
| invoices | `invoices[] { label, due, amount, status: Paid/Due, paidDate, check }` | — |
| change log | `changeLog[] { date, what, amount, reason }` (the "Project summary" table) | `Change order 1` |
| signer / email | `signerName`, `buyerEmail` | `for HelloSign` (placeholder, flagged) |
| CO parent link (if it exists) | `parentJobCode` or `kind: 'change_order'` | — |

Notes on how the adapter derives values:
- The first non-change-order invoice is treated as the **deposit**. Invoices whose label contains "change order" are CO invoices.
- **Contracted** maps to *Deposit paid* when the deposit invoice is paid, otherwise to *Contract signed*. Factory order and delivery aren't recorded today, so they start unset.
- Money becomes integer cents at the boundary (`toCents`). All math is done in cents.

---

## 5. Acceptance checklist

- [ ] Flag off: the site is identical to today (visual diff of current-tool pages shows no changes).
- [ ] Current-tool data is byte-identical before and after using Phase 1 (compare exports).
- [ ] Tests: ledger 23, activity 13, pricing 11, quote 14, theme 5, braddy 8 passed, 0 failed.
- [ ] The Willow Creek CO is detected with **high** confidence, shows the Oct 23 vs Oct 26 date conflict, and the owner picks the date.
- [ ] After attaching: the §2 figures match exactly, and FM-2610-475 is gone from Phase 1 lists but still present in the current tool.
- [ ] Willow Creek invoices show ✓ "add up to the contract total of $80,888.05".
- [ ] Willow Creek invoice shares, measured against the current total $80,888.05: Invoice 1 **43.72%** and Invoice 2 **45.47%** (both flagged "label says 50%"), CO 1 invoice **10.81%**. Shares total **100.00%**.
- [ ] Before the CO is attached, the same invoices show 49.02% / 50.98% / 12.12% (over 100%), which matches the billing warning.
- [ ] Braddy (no COs): 48.88% / 30.67% / 20.45%, each flagged against its 50/30/20 label.
- [ ] Model totals for Willow Creek: Cimarron $14,307.62 · Mesa $14,995.50 · Pinyon $15,583.96 · San Luis $12,171.94 · Sangre $15,088.32 · order $72,147.34.
- [ ] Stage actions: a date is required, Confirm final payment is blocked with "Balance of $45,523.72 is still open", Void is blocked once payments exist, and Reopen requires a reason.
- [ ] Line items can't be edited on contracted or lost jobs. The message points to a change order.
- [ ] Needs-attention list shows: no install address on 10 of 10 houses, a bad buyer email, and Braddy Invoice 1 paid with no check #.
- [ ] Light and dark both pass WCAG AA for text (see §7). Keyboard focus is visible.
- [ ] Phone width (≈400px): no sideways page scroll. Tables scroll inside their own box.

---

## 6. Rollback

Turn off `fm_phase1`. Because Phase 1 never writes to legacy data, rollback needs no data restore. The `fm_phase1` store can stay (it's inert) or be dropped.

---

## 7. Colorado palette

| Token | Hex | Use |
|---|---|---|
| Juniper Shadow | `#243A32` | Primary buttons, headings ink base |
| Canyon Cream | `#EFE8DA` | Page background |
| Pinyon Needle | `#56654A` | Paid / good |
| Gambel Oak | `#A47A4F` | Accent fills, progress, focus ring. **Text uses `#7A5634`.** |
| Arkansas Blue | `#587B83` | Contracted / info fills. **Text uses `#3E5D64`.** |
| Mining Rust | `#8A4F38` | Overdue, warnings, destructive |

Contrast was checked for every text pair, all at or above 4.5:1. For example: ink on cream 12.1, cream on juniper 10.0, oak text 6.0, info text 5.5, rust on alert tint 4.9, faint text 4.9+. Raw Gambel Oak (3.2) and Arkansas Blue (3.8) are **not** used for small text.

---

## 8. Questions for the owner (answers change behavior)

1. ~~Invoice percent basis~~ **Decided 2026-10-27:** use the *current* total, including change orders. Implemented in 1.0.1.
2. ~~Change order billing~~ **Decided 2026-10-27:** each change order gets its own invoice, due on signing; the original invoices don't change. A credit (negative change) is applied to the next unpaid invoice or refunded. See §19.
3. ~~Void / reopen~~ **Decided 2026-10-28:** everyone with **Full access** can void or override a contract and reopen a lost project; every such action is logged with who did it. For now all four users have Full access (§23). A Coordinator level with limits can be added later from the Users page.
4. ~~Factory order and delivery dates~~ **Decided 2026-10-27:** fill them in on every job, but treat them as **estimates that change often**. Rules: both dates are editable at any time by any signed-in employee; each shows "estimated" until someone marks it "confirmed"; a blank date shows "not set yet" and never blocks anything; every change is logged with who and why (activity log, §10: `recordFactoryDelay` already does this for delays). Nothing is automated off these dates yet: no reminders, no overdue warnings, and invoices are never moved automatically (moving one stays a proposed schedule change that needs owner approval, §10). The stage bar uses the events (factory order placed, delivered), not the dates.
5. ~~Reprinting a signed quote~~ **Decided 2026-10-27:** reprints of signed quotes show the corrected math with the visible "Rounding adjustment (to signed total)" line. Don't reprint the old page as it was. See §12.
6. ~~New quotes on the corrected math~~ **Decided 2026-10-27:** yes. Every new quote is priced with `FMQuote.priceHouse` (§12), where every printed number adds up, even if a house total moves a few cents compared with the old method. This covers quotes made in the Phase 2 New Project flow (§15) and the change orders priced from them. Signed quotes keep their signed totals (question 5). The existing tool itself is not changed (§0).
7. ~~Bid-priced jobs~~ **Decided 2026-10-27:** a bid prints as a lump-sum page (cabinets and quantities, no prices, one "Agreed bid price"); the itemized pricing stays internal. Penrose is a one-off: it comes over at its signed total with one internal "grandfathered" line, and isn't reprinted. Going forward the corrected math (question 6) keeps itemized quotes adding up. See §18.
8. **Penrose paperwork (§14, §17):** the two no-charge cabinets turned out to be Change Order 1, a courtesy (no action needed beyond §17). Part (a) decided 2026-10-27: the +$245.57 is part of the agreed (grandfathered) Penrose price; no change order (§18). (b) **Decided 2026-10-29:** Wholesale Cabinets did **not** credit the removed DC324 ×2 and VDC12 ×1; the shop absorbed the full **$1,652.70** as a courtesy because the cabinets were backordered. Recorded as final (not an estimate) in `preview/braddy-penrose-order.js` (`supplierCredit: 0`).
9. ~~When does a job become Contracted~~ **Decided 2026-10-27:** only when everyone has signed, either all signatures in Dropbox Sign or a wet-signed copy uploaded to the job. Issuing or sending a contract never makes it Contracted. See §16.
10. ~~Countersignature~~ **Decided 2026-10-27:** Fremont Makers countersigns every contract, after the buyer. **Who signs is chosen job by job** from the approved signers: Kristy Slaughenhaupt, Tayler Slaughenhaupt, Lindsay Wyss and Tim Slaughenhaupt (owner, Oct 28). See §16 and §23.
11. ~~Deposit dates~~ **Decided 2026-10-27:** the deposit is due on signing, the last payment at install, and any payment between is spread evenly. Every date stays editable. Replaces today's rule of counting back 90 and 45 days from install. See §16.
12. ~~Dropbox Sign plan~~ **Decided 2026-10-27:** yes, upgrade to a paid API plan and register the API app for fremontmakers.com. See §16.

## 9. Not in Phase 1 / 1.1

- **Phase 2 (wayfinding and clutter):** left sidebar splitting Projects from Company Books; the job header on every project tab; All Projects with one Open button plus a ⋯ menu, Balance and Next step columns, and builder-order houses folded under their job; Invoices grouped by job and sorted by due date.
- **New Project flow (Phase 2, approved 2026-10-27):** one full page in five steps, autosaved as a draft, with pricing set on each job and never per customer. Full plan and acceptance checks in **§15**. Supplier quote import lives only here and in the change order flow.
- **Contract and e-sign (Phase 2, proposal):** a Contract tab with a ready check, in-page review, and Dropbox Sign by email or in a frame; Contracted only when everyone has signed. See **§16**.
- **Courtesy change orders (Phase 2, proposal):** no-charge changes, such as a backordered cabinet swapped, recorded with the cost the shop absorbed, owner approval and an optional buyer acknowledgement. See **§17**.
- **Change order flow (Phase 2, proposal):** a Change orders tab on the job, four steps, its own invoice per change order. See **§19**.
- **Phase 3 (new tools):** Record payment panel with check photo, quote margin and "at cost" flags, autosave with versions, contract packet builder with e-signature checks.

---

## 10. Phase 1.1: activity timeline and audit trail

**Prerequisite:** employee sign-in plus a shared server database (see the note at the top). Without both, ship §2 only.

### What it does
One timeline per job, newest first, holding three kinds of entries:

| Kind | Entry types | Written by |
|---|---|---|
| System events | `stage_changed`, `co_attached`, `payment_recorded`, `delivery_date_changed`, `schedule_change_*` | The app, automatically, when the thing happens |
| Structured updates | `factory_delay`, `factory_shipped`, `delivery_issue`, `customer_contact` | Staff, through short forms |
| Notes | `note` (optionally pinned) | Staff, free text; internal only |

- **Factory delay:** vendor, original and new ship dates, reason, whether the customer was told. It moves the job's delivery date by the same number of days and marks the job **Delayed** in All Projects. It *suggests* moving unpaid invoices due on the old delivery date, and the user chooses. **Shipped** clears the delay.
- **Payment schedule changes:** records who asked (customer or employee), the reason, and before/after for every invoice. Paid invoices are locked. Invoices must add up to the current contract total. Date-only changes apply right away (still logged). Changes that **move money between invoices** wait for an **owner** to approve or reject (a rejection needs a reason). Approval re-checks the job as it is at that moment.
- **Corrections:** entries are never edited or deleted. `correct()` adds a correction entry that points at the original. The timeline shows the corrected text and keeps the original visible. Unpinning is a correction too.
- **Export:** `exportCSV(log, jobCode)` lists id, time, employee, role, type, summary, before, after, and hash.

### Server requirements (Hermes)
1. **Store:** add an `activity` table/store to `fm_phase1`. It's **append-only**: grant INSERT and SELECT only, with no UPDATE or DELETE for the app's database user.
2. **Who and when come from the server.** Set `actor` from the signed-in session and `at` from the server clock. Ignore any actor or time sent by the browser. Roles: `owner`, `staff` (owner-only approvals are enforced in `decideScheduleChange`; enforce the same rule on the server).
3. **Hash chain:** the module chains entries (`prevHash` → `hash`) with a fast browser hash so the preview can show tampering. On the server, recompute each hash with **SHA-256** over the same canonical JSON, and run `verify` nightly with an alert if it fails.
4. **Ordering:** assign ids and `prevHash` on the server inside a transaction, so two people saving at once can't fork the chain.
5. **Hooks:** call `logStageChange`, `logChangeOrderAttached` and `logPayment` wherever Phase 1 performs those actions. The current tool's own actions are **not** logged (it isn't changed). Import its existing paid invoices once as `payment_recorded` entries by the "Imported from current tool" actor, the way the preview does.
6. **Payment schedule in the current tool:** its "Revise payment schedule" window stays as is. Phase 1.1's tracked version lives only on Phase 1 screens.

### Acceptance (sample data, after attaching CO 1)
- [ ] An entry without an employee or a server timestamp is refused.
- [ ] Logging a delay of Nov 14 → Dec 2 moves Willow Creek's delivery Nov 20 → **Dec 8** and offers to move Invoice 2's due date; the job shows **Delayed** until marked shipped.
- [ ] Moving Invoice 2 to Dec 8 applies immediately and logs request and change with before/after.
- [ ] Staff moving $1,000 from Invoice 2 to the CO invoice creates a pending request; staff can't approve it; an owner can. Afterwards: $35,783.01 / $9,740.71, shares 44.24% / 12.04%, still adding to $80,888.05.
- [ ] Editing a paid invoice is refused ("…has a payment recorded and is locked").
- [ ] Changing one stored entry, or deleting one, makes `verify` fail at that entry.
- [ ] CSV export of a job includes every entry with employee and hash.

---

## 11. Full Willow Creek order: every SKU by house, with pricing

### Sources
- **Willow Creek Full House Order.pdf** (contract packet, 27 pages): SKU, qty, sell per line, and each house's cabinets, mfr. discount, assembly, G&A, tax and total.
- **Screen recording, Oct 27 10:02 AM**: each house's Quote screen in the current tool, showing unit cost, markup %, and assembly rate × hours.

Both were transcribed into `preview/willow-creek-full-order.js`. Houses 1 and 2 of each model are identical line for line, so the file stores one set of lines per model and lists all 10 houses with their job codes.

### How the current tool prices a house (confirmed against every figure)
| Step | Rule |
|---|---|
| Line sell | unit cost × qty × (1 + markup%) |
| Cabinets | Σ line sell |
| Mfr. bulk discount 12% | 12% × Σ (unit cost × qty). Taken off **cost**, and passed through to the customer price |
| Assembly | hourly rate × hours |
| G&A 2% | 2% × (cabinets − discount + assembly) |
| Tax 7.9% | 7.9% × (cabinets − discount). Product only, not assembly or G&A |
| Total | product + assembly + G&A + tax |

**Rounding:** the current tool carries full precision and rounds only for display. `priceHouse(..., {mode:'legacy'})` (the default) does the same and reproduces **all 154 lines and all 35 house-level figures** (7 per model) exactly. `reconcileWithContract()` returns `[]`.

### Per model (each × 2 houses)
| Model | Color | Lines | Markup (most lines) | Mfr. cost | Cabinets | Assembly | House total | Cabinet margin |
|---|---|---|---|---|---|---|---|---|
| San Luis | Bayview White Shaker | 12 | 70% (F342 50%, TUK 0%) | $3,370.79 | $5,704.40 | $20.50 × 12.5 h | $6,085.97 | 40.9% |
| Mesa Ridge | Moss Green Shaker | 15 | 19% (F342 10%, TUK 0%) | $6,192.16 | $7,353.73 | $22.25 × 10.25 h | $7,497.75 | 15.8% |
| Sangre Vista | Bayview Wood Shaker | 19 | 42% (F342, TUK 0%) | $5,168.09 | $7,313.50 | $20.50 × 9 h | $7,544.16 | 29.3% |
| Pinyon Crest | Moss Green Shaker | 15 | 18% (F342, TUK 0%) | $6,523.40 | $7,687.01 | $22.25 × 9 h | $7,791.98 | 15.1% |
| Cimarron Peak | Bayview White Shaker | 16 | 72% (SM8(SCR) 58%, F342, TUK 0%) | $3,959.33 | $6,765.70 | $20.50 × 11.5 h | $7,153.81 | 41.5% |
| **Order** | | **154** | | | | | **$72,147.34** | |

### Findings for the owner (no action taken)
1. **Printed pages that don't add up by 1¢.** Because the tool rounds only for display, three models print figures that add up 1¢ off their own total: Mesa Ridge lines add up to $7,497.74 vs $7,497.75, Pinyon Crest to $7,791.97 vs $7,791.98, and Cimarron Peak to $7,153.82 vs $7,153.81. The **totals are what was signed**, so leave them alone. `roundingGapCents` flags this on each house.
2. **Superseded by §12.** `mode:'cents'` rounds each line and subtotal first, but a line with qty > 1 can still print unit × qty ≠ line total (e.g. 2 × $124.61 next to $249.23). Use `FMQuote` (§12) for anything printed. The original note: `mode:'cents'` rounds each line and subtotal first so every page adds up. For this order it would move Mesa Ridge by −2¢ and Cimarron Peak by +2¢ per house (net $0.00 on the order). **Never re-price a signed contract with it.** Owner to decide whether new quotes switch.
3. **Markups vary a lot across one builder order:** 18–19% on the Moss Green models and 70–72% on Bayview White, which works out to 15–42% cabinet margin. That may be intentional pricing, but it's worth a look.
4. **Lines sold at cost (0% markup):** TUK on every model, plus F342 on Sangre Vista, Pinyon Crest and Cimarron Peak. The quote screen flags these as "at cost".
5. **Two assembly rates:** $20.50/h (San Luis, Sangre Vista, Cimarron Peak) and $22.25/h (Mesa Ridge, Pinyon Crest).

### Integration
- **Phase 1 screens:** show the Houses & SKUs table on the builder-order job (see the preview). It's read-only, and contracted houses stay locked (§2, fix 5).
- **Change orders:** a CO's line diff should be priced with the same `priceHouse` and the house's own markup and settings, so CO amounts follow the contract's math.
- **Packet:** superseded by §12. Print house quotes with `FMQuote` + `reconcileToSigned`, so the total matches what was signed *and* the page adds up. Use `FMPricing` legacy mode to confirm the signed figures (`reconcileWithContract`), not to print them.
- **Real data:** the current tool already stores cost, markup and labor per house. Map those fields in the adapter (§4) and the fixture becomes test-only.

### Acceptance
- [ ] `reconcileWithContract(order)` returns `[]` (154 lines + 35 house figures).
- [ ] Order total $72,147.34; model totals San Luis $12,171.94 · Mesa Ridge $14,995.50 · Sangre Vista $15,088.32 · Pinyon Crest $15,583.96 · Cimarron Peak $14,307.62.
- [ ] Each house shows all its SKUs with qty, unit cost, markup, and sell; 0% lines flagged.
- [ ] Mesa Ridge, Pinyon Crest and Cimarron Peak show the 1¢ "lines add to …" note.

---

## 12. Final Job Quote: printed math, discount label, one page per house

**Owner request (2026-10-27):** fix the house-quote math customers see, the discount label, and the print layout. **Use `src/fm-phase1-quote.js` (`FMQuote`) and `src/fm-phase1-print.css` for every printed house quote.** This replaces the packet guidance in §11.

### What's wrong on the signed packet today
`verifyPrinted()` finds arithmetic a customer could catch with a calculator on **every** model:

| Model | Problems | Examples |
|---|---|---|
| San Luis | 5 | 2 × $123.17 = $246.34, printed $246.33; discount label |
| Mesa Ridge | 8 | 4 × $24.29 = $97.16, printed $97.15; lines add to $7,353.72 vs Cabinets $7,353.73; summary $7,497.74 vs total $7,497.75 |
| Sangre Vista | 4 | 3 × $53.97 = $161.91, printed $161.92 |
| Pinyon Crest | 7 | lines add to $7,687.02 vs Cabinets $7,687.01; summary $7,791.97 vs total $7,791.98 |
| Cimarron Peak | 8 | 2 × $124.61 = $249.22, printed $249.23; summary $7,153.82 vs total $7,153.81 |

Cause: the tool computes line = cost × qty × (1 + markup) at full precision, rounds the line, then prints unit = line ÷ qty rounded separately.
Every model also prints **"Mfr. bulk discount (12%)"** right under Cabinets, where it reads as 7.0–10.2%, because the 12% is of *your cost*, not of the price shown.

### The fix (`priceHouse`)
| Printed row | Rule |
|---|---|
| Unit price | round(unit cost × (1 + markup)) to the cent |
| Line total | unit price × qty, exactly |
| Cabinets | Σ printed line totals |
| Mfr. bulk discount | round(12% × Σ cost). **Printed without a %.** The internal note says "12% of your cost $3,959.33 (not of the customer price)" |
| Product subtotal | Cabinets − discount. **New printed row**, so the G&A and tax %s can be checked |
| Assembly labor | Σ round(rate × hours) |
| G&A (2% of product + labor) | round(2% × (product + labor)) |
| Tax (7.9% of product) | round(7.9% × product) |
| Contracted total | product + labor + G&A + tax, exactly |

Cost, markup, margin and the discount basis are **never printed** (a test enforces this). A missing site address prints **"Not set"** in rust, not "—". When the signer differs from the buyer, both are shown.

### Signed contracts are not repriced
The corrected math lands within a few cents of what was signed (per house: San Luis −2¢, Mesa Ridge +7¢, Sangre Vista −3¢, Pinyon Crest −4¢, Cimarron Peak +1¢). `reconcileToSigned(priced, signedTotalCents)` keeps the **signed total** and adds one visible row, **"Rounding adjustment (to signed total)"**, so the page still adds up. A difference over $1.00 is refused ("needs a change order, not a rounding adjustment"). **Owner decision (2026-10-27, §8 question 5):** every reprint of a signed quote uses this: corrected math, the visible rounding row, and the signed total. Never reprint the old page with its arithmetic errors.

**New quotes and change orders** use `priceHouse` directly, with no adjustment row. Switching is owner question 6.

### Print layout (`fm-phase1-print.css`)
- One `<article class="fm-p1-doc">` per house; each starts a new sheet. US letter, 0.45in/0.55in margins, compact 9.5pt rows, a one-row header, and a totals block that can't split from the table.
- Measured in Chrome at 96 dpi: **26 SKU lines fit on one sheet** (plan on 25). Willow Creek's longest house (Sangre Vista, 19 lines) uses 9.15in of 11in, so **all 10 houses fit on one sheet each**. Today each house spills onto a mostly blank second sheet (27 sheets for 15 pages).
- Longer quotes continue onto a second sheet with the column headings repeated.
- The CSS includes a global `@page` rule, so load it **only** on Phase 1 print pages, never on current-tool pages (§0 rule 6).
- **Logo top left (owner request; official artwork since 1.9.0):** every sheet starts with the official Fremont Makers F/M mark next to the "FREMONT MAKERS / making freedom" lockup, in Juniper Shadow, from `FMQuote.logoHTML(meta)` (images in `assets/brand/`; set `meta.logoBase` if they're served from another path, e.g. `/project-builder/phase1/assets/brand/`). With the logo, every Willow Creek house still fits on one sheet (Sangre Vista 9.01in measured) and the 26-line capacity holds.
- **Every customer document uses the same `logoHTML` top left:** quotes, contract packet pages, payment schedule, invoices, change orders, and bid pages (§16–§19). Today's contract packet and invoices print the name as centered text only.

### Integration
1. Packet page: for each house, `FMQuote.priceHouse(inputFromOrderModel(...))` → `reconcileToSigned(..., signedTotal)` → `renderHouseQuoteDoc(..., meta)`. Map the real stored fields in the adapter as in §4; `inputFromOrderModel` shows the shape.
2. Quote screen (internal): show `internal.discountNote`, `internal.atCostLines` and `internal.marginPct` next to the totals.
3. Run `verifyPrinted` on anything about to be printed or sent, and block sending if it returns problems.
4. Keep `FMPricing` (§11) to confirm signed figures (`reconcileWithContract`).

### Acceptance
- [ ] `verifyPrinted` on each model's signed packet finds 5 / 8 / 4 / 7 / 8 problems (San Luis, Mesa Ridge, Sangre Vista, Pinyon Crest, Cimarron Peak), including the discount-label problem on all five.
- [ ] `verifyPrinted` on every corrected quote returns `[]`.
- [ ] Cimarron Peak corrected rows: Cabinets $6,765.70 · Mfr. bulk discount −$475.12 · Product subtotal $6,290.58 · Assembly $235.75 · G&A $130.53 · Tax $496.96 · Total $7,153.82. Reconciled to signed: a −$0.01 rounding row, total $7,153.81.
- [ ] Mesa Ridge reconciled: a −$0.07 rounding row, total $7,497.75.
- [ ] The customer document contains no cost, markup or margin. The discount reads "Mfr. bulk discount" with no %.
- [ ] Printed from Chrome on US letter, the Willow Creek packet uses one sheet per house.

---

## 13. Paper / Dark switch (1.3.1)

**Owner request (2026-10-27, after Phase 1 went live):** add a Paper / Dark option at the top so the team can switch between the cream background and the green one, the same way the existing tool's Paper / Dark buttons work.

### What it does
- **Paper** = Canyon Cream (#EFE8DA) background, the current look. **Dark** = Juniper Shadow green (#243A32) background with cream text. This replaces the old near-black dark colors.
- Two-button switch, same labels as the existing tool. It opens on **Paper** (the existing tool's default) unless the person picked Dark before.
- Each person's choice is remembered in their browser under its **own** key, `fm_phase1_theme`. It never reads or changes the existing tool's theme setting (§0 rule 1). If storage is blocked (private browsing), the switch still works for that visit.
- Printed and PDF documents (`.fm-p1-doc`) stay white paper in both modes.
- Contrast: every text pair in the Dark palette is at least 4.5:1 (e.g. cream on Juniper 10.0:1, faint text on the darkest panel 4.8:1).

### Integration
1. Load `src/fm-phase1-theme-toggle.js` before the Phase 1 screen scripts, along with the updated `src/fm-phase1-theme.css`.
2. On page load: `FMTheme.init(phase1RootEl)`, where `phase1RootEl` is the outermost `.fm-p1` element. Make that element span the full page width and height so the background covers the whole screen (see `#fmp1-root` in `preview.html`).
3. Put `FMTheme.toggleHTML(FMTheme.get(phase1RootEl))` in the Phase 1 header, top right, then call `FMTheme.bind(headerOrRootEl, phase1RootEl)` once.
4. Optional: to start new users on whatever they chose in the existing tool, read that setting **read-only** and pass it as `FMTheme.init(el, { fallback: 'paper' | 'dark' })`. Never write to the existing tool's setting.

### Acceptance
- [ ] A first visit opens on Paper. Clicking Dark turns the whole Phase 1 page Juniper green; reloading keeps Dark.
- [ ] The existing tool's own Paper / Dark setting is unchanged after using the switch.
- [ ] Printed quotes are white in both modes.
- [ ] `node tests/theme.test.js` → 5 passed.

---

## 14. Braddy Builders · Penrose (FM-2609-314) and attached contracts (1.4.0)

**Owner request (2026-10-27):** "here's the existing contract including invoices for both Braddy Builders and Willow Creek, to upload and attach as makes sense."

### What was added
- `preview/braddy-penrose-order.js`: every line of the signed Penrose Final Job Quote (18 lines), unit costs from the 11:20 AM recording, Braddy's settings (**5%** mfr. discount of charged cost, **5%** G&A, **8.7%** tax, 30% markup, 50/30/20), the three invoices, Wholesale Cabinets order #1000173203, and the **source documents for both jobs** with page counts, sizes and SHA-256 checksums.
- `src/fm-phase1-quote.js`:
  - **No-charge lines** (`noCharge: true`) print "No charge", stay out of the discount base (as in the current tool), and are tracked internally as `noChargeCostCents`.
  - Assembly can be a fixed amount (`assembly.total`) when rate × hours isn't known.
- Preview: each job has a **Documents** panel listing its signed originals and what checking them found.
- `tests/braddy.test.js`: 8 tests.

### Attaching the documents in the live system
The PDFs are **not in this zip** (8.4 MB + 2.6 MB + 0.6 MB). The owner sends them separately. Attach each to its job's files in Phase 1 storage (`fm_phase1`, never the current tool's), and confirm the checksum matches:

| Job | Document | File | SHA-256 (first 16) |
|---|---|---|---|
| FM-2609-314 | Signed contract packet (8 pp) | `FM-2609-314 · Braddy Builders.pdf` | `40370de19e9cafdd` |
| FM-2609-314 | Wholesale Cabinets order #1000173203 (1 p) | `Updated Braddy WholesaleCabinets-1000173203 (2).pdf` | `33091aa2e103f2ac` |
| FM-2609-276 | Signed contract packet (27 pp) | `Willow Creek Full House Order.pdf` | `9c415ace06e94d51` |

Full checksums are in `preview/braddy-penrose-order.js` → `documents`. Store the files unchanged. Signed originals are never edited or re-generated.

### Every SKU on the job (1.9.1, owner request)
From the 8:34 PM recording of the quote screen, every Penrose line is in `preview/braddy-penrose-order.js` and matches that screen line for line: 18 lines (16 charged, 2 no charge), cost of charged lines **$5,766.96**, assembly **$40/hr × 16 h = $640.00** (now stored as rate × hours). Change Order 1 removed **DC324-VDH ×2** and **VDC12-VDH ×1**; those are on the job as removed lines (their cost was never shown). The printed line totals add to $7,423.83 while the screen and contract say $7,423.84 (finding 4 below). In the preview, the Penrose job now has a Cabinets & SKUs panel (`renderJobSkus` in `preview/app.js`); build the same panel for every single-house job.

### Findings for the owner (no action taken)
1. **The signed quote doesn't add up by $2,188.06.** Cabinets $7,423.84 − discount $288.35 + assembly $640.00 + G&A $388.77 + tax $620.79 = **$8,785.05**, but the printed total is **$10,973.11**. The page's footnote says the job was priced by bid. Decided: lump-sum bid pages going forward; Penrose grandfathered as signed (§18).
2. **Two cabinets at $0.00.** VDC42RS ×1 and DC224 ×2 (ordered Oct 9, $1,652.70 by card). **Update from the 8:34 PM recording:** they are on Change Order 1 (Oct 14), a **courtesy** swap for backordered DC324 ×2 and VDC12 ×1, at no charge to Braddy. The paper trail exists, but the cost the shop absorbed isn't recorded on it. See **§17**.
3. **The total changed after the deposit.** Invoice 1 ($5,363.77) is 50% of **$10,727.54**. The total became $10,973.11 (+$245.57) and the remaining $5,609.34 was split 60/40 into Invoices 2 and 3. There's no change order. Decided: part of the agreed Penrose price, no change order (§18).
4. **Same arithmetic issues as Willow Creek:** 5 lines where unit × qty ≠ line total, lines add to $7,423.83 vs Cabinets $7,423.84, and "Mfr. bulk discount (5%)" reads as 3.88%.
5. **Invoice 1 was paid with no check number** (already on the Needs-attention list).

### Acceptance
- [ ] `node tests/braddy.test.js` → 9 passed.
- [ ] The Penrose job shows a **Cabinets & SKUs** panel: all 18 lines (cost, markup, sell; the two no-charge lines tagged "CO 1"), charged cost $5,766.96, assembly $40 × 16 h = $640, and the two cabinets removed by Change Order 1 (DC324 ×2, VDC12 ×1).
- [ ] Penrose: `verifyPrinted` finds 8 problems, including "Summary adds up to $8,785.05, printed total $10,973.11".
- [ ] `reconcileToSigned` refuses Penrose ("differs … by $2,188.02 … needs a change order"). Don't print a rounding line for a gap this size.
- [ ] The Documents panel on each job lists its files with the findings above; each stored file's checksum matches.

---

## 15. Phase 2 plan: New Project flow (approved 2026-10-27)

**Status: approved by the owner. Phase 2 work, don't build it into Phase 1.** It replaces both of today's "new project" paths (single house and builder order). Reference prototype: `docs/new-project-flow.html` (open it next to the package; it prices the Penrose job live with `src/fm-phase1-quote.js`). The prototype saves nothing; its company defaults, addresses and builder model list are examples.

Phase 2 still follows §0: its own route (`/project-builder/phase2/new`), its own feature flag, and no writes to legacy data. Until the legacy tool is retired, a job created here is saved to the new store and shown alongside legacy jobs, not written into the old IndexedDB.

### What it fixes (from the 11:20 AM recording)
1. Cancel throws everything away: four pop-ups deep, no Back, no draft.
2. A single house is created with no customer ("—" in All Projects).
3. One 35% markup for every job; at-cost items zeroed by hand each time.
4. Customer, signer, email, address and dates are typed afterwards on the quote screen.
5. Identical houses are priced one at a time (Willow Creek: 10 PDF imports for 5 models).
6. Color is picked by hand and can disagree with the SKUs.
7. The price isn't visible until the quote exists.
8. No review, no confirmation of the job code, no record of who created it.

### The flow: one full page, five steps, autosaved as a draft
A sticky summary bar shows customer · project · homes · per-home total on every step. Back works on every step. The draft autosaves, so leaving and coming back keeps everything; "Discard draft" is an explicit action, never a side effect of Cancel.

| Step | What's on it | Rules |
|---|---|---|
| 1 Customer | Search or add a customer. Project name, signer, buyer email (for e-signature). | Customer holds **contact details only**. Choosing or changing the customer never changes any price. |
| 2 Homes | One home, or a builder order: model × quantity. | A builder order's houses of the same model share one cabinet list. |
| 3 Cabinets | Drop the supplier PDF **once per model** (or pick a recent one). Show lines read, and check that lines add up to the PDF total. Optional extra supplier orders can be added; their lines can be marked "No charge" (logged, printed as "No charge"). | Color is read from the SKU prefix (SBW Bayview White, UMO Moss Green, SWD Bayview Wood, VDH Dark Hickory) and shown, not picked; a mismatch is a warning. |
| 4 Price | **"This job's pricing" panel:** markup %, mfr. discount %, G&A %, tax %, assembly ($), payment plan (50/50, 50/30/20, 100%). "Copy from a past job" (optional). Checkbox "Sell common at-cost items at cost" (TU, TUK, PWB18K, F342). Line table with per-line markup. Live total, your cost, margin on product, flags. "Priced by bid" option. | See pricing rules below. |
| 5 Review | Customer, homes with address and color, per-home and order total, payment plan **in dollars**, delivery date. Create. | Create assigns the job code, saves as a Quote, shows a confirmation with the code, and logs "Project created by &lt;employee&gt;" in the activity log (§10). |

### Pricing rules (owner decision 2026-10-27)
- Markup, mfr. discount, G&A, tax, assembly and payment plan are **set on each job**. They start from **company defaults** and can be edited every time.
- They are **never stored on or loaded from the customer**. Don't add per-customer pricing defaults.
- Company defaults live in one company setting: **35% markup · 12% discount off cost · 2% G&A · 7.9% tax · $640 assembly · 50/50 payments** (confirmed by the owner, Oct 28). Every job can change them (pricing is set per job).
- "Copy from a past job" copies that job's signed settings (e.g. Penrose: 30% · 5% · 5% · 8.7% · 50/30/20) into this job only. Record which job it was copied from in the activity log.
- Changing the job's default markup or the at-cost box re-applies to every line **not edited by hand**. Lines edited by hand keep their markup and are tagged "edited".
- All totals come from `FMQuote.priceHouse` (§12 math), so the quote that's printed later matches what was shown here.
- **Priced by bid:** if a bid amount is entered, the customer gets the lump-sum bid page (cabinets and quantities, no prices, one "Agreed bid price"); the itemized pricing and the difference stay internal. Owner decision 2026-10-27 (question 7), see §18.

### Importing supplier quotes (owner decision 2026-10-27)
The supplier PDF import is **not a screen or toolbar button of its own** in Phase 2. It appears in exactly two places:
1. **New Project, step 3 (Cabinets):** drop the supplier PDF once per model, as above.
2. **The change order flow:** when cabinets are added or changed on a signed job, the supplier PDF is imported there, priced with that job's own settings, and becomes the change order's lines.

Build it once as a shared import component (read lines, check they add up to the PDF total, read color from the SKU, allow "No charge" lines) and use it in both places, so they behave the same. Don't carry over today's standalone "Import Supplier Quote" button on the Quote toolbar. The change order flow itself is still to be specified (waiting on the owner's recording).

### Acceptance (with the prototype's Penrose data)
- [ ] New job with company defaults: Penrose per-home total **$8,354.55**.
- [ ] Switching the customer (Braddy → Willow Creek) leaves the total at $8,354.55.
- [ ] "Copy from a past job → Penrose" sets 30 / 5 / 5 / 8.7 / 50/30/20 and the total becomes **$8,785.09**.
- [ ] Edit one line's markup by hand, then change the job's default markup: that line keeps its value and shows "edited"; all others change.
- [ ] Leaving mid-flow and coming back restores the draft at the same step.
- [ ] Create writes one activity entry naming the employee, and no legacy record is written.
- [ ] Supplier PDF import is reachable only from New Project step 3 and the change order flow; there's no other import button.

---

## 16. Phase 2 plan: Contract and e-signature with Dropbox Sign (1.5.0)

**Status: proposal for the owner, Phase 2. Don't build it into Phase 1.** Source: the owner's 1:47 PM recording of today's Issue Contract flow. Prototype: `docs/contract-esign-flow.html` (hosted: https://claude.ai/artifact/33oCDPwPYCvHjDvCLmdtxc). Logic: `src/fm-phase2-contract.js` (`window.FMContract`), 22 tests in `tests/contract.test.js`. Dropbox Sign was called HelloSign; the API host is still `api.hellosign.com`.

### What the recording shows
1. **A $0 contract was issued.** "Next: Issue Contract & Invoices" locked an empty quote (no customer, signer, project or cabinets) and printed a 6-page packet with "Contract total $0.00".
2. **The lock password is printed in the dialog's instructions.** Remove it from the UI now, even in the legacy tool if possible. Phase 2 replaces it with employee logins and permissions (§10 prerequisite).
3. **Dropbox Sign refused the request** ("upgrade to a paid API plan … or use the test_mode=1 parameter") in a browser `alert()`. The job had already moved to Contracted, so nothing was sent and nothing recorded the failure.
4. **Deposit dates count back from install** (install − 90 days, − 45 days, install). With install typed as 2028, the "50% today" deposit moved to Aug 2028; with a normal 2-week install it lands in the past.
5. **The packet opens in a separate tab** with print-only signature lines, and the job is Contracted before anyone signs.
6. **Buyer email is typed twice** (job header and dialog); the signer's name isn't sent; Fremont Makers never countersigns.
7. **Project Summary still says "proposed · $0.00"** after locking until the page reloads.

### The flow: a Contract tab on the job
1. **Ready check** (`FMContract.readiness(job, {today})`). Blockers: not Proposed; missing customer, signer, valid buyer email, project or install address (placeholder text counts as missing); no cabinet lines; total ≤ $0; quote arithmetic problems (`FMQuote.verifyPrinted`); plan ≠ 100%; missing, out-of-order or past due dates; install in the past. Warnings: install more than 12 months out; deposit due more than 30 days out; last invoice after install. Each item links to the New Project step that fixes it (§15).
2. **Review.** Packet preview inside the page. Schedule in dollars from `invoiceAmounts` (last invoice absorbs rounding). Default dates from `defaultDueDates`: **deposit due on signing, last payment at install, the ones between spread evenly** (owner decision 2026-10-27), all editable. Don't keep the old "90 and 45 days before install" rule.
3. **Send**, one of three ways (`signatureRequest(job, {mode,…})` builds the request body; the server sends it):

| Mode | Button | Dropbox Sign call | Frame? |
|---|---|---|---|
| `email` (default) | Send for signature | `POST /v3/signature_request/send` | No. Dropbox Sign emails the buyer. |
| `review` | Check, then send | `POST /v3/unclaimed_draft/create_embedded` (type `request_signature`, `requester_email_address`, `is_for_embedded_signing: false`) → open `claim_url` | **Yes.** Our employee checks fields and message, then presses Send inside the frame. |
| `in_person` | Sign here now | `POST /v3/signature_request/create_embedded` → `GET /v3/embedded/sign_url/{signature_id}` → open `sign_url` | **Yes.** The buyer signs on our screen or a tablet. Also used for the Fremont Makers countersignature. |

   Signers: buyer first (order 0), then Fremont Makers (order 1). **Owner decisions 2026-10-27: Fremont Makers countersigns every contract, and who signs is chosen job by job.** Several employees can sign. Keep an **approved signers** list (name, email) as a company setting only the owner can edit, and store the chosen person on the job as `fmSigner`. A "Signs for Fremont Makers on this job" picker sits in the Contract tab; the ready check (`readiness(job, { authorizedSigners })`) blocks a job with no signer or one not on the list, and `signatureRequest` uses `job.fmSigner` as signer 2 (it throws without one). The signer locks once the request is out or signed; to change it, cancel the request and send again. Log who was chosen and by whom. The countersignature is collected in the frame (`in_person` flow for signer 2) or by Dropbox Sign's email, after the buyer signs. The PDF carries hidden **text tags** (`FMContract.TAGS`, e.g. `[sig|req|signer1]`) with `use_text_tags` and `hide_text_tags`, so nobody places fields by hand. `metadata.fm_job_code` ties callbacks to the job.

4. **Track.** Pricing freezes when the request is created (`isQuoteFrozen`). Status changes only from verified Dropbox Sign events (`applyEvent`): sent → Out for signature; signed → Buyer signed; **all_signed → Contracted** (owner decision 2026-10-27: Contracted only when everyone has signed); downloadable → fetch the signed PDF and attach it to the job's Documents with its SHA-256. Declined or canceled → back to Proposed, quote unlocked. Invalid → show the error. Duplicate, late or other-request events are ignored. Every event goes to the activity log (§10).

### Signed on paper (owner decision 2026-10-27)
A wet-signed contract is the other way to reach Contracted. On the Contract tab, under "Signed on paper instead?":
1. **Print packet for signing** (only when the ready check passes; logged with the contract version).
2. Upload the signed copy: PDF, JPG, PNG or HEIC, up to 25 MB. Enter the date it was signed, and confirm the buyer signed and dated every signature line (and that Fremont Makers countersigned, which is always required).
3. **Record signed copy** calls `FMContract.recordPaperSigned(esState, upload, { today, ready, requireCountersign })`. It refuses an already-signed contract, a contract that fails the ready check, a wrong file type, an empty or over-25 MB file, a missing checksum, a missing or future signed date, an upload with no signed-in employee, and unchecked confirmations.
4. On success the e-sign state becomes `signed_on_paper` and the job **Contracted**; pricing stays frozen. The returned `document` is stored with the job's documents (same as §14: file plus SHA-256, computed in the browser and checked again on the server). The activity log records who uploaded it, the signed date and the checksum.
5. If a Dropbox Sign request is still out, `cancelRequestId` is set: the server calls `POST /v3/signature_request/cancel/{id}` so the buyer can't sign twice. Later Dropbox Sign events for that job are ignored.

Server: `POST /api/fm/contracts/:job/paper-signed` (multipart, behind employee login). Store the file in the new store's document storage, never in legacy records. Recompute the SHA-256 on the server and reject a mismatch.

### Opening Dropbox Sign in a frame (Hermes)
- Use the `hellosign-embedded` npm package: `new HelloSign({ clientId })` then `client.open(url, FMContract.embeddedOpenOptions({ clientId, testMode, container }))`. Pass `container` to put the frame inside the Contract tab instead of a pop-over. Listen for `finish`, `cancel`, `close` and `error` to update the page, but **only trust server callbacks** for status.
- Create a Dropbox Sign **API app** with domain `fremontmakers.com` (covers `tools.fremontmakers.com`). Embedded signing and requesting need the app **approved by Dropbox Sign** before production; until then use `test_mode`. `skipDomainVerification` only works with test-mode requests, so it is never set in production (`embeddedOpenOptions` enforces this).
- Allow the Dropbox Sign app domain in the page's Content-Security-Policy `frame-src` (check the host in a real `sign_url`).
- A `sign_url` is valid for 60 minutes and only once. Request it from the server **when the signer clicks**, never ahead of time. `signature_id` doesn't expire.

### Server (Hermes)
- The API key lives on the server only. Endpoints, behind employee login: `POST /api/fm/contracts/:job/send` (mode), `POST /api/fm/contracts/:job/sign-url` (signer), `POST /api/fm/contracts/:job/cancel`, and the public callback `POST /api/fm/esign/callback`.
- Callback: multipart POST with the event in the `json` field. Verify `event_hash` = HMAC-SHA256 of `event_time + event_type` with the API key (or the SDK's `EventCallbackHelper.isValid`). Reply **HTTP 200 with body `Hello API Event Received`** (`FMContract.CALLBACK_ACK`), or Dropbox Sign retries.
- Store per job in the new store: `signature_request_id`, `signature_id` per signer, e-sign state, seen event keys, contract version. Never write e-sign data into legacy records.
- If a Dropbox Sign call fails, keep the job as it was, show the error in the page (no `alert()`), log it, and offer Retry.

### Owner actions before this can go live
- **Upgrade the Dropbox Sign API plan** (approved by the owner 2026-10-27). The recording's error means the account is on the free API plan, which only allows test requests.
- Create the API app for `fremontmakers.com` and request approval for embedded signing.
- Give Hermes the list of employees approved to sign for Fremont Makers (names and emails).
- Owner questions 9–12 (§8) are all decided.

### Acceptance
- [ ] `node tests/contract.test.js` → 22 passed.
- [ ] The blank job from the recording can't be sent: 7 blockers (customer, signer, project, Fremont Makers signer, address, lines, -e total) and 2 warnings (install 24 months out, deposit not due until 2028).
- [ ] Penrose (as if unsigned, install Nov 9): ready; invoices $5,486.56 / $3,291.93 / $2,194.62 due Oct 27 / Nov 3 / Nov 9 2026.
- [ ] A refused send leaves the job unchanged, shows the reason in the page and logs it.
- [ ] The job becomes Contracted only on `signature_request_all_signed`; a decline unlocks the quote.
- [ ] Uploading a wet-signed PDF with the confirmations checked makes the job Contracted, adds the file with its SHA-256 to Documents, and logs the uploader; uploading while a request is out cancels it.
- [ ] Two jobs can have different Fremont Makers signers; someone not on the approved list is blocked by the ready check.
- [ ] No request can be sent without the company signer set; the job becomes Contracted only after the Fremont Makers countersignature.
- [ ] The blank job can't be recorded as signed on paper (ready check fails).
- [ ] Both frame modes open inside the Contract tab on `tools.fremontmakers.com` with domain verification on.

---

## 17. Phase 2 plan: Courtesy change orders (1.6.0)

**Status: Phase 2 proposal. Don't build it into Phase 1.** Source: the owner's 8:34 PM recording of Penrose Change Order 1 and the owner's note: the change was a **courtesy**, made because something was backordered; Fremont Makers absorbed the cost but wanted a paper trail. Logic: `src/fm-phase2-changeorder.js` (`window.FMChangeOrder`); the courtesy tests are 8 of the 14 in `tests/changeorder.test.js`. Penrose CO 1 is now in `preview/braddy-penrose-order.js` (`changeOrders`).

### What Penrose Change Order 1 shows today
- Oct 14, 2026. "This change $0.00", contract total unchanged at $10,973.11. **A swap:** DC324-VDH ×2 and VDC12-VDH ×1 removed; VDC42RS-VDH ×1 and DC224-VDH ×2 added.
- The printed reason is "SKUs updated Oct 2026". It doesn't say the cabinets were backordered or who approved giving the swap away.
- The added cabinets were entered at **$0.00 unit cost**. Their real cost is on Wholesale Cabinets order #1000173203 ($1,600.44 before discount; **$1,652.70 paid** by card), which isn't linked to the change order. So the job's margin and the P&L don't show what the shop absorbed. The note "SKU sell moved −$1,649.95 · shop ate it" is the *sell* of the removed cabinets, not what was spent.
- No buyer acknowledgement, although the buyer is getting different cabinets.

### Proposed: a "Courtesy" change order type
Created from the change order flow (the same place supplier quotes are imported, §15). It records:
1. **Why**: Backordered item substituted, Goodwill, Our mistake corrected at our cost, or Other (note required).
2. **What came off and what went on**, with quantities. Added cabinets carry their **real unit cost** (a $0 cost is refused).
3. **What the shop absorbed**: what was actually paid for the added cabinets (link the supplier order) minus any supplier credit for the removed ones. If the credit isn't known yet, the amount is marked as an estimate.
4. **Customer change $0.00; contract total unchanged.** In the ledger it's a change order with `amountCents: 0`, so the contract total and invoice shares don't move.
5. **Owner approval** (it gives money away), logged with the absorbed amount (`approve`). Same rule as schedule changes that move money (§10).
6. **Customer page** (`printed`): "Change Order N · Courtesy. No charge to you. Your contract total stays $X." Lists removed and added cabinets, added ones marked "No charge". **Never shows cost or the absorbed amount.**
7. **Buyer acknowledgement** (optional): send it through the same Dropbox Sign flow as contracts (§16) or upload a signed paper copy. It isn't billed, so it never changes the job's status.

Internally, the job header and the P&L show "Courtesy changes: N, $X absorbed" (`absorbedTotal`).

### For Penrose specifically
Recorded properly, CO 1 shows absorbed **$1,652.70**, final: Wholesale Cabinets gave no credit for the removed DC324 ×2 and VDC12 ×1 (owner, Oct 29). Customer page unchanged: no charge, total $10,973.11.

### Acceptance
- [ ] `node tests/changeorder.test.js` → 14 passed (8 courtesy, 6 flow).
- [ ] Penrose CO 1 as entered today is refused: both added cabinets have $0 cost.
- [ ] With real costs and the supplier order linked: customer change $0.00, contract total $10,973.11, absorbed $1,652.70 (estimate).
- [ ] Only the owner can approve; approval writes one activity entry with the absorbed amount.
- [ ] The customer page shows the swap and "No charge" and contains no cost figures.

---

## 18. Bid-priced jobs and grandfathered prices (1.7.0)

**Owner decisions, 2026-10-27.** Logic: `src/fm-phase2-bid.js` (`window.FMBid`), 6 tests in `tests/bid.test.js`. Phase 2.

### Going forward: the corrected math prevents the gap on itemized jobs
- Every new quote is priced with `FMQuote.priceHouse` (question 6), so the printed lines, summary and total always agree. Checked against all five Willow Creek models: each is within a few cents of its signed total (a rounding line at most), so **no grandfathered line is ever needed for an itemized job**.
- A gap only appears when a job is **priced by bid**, i.e. the total is agreed first rather than built from the lines. That's a choice, not a math error, so the page has to be designed for it.

### Bid-priced jobs print a lump-sum page (question 7, option C)
`bidPage(priced, bidCents)`:
- **Customer page:** every cabinet with SKU and quantity, **no prices**, then one line: "Agreed bid price $X" (with "includes assembly and Colorado sales tax"). The page adds up and doesn't show the margin.
- **Internal job page:** the full itemized pricing, the bid, and the difference ("Bid is $X above the itemized price").
- In the New Project flow (§15) the "Priced by bid" option produces this page. Don't print a "Bid adjustment" line to the customer.
- Owner to confirm with the accountant whether Colorado sales tax must be shown as its own amount on a lump-sum bid; if so, print "of which sales tax $X" under the bid price.

### Penrose comes over as signed, with one grandfathered line (one-off)
Braddy · Penrose is under way and no questions are expected, so it isn't re-papered. When it's brought into the new tool (`grandfather(priced, signedCents, meta)`):
- Its lines are recomputed with the corrected math: **$8,785.09**.
- It keeps its signed total **$10,973.11**.
- The **$2,188.02** difference is stored as one internal line, "Agreed price (grandfathered from signed contract, 2026-09-16)", and logged. It isn't reprinted to Braddy.
- Differences of $1 or less stay a rounding line (§12), so the grandfathered line is used only for real agreed-price gaps. Penrose is the only known case.

### Acceptance
- [ ] `node tests/bid.test.js` → 6 passed.
- [ ] Penrose bid page: 18 rows with quantities, "Agreed bid price $10,973.11", no prices or margin anywhere on the customer page.
- [ ] Penrose brought over: total $10,973.11, itemized $8,785.09, one grandfathered line of $2,188.02, internal only.
- [ ] No Willow Creek house needs a grandfathered line.

---

## 19. Phase 2 plan: Change order flow (1.8.0)

**Status: Phase 2 proposal. Don't build it into Phase 1.** Source: the owner's 8:57 PM recording of today's change order pop-up. Prototype: `docs/change-order-flow.html` (hosted: https://claude.ai/artifact/CfcVwt8kJzNyiLTPjEXAM1). Logic: `src/fm-phase2-changeorder.js` 0.2.0 (`mergeLines`, `colorCheck`, `splitByColor`, `priceChange`, `choosePrice`, `invoiceFor`, plus the courtesy functions from §17), 14 tests in `tests/changeorder.test.js`.

### What the recording shows
1. **A whole-order PDF went into one house.** "Willow Creek Change order 10/23/26" has Bayview White (SBW), Bayview Wood (SWD) and Moss Green (UMO) lines for several houses; all 14 lines were added to Cimarron Peak 2 (SBW).
2. **The target house was switched on the price step** (to Mesa Ridge 1, UMO), but the cabinets and totals stayed Cimarron Peak 2's ("FM-2609-781 stays $7,153.81"). The review then showed Mesa Ridge's materials.
3. **"Add to the existing list" lowered a quantity:** SM8(SCR)-SBW went 3 → 1.
4. **Added lines took the 35% "All markup" default** while the house's lines were at 72%.
5. **"Courtesy · this change $0" was preselected** for a $7,466.38 change.
6. **A typed amount ($7,800) skipped discount, G&A and tax** ("bulk 0% · G&A 0% · tax 0%"), with "skus updated" as the only reason.
7. **"Keep in payment schedule" was preselected** for billing.
8. **It's a pop-up off All Projects**, with no buyer email; an earlier Willow Creek change order still sits in All Projects as its own "project" (FM-2610-475, $8,740.71, Proposed). Phase 1 already detects and attaches those (§2).

### The flow: a Change orders tab on the job, four steps
1. **What and why.** Opened from the job (or a house), so the target can't drift. On a builder order, pick the house(s); a **whole-order PDF is split by color** (`splitByColor`) and each color group is assigned to the houses that use it (e.g. SBW → San Luis, Cimarron Peak). Reason: Customer request, Site or plan change, Backordered item substituted, Our mistake, Other (+ note, required).
2. **Cabinets.** The shared supplier import (§15). **Adding never lowers a quantity** (`mergeLines` mode `add`); taking cabinets off is an explicit −. Added / removed / changed are shown in color. **Wrong-color cabinets are flagged** (`colorCheck` against the house's SKU suffix) and block Next unless someone ticks "keep anyway", which is logged.
3. **Price.** Priced with **this job's own settings** (per-job markup, discount, G&A, tax; corrected math §12) via `priceChange`: added cabinets minus removed ones. **Nothing is preselected** (`choosePrice`): Charge it, Courtesy (§17, owner approves), or Agreed amount (needs a reason; the difference from the priced change is recorded). If a removed cabinet has no recorded cost, "Charge it" is disabled.
4. **Invoice and send.** **Each change order gets its own invoice** (owner decision 2026-10-27, question 2; `invoiceFor`), due on signing; the original invoices don't change. A negative change is a credit against the next unpaid invoice (or refunded). Courtesy: no invoice. Preview the customer page, then send through Dropbox Sign or print for signing (§16). The change order counts toward the contract total, and its invoice becomes Due, **when it's signed** (the Phase 1 ledger already counts only signed / invoiced / paid change orders).

### Acceptance (prototype, Penrose)
- [ ] `node tests/changeorder.test.js` → 14 passed.
- [ ] "Add a cabinet": BC24 3 → 4 and WF342 2 → 1, priced at **$420.49** with Penrose's 30 / 5 / 5 / 8.7; own invoice "Change order 2 · $420.49", due on signing; contract once signed $11,393.60.
- [ ] "Penrose CO 1": courtesy, no invoice, customer page says no charge and the total stays $10,973.11; "Charge it" disabled because DC324 / VDC12 cost wasn't recorded.
- [ ] "Wrong-color PDF": W3024-SBW on a Dark Hickory (VDH) house is flagged and blocks Next.
- [ ] Nothing on the price step is selected until the person chooses.

---

## 20. Fremont Makers logo (1.9.0)

The owner supplied the official logos (Oct 27). They're in `assets/brand/`, recolored from black/white to the Colorado palette and trimmed to the artwork:

| File | Use | Size (px) |
|---|---|---|
| `fm-mark-{juniper,cream}.png` | F/M mark. App header, favicons, small spaces, top left of documents. | 218 × 322 |
| `fm-tagline-{juniper,cream}.png` | FREMONT MAKERS + "making freedom". Next to the mark on documents. | 955 × 509 |
| `fm-wordmark-{juniper,cream}.png` | FREMONT MAKERS only. Next to the mark in the app header. | 955 × 326 |
| `fm-full-{juniper,cream}.png` | Full logo with "ESTD 2019". Login page, emails, cover sheets. | 1290 × 523 |

**Juniper** (#243A32) goes on Canyon Cream or white (Paper theme, every printed document). **Cream** (#EFE8DA) goes on Juniper (Dark theme).

### How to use
- **Printed / customer documents** (quotes, contract packet, payment schedule, invoices, change orders, bid pages): `FMQuote.logoHTML(meta)` at the top left. It renders **only the "FREMONT MAKERS / making freedom" logo** in Juniper as `<img>` so it always prints. **Owner decision (Oct 28): no separate F/M mark next to it; one logo is enough.** The "Buyer initials / Date" line sits 26pt below the note above it.
- **Screens:** `<span class="fmp1-logo fmp1-logo--mark" role="img" aria-label="Fremont Makers"></span>` (also `--wordmark`, `--tagline`, `--full`). It uses the image as a mask filled with the theme's ink color, so it is Juniper on Paper and Cream on Dark with no image swap. The mask URLs in `fm-phase1-theme.css` are `../assets/brand/…`, so serve `assets/brand/` beside `src/`.
- Don't stretch the files or put Juniper on Juniper; use the Cream version on dark backgrounds.

### Acceptance
- [ ] Every customer document shows only the "FREMONT MAKERS / making freedom" logo at the top left (no separate F/M mark), in Juniper, on screen and in print.
- [ ] The Phase 1 header shows the "making freedom" logo (`.fmp1-logo--tagline`) in Juniper on Paper and in Cream on Dark. The F/M mark files stay in `assets/brand/` for favicons and tiny spaces only.
- [ ] All 10 Willow Creek houses still print one per sheet.

---

## 21. Open invoices, the contract packet and attached files from a job (1.10.0)

**Owner request (Oct 27):** in a project you can open its invoices and its contract, not just see them listed. **Phase 1.** Logic: `src/fm-phase1-docs.js` (`window.FMDocs`), 8 tests in `tests/docs.test.js`. Styles: `src/fm-phase1-print.css`. UI reference: `preview.html` / `preview/app.js` (`openDoc`, `viewerHTML`, `fitViewer`).

### What opens
| Where on the job | Opens | Built with |
|---|---|---|
| Each invoice row (the label is a link) | That invoice as a letter page: contract total (with change orders), the invoice and its share of the current total, due date, paid date with check # ("no check number recorded" if missing), amount due, a **PAID** stamp when paid, the deposit note for invoice 1, and "billed separately" for a change order invoice. | `FMDocs.renderInvoiceDoc(job, inv, { today, index, count })` |
| **Open contract packet** (Invoices panel) | Summary page (original total, change orders, current total, paid, balance), payment schedule, every invoice, then the Final Job Quote page(s): one per house on a builder order; a bid-priced job (Penrose) prints the lump-sum bid page (§18). | `FMDocs.renderPacket(job, { today, quotes, agreementOnFile })` |
| **Open** on each attached file (Documents panel) | The stored signed original, exactly as signed. In the preview it shows the file name, size, pages and SHA-256, since the PDFs travel separately. | Your file storage (§14) |

Every page starts with the logo top left (§20). Nothing internal (cost, markup, margin) is printed. The packet doesn't reprint the agreement's legal terms; it says the signed agreement is attached to the job (or "not on file" when it isn't).

### Viewer (in the page, not a new tab)
- A full-screen dialog over the job (`role="dialog"`, `aria-modal`), title bar with **Print** and **Close**; Escape closes; focus moves to Close on open and back to the button that opened it.
- On narrow screens the letter pages are scaled to fit the width (`zoom`); print is always full size, one sheet per page.
- **Print** prints only the open document (`@media print` hides the rest of the page).
- Read-only: opening a document never changes the job.

### Acceptance
- [ ] `node tests/docs.test.js` → 9 passed.
- [ ] Page headers never overlap: the logo keeps its size and the title wraps beside it (long titles print smaller). A builder order's packet and schedule are titled with the customer ("Willow Creek Estates"), with the houses listed under Project.
- [ ] Penrose: Invoice 2 shows $3,365.60, 30.67% of the contract total, paid Oct 5 · check 2967, PAID, amount due $0.00. Invoice 1 says "no check number recorded". Invoice 3 shows $2,243.74 due.
- [ ] Penrose packet: 6 pages (summary, schedule, 3 invoices, lump-sum bid quote at $10,973.11). Willow Creek packet: 15 pages (summary, schedule, 3 invoices, 10 house quotes).
- [ ] Willow Creek's schedule flags "Invoices total $80,888.05; the contract total is $72,147.34" until the change order is attached (§2).
- [ ] Open / Close / Escape / Print work with the keyboard; on a phone the pages fit the width.

---

## 22. Phase 2 app: projects, flows and Company Books (2.0.0)

**Status: built as a working preview, ready to put on the server.** Phase 1 isn't live yet (owner, Oct 28); **Phase 1 and Phase 2 launch together**. Same rules as §0: beside the existing tool, its own route and flag, read-only on legacy data, its own storage.

**Preview:** `phase2.html` (hosted: https://claude.ai/artifact/LikgwGAFYVjSTXKP1ZqzkD). Screens: `preview/phase2-app.js` (shell, projects, job tabs, books, viewer) and `preview/phase2-flows.js` (New Project, change orders, contract). Logic, all tested: `src/fm-phase2-store.js` (6 tests), `src/fm-phase2-books.js` (6), plus the earlier Phase 2 modules (contract 22, change order 14, bid 6) and the Phase 1 modules.

### Layout
- **Left sidebar:** Projects (All projects, New project) and **Company books** (Dashboard, Pipeline, Deposits due, Reconcile, P&L, Balance sheet), with counts for overdue invoices and reconcile issues. Paper / Dark switch, "Signed in as", and the logo at the top. On a phone the sidebar becomes a wrapped row of links.
- **All projects:** search; filters (open quotes, in progress, complete, lost); stage, contract, balance and **next step** per job; builder-order houses folded inside their job.
- **Job page:** header that stays on every tab (stage bar, contract / paid / balance / next due, stage actions) and tabs: **Overview** (needs attention, this job's pricing, recent activity), **Cabinets**, **Change orders**, **Contract**, **Invoices** (open, record payment, contract packet), **Documents**, **Activity**.
- On a quote, the header shows **Send the contract** (opens the Contract tab). "Record signed contract" isn't offered: a job becomes Contracted only through signatures or an uploaded wet-signed copy (question 9).

### Company Books (designed fresh; owner, Oct 28)
These cover what the Project Builder knows: jobs, invoices, payments, job costs. Overhead, payroll and bank balances stay in the accounting system, and each page says so.

| Page | Shows | Function |
|---|---|---|
| Dashboard | Contracted this year, collected in the last 30 days, what customers owe (overdue part), coming due in 14 days, open quotes and win rate, gross margin; a **Needs attention** list (overdue invoices, factory orders waiting on a deposit, payments without a check #, invoices that don't match the contract); deliveries in the next 30 days with the balance still owed. | `FMBooks.dashboard` |
| Pipeline | **Redesigned (owner, Oct 28).** Four totals: quotes out (with how many need a follow-up after 30 days), in production, finishing up (each with what's still owed), and win rate. A bar shows where open work sits by value. Then one table per group: **Quotes out** (oldest first, "follow up" flag), **In production** (signed → factory ordered) and **Delivered, finishing up**, sorted by delivery date. Each row has a stage meter, value, collected % and what's owed, delivery date (estimate) and the next step; **Complete** and **Lost** are folded away. | `pipelineGroups` |
| Deposits due | Every unpaid invoice, soonest first: overdue, next 7 days, 8–30 days, later, no date. Flags deposits the factory order waits on. Record payment from each row. | `depositsDue` |
| Reconcile | Per signed job: invoices = contract? payments recorded with a check #? supplier cost on file? overpaid? marked final-paid with money still owed? Bank matching stays in the accounting system. | `reconcile` |
| P&L | For the period (this month, last month, this quarter, year to date, last 12 months): jobs contracted in the period with revenue (sales tax taken out), cabinet cost, courtesy absorbed, gross profit and margin; plus cash collected and its sales-tax share. | `profitAndLoss` |
| Balance sheet | Owed to you (unpaid invoices, overdue part); held for others (deposits on work not yet delivered, sales tax collected); signed work not yet invoiced. | `balanceSheet` |

Definitions: **revenue** = contract total − sales tax; **cost** = supplier price on the quote (replace with supplier invoices when they're recorded); **courtesy** = what approved no-charge change orders absorbed; a job counts in the period it was **contracted** (signed).

### The flows (all owner decisions applied)
- **New Project** (§15): 5 steps with a live total and a draft that survives leaving; pricing per job (defaults 35 / 12 / 2 / 7.9 / $640 / 50-50, or copy from a past job), per-line markup with "edited" lines kept, at-cost items, priced-by-bid option; Create gives the next job code (`FM-YYMM-NNN`), saves a Quote with its invoices (deposit due on signing, last payment at install), and logs who created it.
- **Contract** (§16): ready check, the Fremont Makers signer picked per job from the approved list, three ways to send, pricing frozen while out, Contracted only when everyone has signed or a wet-signed copy is uploaded; the deposit becomes due that day.
- **Change orders** (§17, §19): only on signed jobs; reason + note; cabinets ± and supplier PDF that only adds; wrong-color check; priced with the job's settings; nothing preselected; charged ones go out for signature and get their **own invoice** when signed (and add their sales tax and cost to the job's books); courtesy ones wait for the owner's approval and record what the shop absorbed.
- **Payments:** amount (not more than owed), date (not in the future), method, and a check number for checks; logged with who recorded it.

### What's simulated in the preview (Hermes builds these for real)
1. **Sign-in and access.** "Signed in as" is a picker; production needs real employee logins. Access levels are on the Users page (§23): today everyone has Full access, so anyone can approve courtesy change orders and void or reopen (question 3).
2. **Storage.** `FMStore.create({ storage })` takes `{ load(), save(state) }`; the preview passes browser storage. In production pass the shared server database, and record each `update()` / `addJob()` / `recordPayment()` as its own server write with the user and time (the activity log, §10).
3. **Dropbox Sign** (§16): the preview fires the same events `FMContract.applyEvent` reads; the server makes the real calls and receives the callbacks.
4. **Supplier PDF import.** The preview offers the sample orders. Port the existing tool's Wholesale Cabinets PDF parser (read the code; don't change the old tool) into one shared import used by New Project and change orders (§15).
5. **Files.** Signed PDFs and wet-signed uploads go to file storage with their SHA-256 (§14, §16).

### Acceptance (preview numbers)
- [ ] `node tests/books.test.js` → 7 passed; `node tests/store.test.js` → 6 passed.
- [ ] Pipeline (starting jobs): quotes out **$5,209.36** (the sample quote FM-2610-101, preview only); in production **$91,861.16** with **$47,767.46** still owed (Penrose 79.6% collected, Willow Creek 43.7%); Como House under Lost.
- [ ] Starting jobs: Willow Creek's change order is attached (contract **$80,888.05**); Penrose **$10,973.11** with its courtesy change order; Como House lost.
- [ ] Dashboard: contracted this year **$91,861.16**; customers owe **$47,767.46** ($8,740.71 overdue); needs attention: the overdue Willow change order invoice and Penrose invoice 1's missing check number.
- [ ] P&L year to date: Willow Creek gross profit **$25,436.33**, Penrose **$2,932.66** (after the $1,652.70 courtesy).
- [ ] New project for Braddy with the Penrose PDF: **$8,354.55** on defaults, **$8,785.09** after copying Penrose's settings; contract sent, signed by buyer and countersigned → Contracted, deposit due today.
- [ ] Change order on that job (+1 BC24, −1 WF342) prices at **$420.49**; once signed the contract is **$9,205.58**, it has its own invoice, invoices still match, and the job's tax becomes **$652.96** and cost **$6,062.83**.
- [ ] A courtesy change order waits for someone with Full access to approve it; once approved, the P&L shows what was absorbed.

---

## 23. Elevations and Users (2.1.0)

**Status: built in the Phase 2 preview, ready for the server.** Owner, Oct 28: the current Elevations screen was "a very first attempt" (recording 1:48 PM): boxes placed by hand that overlap, no snapping, wall-level settings only, SKUs listed with generic labels, and a print that isn't usable. The goal: pull the SKUs and their specs in from the supplier PDF, place them, draw them with measurements, show them in 3D, and export. It's used **while quoting**; the agreed SKUs and elevations go into the **contract packet**.

### Where the cabinets come from
- The job's quote lines, which came in from the supplier PDF in New Project (or a change order). Nothing is typed twice, and supplier import stays in those two places (owner decision, §15).
- **Sizes are read from each SKU code** by `FMElev.parseSku`: `W3042` wall 30″ × 42″ × 12″; `W362424` 36″ × 24″ × 24″; `WC2442` (Dark Hickory naming) wall; `B33` / `BC33` base; `SB36` sink base; `3DB24` 3-drawer base; `VS30` vanity sink base (21″ deep); `3VDB12` vanity drawers; `F342` / `WF342` 3″ filler 42″ tall; `U188424` tall utility; and others. Trim and accessories (`TKC`, `TUK`, `SM8(SCR)`, `ACM8`, `LACM8`, `OCM8`, `SCR`, `TK8`, `DWP3`, `WSV42`, `BSV`, `S2496`) are listed but not drawn.
- Codes the tool can only guess are marked **check size** (`DC224` is read as a 2-drawer base 24″ wide; `PWB18K`, `VDC42RS`, `FP9624-1.5`). Unknown codes (for example `FPV4296` from the recording) say **enter size**. A size entered once is saved on the job (`job.elevations.sizes`) and used everywhere on it.
- **Hermes:** when you port the Wholesale Cabinets PDF parser, keep the full SKU (with the color suffix); `parseSku` splits the suffix itself. If the PDF lists dimensions, pass them in as `sizes` and they win over the code.

### How it works (job → Elevations tab)
- **Rooms → walls.** Each wall has a length, ceiling, where it is in the room (back, left, right, front, for the 3D view), and heights: toe kick 4 1/2″, base 34 1/2″, countertop 1 1/2″ (36″ counter), 18″ to the uppers, soffit. Either end can be marked as a corner another wall's cabinets run into (it reserves 24″ at the base and 12″ at the uppers).
- **Two runs per wall, lined up automatically** left to right: an upper run and a base run. Nothing overlaps; an item can have "space before" it, and ← / → reorder. Uppers hang from one top line (the tallest 30″+ upper, or 42″ when the ceiling allows), so a short cabinet over the fridge or range lines up with the rest; uppers step past anything tall below them (pantry), but sit above a fridge.
- **Corner cabinets** (`layoutRoom`): blind corners (`BBC42`, `WBC2730`) and diagonal / lazy Susan corners (`LS36`, `BLS36`, `DCB36`, `WDC2430`). Put one at the end of a run where two walls meet and the wall it meets automatically sets aside its footprint (36″ for a 36″ lazy Susan, 24″ for a blind base, 24″ for a 24″ diagonal upper) and labels the corner. A corner cabinet in the middle of a run is flagged, and so are two walls whose base cabinets both run into the same corner.
- **Floor plan** (view beside 3D room): seen from above, with walls, windows, door swings, base cabinets and appliances (solid), uppers (dashed), diagonal corners drawn angled, the blind part of a blind corner dashed, each wall's length, each cabinet's width, and an island's distance from the back and left walls.
- **Islands and peninsulas:** a wall can be "Island or peninsula" with its length and its distance from the back and left walls (0 from a wall makes a peninsula). No uppers (flagged if added), a 10″ counter overhang on the seating side, and it shows in the floor plan, 3D and print.
- **Crown molding** is drawn on uppers (on the face when the uppers reach the ceiling) and in 3D. Per wall: Automatic (on when the quote has crown: ACM, LACM, CM, SCM), On or Off. **Trim check** in the From the quote panel: crown and toe kick feet quoted (8′ sticks unless the code says otherwise) vs about how much the drawings need, counting open-end returns plus 10% for cuts.
- **Staggered uppers:** each upper has "Raise / lower top" (+ raises, − lowers); a top that would go past the ceiling or soffit is flagged.
- **Sizes from the supplier PDF:** if an imported line has width / height / depth, those are used before the SKU code (`FMElev.sizesFromLines`), and staff-entered sizes still win. **Hermes:** have the PDF import keep those columns when the supplier prints them.
- **Drag cabinets along the wall** (`FMElev.moveItem`). Drop in open space and it lands there, snapping to a neighbor's edge, a wall end, or a window or door edge within 2″, otherwise to the nearest 1/4″; nothing else moves. Drop it onto other cabinets and it changes the order, with the rest closing up. While dragging, a label shows where it will land. A plain click still selects it. The selected item also has a **From left** box for typing an exact position. Every move is logged. Works with a mouse or a finger (horizontal drags; the page still scrolls vertically).
- **Appliances and spaces:** dishwasher, range, fridge, washer, hood, microwave, open space (marked "by others" on the print).
- **From the quote panel:** every quoted cabinet with placed / quoted (for example `W3342 2 / 2`), **Add** to the wall you're on, and **Place the rest on this wall** (adds what fits, in quote order; fillers and panels are left for you to put where a gap needs closing). Extras not on the quote are flagged.
- **Checks on each wall:** run too long for the wall, a few inches left at the end (add a filler), a cabinet covering a window or door, uppers hung too low over the counter, a tall cabinet that won't fit under the ceiling or soffit, a size that's needed. Click a cabinet in the drawing to select it.
- **Drawing:** front elevation with measurements: wall length, each upper and base width, base run total, and the heights (toe kick, base, counter, gap, uppers, ceiling); SKU on each cabinet, door and drawer faces, countertop, toe kick, windows and doors.
- **3D room:** every wall placed where it is in the room; drag to turn, tilt slider, turn buttons. For look and layout; measurements come from the wall drawings.
- **Versions:** "Save version" keeps a copy (who, when); "Go back to this" restores it while quoting.
- **Print / save PDF:** one sheet per wall (drawing + numbered cabinet list with W × H × D, anything still to resolve), then a floor plan and a 3D sheet per room, with the job header. **Save version** shows an "Open PDF of version N" button right away, and every saved version has its own Open PDF button. The viewer's button reads "Print or save PDF". If the page is in a frame that blocks the print window (the claude.ai preview does), it says so and offers **Download to print**: one HTML file with the pages, styles and logo built in that opens its own print window. On fremontmakers.com the button prints directly; keep the fallback anyway. Builder orders draw **per model** (San Luis, Mesa Ridge…).
- **Locking:** editable only while the job is a quote. Once the contract is out for signature it's locked with the price; after signing it's read-only and changes go through a change order (next item). Signed jobs with no drawings say "No elevations on file".
- **Layout checks (2.4.0, `FMElev.roomChecks`, run by `layoutRoom`):** planning advice shown under each wall drawing and for the whole room in the floor plan, kept apart from the errors above and never blocking anything. It checks:
  - **range:** at least 12″ of counter on one side and 15″ on the other; not under a window; a wall cabinet over it at least 30″ above the cooktop unless a hood or microwave is drawn
  - **sink base:** 18″ of counter on one side and 24″ on the other
  - **fridge:** 15″ of counter beside it, and a filler when it is tight to a wall
  - **dishwasher:** on the sink's run and within 36″ of the sink
  - **corners:** drawers, a dishwasher or a range right against a corner, or any cabinet right against a blind corner, needs a filler (about 3″)
  - **island walkways:** 42″ is usual, and under 36″ is flagged
  
  Counter on each side counts the touching countertop cabinets (and the dishwasher) plus a corner cabinet at the wall end. The rules live in `FMElev.RULE`; change them there if the shop's standards differ.
- **Change orders revise the drawings (2.4.0):**
  - When the contract is signed, the drawings are kept as an **As signed** version.
  - A change order that changes cabinets and is in force (signed by the buyer, or an approved courtesy) puts a banner on the Elevations tab, e.g. "Change order 1 changed the cabinets (−B18 ×1, +3DB18 ×1)". The status reads "Needs a revision", and the change order list says "Elevations need a revision for this change".
  - **Start revision** opens the drawings for editing. It takes the removed cabinets off the walls with the neighbors left where they are (`FMElev.reviseRooms`), and the quote list now shows the changed cabinets (`FMElev.applyLineChanges`), so the added ones are "to place".
  - **Save revision N** saves it as a version labeled "Revision N · change order M". That version becomes the current drawing set, and its PDF header says so.
  - **Cancel revision** puts the drawings back.
  - One revision at a time, in change order order.
  - **Hermes:** store `elevations.revision` (open) and `elevations.revisions[]` (done: n, coId, coNumber, version, who, when). Show the latest revision with the change order paperwork.
- **Undo and redo (2.5.0):** Undo / Redo buttons beside Save version, plus ⌘Z / Ctrl+Z and Shift+⌘Z / Ctrl+Y (typing fields keep their own undo). Every drawing edit can be undone: drags, adds, removals, sizes, wall and room settings, copies. The button's tooltip names the step, and each undo is logged ("Elevations: undid …"). It's per job, for the session, the last 50 steps. Starting, saving or canceling a revision clears it, and saving a version isn't an undo step. **Hermes:** keeping it in the browser is fine; the server just saves each result as usual.
- **Copy rooms (room templates, 2.5.0):** "Copy rooms from another model or job" under the room tabs while editing. It lists the other models on this job and every job with drawings. Walls, windows, doors and layout copy over with new ids (`FMElev.copyRooms`). Each cabinet is matched to this quote by its code, so a color change carries over (`B33-SBW` → `B33-UMO`). Codes this quote doesn't have keep their SKU, are named in the message, and show as extra on the quote list. A room name that's taken gets " (copy)". Staff-entered sizes come along. It can be undone.
- **Duplicate project (2.5.0):** a **Duplicate project** button on every job opens New Project already filled in.
  - **What it copies:** the customer, signer and email; one home or a builder order with each model and its house count; the cabinet lines after change orders; the job's pricing (each line keeps its own markup, so the copy prices the same; a job with per-model markup, like Willow Creek, keeps the company default for new lines); and the drawings.
  - **What starts blank:** the project name gets " (copy)"; the address and install date start blank.
  - **Adding cabinets:** it opens on the Cabinets step, which has a new **Add cabinets from another supplier PDF**. That adds to the list: a SKU already there gets its quantity raised. The original PDF picker still replaces the list.
  - **Creating it:** the new job gets the drawings (rooms keyed to its models' names), `duplicatedFrom`, and an Activity entry "Duplicated from FM-…". Added cabinets show as "to place" on Elevations.
  - **Old-tool jobs:** a job priced in the old tool says the new total uses the corrected quote math (question 6), so it can differ from the original.
  - **Unfinished draft:** if there's already a New Project draft, it asks before replacing it.
- **Fix (2.5.0):** change orders already reflected in a job's cabinet lines (the seeded Penrose CO 1, and any signed change order that rewrote the lines) carry `inLines: true`. The Elevations tab no longer applies them a second time; before this, Penrose would have shown VDC42RS ×2 and DC224 ×4.
- **Buy Wholesale Cabinets 2026 catalog (2.4.1):** read from the catalog PDF on buywholesalecabinets.com (Catalog page). Orders are the 2-letter door style, a dash, then the code: `SW` Shaker White, `GR` Shaker Gray, `CW` Charleston White, `SE` Shaker Espresso, `NB` Navy Blue, `TC` Treasure Chest, `AG` Green Shaker, `IB` Black Shaker. Width comes before height (`W1830` is 18″ wide, 30″ tall). Now read from the code:
  - **Wall:** `W…GD` glass doors; `DCW2430/36/42` diagonal corner; `WER2430/36/42` easy-reach corner; `AW1230/36/42` angle end; `MO3030/36/42` microwave; `WSD630` spice drawers; `WD1848/54/60` tower; `PR3015` plate rack; `WRC…` wine rack; `OE630/36/42` open end shelf.
  - **Base:** `BFH12–36` full-height doors; `ERB33/36` easy-reach corner; `CSB36` corner sink; `FSB36` farmhouse sink; `BWB18` waste basket; `MB30/33` microwave; `BT09`; `SPB6/9`; `BSDC6` (12″ wide); `BES12`; `BEC24`; `DFB18` (21″ deep).
  - **Tall:** `O308424…O339624` oven pantries.
  - **Vanity:** `VSD36/42/48`; `V3021DL/DR` combos.
  - **Fillers and panels:** `F396/F696` tall fillers (96″, on the floor, not the uppers); `DWR3` dishwasher return; `REPV2496/2796` refrigerator end panel (1 1/2″ thick).
  - **Listed, not drawn:** `FPV4296` (finish plywood panel 42″ × 96″ × 1/4″, which was "enter size" before); `USV`, `TDEP`, `WDEP`, `BDEP`, `VDEP`, `SBF4242`, `RS…`, `FS…`, `VA…`, `SD`, and moldings `CM8`, `RCM4S(LCM)`, `BCM8(DCM)`, `COV`, `FBM`, `LRM8`, `ALRM8`, `SHM`, `BAM`.
  - **Trim check:** `CM`, `RCM`, `BCM` and `COV` count as crown; all moldings are 8′ sticks.
  - **Blind corner base:** in the catalog the box is 3″ narrower than the code (`BBC36` is 33″, `BBC39` is 36″, `BBC42` is 39″) and installs in the code's width plus up to 3″ with a filler (not included). SW- codes are drawn at the box width; other suppliers keep the code width.
  - **Not in this catalog:** `DC224`, `DC324`, `PWB18K`, `VDC42RS` and `FP9624-1.5` (Dark Hickory, `-VDH`) stay marked "check size" until that supplier's spec sheet is in hand.
- **Supplier codes with the colorway first (2.4.0):** Buy Wholesale Cabinets SKUs like `SW-U188424` (White Shaker; utility 18″ × 84″ × 24″) read correctly. The prefix is treated as the color, and the code after it is read as usual. Their product pages list W × H × D for every item, and their 2026 catalog PDF (buywholesalecabinets.com, "Catalog") should confirm the codes that are still guesses.
- **Contract packet:** the elevation sheets follow the Final Job Quote, and the summary page says so. The Contract tab shows whether every quoted cabinet is on an elevation (a note, not a blocker).

### Files
`src/fm-phase2-elevations.js` (FMElev: sizes, layout, corners, checks, drag and drop, elevation / floor plan / 3D drawings, trim check, layout checks, change order revisions; **20 tests** in `tests/elevations.test.js`), `src/fm-phase1-docs.js` 1.1.0 (`renderElevationDocs`; packet takes `opts.elevations`), print styles in `src/fm-phase1-print.css`, screens in `preview/phase2-elevations.js`. Saved on the job as `job.elevations = { rooms: [{ id, name, set, walls: [...] }], sizes: {}, versions: [], revisions: [], revision: null }`.

### Users (owner, Oct 28)
- **Users page** (sidebar → Company → Users): **Kristy Slaughenhaupt** (kslaugh@unbridled.com), **Tayler Slaughenhaupt** (email later), **Lindsay Wyss** (lwyss@unbridled.com), **Tim Slaughenhaupt** (tslaugh@unbridled.com), all **Full access**: create and price projects, draw elevations, send, void or override a contract, reopen a lost project, approve courtesy change orders, record payments, manage users. Add, remove (never the last Full-access user or yourself), and set access. **Coordinator** is listed as "not set up yet"; add its limits when it's needed.
- **Signs for Fremont Makers:** a checkbox per user; the Contract tab's signer list is these users. **All four sign for Fremont Makers (owner, Oct 28).** The signer is still picked job by job (question 10). A signer needs an email address before they can be picked, because Dropbox Sign sends there.
- **Hermes:** users and access live on the server with the employee sign-in (§22, item 1). Store each user's name, email, access level and "signs contracts"; log who changed them.

### Acceptance
- [ ] `node tests/elevations.test.js` → 20 passed; `node tests/docs.test.js` → 9 passed.
- [ ] Sample quote **FM-2610-101** ($5,209.36, San Luis cabinets, preview only): Kitchen → Sink wall 10′ 6″ fits exactly (B33, dishwasher, SB36, B33; W3342 × 2 around a 30″ window); Range wall shows the fridge with W362424 above it, W3018 over the range, the corner hatched, and "6″ left at the right end of the base run".
- [ ] From the quote: 9 of 12 placed; Bathrooms → Hall bath → Place the rest puts both VS30s on (11 of 12); F342 is left for you to place.
- [ ] On Sink wall, drag the left W3342 a little to the right: it lands where dropped (for example 10 3/4″ from left) and the other W3342 stays at 93″. Drag the right B33 onto the dishwasher: the order becomes B33, B33, dishwasher, SB36 with no gaps.
- [ ] Change Sink wall to 120″: both runs say "6″ too long"; back to 126″: "Everything fits".
- [ ] Range wall's layout checks say the refrigerator is tight to the wall (leave a filler); Sink wall says the checks look right.
- [ ] On a signed job with drawings, a signed change order that swaps B18 for 3DB18: the banner appears; Start revision takes B18 off (the range check then shows 0″ of counter on its right); Add 3DB18; Save revision 1 → status "Revision 1 · change order 1 · current", versions list "As signed" and "Revision 1 · change order 1", and the change order says "Elevations: revision 1 drawn."
- [ ] 3D room turns by dragging; Print gives 3 wall sheets and 2 3D sheets; Open contract packet adds them after the quote.
- [ ] Send the contract → the tab says "Locked while the contract is out for signature" and nothing can be edited.
- [ ] Users page lists the four users with Full access; Kristy (kslaugh@unbridled.com), Lindsay (lwyss@unbridled.com) and Tim (tslaugh@unbridled.com) can be picked as the signer; Tayler shows "add an email".
- [ ] Kitchen → Floor plan: Sink wall across the back, Range wall down the left with its 24″ corner set aside, measurements on each wall. Crown is drawn on the uppers (the quote has ACM8) and the trim check shows crown 16′ quoted and toe kick 24′ quoted.
- [ ] Save version → "Open PDF of version 1" appears in the confirmation; the PDF says "Version 1 · saved … by …". Print adds a floor plan sheet before each 3D sheet.
- [ ] Sidebar: "+ New project" is the first, filled button; no empty gap above Paper / Dark. Contract, Documents and Invoices tabs list documents as rows (the contract packet first), each row opening it; no separate "Open contract packet" buttons.

---

## 24. Field measure (2.6.0)

**Status: built in the Phase 2 preview, ready for the server.** The owner asked (Oct 29) for a way to measure on site and have the numbers land on the job. Default choices, each easy to change: who measured is recorded on every visit (staff by default; builder or buyer with a name); a visit can be for an existing project or for a lead with no project yet; the buyer can confirm the measurements (optional, prints on the sheets); offline use on a phone is a server job (below).

### Screens
- **Sidebar → Projects → Field measure** (`#/measure`): site visits, newest first, each with its project or lead, date, who measured, rooms and walls, and a status ("3 to finish", "Ready to use", "In FM-…"). **Start a site visit** for a project (pick it) or a lead (customer and address).
- **A visit** (`#/measure/<id>`), built for a phone (on a narrow screen the menu shrinks to the project links):
  - **Who measured:** a name, plus Fremont Makers, builder or buyer.
  - **Rooms:** tabs, each with its name, ceiling, soffit and notes.
  - **Walls:** one card per wall, one open at a time. Each has a name, where it is (back, left, right, front, island), and its length, typed the way a tape reads (`10' 6 1/2`, `126 1/2`, `34-5/8`, `¾`). The value is shown back as feet and inches and saved to the 1/16″.
  - **Windows and doors:** from left, width, height, and height off the floor.
  - **Outlets and plumbing:** drain, water, gas, outlet, switch, vent or light, each measured to its center from the left and off the floor.
  - **Photos:** from the phone's camera, shrunk to 1024 px.
  - **Notes** for each wall, and a **live drawing** of the wall to check against.
  - **Hints from the drawing:** for a project, the drawing's length shows as a hint ("plan says 126″"), and a field number that differs by 1/4″ or more is called out.
  - **Done with this wall** opens the next one.
  - **"Before you leave the house":** what's still missing (`FMMeasure.checkVisit`: no length, an opening past the end of the wall or above the ceiling, no height off the floor, and so on), the buyer's confirmation, notes, and **Compare and use on FM-…** (project) or **Start a project from this visit** (lead).
- **Job → Elevations:** **Measure on site** starts a visit with the job's rooms and wall names already listed (the numbers are measured fresh). When the job has a visit:
  - **Field measurements** compares every wall: drawing, field and difference, with differences highlighted.
  - **Use field measurements** puts the field numbers on the drawings (`FMMeasure.applyToRoom`) and keeps every cabinet. Walls are matched by name, then in order; new rooms are added. You can undo it.
  - The layout and checks rerun at once. For example, the sample Sink wall measured 125 1/2″ against 126″ drawn, so its runs now show "1/2″ over".
  - On a signed job it only compares: "The drawings are signed. If the field numbers change the cabinets, start a change order."
- **A lead's visit → New Project:** customer, address and the measured rooms come along (`d.elevations`); add the cabinets from the supplier PDF in step 3. The new job's Activity log says "Started from the site visit on …", and the visit is linked to it.
- **Drawings and print:** outlets and plumbing are drawn on the elevation over the cabinets, so a drain can be checked against the sink base. The wall panel shows "From the field" (who, when, buyer's confirmation, notes and photos). Each printed sheet says "Field measured Oct 29, 2026 by … · confirmed by the buyer, …" and any field note (`renderElevationDocs` takes `page.note`).

### Files
`src/fm-phase2-measure.js` (FMMeasure: `parseLength`, `fmt`, `checkVisit`, `toElevationRoom`, `applyToRoom`, `compare`; **5 tests** in `tests/measure.test.js`), `preview/phase2-measure.js` (screens), `src/fm-phase2-elevations.js` (walls carry `marks`, drawn on the elevation), `src/fm-phase1-docs.js` (`page.note`). A visit's shape is at the top of `src/fm-phase2-measure.js`; Elevations rooms gain `measured: { visitId, by, role, on, confirmedBy }` and walls `marks`, `photos`, `notes`, `measured`.

### Hermes
- Store visits and photos on the server; the preview keeps them in the browser (`fm_phase2_visits`, one key per photo). Photos go to file storage (§22, item 4), each with its SHA-256.
- **Works without signal:** the phone keeps editing the visit while offline and syncs when back online. A visit is edited by one person at a time; if two copies collide, keep both and ask.
- Log every visit change with the user and time, like job changes. "Use field measurements" is one job change ("Elevations: used field measurements from …").

### Acceptance
- [ ] `node tests/measure.test.js` → 5 passed; `node tests/elevations.test.js` → 20 passed.
- [ ] Sample quote FM-2610-101 → Elevations → **Measure on site**: the visit lists Kitchen (Sink wall, Range wall) and Bathrooms (Hall bath); the first wall without a length is open, with "plan says 126″".
- [ ] Type `10' 5 1/2` for Sink wall: it shows "= 10′ 5 1/2″" and "1/2″ shorter than the drawing (126″)". Add a window (47 1/2 from left, 30 × 36, 3′ 8 off the floor) and a drain (63, 18): the wall's drawing shows both.
- [ ] Range wall 132, Hall bath 60 1/4, tick the buyer's confirmation with a name: status "Ready to use".
- [ ] Back on the job: the comparison shows Sink wall −1/2″, Range wall ✓, Hall bath +1/4″. **Use field measurements**: Sink wall becomes 10′ 5 1/2″ and its runs say "1/2″ over"; the drain shows on the drawing; Undo puts it back. The printed sheet says "Field measured … confirmed by the buyer, …".
- [ ] Field measure → Start a site visit → For a lead "Garcia family", one wall `12' 3` → **Start a project from this visit**: New Project has the customer and address, and creating it gives a job with that room drawn (147″ wall).
- [ ] At phone width (375 px) the visit page shows only the project links in the menu, inputs are at least 44 px tall, and nothing scrolls sideways.

---

## 25. Customers, templates and finance exports (2.7.0)

**Status: built in the Phase 2 preview, ready for the server.** The owner asked (Oct 29) for a customer area with profiles and templates for repeat homes and multi-house setups like Willow Creek, and for report exports for finance.

### Customers (sidebar → Projects → Customers)
- **List** (`#/customers`): every customer with kind (builder, homeowner, other), who signs and their email (or "no email"), projects and how many are active, open balance, and templates. Search by customer or contact. **+ Add customer**.
- **Profile** (`#/customers/<id>`):
  - **Contacts:** name, role (signs contracts, gets invoices, on site / superintendent, other), email, phone, and a "Signs contracts" box.
  - **Addresses:** job sites and billing, each with a label ("Willow Creek, phase 2").
  - **Notes.**
  - **Their projects:** stage, total and balance; the header shows projects, total contracted and open balance.
  - **Checks:** a duplicate name, an email that doesn't look right, and a signer with no email (Dropbox Sign needs one).
  - **New project for this customer** starts New Project with the signer, email and site filled in.
- **Profiles start from the jobs** (`FMCustomers.fromJobs`): each customer on a job gets a profile, and the job's signer and site are added once. Change orders filed as projects are skipped. Only real email addresses are taken (the Willow Creek record holds a note there, not an address). A name with Builders, Homes, Construction, Estates and the like starts as a builder.
- **Hermes:** make customers a server table with an id. Link jobs by `customerId` (new jobs already carry it) rather than by name. Keep `name` on the job for the old records. In the preview, a customer with projects can't be renamed, because projects are matched by name there.

### Templates
- **What a template holds:** one home, or a builder order with several models. Each model has its usual house count, its cabinet lines (after change orders, with supplier cost as of the day it was saved) and its drawings (`FMCustomers.templateFromSets`).
- **Never pricing.** Markup, discount, G&A, tax, assembly and the payment plan stay per job (owner rule). New projects from a template start at the company defaults; "Copy from a past job" on the Price step brings over a customer's usual numbers.
- **Save one:** **Save as template** on any job's header, or **Save as a template** on the customer's profile (pick one of their projects). The name defaults to the project's name, or the customer's when the project name is just house counts. Templates can be renamed or deleted (tap twice to delete).
- **Use one:** **New project from this** on the profile, or pick the customer in New Project and choose one of their templates on the Customer step.
  - The draft gets the customer, the signer and email from the first contact who signs, the first site address, the homes or each model with its house count, the cabinets and the drawings (keyed to the new models).
  - A note says where it came from and that pricing is at the defaults. Supplier costs can be refreshed by adding or replacing a supplier PDF on the Cabinets step.
  - The new job logs "Started from a customer template" and carries `fromTemplate`.
- **Sample:** the preview makes a starting template from Willow Creek, "Willow Creek Estates · 5 models": San Luis, Mesa Ridge, Sangre Vista, Pinyon Crest and Cimarron Peak, 2 houses each, 77 cabinet lines.

### Reports & exports (sidebar → Company books → Reports & exports, `#/books/exports`)
- **Period:** this month, last month, this quarter, last quarter, year to date, last year, or custom dates.
- **Five reports** (`FMReports`). Each shows its row count and totals, can be opened on screen (first 50 rows), and downloads as CSV. **Download all** gets every non-empty one.
  1. **Jobs:** contract, change orders, current contract, sales tax, revenue before tax, invoiced, paid, balance, cabinet cost, courtesy absorbed, gross profit and margin. Signed jobs only; a box adds open and lost quotes.
  2. **Invoices:** amount, paid, open, status (Paid, Open, Overdue, Void) and days overdue.
  3. **Payments received** in the period: date, method, check number or reference, amount, and the sales tax inside it (the job's tax over its contract total).
  4. **Sales tax** by job: tax on contracts signed in the period, and tax inside payments received in the period. The accountant decides which basis to file on.
  5. **Change orders:** removed and added SKUs, what was charged, what the shop absorbed, and whether that is an estimate or final.
- **The files:** CSV with a byte-order mark (so Excel reads "Cañon City"). Money is plain dollars (`10500.00`) so spreadsheets can add it up, and each file ends with a Total row. Cells that start with `=`, `+`, `-` or `@` are quoted so a spreadsheet won't run them as formulas. File names look like `fremont-makers-payments-2026-10-01-to-2026-10-31.csv`.
- **Sample check:** year to date, the two signed jobs total $91,861.16 (Willow $80,888.05 + Penrose $10,973.11), $44,093.70 has been paid, and $1,652.70 was absorbed. These match Company Books.
- **Hermes:** run the same functions on the server data. The download is a plain file. If finance later wants a direct QuickBooks or Xero connection, the Payments and Invoices reports are the starting point.

### Files
`src/fm-phase2-customers.js` (FMCustomers), `src/fm-phase2-reports.js` (FMReports), with **8 tests** in `tests/reports.test.js`; screens in `preview/phase2-customers.js` and `preview/phase2-reports.js`; New Project changes in `preview/phase2-flows.js` (`fromTemplate`, template choice on the Customer step, signer and site filled in from the profile).

### Acceptance
- [ ] `node tests/reports.test.js` → 8 passed.
- [ ] Customers lists Braddy Builders (builder), Sample quote, Stonewall Holdings and Willow Creek Estates (builder). Willow's signer Rod Stambaugh shows "no email", and the profile says he needs one for Dropbox Sign.
- [ ] Add his email and a site "Lots 11-20, Willow Creek Dr…": the warning goes away. **New project from this** on "Willow Creek Estates · 5 models": New Project has Willow Creek, Rod and his email, the new site, a builder order with the 5 models × 2 houses and 77 lines, and pricing at the defaults.
- [ ] Penrose job → **Save as template**: Braddy Builders gets "Penrose template · One home · 18 cabinet lines".
- [ ] New Project → pick Willow Creek Estates: signer, email and site fill in, and the template button shows.
- [ ] Reports & exports, Year to date: Jobs 2 rows, $91,861.16; Invoices 6 rows, open $47,767.46; Payments 3 rows, $44,093.70 with $2,690.43 tax; Change orders 2 rows, $8,740.71 charged and $1,652.70 absorbed. Download CSV gives files that open in Excel with the Total row.

---

## 26. Hosting the preview: stored files, "not live" bar (2.7.1)

The owner put `phase2.html` on the site (Oct 29). It ran as the preview, with sample data in the browser and the stored PDFs not opening. That's expected until the server work in §22 is done. Three small changes make the hosted preview honest and useful in the meantime:
- **"Preview, not the live tool" bar** at the top of every page: sample data, saved only in this browser, nothing shared, backed up or sent; don't enter real jobs. It goes away when `FM_CONFIG.live` is `true` (set in the small settings block at the top of `phase2.html`). Set it only once the server database and sign-in are connected.
- **Stored originals open from a `files` folder.** Until the server's file storage is in place (§22, item 4), Open on a signed contract or supplier order looks in `FM_CONFIG.filesBase` (default `files/`, next to `phase2.html`).
  - **Names:** the file can have its exact name (`FM-2609-314 · Braddy Builders.pdf`) or a plain version of it (`FM-2609-314-Braddy-Builders.pdf`; some hosts are fussy about spaces and "·").
  - **The check:** the browser works out the file's SHA-256 and shows the PDF only if it matches the one recorded at signing ("✓ Same file as the signed original"), with Open in a new tab and Download. A different file under that name is refused ("This isn't the signed copy"). A missing file gets instructions.
  - **Privacy:** nothing is uploaded anywhere. The check needs https, which the site has; on plain http it shows the file marked unchecked.
- **The three files** and their plain names:
  - `FM-2609-314-Braddy-Builders.pdf`
  - `Updated-Braddy-WholesaleCabinets-1000173203-2.pdf`
  - `Willow-Creek-Full-House-Order.pdf`
- **Keep the `files` folder out of public reach.** These are signed customer documents. Until staff sign-in exists, put the hosted preview and its `files` folder behind the site's password protection, or take them down.
- **Paper / Dark toggle** in the sidebar: the two halves now fill the box (no empty strip beside Dark).
- **Hermes:** at launch, Open reads the same files from server storage (keep the SHA-256 check), and `FM_CONFIG.live` becomes `true`. Remove the `files` folder from the web root.

---

## 27. Needs attention as task rows; link styling (2.7.2)

Owner, Oct 29: the Dashboard's "Needs attention" items were whole sentences styled as links, in the browser's visited purple. They now follow the pattern business tools use for things to do (Shopify Home's to-do list, "action required" lists): one row per task, with the action as a button, not a link.
- **Each row** has a status label (Overdue, Waiting, Check), a short title ("Invoice overdue", "Deposit needed before the factory order", "Invoices don't match the contract", "Invoice overpaid", "Check number missing", "Finished job still owes money"), the customer and job code, one line of detail, the amount, and one button that goes where it gets fixed ("Record payment", "Collect deposit", "Review invoices", "Add check number", "Review payments"; each opens the job's Invoices tab). Every action button has the same filled style (owner, Oct 29).
- **On a phone**, the label sits above the title, and the amount and button share the last line.
- `FMBooks.dashboard().attention[]` items now carry `kind`, `status`, `title`, `customer`, `detail`, `amountCents`, `action` and `tab`, besides the old `text`. Dates in the detail read "Sep 16, 2026".
- **Links across the app** use the ink color with a soft underline (stronger on hover), never browser blue or visited purple. Buttons drawn as links have no underline, and the sidebar and tabs have none.

## 28. Owner feedback batch, Oct 29 (2.8.0)

`UPGRADE-2.7.2-to-2.8.0.md` lists each changed file; this section is the reference.

**Navigation and tables**
- Sidebar section headings (Projects, Company books, Company) are bolder, with a rule under each. **Elevations** is a new page under Projects (`#/elevations`): every project's drawing progress, layout checks and status, with projects still being drawn first. The drawing itself still happens in each job's Elevations tab.
- Row buttons (Open, Show SKUs, Remove) sit in the middle of their row (`td.p2-act`). Phase 2 tables have a 680px minimum width, so the last column stays in view on a small laptop.

**Addresses: `src/fm-phase2-address.js` (FMAddress, new; tests/address.test.js)**
- Entered as Street, City, State, ZIP. State defaults to Colorado and can be changed (50 states and DC). Used in New Project, customer profile addresses and field measure leads.
- Stored as fields, plus the joined line that contracts and documents print. Jobs: `installAddr {street, city, state, zip}` plus `installAddress` ("414 Miners Rd, Canon City, CO 81212"). Customer addresses and `visit.lead`: the same fields plus `line` / `address`. Older one-line records still read through `FMAddress.from()` / `parse()`.
- **Server:** add the four columns where addresses are stored. Keep the joined line for documents. Validate with the same rules as `FMAddress.check()`.

**New Project**
- **Cabinets step:** a compact card per home or model. Once a supplier PDF is picked, its lines show at once (SKU, description, qty, unit cost, line cost) so they can be checked before Next.
- **Price step:** Assembly and Payment plan come first, then Markup and tax, then a tighter cabinet table with descriptions.
- **Assembly is hours × hourly rate per home.** The rate defaults to **$20.50** and the hours start blank on every job (owner, Oct 29); 0 means no assembly. Job pricing stores `assemblyHours`, `assemblyRateCents` and `assemblyCents` (the product). Quotes print it as assembly labor. Jobs priced before this keep their flat `assemblyCents`, and duplicating or copying from one leaves the hours blank, with a note.
- **Payment plan:** 50/50, 50/30/20, 100, or **+ Custom payment plan** with named payments and percentages that must total 100%. Job pricing stores `plan` (percentages), `planNames` and `planMode`. A custom plan's invoices read "Invoice 2 · Cabinets delivered · 40%", and the contract's payment schedule, the invoices and the readiness check all follow the plan.
- Number boxes (markup, hours, percentages) select their contents when tabbed or clicked into, so typing replaces the number.
- The Live total uses the body font with tabular figures (it was the display serif).
- The step tabs at the top of New Project and change orders now switch steps when clicked. They were links the app ignored.

**Elevations**
- **One click selects a cabinet** and outlines it. Before, the drag handling swallowed the click, so nothing was selected until a drag. A **Selected** bar under the drawing shows what it is and where, with ← → / Size… / **Remove**. **Delete** removes it (undo with ⌘Z) and **Esc** deselects.
- **Cabinets placed beyond the quote** get a banner in "From the quote" with the SKUs and counts:
  - On a quote: **Add them to the quote** raises those quantities at the same cost and markup, and reprices the total and invoices. **Remove the extras** takes the most recently placed ones off.
  - On a signed job: **Start a change order for them** opens a change order at its Cabinets step with the extras added. Costs come from the order or a supplier PDF; anything without a cost is flagged.

## 29. Owner feedback batch, Oct 30 (2.9.0)

`UPGRADE-2.8.0-to-2.9.0.md` lists each changed file; this section is the reference.

**Contract: Ready to contract card**
- **The deposit is due on signing** (owner decision Oct 27), so its stored date never blocks. `FMContract.readiness` (0.5.0) treats invoice 1 as due today. Only later invoices block: `duePast` if a date is past, `dueOrder` if out of order. Messages print dates as "Oct 29, 2026". The `depositPast` and `depositLate` checks are gone.
- **Contract details and payment schedule** sit on the card and can be edited until the contract goes out: customer, project, buyer signer and email, install address (FMAddress fields), install date, and invoices 2+ due dates. When the install date moves, the last invoice follows it if it was due on the old date. Each change is logged with who made it.
- **Every problem has a Fix link** to the field that fixes it, or the Cabinets tab. The "!" and "i" text prefixes are gone; problems use an alert style.

**Elevations sent incomplete, on purpose**
- If the drawings don't match the quote (no rooms, or quoted cabinets not placed), the contract is blocked until someone ticks **Send without complete elevations**. That stores `job.elevAck {by, on}` and logs it.
- The packet then flags the drawings on the summary and every elevation page: "Preliminary drawings: 9 of 12 quoted cabinets shown. Final elevations to follow before ordering." With no drawings it reads "Elevations to follow." The flag is computed live, so it disappears once a revision matches the quote. Drawings signed this way are saved as "As signed · preliminary".

**Test / Void status (Full access only)**
- **Mark Test / Void** on the job page needs a reason. It stores `job.testVoid {reason, by, on, paidCents}`, keeps the stage, and logs it. **Restore** clears it.
- **Data:** `FMStore.jobs()` and `books()` leave these jobs out. `jobs({ all: true })` includes them; use that for job-code numbering. FMBooks and FMReports also drop `testVoid` jobs from every function, as a backstop. All projects has a "Test / void · n" filter.
- **Separate from voiding a signed contract**, which is unchanged (owner, Oct 30).
- **Server:** add the `testVoid` column (JSON). Every list, total, report and export query filters it out.

**Change orders: pricing for each change order, and a document**
- **Price step:** markup on new lines, discount, G&A and tax all start from the job's values but can be changed for this change order alone. **Assembly labor** is hours × rate. **Markup per line** uses Tab-to-overwrite boxes. **Reset to job settings** puts them back.
- **Change order record:** stores `pricing` (with `labor`), `differsFromJob`, and `priced {lines, summary}`. Tax and cost come from the same numbers.
- **`FMChangeOrder.priceChange`** (0.3.0) takes `settings.labor`, applied to the added side only. It returns `lines` (removed lines are negative) and `summary` {cabinets, discount, labor, G&A, tax, total}.
- **`FMDocs.renderChangeOrderDoc`** prints the change order for the buyer to sign: lines, pricing rows, totals before and after, due date, and signature blocks. It is modeled on Willow Creek's executed change order. An **Open change order** button sits on each priced change order.

**Willow Creek change order 1, applied (owner supplied both PDFs Oct 30)**
- `FM_WILLOW_ORDER.changeOrders[0]` holds:
  - 14 lines in all three colors, with printed unit and total
  - its own pricing: **5% discount** (the job uses 12%), 2% G&A, 7.9% tax, **5 h × $20.50** assembly
  - the printed totals: $8,127.63 cabinets, −$269.44, $102.50, $159.21, $620.80, **$8,740.71**
- The seed attaches these to the existing change order 1 and adds its tax ($620.80) and cost to the job. Cost is **$5,388.80**, worked back from the discount, because the PDFs have no unit costs. Willow Creek's P&L gross profit is now $19,426.73; before, the change order counted as revenue with no cost or tax.
- **Pennies:** the printed line totals add to $8,127.64 against the $8,127.63 Cabinets row, and the printed parts add to $8,740.70 against the $8,740.71 total. Both come from the old tool's rounding and are kept as printed.
- **Two new originals for the `files/` folder** (SHA-256 in the data):
  - `FM-2609-276 · Willow Creek Estates.pdf`: the change order with its lines, 2 pages
  - `COR FM-2609-276 · Willow Creek Estates.pdf`: the change order invoice, 1 page
  - Both are in Dropbox under 719 MAIN (FREMONT MAKERS)/Projects/Willow Creek/Change Orders.

**Payment schedule after signing: `src/fm-phase2-schedule.js` (FMSchedule, new; tests/schedule.test.js, 6)**
- **Adjust schedule** on the Invoices tab lets you:
  - move due dates
  - move money between invoices
  - **split** an invoice into two (the new one is named)
  - remove an unpaid invoice
- **Locked:** paid or partly paid invoices. Change-order invoices are left out entirely.
- **Rules:** the total can't change, dates stay in order, and new dates can't be in the past.
- Who asked and why are required. **Moving money needs Full access.** Changes to dates only can be saved by anyone.
- Labels that name a share follow the new amount ("Invoice 3 · 20%" holding 10.2% becomes "Invoice 3 · 10.2%").
- Stores `job.scheduleRevisions[]`. The packet's schedule shows "Schedule: Revised <date>".
- This is separate from the Phase 1 `proposeScheduleChange` (activity log), which can't add or split invoices.

**Contract packet: full contract language: `src/fm-phase2-agreement.js` (FMAgreement, new)**
- **Packet order** now matches the signed packets:
  1. Builder order page (builder orders: models and houses)
  2. **Customer Sales Agreement**
  3. Payment schedule (each invoice has its one-line description again)
  4. Invoices
  5. Quotes
  6. Elevations
- The old "Contract summary" page and "terms are not reprinted here" note are gone.
- **The agreement** is word for word from the Willow Creek and Penrose packets: 7 sections, the governing-law line, signatures. Where the tool works differently, the wording follows it. Each difference is listed in `FMAgreement.CHANGES` and in `docs/contract-language-review.md`. **The owner approved all of them on Oct 30.** The owner also changed Goods: "no design professional services, no field measuring" is removed, because those are offered as needed and neither assumed included nor excluded. The rest of that list still says plainly what is NOT included (`FMAgreement.GOODS`).
- **`renderPacket` opts:** `stages`, `bid`, `assembly`, `dates`, `fmSignerName`, `models`, `signedAgreementFile`. The preview builds them in `packetOpts(j)`.
- **Load order:** `fm-phase2-agreement.js` loads before `fm-phase1-docs.js` (phase2.html and preview.html).

**Tests:** 17 files, 189 tests, all passing: contract 22, changeorder 15, docs 10, store 8, schedule 6 (new); the rest unchanged.
