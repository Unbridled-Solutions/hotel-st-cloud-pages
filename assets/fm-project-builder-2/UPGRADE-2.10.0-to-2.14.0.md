# Upgrade: Project Builder 2.10.0 → 2.14.0

**Date:** 2026-11-19. **Update package:** `fm-project-builder-update-2.10.0-to-2.14.0.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0, 2.11.1, 2.12.0, 2.13.0 and 2.14.0**. (Already installed 2.13.0? `fm-project-builder-update-2.13.0-to-2.14.0.zip` in All versions has only this release's files. Copying either one over gives the same result.)

1. Start from 2.10.0, or from 2.13.0 if you installed it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

## Read first (owner): updates never overwrite data
This applies to this update and every update after it. The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner confirms.
2. **Never reset, reseed or re-import over live data.** Create the live store with `FMStore.create({ live: true, journal, … })`. Leave **Reset sample data** off the live site.
3. **New fields get defaults; existing records stay as they are.** This release adds, and never fills in on old records:
   - on jobs: `jobCosts`, `review`, `referrals`, `referredBy`, `taxRate`
   - company settings: `reviewLink` (Full access only; must start with https://)
   - Job P&L reads `actualCostCents` from `FMStore.toBooks`. It is `null` until someone logs a job cost, so existing jobs show the same numbers as in 2.13.0.
4. **Nothing in 2.14.0 rewrites existing data.**
   - Removing a job cost marks it removed and keeps it.
   - Board moves are the same logged actions as the job page.
   - A tax rate can only be set on an unsigned quote that isn't out for signature.

   `tests/store.test.js` checks that data saved before 2.14.0 loads unchanged in a live store, and that nothing is saved just by loading it.
5. Never backfill an approval onto a signed job. Never delete uploads, signed copies or signing history.
6. If anything seems to need changing existing data, **ask the owner first.**

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
| 2.13.0 | Designs and design approval, the step-by-step estimate, the contract builder, initials and countersign notices, invoices to the customer and to finance, change orders for additional products and the whole order, supplier PDFs read in the browser, five project steps, Today, search, the save journal | `UPGRADE-2.10.0-to-2.13.0.md`, §37–§41 |
| **2.14.0** | Job costs from supplier invoices (Job P&L uses what was actually paid), the order board, close-out with a printable handoff packet, review and referrals, sales tax from the site address. Assembly labor stays untaxed (owner). | HANDOFF **§42** |

## New files in 2.14.0

| File | What |
|---|---|
| `src/fm-phase2-closeout.js` | `FMCloseout`: job costs, margin against the estimate, board moves, the close-out check, review and referrals, the care guide, the warranty end date, the tax rate check and "what's taxed" |
| `preview/phase2-group3.js` | The screens: Order board, Job costs, Close out and the handoff packet, the sales tax panel |
| `tests/closeout.test.js` | 8 tests |
| `UPGRADE-2.10.0-to-2.14.0.md` | This note |

**Changed:**
- `src/fm-phase2-store.js`: `toBooks` adds `actualCostCents`; the `reviewLink` setting is checked
- `src/fm-phase2-books.js`: Job P&L uses the actual cost when logged (`costActual`)
- `preview/phase2-app.js`: the Order board route and sidebar link, the close-out card on Overview, job costs on Invoices, "actual" on Job P&L
- `preview/phase2-flows.js`: a referral starts New Project with `referredBy`
- `preview/phase2-estimate.js`: the tax panel on step 2
- `phase2.html`
- `HANDOFF.md`, `HERMES-LAUNCH.md`, `RELEASE-NOTES.md`, `MANIFEST.json`
- `tests/store.test.js`

## Server work (new in 2.14.0; details in HANDOFF §42)
- **Sales tax lookup:** `GET /api/projectbuilder/tax-rate?address=…` returns `{ ratePct, parts: [{ name, pct }] }`, with the parts adding up to the rate. Use Colorado's sales tax lookup or your provider. Until it exists, the page tells the team to type the rate.
- **CSP:** the handoff packet's QR code loads qrcodejs 1.0.0 from cdnjs.cloudflare.com. That host is already allowed for the PDF reader (§40).
- **Supplier invoice PDFs** under job costs are filed through the same file storage as other documents (kind `supplier-order`, SHA-256).
- **Still to do from 2.11–2.13:**
  - signing (§34, §35, §38)
  - invoice and finance email (§39)
  - "Need an update?" (§36)
  - file storage (§32)
  - the store journal (§41)
  - CSP for the PDF reader (§40)
  - the backup before every update

## Release notes
Add the entries in `RELEASE-NOTES.md` **at the top** of https://tools.fremontmakers.com/release-notes, newest first: 2.14.0, plus 2.13.0, 2.12.0, 2.11.1 and 2.11.0 if they aren't published yet. Don't change older entries.

## Check
1. All tests pass: **28 files, 298 tests** (table in `HERMES-LAUNCH.md` §1).
2. On staging, after a backup: install, then confirm that existing jobs, payments, files and Job P&L numbers are unchanged.
3. Work through the "Check" list in HANDOFF **§42**, and §34–§41 if 2.11–2.13 weren't installed.
4. The release notes page shows 2.14.0 at the top.
