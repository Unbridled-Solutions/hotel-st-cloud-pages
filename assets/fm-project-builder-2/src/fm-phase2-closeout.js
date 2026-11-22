/*
 * Fremont Makers · Project Builder · Phase 2 · Job costs, the order board, close-out and sales tax (FMCloseout)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMCloseout in a browser.
 *
 * Owner, Nov 19 (group 3, cabinet versions of TJ's ideas). HANDOFF §42.
 *   1. Supplier invoices → real job cost: a Wholesale Cabinets invoice or order PDF is read (FMSupplierPdf) into cost lines;
 *      gross profit uses what was actually paid instead of the quote's estimate.
 *   2. Order board: jobs move Contract signed → Deposit paid → Factory ordered → Delivered → Final payment → Complete, one
 *      step at a time through the same checks as the job page (FMPhase1.applyAction).
 *   3. Close-out: a final billing check (paid in full, no change order left unsigned, costs logged, final margin against the
 *      estimate), a printable handoff packet, the review and referrals.
 *   4. Sales tax from the site address: the rate with its parts (state, county, city, district) and the date it was checked, or
 *      a typed rate with a reason. Signed jobs keep the tax they were signed with.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.FMPhase1);
  else root.FMCloseout = factory(root.FMPhase1);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';
  var VERSION = '1.1.0';
  function blank(s) { return s == null || String(s).trim() === ''; }
  function money(c) { var n = Math.abs(c); return (c < 0 ? '−' : '') + '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2); }

  /* ---------- 1. job costs from supplier invoices ---------- */
  var COST_KINDS = { cabinets: 'Cabinets and parts', moldings: 'Moldings, trim and fillers', hardware: 'Hardware', freight: 'Freight and shipping', labor: 'Labor or install', other: 'Other' };
  function guessKind(label) {
    var t = String(label || '').toLowerCase();
    if (/shipping|freight|delivery|fuel/.test(t)) return 'freight';
    if (/molding|moulding|trim|filler|scribe|crown|toe ?kick|panel/.test(t)) return 'moldings';
    if (/pull|knob|hinge|hardware|slide/.test(t)) return 'hardware';
    if (/labor|install|assembly/.test(t)) return 'labor';
    return 'cabinets';
  }
  /*
   * A cost entry from a read supplier PDF. res: FMSupplierPdf.parse(...). meta: { file, sha256, by, today, vendor }
   * The cost is what was paid: the items less the supplier's discount, plus tax and shipping (the PDF's Total).
   */
  function fromSupplier(res, meta) {
    meta = meta || {}; var P = [];
    if (!res || (!(res.items || []).length && !(res.fees || []).length)) P.push('No lines were read from this invoice. Enter them by hand.');
    if (blank(meta.by)) P.push('Sign in first.');
    var lines = (res && res.items || []).map(function (x) { return { label: x.isSku ? x.sku + (x.desc ? ' · ' + x.desc : '') : x.name + (x.desc ? ' · ' + x.desc : ''), qty: x.qty, amountCents: x.subtotalCents, kind: guessKind(x.isSku ? '' : x.name) }; })
      .concat((res && res.fees || []).map(function (f) { return { label: f.label, qty: f.qty, amountCents: f.amountCents, kind: 'freight' }; }));
    var T = (res && res.totals) || {}, sum = lines.reduce(function (t, l) { return t + l.amountCents; }, 0);
    var total = T.total != null ? T.total : sum - (T.discount || 0) + (T.tax || 0) + (T.shipping || 0);
    if (T.subtotal != null && Math.abs(sum - T.subtotal) > 2) P.push('The lines add up to ' + money(sum) + ' but the invoice\'s subtotal is ' + money(T.subtotal) + '. Check them before adding.');
    return { ok: !P.filter(function (p) { return /Sign in|No lines/.test(p); }).length, problems: P, entry: {
      vendor: meta.vendor || 'Wholesale Cabinets', orderNumber: res && res.orderNumber || null, date: res && res.orderDate || meta.today || null, file: meta.file || null, sha256: meta.sha256 || null,
      lines: lines, subtotalCents: T.subtotal != null ? T.subtotal : sum, discountCents: T.discount || 0, taxCents: T.tax || 0, shippingCents: T.shipping || 0, totalCents: total, by: meta.by || null, on: meta.today || null } };
  }
  /* A cost typed by hand (an invoice that couldn't be read, a local purchase). */
  function manual(input, meta) {
    input = input || {}; meta = meta || {}; var P = [];
    if (blank(input.vendor)) P.push('Who was it from?');
    if (!(input.amountCents > 0)) P.push('Enter the amount paid.');
    if (!COST_KINDS[input.kind]) P.push('Pick what it was for.');
    if (P.length) return { ok: false, problems: P };
    return { ok: true, problems: [], entry: { vendor: String(input.vendor).trim(), orderNumber: input.reference || null, date: input.date || meta.today || null, file: null, lines: [{ label: input.note || COST_KINDS[input.kind], qty: 1, amountCents: input.amountCents, kind: input.kind }],
      subtotalCents: input.amountCents, discountCents: 0, taxCents: 0, shippingCents: 0, totalCents: input.amountCents, by: meta.by || null, on: meta.today || null } };
  }
  /* The job's costs: what the quote estimated, what was actually paid, by kind. */
  function costs(job) {
    var list = (job.jobCosts || []).filter(function (e) { return !e.removed; }), byKind = {};
    list.forEach(function (e) {
      var sum = e.lines.reduce(function (t, l) { return t + l.amountCents; }, 0) || 1;
      e.lines.forEach(function (l) { var share = Math.round(e.totalCents * l.amountCents / sum); byKind[l.kind] = (byKind[l.kind] || 0) + share; });
    });
    var actual = list.reduce(function (t, e) { return t + e.totalCents; }, 0);
    return { entries: list, actualCents: list.length ? actual : null, quotedCents: job.costCents == null ? null : job.costCents, byKind: byKind, count: list.length };
  }
  /* Final margin against the estimate: price before tax, cost quoted vs. actual. */
  /* opts.mfrDiscountCents: the manufacturer's discount the shop gets when it orders (Company books takes it off the quoted
     cost the same way), so the quoted cost compares with what was actually paid. */
  function margin(job, opts) {
    var s = FM ? FM.contractSummary(job) : { currentCents: job.originalContractCents || 0 }, price = s.currentCents - (job.taxCents || 0), c = costs(job), d = (opts && opts.mfrDiscountCents) || 0;
    var quoted = c.quotedCents == null ? null : c.quotedCents - d;
    function m(cost) { return cost == null || price <= 0 ? null : Math.round((price - cost) / price * 1000) / 10; }
    return { priceCents: price, quotedCostCents: quoted, quotedListCents: c.quotedCents, mfrDiscountCents: d, actualCostCents: c.actualCents, quotedPct: m(quoted), actualPct: m(c.actualCents), diffCents: c.actualCents == null || quoted == null ? null : c.actualCents - quoted };
  }

  /* ---------- 2. the order board ---------- */
  var BOARD = ['contract_signed', 'deposit_paid', 'factory_ordered', 'delivered', 'final_paid', 'complete'];
  var BOARD_LABEL = { contract_signed: 'Contract signed', deposit_paid: 'Deposit paid', factory_ordered: 'Factory ordered', delivered: 'Delivered', final_paid: 'Final payment', complete: 'Complete' };
  /* Move a job toward a later column, one step at a time with the job page's own checks. Returns { ok, job, steps[], error } */
  /*
   * Where to fix what stops a move (owner, Nov 19: a blocked drag should take you to the fix): { tab, label, invoiceId? }.
   * The deposit and the final payment are recorded on the Invoices tab; invoiceId opens that invoice's payment form.
   */
  function fixFor(job, act) {
    var open = (job.invoices || []).filter(function (i) { return i.status !== 'void' && i.amountCents > 0 && FM.invoicePaidCents(i) < i.amountCents; });
    if (act && act.id === 'deposit') { var dep = (job.invoices || []).filter(function (i) { return i.role === 'deposit'; })[0]; return { tab: 'invoices', label: 'Record the deposit payment', invoiceId: dep ? dep.id : null }; }
    if (act && act.id === 'final') return { tab: 'invoices', label: open.length > 1 ? 'Record the payments (' + open.length + ' invoices open)' : 'Record the final payment', invoiceId: open[0] ? open[0].id : null };
    return { tab: 'overview', label: 'Open the job' };
  }
  /* What stops this job moving to the next column, before anyone drags it: { reason, fix } or null. */
  function blocker(job) {
    var i = BOARD.indexOf(job.stage); if (i < 0 || i === BOARD.length - 1) return null;
    var act = FM.availableActions(job).filter(function (a) { return a.to === BOARD[i + 1]; })[0];
    return act && act.blockedReason ? { reason: act.blockedReason, fix: fixFor(job, act) } : null;
  }
  function moveTo(job, target, date, who) {
    var from = BOARD.indexOf(job.stage), to = BOARD.indexOf(target);
    if (from < 0 || to < 0) return { ok: false, error: 'Only signed jobs are on the board.' };
    if (to < from) return { ok: false, error: 'Jobs only move forward on the board. To go back, open the job and use Void contract, with a reason.', fix: { tab: 'overview', label: 'Open the job' } };
    if (to === from) return { ok: false, error: 'It\'s already ' + BOARD_LABEL[target] + '.' };
    if (blank(date)) return { ok: false, error: 'Enter the date.' };
    var cur = job, steps = [], SH = typeof FMShipping !== 'undefined' ? FMShipping : null;
    if (target === 'complete' && SH && SH.closeBlocker(job)) return { ok: false, error: SH.closeBlocker(job), fix: { tab: 'shipping', label: 'Open the claim' } };
    while (BOARD.indexOf(cur.stage) < to) {
      var act = FM.availableActions(cur).filter(function (a) { return a.to === BOARD[BOARD.indexOf(cur.stage) + 1]; })[0];
      if (!act) return { ok: false, error: 'There\'s no step from ' + BOARD_LABEL[cur.stage] + '.', job: cur, steps: steps };
      var r = FM.applyAction(cur, act.id, { date: date }, who);
      if (!r.ok) return { ok: steps.length > 0, partial: steps.length > 0, error: BOARD_LABEL[cur.stage] + ' → ' + BOARD_LABEL[act.to] + ': ' + r.error, job: cur, steps: steps, fix: fixFor(cur, act), stoppedAt: cur.stage };
      steps.push(act.label + ' (' + date + ')'); cur = r.job;
    }
    return { ok: true, job: cur, steps: steps };
  }
  function board(jobs) {
    var cols = BOARD.map(function (k) { return { key: k, label: BOARD_LABEL[k], jobs: [] }; });
    (jobs || []).forEach(function (j) { var i = BOARD.indexOf(j.stage); if (i >= 0 && !j.testVoid && !j.designTemplate) cols[i].jobs.push(j); });
    return cols;
  }

  /* ---------- 3. close-out ---------- */
  function check(job, opts) {
    var s = FM.contractSummary(job), c = costs(job), mg = margin(job, opts), items = [];
    items.push({ key: 'paid', ok: s.balanceCents <= 0, text: s.balanceCents <= 0 ? 'Paid in full (' + money(s.paidCents) + ')' : money(s.balanceCents) + ' still open' });
    var open = (job.invoices || []).filter(function (i) { return i.status !== 'void' && FM.invoicePaidCents(i) < i.amountCents; });
    items.push({ key: 'invoices', ok: !open.length, text: open.length ? open.length + ' invoice' + (open.length > 1 ? 's' : '') + ' not paid: ' + open.map(function (i) { return i.number || i.label; }).join(', ') : 'Every invoice is paid' });
    var unsigned = (job.changeOrders || []).filter(function (co) { return co.status === 'sent' || co.status === 'pending approval'; });
    items.push({ key: 'changes', ok: !unsigned.length, text: unsigned.length ? 'Change order ' + unsigned.map(function (co) { return co.number; }).join(', ') + ' not signed or approved' : 'No change order left open' });
    var SH = typeof FMShipping !== 'undefined' ? FMShipping : null, cb = SH ? SH.closeBlocker(job) : null;   // supplier claims (HANDOFF §45)
    if (SH && (job.claims || []).length) items.push({ key: 'claims', ok: !cb, text: cb || 'Every supplier claim is closed' });
    items.push({ key: 'costs', ok: c.count > 0, text: c.count ? c.count + ' supplier invoice' + (c.count > 1 ? 's' : '') + ' logged, ' + money(c.actualCents) + ' actual cost' : 'No supplier invoices logged yet (gross profit uses the quoted cost)' });
    items.push({ key: 'margin', ok: true, info: true, text: mg.actualPct != null ? 'Final margin ' + mg.actualPct + '% (estimate ' + (mg.quotedPct == null ? '—' : mg.quotedPct + '%') + (mg.diffCents ? '; cost ' + (mg.diffCents > 0 ? money(mg.diffCents) + ' over' : money(-mg.diffCents) + ' under') + ' the estimate' : '') + ')' : 'Margin on the estimate: ' + (mg.quotedPct == null ? '—' : mg.quotedPct + '%') });
    var blockers = items.filter(function (i) { return !i.ok && i.key !== 'costs'; });
    return { items: items, ready: !blockers.length, blockers: blockers, margin: mg };
  }
  /* The review the team asked for, and referrals (each can start a new project credited to this customer). */
  function logReview(input, by, today) {
    input = input || {};
    if (blank(input.askedOn)) return { ok: false, error: 'Enter when you asked for the review.' };
    return { ok: true, review: { askedOn: input.askedOn, where: input.where || '', link: blank(input.link) ? '' : String(input.link).trim(), said: blank(input.said) ? '' : String(input.said).trim(), photosOk: !!input.photosOk, by: by, on: today || null } };
  }
  function addReferral(input, by, today, fromJob) {
    input = input || {};
    if (blank(input.name)) return { ok: false, error: 'Enter the referral\'s name.' };
    if (blank(input.phone) && blank(input.email)) return { ok: false, error: 'Add a phone number or an email so the team can reach them.' };
    return { ok: true, referral: { name: String(input.name).trim(), phone: blank(input.phone) ? '' : String(input.phone).trim(), email: blank(input.email) ? '' : String(input.email).trim(), note: blank(input.note) ? '' : String(input.note).trim(), by: by, on: today || null, from: fromJob || null } };
  }
  var CARE = [
    ['Cleaning', 'Wipe with a soft cloth dampened with water and a little mild dish soap, then dry right away. Don\'t use abrasive pads, ammonia, bleach or oil soaps; they dull and damage the finish.'],
    ['Water and steam', 'Wipe up spills and drips at once, especially around the sink, dishwasher and range. Let the dishwasher\'s steam out before opening the cabinet above it.'],
    ['Heat and light', 'Keep toasters, slow cookers and coffee makers out from under wall cabinets while they\'re on. Strong sunlight can change the color of wood finishes over time.'],
    ['Doors and drawers', 'Hinges can be adjusted with a screwdriver if a door sags or doesn\'t line up. Don\'t hang on doors or overload drawers and shelves.'],
    ['Humidity', 'Wood moves with the seasons. Keep the home between 35% and 55% humidity where you can; small gaps at door panels in winter are normal.']
  ];
  function warrantyEnd(job) {
    /* the signed warranty runs one year from purchase: the contract date; delivery only when no contract date is on file */
    var d = job.contractedOn || ((job.history || []).filter(function (h) { return h.to === 'contract_signed'; })[0] || {}).date || job.deliveredOn || ((job.history || []).filter(function (h) { return h.to === 'delivered'; })[0] || {}).date; if (!d) return null;
    var p = String(d).split('-'); return (+p[0] + 1) + '-' + p[1] + '-' + p[2];
  }

  /* ---------- 4. sales tax from the site address ---------- */
  /*
   * A looked-up rate: { ratePct, parts: [{ name, pct }], source: 'address', address, checkedOn }; a typed one: { ratePct, source: 'typed', reason }.
   * The parts must add up to the rate. Signed jobs keep the rate they were signed with (frozen).
   */
  function checkRate(rate, job) {
    var P = [];
    if (job && job.stage !== 'quote') P.push('This job is signed; it keeps the tax it was signed with. A change goes through a change order.');
    if (!rate || !(rate.ratePct >= 0) || rate.ratePct > 15) P.push('Enter a rate between 0% and 15%.');
    else if (rate.source === 'address') {
      var sum = Math.round((rate.parts || []).reduce(function (t, p) { return t + (+p.pct || 0); }, 0) * 1000) / 1000;
      if (!(rate.parts || []).length) P.push('The lookup didn\'t return the rate\'s parts.');
      else if (Math.abs(sum - rate.ratePct) > 0.0005) P.push('The parts add up to ' + sum + '%, not ' + rate.ratePct + '%.');
      if (blank(rate.checkedOn)) P.push('The date it was checked is missing.');
    } else if (rate.source === 'typed') { if (blank(rate.reason)) P.push('Say why the rate is different (tax-exempt buyer, out-of-state delivery, a quote without tax…).'); }
    else P.push('Say where the rate came from.');
    return P;
  }
  /* What's taxed on this job, line by line, as the estimate prices it today: tax on the product only (owner's rule). */
  function whatsTaxed(job) {
    var pr = job.pricing || {}, out = [];
    out.push({ what: 'Cabinets and parts (after the manufacturer discount)', taxed: true });
    if (pr.assemblyHours || pr.assemblyCents) out.push({ what: 'Assembly labor', taxed: false, note: 'owner\'s decision, Nov 19' });
    if (pr.gaPct) out.push({ what: 'G&A', taxed: false });
    (job.extras || []).forEach(function (x) { out.push({ what: x.label || 'Extra', taxed: x.kind === 'product' || (x.kind === 'discount' && x.taxable !== false), note: x.kind === 'discount' ? 'a discount lowers the taxed amount' : '' }); });
    return out;
  }

  return { VERSION: VERSION, COST_KINDS: COST_KINDS, guessKind: guessKind, fromSupplier: fromSupplier, manual: manual, costs: costs, margin: margin,
           BOARD: BOARD, BOARD_LABEL: BOARD_LABEL, moveTo: moveTo, board: board,
           check: check, blocker: blocker, fixFor: fixFor, logReview: logReview, addReferral: addReferral, CARE: CARE, warrantyEnd: warrantyEnd,
           checkRate: checkRate, whatsTaxed: whatsTaxed, money: money };
}));
