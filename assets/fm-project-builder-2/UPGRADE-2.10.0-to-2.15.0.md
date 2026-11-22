# Upgrade: Project Builder 2.10.0 → 2.15.0

**Date:** 2026-11-19. **Update package:** `fm-project-builder-update-2.10.0-to-2.15.0.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0, 2.11.1, 2.12.0, 2.13.0, 2.14.0 and 2.15.0**. (Already installed 2.14.0? `fm-project-builder-update-2.14.0-to-2.15.0.zip` in All versions has only this release's files. Copying either one over gives the same result.)

1. Start from 2.10.0, or from 2.14.0 if you installed it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted. If you received the 2.14.0 package but haven't installed it, use this one instead.

## Read first (owner): updates never overwrite data
This applies to this update and every update after it. The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner confirms.
2. **Never reset, reseed or re-import over live data.** Create the live store with `FMStore.create({ live: true, journal, … })`. Leave **Reset sample data** off the live site.
3. **New fields get defaults; existing records stay as they are.** Since 2.10.0 these are added, and never filled in on old records:
   - on jobs (2.14.0): `jobCosts`, `review`, `referrals`, `referredBy`, `taxRate`
   - company settings: `reviewLink` (2.14.0; Full access only; must start with https://) and **`emailTemplates`** (2.15.0; Full access only; `{ <kind>: { subject, body } }`; none saved means the original wording)
   - Job P&L reads `actualCostCents` from `FMStore.toBooks`. It is `null` until someone logs a job cost, so existing jobs show the same numbers as before.
4. **Nothing in 2.14.0 or 2.15.0 rewrites existing data.**
   - Removing a job cost marks it removed and keeps it.
   - Board moves are the same logged actions as the job page.
   - A tax rate can only be set on an unsigned quote that isn't out for signature.
   - Writing an email to the customer changes nothing on the job. Email templates are a company setting and never touch a job.

   `tests/store.test.js` checks that data saved before 2.14.0 loads unchanged in a live store, that nothing is saved just by loading it, and that email templates never touch a job.
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
| 2.14.0 | Job costs from supplier invoices (Job P&L uses what was actually paid), the order board, close-out with a printable handoff packet, review and referrals, sales tax from the site address. Assembly labor stays untaxed (owner). | `UPGRADE-2.10.0-to-2.14.0.md`, HANDOFF §42 |
| **2.15.0** | The owner's review of 2.14.0: **Start: + Project / + Design**, click anywhere on a row, the design on Overview, new change orders open at the top, **emails to the customer** (ten templates, Company → Email templates), order board fix buttons | HANDOFF **§43** |

## New files in 2.15.0

| File | What |
|---|---|
| `src/fm-phase2-emails.js` | `FMEmails`: the ten customer email templates, filling them in from a job, which ones fit where the job is, checking a reworded template |
| `preview/phase2-emails.js` | The screens: Overview → Email the customer, Company → Email templates |
| `tests/emails.test.js` | 5 tests |
| `UPGRADE-2.10.0-to-2.15.0.md` | This note |

**Changed in 2.15.0:**
- `src/fm-phase2-closeout.js` (1.1.0): `blocker`, `fixFor`; `moveTo` returns `fix` and `stoppedAt` when a move is blocked
- `src/fm-phase2-store.js`: the `emailTemplates` setting (Full access only, logged)
- `preview/phase2-app.js`: Start buttons, click-anywhere rows, the Email templates route and sidebar link, the design and email cards on Overview
- `preview/phase2-elevations.js`: `P2Elev.hero` (the design card)
- `preview/phase2-flows.js`: the new change order opens at the top
- `preview/phase2-group3.js`: order board blockers and fix buttons
- `preview/phase2-sign.js`, `preview/phase2-invoicing.js`: signing and invoice emails use the templates
- `preview/phase2-search.js`: "Search"
- `phase2.html`
- `HANDOFF.md`, `HERMES-LAUNCH.md`, `RELEASE-NOTES.md`, `MANIFEST.json`
- `tests/closeout.test.js`, `tests/store.test.js`

## Server work
- **New in 2.15.0: none required.** When the server sends customer email (§39), build the subject and text with `FMEmails.compose(kind, FMEmails.varsFor(job, …), settings.emailTemplates)` so the team's wording is what goes out. Store `emailTemplates` with the other company settings.
- **From 2.14.0, if not done yet (HANDOFF §42):**
  - Sales tax lookup: `GET /api/projectbuilder/tax-rate?address=…` returns `{ ratePct, parts: [{ name, pct }] }`, with the parts adding up to the rate. Until it exists, the page tells the team to type the rate.
  - CSP: the handoff packet's QR code loads qrcodejs 1.0.0 from cdnjs.cloudflare.com (already allowed for the PDF reader, §40).
  - Supplier invoice PDFs under job costs are filed through the same file storage as other documents (kind `supplier-order`, SHA-256).
- **Still to do from 2.11–2.13:**
  - signing (§34, §35, §38)
  - invoice and finance email (§39)
  - "Need an update?" (§36)
  - file storage (§32)
  - the store journal (§41)
  - CSP for the PDF reader (§40)
  - the backup before every update

## Release notes
Add the entries in `RELEASE-NOTES.md` **at the top** of https://tools.fremontmakers.com/release-notes, newest first: 2.15.0, plus 2.14.0, 2.13.0, 2.12.0, 2.11.1 and 2.11.0 if they aren't published yet. Don't change older entries.

## Check
1. All tests pass: **29 files, 305 tests** (table in `HERMES-LAUNCH.md` §1).
2. On staging, after a backup: install, then confirm that existing jobs, payments, files and Job P&L numbers are unchanged.
3. Work through the "Check" list in HANDOFF **§43**, and §42 and §34–§41 if 2.11–2.14 weren't installed.
4. The release notes page shows 2.15.0 at the top.
