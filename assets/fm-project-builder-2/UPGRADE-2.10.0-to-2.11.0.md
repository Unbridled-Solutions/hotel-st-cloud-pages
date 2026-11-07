# Upgrade: Project Builder 2.10.0 → 2.11.0

**Date:** 2026-11-06. **Update package:** `fm-project-builder-update-2.10.0-to-2.11.0.zip`. It holds only the files listed below.

1. Start from 2.10.0 as you have it.
2. Copy these files over it.
3. Check them against `MANIFEST.json`.

Nothing was deleted. The rules haven't changed:
- The new tool lives at `/projectbuilder`.
- `/quote` stays live and unchanged.
- The feature flag is `fm_phase1`.
- Legacy data is read-only.
- Styles stay scoped to `.fm-p1`.

**One new customer PDF goes to file storage separately:** `FM-2609-314 · Braddy Builders COR 1.pdf` (2 pages, 401,071 bytes). Its SHA-256 is `8bbd4a2c83b3b68a8e2734d3b08d55765ccc3b02453e88650d7038d072d02bb6`. Zips never carry customer PDFs.

## Read first: no Dropbox Sign (owner, Nov 6)
The Dropbox Sign API costs $75/month, which is too much for now. **The tool signs contracts and change orders itself** and adds a certificate of completion to the signed copy. HANDOFF §34 is the build.
- **§33 (the Dropbox Sign plan) is on hold. Don't build it.**
- The Dropbox Sign code stays in `src/fm-phase2-contract.js` for later, but nothing calls it.
- **Nothing to buy, and no email service needed.** Links and reminders go out from the team's own mail app (mailto) or by text.

