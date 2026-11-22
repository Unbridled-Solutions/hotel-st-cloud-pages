/*
 * Phase 2 preview · group 3 (window.P2Group3). Uses FMCloseout (src/fm-phase2-closeout.js). HANDOFF §42.
 *   Order board (#/board) · Job costs on the Invoices tab · Close-out and the handoff packet on the Overview ·
 *   the sales tax rate on the Estimate's step 2.
 */
(function () {
  'use strict';
  var CL = window.FMCloseout, FM = window.FMPhase1;
  var QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  function mfr(j) { try { var t = window.FMStore.toBooks(j).charges.totals || {}; return -(t.discountCents || 0); } catch (e) { return 0; } }   // as Company books takes it off
  function U(c) { return c.ui.g3 || (c.ui.g3 = {}); }
  function hashParts() { return location.hash.replace(/^#\/?/, '').split('/'); }
  function jobOf(c) { var h = hashParts(); return h[0] === 'job' ? c.store.job(decodeURIComponent(h[1] || '')) : null; }
  function fld(label, attrs, val, type) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" ' + attrs + (type ? ' type="' + type + '"' : '') + ' value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"></label>'; }

  /* ---------- order board ---------- */
  function boardPage(c) {
    var esc = c.esc, $f = c.money, u = U(c), cols = CL.board(c.store.jobs());
    var body = cols.map(function (col, ci) {
      return '<section class="ob-col" data-obcol="' + col.key + '"><header><b>' + esc(col.label) + '</b><span class="fmp1-faint">' + col.jobs.length + '</span></header><ul>' + col.jobs.map(function (j) {
        var s = FM.contractSummary(j), nd = j.invoices.filter(function (i) { return i.status !== 'void' && FM.invoicePaidCents(i) < i.amountCents; })[0];
        return '<li class="ob-card" draggable="true" tabindex="0" data-objob="' + esc(j.jobCode) + '"><a href="#/job/' + encodeURIComponent(j.jobCode) + '/overview"><b>' + esc(j.customer) + '</b></a><span class="p2-small">' + esc(j.projectName || '') + ' · <span class="fmp1-code">' + esc(j.jobCode) + '</span></span>' +
          '<span class="p2-small fmp1-faint">' + (s.balanceCents > 0 ? $f(s.balanceCents) + ' open' + (nd ? ' · next ' + esc(nd.number || nd.label) : '') : 'Paid in full') + (j.deliveryDate ? ' · delivery ' + c.longDate(j.deliveryDate) : '') + (j.salesperson ? ' · ' + esc(j.salesperson) : '') + '</span>' +
          (function () { var b = CL.blocker(j); return b ? '<span class="ob-block p2-small"><span>⚠ ' + esc(b.reason) + '</span><button class="p2-linkbtn" data-obfix="' + esc(j.jobCode) + '|' + b.fix.tab + '|' + esc(b.fix.invoiceId || '') + '">' + esc(b.fix.label) + ' →</button></span>' : ''; })() +
          (window.P2Ship ? window.P2Ship.badge(c, j) : '') +
          (ci < cols.length - 1 ? '<button class="fmp1-btn fmp1-btn--quiet ob-next" data-obnext="' + esc(j.jobCode) + '">Move to ' + esc(cols[ci + 1].label) + ' →</button>' : '') + '</li>'; }).join('') + '</ul></section>';
    }).join('');
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">Order board</h1><p class="p2-sub">Every signed job by where it is. Drag a card to the next column (or focus it and press Shift + →), or use Move to. Each move runs the same checks as the job page and is logged; the next invoice comes due as the job moves.</p></div>' +
      '<label class="p2-fld"><span>Date for moves</span><input class="fmp1-input" type="date" data-obdate value="' + esc(u.obDate || c.TODAY) + '" max="' + c.TODAY + '"></label></div>' +
      (u.obMsg ? '<div class="fmp1-note fmp1-note--' + (u.obErr ? 'alert' : 'good') + ' p2-small ob-msg" role="' + (u.obErr ? 'alert' : 'status') + '"><span>' + esc(u.obMsg) + '</span>' +
        (u.obFix ? '<span class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary" data-obfix="' + esc(u.obFix.code) + '|' + u.obFix.tab + '|' + esc(u.obFix.invoiceId || '') + '">' + esc(u.obFix.label) + ' →</button>' +
          (u.obFix.tab !== 'overview' ? '<a class="fmp1-btn" href="#/job/' + encodeURIComponent(u.obFix.code) + '/overview">Open the job</a>' : '') + '<button class="fmp1-btn fmp1-btn--quiet" data-obdismiss>Dismiss</button></span>' : '') + '</div>' : '') + '<div class="ob-board">' + body + '</div>';
  }
  function move(c, code, target) {
    var u = U(c), j = c.store.job(code); if (!j) return;
    var r = CL.moveTo(j, target, u.obDate || c.TODAY, c.me().name);
    if (r.steps && r.steps.length) c.store.update(code, function () { return r.job; }, r.steps.join('; ') + ' (order board).', c.me().name);
    u.obErr = !r.ok || !!r.partial; u.obMsg = (r.steps && r.steps.length ? j.customer + ': ' + r.steps.join(', ') + '. ' : (r.error ? j.customer + ': ' : '')) + (r.error ? r.error : '');
    u.obFix = r.error && r.fix ? { code: code, tab: r.fix.tab, label: r.fix.label, invoiceId: r.fix.invoiceId } : null;
    c.render();
  }
  function nextCol(j) { var i = CL.BOARD.indexOf(j.stage); return i >= 0 && i < CL.BOARD.length - 1 ? CL.BOARD[i + 1] : null; }

  /* ---------- job costs (Invoices tab) ---------- */
  function costsCard(c, j) {
    if (j.stage === 'quote' || j.stage === 'lost') return '';
    var esc = c.esc, $f = c.money, u = U(c), C = CL.costs(j), mg = CL.margin(j, { mfrDiscountCents: mfr(j) }), pend = u.cost && u.cost.job === j.jobCode ? u.cost : null;
    var rows = C.entries.map(function (e, i) { return '<li><span><b>' + esc(e.vendor) + (e.orderNumber ? ' #' + esc(e.orderNumber) : '') + '</b> <span class="p2-small fmp1-faint">' + esc(e.date ? c.longDate(e.date) : '') + ' · ' + e.lines.length + ' line' + (e.lines.length === 1 ? '' : 's') + (e.taxCents ? ' · tax ' + $f(e.taxCents) : '') + (e.discountCents ? ' · discount ' + $f(e.discountCents) : '') + (e.file ? ' · ' + esc(e.file) : '') + '</span></span><b>' + $f(e.totalCents) + '</b><button class="p2-linkbtn p2-small" data-costrm="' + (j.jobCosts || []).indexOf(e) + '">remove</button></li>'; }).join('');
    var review = '';
    if (pend && pend.entry) review = '<div class="p2-form" style="flex-direction:column;align-items:stretch"><b>Check the lines from ' + esc(pend.entry.file || 'the invoice') + '</b>' +
      '<table class="fmp1-table p2-table"><thead><tr><th>Line</th><th class="r">Qty</th><th class="r">Amount</th><th>For</th></tr></thead><tbody>' + pend.entry.lines.map(function (l, i) {
        return '<tr><td class="p2-small">' + esc(l.label) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.amountCents) + '</td><td><select class="fmp1-input" data-costkind="' + i + '">' + Object.keys(CL.COST_KINDS).map(function (k) { return '<option value="' + k + '"' + (l.kind === k ? ' selected' : '') + '>' + esc(CL.COST_KINDS[k]) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') +
      '</tbody></table><span class="p2-small">Subtotal ' + $f(pend.entry.subtotalCents) + ' − discount ' + $f(pend.entry.discountCents) + ' + tax ' + $f(pend.entry.taxCents) + ' + shipping ' + $f(pend.entry.shippingCents) + ' = <b>' + $f(pend.entry.totalCents) + ' paid</b></span>' +
      (pend.problems && pend.problems.length ? '<span class="p2-small" style="color:var(--fmp1-alert-ink)">' + esc(pend.problems.join(' ')) + '</span>' : '') +
      '<span class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-costadd>Add costs</button><button class="fmp1-btn fmp1-btn--quiet" data-costcancel>Cancel</button></span></div>';
    else if (pend && pend.reading) review = '<p class="p2-small" role="status">' + esc(pend.reading) + '</p>';
    else if (pend && pend.manual) review = '<div class="p2-form">' + fld('From', 'data-costm="vendor" data-autofocus', pend.manual.vendor) + fld('Amount paid ($)', 'data-costm="amount" inputmode="decimal"', pend.manual.amount) +
      '<label class="p2-fld"><span>For</span><select class="fmp1-input" data-costm="kind">' + Object.keys(CL.COST_KINDS).map(function (k) { return '<option value="' + k + '"' + (pend.manual.kind === k ? ' selected' : '') + '>' + esc(CL.COST_KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
      fld('Invoice # (optional)', 'data-costm="reference"', pend.manual.reference) + fld('Date', 'data-costm="date"', pend.manual.date, 'date') +
      '<button class="fmp1-btn fmp1-btn--primary" data-costmsave>Add cost</button><button class="fmp1-btn fmp1-btn--quiet" data-costcancel>Cancel</button>' + (pend.error ? '<span class="p2-small" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(pend.error) + '</span>' : '') + '</div>';
    return '<div class="fmp1-card p2-pad jc-card"><span class="fmp1-eyebrow">Job costs · what we actually paid</span>' +
      '<div class="jc-sum"><div><span class="k">Quoted cost</span><b>' + (mg.quotedCostCents == null ? '—' : $f(mg.quotedCostCents)) + '</b>' + (mg.mfrDiscountCents ? '<span class="p2-small fmp1-faint">' + $f(mg.quotedListCents) + ' less the ' + $f(mg.mfrDiscountCents) + ' manufacturer discount</span>' : '') + '</div><div><span class="k">Actual cost</span><b>' + (mg.actualCostCents == null ? 'none logged' : $f(mg.actualCostCents)) + '</b></div>' +
      '<div><span class="k">Margin</span><b>' + (mg.actualPct != null ? mg.actualPct + '%' : mg.quotedPct != null ? mg.quotedPct + '% (quoted)' : '—') + '</b>' + (mg.diffCents ? '<span class="p2-small ' + (mg.diffCents > 0 ? 'jc-over' : 'p2-ok') + '">' + (mg.diffCents > 0 ? $f(mg.diffCents) + ' over the estimate' : $f(-mg.diffCents) + ' under the estimate') + '</span>' : '') + '</div></div>' +
      (rows ? '<ul class="p2-list p2-small">' + rows + '</ul>' : '<p class="p2-small fmp1-faint">Upload the supplier\'s invoice or order PDF when it comes in. Gross profit in Company books then uses what you actually paid.</p>') +
      (pend ? review : '<div class="p2-row"><label class="fmp1-btn p2-filebtn">Upload supplier invoice<input type="file" accept=".pdf" data-costfile></label><button class="fmp1-btn fmp1-btn--quiet" data-costmanual>Add a cost by hand</button></div>') + '</div>';
  }

  /* ---------- close-out (Overview) ---------- */
  function closeCard(c, j) {
    if (['delivered', 'final_paid', 'complete'].indexOf(j.stage) < 0) return '';
    var esc = c.esc, u = U(c), k = CL.check(j, { mfrDiscountCents: mfr(j) }), set = c.store.settings ? c.store.settings() : {}, rv = j.review, refs = j.referrals || [];
    var checks = '<ul class="p2-list co-checks">' + k.items.map(function (i) { var warn = !i.ok && i.key === 'costs'; return '<li class="' + (i.info || warn ? '' : i.ok ? 'is-ok' : 'is-bad') + '"><span>' + (i.info ? '•' : warn ? '–' : i.ok ? '✓' : '!') + ' ' + esc(i.text) + '</span></li>'; }).join('') + '</ul>';
    var act = j.stage === 'complete' ? '<p class="p2-ok">✓ Closed out.</p>' : '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-coclose' + (k.ready ? '' : ' disabled') + '>Close out the project</button>' + (k.ready ? '' : '<span class="p2-small fmp1-faint">Fix the items marked ! first' + (c.me().access === 'full' ? ', or close it anyway' : '') + '.</span>') + (k.ready || c.me().access !== 'full' ? '' : '<button class="fmp1-btn fmp1-btn--quiet" data-cocloseany>Close it anyway…</button>') + '</div>' +
      (u.closeAny === j.jobCode ? '<div class="p2-form">' + fld('Why close it with items open? (logged)', 'data-g3f="closeWhy" data-autofocus', u.closeWhy) + '<button class="fmp1-btn" data-cocloseanygo>Close it</button></div>' : '');
    var review = rv ? '<p class="p2-small">Review asked ' + esc(c.longDate(rv.askedOn)) + (rv.where ? ' on ' + esc(rv.where) : '') + (rv.said ? ': "' + esc(rv.said) + '"' : '') + (rv.photosOk ? ' · OK to use photos' : '') + (rv.link ? ' · <a href="' + esc(rv.link) + '" target="_blank" rel="noopener">link</a>' : '') + '</p>'
      : (u.review === j.jobCode ? '<div class="p2-form">' + fld('Asked on', 'data-g3r="askedOn"', (u.rv || {}).askedOn || c.TODAY, 'date') + '<label class="p2-fld"><span>Where</span><select class="fmp1-input" data-g3r="where"><option>Google</option><option>Facebook</option><option>Houzz</option><option>In person</option></select></label>' + fld('Link to the review', 'data-g3r="link"', (u.rv || {}).link) + fld('What they said', 'data-g3r="said"', (u.rv || {}).said) +
        '<label class="p2-row p2-small"><input type="checkbox" data-g3r="photosOk"> OK to use photos</label><button class="fmp1-btn fmp1-btn--primary" data-g3reviewsave>Save</button></div>' : '<button class="fmp1-btn" data-g3review>Log the review</button>');
    var refList = refs.map(function (r) { return '<li><span><b>' + esc(r.name) + '</b> <span class="p2-small fmp1-faint">' + esc([r.phone, r.email].filter(Boolean).join(' · ')) + (r.note ? ' · ' + esc(r.note) : '') + '</span></span><button class="fmp1-btn fmp1-btn--quiet" data-g3refstart="' + esc(r.name) + '">Start a project</button></li>'; }).join('');
    var refForm = u.ref === j.jobCode ? '<div class="p2-form">' + fld('Name', 'data-g3x="name" data-autofocus', (u.rx || {}).name) + fld('Phone', 'data-g3x="phone" type="tel"', (u.rx || {}).phone) + fld('Email', 'data-g3x="email" type="email"', (u.rx || {}).email) + fld('Note', 'data-g3x="note"', (u.rx || {}).note) + '<button class="fmp1-btn fmp1-btn--primary" data-g3refsave>Add referral</button>' + (u.refErr ? '<span class="p2-small" style="color:var(--fmp1-alert-ink)">' + esc(u.refErr) + '</span>' : '') + '</div>' : '<button class="fmp1-btn fmp1-btn--quiet" data-g3ref>+ Add a referral</button>';
    return '<div class="fmp1-card p2-pad co-card"><span class="fmp1-eyebrow">Close out</span><b>Final billing check</b>' + checks + act +
      '<div class="co-sec"><b>Handoff packet</b><p class="p2-small">To print and hand over: what was installed, the warranty as signed, how to care for the cabinets, how to reach us, and a code to leave a review.</p><div class="p2-row"><button class="fmp1-btn" data-g3packet>Open the handoff packet</button>' +
        (c.me().access === 'full' ? fld('Review link in the packet', 'data-g3reviewlink placeholder="Your Google \'write a review\' link"', set.reviewLink || '') + '<button class="fmp1-btn fmp1-btn--quiet" data-g3reviewlinksave>Save link</button>' : '') + '</div></div>' +
      '<div class="co-sec"><b>Review</b>' + review + '</div><div class="co-sec"><b>Referrals</b>' + (refList ? '<ul class="p2-list p2-small">' + refList + '</ul>' : '<p class="p2-small fmp1-faint">None yet. Each one can start a new project credited to ' + esc(j.customer) + '.</p>') + refForm + '</div></div>';
  }
  function packetHTML(c, j, qr) {
    var esc = c.esc, AG = window.FMAgreement, set = c.store.settings ? c.store.settings() : {}, end = CL.warrantyEnd(j), logo = window.FMQuote ? window.FMQuote.logoHTML({}) : '';
    var rooms = (j.elevations && j.elevations.rooms) || [], installed = '';
    if (rooms.length) installed = rooms.map(function (r) { return '<h2>' + esc(r.name || 'Room') + '</h2>' + (r.walls || []).map(function (w) {
      var items = (w.base || []).concat(w.upper || []).map(function (it) { return it.sku || (it.appliance ? (window.FMElev && window.FMElev.APPLIANCES[it.appliance] || {}).label : '') || ''; }).filter(Boolean);
      return '<p><b>' + esc(w.name || 'Wall') + ':</b> ' + esc(items.join(', ') || '—') + '</p>'; }).join(''); }).join('');
    else installed = modelsOf(c, j).map(function (m) { return '<h2>' + esc(m.name || 'Cabinets') + '</h2><p>' + esc((m.lines || []).map(function (l) { return l.sku + (l.desc ? ' ' + l.desc : '') + (l.qty > 1 ? ' ×' + l.qty : ''); }).join(' · ') || '—') + '</p>'; }).join('') || '<p>See the signed agreement for the full list.</p>';
    function sheet(title, inner) { return '<article class="fm-p1-doc doc-sheet"><header class="doc-head">' + logo + '<div class="doc-title"><div class="doc-kicker">Your new cabinets</div><h1>' + esc(title) + '</h1></div></header>' + inner + '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · 719 Main Street, Cañon City, CO 81212</span><span class="pg">' + esc(j.customer) + '</span></footer></article>'; }
    return sheet('Welcome home', '<section class="doc-fields"><div><span class="k">For</span><span class="v">' + esc(j.customer) + '</span></div><div><span class="k">Project</span><span class="v">' + esc(j.projectName || '') + '</span></div><div><span class="k">Job</span><span class="v">' + esc(j.jobCode) + '</span></div><div><span class="k">Site</span><span class="v">' + esc(j.installAddress || '—') + '</span></div></section>' +
        '<section class="doc-sec"><p>Thank you for choosing Fremont Makers. This packet has what was installed, your warranty, how to care for your cabinets, and how to reach us. Keep it with your home\'s papers.</p></section>' +
        '<section class="doc-sec"><h2>What was installed</h2>' + installed + '</section>') +
      sheet('Warranty and care', '<section class="doc-sec"><h2>Your warranty, as signed</h2><p>' + esc(AG && AG.SIGNED ? AG.SIGNED.warranty : 'See your signed agreement.') + '</p>' + (end ? '<p><b>It runs through ' + esc(c.longDate(end)) + '.</b></p>' : '') + '</section>' +
        '<section class="doc-sec"><h2>Caring for your cabinets</h2>' + CL.CARE.map(function (x) { return '<p><b>' + esc(x[0]) + '.</b> ' + esc(x[1]) + '</p>'; }).join('') + '</section>' +
        '<section class="doc-sec"><h2>How to reach us</h2><p>Fremont Makers LLC, 719 Main Street, Cañon City, CO 81212. Reply to any email from us, or stop by. Please mention job ' + esc(j.jobCode) + '.</p></section>' +
        (set.reviewLink ? '<section class="doc-sec"><h2>Tell others about your cabinets</h2><div class="hp-review">' + (qr ? '<img src="' + qr + '" alt="Code to leave a review" width="120" height="120">' : '') + '<p>Scan the code' + (qr ? '' : ' (or visit the link)') + ' to leave us a review. It helps a small Colorado business more than you know.<br><span class="hp-link">' + esc(set.reviewLink) + '</span></p></div></section>' : ''));
  }
  /* the job's cabinets by model; the two sample orders keep theirs in their own files */
  function modelsOf(c, j) {
    if (c.B && j.jobCode === c.B.jobCode) return [{ name: 'Cabinets', lines: c.B.model.lines }];
    if (c.W && j.jobCode === c.W.jobCode) return Object.keys(c.W.models).map(function (k) { return { name: k + ' (' + j.houses.filter(function (h) { return h.model === k; }).length + ' homes)', lines: c.W.models[k].lines }; });
    return (j.models || []).filter(function (m) { return (m.lines || []).length; });
  }
  function openPacket(c, j) {
    var link = (c.store.settings ? c.store.settings() : {}).reviewLink;
    function show(qr) { c.ui.viewer = { title: 'Handoff packet · ' + j.jobCode + ' · ' + j.customer, html: packetHTML(c, j, qr), from: '[data-g3packet]' }; c.render(); }
    if (!link) return show(null);
    loadQR().then(function () { var d = document.createElement('div'); new window.QRCode(d, { text: link, width: 240, height: 240 }); setTimeout(function () { var cv = d.querySelector('canvas'); show(cv ? cv.toDataURL('image/png') : null); }, 50); }, function () { show(null); });
  }
  var qrp = null;
  function loadQR() { return qrp || (qrp = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = QR; s.onload = res; s.onerror = function () { qrp = null; rej(); }; document.head.appendChild(s); })); }

  /* ---------- sales tax (Estimate step 2) ---------- */
  function taxPanel(c, j) {
    var esc = c.esc, u = U(c), r = j.taxRate, ed = j.stage === 'quote' && !(j.esign && window.FMContract.isQuoteFrozen(j.esign.state));
    var now = r ? (r.source === 'address' ? r.ratePct + '% from the site address (' + r.parts.map(function (p) { return esc(p.name) + ' ' + p.pct + '%'; }).join(' + ') + '), checked ' + esc(c.longDate(r.checkedOn)) : r.ratePct + '% typed: ' + esc(r.reason)) : ((j.pricing || {}).taxPct != null ? (j.pricing.taxPct + '% set on this job, not yet checked against the site address') : '—');
    var taxed = CL.whatsTaxed(j).map(function (x) { return '<li><span>' + esc(x.what) + (x.note ? ' <span class="fmp1-faint">(' + esc(x.note) + ')</span>' : '') + '</span><b>' + (x.taxed ? 'Taxed' : 'Not taxed') + '</b></li>'; }).join('');
    return '<div class="tx-panel"><b>Sales tax</b><p class="p2-small">' + now + '</p>' +
      (ed ? '<div class="p2-row p2-wrap"><button class="fmp1-btn" data-txlookup>Use the site address rate</button><button class="fmp1-btn fmp1-btn--quiet" data-txtype>Type a different rate…</button></div>' : '<p class="p2-small fmp1-faint">Signed jobs keep the tax they were signed with.</p>') +
      (u.txMsg ? '<p class="p2-small" role="status">' + esc(u.txMsg) + '</p>' : '') +
      (u.txType === j.jobCode ? '<div class="p2-form">' + fld('Rate (%)', 'data-txf="rate" inputmode="decimal" data-autofocus', u.txRate) + fld('Why it\'s different', 'data-txf="reason" placeholder="Tax-exempt buyer, out-of-state delivery…"', u.txReason) + '<button class="fmp1-btn fmp1-btn--primary" data-txsave>Use this rate</button></div>' : '') +
      '<details class="p2-small"><summary>What\'s taxed and what isn\'t</summary><ul class="p2-list">' + taxed + '</ul></details></div>';
  }
  function applyRate(c, j, rate, log) {
    var P = CL.checkRate(rate, j);
    if (j.esign && window.FMContract.isQuoteFrozen(j.esign.state)) P.push('The contract is out for signature, so the price is frozen.'); if (P.length) { U(c).txMsg = P.join(' '); c.render(); return; }
    c.store.update(j.jobCode, function (x) { x.taxRate = rate; x.pricing.taxPct = rate.ratePct; window.P2Flows.reprice(x); return x; }, log, c.me().name);
    U(c).txMsg = null; U(c).txType = null; c.render();
  }

  /* ---------- events ---------- */
  function click(c, t) {
    var d = t.dataset, u = U(c), j = jobOf(c), who = c.me().name;
    if (d.obfix) {   // take them to the fix: the job's Invoices tab with that invoice's payment form open, or the job page
      var fx = d.obfix.split('|'); U(c).obMsg = U(c).obFix = null;
      if (fx[2]) { c.ui.pendingPay = { inv: fx[2] }; c.ui.paidNote = null; }   // the route change opens it
      c.go('#/job/' + encodeURIComponent(fx[0]) + '/' + (fx[1] || 'overview')); return true;
    }
    if (t.hasAttribute('data-obdismiss')) { U(c).obMsg = U(c).obFix = null; c.render(); return true; }
    if (d.obnext) { var bj = c.store.job(d.obnext); if (bj && nextCol(bj)) move(c, d.obnext, nextCol(bj)); return true; }
    if (!j) return false;
    // job costs
    if (t.hasAttribute('data-costmanual')) { u.cost = { job: j.jobCode, manual: { vendor: 'Wholesale Cabinets', amount: '', kind: 'cabinets', reference: '', date: c.TODAY } }; c.render(); return true; }
    if (t.hasAttribute('data-costcancel')) { u.cost = null; c.render(); return true; }
    if (t.hasAttribute('data-costmsave') && u.cost && u.cost.manual) {
      var M = u.cost.manual, rm = CL.manual({ vendor: M.vendor, amountCents: Math.round(parseFloat(String(M.amount).replace(/[$,]/g, '')) * 100), kind: M.kind, reference: M.reference, date: M.date }, { by: who, today: c.TODAY });
      if (!rm.ok) { u.cost.error = rm.problems.join(' '); c.render(); return true; }
      c.store.update(j.jobCode, function (x) { x.jobCosts = (x.jobCosts || []).concat([rm.entry]); return x; }, 'Job cost added by ' + who + ': ' + rm.entry.vendor + ' ' + c.money(rm.entry.totalCents) + '.', who); u.cost = null; c.render(); return true;
    }
    if (t.hasAttribute('data-costadd') && u.cost && u.cost.entry) {
      var e = u.cost.entry;
      c.store.update(j.jobCode, function (x) { x.jobCosts = (x.jobCosts || []).concat([e]); return x; }, 'Supplier invoice added to job costs by ' + who + ': ' + e.vendor + (e.orderNumber ? ' #' + e.orderNumber : '') + ', ' + c.money(e.totalCents) + ' paid.', who);
      if (u.cost.blob && c.files) { var id = j.jobCode + '-cost-' + Date.now().toString(36); c.files.put(id, u.cost.blob); c.store.update(j.jobCode, function (x) { x.documents = (x.documents || []).concat([{ id: id, jobCode: x.jobCode, kind: 'supplier-order', title: 'Supplier invoice ' + (e.orderNumber || ''), file: e.file, bytes: u.cost.blob.size, type: 'application/pdf', uploadedBy: who, uploadedOn: c.TODAY }]); return x; }, null, who); }
      u.cost = null; c.render(); return true;
    }
    if (d.costrm != null) { var ix = +d.costrm; c.store.update(j.jobCode, function (x) { x.jobCosts[ix].removed = { by: who, on: c.TODAY }; return x; }, 'Job cost removed by ' + who + ' (kept on file).', who); c.render(); return true; }
    // close-out
    if (t.hasAttribute('data-g3packet')) { openPacket(c, j); return true; }
    if (t.hasAttribute('data-g3reviewlinksave')) { var lk = (document.querySelector('[data-g3reviewlink]') || {}).value || ''; var sr = c.store.saveSetting('reviewLink', lk.trim(), c.me()); u.txMsg = null; if (!sr.ok) alert(sr.error); c.render(); return true; }
    if (t.hasAttribute('data-g3review')) { u.review = j.jobCode; u.rv = { askedOn: c.TODAY, where: 'Google' }; c.render(); return true; }
    if (t.hasAttribute('data-g3reviewsave')) { var lr = CL.logReview(u.rv || {}, who, c.TODAY); if (!lr.ok) return true; c.store.update(j.jobCode, function (x) { x.review = lr.review; return x; }, 'Review logged by ' + who + ' (' + (lr.review.where || '') + ').', who); u.review = null; c.render(); return true; }
    if (t.hasAttribute('data-g3ref')) { u.ref = j.jobCode; u.rx = {}; u.refErr = null; c.render(); return true; }
    if (t.hasAttribute('data-g3refsave')) { var ar = CL.addReferral(u.rx || {}, who, c.TODAY, j.jobCode); if (!ar.ok) { u.refErr = ar.error; c.render(); return true; } c.store.update(j.jobCode, function (x) { x.referrals = (x.referrals || []).concat([ar.referral]); return x; }, 'Referral added: ' + ar.referral.name + ' (from ' + j.customer + ').', who); u.ref = null; c.render(); return true; }
    if (d.g3refstart) {   // a new project credited to this customer
      try { window.localStorage.removeItem('fm_phase2_draft'); } catch (er) { /* none */ }
      c.ui.draft = null; c.ui.referralFrom = { name: d.g3refstart, from: j.jobCode, customer: j.customer }; c.go('#/new'); return true;
    }
    if (t.hasAttribute('data-coclose') || t.hasAttribute('data-cocloseanygo')) {
      var any = t.hasAttribute('data-cocloseanygo');
      if (any && !String(u.closeWhy || '').trim()) return true;
      var cur = j, steps = [];
      if (cur.stage === 'delivered' && any) { cur = Object.assign({}, cur, { stage: 'final_paid', history: (cur.history || []).concat([{ from: 'delivered', to: 'final_paid', date: c.TODAY, reason: 'closed out with items open: ' + u.closeWhy, by: who }]) }); steps.push('Moved past final payment (' + u.closeWhy + ')'); }
      var mv = CL.moveTo(cur, 'complete', c.TODAY, who);
      if (!mv.ok && !any) { alert(mv.error); return true; }
      var fin = mv.ok ? mv.job : Object.assign({}, cur, { stage: 'complete', history: (cur.history || []).concat([{ from: cur.stage, to: 'complete', date: c.TODAY, reason: 'closed anyway: ' + u.closeWhy, by: who }]) });
      c.store.update(j.jobCode, function () { return fin; }, 'Project closed out by ' + who + (any ? ' with items open: ' + u.closeWhy : '') + '.', who); u.closeAny = null; c.render(); return true;
    }
    if (t.hasAttribute('data-cocloseany')) { u.closeAny = j.jobCode; c.render(); return true; }
    // tax
    if (t.hasAttribute('data-txtype')) { u.txType = u.txType === j.jobCode ? null : j.jobCode; u.txMsg = null; c.render(); return true; }
    if (t.hasAttribute('data-txsave')) { applyRate(c, j, { ratePct: parseFloat(u.txRate), source: 'typed', reason: u.txReason, setOn: c.TODAY }, 'Sales tax set to ' + u.txRate + '% by ' + who + ': ' + (u.txReason || '') + '.'); return true; }
    if (t.hasAttribute('data-txlookup')) {
      var addr = j.installAddress; if (!addr) { u.txMsg = 'Add the site address first (Contract tab, step 1).'; c.render(); return true; }
      u.txMsg = 'Looking up the rate for ' + addr + '…'; c.render();
      fetch('/api/projectbuilder/tax-rate?address=' + encodeURIComponent(addr), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (rate) {
        applyRate(c, c.store.job(j.jobCode), { ratePct: rate.ratePct, parts: rate.parts, source: 'address', address: addr, checkedOn: c.TODAY }, 'Sales tax set from the site address: ' + rate.ratePct + '%.');
      }, function () { u.txMsg = 'The address lookup isn\'t connected yet (Hermes adds it). Until then, type the rate if it isn\'t the default.'; c.render(); });
      return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d = el.dataset, u = U(c);
    if (d.costm && u.cost && u.cost.manual) { u.cost.manual[d.costm] = el.value; return true; }
    if (d.costkind != null && u.cost && u.cost.entry) { u.cost.entry.lines[+d.costkind].kind = el.value; return true; }
    if (d.g3r) { u.rv = u.rv || {}; u.rv[d.g3r] = el.type === 'checkbox' ? el.checked : el.value; return true; }
    if (d.g3x) { u.rx = u.rx || {}; u.rx[d.g3x] = el.value; return true; }
    if (d.g3f) { u[d.g3f] = el.value; return true; }
    if (d.txf) { u[d.txf === 'rate' ? 'txRate' : 'txReason'] = el.value; return true; }
    if (el.hasAttribute('data-obdate')) { u.obDate = el.value; return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target, j = jobOf(c), u = U(c);
    if (el.hasAttribute('data-costfile') && j) {
      var file = el.files && el.files[0]; if (!file) return true; el.value = '';
      u.cost = { job: j.jobCode, reading: 'Reading ' + file.name + '… a scanned PDF takes a few seconds.' }; c.render();
      window.P2Pdf.read(file, function (m) { if (u.cost && u.cost.reading) { u.cost.reading = m; c.render(); } }).then(function (res) {
        var f = CL.fromSupplier(res, { file: file.name, by: c.me().name, today: c.TODAY });
        u.cost = { job: j.jobCode, entry: f.entry, problems: f.problems, blob: file }; c.render();
      }, function (er) { u.cost = { job: j.jobCode, manual: { vendor: 'Wholesale Cabinets', amount: '', kind: 'cabinets', reference: '', date: c.TODAY }, error: file.name + ': ' + er.message + ' Enter it by hand.' }; c.render(); });
      return true;
    }
    return input(c, e);
  }
  /* drag and drop on the board, and Shift + → on a focused card */
  document.addEventListener('dragstart', function (e) { var card = e.target.closest && e.target.closest('[data-objob]'); if (card) { e.dataTransfer.setData('text/plain', card.dataset.objob); e.dataTransfer.effectAllowed = 'move'; } });
  document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('[data-obcol]')) e.preventDefault(); });
  document.addEventListener('drop', function (e) { var col = e.target.closest && e.target.closest('[data-obcol]'); if (!col || !window.P2) return; e.preventDefault(); var code = e.dataTransfer.getData('text/plain'); if (code) move(window.P2.ctx(), code, col.dataset.obcol); });
  document.addEventListener('keydown', function (e) {
    var card = e.target.closest && e.target.closest('[data-objob]'); if (!card || !e.shiftKey || e.key !== 'ArrowRight' || !window.P2) return;
    var c = window.P2.ctx(), j = c.store.job(card.dataset.objob); if (j && nextCol(j)) { e.preventDefault(); move(c, j.jobCode, nextCol(j)); }
  });

  window.P2Group3 = { boardPage: boardPage, costsCard: costsCard, closeCard: closeCard, taxPanel: taxPanel, packetHTML: packetHTML, click: click, input: input, change: change };
  if (window.P2) window.P2.render();
})();
