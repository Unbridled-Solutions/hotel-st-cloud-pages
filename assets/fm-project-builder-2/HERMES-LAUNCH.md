# Hermes: launch guide for the Project Builder (Phase 1 + 2)

**From:** Fremont Makers (Linds) via Claude · **Date:** 2026-11-09 · **Package:** `fm-project-builder-phase1.zip`, version **2.11.1**

> **Updating from 2.10.0?** Use `fm-project-builder-update-2.10.0-to-2.11.1.zip` and read `UPGRADE-2.10.0-to-2.11.1.md` (it covers 2.11.0 too). It lists only what changed. The full zip is for a fresh start.

**Nothing is live yet.** Phase 1 and Phase 2 launch together as one new Project Builder at **`tools.fremontmakers.com/projectbuilder`**. The existing tool stays live at `tools.fremontmakers.com/quote`, unchanged. This guide is the order of work. `HANDOFF.md` has the detail; section numbers below (§) refer to it.

## 0. Where it lives, and what happens to the old tool (owner, Nov 5)

| | Address | What happens |
|---|---|---|
| **New Project Builder (2.0)** | `tools.fremontmakers.com/projectbuilder` | All new screens, documents and assets live under this path, behind the flag `fm_phase1`. |
| **Existing tool** | `tools.fremontmakers.com/quote`, plus `/contract`, `/elevation` and `/sales-agreement` | **Stays live, exactly as it is.** No redirect, no replacement, no code change. Its data stays where it is. |

**The old tool moves to "do not use" for the team.** This is a team rule, not a change to the tool:
1. **On switch-over day** (the owner picks it), the team stops entering new jobs, payments and changes in `/quote`. It stays open, so anyone can still look things up.
2. **Final copy:** that same day, take a read-only copy of the old tool's data, run the import again (§4), and send the owner the reconciliation report.
3. **Anything entered in `/quote` after that copy** doesn't come across by itself. If it happens, take a fresh copy and re-run the import; the import is safe to repeat.
4. If the owner later wants a "Do not use: go to /projectbuilder" notice on the old page, that is the only change it would ever need. **Don't add one unless the owner asks.**

**Security on the live old tool:** fix this now, on the server only. The old page's code stays as is.
- The old tool's data address (`/api/planner/bundle?ns=fm-quotes`) **answers without signing in**: anyone with the address can read all customer and job data, and the page saves by POSTing the whole bundle to it. Put `/quote` and that address behind staff sign-in at the server or proxy (for example, require the sign-in session cookie). The old page fetches from its own site, so it keeps working for signed-in staff.
- The old page's passwords (contract, P&L, Balance Sheet, reconcile) can be read in its page code. Treat them as known. The new tool doesn't use them: editing is by access level.

## The rules (HANDOFF.md §0)
1. **Never override the existing project tool.** Don't edit, rename or delete any of its files, routes, styles or data. Never redirect `/quote`.
2. **Own address:** `/projectbuilder`, behind the flag `fm_phase1` (off by default; the name stays as is).
3. **Read-only on legacy data.** Everything new is saved in the new store (`fm_phase1` / the shared database), never in the old tool's storage. The import reads a copy (§31).
4. Styles stay scoped to `.fm-p1` and `.fm-p1-doc`.
5. The owner signs off before anyone but the owner sees it.
6. **Updates never overwrite data (every update, from now on).** Back up the database and files before installing. Never reset, reseed or re-import over live data; the sample and seed files are for the preview, the tests and the first import only. Create the live store with `FMStore.create({ live: true, … })` and leave **Reset sample data** off the live site. Add new fields; don't change existing records. Never delete uploads, signed copies or signing history. If an update seems to need it, ask the owner first. Details: HANDOFF §0 rule 9.

If a step seems to need any change to the existing tool, stop and ask the owner.

---

## 1. Check the package
1. Unzip, then check every file against `MANIFEST.json` (SHA-256).
2. Run the tests. All must pass (21 files, 255 tests):

