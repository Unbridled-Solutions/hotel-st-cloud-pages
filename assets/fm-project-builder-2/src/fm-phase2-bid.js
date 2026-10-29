/*
 * Fremont Makers · Project Builder · Phase 2 · Bid pages and grandfathered prices
 * Version 0.1.0-phase2. Pure functions: no DOM, storage or network. Money is integer cents.
 * UMD: require() in Node, window.FMBid in a browser. Input `priced` is FMQuote.priceHouse() output.
 *
 * Owner decisions, 2026-10-27 (HANDOFF.md §8 question 7, §18):
 *   - A job priced BY BID prints a lump-sum page: every cabinet with its quantity, no prices,
 *     and one "Agreed bid price". The page adds up and doesn't expose the margin.
 *     The itemized pricing stays on the internal job page.
 *   - A signed job brought over from the old tool keeps its signed total. The itemized price
 *     is recomputed with the corrected math, and any difference is recorded as ONE internal line,
 *     "Agreed price (grandfathered from signed contract)". Penrose is the only known case.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMBid = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.1.0-phase2';

  function money(c) {
    var n = Math.abs(c), s = '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2);
    return c < 0 ? '−' + s : s;
  }

  /*
   * Customer page for a bid. Returns { customer: {...}, internal: {...} }.
   * customer.rows have description, sku and qty only. No unit prices, line totals, cost or margin.
   */
  function bidPage(priced, bidCents, opts) {
    opts = opts || {};
    if (!(bidCents > 0)) throw new Error('Enter the agreed bid price.');
    var itemized = priced.summary.totalCents;
    return {
      customer: {
        title: 'Final Job Quote · Agreed bid',
        rows: priced.lines.map(function (l) { return { description: l.description, sku: l.sku, qty: l.qty }; }),
        includes: 'Includes cabinets and hardware listed, assembly' + (priced.summary.taxCents ? ', and Colorado sales tax' : '') + '.',
        totalLabel: 'Agreed bid price',
        totalCents: bidCents
      },
      internal: {
        itemizedCents: itemized,
        bidCents: bidCents,
        differenceCents: bidCents - itemized,
        note: 'Bid is ' + money(Math.abs(bidCents - itemized)) + (bidCents >= itemized ? ' above' : ' below') + ' the itemized price.'
      }
    };
  }

  /*
   * A signed job brought over from the old tool. Small differences (≤ $1) stay a rounding line
   * (FMQuote.reconcileToSigned, §12). Anything larger is grandfathered as one internal line.
   * meta: { jobCode, signedDate }
   */
  function grandfather(priced, signedCents, meta) {
    meta = meta || {};
    var diff = signedCents - priced.summary.totalCents;
    if (Math.abs(diff) <= 100) return { kind: diff === 0 ? 'match' : 'rounding', differenceCents: diff, totalCents: signedCents, line: null };
    return {
      kind: 'grandfathered', differenceCents: diff, totalCents: signedCents, internalOnly: true,
      line: { key: 'grandfathered', label: 'Agreed price (grandfathered from signed contract' + (meta.signedDate ? ', ' + meta.signedDate : '') + ')', cents: diff },
      log: (meta.jobCode ? meta.jobCode + ': ' : '') + 'brought over at its signed total ' + money(signedCents) + '. Corrected itemized price ' +
           money(priced.summary.totalCents) + '; ' + money(diff) + ' recorded as agreed (grandfathered) pricing.'
    };
  }

  return { VERSION: VERSION, bidPage: bidPage, grandfather: grandfather, money: money };
}));
