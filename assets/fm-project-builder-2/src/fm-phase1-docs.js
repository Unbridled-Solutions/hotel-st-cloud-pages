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
 *   renderChangeOrderDoc(job, co, opts)  a change order for the buyer to sign: charged, credit, courtesy or no change to the contract
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
  var VERSION = '1.5.0';

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
  /* The look of the original Fremont Makers change order (owner, Nov 20): the logo centered, a spaced kicker, a big serif
     title, two columns of details, totals at the right. Used by invoices and change orders. */
  function headCenter(kicker, title, opts) {
    return '<header class="doc-head doc-head--center">' + Q.logoHTML(opts || {}) +
      '<div class="doc-kicker">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1></header>';
  }
  function fields2(job, extra) {
    var signer = job.contacts && job.contacts.signer && job.contacts.signer !== job.customer ? '<span class="sub">Signer: ' + esc(job.contacts.signer) + '</span>' : '';
    return '<section class="doc-fields doc-fields--2">' + field('Buyer', esc(job.customer) + signer) + field('Project', esc(job.projectName || '—')) + field('Job', esc(job.jobCode)) + (extra || '') + '</section>';
  }
  /*
   * Cabinet lines, grouped by color: a heading with the color chip and name, then each line as its code and what it is
   * ("W3042-SBW  Wall cabinet 30″ wide, 42″ tall"), so the description no longer repeats the SKU. rows: [{ sku, desc, qty, unitCents,
   * totalCents, tag }] (unitCents/totalCents may be null; tag is a small note like "removed").
   */
  /* Plain names for the usual molding and trim codes (OCM8 = outside corner molding, 8 ft). */
  var TRIM = [[/^(OCM)/, 'Outside corner molding'], [/^(ICM)/, 'Inside corner molding'], [/^(SM|SCR)/, 'Scribe molding'], [/^(LACM|ACM|CM|SCM|RCM|BCM)/, 'Crown molding'], [/^(COV)/, 'Cove molding'],
    [/^(LRM|LR)/, 'Light rail molding'], [/^(QR)/, 'Quarter round'], [/^(TKC|TK)/, 'Toe kick'], [/^(BM)/, 'Batten molding'], [/^(DWP|DWR)/, 'Dishwasher return panel'], [/^(SP)/, 'Skin panel'], [/^(KNOB|PULL)/, 'Hardware']];
  function trimName(code) {
    var c = String(code || '').toUpperCase();
    for (var i = 0; i < TRIM.length; i++) if (TRIM[i][0].test(c)) { var ft = c.replace(TRIM[i][0], '').match(/^(\d{1,2})(?!\d)/); return TRIM[i][1] + (ft ? ', ' + ft[1] + ' ft' : ''); }
    return '';
  }
  function linesGrouped(rows, cols) {
    var EL = typeof FMElev !== 'undefined' ? FMElev : null, CL = typeof FMColors !== 'undefined' ? FMColors : null, groups = [], by = {};
    rows.forEach(function (r) {
      var sp = EL ? EL.splitSku(r.sku) : { code: r.sku, color: '' }, key = sp.color || '';
      if (!by[key]) { by[key] = { key: key, rows: [], name: '' }; groups.push(by[key]); }
      var g = by[key], code = sp.code || r.sku || '';
      if (!g.name && r.desc && code && r.desc.indexOf(code) > 0) g.name = r.desc.slice(0, r.desc.indexOf(code)).trim();
      var what = '';
      if (EL && code) { var spec = EL.parseSku(r.sku); what = spec && spec.kind !== 'unknown' ? EL.describe(spec) : ''; }
      if (!what || /^Trim or accessory/.test(what)) what = trimName(code) || what;
      if (!what) what = String(r.desc || '').replace(code, '').replace(g.name, '').trim() || r.desc || '';
      g.rows.push({ code: r.sku || code || r.desc, what: what, r: r });   // the full SKU, as ordered from the supplier
    });
    var n = cols === 'qty' ? 2 : 4;
    return '<table class="doc-lines doc-lines--grouped"><thead><tr><th>Item</th><th class="r">Qty</th>' + (cols === 'qty' ? '' : '<th class="r">Unit</th><th class="r">Total</th>') + '</tr></thead><tbody>' +
      groups.map(function (g) {
        var hex = g.key && CL ? CL.hex(g.key) : null, name = g.name || (g.key && CL ? CL.name(g.key) : '') || (g.key ? g.key : '');
        return (name || g.key ? '<tr class="doc-group"><td colspan="' + n + '">' + (hex ? '<i class="doc-chip" style="background:' + hex + '"></i>' : '') + esc(name) + (g.key ? ' <span class="doc-ccode">' + esc(g.key) + '</span>' : '') + '</td></tr>' : '') +
          g.rows.map(function (x) {
            var r = x.r;
            return '<tr><td><span class="doc-code">' + esc(x.code) + '</span>' + (x.what && x.what !== x.code ? '<span class="doc-what">' + esc(x.what) + '</span>' : '') + (r.tag ? ' <span class="sub-inline">' + r.tag + '</span>' : '') + '</td>' +
              '<td class="r">' + r.qtyText + '</td>' + (cols === 'qty' ? '' : '<td class="r">' + (r.unitCents != null ? FM.fmt(r.unitCents) : '') + '</td><td class="r">' + (r.totalText != null ? r.totalText : r.totalCents != null ? FM.fmt(r.totalCents) : '') + '</td>') + '</tr>';
          }).join('');
      }).join('') + '</tbody></table>';
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
      headCenter('Invoice' + (inv.number ? ' ' + inv.number : ''), title, opts) + (isPaid ? '<div class="doc-stamp" aria-label="Paid">Paid</div>' : '') +
      fields2(job, field('Install / delivery', longDate(job.deliveryDate)) + field('Due', longDate(inv.dueDate))) +
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
  /* The four sections the buyer initials (owner, Nov 19: payment, measurements and elevations, delivery and inspection, warranty) */
  var INITIALS = ['payment', 'elevations', 'delivery', 'warranty'];
  /* Exhibit A: the Final Job Quote, the elevation sheets, and any supporting documents ticked on the contract (HANDOFF §38) */
  function exhibitList(job, opts) {
    var terms = job.contractTerms, out = [];
    if (!terms || terms.exhibitOff) return out;   // only contracts built with the contract builder list Exhibit A
    out.push('the Final Job Quote' + ((job.models || []).length > 1 ? 's' : ''));
    if (opts.elevations && opts.elevations !== 'none') out.push('the ' + (opts.elevations === 'preliminary' ? 'preliminary ' : '') + 'elevation drawings');
    (job.documents || []).filter(function (d) { return terms.exhibitDocs && terms.exhibitDocs[d.id || d.file] && !d.removed; }).forEach(function (d) { out.push('Addendum: ' + (d.title || d.file)); });
    return out.length > 1 || (job.documents || []).some(function (d) { return terms.exhibitDocs && terms.exhibitDocs[d.id || d.file]; }) ? out : [];
  }
  function renderAgreementDoc(job, opts) {
    opts = opts || {};
    if (!AG) return '';
    var s = FM.contractSummary(job), signer = job.contacts && job.contacts.signer ? job.contacts.signer : job.customer;
    var stages = opts.stages && opts.stages.length ? opts.stages : job.invoices.filter(function (i) { return i.status !== 'void' && i.role !== 'change_order' && !i.changeOrderId; })
      .map(function (i) { var m = String(i.label).match(/(\d+(?:\.\d+)?)%/); return { name: 'Payment', pct: m ? +m[1] : Math.round(i.amountCents / Math.max(1, s.originalCents) * 100) }; });   // no plan on file: the shares the invoices name
    var secs = AG.sections(job, { stages: stages, totalCents: s.originalCents, bid: !!opts.bid, assembly: opts.assembly, elevations: opts.elevations || 'none', dates: opts.dates || [], fmt: FM.fmt });
    // Sections the buyer initials when signing in the tool (HANDOFF §38): a box at the end of each, filled in on the signed copy.
    var signedBefore = job.stage !== 'quote' && !(job.esign && job.esign.provider === 'fm');   // contracts signed elsewhere reprint exactly as signed
    var initialKeys = opts.initials === false || signedBefore ? [] : (opts.initials || INITIALS);
    var terms = job.contractTerms || {};
    if ((terms.special || []).filter(function (t) { return String(t || '').trim(); }).length) secs = secs.concat([{ key: 'special', title: 'Special conditions', paras: terms.special.filter(function (t) { return String(t || '').trim(); }) }]);
    var ex = exhibitList(job, opts);
    if (ex.length) secs = secs.concat([{ key: 'exhibit', title: 'Exhibit A: attached and part of this Agreement', paras: [ex.map(function (x, i) { return (i ? 'A-' + i + ' ' : '') + x; }).join('; ') + '.'] }]);
    var body = secs.map(function (x) {
      var ini = initialKeys.indexOf(x.key) >= 0;
      return '<section class="doc-sec' + (ini ? ' doc-sec--initial' : '') + '"' + (ini ? ' data-initial-sec="' + x.key + '"' : '') + '><h2>' + esc(x.title) + '</h2>' + x.paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        (ini ? '<div class="doc-initial" data-initial="' + x.key + '"><span>Buyer initials</span><b></b></div>' : '') + '</section>';
    }).join('');
    var sign = '<section class="doc-sign"><div data-signer="buyer"><span class="doc-sigline" data-sig="buyer">Buyer signature</span><span>Printed name · ' + esc(signer) + '</span><span data-sigdate="buyer">Date</span></div>' +
      '<div data-signer="fremont"><span class="doc-sigline" data-sig="fremont">Fremont Makers LLC · signature</span><span>Printed name' + (opts.fmSignerName ? ' · ' + esc(opts.fmSignerName) : '') + '</span><span data-sigdate="fremont">Date</span></div></section>';
    return sheet('Customer Sales Agreement',
      head('Customer Sales Agreement', 'Fremont Makers', opts) +
      jobFields(job, field('Quote date', longDate(job.quoteDate)) + field('Install / delivery', longDate(job.deliveryDate)) + field('Contract total', FM.fmt(s.originalCents)) +
        (job.installAddress ? field('Site', esc(job.installAddress)) : '')) +
      body + '<p class="doc-law">' + esc(AG.LAW) + ' ' + esc(job.stage !== 'quote' && !(job.esign && (job.esign.provider === 'fm' || job.esign.provider === 'outside')) && AG.ESIGN_SIGNED ? AG.ESIGN_SIGNED : AG.ESIGN) + '</p>' +
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
      var plan = v.kind === 'plan', name = plan ? 'Layout' : '3D view';
      return sheet(name + ' · ' + v.room, head(name, v.room, opts) + jobFields(job, field('Drawing', esc(opts.status || 'Draft for the quote'))) + flag +
        '<figure class="doc-elev doc-elev--3d">' + v.svg + '</figure><p class="doc-note">' + (plan ? 'Seen from above, in inches. Field-verify walls and openings before ordering.' : 'For look and layout only. Use the elevation pages for measurements.') + '</p>', foot());
    }).join('');
  }

  /*
   * A change order for the buyer to sign (modeled on Willow Creek's executed Change Order 1 and Penrose's courtesy Change Order 1).
   * co: { number, date, reason, note, kind ('charge'|'custom'|'courtesy'|'notice'), amountCents, pricing, priced: { lines, summary }, due,
   *       added, removed (courtesy: [{ sku, desc, qty, from?, to? }]), replaced: [{ sku, desc, qty, why }], waitFor: [{ sku, desc, qty }], newDeliveryDate }
   *   priced.lines: [{ sku, desc, qty (negative = removed), unitCents, totalCents, extra? }]. Nothing internal (cost, markup, claims) is printed.
   * opts: { logoBase, previousCents (contract total before this change), signedOn, printedNote }
   */
  function renderChangeOrderDoc(job, co, opts) {
    opts = opts || {};
    var pr = co.priced || { lines: [], summary: null }, sm = pr.summary, P = co.pricing || {}, free = co.kind === 'courtesy' || co.kind === 'notice';
    var before = opts.previousCents != null ? opts.previousCents : FM.contractSummary(job).originalCents, amt = free ? 0 : (co.amountCents || 0);
    function pct(n) { return String(Math.round(n * 100) / 100); }
    function qtyMove(l, sign) { return l.from != null && l.to != null ? l.from + ' → ' + l.to : (sign < 0 ? '−' : '+') + l.qty; }
    var rows = [];
    if (!free && pr.lines && pr.lines.length) pr.lines.forEach(function (l) {
      rows.push({ sku: l.sku || '', desc: l.desc || l.sku, qtyText: l.qty < 0 ? '−' + (-l.qty) : String(l.qty), unitCents: l.unitCents, totalCents: l.totalCents, tag: l.removed || (l.qty < 0 && !l.extra) ? 'removed' : '' });
    });
    else {
      (co.added || []).forEach(function (l) { rows.push({ sku: l.sku, desc: l.desc || l.sku, qtyText: qtyMove(l, 1), unitCents: null, totalText: free ? 'No charge' : '', tag: 'added' }); });
      (co.removed || []).forEach(function (l) { rows.push({ sku: l.sku, desc: l.desc || l.sku, qtyText: l.from != null && l.to != null ? l.from + ' → ' + l.to : l.qty + ' → 0', unitCents: null, totalText: '', tag: l.to ? 'changed' : 'removed' }); });
    }
    (co.replaced || []).forEach(function (l) { rows.push({ sku: l.sku, desc: l.desc || l.sku, qtyText: String(l.qty), unitCents: null, totalText: 'No charge', tag: 'replaced' + (l.why ? ': ' + esc(l.why) : '') }); });
    (co.waitFor || []).forEach(function (l) { rows.push({ sku: l.sku, desc: l.desc || l.sku, qtyText: String(l.qty), unitCents: null, totalText: 'Now expected ' + esc(longDate(co.newDeliveryDate)), tag: 'backordered' }); });
    var money = !free && sm ? [['Cabinets', sm.cabinetsCents], sm.discountCents ? ['Mfr. bulk discount (' + pct(P.discountPctOfCost) + '%)', sm.discountCents] : null, sm.laborCents ? ['Assembly labor', sm.laborCents] : null,
      sm.otherCents ? ['Other charges and credits', sm.otherCents] : null, sm.gaCents ? ['G&amp;A (' + pct(P.gaPct) + '%)', sm.gaCents] : null, sm.taxCents ? ['Tax (' + pct(P.taxPct) + '% on product)', sm.taxCents] : null].filter(function (r) { return r && (r[1] || r[0] === 'Cabinets'); }) : [];
    var credit = amt < 0;
    var sum = '<table class="doc-inv doc-inv--right"><tbody>' + money.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="r">' + FM.fmt(r[1]) + '</td></tr>'; }).join('') +
      '<tr class="' + (amt > 0 ? 'is-sub' : 'is-total') + '"><td>This change · Change Order ' + esc(co.number) + (free ? (co.kind === 'courtesy' ? ' · courtesy' : ' · no change to the contract') : credit ? ' · credit' : '') + '</td><td class="r">' + FM.fmt(amt) + '</td></tr>' +
      '<tr><td>Contract total before this change</td><td class="r">' + FM.fmt(before) + '</td></tr>' +
      '<tr><td>Contract total with this change</td><td class="r">' + FM.fmt(before + amt) + '</td></tr>' +
      (amt > 0 ? '<tr><td>Due</td><td class="r">' + (co.due ? longDate(co.due) : 'On signing') + '</td></tr><tr class="is-total"><td>Amount due this invoice</td><td class="r">' + FM.fmt(amt) + '</td></tr>' : '') + '</tbody></table>';
    var lead = co.kind === 'courtesy' ? '<p class="doc-lead"><b>Courtesy: this change is $0.</b> Your contract total stays ' + FM.fmt(before) + '. The cabinets below are substitutions or extras at no additional charge.</p>'
      : co.kind === 'notice' ? '<p class="doc-lead"><b>No change to your contract.</b> Your contract total stays ' + FM.fmt(before) + '.' + ((co.replaced || []).length ? ' Replacement cabinets are at no charge to you.' : '') + (co.newDeliveryDate ? ' Delivery is now expected ' + longDate(co.newDeliveryDate) + '.' : '') + '</p>' : '';
    var notes = free ? '<p class="doc-note">All terms of the Customer Sales Agreement are unchanged. The buyer\'s signature acknowledges the change; nothing is due.</p>'
      : '<p class="doc-note">The original contracted total of ' + FM.fmt(FM.contractSummary(job).originalCents) + ' stays. ' + (credit ? 'This credit is applied to the next unpaid invoice, or refunded if none is left.' : 'This change order is billed on its own invoice' + (co.due ? '' : ', due on signing') + '; it does not replace the original payment schedule.') + ' All other terms of the Customer Sales Agreement are unchanged.</p>' +
        (credit ? '' : '<p class="doc-note">Please make payment to Fremont Makers LLC. Job ' + esc(job.jobCode) + ' · Change order ' + esc(co.number) + '.</p>');
    var sign = '<section class="doc-sign"><div><span>Buyer signature</span><span>Printed name · ' + esc(job.customer) + '</span><span>Date</span></div>' +
      '<div><span>Fremont Makers LLC · signature</span><span>Printed name</span><span>Date</span></div></section>';
    return sheet('Change order ' + co.number,
      headCenter(amt > 0 ? 'Change order ' + co.number + ' invoice' : 'Change order', amt > 0 ? 'Change Order ' + co.number + ' Invoice' : 'Change Order ' + co.number, opts) +
      fields2(job, field('Install / delivery', co.newDeliveryDate ? longDate(co.newDeliveryDate) + '<span class="sub">was ' + longDate(job.deliveryDate) + '</span>' : longDate(job.deliveryDate)) + field('Change date', longDate(co.date)) + (opts.appliesTo ? field('Applies to', esc(opts.appliesTo)) : '') + field('Reason', esc(co.reason || '—') + (co.note ? '<span class="sub">' + esc(co.note) + '</span>' : ''))) +
      lead + (rows.length ? linesGrouped(rows) : '') + sum +
      '<div class="doc-notes">' + notes + (opts.printedNote ? '<p class="doc-note">' + esc(opts.printedNote) + '</p>' : '') + '</div>' + sign,
      'Change order ' + co.number);
  }

  return { VERSION: VERSION, INITIALS: INITIALS, exhibitList: exhibitList, renderAgreementDoc: renderAgreementDoc, renderBuilderOrderDoc: renderBuilderOrderDoc, renderChangeOrderDoc: renderChangeOrderDoc, renderInvoiceDoc: renderInvoiceDoc, renderScheduleDoc: renderScheduleDoc, renderBidQuoteDoc: renderBidQuoteDoc, renderPacket: renderPacket, renderElevationDocs: renderElevationDocs };
}));
