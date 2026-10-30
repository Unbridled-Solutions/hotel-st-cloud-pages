# Upgrade: Project Builder 2.7.2 → 2.8.0

**Date:** 2026-10-29 · **Update package:** `fm-project-builder-update-2.7.2-to-2.8.0.zip` (only the files below). Start from 2.7.2 as you have it, copy these files over, then check them against `MANIFEST.json`. Nothing was deleted.

The rules are unchanged: beside the existing tool, flag `fm_phase1`, legacy data read-only, styles scoped to `.fm-p1`.

## What changed, in the owner's words
- "Projects and Company books get hidden": sidebar headings are clearer, and **Elevations** has its own page under Projects.
- "The Open button isn't centered": row buttons sit in the middle of their rows; tables fit a small laptop window.
- "Clean up the customer area": the Templates and Projects sections of a customer page were redesigned.
- Addresses become Street, City, State (Colorado by default), ZIP.
- New Project: a compact Cabinets step that shows the incoming lines; tighter Price step; Tab into a markup box and type to replace it; a clearer Live total.
- **Assembly is hours × hourly rate** per project ($20.50 default rate, no default hours), and **custom payment plans** that flow into the contract and invoices.
- Elevations: one click selects a cabinet; a Selected bar with Remove (and the Delete key); cabinets placed beyond the quote can be added to the quote, removed, or sent to a change order.

## Files

| File | Status | Why |
|---|---|---|
| `src/fm-phase2-address.js` | **new** | `window.FMAddress`: address fields, Colorado default, format and parse, checks, form fields (§28) |
| `tests/address.test.js` | **new** | 6 tests for addresses, including customer profiles keeping the fields |
| `src/fm-phase2-customers.js` | changed | Profiles built from jobs keep `installAddr` fields; address shape documented |
| `phase2.html` | changed | Loads `fm-phase2-address.js`. CSS for sidebar headings, centered row actions, table width, New Project layout, address fields, Live total font, the elevation Selected bar and extras banner |
| `preview/phase2-app.js` | changed | Elevations link and `#/elevations` route; sidebar; centered action cells; Users table fits; overview pricing shows assembly hours × rate and the payment plan; number boxes select on Tab or click; step tabs clickable |
| `preview/phase2-flows.js` | changed | New Project: address fields, Cabinets step with line preview, Price step (assembly hours × rate, payment plans with custom names and %), invoices labeled from the plan. `addToQuote` and `startCO` for elevation extras. Older drafts are migrated |
| `preview/phase2-elevations.js` | changed | Elevations overview page; click-to-select fix; Selected bar; Delete and Esc keys; extras banner (add to quote, remove, change order) |
| `preview/phase2-measure.js` | changed | Lead address as fields; projects started from a visit use today's defaults |
| `preview/phase2-customers.js` | changed | Templates as cards, projects as rows; profile addresses as fields |
| `HANDOFF.md` | changed | New "Current state" summary at the top; §28 |
| `HERMES-LAUNCH.md` | changed | 2.8.0; address test in the test table; sidebar; owner decisions (assembly, payment plans) |
| `MANIFEST.json` | changed | 2.8.0, file list and checksums |
| `UPGRADE-2.7.2-to-2.8.0.md` | **new** | This note |

## New owner decisions
- **Assembly = hours × hourly rate per home.** The rate defaults to **$20.50**; hours have **no default** and are entered on every job (0 = no assembly). This replaces the flat $640 default. Jobs priced before keep their flat amount.
- **Custom payment plans** are allowed: named payments whose percentages total 100%. The invoices, the contract's payment schedule and the readiness check follow whatever plan is picked.
- **Addresses** default to Colorado; the state can be changed.

## Data and server changes
- **Jobs:** `installAddr { street, city, state, zip }` beside `installAddress` (the joined line, still what documents print). `pricing` gains `assemblyHours`, `assemblyRateCents` (with `assemblyCents` = hours × rate), `planNames` and `planMode` (`'preset'` or `'custom'`).
- **Customer addresses** and **site-visit leads:** `street`, `city`, `state`, `zip` beside `line` / `address`.
- **Server:** add those columns; validate addresses as `FMAddress.check()` does; price assembly as labor `{ rateCents: assemblyRateCents, hours: assemblyHours }` (a job without `assemblyHours` uses its flat `assemblyCents`, as before); create invoices from `plan` and `planNames`. When reading old one-line addresses, use `FMAddress.parse()`; don't rewrite them.
- Elevations "Add them to the quote" changes a quote's quantities and reprices it (total, tax, cost, invoices). On the server, do this as one write and log who did it. It's only offered before the contract is sent.

## Check
1. All tests pass: 16 files, **179 tests** (`address` 6 is new; the rest are unchanged). See `HERMES-LAUNCH.md` §1.
2. In `phase2.html`:
   - **New Project with a 40/40/20 custom plan** named Deposit / Cabinets delivered / Install complete, and 30 h × $20.50 assembly. The Review step shows "30 h × $20.50 = $615.00 per home". The contract packet's payment schedule shows the three named invoices.
   - **The sample quote's Elevations:** one click on a cabinet selects it; Delete removes it; ⌘Z brings it back.
   - **Add one more B33 than quoted:** "Add them to the quote" raises B33 from 2 to 3 and the total from $5,209.36 to $5,715.72.
