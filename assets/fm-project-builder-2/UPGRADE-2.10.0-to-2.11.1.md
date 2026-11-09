# Upgrade: Project Builder 2.10.0 → 2.11.1

**Date:** 2026-11-09. **Update package:** `fm-project-builder-update-2.10.0-to-2.11.1.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0 too**: install this one instead of 2.11.0. (Already installed 2.11.0? Copying these files over it gives the same result.)
1. Start from 2.10.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

## Read first (owner, Nov 9)
**Updates never overwrite data. This applies to this update and every update after it.** The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner says the update is good.
2. **Installing a package changes code only.** Never reset, reseed or re-import over live data. The sample and seed files and `tests/fixtures/` are for the preview, the tests and the one-time first import.
3. **Create the live store with `FMStore.create({ live: true, … })`.**
   - It skips the preview's seed corrections (`upgrade()`) and refuses reset. `tests/store.test.js` checks this.
   - Don't put **Reset sample data** on the live site.
4. **New fields get a default.** Existing values stay as they are.
   - When the owner wants an existing record corrected, make it a logged edit in the tool, with their OK.
5. **Never delete or replace** uploads, signed copies, certificates or signing history.
6. If anything seems to need changing existing data, **ask the owner first.**

Every 2.10.0 rule still applies:
- The new tool lives at `/projectbuilder`.
- `/quote` stays live and unchanged.
- The feature flag is `fm_phase1`.
- Legacy data is read-only.
- Styles stay scoped to `.fm-p1`.

## What's in it
- **Everything in 2.11.0**, written up in `UPGRADE-2.10.0-to-2.11.0.md` (included):
  - signing in the tool with a certificate of completion, plus signing outside the tool (HANDOFF §34); Dropbox Sign is on hold (§33)
  - supporting documents (§32)
  - the Braddy change order 1 PDF
  - change orders for every kind of change
  - **One customer PDF goes to file storage separately:** `FM-2609-314 · Braddy Builders COR 1.pdf`, SHA-256 `8bbd4a2c83b3b68a8e2734d3b08d55765ccc3b02453e88650d7038d072d02bb6`.
- **New in 2.11.1** (HANDOFF §35):
  - **The customer's signing page stands alone.** It's served outside the app shell, with no links into the tool. After signing it shows a confirmation, and **View or save your signed copy** once everyone has signed. The striped "Preview only" bar is for the preview only; don't build it.
  - **Upload SKUs and Paste SKUs** on the change order Cabinets step. CSV and text files are read by `FMChangeOrder.parseSkus`. Supplier PDFs go to the shared supplier PDF reader (return `{ lines: [{ sku, qty, desc, unitCostCents }] }`) and are filed under the change order.
  - **Live store guard:** `FMStore.create({ live: true })` (see above).

## Files changed since 2.11.0

| File | Why |
|---|---|
| `src/fm-phase2-store.js` | `live: true`: no seed corrections on load, reset refused |
| `src/fm-phase2-changeorder.js` | `parseSkus` (pasted lists, CSV, TSV, with or without a header) |
| `preview/phase2-sign.js` | Signing page without tool links; confirmation screen; signed copy opens on the page |
| `preview/phase2-flows.js` | Upload SKUs / Paste SKUs; supplier PDFs attached to the new change order |
| `phase2.html` | Styles for the confirmation, the preview-only bar and the SKU tools |
| `tests/store.test.js`, `tests/changeorder.test.js` | +1 live-store test, +2 SKU-list tests |
| `HANDOFF.md` | §0 rule 9 (never overwrite data). Seed upgrades marked preview-only. §35. Current state. |
| `HERMES-LAUNCH.md` | Rule 6 (never overwrite data). Test table. |
| `RELEASE-NOTES.md` | **new:** the release notes entries for 2.11.0 and 2.11.1 |
| `MANIFEST.json`, `UPGRADE-2.10.0-to-2.11.1.md` | 2.11.1 |

For everything that changed from 2.10.0 to 2.11.0, see `UPGRADE-2.10.0-to-2.11.0.md`.

## Server work
- Everything in `UPGRADE-2.10.0-to-2.11.0.md` (signing endpoints, file storage).
- The standalone signing page (§35).
- The PDF endpoint for Upload SKUs (the same reader as New Project).
- `live: true` on the live store.
- **The backup step before every update.**

## Release notes
Add the two entries in `RELEASE-NOTES.md` **at the top** of https://tools.fremontmakers.com/release-notes, newest first. Keep the page's format (date · version · short cards). Don't change older entries. They describe the new Project Builder at `/projectbuilder`.

## Check
1. All tests pass: **21 files, 255 tests**.
   - `store` 14 and `changeorder` 27.
   - `sign` 15, `files` 10, `contract` 26.
2. On staging, after a backup: install, then confirm existing jobs, payments and files are unchanged (same counts and balances as before the update).
3. Work through **HANDOFF §34 "Check"** and **§35 "Check"**.
4. The release notes page shows the 2.11.1 entry at the top.
