# Upgrade: Project Builder 2.10.0 → 2.16.0

**Date:** 2026-11-20. **Update package:** `fm-project-builder-update-2.10.0-to-2.16.0.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0, 2.11.1, 2.12.0, 2.13.0, 2.14.0, 2.15.0 and 2.16.0**. (Already installed 2.15.0? `fm-project-builder-update-2.15.0-to-2.16.0.zip` in All versions has only this release's files. Copying either one over gives the same result.)

1. Start from 2.10.0, or from 2.15.0 if you installed it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted. If you received the 2.15.0 package but haven't installed it, use this one instead.

## Read first (owner): updates never overwrite data
This applies to this update and every update after it. The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner confirms.
2. **Never reset, reseed or re-import over live data.** Create the live store with `FMStore.create({ live: true, journal, … })`. Leave **Reset sample data** off the live site.
3. **New fields get defaults; existing records stay as they are.** Since 2.10.0 these are added, and never filled in on old records:
   - on jobs (2.14.0): `jobCosts`, `review`, `referrals`, `referredBy`, `taxRate`
   - on jobs (**2.16.0**): `supplierOrders` and `claims` (shapes at the top of `src/fm-phase2-shipping.js`). Missing means none.
   - company settings: `reviewLink` (2.14.0), `emailTemplates` (2.15.0) and **`cabinetColors`** (2.16.0; Full access only; `[catalog key | { key, name, hex }]`; none saved means the catalog colors only)
   - company data (**2.16.0**): **`mailIn`**, the Wholesale Cabinets inbox list. It's created when the first email arrives, never on load, and items are never deleted.
   - Job P&L reads `actualCostCents` from `FMStore.toBooks`. It is `null` until someone logs a job cost.
4. **Nothing in 2.16.0 rewrites existing data.**
   - Removing a claim item marks it removed and keeps it.
   - `updateMailIn` changes only `status`, `jobCode`, `filedBy`, `filedOn`, `auto`, `reason` and `error`. What was read from the email stays as it was.
   - Filing an email on a job adds an order or a shipment, or fills in **blank** fields on an order whose # was typed. Nothing already entered changes.
   - Editing who signs (§44) updates the same job fields the Contract tab does before signing, logged. Signed copies and signing history are untouched.
   - Invoices, the contract and the books are untouched by shipping and the inbox. Invoice timing stays as it is (owner).

   `tests/store.test.js` and `tests/mailin.test.js` check that a live store adds nothing just by loading, that the raw email is never stored, and that only the inbox fields can change.
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
| 2.13.0 | Designs and design approval, the step-by-step estimate, the contract builder, invoices to the customer and to finance, change orders for additional products, supplier PDFs, five project steps, Today, search, the save journal | `UPGRADE-2.10.0-to-2.13.0.md`, §37–§41 |
| 2.14.0 | Job costs, the order board, close-out with the handoff packet, review and referrals, sales tax from the site address | `UPGRADE-2.10.0-to-2.14.0.md`, §42 |
| 2.15.0 | Start buttons, click-anywhere rows, the design on Overview, emails to the customer, order board fix buttons | `UPGRADE-2.10.0-to-2.15.0.md`, §43 |
| **2.16.0** | **§44:** change orders end in Finalize; who signs fixed in place; Fix a mistake; invoices in the original change order look, lines grouped by color; cabinet colors. **§45:** shipping, receiving and damage claims. **§46:** the Wholesale Cabinets inbox (forwards from hello@fremontmakers.com to fremontmakers@gmail.com go on their jobs) | HANDOFF **§44–§46** |

## New files in 2.16.0

| File | What |
|---|---|
| `src/fm-phase2-shipping.js` | `FMShipping` 1.0.0: reading Wholesale Cabinets emails (payment details never read), supplier orders, shipments, receiving, the 5-day window, claims, the status line, close-out blocker |
| `src/fm-phase2-mailin.js` | `FMMailIn` 1.0.0: unwrapping forwards, the sender check (Wholesale Cabinets, or a forward from hello@fremontmakers.com), matching to a job, auto-filing, carrier-only links |
| `src/fm-phase2-colors.js` | `FMColors` 1.0.0: the 88 catalog colors with chips, plus the team's own |
| `preview/phase2-shipping.js` | The Shipping tab, receiving, claims, the claim packet and checklist, the Shipping page |
| `preview/phase2-mailin.js` | The Inbox card, Today lines, the count, the preview-only simulator |
| `preview/phase2-colors.js` | The color picker and + Add a color |
| `tests/shipping.test.js`, `tests/mailin.test.js`, `tests/colors.test.js` | 6, 8 and 4 tests |
| `tests/fixtures/wc-emails.js` | The owner's two real Wholesale Cabinets emails, with mail-server headers, the attachment and card digits removed |
| `UPGRADE-2.10.0-to-2.16.0.md` | This note |

**Changed in 2.16.0:**
- `src/fm-phase2-store.js`: `mailIn()`, `addMailIn`, `updateMailIn`; the `cabinetColors` setting; shipping and claim saves
- `src/fm-phase1-docs.js` (1.5.0), `src/fm-phase1-print.css`: the invoice and change order look, lines grouped by color
- `src/fm-phase1-ledger.js`: "Record delivery or pickup"
- `src/fm-phase2-steps.js`: Next up follows the shipping step
- `src/fm-phase2-closeout.js`: open claims block close-out and the move to Complete
- `src/fm-phase2-emails.js`: four shipping emails to the customer
- `src/fm-phase2-designs.js`, `src/fm-phase2-elevations.js`: any color (catalog key, team color or #hex)
- `preview/phase2-app.js`, `preview/phase2-flows.js`, `preview/phase2-sign.js`, `preview/phase2-group3.js`, `preview/phase2-designs.js`, `preview/phase2-elevations.js`, `phase2.html`
- `HANDOFF.md`, `HERMES-LAUNCH.md`, `RELEASE-NOTES.md`, `MANIFEST.json`
- `tests/closeout.test.js`, `tests/docs.test.js`, `tests/store.test.js`

## Server work

### New in 2.16.0: the Wholesale Cabinets inbox (HANDOFF §46)
How it works: Wholesale Cabinets emails hello@fremontmakers.com. That mailbox forwards them to **fremontmakers@gmail.com**. The server reads that inbox and the tool files each email on its job. The full steps are in §46 "Server work"; in short:
1. **Gmail API** access to fremontmakers@gmail.com: OAuth client with the consent screen **In production**, scope `gmail.modify`, the owner signs in once, and the refresh token goes in the server's secret store (never the repo, chat or email). Fallback: IMAP with an app password.
2. **Every 5 minutes:** list `in:inbox -label:PB-read newer_than:30d`, get each message as raw, then `FMMailIn.ingest(raw, { jobs, linesOf, settings, receivedAt, forwarderAuth })` → `store.addMailIn(item)` → if `FMMailIn.autoFile(item)`, file it as `P2Mail.fileOn` does (`FMMailIn.file`, `applyAction 'order'` when asked, `store.update`, `store.updateMailIn`).
3. **Forwards from hello@fremontmakers.com:** if the original Wholesale Cabinets headers survive the forward, they decide. If they're stripped, an email from hello@ is trusted, **unless** Gmail's `Authentication-Results` lacks `dmarc=pass` for fremontmakers.com: then pass `forwarderAuth: false` and it's set aside.
4. **Label, never delete:** `PB-read` plus `PB-filed`, `PB-needs-job` or `PB-not-for-a-job`. Discard the raw email after `ingest` and never log it.
5. **First run:** the last 30 days once. Orders already on jobs come up as duplicates and are marked filed.
6. **Monitoring:** if the token stops working, a banner on the Shipping page and a daily email to the owner until fixed.
7. Nothing is ever sent to Wholesale Cabinets or customers by the server; a person reviews and sends.

### Also new in 2.16.0
- Shipping photos and bills of lading are filed through the same file storage as other documents (§32).
- **Fix a mistake** (§44) uses the signing cancel-and-resend already listed in §34 (`FMSign.cancel`).
- CSP: nothing new in the browser.

### Still to do from 2.11–2.15, if not done yet
- sales tax lookup `GET /api/projectbuilder/tax-rate?address=…` (§42)
- customer email built with `FMEmails.compose` (§43)
- signing (§34, §35, §38), invoice and finance email (§39), "Need an update?" (§36), file storage (§32), the store journal (§41), CSP for the PDF reader (§40)
- the backup before every update

## Release notes
Add the entries in `RELEASE-NOTES.md` **at the top** of https://tools.fremontmakers.com/release-notes, newest first: 2.16.0, plus 2.15.0, 2.14.0, 2.13.0, 2.12.0, 2.11.1 and 2.11.0 if they aren't published yet. Don't change older entries.

## Check
1. All tests pass: **32 files, 325 tests** (table in `HERMES-LAUNCH.md` §1).
2. On staging, after a backup: install, then confirm that existing jobs, payments, files and Job P&L numbers are unchanged, and that the store has no `mailIn` until the first email.
3. Work through the "Check" lists in HANDOFF **§44, §45 and §46**, and §34–§43 if 2.11–2.15 weren't installed.
4. With the Gmail reader running: forward one Wholesale Cabinets shipment email from hello@fremontmakers.com. Within 5 minutes it shows in **Shipping → Inbox** (filed by itself if its order # is on a job), and the Gmail message has the `PB-read` label.
5. The release notes page shows 2.16.0 at the top.
