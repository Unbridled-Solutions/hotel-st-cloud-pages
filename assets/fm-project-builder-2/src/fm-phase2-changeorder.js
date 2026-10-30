/*
 * Fremont Makers · Project Builder · Phase 2 · Courtesy change orders
 * Version 0.2.0-phase2. Pure functions: no DOM, storage or network. Money is integer cents.
 * UMD: require() in Node, window.FMChangeOrder in a browser.
 *
 * A courtesy change order is a change the shop makes at no charge, e.g. a backordered
 * cabinet swapped for one that's in stock, while still keeping a paper trail.
 *   - The customer pays nothing more and the contract total doesn't move (amountCents 0).
 *   - Internally it records what the shop absorbed: the real cost of what was added,
 *     less any supplier credit for what was removed.
 *   - The owner approves it (it gives money away), and the buyer can acknowledge it.
 * See HANDOFF.md §17.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMChangeOrder = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.3.0-phase2';

  var REASONS = {
    backorder: 'Backordered item substituted',
    goodwill: 'Goodwill',
    shop_error: 'Our mistake, corrected at our cost',
    other: 'Other'
  };

  function blank(s) { return s == null || String(s).trim() === ''; }
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function money(c) {
    var n = Math.abs(c), s = '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2);
    return c < 0 ? '−' + s : s;
  }
  function lineLabel(l) { return l.sku + ' ×' + l.qty; }

  /*
   * input: { number, date, reason, note, requestedBy,
   *          removed: [{ sku, desc, qty }], removedSellCents,
   *          added:   [{ sku, desc, qty, unitCostCents }],
   *          supplierOrder: { number, paidCents }, supplierCreditCents (null = not known yet) }
   * opts:  { today }
   * Returns { ok, problems[], warnings[], co }. `co` is returned even with problems so the
   * screen can show the draft; it can't be approved or printed until problems are fixed.
   */
  function courtesy(input, opts) {
    input = input || {}; opts = opts || {};
    var P = [], W = [];
    var removed = (input.removed || []).map(function (l) { return { sku: l.sku, desc: l.desc || l.sku, qty: l.qty }; });
    var added = (input.added || []).map(function (l) { return { sku: l.sku, desc: l.desc || l.sku, qty: l.qty, unitCostCents: l.unitCostCents == null ? null : l.unitCostCents }; });

    if (!REASONS[input.reason]) P.push('Choose why this change is a courtesy.');
    if (input.reason === 'other' && blank(input.note)) P.push('Add a note saying why.');
    if (!removed.length && !added.length) P.push('Add the cabinets that came off or went on.');
    if (!isISO(input.date)) P.push('Enter the change date.');
    else if (opts.today && input.date > opts.today) P.push('The change date can\'t be in the future.');
    if (blank(input.requestedBy)) P.push('Sign in so the change is recorded under your name.');
    removed.concat(added).forEach(function (l) { if (!(l.qty > 0)) P.push(l.sku + ': quantity must be at least 1.'); });
    added.forEach(function (l) {
      if (!(l.unitCostCents > 0)) P.push('Enter what ' + l.sku + ' cost us. It was entered at $0, so the cost the shop absorbed would be missing.');
    });

    var addedCost = sum(added.map(function (l) { return (l.unitCostCents || 0) * l.qty; }));
    var paid = input.supplierOrder && input.supplierOrder.paidCents > 0 ? input.supplierOrder.paidCents : null;
    var credit = input.supplierCreditCents == null ? null : input.supplierCreditCents;
    if (removed.length && credit == null) W.push('Not known yet whether the supplier credited the removed cabinets (' + removed.map(lineLabel).join(', ') + '). Until it is, the absorbed cost assumes no credit.');
    if (added.length && paid == null) W.push('Link the supplier order for the added cabinets so the absorbed cost uses what was actually paid (with tax and discount).');
    var spent = paid != null ? paid : addedCost;
    var absorbed = spent - (credit || 0);

    var co = {
      kind: 'courtesy', number: input.number, date: input.date,
      reason: input.reason, reasonLabel: REASONS[input.reason] || '', note: input.note || '',
      removed: removed, added: added,
      amountCents: 0, customerChangeCents: 0, contractDeltaCents: 0,   // the customer is never charged
      addedCostCents: addedCost, supplierPaidCents: paid, supplierCreditCents: credit,
      absorbedCents: absorbed, absorbedIsEstimate: removed.length > 0 && credit == null,
      removedSellCents: input.removedSellCents == null ? null : input.removedSellCents,
      supplierOrder: input.supplierOrder || null,
      requestedBy: input.requestedBy || '', approvedBy: null, approvedAt: null,
      buyerAck: 'none', status: 'draft'
    };
    return { ok: P.length === 0, problems: P, warnings: W, co: co };
  }

  /* The owner approves a courtesy change order (it gives money away). */
  function approve(co, who, opts) {
    opts = opts || {};
    var owners = (opts.owners || []).map(function (o) { return String(o).toLowerCase(); });
    if (co.status !== 'draft') return { ok: false, error: 'Change order ' + co.number + ' is already ' + co.status + '.' };
    if (blank(who) || owners.indexOf(String(who).toLowerCase()) < 0) return { ok: false, error: 'Only the owner can approve a courtesy change order.' };
    if (who === co.requestedBy && opts.allowSelfApproval === false) return { ok: false, error: 'Someone other than the requester must approve it.' };
    var next = JSON.parse(JSON.stringify(co));
    next.approvedBy = who; next.approvedAt = opts.at || null; next.status = 'approved';
    return {
      ok: true, co: next,
      log: 'Change order ' + co.number + ' (courtesy, no charge) approved by ' + who + '. Shop absorbs ' + money(co.absorbedCents) +
           (co.absorbedIsEstimate ? ' (before any supplier credit)' : '') + '. Contract total unchanged.'
    };
  }

  /* What the customer sees. Never shows cost, margin or the absorbed amount. */
  function printed(co, job) {
    var rows = co.removed.map(function (l) { return { action: 'Removed', sku: l.sku, desc: l.desc, qty: l.qty + ' → 0', price: '' }; })
      .concat(co.added.map(function (l) { return { action: 'Added', sku: l.sku, desc: l.desc, qty: '0 → ' + l.qty, price: 'No charge' }; }));
    return {
      title: 'Change Order ' + co.number + ' · Courtesy',
      headline: 'No charge to you. Your contract total stays ' + money(job.contractTotalCents) + '.',
      why: co.reasonLabel + (co.note ? ': ' + co.note : '') + '.',
      rows: rows,
      acknowledgement: 'Buyer acknowledges the change above at no charge.'
    };
  }

  /* Internal job view: what the shop gave away on courtesy changes. */
  function absorbedTotal(changeOrders) {
    var list = (changeOrders || []).filter(function (c) { return c.kind === 'courtesy' && c.status === 'approved'; });
    return { count: list.length, cents: sum(list.map(function (c) { return c.absorbedCents; })),
             estimate: list.some(function (c) { return c.absorbedIsEstimate; }) };
  }

  /* ================= The change order flow (HANDOFF.md §19) ================= */

  var CHANGE_REASONS = {
    customer_request: 'Customer request', site_change: 'Site or plan change',
    backorder: 'Backordered item substituted', our_mistake: 'Our mistake', other: 'Other'
  };
  function suffixOf(sku) { var p = String(sku || '').split('-'); return p.length > 1 ? p[p.length - 1].toUpperCase() : ''; }

  /*
   * Apply a supplier PDF (or hand edits) to a house's current cabinet list.
   * mode 'add' (default): incoming quantities ADD to what's there. Never lowers a quantity.
   * mode 'replace': the incoming list becomes the whole list.
   * Returns { lines, added:[{sku,desc,from,to}], removed:[…], changed:[…] }.
   */
  function mergeLines(current, incoming, mode) {
    var cur = {}, order = [], out = {};
    (current || []).forEach(function (l) { cur[l.sku] = l; order.push(l.sku); });
    if (mode === 'replace') {
      (incoming || []).forEach(function (l) { out[l.sku] = JSON.parse(JSON.stringify(l)); if (order.indexOf(l.sku) < 0) order.push(l.sku); });
    } else {
      order.forEach(function (k) { out[k] = JSON.parse(JSON.stringify(cur[k])); });
      (incoming || []).forEach(function (l) {
        if (out[l.sku]) out[l.sku].qty += l.qty;
        else { out[l.sku] = JSON.parse(JSON.stringify(l)); order.push(l.sku); }
      });
    }
    var added = [], removed = [], changed = [], lines = [];
    order.forEach(function (k) {
      var a = cur[k] ? cur[k].qty : 0, b = out[k] ? out[k].qty : 0, d = (out[k] || cur[k]).desc;
      if (out[k]) lines.push(out[k]);
      if (!a && b) added.push({ sku: k, desc: d, from: 0, to: b });
      else if (a && !b) removed.push({ sku: k, desc: d, from: a, to: 0 });
      else if (a !== b) changed.push({ sku: k, desc: d, from: a, to: b });
    });
    return { lines: lines, added: added, removed: removed, changed: changed };
  }

  /* Cabinets whose color code (SKU suffix) doesn't match the house, e.g. Bayview White (SBW) on a Moss Green (UMO) house. */
  function colorCheck(lines, houseSuffix) {
    var want = String(houseSuffix || '').toUpperCase();
    return (lines || []).filter(function (l) { return suffixOf(l.sku) && suffixOf(l.sku) !== want; })
      .map(function (l) { return { sku: l.sku, qty: l.qty, suffix: suffixOf(l.sku) }; });
  }

  /*
   * A whole-order change order PDF covers several houses. Group its lines by color code and
   * list which models use that color, so the person assigns each group to houses (not one house).
   * models: { 'San Luis': 'SBW', … }
   */
  function splitByColor(lines, models) {
    var groups = {}, unmatched = [];
    (lines || []).forEach(function (l) {
      var s = suffixOf(l.sku), names = Object.keys(models || {}).filter(function (n) { return String(models[n]).toUpperCase() === s; });
      if (!names.length) { unmatched.push(l); return; }
      if (!groups[s]) groups[s] = { suffix: s, models: names, lines: [] };
      groups[s].lines.push(l);
    });
    return { groups: Object.keys(groups).map(function (k) { return groups[k]; }), unmatched: unmatched };
  }

  /*
   * Price the change. Settings start from the job's, but every one can be set for this change order alone
   * (owner, Oct 2026): markup on new lines, discount, G&A, tax, and assembly labor for the change.
   * change:   { added:[{sku,desc,qty,unitCostCents,markupPct?}], removed:[…same, unitCostCents & markupPct as sold…] }
   * settings: { markupPct, discountPctOfCost, gaPct, taxPct, labor: [{ role, rateCents, hours }] }   (labor is for the change, added side)
   * Returns { ok, addedCents, removedCents, deltaCents, lines, summary, taxCents, costCents } or { ok:false, error }.
   *   lines:   priced rows for the document; removed rows have negative qty and totals
   *   summary: { cabinetsCents, discountCents, laborCents, gaCents, taxCents, totalCents } for the change (added − removed)
   */
  function priceChange(change, settings, Q) {
    Q = Q || (typeof require === 'function' && typeof module === 'object' ? require('./fm-phase1-quote.js') : globalThis.FMQuote);
    function price(list, labor) {
      if ((!list || !list.length) && !(labor && labor.length)) return null;
      var p = Q.priceHouse({ lines: (list || []).map(function (l) {
        return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct == null ? settings.markupPct : l.markupPct };
      }), discountPctOfCost: settings.discountPctOfCost, labor: labor || [], gaPct: settings.gaPct, taxPct: settings.taxPct });
      if (!p.ok) throw new Error(p.error);
      return p;
    }
    function parts(p) {
      if (!p) return { cabinetsCents: 0, discountCents: 0, laborCents: 0, gaCents: 0, taxCents: 0, totalCents: 0, costCents: 0 };
      var s = p.summary;
      return { cabinetsCents: s.cabinetsCents, discountCents: -s.discountCents, laborCents: s.laborCents, gaCents: s.gaCents, taxCents: s.taxCents, totalCents: s.totalCents, costCents: p.internal.costCents };
    }
    try {
      var labor = (settings.labor || []).filter(function (w) { return w.hours > 0 && w.rateCents > 0; });
      var pa = price(change.added, labor), pr = price(change.removed, null), a = parts(pa), r = parts(pr), summary = {};
      Object.keys(a).forEach(function (k) { summary[k] = a[k] - r[k]; });
      var lines = (pa ? pa.lines.map(function (l) { return { sku: l.sku, desc: l.description, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct, unitCents: l.unitCents, totalCents: l.totalCents }; }) : [])
        .concat(pr ? pr.lines.map(function (l) { return { sku: l.sku, desc: l.description, qty: -l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct, unitCents: l.unitCents, totalCents: -l.totalCents, removed: true }; }) : []);
      return { ok: true, addedCents: a.totalCents, removedCents: r.totalCents, deltaCents: summary.totalCents, lines: lines, summary: summary,
               taxCents: summary.taxCents, costCents: summary.costCents,
               settings: { markupPct: settings.markupPct, discountPctOfCost: settings.discountPctOfCost, gaPct: settings.gaPct, taxPct: settings.taxPct, labor: labor } };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /*
   * Decide what the change costs the customer. There is NO default: the person must choose.
   *   'charge'   – priced with the change order's settings (priceChange; they start from the job's).
   *   'courtesy' – $0 to the customer, cost absorbed, owner approves (see courtesy()).
   *   'custom'   – an agreed amount; needs a note saying why it differs.
   */
  function choosePrice(choice, priced, custom) {
    if (['charge', 'courtesy', 'custom'].indexOf(choice) < 0) return { ok: false, error: 'Choose how this change is priced: charge it, courtesy, or an agreed amount.' };
    if (choice === 'courtesy') return { ok: true, amountCents: 0, kind: 'courtesy' };
    if (choice === 'charge') return priced && priced.ok ? { ok: true, amountCents: priced.deltaCents, kind: 'charge' } : { ok: false, error: 'Price the cabinets first.' };
    custom = custom || {};
    if (!(typeof custom.amountCents === 'number') || isNaN(custom.amountCents)) return { ok: false, error: 'Enter the agreed amount.' };
    if (blank(custom.note)) return { ok: false, error: 'Say why the agreed amount differs from the priced change.' };
    return { ok: true, amountCents: custom.amountCents, kind: 'custom', note: custom.note,
             differsByCents: priced && priced.ok ? custom.amountCents - priced.deltaCents : null };
  }

  /* Owner decision 2026-10-27 (question 2): each change order gets its own invoice. Due on signing by default. */
  function invoiceFor(co, opts) {
    opts = opts || {};
    if (!co.amountCents) return null;                          // courtesy or $0: nothing to bill
    var credit = co.amountCents < 0;
    return {
      role: credit ? 'change_order_credit' : 'change_order', changeOrderId: co.id || null,
      label: (credit ? 'Credit · ' : '') + 'Change order ' + co.number,
      amountCents: co.amountCents, due: opts.due || opts.today || null,
      status: 'waiting for signature',                          // becomes Due when the change order is signed
      note: credit ? 'Applied against the next unpaid invoice, or refunded.' : 'Due on signing. The original invoices are unchanged.'
    };
  }

  return { VERSION: VERSION, REASONS: REASONS, CHANGE_REASONS: CHANGE_REASONS, courtesy: courtesy, approve: approve, printed: printed,
           absorbedTotal: absorbedTotal, money: money, mergeLines: mergeLines, colorCheck: colorCheck, splitByColor: splitByColor,
           priceChange: priceChange, choosePrice: choosePrice, invoiceFor: invoiceFor, suffixOf: suffixOf };
}));
