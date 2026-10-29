/*
 * Fremont Makers · Project Builder · Phase 1 · customer documents you can open from a job
 * Version 1.0.0-phase1. Pure functions that return HTML strings; styled by fm-phase1-print.css
 * (one US-letter sheet per <article class="fm-p1-doc">). Every sheet starts with the logo
 * (FMQuote.logoHTML). Nothing internal (cost, markup, margin) is printed.
 *
 *   renderInvoiceDoc(job, inv, opts)     one invoice: amount, share of the current total, due, paid / check #
 *   renderScheduleDoc(job, opts)         payment schedule: every invoice with due date, status, amount
 *   renderBidQuoteDoc(priced, bid, meta) a bid-priced job's quote: quantities, no prices, one agreed price (§18)
 *   renderPacket(job, opts)              contract packet: summary, schedule, invoices, the quote pages, then any agreed elevations
 *   renderElevationDocs(job, pages, views, opts)  elevation sheets: one per wall (drawing + cabinet list), one 3D view per room
 *
 * `job` is a Phase 1 job (FMPhase1.normalizeLegacyProject). UMD: window.FMDocs in a browser.
 * See HANDOFF.md §21.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = isNode ? factory(require('./fm-phase1-ledger.js'), require('./fm-phase1-quote.js')) : factory(root.FMPhase1, root.FMQuote);
  if (isNode) module.exports = api; else root.FMDocs = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM, Q) {
  'use strict';
  var VERSION = '1.1.0';

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
    var rows = job.invoices.filter(function (i) { return i.status !== 'void'; }).map(function (inv) {
      var st = FM.invoiceState(inv, opts.today), pl = payLine(inv);
      return '<tr><td>' + esc(inv.label) + '</td><td>' + longDate(inv.dueDate) + '</td><td>' + (st.key === 'paid' ? 'Paid ' + pl : esc(st.label)) + '</td><td class="r">' + FM.fmt(inv.amountCents) + '</td></tr>';
    }).join('');
    var match = s.invoicesMatchContract ? '' : '<p class="doc-note missing">Invoices total ' + FM.fmt(s.invoicedCents) + '; the contract total is ' + FM.fmt(s.currentCents) + '.</p>';
    return sheet('Payment schedule',
      head('Payment schedule', titleFor(job), opts) +
      jobFields(job, field('Contract total', FM.fmt(s.currentCents)) + field('Paid to date', FM.fmt(s.paidCents)) + field('Balance', FM.fmt(s.balanceCents))) +
      '<table class="doc-lines"><thead><tr><th>Invoice</th><th>Due</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>' + rows +
      '<tr class="is-total"><td colspan="3">Total invoiced</td><td class="r">' + FM.fmt(s.invoicedCents) + '</td></tr></tbody></table>' + match +
      '<p class="doc-note">Goods do not leave Fremont Makers until paid in full. Assembly is included; installation into the building is not.</p>',
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
  function renderPacket(job, opts) {
    opts = opts || {};
    var s = FM.contractSummary(job), live = job.invoices.filter(function (i) { return i.status !== 'void'; });
    var cos = (job.changeOrders || []).map(function (c) {
      return '<tr><td>Change order ' + esc(c.number || '') + (c.kind === 'courtesy' ? ' · courtesy' : '') + '</td><td>' + longDate(c.date) + '</td><td class="r">' + FM.fmt(c.amountCents || 0) + '</td></tr>';
    }).join('');
    var summary = sheet('Contract summary',
      head('Contract packet' + (job.houses && job.houses.length > 1 ? ' · ' + job.houses.length + ' houses' : ''), titleFor(job), opts) +
      jobFields(job, field('Quote date', longDate(job.quoteDate)) + field('Install / delivery', longDate(job.deliveryDate)) + field('Houses', job.houses && job.houses.length ? String(job.houses.length) : '1')) +
      '<table class="doc-inv"><tbody>' +
        '<tr><td>Original contract total</td><td class="r">' + FM.fmt(s.originalCents) + '</td></tr>' +
        (s.changeOrderCount ? '<tr><td>Change orders (' + s.changeOrderCount + ')</td><td class="r">' + FM.fmt(s.changeOrderCents) + '</td></tr>' : '') +
        '<tr class="is-total"><td>Contract total</td><td class="r">' + FM.fmt(s.currentCents) + '</td></tr>' +
        '<tr><td>Paid to date</td><td class="r">' + FM.fmt(s.paidCents) + '</td></tr>' +
        '<tr><td>Balance</td><td class="r">' + FM.fmt(s.balanceCents) + '</td></tr></tbody></table>' +
      (cos ? '<table class="doc-lines"><thead><tr><th>Change order</th><th>Date</th><th class="r">This change</th></tr></thead><tbody>' + cos + '</tbody></table>' : '') +
      '<p class="doc-note">Seller is Fremont Makers LLC, a Colorado limited liability company. This packet holds the payment schedule, the invoices and the Final Job Quote' + (job.houses && job.houses.length > 1 ? 's' : '') + (opts.elevations ? ', followed by the agreed elevations' : '') + '. ' +
        (opts.agreementOnFile ? 'The signed Customer Sales Agreement is attached to this job; its terms are not reprinted here.' : '<span class="missing">The signed Customer Sales Agreement is not on file.</span>') + '</p>',
      'Contract summary');
    return summary + renderScheduleDoc(job, opts) +
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
    function foot() { k++; return 'Elevations · page ' + k + ' of ' + total; }
    return pages.map(function (p) {
      return sheet('Elevation · ' + p.room + ' · ' + p.wall,
        head('Elevation · ' + p.room, p.wall, opts) +
        jobFields(job, field('Drawing', esc(opts.status || 'Draft for the quote'))) +
        '<figure class="doc-elev">' + p.svg + '</figure>' +
        (p.rows.length ? '<table class="doc-lines"><thead><tr><th>#</th><th>SKU</th><th>Item</th><th class="r">Size (W × H × D)</th></tr></thead><tbody>' + p.rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.code || '—') + '</td><td>' + esc(r.label) + '</td><td class="r">' + esc(r.size) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
        ((p.issues || []).length ? '<p class="doc-note"><span class="missing">To resolve: ' + p.issues.map(esc).join(' · ') + '</span></p>' : '') +
        (p.note ? '<p class="doc-note">' + esc(p.note) + '</p>' : '') +
        '<p class="doc-note">Measurements are in inches; dimensions govern over the drawing. Field-verify walls, openings and ceiling height before ordering.</p>', foot());
    }).join('') + (views || []).map(function (v) {
      var plan = v.kind === 'plan', name = plan ? 'Floor plan' : '3D view';
      return sheet(name + ' · ' + v.room, head(name, v.room, opts) + jobFields(job, field('Drawing', esc(opts.status || 'Draft for the quote'))) +
        '<figure class="doc-elev doc-elev--3d">' + v.svg + '</figure><p class="doc-note">' + (plan ? 'Seen from above, in inches. Field-verify walls and openings before ordering.' : 'For look and layout only. Use the elevation pages for measurements.') + '</p>', foot());
    }).join('');
  }

  return { VERSION: VERSION, renderInvoiceDoc: renderInvoiceDoc, renderScheduleDoc: renderScheduleDoc, renderBidQuoteDoc: renderBidQuoteDoc, renderPacket: renderPacket, renderElevationDocs: renderElevationDocs };
}));
