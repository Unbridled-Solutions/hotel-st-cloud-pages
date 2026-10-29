# Hermes: launch guide for the Project Builder (Phase 1 + 2)

**From:** Fremont Makers (Linds) via Claude · **Date:** 2026-10-29 · **Package:** `fm-project-builder-phase1.zip`, version **2.6.0**

**Nothing is live yet.** Phase 1 and Phase 2 launch together as one new Project Builder that runs **beside** the existing tool at tools.fremontmakers.com. This guide is the order of work; `HANDOFF.md` has the detail (section numbers below, §).

## The rules (HANDOFF.md §0, unchanged)
1. **Never override the existing project tool.** Don't edit, rename or delete any of its files, routes, styles or data.
2. Own route (suggested `/project-builder/`), behind the flag `fm_phase1` (off by default; the name stays as is).
3. Read-only on legacy data. Everything new is saved in the new store (`fm_phase1` / the shared database), never in the old tool's storage.
4. Styles stay scoped to `.fm-p1` and `.fm-p1-doc`.
5. The owner signs off before anyone but the owner sees it.

If a step seems to need any change to the existing tool, stop and ask the owner.

---

## 1. Check the package
1. Unzip; check every file against `MANIFEST.json` (SHA-256).
2. Run the tests. All must pass:

| Command | Must print |
|---|---|
| `node tests/ledger.test.js` | `23 passed, 0 failed` |
| `node tests/activity.test.js` | `13 passed, 0 failed` |
| `node tests/pricing.test.js` | `11 passed, 0 failed` |
| `node tests/quote.test.js` | `15 passed, 0 failed` |
| `node tests/docs.test.js` | `9 passed, 0 failed` |
| `node tests/elevations.test.js` | `20 passed, 0 failed` |
| `node tests/measure.test.js` | `5 passed, 0 failed` |
| `node tests/theme.test.js` | `5 passed, 0 failed` |
| `node tests/braddy.test.js` | `9 passed, 0 failed` |
| `node tests/contract.test.js` | `22 passed, 0 failed` |
| `node tests/changeorder.test.js` | `14 passed, 0 failed` |
| `node tests/bid.test.js` | `6 passed, 0 failed` |
| `node tests/books.test.js` | `7 passed, 0 failed` |
| `node tests/store.test.js` | `6 passed, 0 failed` |

3. Open `phase2.html` through a static server from the package root and click through it. **That page is the screen reference** for everything below.

## 2. Foundations (server)
These are simulated in the preview and must be real before launch:
1. **Employee sign-in with access levels.** Four users today, all **Full access** (Kristy Slaughenhaupt, Tayler Slaughenhaupt, Lindsay Wyss, Tim Slaughenhaupt); Coordinator comes later. Who did what is recorded on every change. Users page and rules: §23.
2. **Shared server database** in place of browser storage. Plug it into `FMStore.create({ storage: { load, save } })`, and record each change (`addJob`, `update`, `recordPayment`) as its own server write with the user and time; that is the activity log (§10; use SHA-256 for the hash chain).
3. **Read the legacy records** (read-only) through the Phase 1 adapter (§3, §4). `FMStore.seed` shows how: legacy records → jobs → change orders that were filed as separate projects get attached → Phase 2 fields added.
4. **File storage** for signed PDFs, supplier orders and wet-signed uploads, each with its SHA-256 (§14, §16).
5. **Supplier PDF import:** port the existing tool's Wholesale Cabinets PDF reader (read its code; don't change the old tool) into one shared import used by New Project and change orders. Adding a PDF never lowers a quantity (§15, §19).
6. **Dropbox Sign:** paid API plan (the owner approved it), an API app for `fremontmakers.com` with approval for in-frame signing, the server calls and the callback handler (§16).

