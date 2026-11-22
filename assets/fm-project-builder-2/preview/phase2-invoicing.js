/*
 * Phase 2 preview · sending invoices to the customer and the package to finance (window.P2Invoicing). Uses FMInvoicing.
 *   On the Invoices tab of a signed job: each invoice's number and whether it's Ready to send / Sent / Paid; Send to customer
 *   (1 Save the PDF, 2 Open the email, 3 Mark as sent); Send to finance the same way. With the server's email connected
 *   (FM_CONFIG.email), each is one button. HANDOFF §39.
 */
(function () {
  'use strict';
  var IV = window.FMInvoicing;
  var LIVE_EMAIL = !!(window.FM_CONFIG && window.FM_CONFIG.email);

  function financeTo(c) { return (c.store.settings && c.store.settings().financeEmail) || IV.SETTINGS.financeEmail; }
  function financeName(c) { var s = c.store.settings ? c.store.settings() : {}; return s.financeName != null ? s.financeName : (s.financeEmail && s.financeEmail !== IV.SETTINGS.financeEmail ? '' : IV.SETTINGS.financeName); }
  function financeLabel(c) { var n = financeName(c); return n ? n + ' (' + financeTo(c) + ')' : financeTo(c); }

  /* the panel above the invoice table */
  function panel(c, j) {
    if (j.stage === 'quote' || j.stage === 'lost') return '';
    var esc = c.esc, u = c.ui.iv && c.ui.iv.job === j.jobCode ? c.ui.iv : null;
    if (!IV.issued(j)) return '<div class="fmp1-note fmp1-note--info iv-panel"><span><b>The invoices haven\'t been issued.</b> Issuing numbers them (' + esc(j.jobCode) + '-1, -2 …) and splits the sales tax across them, so they can go to the customer and to finance.</span><button class="fmp1-btn fmp1-btn--primary" data-ivissue>Issue the invoices</button></div>';
    var ready = IV.readyList(j, c.TODAY), out = '';
    if (ready.length) {
      var sending = u && u.mode === 'customer', m = window.P2Emails ? (function () { var b = window.P2Emails.build(c, j, 'invoice', { invoices: ready }); return { to: b.to, subject: b.subject, body: b.body, mailto: window.FMEmails.mailto(b.to, b) }; })() : IV.customerEmail(j, ready, c.me().name + ', Fremont Makers');
      out += '<div class="iv-card"><div class="p2-between"><b>' + ready.length + ' invoice' + (ready.length > 1 ? 's' : '') + ' ready to send to the customer</b>' +
        (sending ? '' : (LIVE_EMAIL ? '<button class="fmp1-btn fmp1-btn--primary" data-ivemail>Email ' + (ready.length > 1 ? 'them' : 'it') + ' now</button>' : '<button class="fmp1-btn fmp1-btn--primary" data-ivsend="customer">Send to customer</button>')) + '</div>' +
        '<span class="p2-small">' + ready.map(function (i) { return esc(i.number + ' · ' + i.label) + ' ' + c.money(i.amountCents); }).join(' · ') + (j.contacts && j.contacts.buyerEmail ? ' → ' + esc(j.contacts.buyerEmail) : ' · <b style="color:var(--fmp1-alert-ink)">no customer email on file</b>') + '</span>' +
        (sending ? '<ol class="iv-steps"><li><b>Save the PDF.</b> <button class="fmp1-btn" data-ivpdf="customer">Open the invoice' + (ready.length > 1 ? 's' : '') + '</button> <span class="p2-small fmp1-faint">then Print or save PDF</span></li>' +
          '<li><b>Open the email.</b> <a class="fmp1-btn" href="' + esc(m.mailto) + '" target="_blank" rel="noopener">Open it in your mail app</a> <span class="p2-small fmp1-faint">amounts, due dates and how to pay are filled in; attach the PDF</span></li>' +
          '<li><b>Mark as sent.</b> <button class="fmp1-btn fmp1-btn--primary" data-ivmark="customer">Mark as sent</button> <button class="fmp1-btn fmp1-btn--quiet" data-ivcancel>Cancel</button></li></ol>' : '') + '</div>';
    }
    var signedDoc = (j.documents || []).filter(function (d) { return d.kind === 'contract' && (d.signRequest || d.source); })[0];
    if (j.financeSent) out += '<div class="iv-card iv-done"><b>✓ Sent to finance</b><span class="p2-small">' + esc((j.financeSent.name ? j.financeSent.name + ' · ' : '') + j.financeSent.to) + ' · ' + esc(j.financeSent.by) + ' · ' + c.longDate(String(j.financeSent.at || '').slice(0, 10)) + '</span></div>';
    else {
      var fin = u && u.mode === 'finance', fm = IV.financeEmail(j, { to: financeTo(c), name: financeName(c), from: c.me().name + ', Fremont Makers', signedBy: j.esign && j.esign.request ? j.esign.request.signers.map(function (s) { return s.name; }).join(' and ') : null });
      out += '<div class="iv-card"><div class="p2-between"><b>Package to finance</b>' + (fin ? '' : LIVE_EMAIL ? '<button class="fmp1-btn" data-ivfinemail>Send to finance now</button>' : '<button class="fmp1-btn" data-ivsend="finance">Send to finance</button>') + '</div>' +
        '<span class="p2-small">The signed agreement' + (signedDoc ? ' with its certificate' : '') + ' and every invoice, to ' + esc(financeLabel(c)) + ' (change it on the Users page).</span>' +
        (fin ? '<ol class="iv-steps"><li><b>Save the package.</b> <button class="fmp1-btn" data-ivpdf="finance">Open the package</button> <span class="p2-small fmp1-faint">then Print or save PDF</span></li>' +
          '<li><b>Open the email.</b> <a class="fmp1-btn" href="' + esc(fm.mailto) + '" target="_blank" rel="noopener">Open it in your mail app</a> <span class="p2-small fmp1-faint">attach the PDF</span></li>' +
          '<li><b>Mark as sent.</b> <button class="fmp1-btn fmp1-btn--primary" data-ivmark="finance">Mark as sent</button> <button class="fmp1-btn fmp1-btn--quiet" data-ivcancel>Cancel</button></li></ol>' : '') + '</div>';
    }
    return '<div class="iv-panel-wrap">' + out + (u && u.error ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span>' + esc(u.error) + '</span></div>' : '') + '</div>';
  }
  /* under each invoice's name in the table */
  function rowTag(c, j, inv) {
    if (!inv.number) return '';
    var st = IV.stateOf(j, inv, c.TODAY), tone = st.key === 'paid' || st.key === 'sent' ? 'fmp1-pill--good' : st.key === 'ready' ? 'fmp1-pill--alert' : '';
    return '<br><span class="p2-small fmp1-code">' + c.esc(inv.number) + '</span> <span class="fmp1-pill ' + tone + ' iv-pill">' + c.esc(st.label) + '</span>' +
      (inv.taxCents != null ? '<br><span class="p2-small fmp1-faint">' + c.money(inv.preTaxCents) + ' + ' + c.money(inv.taxCents) + ' tax</span>' : '');
  }

  function docsFor(c, j, mode) {
    var D = window.FMDocs, live = j.invoices.filter(function (i) { return i.status !== 'void'; });
    var invs = mode === 'customer' ? IV.readyList(j, c.TODAY) : live.filter(function (i) { return i.number; });
    var html = invs.map(function (inv) { return D.renderInvoiceDoc(j, inv, { today: c.TODAY, index: live.indexOf(inv), count: live.length }); }).join('');
    if (mode === 'finance') {
      var sd = (j.documents || []).filter(function (d) { return d.kind === 'contract' && d.signRequest; })[0];
      return (sd ? c.files.get(window.FMFiles.key(sd)).then(function (b) { return b ? b.text() : ''; }) : Promise.resolve(c.packetHTML(j))).then(function (agreement) { return agreement + html; });
    }
    return Promise.resolve(html);
  }

  function click(c, t) {
    var h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'invoices') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j) return false;
    var d = t.dataset, who = c.me().name;
    if (t.hasAttribute('data-ivissue')) {
      var r = IV.issue(j, new Date().toISOString());
      if (!r.ok) { c.ui.iv = { job: j.jobCode, error: r.error }; c.render(); return true; }
      c.store.update(j.jobCode, function (x) { x.invoices = r.invoices; return x; }, r.log + ' Issued by ' + who + '.', who); c.ui.iv = null; c.render(); return true;
    }
    if (d.ivsend) { c.ui.iv = { job: j.jobCode, mode: d.ivsend }; c.render(); return true; }
    if (t.hasAttribute('data-ivcancel')) { c.ui.iv = null; c.render(); return true; }
    if (d.ivpdf) { docsFor(c, j, d.ivpdf).then(function (html) { c.ui.viewer = { title: (d.ivpdf === 'finance' ? 'Package to finance' : 'Invoices') + ' · ' + j.jobCode + ' · ' + j.customer, html: html, from: '[data-ivpdf="' + d.ivpdf + '"]' }; c.render(); }); return true; }
    if (d.ivmark === 'customer') {
      var ready = IV.readyList(j, c.TODAY), to = j.contacts && j.contacts.buyerEmail, logs = [];
      c.store.update(j.jobCode, function (x) { x.invoices = x.invoices.map(function (inv) { if (!ready.some(function (q) { return q.id === inv.id; })) return inv; var m = IV.markSent(inv, 'mail', who, new Date().toISOString(), to); if (m.ok) logs.push(m.log); return m.ok ? m.invoice : inv; }); return x; }, null, who);
      if (logs.length) c.store.update(j.jobCode, function (x) { return x; }, logs.join(' '), who);
      c.ui.iv = null; c.render(); return true;
    }
    if (d.ivmark === 'finance') {
      var mf = IV.markFinanceSent(j, 'mail', who, new Date().toISOString(), financeTo(c));
      if (!mf.ok) { c.ui.iv = { job: j.jobCode, error: mf.error }; c.render(); return true; }
      if (financeName(c)) { mf.financeSent.name = financeName(c); mf.log = mf.log.replace('to finance (', 'to ' + financeName(c) + ' in finance ('); }
      c.store.update(j.jobCode, function (x) { x.financeSent = mf.financeSent; return x; }, mf.log, who); c.ui.iv = null; c.render(); return true;
    }
    if (t.hasAttribute('data-ivemail') || t.hasAttribute('data-ivfinemail')) {   // live only: the server sends it (HANDOFF §39)
      var fin = t.hasAttribute('data-ivfinemail');
      fetch('/api/projectbuilder/invoices/' + (fin ? 'finance' : 'send'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobCode: j.jobCode, invoices: fin ? null : IV.readyList(j, c.TODAY).map(function (i) { return i.id; }) }) })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function () { c.render(); }, function () { c.ui.iv = { job: j.jobCode, mode: fin ? 'finance' : 'customer', error: 'The email didn\'t go out. Send it from your mail app instead (steps below).' }; c.render(); });
      return true;
    }
    return false;
  }

  window.P2Invoicing = { panel: panel, rowTag: rowTag, click: click, financeTo: financeTo, financeName: financeName };
  if (window.P2) window.P2.render();
})();