| Command | Must print |
|---|---|
| `node tests/ledger.test.js` | `23 passed, 0 failed` |
| `node tests/activity.test.js` | `13 passed, 0 failed` |
| `node tests/pricing.test.js` | `11 passed, 0 failed` |
| `node tests/quote.test.js` | `15 passed, 0 failed` |
| `node tests/docs.test.js` | `10 passed, 0 failed` |
| `node tests/elevations.test.js` | `21 passed, 0 failed` |
| `node tests/measure.test.js` | `5 passed, 0 failed` |
| `node tests/reports.test.js` | `8 passed, 0 failed` |
| `node tests/address.test.js` | `6 passed, 0 failed` |
| `node tests/theme.test.js` | `5 passed, 0 failed` |
| `node tests/braddy.test.js` | `9 passed, 0 failed` |
| `node tests/contract.test.js` | `26 passed, 0 failed` |
| `node tests/changeorder.test.js` | `27 passed, 0 failed` |
| `node tests/bid.test.js` | `6 passed, 0 failed` |
| `node tests/books.test.js` | `7 passed, 0 failed` |
| `node tests/store.test.js` | `14 passed, 0 failed` |
| `node tests/schedule.test.js` | `6 passed, 0 failed` |
| `node tests/legacy.test.js` | `10 passed, 0 failed` |
| `node tests/company.test.js` | `8 passed, 0 failed` |
| `node tests/files.test.js` | `10 passed, 0 failed` |
| `node tests/sign.test.js` | `15 passed, 0 failed` |

3. Open `phase2.html` through a static server from the package root and click through it. **That page is the screen reference** for everything below.

## 2. Foundations (server)
These are simulated in the preview and must be real before launch:
1. **Employee sign-in with access levels.** Four users today, all with **Full access** (Kristy Slaughenhaupt, Tayler Slaughenhaupt, Lindsay Wyss, Tim Slaughenhaupt). Coordinator comes later. Every change records who made it. Users page and rules: §23.
2. **Shared server database** in place of browser storage.
   - Plug it into `FMStore.create({ storage: { load, save } })`.
   - Record each change (`addJob`, `update`, `recordPayment`, `saveCompany`) as its own server write, with the user and time. That is the activity log (§10; use SHA-256 for the hash chain).
3. **Read the old tool's real data** (read-only) with `FMLegacy.read` (§31). It takes the old tool's cloud bundle and gives:
   - jobs in the shape `FMStore.seed` reads
   - each job's lines, pricing and change orders
   - the Company P&L and Balance Sheet numbers
   - a list of records it skipped, and why
   This replaces the guessed field names in §4.
4. **File storage** for signed PDFs, supplier orders, signed copies, and the team's uploads (plans, photos, specs, emails; up to 25 MB each), each with its SHA-256. Removing a file hides it and keeps it (§14, §32).
5. **Supplier PDF import.** Port the existing tool's Wholesale Cabinets PDF reader into one shared import used by New Project and change orders. Read its code; don't change the old tool. Adding a PDF never lowers a quantity (§15, §19).
6. **Signing in the tool (§34).** No Dropbox Sign: the owner put the API on hold (Nov 6, $75/month). Build the public signing page `/projectbuilder/sign/<link>` and its endpoints with `FMSign`. The server sets every time, IP address and browser, freezes the document as a PDF with its SHA-256, and appends the certificate of completion. Links go out from the team's own mail app, so no email service is needed. Also build "Sign outside the tool" (upload the signed copy, Mark signed).

## 3. Screens (match `phase2.html`)
- **Sidebar:**
  - a filled "+ New project" button first
  - **Projects:** All projects, Elevations, Customers, Field measure
  - **Company books:** Dashboard, Pipeline, Deposits due, Reconcile, **Job P&L**, **Company P&L**, **Job balances**, **Balance sheet**, Reports & exports
  - **Company:** Users
  - the Paper / Dark switch and the "FREMONT MAKERS / making freedom" logo (§13, §20, §22, §23, §31)
