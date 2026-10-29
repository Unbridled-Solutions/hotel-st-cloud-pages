/*
 * Braddy Builders · Penrose · FM-2609-314 · single-house job, every SKU.
 *
 * Sources (supplied by the owner, Oct 27 2026):
 *   - "FM-2609-314 · Braddy Builders.pdf" (contract packet, 8 pages): agreement,
 *     payment schedule, invoices 1–3, and the Final Job Quote (18 lines + summary).
 *   - "Updated Braddy WholesaleCabinets-1000173203 (2).pdf": Wholesale Cabinets
 *     order #1000173203, Oct 9 2026 (2 SKUs added after the Sep 16 contract).
 *   - Screen recording 11:20 AM: unit costs for the Dark Hickory lines.
 *   - Screen recording 8:34 PM: the quote screen (all 18 lines, assembly $40 × 16 h, column totals)
 *     and Change Order 1 (courtesy swap: DC324 ×2 and VDC12 ×1 removed, VDC42RS ×1 and DC224 ×2 added).
 *
 * Unit cost × (1 + 30%) reproduces every charged line. Two lines print $0.00
 * ("no charge"); their cost comes from the Oct 9 supplier order.
 * `sellTotal` and `unitSell` are exactly what the signed quote prints.
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FM_BRADDY_ORDER = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, {
  jobCode: 'FM-2609-314',
  customer: 'Braddy Builders',
  signer: 'Bernard Braddy',
  project: 'Penrose',
  quoteDate: '2026-09-16',
  deliveryDate: '2026-11-09',
  color: 'Dark Hickory Shaker',
  paymentPlan: [50, 30, 20],

  /* Braddy's settings differ from Willow Creek's (12% / 2% / 7.9%). */
  pricing: { mfrDiscountPct: 5, gaPct: 5, taxPct: 8.7, defaultMarkupPct: 30 },

  model: {
    color: 'Dark Hickory Shaker', suffix: 'VDH',
    assembly: { rate: 40.00, hours: 16 },   // $40/hr × 16 h = $640.00 (quote screen, 8:34 PM recording; the contract prints only the total)
    /* Column totals on the quote screen (8:34 PM recording): cost of charged lines $5,766.96,
       customer total $7,423.84. All 18 lines below match that screen line for line. */
    screenTotals: { costCharged: 5766.96, cabinets: 7423.84 },
    lines: [
      { sku: 'PWB18K-VDH',     desc: 'Dark Hickory Shaker PWB18K',     qty: 1, unitCost: 227.36, markupPct: 0,  unitSell: 227.36, sellTotal: 227.36 },
      { sku: 'SM8-VDH',        desc: 'Dark Hickory Shaker SM8',        qty: 5, unitCost: 22.97,  markupPct: 30, unitSell: 29.86,  sellTotal: 149.31 },
      { sku: 'WC3024-VDH',     desc: 'Dark Hickory Shaker WC3024',     qty: 2, unitCost: 228.00, markupPct: 30, unitSell: 296.40, sellTotal: 592.80 },
      { sku: 'TK8-VDH',        desc: 'Dark Hickory Shaker TK8',        qty: 5, unitCost: 20.46,  markupPct: 30, unitSell: 26.60,  sellTotal: 132.99 },
      { sku: 'WF342-VDH',      desc: 'Dark Hickory Shaker WF342',      qty: 2, unitCost: 36.09,  markupPct: 30, unitSell: 46.92,  sellTotal: 93.83 },
      { sku: 'TU-VDH',         desc: 'Dark Hickory Shaker TU',         qty: 1, unitCost: 16.66,  markupPct: 0,  unitSell: 16.66,  sellTotal: 16.66 },
      { sku: 'DWP3-VDH',       desc: 'Dark Hickory Shaker DWP3',       qty: 1, unitCost: 99.50,  markupPct: 30, unitSell: 129.35, sellTotal: 129.35 },
      { sku: 'BC33-VDH',       desc: 'Dark Hickory Shaker BC33',       qty: 1, unitCost: 426.38, markupPct: 30, unitSell: 554.29, sellTotal: 554.29 },
      { sku: 'BC18-VDH',       desc: 'Dark Hickory Shaker BC18',       qty: 1, unitCost: 275.31, markupPct: 30, unitSell: 357.90, sellTotal: 357.90 },
      { sku: 'SB36-VDH',       desc: 'Dark Hickory Shaker SB36',       qty: 1, unitCost: 318.05, markupPct: 30, unitSell: 413.47, sellTotal: 413.47 },
      { sku: 'BC24-VDH',       desc: 'Dark Hickory Shaker BC24',       qty: 3, unitCost: 331.96, markupPct: 30, unitSell: 431.55, sellTotal: 1294.64 },
      { sku: 'WC2442-VDH',     desc: 'Dark Hickory Shaker WC2442',     qty: 4, unitCost: 306.12, markupPct: 30, unitSell: 397.96, sellTotal: 1591.82 },
      { sku: 'WC362424-VDH',   desc: 'Dark Hickory Shaker WC362424',   qty: 1, unitCost: 297.19, markupPct: 30, unitSell: 386.35, sellTotal: 386.35 },
      { sku: 'VDC15-VDH',      desc: 'Dark Hickory Shaker VDC15',      qty: 1, unitCost: 369.73, markupPct: 30, unitSell: 480.65, sellTotal: 480.65 },
      { sku: 'VSB30-VDH',      desc: 'Dark Hickory Shaker VSB30',      qty: 2, unitCost: 270.34, markupPct: 30, unitSell: 351.44, sellTotal: 702.88 },
      { sku: 'FP9624-1.5-VDH', desc: 'Dark Hickory Shaker FP9624-1.5', qty: 1, unitCost: 230.41, markupPct: 30, unitSell: 299.53, sellTotal: 299.53 },
      { sku: 'VDC42RS-VDH',    desc: 'Dark Hickory Shaker VDC42RS',    qty: 1, unitCost: 707.92, markupPct: 0,  unitSell: 0, sellTotal: 0, noCharge: true, addedBy: '1000173203' },
      { sku: 'DC224-VDH',      desc: 'Dark Hickory Shaker DC224',      qty: 2, unitCost: 446.26, markupPct: 0,  unitSell: 0, sellTotal: 0, noCharge: true, addedBy: '1000173203' }
    ],
    /* Exactly as printed on the signed Final Job Quote (page 6 of 6). */
    contract: { cabinets: 7423.84, discount: 288.35, assembly: 640.00, ga: 388.77, tax: 620.79, total: 10973.11,
                footnote: 'Contracted total is the agreed amount. SKU lines above are shop sell and may not add to that number.' }
  },

  invoices: [
    { label: 'Invoice 1 · 50% deposit',              due: '2026-09-16', amount: 5363.77, status: 'Paid', paidDate: '2026-09-16', check: '' },
    { label: 'Invoice 2 · 30% progress',             due: '2026-09-25', amount: 3365.60, status: 'Paid', paidDate: '2026-10-05', check: '2967' },
    { label: 'Invoice 3 · 20% pickup or delivery',   due: '2026-11-09', amount: 2243.74, status: 'Due' }
  ],

  /* Change Order 1, from the 8:34 PM recording. A courtesy: backordered cabinets were swapped
     for in-stock ones at no charge (owner, Oct 27). The tool printed "Why: SKUs updated Oct 2026",
     "This change $0.00", and noted "SKU sell moved −$1,649.95 · shop ate it". The added cabinets
     were entered at $0.00 unit cost, so their real cost isn't on the job; it's on supplier order
     #1000173203 below. Whether the supplier credited the removed cabinets isn't known. */
  changeOrders: [
    { number: 1, date: '2026-10-14', kind: 'courtesy', printedWhy: 'SKUs updated Oct 2026', printedThisChange: 0,
      removed: [ { sku: 'DC324-VDH', desc: 'Dark Hickory Shaker DC324', qty: 2 },
                 { sku: 'VDC12-VDH', desc: 'Dark Hickory Shaker VDC12', qty: 1 } ],
      removedSell: 1649.95,
      added: [ { sku: 'VDC42RS-VDH', desc: 'Dark Hickory Shaker VDC42RS', qty: 1, unitCostAsEntered: 0, unitCost: 707.92 },
               { sku: 'DC224-VDH', desc: 'Dark Hickory Shaker DC224', qty: 2, unitCostAsEntered: 0, unitCost: 446.26 } ],
      supplierOrder: '1000173203',
      supplierCredit: 0 }   // owner, Oct 29: Wholesale Cabinets did not credit the removed cabinets; the shop ate the cost as a courtesy (backorder)
  ],

  supplierOrders: [
    { supplier: 'Wholesale Cabinets', orderNumber: '1000173203', date: '2026-10-09', estShip: '2026-10-16',
      lines: [ { sku: 'VDC42RS-VDH', qty: 1, price: 707.92 }, { sku: 'DC224-VDH', qty: 2, price: 446.26 } ],
      subtotal: 1600.44, discount: 80.02, tax: 132.28, shipping: 0, total: 1652.70, paidBy: 'Credit card' }
  ],

  /* Source documents to attach to each job (originals stay with the owner;
     sha256 lets the live system confirm it has the same file). */
  documents: [
    { jobCode: 'FM-2609-314', title: 'Signed contract packet', file: 'FM-2609-314 · Braddy Builders.pdf', pages: 8, bytes: 2573026,
      sha256: '40370de19e9cafdd01992393738367671df4b1ccade76d4b011999cad546fb07', kind: 'contract',
      contains: 'Agreement, payment schedule, invoices 1–3, Final Job Quote (18 lines)' },
    { jobCode: 'FM-2609-314', title: 'Wholesale Cabinets order #1000173203', file: 'Updated Braddy WholesaleCabinets-1000173203 (2).pdf', pages: 1, bytes: 581317,
      sha256: '33091aa2e103f2ac31e1129abe4477091cee33f4292af9df033072788e8d1f77', kind: 'supplier-order',
      contains: 'VDC42RS ×1 and DC224 ×2, Oct 9 2026, $1,652.70 paid by card' },
    { jobCode: 'FM-2609-276', title: 'Signed contract packet', file: 'Willow Creek Full House Order.pdf', pages: 27, bytes: 8404099,
      sha256: '9c415ace06e94d51cbf9c22c6045d8996f18468b375f4459b2f7e9d82840dbe9', kind: 'contract',
      contains: 'Builder order, agreement, payment schedule, invoices, 10 Final Job Quotes (154 lines)' }
  ]
}));
