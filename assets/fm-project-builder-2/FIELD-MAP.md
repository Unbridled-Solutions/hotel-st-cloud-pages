# Project Builder 2.0 field map (live KV)

Read-only GET `https://tools.fremontmakers.com/api/planner/bundle?ns=fm-quotes`.
Not IndexedDB. 2.0 never POSTs this namespace.

| Phase 1 / Claude assumed | Live field | Notes |
|---|---|---|
| `jobCode` | `jobCode` | Same |
| `customer` | `customer` | Same |
| `projectName` | `project` | Not `projectName` |
| `status` Proposed/Contracted/Lost | `status` proposed/contract/lost | Lowercase in KV |
| `total` | Index `total`, else `contractTotal` | Quote body often has no `total` |
| `quoteDate` | `date` | ISO day |
| `deliveryDate` | `installDate` | |
| `houses[]` | `childIds` → `fm-quote-<id>` | Parent `kind: order`. Child `kind: child`, `parentOrderId` |
| house.name | child `project` | e.g. San Luis 1 |
| house.model | child `modelName` | |
| house.color | child `colorName` | |
| house.lines | child `cabinets.length` | |
| house.total | index `total` for that child | |
| `invoices[]` | `ar.d1Amt/Due/Paid…` | 50-50 or 50-30-20 via `payPlan` |
| invoice check | `ar.d1Check` | |
| `changeLog[]` | `changeOrders[]` | On the parent order. Amount `changeAmount`. Extra invoice `extraInvoice` |
| `signerName` | `signerName` | |
| `buyerEmail` | `customerEmail` | Sparse |
| `parentJobCode` | `parentOrderId` | Empty on the CO *record* FM-2610-475 |
| CO as own project | Index row FM-2610-475 | customer "Willow Creek Change Order 10/23/26", status proposed, $8,740.71 |

## What 2.0 lists

Top-level only: orders, standalone jobs, and CO records. Child houses fold under the order. Willow CreekTEST $0 children stay off the All projects list.

## Storage

- Legacy: `ns=fm-quotes` — **read only**
- New: `ns=fm-phase1` reserved. Not written in this pass (attach stays in-session until you sign off).
