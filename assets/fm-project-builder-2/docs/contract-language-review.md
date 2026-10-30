# Contract language: old packet vs new tool

**Approved by the owner, Oct 30, 2026.** Every change below is approved, including the Goods change the owner made.

Every contract packet the tool makes now starts with the full **Customer Sales Agreement**. The text comes word for word from the signed Willow Creek (FM-2609-276) and Penrose (FM-2609-314) packets. Before this, the tool's packet left the agreement out and only said "its terms are not reprinted here."

All the wording lives in one file, `src/fm-phase2-agreement.js`, so any change is made in one place.

## Packet order (same as the signed packets)

1. **Builder order** (builder orders only): models with house counts and amounts, then every house with job code, address, color and amount.
2. **Customer Sales Agreement**, with signature blocks.
3. **Payment schedule.** Each invoice has its one-line description again ("Factory order is not placed until this invoice is paid in full", "Due at pickup or delivery").
4. **Invoices**
5. **Final Job Quotes**
6. **Elevations**

Branding matches the rest of the new tool: the "making freedom" lockup at top left, with Juniper section headings.

## Clause by clause

| Clause | Signed packets | New tool | Status |
|---|---|---|---|
| Parties and entire agreement | Seller (Fremont Makers LLC, 719 Main St, Cañon City) and Buyer. The Agreement, Quote, Payment Schedule and invoices are the entire deal. Dollars live on the invoices and Final Job Quote. "Pricing is by bid." | Same text. The list of what makes up the deal adds **the elevation drawings** (when included) and **any change orders both parties sign**. "Pricing is by bid." prints **only on bid-priced jobs**. The old tool printed it on Willow Creek too, which was itemized. | **Changed: approved** |
| Goods | RTA cabinets and hardware on the Final Job Quote. No design services, field measuring, install, plumbing, electrical, countertops or appliances. | "Unless the Quote says otherwise in writing: no install into the building, no plumbing, no electrical, no countertops, no appliances." **Design services and field measuring are dropped from the list.** They're offered as needed and not assumed included, but not excluded either. The rest stays, stating plainly that it is NOT included. | **Changed by the owner** |
| Nature of seller | Reseller, not manufacturer. Lead times are estimates. A delay isn't a breach if Buyer is kept informed. | Word for word. | Same |
| Payment terms | Written for that job's plan (50/30/20 or 50/50). The deposit holds the factory order and is non-refundable once ordered, except as required by law. The last payment is due at pickup or delivery. Goods stay until paid in full. Colorado sales tax. | Same sentences, written from the job's plan, **including custom plans with named payments**. The deposit is "**due on signing**". Adds: "**Each change order both parties sign is billed on its own invoice, due on signing.**" | **Changed: approved** |
| Measurements and elevations | Buyer owns measurements and specs. "**Manufacturer elevation views** ship with the Quote." Providing elevations doesn't make Seller the designer, measurer or warrantor of fit. Orders from a bad elevation are Buyer's cost. | "**Elevation drawings** ship with the Quote." Fremont Makers now draws them in the tool. The rest is word for word. If the contract goes out with incomplete drawings, it adds: "The elevations in this packet are preliminary. Final elevations will be provided before the factory order is placed." | **Changed: approved** |
| Delivery, inspection, and assembly | Inspect at pickup or delivery. 48 hours to note damage. Risk passes on pickup or delivery, title when paid. "Seller assembly is included in this contract total…" | Word for word. On a job with **0 assembly hours** it reads "Assembly is not included in this contract total." | **Changed: approved** |
| Warranty | One year from purchase. Claims go to Fremont Makers. It is Seller's warranty, not a pass-through. | Word for word. | Same |
| Law and venue | Colorado law. Binding arbitration in Fremont County. Small claims. State courts of Fremont County. | Word for word. | Same |
| Signatures | Buyer and Fremont Makers lines, with the buyer's printed name filled in. | Adds: "**Signed through Dropbox Sign or on paper; each signed copy is an original.**" The Fremont Makers printed name is filled in with the person picked to sign this job. | **Changed: approved** |

## Field measuring (answered)

The owner removed "no design professional services, no field measuring" from Goods, as shown above.

The only terms removed are the two Goods items the owner chose. If an attorney should look at the changed rows before launch, the file to send is `src/fm-phase2-agreement.js`. Its `SIGNED` block holds the original wording and its `CHANGES` list holds every difference.
