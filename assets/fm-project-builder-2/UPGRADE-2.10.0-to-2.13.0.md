# Upgrade: Project Builder 2.10.0 → 2.13.0

**Date:** 2026-11-19. **Update package:** `fm-project-builder-update-2.10.0-to-2.13.0.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0, 2.11.1, 2.12.0 and 2.13.0**. (Already installed 2.12.0? `fm-project-builder-update-2.12.0-to-2.13.0.zip` in All versions has only this release's files. Copying either over gives the same result.)

1. Start from 2.10.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

## Read first (owner)
**Updates never overwrite data. This applies to this update and every update after it.** The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner confirms.
2. **Never reset, reseed or re-import over live data.** Create the live store with `FMStore.create({ live: true, journal, … })`.
3. **New fields get defaults; existing records stay.** This release adds, and never fills in on old records:
   - top-level: `designTemplate` records, `settings`, `requests`
   - on jobs: `designFirst`, `fromDesign`, `designApproval`, `designApprovalSkipped`, `designSign`, `estimateApproval`, `extras`, `salesperson`, `contractTerms`, `financeSent`, `copiedFromOrder`
   - on invoices: `number`, `taxCents`, `preTaxCents`, `issuedAt`, `sent`
   - on change orders: `house` may be `__order` or `__every`
4. **Never backfill an approval onto a signed job.** Never delete uploads, signed copies or signing history.
5. If anything seems to need changing existing data, **ask the owner first.**

Every 2.10.0 rule still applies:
- The new tool lives at `/projectbuilder`.
- `/quote` stays live and unchanged.
- The feature flag is `fm_phase1`.
- Legacy data is read-only.
- Styles stay scoped to `.fm-p1`.

**One customer PDF goes to file storage separately** (if not already stored): `FM-2609-314 · Braddy Builders COR 1.pdf`, SHA-256 `8bbd4a2c83b3b68a8e2734d3b08d55765ccc3b02453e88650d7038d072d02bb6`.

## What's in it

| Version | What | Where |
|---|---|---|
| 2.11.0 | Signing in the tool with a certificate; signing outside the tool; supporting documents; change orders for every kind of change. **Dropbox Sign is on hold** (don't build §33). | `UPGRADE-2.10.0-to-2.11.0.md`, HANDOFF §32–§34 |
| 2.11.1 | Updates never overwrite data; the standalone signing page; Upload / Paste SKUs on change orders | `UPGRADE-2.10.0-to-2.11.1.md`, §0 rule 9, §35 |
| 2.12.0 | "Need an update?" (email to the owner) | `UPGRADE-2.10.0-to-2.12.0.md`, §36 |
| **2.13.0** | Designs and design approval, the step-by-step estimate, the contract builder, initials and countersign notices, invoices to the customer and to finance (Sara Thorp), drag uppers up and down, Add check #, New Project without cabinets, change orders for additional products and the whole order or every house, supplier PDFs read in the browser (text or OCR), five project steps with Next up, Today, the save journal, search, salesperson, drawing approval | HANDOFF **§37–§41** |

## New files in 2.13.0

| File | What |
|---|---|
| `src/fm-phase2-estimate.js` | `FMEstimate`: the estimate's totals, review, approval and design approval |
| `src/fm-phase2-designs.js` | `FMDesigns`: the Designs library, starting a project from a design |
| `src/fm-phase2-invoicing.js` | `FMInvoicing`: issuing invoices, ready to send, customer and finance emails |
| `src/fm-phase2-supplierpdf.js` | `FMSupplierPdf`: turns a supplier PDF's text into items, fees and totals |
| `src/fm-phase2-steps.js` | `FMSteps`: the five project steps, Next up, the Today list |
| `preview/phase2-estimate.js`, `phase2-designs.js`, `phase2-contract.js`, `phase2-invoicing.js`, `phase2-pdf.js`, `phase2-search.js` | The screens for each |
| `tests/estimate`, `designs`, `invoicing`, `supplierpdf`, `steps` | 5, 4, 5, 3 and 4 tests |
| `UPGRADE-2.10.0-to-2.13.0.md` | This note |

**Changed:**
- `src/fm-phase2-sign.js` (1.1.0)
- `src/fm-phase1-docs.js`
- `src/fm-phase1-print.css`
- `src/fm-phase2-elevations.js`
- `src/fm-phase2-store.js`
- `src/fm-phase2-changeorder.js`
- `preview/phase2-app.js`, `preview/phase2-flows.js`, `preview/phase2-sign.js`, `preview/phase2-elevations.js`
- `phase2.html`
- `HANDOFF.md`, `HERMES-LAUNCH.md`, `RELEASE-NOTES.md`, `MANIFEST.json`
- tests

## Server work (new in 2.13.0; details in HANDOFF §37–§41)
- **The public signing page:** the welcome, the highlighted sections with initial buttons, and initials in the sign request. The countersign email (plus the salesperson) when the buyer signs. The final PDF writes the initials and signatures into the agreement, then the certificate. Exhibit A documents are appended as Addendum A-n **before** the fingerprint is taken.
- **Design approval requests:** the same signing service; the request kind is `design`, acknowledgement only.
- **Invoices:** `POST /api/projectbuilder/invoices/send` and `/invoices/finance`, with PDFs attached. Live, also send the deposit invoice automatically when the contract is fully signed. The finance email is a company setting (Sara Thorp, sthorp@unbridled.com).
- **Supplier PDF reading:** allow cdnjs and jsdelivr in the CSP (pdf.js, tesseract.js), or run the same reading on the server and return the `FMSupplierPdf.parse` shape.
- **Store:** the `journal` for the live store; `settings`; reports exclude `designTemplate` records.
- **Still from 2.11–2.12:**
  - the signing endpoints and the standalone page (§34, §35)
  - file storage (§32)
  - the "Need an update?" email (§36)
  - the backup before every update

## Release notes
Add the entries in `RELEASE-NOTES.md` (2.13.0, 2.12.0, 2.11.1, 2.11.0; any not already published) **at the top** of https://tools.fremontmakers.com/release-notes, newest first. Don't change older entries.

## Check
1. All tests pass: **27 files, 289 tests** (table in `HERMES-LAUNCH.md` §1).
2. On staging, after a backup: install, then confirm existing jobs, payments and files are unchanged.
3. Work through the "Check" lists in HANDOFF **§37–§41** (and §34–§36 if 2.11–2.12 weren't installed).
4. The release notes page shows 2.13.0 at the top.