## 3. Screens (match `phase2.html`)
- **Sidebar:** a filled "+ New project" button first, then Projects (All projects), Company books (Dashboard, Pipeline, Deposits due, Reconcile, P&L, Balance sheet) and Company (Users), with Field measure under Projects; Paper / Dark switch; the "FREMONT MAKERS / making freedom" logo (§13, §20, §22, §23).
- **All projects** with search, filters, balance and next step; builder-order houses folded in (§22).
- **Job page** with the header on every tab and the tabs Overview, Cabinets, **Elevations**, Change orders, Contract, Invoices, Documents, Activity (§21, §22, §23).
- **Field measure** (§24): site visits on a phone (rooms, walls, openings, outlets and plumbing, photos, who measured, buyer's confirmation), compared with and applied to a job's drawings, or starting a project for a lead. Needs server storage for visits and photos, and offline use with sync.
- **Elevations** (§23): rooms, walls and islands drawn from the quote's SKUs with sizes read from the codes (or the supplier PDF), corner cabinets, drag cabinets along a wall, crown and trim check, staggered uppers, floor plan, checks, measurements, 3D room, versions, print; locked with the price; the sheets go into the contract packet.
- **New Project** (§15), **Contract and e-sign** (§16), **Change orders** including courtesy (§17, §19), **bid pages and grandfathered prices** (§18).
- **Customer documents** open in the page with Print: invoices, payment schedule, contract packet, quote pages; only the "making freedom" logo, top left (§12, §20, §21).
- **Company Books**, designed fresh (§22). They cover jobs, invoices, payments and job costs; the accounting system keeps overhead, payroll and bank balances.

## 4. Bring the existing jobs over
1. Run every real project through the adapter. Send the owner a **reconciliation report**: old total vs new total for each job, with the reason for every difference (§3 step 8).
2. Known differences:
   - Willow Creek is **$80,888.05** once its change order (filed as its own project) is attached (§2).
   - Penrose keeps its signed **$10,973.11**; the $2,188.02 over the corrected itemized price is agreed (grandfathered) pricing (§18).
   - Penrose Change Order 1 is a **courtesy** swap, and the shop absorbed **$1,652.70**, final: no supplier credit (owner, Oct 29; §17).
3. Attach the three signed PDFs (sent separately, below) to their jobs and check their checksums (§14).

## 5. Check and launch
1. Work through the acceptance lists in `HANDOFF.md` (§5, §12–§22) on staging. Key numbers are in §22's acceptance list.
2. Send the owner: the staging link, the test output, and the reconciliation report.
3. After the owner signs off: turn the flag on for the owner only, then for the team when the owner says so.
4. Rollback at any time: turn the flag off. The existing tool is untouched.

---

## Owner decisions in effect
Pricing is set per job, never per customer; company defaults are 35% markup · 12% discount off cost · 2% G&A · 7.9% tax · $640 assembly · 50/50. Invoice shares are measured against the current total. Each change order gets its own invoice, due on signing. A job is Contracted only when everyone has signed, in Dropbox Sign or as an uploaded wet-signed copy. Fremont Makers countersigns, and the signer is picked per job from the four approved signers (Kristy, Tayler, Lindsay, Tim). The deposit is due on signing, with the last payment at install. Factory order and delivery dates are estimates, with nothing automated off them. New quotes use the corrected math. Bid jobs print a lump-sum page. Reprints of signed quotes show a rounding line. Supplier import only appears in New Project and change orders. Documents use only the "making freedom" logo. Everyone with Full access can void or override a contract and reopen a lost project (question 3). Elevations are drawn while quoting and the agreed ones go into the contract packet; after signing, a change order that changes cabinets gets a numbered drawing revision. Dark Hickory codes that aren't in a supplier catalog (DC224, DC324, PWB18K, VDC42RS, FP9624-1.5) stay marked "check size" (owner, Oct 29). Full list: `HANDOFF.md` §8 and §15–§24.

## Still needed from the owner (don't guess)
- Tayler's email address (Kristy: kslaugh@unbridled.com; Lindsay: lwyss@unbridled.com; Tim: tslaugh@unbridled.com). All four sign for Fremont Makers; each needs an email before they can be picked as the signer.
- From the accountant: whether a lump-sum bid page must show sales tax as its own amount.
- Confirm the field measure defaults (§24): who measured is recorded on each visit (staff by default, or builder or buyer); visits can be for a project or a lead; buyer confirmation is optional; the phone works without signal and syncs later.

## Sent separately (not in the zip)
- `FM-2609-314 · Braddy Builders.pdf`
- `Updated Braddy WholesaleCabinets-1000173203 (2).pdf`
- `Willow Creek Full House Order.pdf`

Their checksums are in `preview/braddy-penrose-order.js` → `documents`.
