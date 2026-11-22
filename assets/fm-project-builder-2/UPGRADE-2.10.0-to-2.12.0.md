# Upgrade: Project Builder 2.10.0 → 2.12.0

**Date:** 2026-11-12. **Update package:** `fm-project-builder-update-2.10.0-to-2.12.0.zip`. It holds every file changed since 2.10.0, so it **covers 2.11.0 and 2.11.1 too**, which were never installed separately.

1. Start from 2.10.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted.

## Read first (owner)
**Updates never overwrite data. This applies to this update and every update after it.** The full rule is HANDOFF §0 rule 9.
1. **Back up the database and file storage before installing.** Keep the backup until the owner says the update is good.
2. **Installing a package changes code only.** Never reset, reseed or re-import over live data. The sample and seed files and `tests/fixtures/` are for the preview, the tests and the first import only.
3. **Create the live store with `FMStore.create({ live: true, … })`.**
   - It skips the preview's seed corrections and refuses reset.
   - Keep **Reset sample data** off the live site.
4. **New fields get a default; existing values stay.** This release adds one top-level list, `requests`.
   - When the owner wants an existing record corrected, make it a logged edit in the tool, with their OK.
5. **Never delete or replace** uploads, signed copies, certificates, signing history or requests.
6. If anything seems to need changing existing data, **ask the owner first.**

Every 2.10.0 rule still applies:
- The new tool lives at `/projectbuilder`.
- `/quote` stays live and unchanged.
- The feature flag is `fm_phase1`.
- Legacy data is read-only.
- Styles stay scoped to `.fm-p1`.

**One customer PDF goes to file storage separately:** `FM-2609-314 · Braddy Builders COR 1.pdf`. Its SHA-256 is `8bbd4a2c83b3b68a8e2734d3b08d55765ccc3b02453e88650d7038d072d02bb6`. Zips never carry customer PDFs.

## What's in it

| Version | What | Detail |
|---|---|---|
| 2.11.0 (Nov 6) | **Signing in the tool** with a certificate of completion, and signing outside the tool. **Dropbox Sign is on hold** (don't build §33). **Supporting documents** in the Documents tab. The Braddy change order 1 PDF. **Change orders for every kind of change.** | HANDOFF §32–§34, `UPGRADE-2.10.0-to-2.11.0.md` (included) |
| 2.11.1 (Nov 9) | **Updates never overwrite data** (rule above). The **customer signing page stands alone**, with a confirmation and no way into the tool. **Upload SKUs / Paste SKUs** on change orders. | HANDOFF §0 rule 9, §35, `UPGRADE-2.10.0-to-2.11.1.md` (included) |
| 2.12.0 (Nov 12) | **"Need an update?"**: a button on every page for the team to report a problem, a wrong number, being stuck, or an idea. It's emailed to the owner and listed under Company › Update requests. | HANDOFF §36 |

## Files new or changed in 2.12.0

| File | Why |
|---|---|
| `src/fm-phase2-requests.js` | **New.** `window.FMRequests` 1.0.0: kinds, where they were, checks, the request record, the email, statuses, notes |
| `preview/phase2-requests.js` | **New.** The floating button, the three-step form, the Update requests page (`#/updates`), and the capture of recent screen errors |
| `tests/requests.test.js` | **New.** 7 tests |
| `src/fm-phase2-store.js` | `requests()`, `nextRequestNumber()`, `addRequest`, `updateRequest`. Kept in their own `requests` list (an added field). |
| `preview/phase2-app.js` | The route, the sidebar link with its open count, the button, and the event hooks |
| `phase2.html` | Loads the two scripts; styles |
| `HANDOFF.md`, `HERMES-LAUNCH.md`, `RELEASE-NOTES.md`, `MANIFEST.json` | 2.12.0. §36. Test table. The new release notes entry. |
| `UPGRADE-2.10.0-to-2.12.0.md` | This note |

The 2.11.0 and 2.11.1 files are listed in their own UPGRADE notes. All of them are in this zip.

## Server work
- **From 2.11.x:**
  - the signing endpoints and the standalone signing page (§34, §35)
  - file storage for Documents uploads (§32)
  - the supplier PDF reader for Upload SKUs (§35)
  - `live: true` on the live store
  - the backup step before every update
- **New in 2.12.0 (§36):**
  - `POST /api/projectbuilder/requests` (signed in). Body: `{ to, subject, text, request, screenshots: [{ name, type, base64 }] }` → `{ ok: true }`.
    - **Hard-code the recipient server-side as `lwyss@unbridled.com`.** Ignore `to` from the page.
    - Use the same email sender and the same request shape as TJ's Log & Timber ("Need an update?", their `HERMES-HANDOFF.md` §14). The one difference: Fremont sends a `screenshots` array (up to 3, 10 MB each), not a single `screenshot`.
    - Save the request in `requests` and record when the email went out.
  - `PATCH /api/projectbuilder/requests/:id` for status changes (Full access only) and notes (anyone signed in).
  - Set `FM_CONFIG.version` to `2.12.0`.

## Release notes
Add the three entries in `RELEASE-NOTES.md` (2.12.0, 2.11.1, 2.11.0) **at the top** of https://tools.fremontmakers.com/release-notes, newest first. Keep the page's format (date · version · short cards). Don't change older entries. They describe the new Project Builder at `/projectbuilder`.

## Check
1. All tests pass: **22 files, 262 tests**.
   - New: `requests` 7, `sign` 15, `files` 10.
   - Changed: `store` 14, `changeorder` 27, `contract` 26.
2. On staging, after a backup: install, then confirm existing jobs, payments and files are unchanged (same counts and balances as before).
3. Work through HANDOFF **§34, §35 and §36 "Check"**.
4. Send a test "Need an update?" and confirm the email reaches lwyss@unbridled.com, with the screenshot attached.
5. The release notes page shows the 2.12.0 entry at the top.
