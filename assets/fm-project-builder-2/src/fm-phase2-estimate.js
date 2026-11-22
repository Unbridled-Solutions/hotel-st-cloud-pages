/*
 * Fremont Makers · Project Builder · Phase 2 · The estimate, step by step, and its approval (FMEstimate)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMEstimate in a browser.
 *
 * Owner, Nov 19 (from TJ's Log & Timber): one estimate flow with Next and Back and the running total on top:
 *   1 Cabinets → 2 Assembly and delivery → 3 Extras and discounts → 4 Review and approve.
 * Review is for the team only: cost, markup, price and margin on every line, the lines adding up to the total to the cent,
 * lines under the minimum margin, lines with no cost, and the elevations against the quote. "Approve this estimate" records
 * who and when; the contract uses the approved estimate and asks again if it changes. Design-first projects need the
 * customer's design approval before they're priced. HANDOFF §37.
 * Pricing stays per job (never per customer): markup, manufacturer discount, G&A, tax and assembly come from job.pricing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.FMQuote);
  else root.FMEstimate = factory(root.FMQuote);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Q) {
  'use strict';
  var VERSION = '1.0.0';
  var STEPS = ['Cabinets', 'Assembly and delivery', 'Extras and discounts', 'Review and approve'];
  var SETTINGS = { minMarginPct: 20 };   // a line priced under this margin (after the manufacturer discount) is flagged
  var EXTRA_KINDS = { product: 'Product (taxed)', labor: 'Labor or install (not taxed)', discount: 'Discount or sale', other: 'Other, not taxed' };

  function cents(n) { return Math.round(n); }
  function money(c) { var n = Math.abs(c); return (c < 0 ? '−' : '') + '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2); }
  function blank(s) { return s == null || String(s).trim() === ''; }

  function laborOf(pr) {
    if (pr.assemblyHours != null) return pr.assemblyHours && pr.assemblyRateCents ? [{ role: 'Assembly', rateCents: pr.assemblyRateCents, hours: pr.assemblyHours }] : [];
    return pr.assemblyCents ? [{ role: 'Assembly', rateCents: pr.assemblyCents, hours: 1 }] : [];
  }
  function priceModel(job, m) {
    var pr = job.pricing || {};
    return Q.priceHouse({ lines: (m.lines || []).map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct, noCharge: l.noCharge }; }),
      discountPctOfCost: pr.discountPctOfCost || 0, labor: laborOf(pr), gaPct: pr.gaPct || 0, taxPct: pr.taxPct || 0 });
  }

  /* Extras and discounts on the whole job (hardware, crown, freight, install, a sale). Product extras carry sales tax. */
  function extras(job) {
    var pr = job.pricing || {}, list = (job.extras || []).filter(function (x) { return !blank(x.label) && x.amountCents; });
    var rows = list.map(function (x) {
      var kind = EXTRA_KINDS[x.kind] ? x.kind : (x.amountCents < 0 ? 'discount' : 'product');
      var amt = kind === 'discount' ? -Math.abs(x.amountCents) : x.amountCents;
      var taxable = kind === 'product' || (kind === 'discount' && x.taxable !== false);
      return { label: x.label, kind: kind, amountCents: amt, taxable: taxable, taxCents: taxable ? cents(amt * (pr.taxPct || 0) / 100) : 0, costCents: x.costCents || 0 };
    });
    return { rows: rows, amountCents: rows.reduce(function (t, r) { return t + r.amountCents; }, 0), taxCents: rows.reduce(function (t, r) { return t + r.taxCents; }, 0), costCents: rows.reduce(function (t, r) { return t + r.costCents; }, 0) };
  }

  /* Totals for the running bar and the contract: each model × homes, plus extras; or the agreed bid. */
  function totals(job) {
    var models = (job.models || []).map(function (m, i) {
      var p = (m.lines || []).length ? priceModel(job, m) : null, n = m.qty || 1;
      return { name: m.name || 'Model ' + (i + 1), homes: n, lines: (m.lines || []).length, ok: !!(p && p.ok), error: p && !p.ok ? p.error : null, priced: p && p.ok ? p : null,
               eachCents: p && p.ok ? p.summary.totalCents : 0, totalCents: p && p.ok ? p.summary.totalCents * n : 0, taxCents: p && p.ok ? p.summary.taxCents * n : 0,
               costCents: p && p.ok ? (p.internal.costCents - p.summary.discountCents) * n : 0 };
    });
    var ex = extras(job), itemized = models.reduce(function (t, m) { return t + m.totalCents; }, 0) + ex.amountCents + ex.taxCents;
    var total = job.bid && job.bid.bidCents ? job.bid.bidCents : itemized;
    return { models: models, extras: ex, itemizedCents: itemized, totalCents: total, bid: !!(job.bid && job.bid.bidCents),
             taxCents: models.reduce(function (t, m) { return t + m.taxCents; }, 0) + ex.taxCents,
             costCents: models.reduce(function (t, m) { return t + m.costCents; }, 0) + ex.costCents,
             lineCount: models.reduce(function (t, m) { return t + m.lines; }, 0) };
  }

  /*
   * The team-only review. rec: what's on the elevations vs. the quote ({ rows: [{ sku, quoted, placed }] }, from the elevations tab).
   * Returns { lines (per model, with cost/price/margin), flags[], adds (lines add up to the total), ok }.
   */
  function review(job, rec, opts) {
    opts = opts || {};
    var min = opts.minMarginPct != null ? opts.minMarginPct : SETTINGS.minMarginPct, t = totals(job), flags = [], disc = (job.pricing && job.pricing.discountPctOfCost) || 0;
    var lines = [];
    t.models.forEach(function (m, mi) {
      if (m.error) flags.push({ level: 'error', text: m.name + ': ' + m.error });
      if (!m.priced) return;
      m.priced.lines.forEach(function (l, li) {
        var off = cents(l.costCents * disc / 100), net = l.costCents - off, price = l.noCharge ? 0 : l.totalCents - off, margin = price > 0 ? (price - net) / price * 100 : null;   // the discount comes off both our cost and the customer's price
        var row = { model: m.name, modelIndex: mi, index: li, sku: l.sku, desc: l.description, qty: l.qty, costCents: l.costCents, netCostCents: net, markupPct: l.markupPct, priceCents: price, marginPct: margin, noCharge: l.noCharge, atCost: l.atCost };
        if (!(l.unitCostCents > 0) && !l.noCharge) flags.push({ level: 'error', model: mi, line: li, text: l.sku + ' has no cost. Enter the supplier\'s price.' });
        else if (l.atCost) flags.push({ level: 'warn', model: mi, line: li, text: l.sku + ' is at cost (0% markup). Fine for parts sold at cost; check it\'s meant.' });
        else if (margin != null && margin < min - 1e-9) flags.push({ level: 'warn', model: mi, line: li, text: l.sku + ' makes ' + margin.toFixed(1) + '%, under the ' + min + '% minimum.' });
        lines.push(row);
      });
      var sum = m.priced.lines.reduce(function (s, l) { return s + (l.noCharge ? 0 : l.totalCents); }, 0);
      if (sum !== m.priced.summary.cabinetsCents) flags.push({ level: 'error', text: m.name + ': the lines add up to ' + money(sum) + ' but the cabinets total is ' + money(m.priced.summary.cabinetsCents) + '.' });
    });
    if (!t.lineCount) flags.push({ level: 'error', text: 'There are no cabinets on the estimate yet.' });
    (rec && rec.rows || []).forEach(function (r) {
      if (r.placed > r.quoted) flags.push({ level: 'warn', kind: 'elev', sku: r.sku, text: r.sku + ': ' + r.placed + ' on the elevations, ' + r.quoted + ' on the estimate.', fix: { add: r.placed - r.quoted } });
      else if (r.quoted > r.placed && r.placed >= 0 && rec.drawn) flags.push({ level: 'tip', kind: 'elev', sku: r.sku, text: r.sku + ': ' + r.quoted + ' on the estimate, ' + r.placed + ' on the elevations. Draw it, or check it belongs.' });
    });
    if (t.bid) flags.push({ level: 'tip', text: 'This job is priced by bid: the contract shows ' + money(t.totalCents) + '; the itemized estimate is ' + money(t.itemizedCents) + '.' });
    var price = t.totalCents, margin = price > 0 ? (price - t.taxCents - t.costCents) / (price - t.taxCents) * 100 : null;
    return { totals: t, lines: lines, flags: flags, errors: flags.filter(function (f) { return f.level === 'error'; }).length, marginPct: margin, ok: !flags.some(function (f) { return f.level === 'error'; }) };
  }

  /* What the approval covers: the lines, the job's pricing settings, extras, the bid. Any change after approval shows. */
  function fingerprint(job) {
    var pr = job.pricing || {};
    return JSON.stringify({
      m: (job.models || []).map(function (m) { return [m.name, m.qty || 1, (m.lines || []).map(function (l) { return [l.sku, l.qty, l.unitCostCents, l.markupPct, !!l.noCharge]; })]; }),
      p: [pr.markupPct, pr.discountPctOfCost, pr.gaPct, pr.taxPct, pr.assemblyHours, pr.assemblyRateCents, pr.assemblyCents, (pr.plan || []).join('/')],
      x: (job.extras || []).map(function (x) { return [x.label, x.kind, x.amountCents]; }), b: job.bid ? job.bid.bidCents : null
    });
  }
  function status(job) {
    var a = job.estimateApproval;
    if (!a) return { key: 'none', label: 'Not approved yet' };
    if (a.fingerprint !== fingerprint(job)) return { key: 'changed', label: 'Changed since ' + a.by + ' approved it', approval: a };
    return { key: 'approved', label: 'Approved by ' + a.by, approval: a };
  }
  /* Approve (anyone signed in can approve an estimate they've reviewed; errors block it). */
  function approve(job, user, at, rec) {
    if (!user || blank(user.name)) return { ok: false, error: 'Sign in first.' };
    var r = review(job, rec);
    if (!r.ok) return { ok: false, error: 'Fix the ' + r.errors + ' problem' + (r.errors > 1 ? 's' : '') + ' in Review first.' };
    var a = { by: user.name, at: at || null, totalCents: r.totals.totalCents, taxCents: r.totals.taxCents, marginPct: r.marginPct == null ? null : Math.round(r.marginPct * 10) / 10, fingerprint: fingerprint(job), warnings: r.flags.filter(function (f) { return f.level === 'warn'; }).length };
    return { ok: true, approval: a, log: 'Estimate approved by ' + user.name + ' at ' + money(a.totalCents) + (a.marginPct != null ? ' (' + a.marginPct + '% margin)' : '') + (a.warnings ? ', with ' + a.warnings + ' warning' + (a.warnings > 1 ? 's' : '') + ' reviewed' : '') + '.' };
  }

  /* Design-first projects (started from a design or a sketch) get the customer's design approval before a price. */
  function needsDesignApproval(job) { return !!job.designFirst && !job.designApproval && !(job.designApprovalSkipped); }
  var APPROVAL_HOW = { signed: 'Signed the design (e-sign)', inPerson: 'Approved in person', email: 'Approved by email or text' };
  function approveDesign(job, input, user, at) {
    input = input || {};
    if (!user || blank(user.name)) return { ok: false, error: 'Sign in first.' };
    if (!APPROVAL_HOW[input.how]) return { ok: false, error: 'Say how the customer approved it.' };
    if (!(input.version > 0)) return { ok: false, error: 'Save the design as a version first, so it\'s clear which one they approved.' };
    if (input.how !== 'signed' && blank(input.note)) return { ok: false, error: 'Add a note: who approved it and when (for example "Dana, at the showroom, Nov 19").' };
    return { ok: true, approval: { version: input.version, how: input.how, note: blank(input.note) ? '' : String(input.note).trim(), by: user.name, at: at || null, requestId: input.requestId || null },
             log: 'Customer approved design version ' + input.version + ' (' + APPROVAL_HOW[input.how].toLowerCase() + (blank(input.note) ? '' : ': ' + String(input.note).trim()) + '). Recorded by ' + user.name + '. Ready to price.' };
  }

  return { VERSION: VERSION, STEPS: STEPS, SETTINGS: SETTINGS, EXTRA_KINDS: EXTRA_KINDS, APPROVAL_HOW: APPROVAL_HOW, money: money,
           priceModel: priceModel, extras: extras, totals: totals, review: review, fingerprint: fingerprint, status: status, approve: approve,
           needsDesignApproval: needsDesignApproval, approveDesign: approveDesign };
}));
