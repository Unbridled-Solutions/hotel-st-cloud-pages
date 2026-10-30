/*
 * Fremont Makers · Project Builder · Phase 1 · customer documents you can open from a job
 * Version 1.0.0-phase1. Pure functions that return HTML strings; styled by fm-phase1-print.css
 * (one US-letter sheet per <article class="fm-p1-doc">). Every sheet starts with the logo
 * (FMQuote.logoHTML). Nothing internal (cost, markup, margin) is printed.
 *
 *   renderInvoiceDoc(job, inv, opts)     one invoice: amount, share of the current total, due, paid / check #
 *   renderScheduleDoc(job, opts)         payment schedule: every invoice with due date, status, amount
 *   renderBidQuoteDoc(priced, bid, meta) a bid-priced job's quote: quantities, no prices, one agreed price (§18)
 *   renderPacket(job, opts)              contract packet: builder order, Customer Sales Agreement, schedule, invoices, quote pages, elevations
 *   renderAgreementDoc(job, opts)        the Customer Sales Agreement (wording in FMAgreement), with signature blocks
 *   renderBuilderOrderDoc(job, opts)     a builder order's models and houses
 *   renderChangeOrderDoc(job, co, opts)  a charged change order for the buyer to sign: lines, pricing, signatures
 *   renderElevationDocs(job, pages, views, opts)  elevation sheets: one per wall (drawing + cabinet list), one 3D view per room
 *
 * `job` is a Phase 1 job (FMPhase1.normalizeLegacyProject). UMD: window.FMDocs in a browser.
 * See HANDOFF.md §21.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = isNode ? factory(require('./fm-phase1-ledger.js'), require('./fm-phase1-quote.js'), require('./fm-phase2-agreement.js')) : factory(root.FMPhase1, root.FMQuote, root.FMAgreement);
  if (isNode) module.exports = api; else root.FMDocs = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM, Q, AG) {
  'use strict';
  var VERSION = '1.3.0';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function longDate(iso) {
    if (!iso) return '—';
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], p = String(iso).split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function field(k, v) { return '<div><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function head(kicker, title, opts) {
    return '<header class="doc-head">' + Q.logoHTML(opts || {}) +
      '<div class="doc-title' + (String(title).length > 28 ? ' doc-title--long' : '') + '"><div class="doc-kicker">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1></div></header>';
  }
  /* Builder orders list their houses under Project, so the page title is the customer. */
  function titleFor(job) {
    return (job.houses && job.houses.length > 1) ? job.customer : (job.projectName || job.customer);
  }
  function jobFields(job, extra) {
    var signer = job.contacts && job.contacts.signer && job.contacts.signer !== job.customer ? '<span class="sub">Signer: ' + esc(job.contacts.signer) + '</span>' : '';
    return '<section class="doc-fields">' +
      field('Buyer', esc(job.customer) + signer) + field('Job', esc(job.jobCode)) + field('Project', esc(job.projectName || '—')) +
      (extra || '') + '</section>';
  }
  function sheet(label, inner, foot) {
    return '<article class="fm-p1-doc doc-sheet" aria-label="' + esc(label) + '">' + inner +
      '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · 719 Main Street, Cañon City, CO 81212</span><span class="pg">' + esc(foot || '') + '</span></footer></article>';
  }
  function paidCents(inv) { return FM.invoicePaidCents(inv); }
  function payLine(inv) {
    var p = (inv.payments || [])[0];
    if (!p) return null;
    return longDate(p.date) + (p.reference ? ' · Check ' + esc(p.reference) : ' · <span class="missing">no check number recorded</span>');
  }

  /* One invoice. opts: { today, logoBase, index, count } */
  function renderInvoiceDoc(job, inv, opts) {
    opts = opts || {};
    var s = FM.contractSummary(job), share = FM.invoicePercent(inv, job), paid = paidCents(inv);
    var due = Math.max(0, inv.amountCents - paid), isPaid = paid >= inv.amountCents && inv.amountCents > 0;
    var isCO = inv.role === 'change_order';
    var rows = [
      ['Contract total' + (s.changeOrderCents ? ' (including change orders)' : ''), FM.fmt(s.currentCents)],
      [esc(inv.label) + (isCO ? '' : ' <span class="sub-inline">' + share.actual.toFixed(2) + '% of the contract total</span>'), FM.fmt(inv.amountCents)],
      ['Due', longDate(inv.dueDate)]
    ];
    var pl = payLine(inv);
    if (pl) rows.push(['Paid', pl + (paid < inv.amountCents ? ' · ' + FM.fmt(paid) : '')]);
    var table = '<table class="doc-inv"><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="r">' + r[1] + '</td></tr>'; }).join('') +
      '<tr class="is-total"><td>Amount due this invoice</td><td class="r">' + FM.fmt(due) + '</td></tr></tbody></table>';
    var notes = [];
    if (inv.role === 'deposit') notes.push('The factory order is placed once this invoice is paid in full.');
    if (isCO) notes.push('Billed separately for a change order. The original invoices are unchanged.');
    notes.push('Please make payment to Fremont Makers LLC. Job ' + esc(job.jobCode) + '.');
    var title = String(inv.label).split('·')[0].trim() || 'Invoice';
    return sheet(inv.label,
      head('Invoice', title, opts) + (isPaid ? '<div class="doc-stamp" aria-label="Paid">Paid</div>' : '') +
      jobFields(job, field('Install / delivery', longDate(job.deliveryDate)) + field('Invoice', esc(inv.label)) + field('Due', longDate(inv.dueDate))) +
      table + '<div class="doc-notes">' + notes.map(function (n) { return '<p class="doc-note">' + n + '</p>'; }).join('') + '</div>',
      opts.count ? 'Invoice ' + (opts.index + 1) + ' of ' + opts.count : '');
  }

  /* Payment schedule. opts: { today, logoBase } */
  function renderScheduleDoc(job, opts) {
    opts = opts || {};
    var s = FM.contractSummary(job);
    var live = job.invoices.filter(function (i) { return i.status !== 'void'; }), main = live.filter(function (i) { return i.role !== 'change_order' && !i.changeOrderId; });
    var rows = live.map(function (inv) {
      var st = FM.invoiceState(inv, opts.today), pl = payLine(inv), k = main.indexOf(inv);
      var what = inv.role === 'change_order' || inv.changeOrderId ? 'Billed on its own for a change order, due on signing.' : k === 0 && main.length > 1 ? 'Factory order is not placed until this invoice is paid in full.' :
        k === main.length - 1 && main.length > 1 ? 'Due at pickup or delivery.' : main.length === 1 ? 'Paid in full before the factory order is placed.' : 'Progress payment as the order proceeds.';
      return '<tr><td>' + esc(inv.label) + '<span class="sub-inline">' + what + '</span></td><td>' + longDate(inv.dueDate) + '</td><td>' + (st.key === 'paid' ? 'Paid ' + pl : esc(st.label)) + '</td><td class="r">' + FM.fmt(inv.amountCents) + '</td></tr>';
    }).join('');
    var match = s.invoicesMatchContract ? '' : '<p class="doc-note missing">Invoices total ' + FM.fmt(s.invoicedCents) + '; the contract total is ' + FM.fmt(s.currentCents) + '.</p>';
    return sheet('Payment schedule',
      head('Payment schedule', titleFor(job), opts) +
      jobFields(job, field('Contract total', FM.fmt(s.currentCents)) + field('Paid to date', FM.fmt(s.paidCents)) + field('Balance', FM.fmt(s.balanceCents)) +
        (job.scheduleRevisions && job.scheduleRevisions.length ? field('Schedule', 'Revised ' + longDate(job.scheduleRevisions[job.scheduleRevisions.length - 1].on)) : '')) +
      '<table class="doc-lines"><thead><tr><th>Invoice</th><th>Due</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>' + rows +
      '<tr class="is-total"><td colspan="3">Total invoiced</td><td class="r">' + FM.fmt(s.invoicedCents) + '</td></tr></tbody></table>' + match +
      '<p class="doc-note">Goods do not leave Fremont Makers until paid in full. ' + (opts.assembly === false ? 'Assembly is not included. Install into the building is not included.' : 'Assembly is included. Install into the building is not.') + '</p>',
      'Payment schedule');
  }

  /* A job priced by bid: quantities only, one agreed price (owner decision, HANDOFF.md §18). */
  function renderBidQuoteDoc(priced, bidCents, meta) {
    meta = meta || {};
    var rows = priced.lines.map(function (l) { return '<tr><td>' + esc(l.description) + '</td><td class="sku">' + esc(l.sku) + '</td><td class="r">' + l.qty + '</td></tr>'; }).join('');
    return sheet('Final Job Quote ' + (meta.house || ''),
      head('Final Job Quote · agreed bid', meta.house || '', meta) +
      '<section class="doc-fields">' + field('Buyer', esc(meta.buyer)) + field('Job', esc(meta.jobCode)) + field('Quote date', longDate(meta.quoteDate)) +
        field('Install / delivery', longDate(meta.deliveryDate)) + field('Color', esc(meta.color || '—')) + '</section>' +
      '<table class="doc-lines"><thead><tr><th>Description</th><th>SKU</th><th class="r">Qty</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="doc-bottom"><table class="doc-sum"><tbody><tr class="is-total"><td>Agreed bid price</td><td class="r">' + FM.fmt(bidCents) + '</td></tr></tbody></table>' +
      '<p class="doc-note">Includes the cabinets and hardware listed, assembly, and Colorado sales tax. Installation into the building is not included.</p></div>',
      meta.pageLabel || '');
  }

  /*
   * Contract packet: summary page, payment schedule, every invoice, then the quote pages.
   * opts: { today, logoBase, quotes: [html sheet, …] (from FMQuote.renderHouseQuoteDoc or renderBidQuoteDoc),
   *         agreementOnFile: true when the signed agreement is attached to the job }
   */
  /*
   * Customer Sales Agreement (FMAgreement holds the wording). opts: { logoBase, stages, bid, assembly, elevations, dates, fmSignerName }
   */
  function renderAgreementDoc(job, opts) {
    opts = opts || {};
    if (!AG) return '';
    var s = FM.contractSummary(job), signer = job.contacts && job.contacts.signer ? job.contacts.signer : job.customer;
    var stages = opts.stages && opts.stages.length ? opts.stages : job.invoices.filter(function (i) { return i.status !== 'void' && i.role !== 'change_order' && !i.changeOrderId; })
      .map(function (i) { var m = String(i.label).match(/(\d+(?:\.\d+)?)%/); return { name: 'Payment', pct: m ? +m[1] : Math.round(i.amountCents / Math.max(1, s.originalCents) * 100) }; });   // no plan on file: the shares the invoices name
    var secs = AG.sections(job, { stages: stages, totalCents: s.originalCents, bid: !!opts.bid, assembly: opts.assembly, elevations: opts.elevations || 'none', dates: opts.dates || [], fmt: FM.fmt });
    var body = secs.map(function (x) { return '<section class="doc-sec"><h2>' + esc(x.title) + '</h2>' + x.paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</section>'; }).join('');
    var sign = '<section class="doc-sign"><div><span>Buyer signature</span><span>Printed name · ' + esc(signer) + '</span><span>Date</span></div>' +
      '<div><span>Fremont Makers LLC · signature</span><span>Printed name' + (opts.fmSignerName ? ' · ' + esc(opts.fmSignerName) : '') + '</span><span>Date</span></div></section>';
    return sheet('Customer Sales Agreement',
      head('Customer Sales Agreement', 'Fremont Makers', opts) +
      jobFields(job, field('Quote date', longDate(job.quoteDate)) + field('Install / delivery', longDate(job.deliveryDate)) + field('Contract total', FM.fmt(s.originalCents)) +
        (job.installAddress ? field('Site', esc(job.installAddress)) : '')) +
      body + '<p class="doc-law">' + esc(AG.LAW) + ' ' + esc(AG.ESIGN) + '</p>' +
      (opts.signedAgreementFile ? '<p class="doc-note">The signed copy of this agreement is on file: ' + esc(opts.signedAgreementFile) + '.</p>' : '') + sign,
      'Customer Sales Agreement');
  }

  /* Builder orders: the models and houses on the order, before the agreement (as in the Willow Creek packet). opts.models: [{ name, houses, cents }] */
  function renderBuilderOrderDoc(job, opts) {
    opts = opts || {};
    var hs = job.houses || [], models = opts.models || [];
    if (hs.length < 2) return '';
    var mrows = models.map(function (m) { return '<tr><td>' + esc(m.name) + '</td><td class="r">' + m.houses + '</td><td class="r">' + FM.fmt(m.cents) + '</td></tr>'; }).join('');
    var hrows = hs.map(function (h) { return '<tr><td>' + esc(h.name) + '</td><td>' + esc(h.jobCode) + '</td><td>' + esc(h.address || '—') + '</td><td>' + esc(h.color || '') + '</td><td class="r">' + FM.fmt(h.totalCents || 0) + '</td></tr>'; }).join('');
    var total = FM.contractSummary(job).originalCents;
    return sheet('Builder order',
      head('Builder order', titleFor(job), opts) +
      jobFields(job, field('Quote date', longDate(job.quoteDate)) + field('Install / delivery', longDate(job.deliveryDate)) + field('Contract total', FM.fmt(total))) +
      (mrows ? '<h2 class="doc-h2">Models on this order</h2><table class="doc-lines"><thead><tr><th>Model</th><th class="r">Houses</th><th class="r">Amount</th></tr></thead><tbody>' + mrows +
        '<tr class="is-total"><td colspan="2">Order total</td><td class="r">' + FM.fmt(total) + '</td></tr></tbody></table>' : '') +
      '<h2 class="doc-h2">Houses</h2><table class="doc-lines"><thead><tr><th>House</th><th>Job</th><th>Address</th><th>Color</th><th class="r">Amount</th></tr></thead><tbody>' + hrows + '</tbody></table>',
      'Builder order');
  }

  /*
   * Contract packet, in the order of the signed packets: builder order (builder orders only), Customer Sales Agreement,
   * payment schedule, invoices, Final Job Quotes, then elevations.
   * opts: { today, logoBase, quotes: [html], elevations: html, elevationsFlag, stages, bid, assembly, dates, fmSignerName, models, signedAgreementFile }
   */
  function renderPacket(job, opts) {
    opts = opts || {};
    var live = job.invoices.filter(function (i) { return i.status !== 'void'; });
    var elev = !opts.elevations ? 'none' : opts.elevationsFlag ? 'preliminary' : 'agreed';
    var agreement = renderAgreementDoc(job, Object.assign({}, opts, { elevations: elev }));
    var flag = opts.elevationsFlag ? '<p class="doc-flag">' + esc(opts.elevationsFlag) + '</p>' : '';
    return renderBuilderOrderDoc(job, opts) + agreement.replace('<section class="doc-sign">', flag + '<section class="doc-sign">') + renderScheduleDoc(job, opts) +
      live.map(function (inv, i) { return renderInvoiceDoc(job, inv, { today: opts.today, logoBase: opts.logoBase, index: i, count: live.length }); }).join('') +
      (opts.quotes || []).join('') + (opts.elevations || '');
  }

  /*
   * Elevation sheets. pages: [{ room, wall, svg, rows: [{ code, label, size }], issues: [text] }]; views: [{ kind: 'plan' | '3d', room, svg }].
   * opts.status: shown under the title, e.g. 'Agreed with the contract · Oct 28, 2026' or 'Draft for the quote'.
   */
  function renderElevationDocs(job, pages, views, opts) {
    opts = opts || {};
    var total = pages.length + (views || []).length, k = 0;
    var flag = opts.flag ? '<p class="doc-flag">' + esc(opts.flag) + '</p>' : '';   // incomplete drawings sent on purpose
    function foot() { k++; return 'Elevations · page ' + k + ' of ' + total; }
    return pages.map(function (p) {
      return sheet('Elevation · ' + p.room + ' · ' + p.wall,
        head('Elevation · ' + p.room, p.wall, opts) +
        jobFields(job, field('Drawing', esc(opts.status || 'Draft for the quote'))) + flag +
        '<figure class="doc-elev">' + p.svg + '</figure>' +
        (p.rows.length ? '<table class="doc-lines"><thead><tr><th>#</th><th>SKU</th><th>Item</th><th class="r">Size (W × H × D)</th></tr></thead><tbody>' + p.rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.code || '—') + '</td><td>' + esc(r.label) + '</td><td class="r">' + esc(r.size) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
        ((p.issues || []).length ? '<p class="doc-note"><span class="missing">To resolve: ' + p.issues.map(esc).join(' · ') + '</span></p>' : '') +
        (p.note ? '<p class="doc-note">' + esc(p.note) + '</p>' : '') +
        '<p class="doc-note">Measurements are in inches; dimensions govern over the drawing. Field-verify walls, openings and ceiling height before ordering.</p>', foot());
    }).join('') + (views || []).map(function (v) {
      var plan = v.kind === 'plan', name = plan ? 'Floor plan' : '3D view';
      return sheet(name + ' · ' + v.room, head(name, v.room, opts) + jobFields(job, field('Drawing', esc(opts.status || 'Draft for the quote'))) + flag +
        '<figure class="doc-elev doc-elev--3d">' + v.svg + '</figure><p class="doc-note">' + (plan ? 'Seen from above, in inches. Field-verify walls and openings before ordering.' : 'For look and layout only. Use the elevation pages for measurements.') + '</p>', foot());
    }).join('');
  }

  /*
   * A charged change order, for the buyer to sign (modeled on Willow Creek's executed Change Order 1).
   * co: { number, date, reason, note, amountCents, pricing: { discountPctOfCost, gaPct, taxPct }, priced: { lines, summary }, due }
   *   priced.lines: [{ sku, desc, qty (negative = removed), unitCents, totalCents }]; nothing internal (cost, markup) is printed.
   * opts: { logoBase, previousCents (contract total before this change), signedOn }
   */
  function renderChangeOrderDoc(job, co, opts) {
    opts = opts || {};
    var pr = co.priced || { lines: [], summary: null }, sm = pr.summary, P = co.pricing || {};
    var before = opts.previousCents != null ? opts.previousCents : FM.contractSummary(job).originalCents;
    function pct(n) { return String(Math.round(n * 100) / 100); }
    var lines = (pr.lines || []).map(function (l) {
      return '<tr><td>' + esc(l.desc || l.sku) + (l.removed || l.qty < 0 ? ' <span class="sub-inline">removed</span>' : '') + '</td><td>' + esc(l.sku) + '</td><td class="r">' + (l.qty < 0 ? '−' + (-l.qty) : l.qty) + '</td><td class="r">' + FM.fmt(l.unitCents) + '</td><td class="r">' + FM.fmt(l.totalCents) + '</td></tr>';
    }).join('');
    var rows = sm ? [['Cabinets', sm.cabinetsCents], sm.discountCents ? ['Mfr. bulk discount (' + pct(P.discountPctOfCost) + '%)', sm.discountCents] : null, sm.laborCents ? ['Assembly labor', sm.laborCents] : null,
      sm.gaCents ? ['G&amp;A (' + pct(P.gaPct) + '%)', sm.gaCents] : null, sm.taxCents ? ['Tax (' + pct(P.taxPct) + '% on product)', sm.taxCents] : null].filter(Boolean) : [];
    var sum = '<table class="doc-inv"><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="r">' + FM.fmt(r[1]) + '</td></tr>'; }).join('') +
      '<tr class="is-total"><td>This change · Change Order ' + esc(co.number) + '</td><td class="r">' + FM.fmt(co.amountCents) + '</td></tr>' +
      '<tr><td>Contract total before this change</td><td class="r">' + FM.fmt(before) + '</td></tr>' +
      '<tr><td>Contract total with this change</td><td class="r">' + FM.fmt(before + co.amountCents) + '</td></tr>' +
      '<tr><td>Due</td><td class="r">' + (co.due ? longDate(co.due) : 'On signing') + '</td></tr></tbody></table>';
    var sign = '<section class="doc-sign"><div><span>Buyer signature</span><span>Printed name · ' + esc(job.customer) + '</span><span>Date</span></div>' +
      '<div><span>Fremont Makers LLC · signature</span><span>Printed name</span><span>Date</span></div></section>';
    return sheet('Change order ' + co.number,
      head('Change order', 'Change Order ' + co.number, opts) +
      jobFields(job, field('Install / delivery', longDate(job.deliveryDate)) + field('Change date', longDate(co.date)) + field('Reason', esc(co.reason || '—') + (co.note ? '<span class="sub">' + esc(co.note) + '</span>' : ''))) +
      (lines ? '<table class="doc-lines"><thead><tr><th>Description</th><th>SKU</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead><tbody>' + lines + '</tbody></table>' : '') + sum +
      '<div class="doc-notes"><p class="doc-note">The original contracted total of ' + FM.fmt(FM.contractSummary(job).originalCents) + ' stays. This change order is billed on its own invoice' + (co.due ? '' : ', due on signing') + '; it does not replace the original payment schedule. All other terms of the Customer Sales Agreement are unchanged.</p>' +
      '<p class="doc-note">Please make payment to Fremont Makers LLC. Job ' + esc(job.jobCode) + ' · Change order ' + esc(co.number) + '.</p>' + (opts.printedNote ? '<p class="doc-note">' + esc(opts.printedNote) + '</p>' : '') + '</div>' + sign,
      'Change order ' + co.number);
  }

  return { VERSION: VERSION, renderAgreementDoc: renderAgreementDoc, renderBuilderOrderDoc: renderBuilderOrderDoc, renderChangeOrderDoc: renderChangeOrderDoc, renderInvoiceDoc: renderInvoiceDoc, renderScheduleDoc: renderScheduleDoc, renderBidQuoteDoc: renderBidQuoteDoc, renderPacket: renderPacket, renderElevationDocs: renderElevationDocs };
}));