- **All projects:** search, filters, balance and next step, with builder-order houses folded in (§22).
- **Job page:** the header on every tab, and the tabs Overview, Cabinets, **Elevations**, Change orders, Contract, Invoices, Documents, Activity (§21, §22, §23). **Documents** has four sections: contract and invoices, change orders, supplier orders, supporting documents with uploads (§32).
- **Customers (§25):**
  - profiles with contacts (who signs, who gets invoices, who's on site), addresses, notes and their projects
  - **templates** for repeat homes and builder orders: models, house counts, cabinets, drawings, never pricing
  - new projects start from a profile or a template; this needs a customers table linked to jobs by id
- **Reports & exports (§25, §30):** jobs (with each charge, cost as quoted, manufacturer's discount and net cost), invoices, payments, sales tax and change orders for a period, as CSV for finance.
- **Field measure (§24):**
  - site visits on a phone: rooms, walls, openings, outlets and plumbing, photos, who measured, the buyer's confirmation
  - visits are compared with, and applied to, a job's drawings, or start a project for a lead
  - needs server storage for visits and photos, and offline use with sync
- **Elevations (§23, §30):**
  - **Elevation / Layout / 3D** view toggles
  - rooms, walls and islands drawn from the quote's SKUs (sizes read from the codes or the supplier PDF), or **sketched without SKUs** using standard and custom sizes and six colors
  - corner cabinets, cabinets dragged along a wall, crown and trim check, staggered uppers, checks, measurements, versions, print
  - locked with the price; the sheets go into the contract packet
- **Contract tab (§29):** contract details and due dates editable on the Ready card, a Fix link on every problem, deposit due on signing, and "Send without complete elevations".
- **Invoices tab:** Adjust schedule after signing.
- **Test / Void** (Full access): a button on the job page and a filter on All projects.
- **Addresses (§28):** Street, City, State (Colorado by default) and ZIP wherever an address is entered. They're stored as fields, plus the joined line that documents print.
- **Flows:**
  - New Project (§15, §28): line preview, assembly hours × rate, custom payment plans
  - contract and signing: in the tool with a certificate, or outside the tool with an upload (§34)
  - change orders for every kind of change: add, swap, return, backorder, damage, our mistake, other; supplier credits; withdraw; credit invoices and refunds (§17, §19, §32)
  - bid pages and grandfathered prices (§18)
- **Customer documents** open in the page with Print:
  - invoices and the payment schedule
  - the contract packet: builder order, **Customer Sales Agreement**, schedule, invoices, quotes, elevations
  - change orders and quote pages
  - only the "making freedom" logo, top left (§12, §20, §21, §29)
- **Company books (§22, §30, §31):**
  - **Job P&L:** gross profit with every charge broken out
  - **Company P&L:** monthly expenses through net income, carried over from the old tool
  - **Balance sheet:** carried over from the old tool
  - **Job balances:** what customers owe, and what's held for them

## 4. Bring the existing jobs over
1. **Take a read-only copy** of the old tool's data: `GET /api/planner/bundle?ns=fm-quotes` returns `{ success, data }`.
2. **Read it:** `FMLegacy.read(data)`.
3. **Seed the new store:**
   ```
   FMStore.seed({ sample: { today, legacyProjects }, willow, braddy, company: FMCompany.fromLegacy(read.company) })
   ```
   `tests/legacy.test.js` does exactly this on the Nov 5 copy (`tests/fixtures/legacy-bundle-2026-11-05.js`). It gets the same jobs, balances and gross profit the package was built on.
4. **Send the owner a reconciliation report:**
   - each job's old total vs new total, with the reason for every difference (§3 step 8)
   - the **skipped list** from `read().skipped`, as shown below
5. **What to expect** (the Nov 5 data):

   | Job | What the import should give |
   |---|---|
   | **Willow Creek** | **$80,888.05** with change order 1. In the real data the change order is stored inside the job; the copy once saved as its own project (FM-2610-475) is no longer on the list. Change order 1's cost is **$5,388.73**, from its line costs (§31). Its invoice was **paid Oct 28 (check 5568)**. Invoice 2, **$36,783.01**, is due Nov 20. |
   | **Penrose** | **$10,973.11**, **paid in full**: invoice 3 was paid Nov 4 (check 2980). Invoice 1 has no check number in the old data, so Reconcile flags it. The $2,188.06 above the itemized price is agreed (grandfathered) pricing (§18). Change order 1 is a courtesy swap: the shop absorbed **$62.91** (§17, §30). |
   | **Como House** | Lost, $8,744.71. |
   | **Skipped** | 5 houses left over from a deleted "Willow CreekTEST" order, and 54 stored records that are no longer on the old tool's project list (deleted tests, old drafts, the separate change order copy). The owner decides whether any of them matter. |
   | **Books** | Year-to-date gross profit **$30,558.34** (35.7%). Company P&L November: operating expenses **$21,996.68**. The Balance sheet is **off by $100,000.00** as entered in the old tool; the owner will correct it with the accountant. |
6. **Attach the PDFs** (sent separately in earlier versions; listed below) to their jobs and check their checksums (§14, §29).

## 5. Check and launch
1. Work through the acceptance lists in `HANDOFF.md` (§5, §12–§22, §31) on staging. Key numbers are in §22's and §31's lists.
2. Send the owner the staging link (`/projectbuilder` on staging), the test output and the reconciliation report.
3. After the owner signs off:
   - Turn the flag on for the owner only.
   - Then, on the switch-over day the owner picks, turn it on for the team.
   - The old tool goes to do-not-use that day (§0).
4. **Rollback** at any time: turn the flag off. The team goes back to `/quote`, which was never touched. Jobs entered in the new tool in the meantime stay in the new store.

---

## Owner decisions in effect
- **Address and the old tool (Nov 5):**
  - The new tool lives at `/projectbuilder`.
  - `/quote` stays live and unchanged, and becomes do-not-use for team operations from switch-over.
- **Company books (Nov 4–5):**
  - Gross profit uses the cabinet cost as quoted less the manufacturer's discount.
  - Assembly labor and G&A count fully as gross profit.
  - The Company P&L and Balance Sheet come over with the owner's numbers, and only Full access can edit them.
- **Contracts and change orders:**
  - Contract wording was approved Oct 30 (`docs/contract-language-review.md`).
  - Test / Void is Full access only, and separate from voiding a signed contract.
  - Moving money between invoices after signing needs Full access.
- **Pricing** is set per job, never per customer.
  - Company defaults: 35% markup · 12% discount off cost · 2% G&A · 7.9% tax · 50/50.
  - Assembly is **hours × hourly rate** per home, at **$20.50**, with hours entered on every job and no default.
  - Custom payment plans are allowed.
- **More decisions** are listed in `HANDOFF.md` §8 and §15–§31.

## The hosted preview is not the live tool
It runs on sample data saved in each browser, with a "Preview, not the live tool" bar on every page. Set `FM_CONFIG.live = true` in `phase2.html` only after the shared database and sign-in from step 2 are connected (§26).

## Still needed from the owner (don't guess)
- **Tayler's email address.** All four people sign for Fremont Makers, and each needs an email before they can be picked as the signer. The others are:
  - Kristy: kslaugh@unbridled.com
  - Lindsay: lwyss@unbridled.com
  - Tim: tslaugh@unbridled.com
- **From the accountant:**
  - whether a lump-sum bid page must show sales tax as its own amount
  - the Balance sheet's $100,000 difference
  - whether loan principal belongs on the P&L (the old page put it below the line, and the new one shows it the same way)
- **Field measure defaults (§24), to confirm:**
  - who measured is recorded on each visit (staff by default, or the builder or buyer)
  - visits can be for a project or a lead
  - the buyer's confirmation is optional
  - the phone works without signal and syncs later
- **The switch-over day.**

## Sent separately (not in the zip)
No new PDFs in 2.10.0. Hermes already has these from earlier versions:
- `FM-2609-314 · Braddy Builders.pdf`
- `Updated Braddy WholesaleCabinets-1000173203 (2).pdf`
- `Willow Creek Full House Order.pdf`
- `FM-2609-276 · Willow Creek Estates.pdf`
- `COR FM-2609-276 · Willow Creek Estates.pdf`

**Checksums:** the first three are in `preview/braddy-penrose-order.js` → `documents`. The two change order PDFs are in `preview/willow-creek-full-order.js` → `changeOrders[0].documents`.

**In the hosted preview:** until server file storage exists, the preview opens these PDFs from a `files/` folder next to `phase2.html`, under their exact names or the plain names in §26. It checks each SHA-256 before showing a file. Keep that folder behind password protection: these are signed customer documents.
