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
  var VERSION = '0.4.0-phase2';

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
    var removed = (input.removed || []).map(function (l) { var r = { sku: l.sku, desc: l.desc || l.sku, qty: l.qty }; if (l.from != null && l.to != null) { r.from = l.from; r.to = l.to; } return r; });
    var added = (input.added || []).map(function (l) { return { sku: l.sku, desc: l.desc || l.sku, qty: l.qty, unitCostCents: l.unitCostCents == null ? null : l.unitCostCents }; });

    if (!REASONS[input.reason]) P.push('Choose why this change is a courtesy.');
    if (input.reason === 'other' && blank(input.note)) P.push('Add a note saying why.');
    if (!removed.length && !added.length && !(input.replaced || []).length) P.push('Add the cabinets that came off or went on.');
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
    var replaced = cleanReplaced(input.replaced);
    replaced.forEach(function (l) { if (!(l.unitCostCents > 0)) P.push('Enter what the replacement ' + l.sku + ' costs us.'); if (!CLAIMS[l.claim]) P.push('Say who the damage claim for ' + l.sku + ' goes to (or that we cover it).'); });

    var co = {
      kind: 'courtesy', number: input.number, date: input.date,
      reason: input.reason, reasonLabel: REASONS[input.reason] || '', note: input.note || '',
      removed: removed, added: added,
      amountCents: 0, customerChangeCents: 0, contractDeltaCents: 0,   // the customer is never charged
      addedCostCents: addedCost, supplierPaidCents: paid, supplierCreditCents: credit,
      replaced: replaced, replacedCostCents: sum(replaced.map(function (l) { return (l.unitCostCents || 0) * l.qty; })),
      absorbedCents: 0, absorbedIsEstimate: false,
      removedSellCents: input.removedSellCents == null ? null : input.removedSellCents,
      supplierOrder: input.supplierOrder || null,
      requestedBy: input.requestedBy || '', approvedBy: null, approvedAt: null,
      buyerAck: 'none', status: 'draft'
    };
    var ab = absorbedFor(co); co.absorbedCents = ab.cents; co.absorbedIsEstimate = ab.estimate;
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
    var rows = co.removed.map(function (l) { return l.to ? { action: 'Changed', sku: l.sku, desc: l.desc, qty: l.from + ' → ' + l.to, price: '' } : { action: 'Removed', sku: l.sku, desc: l.desc, qty: (l.from != null ? l.from : l.qty) + ' → 0', price: '' }; })
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
    backorder: 'Backordered item substituted', our_mistake: 'Our mistake', other: 'Other',
    add: 'Cabinets added', swap: 'Cabinets swapped', remove: 'Cabinets removed or returned', backorder_wait: 'Backordered: new delivery date',
    damage: 'Damaged cabinet replaced', mistake: 'Corrected at our cost'
  };
  function suffixOf(sku) { var p = String(sku || '').split('-'); return p.length > 1 ? p[p.length - 1].toUpperCase() : ''; }

  /*
   * Apply a supplier PDF (or hand edits) to a house's current cabinet list.
   * mode 'add' (default): incoming quantities ADD to what's there. Never lowers a quantity.
   * mode 'replace': the incoming list becomes the whole list.
   * Returns { lines, added:[{sku,desc,from,to}], removed:[…], changed:[…] }.
   */
  /*
   * Read a list of cabinet SKUs: pasted text, or a CSV / spreadsheet export (comma or tab separated).
   * One cabinet per line, quantity before or after the SKU ("W3042-SBW 2", "2 x W3042-SBW", "W3042-SBW, 2", "W3042-SBW x2").
   * A header row naming columns (sku / item, qty / quantity, description, cost / price) is used when present.
   * No quantity means 1. The same SKU twice adds up. Returns { lines: [{ sku, qty, desc?, unitCostCents? }], skipped: [text] }.
   */
  var SKU_RE = /^[A-Z0-9][A-Z0-9.\/]*(?:-[A-Z0-9.\/]+)*$/i;
  function parseSkus(text) {
    var rows = String(text || '').replace(/\r/g, '').split('\n').map(function (r) { return r.trim(); }).filter(Boolean), out = {}, order = [], skipped = [], cols = null;
    function cells(r) { return (r.indexOf('\t') >= 0 ? r.split('\t') : r.indexOf(',') >= 0 ? r.split(',') : r.split(/\s+/)).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }).filter(function (x) { return x !== ''; }); }
    function cents(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) || n <= 0 ? null : Math.round(n * 100); }
    function add(sku, qty, desc, cost, raw) {
      sku = String(sku || '').toUpperCase();
      if (!SKU_RE.test(sku) || !/[A-Z]/.test(sku) || !/\d/.test(sku) || !(qty > 0) || qty !== Math.floor(qty)) { skipped.push(raw); return; }
      if (!out[sku]) { out[sku] = { sku: sku, qty: 0 }; order.push(sku); }
      out[sku].qty += qty;
      if (desc && !out[sku].desc) out[sku].desc = desc;
      if (cost && !out[sku].unitCostCents) out[sku].unitCostCents = cost;
    }
    rows.forEach(function (r, i) {
      var c = cells(r), low = c.map(function (x) { return x.toLowerCase(); });
      if (i === 0 && low.some(function (x) { return /^(sku|item|item #|item number|part|model)$/.test(x); })) {
        cols = { sku: -1, qty: -1, desc: -1, cost: -1 };
        low.forEach(function (x, k) {
          if (cols.sku < 0 && /^(sku|item|item #|item number|part|model)$/.test(x)) cols.sku = k;
          else if (cols.qty < 0 && /^(qty|quantity|qty\.|count)$/.test(x)) cols.qty = k;
          else if (cols.desc < 0 && /^(description|desc|name)$/.test(x)) cols.desc = k;
          else if (cols.cost < 0 && /^(cost|unit cost|price|unit price)$/.test(x)) cols.cost = k;
        });
        return;
      }
      if (cols) {   // a header told us which column is which (CSV cells keep their spaces)
        var cc = (r.indexOf('\t') >= 0 ? r.split('\t') : r.split(',')).map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
        return add(cc[cols.sku], cols.qty >= 0 && cc[cols.qty] !== '' ? +cc[cols.qty] : 1, cols.desc >= 0 ? cc[cols.desc] : '', cols.cost >= 0 ? cents(cc[cols.cost]) : null, r);
      }
      var m = /^(\d+)\s*[x×]?\s+(\S+)$/i.exec(r) || null;
      if (m) return add(m[2], +m[1], '', null, r);
      m = /^(\S+?)[\s,\t]+(?:x|×|qty:?)?\s*(\d+)$/i.exec(r);
      if (m) return add(m[1].replace(/,$/, ''), +m[2], '', null, r);
      m = /^(\S+?)\s*[x×](\d+)$/i.exec(r);
      if (m) return add(m[1], +m[2], '', null, r);
      if (c.length === 1) return add(c[0], 1, '', null, r);
      skipped.push(r);
    });
    return { lines: order.map(function (k) { return out[k]; }), skipped: skipped };
  }

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
      // other charges or credits (restocking fee, freight, extra labor, a credit): at the amount entered, taxed only if marked taxable
      var extras = cleanExtras(change.extras), exTax = 0;
      extras.forEach(function (x) { if (x.taxable) exTax += Math.round(x.amountCents * (settings.taxPct || 0) / 100); });
      summary.otherCents = sum(extras.map(function (x) { return x.amountCents; }));
      summary.taxCents += exTax; summary.totalCents += summary.otherCents + exTax;
      var lines = (pa ? pa.lines.map(function (l) { return { sku: l.sku, desc: l.description, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct, unitCents: l.unitCents, totalCents: l.totalCents }; }) : [])
        .concat(pr ? pr.lines.map(function (l) { return { sku: l.sku, desc: l.description, qty: -l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct, unitCents: l.unitCents, totalCents: -l.totalCents, removed: true }; }) : [])
        .concat(extras.map(function (x) { return { sku: '', desc: x.label + (x.taxable ? ' (taxable)' : ''), qty: 1, unitCents: x.amountCents, totalCents: x.amountCents, extra: true }; }));
      return { ok: true, addedCents: a.totalCents, removedCents: r.totalCents, deltaCents: summary.totalCents, lines: lines, summary: summary,
               taxCents: summary.taxCents, costCents: summary.costCents,
               removedCostCents: r.costCents, extras: extras,
               settings: { markupPct: settings.markupPct, discountPctOfCost: settings.discountPctOfCost, gaPct: settings.gaPct, taxPct: settings.taxPct, labor: labor } };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /*
   * Decide what the change costs the customer. There is NO default: the person must choose.
   *   'charge'   – priced with the change order's settings (priceChange; they start from the job's).
   *   'courtesy' – $0 to the customer, cost absorbed, owner approves (see courtesy()).
   *   'custom'   – an agreed amount; needs a note saying why it differs.
   */
  function choosePrice(choice, priced, custom, opts) {
    opts = opts || {};
    if (['charge', 'courtesy', 'custom', 'nochange'].indexOf(choice) < 0) return { ok: false, error: 'Choose how this change is priced: charge it, courtesy, an agreed amount, or no change to the contract.' };
    if (choice === 'nochange') return opts.sellChanges ? { ok: false, error: '"No change to the contract" is for replacements and new dates only. Cabinets were added or removed, or a fee was entered: charge it, make it a courtesy, or enter an agreed amount.' } : { ok: true, amountCents: 0, kind: 'notice' };
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


  /* ================= What happened (2.11.0, HANDOFF.md §32) =================
   * The flow starts from what happened, which picks the reason, opens the right tools and suggests (never chooses)
   * how it's billed. Every type can still use every tool: add, remove, swap, replace, other charges, new date. */
  var TYPES = {
    add: { label: 'Add cabinets', help: 'The customer wants more cabinets or accessories.', reason: 'add', usually: 'charge' },
    swap: { label: 'Swap cabinets', help: 'A different size, style or color in place of what was sold. Use Swap on the line.', reason: 'swap', usually: 'charge' },
    remove: { label: 'Remove or return', help: 'Cabinets come off the order or come back. The customer is credited what they paid for them; add a restocking fee under Other charges if one applies.', reason: 'remove', usually: 'charge' },
    backorder: { label: 'Backordered', help: 'A cabinet won\'t arrive in time. Swap in one that\'s in stock, or wait for it and record the new date.', reason: 'backorder', usually: 'courtesy' },
    damage: { label: 'Damaged', help: 'A cabinet arrived or was installed damaged. Reorder it at our cost and note who the claim goes to.', reason: 'damage', usually: 'nochange' },
    mistake: { label: 'Our mistake', help: 'Wrong cabinet ordered, measured or built. We fix it at our cost.', reason: 'mistake', usually: 'courtesy' },
    other: { label: 'Something else', help: 'Extra labor, freight, a fee or a credit, or only a new delivery date.', reason: 'other', usually: null }
  };
  var CLAIMS = { supplier: 'Supplier (warranty / damage claim)', freight: 'Freight carrier', none: 'We cover it' };
  var CHOICES = { charge: 'Charge it', courtesy: 'Courtesy ($0)', custom: 'Agreed amount', nochange: 'No change to the contract' };

  function cleanReplaced(list) {
    return (list || []).filter(function (l) { return l && l.qty > 0; }).map(function (l) {
      return { sku: l.sku, desc: l.desc || l.sku, qty: l.qty, unitCostCents: l.unitCostCents == null ? null : l.unitCostCents, claim: l.claim || null, why: l.why || '' };
    });
  }
  function cleanExtras(list) {
    return (list || []).filter(function (x) { return x && !blank(x.label) && typeof x.amountCents === 'number' && !isNaN(x.amountCents) && x.amountCents !== 0; })
      .map(function (x) { return { label: String(x.label).trim(), amountCents: Math.round(x.amountCents), taxable: !!x.taxable }; });
  }

  /* What changed between the list as signed and the list now. Quantities only; a line at 0 was removed. */
  function diffLines(base, current) {
    var before = {}; (base || []).forEach(function (l) { before[l.sku] = l; });
    var seen = {}, added = [], removed = [];
    (current || []).forEach(function (l) {
      var b = before[l.sku]; seen[l.sku] = true;
      if (!b && l.qty > 0) { var a = JSON.parse(JSON.stringify(l)); if (!l.mkEdited) delete a.markupPct; delete a.mkEdited; delete a.swapFor; added.push(a); }
      else if (b && l.qty !== b.qty) (l.qty > b.qty ? added : removed).push({ sku: l.sku, desc: l.desc, qty: Math.abs(l.qty - b.qty), unitCostCents: l.unitCostCents, markupPct: l.qty > b.qty && l.mkEdited ? l.markupPct : b.markupPct, from: b.qty, to: l.qty });
    });
    (base || []).forEach(function (b) { if (!seen[b.sku] && b.qty > 0) removed.push({ sku: b.sku, desc: b.desc, qty: b.qty, unitCostCents: b.unitCostCents, markupPct: b.markupPct, from: b.qty, to: 0 }); });
    return { added: added, removed: removed };
  }

  /* Swap one line for another: the old line goes down by qty, the new one goes on (or up) by qty. Never changes the input. */
  function swapLine(current, sku, replacement, qty) {
    var out = JSON.parse(JSON.stringify(current || [])), old = out.filter(function (l) { return l.sku === sku; })[0];
    if (!old) return { ok: false, error: sku + ' isn\'t on the list.' };
    if (!replacement || blank(replacement.sku)) return { ok: false, error: 'Enter the SKU it\'s swapped for.' };
    if (String(replacement.sku).toUpperCase() === String(sku).toUpperCase()) return { ok: false, error: 'That\'s the same SKU. To replace a damaged one with the same cabinet, use Replace.' };
    qty = qty == null ? old.qty : qty;
    if (!(qty > 0) || qty > old.qty) return { ok: false, error: 'Swap between 1 and ' + old.qty + ' of ' + sku + '.' };
    if (!(replacement.unitCostCents > 0)) return { ok: false, error: 'Enter what ' + replacement.sku + ' costs us.' };
    old.qty -= qty;
    var have = out.filter(function (l) { return String(l.sku).toUpperCase() === String(replacement.sku).toUpperCase(); })[0];
    if (have) have.qty += qty;
    else out.push({ sku: String(replacement.sku).trim(), desc: replacement.desc || String(replacement.sku).trim(), qty: qty, unitCostCents: replacement.unitCostCents, swapFor: sku });
    return { ok: true, lines: out };
  }

  /* Add a cabinet by hand (not on a supplier PDF yet). Adds to the quantity if the SKU is already on the list. */
  function addLine(current, line) {
    line = line || {};
    var P = [];
    if (blank(line.sku)) P.push('Enter the SKU.');
    if (!(line.qty > 0) || Math.floor(line.qty) !== line.qty) P.push('Quantity must be a whole number, 1 or more.');
    if (!(line.unitCostCents > 0)) P.push('Enter what it costs us (the supplier\'s price before the manufacturer discount).');
    if (P.length) return { ok: false, problems: P };
    var out = JSON.parse(JSON.stringify(current || [])), sku = String(line.sku).trim().toUpperCase();
    var have = out.filter(function (l) { return String(l.sku).toUpperCase() === sku; })[0];
    if (have) { have.qty += line.qty; return { ok: true, lines: out, merged: true }; }
    out.push({ sku: sku, desc: blank(line.desc) ? sku : String(line.desc).trim(), qty: line.qty, unitCostCents: line.unitCostCents });
    return { ok: true, lines: out, merged: false };
  }

  /* Credits the shop gets back (returned cabinets, damage claims). Older courtesy change orders kept one supplierCreditCents. */
  function creditsOf(co) {
    if (co.credits) return co.credits;
    return co.supplierCreditCents != null ? [{ amountCents: co.supplierCreditCents, for: 'returned', from: 'supplier' }] : [];
  }
  function claimPending(co) {
    return (co.replaced || []).some(function (r) { return r.claim && r.claim !== 'none'; }) && !creditsOf(co).some(function (c) { return c.for === 'damaged'; });
  }
  /*
   * What the shop absorbs on a change order (never shown to the customer):
   *   courtesy: what was paid for the added cabinets + replacements − credits back
   *   notice (no change to the contract): replacements − damage credits
   *   charge / agreed amount: replacements − damage credits, plus whatever the supplier kept on returned cabinets
   *     (the job cost already assumes a full credit; once the real credit is recorded the shortfall shows here)
   * estimate: true while a credit or claim is still open.
   */
  function absorbedFor(co) {
    var cr = creditsOf(co), amt = function (c) { return c.amountCents || 0; };
    var ret = sum(cr.filter(function (c) { return c.for === 'returned'; }).map(amt)), dmg = sum(cr.filter(function (c) { return c.for === 'damaged'; }).map(amt));
    var hasRet = cr.some(function (c) { return c.for === 'returned'; }), replaced = co.replacedCostCents || 0, removed = (co.removed || []).length > 0, pending = claimPending(co);
    if (co.kind === 'courtesy') {
      var spent = co.supplierPaidCents != null ? co.supplierPaidCents : (co.addedCostCents || 0);
      return { cents: spent + replaced - ret - dmg, estimate: (removed && !hasRet) || pending };
    }
    if (co.kind === 'notice') return { cents: replaced - dmg, estimate: pending };
    var short = hasRet && co.removedCostCents != null ? Math.max(0, co.removedCostCents - ret) : 0;
    return { cents: replaced - dmg + short, estimate: pending || (removed && !hasRet) };
  }
  var COUNTS = { courtesy: { approved: 1 }, notice: { recorded: 1 }, charge: { signed: 1, invoiced: 1, paid: 1 }, custom: { signed: 1, invoiced: 1, paid: 1 } };
  function counts(co) { return !!(COUNTS[co.kind] || {})[co.status]; }
  /* The job's absorbed total: every change order that has gone through (approved, recorded or signed). */
  function absorbedOnJob(changeOrders) { return sum((changeOrders || []).filter(counts).map(function (c) { return c.absorbedCents || 0; })); }

  /*
   * A change with no change to the contract: a damaged cabinet reordered at our cost, or a backorder the customer waits for.
   * input: { number, date, type, note, requestedBy, replaced: [{ sku, desc, qty, unitCostCents, claim, why }], newDeliveryDate, waitFor: [{ sku, qty }] }
   * Recorded right away (nothing for the customer to pay or sign); the buyer can be sent a notice to acknowledge.
   */
  function notice(input, opts) {
    input = input || {}; opts = opts || {};
    var P = [], replaced = cleanReplaced(input.replaced), wait = (input.waitFor || []).filter(function (w) { return w && w.qty > 0; });
    if (!TYPES[input.type]) P.push('Choose what happened.');
    if (blank(input.note)) P.push('Add a note for the paper trail.');
    if (!isISO(input.date)) P.push('Enter the change date.');
    if (blank(input.requestedBy)) P.push('Sign in so the change is recorded under your name.');
    if (!replaced.length && !wait.length && !input.newDeliveryDate) P.push('Add a replacement, the backordered cabinets, or a new delivery date.');
    if (wait.length && !isISO(input.newDeliveryDate)) P.push('Enter when the backordered cabinets are now expected.');
    if (input.newDeliveryDate && !isISO(input.newDeliveryDate)) P.push('Enter the new delivery date as a date.');
    replaced.forEach(function (l) {
      if (!(l.unitCostCents > 0)) P.push('Enter what the replacement ' + l.sku + ' costs us.');
      if (!CLAIMS[l.claim]) P.push('Say who the damage claim for ' + l.sku + ' goes to (or that we cover it).');
    });
    var co = { kind: 'notice', type: input.type, number: input.number, date: input.date, reason: input.type === 'backorder' && wait.length && !replaced.length ? CHANGE_REASONS.backorder_wait : CHANGE_REASONS[(TYPES[input.type] || {}).reason] || 'Other',
      note: input.note || '', added: [], removed: [], replaced: replaced, waitFor: wait, newDeliveryDate: input.newDeliveryDate || null,
      replacedCostCents: sum(replaced.map(function (l) { return (l.unitCostCents || 0) * l.qty; })), amountCents: 0, customerChangeCents: 0, contractDeltaCents: 0,
      requestedBy: input.requestedBy || '', status: 'recorded', buyerAck: 'none', credits: [] };
    var ab = absorbedFor(co); co.absorbedCents = ab.cents; co.absorbedIsEstimate = ab.estimate;
    return { ok: P.length === 0, problems: P, co: co,
      log: 'Change order ' + input.number + ' recorded (no change to the contract): ' + co.reason + '.' + (co.replacedCostCents ? ' Replacement cost ' + money(co.replacedCostCents) + (ab.estimate ? ', claim pending.' : ', absorbed by the shop.') : '') + (co.newDeliveryDate ? ' New delivery date ' + co.newDeliveryDate + '.' : '') };
  }

  /*
   * Record money the shop got back: a supplier credit or refund for returned cabinets, or a damage claim paid by the supplier
   * or freight carrier. input: { amountCents, on, reference, from: 'supplier'|'freight', for: 'returned'|'damaged', none } (none: they won't credit it)
   * Returns { ok, co, deltaCents (change in absorbed), log } or { ok:false, error }.
   */
  function recordCredit(co, input, opts) {
    input = input || {}; opts = opts || {};
    if (['returned', 'damaged'].indexOf(input.for) < 0) return { ok: false, error: 'Is this for returned cabinets or a damage claim?' };
    if (input.for === 'returned' && !(co.removed || []).length) return { ok: false, error: 'Nothing was removed on this change order.' };
    if (input.for === 'damaged' && !(co.replaced || []).length) return { ok: false, error: 'Nothing was replaced on this change order.' };
    var amount = input.none ? 0 : input.amountCents;
    if (!input.none && !(amount > 0)) return { ok: false, error: 'Enter the amount credited, or tick "they won\'t credit it".' };
    if (!isISO(input.on)) return { ok: false, error: 'Enter the date of the credit.' };
    if (opts.today && input.on > opts.today) return { ok: false, error: 'The credit date can\'t be in the future.' };
    if (blank(opts.by)) return { ok: false, error: 'Sign in first.' };
    var next = JSON.parse(JSON.stringify(co)), was = co.absorbedCents || 0;
    next.credits = creditsOf(co).map(function (c) { return JSON.parse(JSON.stringify(c)); }).concat([{ amountCents: amount, on: input.on, reference: input.reference || '', from: input.from === 'freight' ? 'freight' : 'supplier', for: input.for, none: !!input.none, by: opts.by }]);
    var rets = next.credits.filter(function (c) { return c.for === 'returned'; });
    if (rets.length) next.supplierCreditCents = sum(rets.map(function (c) { return c.amountCents; }));
    var ab = absorbedFor(next); next.absorbedCents = ab.cents; next.absorbedIsEstimate = ab.estimate;
    var who = input.from === 'freight' ? 'Freight carrier' : 'Supplier', what = input.for === 'returned' ? 'returned cabinets' : 'damage claim';
    return { ok: true, co: next, deltaCents: ab.cents - was,
      log: 'Change order ' + co.number + ': ' + (input.none ? who + ' won\'t credit the ' + what + '.' : who + ' credited ' + money(amount) + ' for the ' + what + (input.reference ? ' (' + input.reference + ')' : '') + '.') +
        ' Shop absorbs ' + money(ab.cents) + (ab.estimate ? ' so far' : '') + ' (was ' + money(was) + ').' };
  }

  /* Take back a change order that hasn't gone through (sent for signature, or waiting for approval). It stays on the list. */
  function withdraw(co, by, reason, on) {
    if (['sent', 'pending approval', 'draft'].indexOf(co.status) < 0) return { ok: false, error: 'Change order ' + co.number + ' is ' + co.status + '. Only one that hasn\'t gone through can be withdrawn; make a new change order to undo it.' };
    if (blank(reason)) return { ok: false, error: 'Say why it\'s withdrawn (for example: the buyer declined).' };
    if (blank(by)) return { ok: false, error: 'Sign in first.' };
    var next = JSON.parse(JSON.stringify(co)); next.status = 'withdrawn'; next.withdrawn = { by: by, on: on || null, reason: String(reason).trim() };
    return { ok: true, co: next, log: 'Change order ' + co.number + ' withdrawn by ' + by + ': ' + next.withdrawn.reason + '. Nothing billed; the contract is unchanged.' };
  }

  /* What the team is told on the Price step: a suggestion only (the person still chooses). */
  function suggest(type, diff, extras) {
    var t = TYPES[type]; if (!t) return null;
    var sells = (diff.added || []).length || (diff.removed || []).length || cleanExtras(extras).length;
    if (!sells && ((diff.replaced || []).length || type === 'backorder' || type === 'damage')) return { choice: 'nochange', text: 'Usually: no change to the contract. The customer gets what they bought; the cost is recorded.' };
    if (t.usually === 'courtesy') return { choice: 'courtesy', text: 'Usually a courtesy: the customer pays nothing more, and someone with full access approves what the shop absorbs.' };
    if (t.usually === 'charge') return { choice: 'charge', text: type === 'remove' ? 'Usually charged: the customer is credited what they paid for the cabinets that came off, less any fee.' : 'Usually charged at the change order\'s pricing.' };
    return null;
  }

  return { VERSION: VERSION, REASONS: REASONS, TYPES: TYPES, CLAIMS: CLAIMS, CHOICES: CHOICES, diffLines: diffLines, swapLine: swapLine, addLine: addLine,
           creditsOf: creditsOf, claimPending: claimPending, absorbedFor: absorbedFor, absorbedOnJob: absorbedOnJob, counts: counts, notice: notice,
           recordCredit: recordCredit, withdraw: withdraw, suggest: suggest, CHANGE_REASONS: CHANGE_REASONS, courtesy: courtesy, approve: approve, printed: printed,
           absorbedTotal: absorbedTotal, money: money, mergeLines: mergeLines, parseSkus: parseSkus, colorCheck: colorCheck, splitByColor: splitByColor,
           priceChange: priceChange, choosePrice: choosePrice, invoiceFor: invoiceFor, suffixOf: suffixOf };
}));
