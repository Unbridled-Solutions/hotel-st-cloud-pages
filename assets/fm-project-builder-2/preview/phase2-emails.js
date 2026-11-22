/*
 * Phase 2 preview · Emails to the customer (window.P2Emails). Uses FMEmails. HANDOFF §43.
 *   On a project's Overview: "Email the customer" suggests the emails that fit where the job is now and writes them;
 *   the team opens one in their mail app (or copies it). Writing an email changes nothing on the job.
 *   #/emails (Company → Email templates): the wording of every customer email. Full access can change it.
 */
(function () {
  'use strict';
  var E = window.FMEmails, S = window.FMSign, IV = window.FMInvoicing, CL = window.FMCloseout;
  var BASE = (window.FM_CONFIG && window.FM_CONFIG.signBase) || 'https://tools.fremontmakers.com/projectbuilder';
  var ATTACH = { 'design-approve': 'Attach the drawings PDF (Elevations → Open PDF) if you\'re not sending it to sign.', invoice: 'Attach the invoice PDF (Invoices tab → Send to customer → Open the invoice).',
    'thank-you': 'Attach the handoff packet (Close out → Print the handoff packet).', delivered: 'Attach the final invoice PDF if there\'s a balance.', 'contract-signed': 'If you don\'t include the link, attach the signed copy (Documents tab).' };

  function saved(c) { return (c.store.settings ? c.store.settings() : {}).emailTemplates || {}; }
  function link(req, who) {
    if (!req || !S) return { url: '', expires: '' };
    var sg = who ? (req.signers || []).filter(function (s) { return s.role === who; })[0] : S.nextSigner(req);
    return sg && sg.token ? { url: S.link(BASE, sg.token), expires: req.expiresOn, signer: sg } : { url: '', expires: req.expiresOn };
  }
  /* The filled-in email for one suggestion: { to, subject, body, attach } */
  function build(c, j, kind, extra) {
    extra = extra || {}; var o = { sender: c.me().name + ', Fremont Makers', invoices: extra.invoices, payment: extra.payment, coNumber: extra.coNumber,
      warrantyEnd: CL ? CL.warrantyEnd(j) : null, reviewLink: (c.store.settings ? c.store.settings() : {}).reviewLink };
    var l = { url: '', expires: '' };
    if (kind === 'contract-sign' || kind === 'sign-reminder') l = link(j.esign && j.esign.request);
    else if (kind === 'design-approve') l = link(j.designSign && j.designSign.request && j.designSign.request.status === 'out' ? j.designSign.request : null);
    else if (kind === 'contract-signed') l = link(j.esign && j.esign.request, 'buyer');
    else if (kind === 'change-order') { var co = (j.changeOrders || []).filter(function (x) { return x.number === extra.coNumber; })[0]; l = link(co && co.esign && co.esign.request); }
    if (kind === 'invoice' && !o.invoices) o.invoices = IV ? IV.readyList(j, c.TODAY) : [];
    o.link = l.url; o.expires = l.expires;
    var v = E.varsFor(j, o), m = E.compose(kind, v, saved(c));
    var to = String((j.contacts && j.contacts.buyerEmail) || '').trim();
    return { to: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ? to : '', subject: m.subject, body: m.body, attach: ATTACH[kind] || '' };
  }
  function suggestions(c, j) { return E.suggest(j, { sign: S, today: c.TODAY, ready: IV && IV.issued && IV.issued(j) ? IV.readyList(j, c.TODAY) : null }); }

  /* ---------- Overview: Email the customer ---------- */
  function card(c, j) {
    if (!E || j.designTemplate || j.testVoid || j.stage === 'lost') return '';
    var esc = c.esc, u = c.ui.em && c.ui.em.job === j.jobCode ? c.ui.em : null, sug = suggestions(c, j);
    var chips = sug.map(function (s, i) { var t = E.TEMPLATES.filter(function (x) { return x.kind === s.kind; })[0]; return '<button class="em-chip" data-emopen="' + i + '" aria-pressed="' + !!(u && u.pick === 's' + i) + '"><b>' + esc(t.name) + '</b><span>' + esc(s.why) + '</span></button>'; }).join('');
    var other = '<label class="p2-fld em-other"><span>Another email</span><select class="fmp1-input" data-emother><option value="">Choose…</option>' + E.TEMPLATES.map(function (t) { return '<option value="' + t.kind + '"' + (u && u.pick === 'k:' + t.kind ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></label>';
    var open = '';
    if (u && u.pick) {
      var s = u.pick.charAt(0) === 's' ? sug[+u.pick.slice(1)] : { kind: u.pick.slice(2) }, m = s ? build(c, j, s.kind, s.opts) : null;
      if (m) {
        var subj = u.subject != null ? u.subject : m.subject, body = u.body != null ? u.body : m.body, mm = { subject: subj, body: body };
        open = '<div class="em-draft"><div class="p2-small"><b>To</b> ' + (m.to ? esc(m.to) : '<span style="color:var(--fmp1-alert-ink)">no customer email on file yet. Add it on the Contract tab (who signs), or type it in your mail app.</span>') + '</div>' +
          '<label class="p2-fld"><span>Subject</span><input class="fmp1-input" data-emf="subject" value="' + esc(subj) + '"></label>' +
          '<label class="p2-fld"><span>Message</span><textarea class="fmp1-input em-body" rows="12" data-emf="body">' + esc(body) + '</textarea></label>' +
          (m.attach ? '<p class="p2-small fmp1-muted">📎 ' + esc(m.attach) + '</p>' : '') +
          (/\{\w+\}/.test(subj + body) ? '<p class="p2-small" style="color:var(--fmp1-alert-ink)">Something in {curly braces} wasn\'t filled in. Check it before sending.</p>' : '') +
          '<span class="p2-row p2-wrap"><a class="fmp1-btn fmp1-btn--primary" href="' + esc(E.mailto(m.to, mm)) + '" target="_blank" rel="noopener">Open in your mail app</a><button class="fmp1-btn" data-emcopy>' + (u.copied ? 'Copied ✓' : 'Copy the message') + '</button>' +
          (u.subject != null || u.body != null ? '<button class="fmp1-btn fmp1-btn--quiet" data-emundo>Back to the template</button>' : '') + '<button class="fmp1-btn fmp1-btn--quiet" data-emclose>Close</button></span>' +
          '<p class="p2-small fmp1-faint">Edits here are for this one email. To change the wording for every job, use <a href="#/emails">Email templates</a>.</p></div>';
      }
    }
    return '<div class="fmp1-card p2-pad em-card"><div class="p2-between"><span class="fmp1-eyebrow">Email the customer</span><a class="p2-small" href="#/emails">Email templates</a></div>' +
      (chips ? '<p class="p2-small fmp1-muted">Suggested for where this job is now:</p><div class="em-chips">' + chips + '</div>' : '<p class="p2-small fmp1-muted">Nothing to send right now. Pick any email below.</p>') + other + open + '</div>';
  }

  /* ---------- Company → Email templates ---------- */
  function sampleJob(c) {
    var js = c.store.jobs().filter(function (j) { return j.stage !== 'quote' && j.stage !== 'lost'; });
    return js[0] || c.store.jobs()[0] || null;
  }
  function preview(c, kind, subj, body) {
    var j = sampleJob(c); if (!j) return '';
    var shown = {}; shown[kind] = { subject: subj, body: body };
    var m = E.compose(kind, E.varsFor(j, { sender: c.me().name + ', Fremont Makers', link: BASE + '/sign/sample', expires: c.TODAY, invoices: (j.invoices || []).filter(function (i) { return i.status !== 'void'; }).slice(0, 1),
      payment: { amountCents: 250000, date: c.TODAY }, coNumber: ((j.changeOrders || [])[0] || {}).number, warrantyEnd: CL ? CL.warrantyEnd(j) : null, reviewLink: (c.store.settings ? c.store.settings() : {}).reviewLink }), shown);
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Preview, with ' + c.esc(j.customer) + '\'s job</span><p class="p2-small"><b>Subject:</b> ' + c.esc(m.subject) + '</p><pre class="em-prev">' + c.esc(m.body) + '</pre></div>';
  }
  function page(c) {
    var esc = c.esc, can = c.me().access === 'full', u = c.ui.emt || (c.ui.emt = { kind: E.TEMPLATES[0].kind }), t = E.TEMPLATES.filter(function (x) { return x.kind === u.kind; })[0], cur = E.template(u.kind, saved(c));
    var subj = u.draft && u.draft.kind === u.kind ? u.draft.subject : cur.subject, body = u.draft && u.draft.kind === u.kind ? u.draft.body : cur.body;
    var list = '<ul class="em-tlist">' + E.TEMPLATES.map(function (x) { var ed = E.template(x.kind, saved(c)).edited; return '<li><button class="em-tbtn' + (x.kind === u.kind ? ' is-on' : '') + '" data-emtpick="' + x.kind + '"><b>' + esc(x.name) + '</b>' + (ed ? ' <span class="fmp1-pill">Edited</span>' : '') + '<span class="p2-small fmp1-faint">' + esc(x.who) + '</span></button></li>'; }).join('') + '</ul>';
    var dis = can ? '' : ' disabled';
    var form = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">' + esc(t.name) + '</span><p class="p2-small fmp1-muted">' + esc(t.who) + '.</p>' +
      '<label class="p2-fld"><span>Subject</span><input class="fmp1-input" data-emtf="subject" value="' + esc(subj) + '"' + dis + '></label>' +
      '<label class="p2-fld"><span>Message</span><textarea class="fmp1-input em-body" rows="14" data-emtf="body"' + dis + '>' + esc(body) + '</textarea></label>' +
      '<p class="p2-small fmp1-muted">Fill-ins: ' + t.vars.concat(['company']).map(function (v) { return '<code>{' + v + '}</code> ' + esc(E.LABELS[v] || ''); }).join(' · ') + '</p>' +
      (u.errors && u.errors.length ? '<ul class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);margin:0">' + u.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
      (u.msg ? '<p class="p2-small p2-ok" role="status">' + esc(u.msg) + '</p>' : '') +
      (can ? '<span class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary" data-emtsave' + (u.draft && u.draft.kind === u.kind ? '' : ' disabled') + '>Save</button><button class="fmp1-btn fmp1-btn--quiet" data-emtreset' + (cur.edited ? '' : ' disabled') + '>Go back to the original wording</button></span>' : '<p class="p2-small fmp1-faint">Only someone with Full access can change the templates.</p>') + '</div>';
    var pv = '<div class="em-prevwrap">' + preview(c, u.kind, subj, body) + '</div>';
    return '<h1 class="fmp1-h p2-h1">Email templates</h1><p class="p2-sub">The wording of every email to the customer. The tool suggests the right one on each project\'s Overview and fills in the details. Changes apply to the next email written.</p>' +
      '<div class="em-tgrid"><div>' + list + '</div><div class="em-stack">' + form + pv + '</div></div>';
  }

  /* ---------- events ---------- */
  function jobNow(c) { var h = location.hash.replace(/^#\/?/, '').split('/'); return h[0] === 'job' ? c.store.job(decodeURIComponent(h[1] || '')) : null; }
  function click(c, t) {
    var d = t.dataset;
    if (d.emtpick) { c.ui.emt = { kind: d.emtpick }; c.render(); return true; }
    if (t.hasAttribute('data-emtsave')) {
      var u = c.ui.emt; if (!u || !u.draft) return true;
      var ck = E.check(u.kind, u.draft); if (!ck.ok) { u.errors = ck.problems; c.render(); return true; }
      var all = JSON.parse(JSON.stringify(saved(c))); all[u.kind] = { subject: u.draft.subject, body: u.draft.body };
      var r = c.store.saveSetting('emailTemplates', all, c.me(), new Date().toISOString());
      c.ui.emt = { kind: u.kind, msg: r.ok ? 'Saved. The next email of this kind uses this wording.' : '', errors: r.ok ? null : [r.error] }; c.render(); return true;
    }
    if (t.hasAttribute('data-emtreset')) {
      var k = (c.ui.emt || {}).kind, a2 = JSON.parse(JSON.stringify(saved(c))); delete a2[k];
      var r2 = c.store.saveSetting('emailTemplates', a2, c.me(), new Date().toISOString());
      c.ui.emt = { kind: k, msg: r2.ok ? 'Back to the original wording.' : '', errors: r2.ok ? null : [r2.error] }; c.render(); return true;
    }
    var j = jobNow(c); if (!j) return false;
    if (d.emopen != null) { c.ui.em = c.ui.em && c.ui.em.job === j.jobCode && c.ui.em.pick === 's' + d.emopen ? null : { job: j.jobCode, pick: 's' + d.emopen }; c.render(); return true; }
    if (t.hasAttribute('data-emclose')) { c.ui.em = null; c.render(); return true; }
    if (t.hasAttribute('data-emundo') && c.ui.em) { c.ui.em.subject = c.ui.em.body = null; c.render(); return true; }
    if (t.hasAttribute('data-emcopy') && c.ui.em) {
      var root = t.closest('.em-draft'), s = root.querySelector('[data-emf="subject"]').value, b = root.querySelector('[data-emf="body"]').value, em = c.ui.em;
      var done = function () { em.copied = true; c.render(); setTimeout(function () { em.copied = false; c.render(); }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText('Subject: ' + s + '\n\n' + b).then(done, done); else done();
      return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d = el.dataset;
    if (d.emf && c.ui.em) { c.ui.em[d.emf] = el.value; var a = el.closest('.em-draft').querySelector('a.fmp1-btn--primary'); if (a) { var root = el.closest('.em-draft'); var to0 = String((c.store.job(c.ui.em.job).contacts || {}).buyerEmail || '').trim(); a.href = E.mailto(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to0) ? to0 : '', { subject: root.querySelector('[data-emf="subject"]').value, body: root.querySelector('[data-emf="body"]').value }); } return true; }
    if (d.emtf && c.ui.emt) {
      var u = c.ui.emt, cur = E.template(u.kind, saved(c)); if (!u.draft || u.draft.kind !== u.kind) u.draft = { kind: u.kind, subject: cur.subject, body: cur.body };
      u.draft[d.emtf] = el.value; u.msg = null; u.errors = null;
      var sb = document.querySelector('[data-emtsave]'); if (sb) sb.disabled = false;
      var pw = document.querySelector('.em-prevwrap'); if (pw) pw.innerHTML = preview(c, u.kind, u.draft.subject, u.draft.body);
      return true;
    }
    return false;
  }
  function change(c, e) {
    var el = e.target;
    if (el.hasAttribute('data-emother')) { var j = jobNow(c); if (!j) return false; c.ui.em = el.value ? { job: j.jobCode, pick: 'k:' + el.value } : null; c.render(); return true; }
    return false;
  }

  window.P2Emails = { card: card, page: page, build: build, click: click, input: input, change: change };
  if (window.P2) window.P2.render();
})();
