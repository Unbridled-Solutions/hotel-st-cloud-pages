/*
 * Willow Creek Estates · FM-2609-276 · full builder order, every SKU by house.
 *
 * Sources (both supplied by the owner, Oct 27 2026):
 *   - "Willow Creek Full House Order.pdf" (contract packet, 27 pages): SKU, qty,
 *     sell unit/total, and each house's cabinets / discount / assembly / G&A / tax / total.
 *   - Screen recording 10:02 AM: unit cost, markup %, assembly rate and hours
 *     from each house's Quote screen in the current Project Builder.
 *
 * Each pair of houses (1 and 2) of the same model is identical, line for line.
 * `sellTotal` is what the contract prints for the line; the pricing module
 * recomputes it from cost × qty × (1 + markup) and the tests compare the two.
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FM_WILLOW_ORDER = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, {
  jobCode: 'FM-2609-276',
  customer: 'Willow Creek Estates',
  signer: 'Rod Stambaugh',
  quoteDate: '2026-10-01',
  houseQuoteDate: '2026-09-29',
  deliveryDate: '2026-11-20',
  orderTotal: 72147.34,

  /* Same settings on every house in this order. */
  pricing: {
    mfrDiscountPct: 12,          // off the manufacturer COST total, not the sell total
    gaPct: 2,                    // on (product after discount + assembly)
    taxPct: 7.9,                 // on product after discount only; not on assembly or G&A
    defaultMarkupPct: 35         // the "All markup" box; not what these houses use
  },

  houses: [
    { jobCode: 'FM-2609-697', name: 'San Luis 1',      model: 'San Luis' },
    { jobCode: 'FM-2609-834', name: 'San Luis 2',      model: 'San Luis' },
    { jobCode: 'FM-2609-790', name: 'Mesa Ridge 1',    model: 'Mesa Ridge' },
    { jobCode: 'FM-2609-625', name: 'Mesa Ridge 2',    model: 'Mesa Ridge' },
    { jobCode: 'FM-2609-862', name: 'Sangre Vista 1',  model: 'Sangre Vista' },
    { jobCode: 'FM-2609-334', name: 'Sangre Vista 2',  model: 'Sangre Vista' },
    { jobCode: 'FM-2609-333', name: 'Pinyon Crest 1',  model: 'Pinyon Crest' },
    { jobCode: 'FM-2609-269', name: 'Pinyon Crest 2',  model: 'Pinyon Crest' },
    { jobCode: 'FM-2609-712', name: 'Cimarron Peak 1', model: 'Cimarron Peak' },
    { jobCode: 'FM-2609-781', name: 'Cimarron Peak 2', model: 'Cimarron Peak' }
  ],

  /* Per model: color, assembly, lines, and what the contract prints. */
  models: {
    'San Luis': {
      color: 'Bayview White Shaker', suffix: 'SBW',
      assembly: { rate: 20.50, hours: 12.5 },
      lines: [
        { sku: 'W362424-SBW',  desc: 'Bayview White Shaker W362424',  qty: 1, unitCost: 278.56, markupPct: 70, sellTotal: 473.55 },
        { sku: 'F342-SBW',     desc: 'Bayview White Shaker F342',     qty: 1, unitCost: 19.66,  markupPct: 50, sellTotal: 29.49 },
        { sku: 'TUK-SBW',      desc: 'Bayview White Shaker TUK',      qty: 1, unitCost: 31.45,  markupPct: 0,  sellTotal: 31.45 },
        { sku: 'SM8(SCR)-SBW', desc: 'Bayview White Shaker SM8(SCR)', qty: 3, unitCost: 17.97,  markupPct: 70, sellTotal: 91.65 },
        { sku: 'ACM8-SBW',     desc: 'Bayview White Shaker ACM8',     qty: 2, unitCost: 72.45,  markupPct: 70, sellTotal: 246.33 },
        { sku: 'TKC-SBW',      desc: 'Bayview White Shaker TKC',      qty: 3, unitCost: 19.66,  markupPct: 70, sellTotal: 100.27 },
        { sku: 'W3342-SBW',    desc: 'Bayview White Shaker W3342',    qty: 2, unitCost: 327.42, markupPct: 70, sellTotal: 1113.23 },
        { sku: 'W3018-SBW',    desc: 'Bayview White Shaker W3018',    qty: 1, unitCost: 158.37, markupPct: 70, sellTotal: 269.23 },
        { sku: 'VS30-SBW',     desc: 'Bayview White Shaker VS30',     qty: 2, unitCost: 230.26, markupPct: 70, sellTotal: 782.88 },
        { sku: 'SB36-SBW',     desc: 'Bayview White Shaker SB36',     qty: 1, unitCost: 299.90, markupPct: 70, sellTotal: 509.83 },
        { sku: 'B18-SBW',      desc: 'Bayview White Shaker B18',      qty: 2, unitCost: 230.26, markupPct: 70, sellTotal: 782.88 },
        { sku: 'B33-SBW',      desc: 'Bayview White Shaker B33',      qty: 2, unitCost: 374.59, markupPct: 70, sellTotal: 1273.61 }
      ],
      contract: { costTotal: 3370.79, cabinets: 5704.40, discount: 404.49, assembly: 256.25, ga: 111.12, tax: 418.69, total: 6085.97 }
    },

    'Mesa Ridge': {
      color: 'Moss Green Shaker', suffix: 'UMO',
      assembly: { rate: 22.25, hours: 10.25 },
      lines: [
        { sku: 'W362424-UMO', desc: 'Moss Green Shaker W362424', qty: 1, unitCost: 396.06, markupPct: 19, sellTotal: 471.31 },
        { sku: 'F342-UMO',    desc: 'Moss Green Shaker F342',    qty: 4, unitCost: 22.08,  markupPct: 10, sellTotal: 97.15 },
        { sku: 'SB36-UMO',    desc: 'Moss Green Shaker SB36',    qty: 1, unitCost: 427.81, markupPct: 19, sellTotal: 509.09 },
        { sku: 'TUK-UMO',     desc: 'Moss Green Shaker TUK',     qty: 1, unitCost: 36.80,  markupPct: 0,  sellTotal: 36.80 },
        { sku: 'TKC-UMO',     desc: 'Moss Green Shaker TKC',     qty: 4, unitCost: 25.30,  markupPct: 19, sellTotal: 120.43 },
        { sku: 'SCR-UMO',     desc: 'Moss Green Shaker SCR',     qty: 4, unitCost: 20.24,  markupPct: 19, sellTotal: 96.34 },
        { sku: 'ACM8-UMO',    desc: 'Moss Green Shaker ACM8',    qty: 2, unitCost: 72.68,  markupPct: 19, sellTotal: 172.98 },
        { sku: 'F642-UMO',    desc: 'Moss Green Shaker F642',    qty: 2, unitCost: 43.24,  markupPct: 19, sellTotal: 102.91 },
        { sku: 'W3018-UMO',   desc: 'Moss Green Shaker W3018',   qty: 1, unitCost: 231.85, markupPct: 19, sellTotal: 275.90 },
        { sku: 'W2442-UMO',   desc: 'Moss Green Shaker W2442',   qty: 2, unitCost: 387.79, markupPct: 19, sellTotal: 922.94 },
        { sku: '3VDB24-UMO',  desc: 'Moss Green Shaker 3VDB24',  qty: 1, unitCost: 506.01, markupPct: 19, sellTotal: 602.15 },
        { sku: '3VDB12-UMO',  desc: 'Moss Green Shaker 3VDB12',  qty: 1, unitCost: 394.23, markupPct: 19, sellTotal: 469.13 },
        { sku: 'VS30S-UMO',   desc: 'Moss Green Shaker VS30S',   qty: 4, unitCost: 344.08, markupPct: 19, sellTotal: 1637.82 },
        { sku: 'B21-UMO',     desc: 'Moss Green Shaker B21',     qty: 1, unitCost: 359.73, markupPct: 19, sellTotal: 428.08 },
        { sku: 'B24-UMO',     desc: 'Moss Green Shaker B24',     qty: 3, unitCost: 395.15, markupPct: 19, sellTotal: 1410.69 }
      ],
      contract: { costTotal: 6192.16, cabinets: 7353.73, discount: 743.06, assembly: 228.06, ga: 136.77, tax: 522.24, total: 7497.75 }
    },

    'Sangre Vista': {
      color: 'Bayview Wood Shaker', suffix: 'SWD',
      assembly: { rate: 20.50, hours: 9 },
      lines: [
        { sku: 'W362424-SWD',  desc: 'Bayview Wood Shaker W362424',  qty: 1, unitCost: 399.05, markupPct: 42, sellTotal: 566.65 },
        { sku: 'F342-SWD',     desc: 'Bayview Wood Shaker F342',     qty: 1, unitCost: 28.51,  markupPct: 0,  sellTotal: 28.51 },
        { sku: 'TUK-SWD',      desc: 'Bayview Wood Shaker TUK',      qty: 1, unitCost: 31.45,  markupPct: 0,  sellTotal: 31.45 },
        { sku: 'S2496-SWD',    desc: 'Bayview Wood Shaker S2496',    qty: 1, unitCost: 166.65, markupPct: 42, sellTotal: 236.64 },
        { sku: 'WSV42-SWD',    desc: 'Bayview Wood Shaker WSV42',    qty: 4, unitCost: 24.86,  markupPct: 42, sellTotal: 141.20 },
        { sku: 'BSV-SWD',      desc: 'Bayview Wood Shaker BSV',      qty: 3, unitCost: 38.01,  markupPct: 42, sellTotal: 161.92 },
        { sku: 'SM8(SCR)-SWD', desc: 'Bayview Wood Shaker SM8(SCR)', qty: 3, unitCost: 26.31,  markupPct: 42, sellTotal: 112.08 },
        { sku: 'ACM8-SWD',     desc: 'Bayview Wood Shaker ACM8',     qty: 2, unitCost: 103.79, markupPct: 42, sellTotal: 294.76 },
        { sku: 'TKC-SWD',      desc: 'Bayview Wood Shaker TKC',      qty: 3, unitCost: 28.51,  markupPct: 42, sellTotal: 121.45 },
        { sku: 'W1242-SWD',    desc: 'Bayview Wood Shaker W1242',    qty: 1, unitCost: 213.42, markupPct: 42, sellTotal: 303.06 },
        { sku: 'W2142-SWD',    desc: 'Bayview Wood Shaker W2142',    qty: 1, unitCost: 316.47, markupPct: 42, sellTotal: 449.39 },
        { sku: 'W3018-SWD',    desc: 'Bayview Wood Shaker W3018',    qty: 1, unitCost: 229.50, markupPct: 42, sellTotal: 325.89 },
        { sku: '3VDB12-SWD',   desc: 'Bayview Wood Shaker 3VDB12',   qty: 1, unitCost: 391.74, markupPct: 42, sellTotal: 556.27 },
        { sku: 'VS30-SWD',     desc: 'Bayview Wood Shaker VS30',     qty: 2, unitCost: 347.89, markupPct: 42, sellTotal: 988.01 },
        { sku: 'VS36-SWD',     desc: 'Bayview Wood Shaker VS36',     qty: 1, unitCost: 391.01, markupPct: 42, sellTotal: 555.23 },
        { sku: '3DB12-SWD',    desc: 'Bayview Wood Shaker 3DB12',    qty: 1, unitCost: 401.25, markupPct: 42, sellTotal: 569.78 },
        { sku: 'B21-SWD',      desc: 'Bayview Wood Shaker B21',      qty: 1, unitCost: 359.59, markupPct: 42, sellTotal: 510.62 },
        { sku: 'SB36-SWD',     desc: 'Bayview Wood Shaker SB36',     qty: 1, unitCost: 434.14, markupPct: 42, sellTotal: 616.48 },
        { sku: '2DB36-SWD',    desc: 'Bayview Wood Shaker 2DB36',    qty: 1, unitCost: 524.02, markupPct: 42, sellTotal: 744.11 }
      ],
      contract: { costTotal: 5168.09, cabinets: 7313.50, discount: 620.17, assembly: 184.50, ga: 137.56, tax: 528.77, total: 7544.16 }
    },

    'Pinyon Crest': {
      color: 'Moss Green Shaker', suffix: 'UMO',
      assembly: { rate: 22.25, hours: 9 },
      lines: [
        { sku: 'W362424-UMO', desc: 'Moss Green Shaker W362424', qty: 1, unitCost: 396.06, markupPct: 18, sellTotal: 467.35 },
        { sku: 'F342-UMO',    desc: 'Moss Green Shaker F342',    qty: 1, unitCost: 22.08,  markupPct: 0,  sellTotal: 22.08 },
        { sku: 'TUK-UMO',     desc: 'Moss Green Shaker TUK',     qty: 1, unitCost: 36.80,  markupPct: 0,  sellTotal: 36.80 },
        { sku: 'TKC-UMO',     desc: 'Moss Green Shaker TKC',     qty: 3, unitCost: 25.30,  markupPct: 18, sellTotal: 89.56 },
        { sku: 'SCR-UMO',     desc: 'Moss Green Shaker SCR',     qty: 3, unitCost: 20.24,  markupPct: 18, sellTotal: 71.65 },
        { sku: 'LACM8-UMO',   desc: 'Moss Green Shaker LACM8',   qty: 2, unitCost: 93.85,  markupPct: 18, sellTotal: 221.49 },
        { sku: 'W3018-UMO',   desc: 'Moss Green Shaker W3018',   qty: 1, unitCost: 231.85, markupPct: 18, sellTotal: 273.58 },
        { sku: 'W3642-UMO',   desc: 'Moss Green Shaker W3642',   qty: 2, unitCost: 516.13, markupPct: 18, sellTotal: 1218.07 },
        { sku: '3VDB12-UMO',  desc: 'Moss Green Shaker 3VDB12',  qty: 1, unitCost: 394.23, markupPct: 18, sellTotal: 465.19 },
        { sku: 'VS36-UMO',    desc: 'Moss Green Shaker VS36',    qty: 2, unitCost: 413.55, markupPct: 18, sellTotal: 975.98 },
        { sku: '3DB24-UMO',   desc: 'Moss Green Shaker 3DB24',   qty: 1, unitCost: 533.61, markupPct: 18, sellTotal: 629.66 },
        { sku: 'SB36-UMO',    desc: 'Moss Green Shaker SB36',    qty: 1, unitCost: 427.81, markupPct: 18, sellTotal: 504.82 },
        { sku: '3DB18-UMO',   desc: 'Moss Green Shaker 3DB18',   qty: 1, unitCost: 474.27, markupPct: 18, sellTotal: 559.64 },
        { sku: '2DB36-UMO',   desc: 'Moss Green Shaker 2DB36',   qty: 1, unitCost: 683.11, markupPct: 18, sellTotal: 806.07 },
        { sku: 'B36-UMO',     desc: 'Moss Green Shaker B36',     qty: 2, unitCost: 569.95, markupPct: 18, sellTotal: 1345.08 }
      ],
      contract: { costTotal: 6523.40, cabinets: 7687.01, discount: 782.81, assembly: 200.25, ga: 142.09, tax: 545.43, total: 7791.98 }
    },

    'Cimarron Peak': {
      color: 'Bayview White Shaker', suffix: 'SBW',
      assembly: { rate: 20.50, hours: 11.5 },
      lines: [
        { sku: 'W362424-SBW',  desc: 'Bayview White Shaker W362424',  qty: 1, unitCost: 278.56, markupPct: 72, sellTotal: 479.12 },
        { sku: 'F342-SBW',     desc: 'Bayview White Shaker F342',     qty: 1, unitCost: 19.66,  markupPct: 0,  sellTotal: 19.66 },
        { sku: 'TUK-SBW',      desc: 'Bayview White Shaker TUK',      qty: 1, unitCost: 31.45,  markupPct: 0,  sellTotal: 31.45 },
        { sku: 'SM8(SCR)-SBW', desc: 'Bayview White Shaker SM8(SCR)', qty: 3, unitCost: 17.97,  markupPct: 58, sellTotal: 85.18 },
        { sku: 'ACM8-SBW',     desc: 'Bayview White Shaker ACM8',     qty: 2, unitCost: 72.45,  markupPct: 72, sellTotal: 249.23 },
        { sku: 'TKC-SBW',      desc: 'Bayview White Shaker TKC',      qty: 3, unitCost: 19.66,  markupPct: 72, sellTotal: 101.45 },
        { sku: 'W2142-SBW',    desc: 'Bayview White Shaker W2142',    qty: 2, unitCost: 217.34, markupPct: 72, sellTotal: 747.65 },
        { sku: 'W3018-SBW',    desc: 'Bayview White Shaker W3018',    qty: 1, unitCost: 158.37, markupPct: 72, sellTotal: 272.40 },
        { sku: '3VDB12-SBW',   desc: 'Bayview White Shaker 3VDB12',   qty: 1, unitCost: 272.94, markupPct: 72, sellTotal: 469.46 },
        { sku: 'VS30-SBW',     desc: 'Bayview White Shaker VS30',     qty: 3, unitCost: 230.26, markupPct: 72, sellTotal: 1188.14 },
        { sku: 'VS36-SBW',     desc: 'Bayview White Shaker VS36',     qty: 1, unitCost: 263.39, markupPct: 72, sellTotal: 453.03 },
        { sku: '2DB36-SBW',    desc: 'Bayview White Shaker 2DB36',    qty: 1, unitCost: 421.20, markupPct: 72, sellTotal: 724.46 },
        { sku: 'SB36-SBW',     desc: 'Bayview White Shaker SB36',     qty: 1, unitCost: 299.90, markupPct: 72, sellTotal: 515.83 },
        { sku: 'B18-SBW',      desc: 'Bayview White Shaker B18',      qty: 1, unitCost: 230.26, markupPct: 72, sellTotal: 396.05 },
        { sku: '3DB21-SBW',    desc: 'Bayview White Shaker 3DB21',    qty: 1, unitCost: 353.25, markupPct: 72, sellTotal: 607.59 },
        { sku: 'B21-SBW',      desc: 'Bayview White Shaker B21',      qty: 1, unitCost: 247.10, markupPct: 72, sellTotal: 425.01 }
      ],
      contract: { costTotal: 3959.33, cabinets: 6765.70, discount: 475.12, assembly: 235.75, ga: 130.53, tax: 496.96, total: 7153.81 }
    }
  }
}));