## What changed, in the owner's words
- **"Can you create an esign certificate of sorts to embed into the tool? And if not, … walk us through the steps to go outside the tool to collect signatures and then come back to upload/mark signed docs as received."** Both are built (§34).
  - **Signing in the tool:**
    - Each signer gets their own secret link: the buyer first, then the chosen Fremont Makers signer.
    - The signer sees the document, agrees to sign electronically and types or draws their signature.
    - The document is frozen by its SHA-256 when it's sent.
    - When everyone has signed, a certificate page is added: who signed, when, IP address, browser, method, the fingerprint and the full history. The signed copy is filed under Documents and the job becomes Contracted.
    - Reminders go out on days 3 and 7, and links expire after 30 days (the owner's earlier choices).
  - **Signing outside the tool:**
    1. Get the PDF.
    2. Send it the usual way: Dropbox Sign website, DocuSign, email or paper. **I sent it** freezes the price.
    3. Upload the signed copy and press **Mark signed**.
  - **Change orders** with a charge or credit are sent for signature when saved. Each card has the signing block and an "upload a copy signed outside the tool" option.
- **"In the documents tab, can you make a section for us to upload any supporting documents like architecturals or photos"** (§32):
  - The Documents tab has four sections: contract and invoices, change orders, supplier orders, supporting documents.
  - Uploads are sorted by kind: plans, photos, specs, emails, other.
  - Removing a file hides it but never deletes it.
- **"Add the attached change order documentation to the braddy project … along with the change order to willow creek"** (§32):
  - Braddy change order 1's PDF is attached. The owner confirmed VSB30-VDH went 3 → 2 (the old tool had missed it).
  - Willow Creek's change order PDFs were already attached, and their fingerprints match.
- **"Make sure it will accommodate any changes to project after contract … back ordered cabinets, swaps, returns, damage, new cabinets"** (§32). Change orders now start from what happened:
  - add, swap, remove or return (with a restocking fee), backorder (swap or wait, with a new delivery date), damage (with a supplier or freight claim), our mistake, other
  - plus other charges and credits, no-change notices, supplier credits, withdraw, and credit invoices with refunds

## Files

| File | Status | Why |
|---|---|---|
| `src/fm-phase2-sign.js` | **new** | `window.FMSign` 1.0.0: requests, consent, signing, decline and cancel, reminders and expiry, signing outside the tool, the certificate (§34) |
| `preview/phase2-sign.js` | **new** | Contract tab signing card, change order signing block, and the signing page `#/sign/<link>` (live: `/projectbuilder/sign/<link>`) |
| `src/fm-phase2-files.js` | **new** | `window.FMFiles` 1.0.0: Documents tab sections, upload checks (types, 25 MB, duplicates), remove and restore (§32) |
| `tests/sign.test.js` | **new** | 15 tests |
| `tests/files.test.js` | **new** | 10 tests |
| `docs/dropbox-sign-plan.html` | **new** | The Dropbox Sign plan, marked on hold. For reference only. |
| `src/fm-phase2-changeorder.js` | changed | 0.4.0: change types, swap, add, extras, credits, absorbed cost, notices, withdraw (§32) |
| `src/fm-phase2-contract.js` | changed | 0.6.0: Dropbox Sign settings and request builders (on hold). `isQuoteFrozen` knows `signed_outside`. Readiness wording no longer mentions Dropbox Sign. |
| `src/fm-phase2-store.js` | changed | Refunds on credit invoices. `upgrade()` backfills documents and the Penrose change order 1 lines (§32). |
| `src/fm-phase1-ledger.js` | changed | Credit invoices show "Credit owed" until refunded |
| `src/fm-phase1-docs.js` | changed | Change order document for every change type. New contracts get the new e-signature line; contracts signed earlier reprint with their original wording. |
| `src/fm-phase2-agreement.js` | changed | `ESIGN` (new wording) and `ESIGN_SIGNED` (wording before Nov 6) |
| `src/fm-phase1-print.css` | changed | Change order and certificate print styles |
| `preview/phase2-app.js` | changed | Documents tab sections and uploads, the signing route, signed copies open in the viewer |
| `preview/phase2-flows.js` | changed | Change order flow rewrite (§32). Contract tab uses the new signing card. The "simulate" buttons are gone. |
| `preview/braddy-penrose-order.js` | changed | Change order 1: VSB30-VDH 3 → 2 and its PDF |
| `phase2.html` | changed | Loads the two signing scripts and `fm-phase2-files.js`, plus CSS |
| `tests/changeorder.test.js`, `contract`, `store`, `braddy` | changed | New and updated tests |
| `HANDOFF.md` | changed | New "Current state". §32, §33 (on hold) and §34 are new. |
| `HERMES-LAUNCH.md` | changed | §1 test table. §2 item 4 (file storage) and item 6 (signing in the tool). §3 screens. |
| `MANIFEST.json` | changed | 2.11.0, file list and checksums |
| `UPGRADE-2.10.0-to-2.11.0.md` | **new** | This note |

## Server work (new)
The full list is in HANDOFF §34 and §32.
- **Signing:**
  - `POST /api/projectbuilder/sign/send` (signed in)
  - `GET /projectbuilder/sign/:token` (**public, https only**)
  - `POST /api/projectbuilder/sign/:token` (public)
  - `POST …/sign/:id/cancel` and `…/remind` (signed in)
  - `POST /api/projectbuilder/sign/outside` (signed in, multipart)

  The server renders the document to a PDF and stores it with its SHA-256. It makes tokens from 32 random bytes. **It sets the time, IP address and browser itself.** It appends the certificate page when everyone has signed. Rate-limit the public routes, never log full tokens, and keep events append-only.
- **Files:**
  - `POST/GET /api/projectbuilder/files` for supporting documents and change order attachments, each stored with its SHA-256.
  - Remove keeps the file.
  - Files signed in the tool can't be removed.
- **Jobs:**
  - Store `esign.request` on jobs and change orders.
  - Store change order `type`, `replaced`, `extras`, `credits`, `withdrawn` and `newDeliveryDate`.
  - Store `documents[].removed`.

## Check
1. All tests pass: **21 files, 252 tests**.
   - New: `sign` 15 and `files` 10.
   - Changed: `contract` 26, `changeorder` 25, `store` 13.
2. In `phase2.html`, click **Reset sample data**, then follow **HANDOFF §34 "Check"** (signing in the tool, the certificate, signing outside the tool, a change order) and **§32 acceptance checks** (Documents uploads, change order types, Braddy change order 1 showing VSB30 3 → 2).
