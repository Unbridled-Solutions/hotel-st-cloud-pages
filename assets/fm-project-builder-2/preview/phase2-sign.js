/*
 * Phase 2 preview · signing in the tool and signing outside it (window.P2Sign). Uses FMSign (src/fm-phase2-sign.js).
 *   Contract tab → "Send for signature": Sign in the tool (a link per signer, certificate at the end) or Sign outside the tool
 *   (steps: get the PDF, send it your usual way, upload the signed copy).
 *   Change orders that need a signature get the same, on their card.
 *   #/sign/<link>: the page a signer sees. In the live tool it's /projectbuilder/sign/<link>, public, served by the server
 *   (HANDOFF §34). Here everything stays in this browser; nothing is emailed.
 */
(function () {
  'use strict';
  var S = window.FMSign, FF = window.FMFiles;
  var BASE = (window.FM_CONFIG && window.FM_CONFIG.signBase) || 'https://tools.fremontmakers.com/projectbuilder';
  var LIVE = !!(window.FM_CONFIG && window.FM_CONFIG.live);   // the live tool serves /sign/<link>; this preview signs on its own page
  var HELD = {};   // picked signed copies waiting for "Mark signed": key → { blob, name, bytes, sha256 }

  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha(text) {
    if (!(window.crypto && window.crypto.subtle)) return Promise.reject(new Error('This page isn\'t on https, so it can\'t fingerprint the document.'));
    return window.crypto.subtle.digest('SHA-256', typeof text === 'string' ? new TextEncoder().encode(text) : text).then(hex);
  }
  function token() { var a = new Uint8Array(24); window.crypto.getRandomValues(a); return hex(a.buffer); }
  function nowAt(c) { return c.TODAY + 'T' + new Date().toISOString().slice(11, 19) + 'Z'; }
  function ctxFor(c, extra) { return Object.assign({ at: nowAt(c), today: c.TODAY, ip: '(recorded by the server)', userAgent: navigator.userAgent }, extra || {}); }
  function buyerOf(j) { return { name: (j.contacts && j.contacts.signer) || j.customer, email: (j.contacts && j.contacts.buyerEmail) || '' }; }
  function short(at) { return at ? S.when(at).replace(/ \(.*$/, '') : ''; }

  /* Every request in the store, to find a link's job. */
  function findByToken(c, tk) {
    var hit = null;
    c.store.jobs({ all: true }).some(function (j) {
      var r = j.esign && j.esign.request;
      if (r && r.signers.some(function (s) { return s.token === tk; })) { hit = { job: j, req: r, co: null }; return true; }
      var dq = j.designSign && j.designSign.request;
      if (dq && dq.signers.some(function (s) { return s.token === tk; })) { hit = { job: j, req: dq, co: null, design: true }; return true; }
      return (j.changeOrders || []).some(function (co) {
        var q = co.esign && co.esign.request;
        if (q && q.signers.some(function (s) { return s.token === tk; })) { hit = { job: j, req: q, co: co }; return true; }
        return false;
      });
    });
    return hit;
  }
  function saveReq(c, jobCode, coId, req, log, extra) {
    c.store.update(jobCode, function (x) {
      if (coId === 'ds') x.designSign = Object.assign({}, x.designSign || {}, { provider: 'fm', request: req });
      else if (coId) x.changeOrders = x.changeOrders.map(function (y) { if (y.id === coId) y.esign = { provider: 'fm', request: req }; return y; });
      else x.esign = Object.assign(S.jobState(req, c.TODAY), { request: req });
      if (extra) extra(x);
      return x;
    }, log || null, c.me().name);
  }
  function err(c, msg) { c.ui.sgErr = msg; c.render(); }

  /* ---------- sending ---------- */
  function send(c, j, co) {
    var html = co ? window.P2Flows.coDocHTML(c, j, co) : c.packetHTML(j);
    return sha(html).then(function (h) {
      var buyer = buyerOf(j), fm = j.fmSigner || null;
      var made = S.create({ kind: co ? 'change_order' : 'contract', coNumber: co ? co.number : null, sha256: h,
        title: co ? 'Change order ' + co.number + ' · ' + j.jobCode : 'Contract packet · ' + j.jobCode, pages: (html.match(/class="fm-p1-doc/g) || []).length },
        { jobCode: j.jobCode, buyer: buyer, fremont: co && (co.kind === 'courtesy' || co.kind === 'notice') ? null : fm, acknowledgementOnly: !!(co && (co.kind === 'courtesy' || co.kind === 'notice')), tokens: [token(), token()], today: c.TODAY, at: nowAt(c), by: c.me().name,
          initials: co ? [] : (window.FMDocs && window.FMDocs.INITIALS) || [], amountCents: co ? co.amountCents : (window.FMEstimate ? window.FMEstimate.totals(j).totalCents : null), project: j.projectName || j.customer });
      if (!made.ok) throw new Error(made.problems.join(' '));
      return c.files.put('sign-' + made.request.id, new Blob([html], { type: 'text/html' })).then(function () {
        c.ui.sgErr = null; c.ui.sgCopied = null;
        saveReq(c, j.jobCode, co ? co.id : null, made.request, (co ? 'Change order ' + co.number : 'Contract') + ' sent for signature in the tool by ' + c.me().name + ': ' + buyer.name + ', then ' + (fm ? fm.name : '—') + '. Link expires ' + c.longDate(made.request.expiresOn) + '.');
        c.render();
      });
    }).catch(function (e) { err(c, e.message); });
  }
  /* Send a saved design version to the customer to approve (acknowledgement only; nobody countersigns). HANDOFF §37 */
  function sendDesign(c, j, version) {
    var ver = ((j.elevations || {}).versions || []).filter(function (v) { return v.n === version; })[0];
    if (!ver) return err(c, 'Pick the version to send.');
    var html = window.P2Elev.docPages(c, j, ver);
    return sha(html).then(function (h) {
      var buyer = buyerOf(j), made = S.create({ kind: 'design', sha256: h, version: version, title: 'Design for approval · ' + (j.projectName || j.customer) + ' · version ' + version, pages: (html.match(/class="fm-p1-doc/g) || []).length },
        { jobCode: j.jobCode, buyer: buyer, acknowledgementOnly: true, tokens: [token()], today: c.TODAY, at: nowAt(c), by: c.me().name, project: j.projectName || j.customer });
      if (!made.ok) throw new Error(made.problems.join(' '));
      return c.files.put('sign-' + made.request.id, new Blob([html], { type: 'text/html' })).then(function () {
        c.store.update(j.jobCode, function (x) { x.designSign = { provider: 'fm', request: made.request, version: version }; return x; }, 'Design version ' + version + ' sent to ' + buyer.name + ' to approve, by ' + c.me().name + '.', c.me().name);
        c.ui.sgErr = null; c.render();
      });
    }).catch(function (e) { err(c, e.message); });
  }
  function sendCO(c, jobCode, coId) {
    var j = c.store.job(jobCode), co = j && j.changeOrders.filter(function (x) { return x.id === coId; })[0];
    if (!co) return;
    if (!j.fmSigner) { c.ui.sgErr = 'Choose who signs for Fremont Makers on the Contract tab, then send change order ' + co.number + ' from its card.'; return; }
    send(c, j, co);
  }

  /* ---------- what the team sees ---------- */
  function signedHow(es) {
    if (es.state === 'signed_on_paper') return 'Signed on paper';
    if (es.state === 'signed_outside') return 'Signed outside the tool' + (S.OUTSIDE[es.method] ? ' (' + S.OUTSIDE[es.method].label + ')' : '');
    if (es.provider === 'fm') return 'Signed by everyone in the tool. The certificate is on the signed copy';
    return 'Signed by everyone in Dropbox Sign';
  }
  function steps(c, req) {
    var esc = c.esc;
    return '<ol class="sg-steps">' + req.signers.map(function (s) {
      var st = s.status === 'signed' ? '<b class="p2-ok">✓ ' + (req.acknowledgementOnly ? 'Acknowledged' : 'Signed') + ' ' + esc(short(s.signedAt)) + '</b>' : s.viewedAt ? 'Opened ' + esc(short(s.viewedAt)) + ', not signed yet' : S.nextSigner(req) === s || (S.nextSigner(req) && S.nextSigner(req).token === s.token) ? 'Waiting' : 'Gets the link after ' + esc(req.signers[0].name);
      return '<li><span><b>' + esc(s.name) + '</b> <span class="p2-small fmp1-faint">' + esc(S.ROLES[s.role]) + ' · ' + esc(s.email) + '</span></span><span class="p2-small">' + st + '</span></li>';
    }).join('') + '</ol>';
  }
  /* "The buyer signed, your turn": to the countersigner (and the salesperson). Live, the server sends it the moment the buyer signs. */
  function countersignMail(c, j, req, next, url) {
    var b = req.signers.filter(function (s) { return s.role === 'buyer'; })[0], sp = j.salesperson && j.salesperson !== next.name ? j.salesperson : null;
    var spEmail = sp && window.P2Users ? (window.P2Users.list().filter(function (u) { return u.name === sp; })[0] || {}).email : null;
    var subject = (b ? b.name : 'The buyer') + ' signed: ' + req.title + ' is ready to countersign';
    var body = [next.name.split(' ')[0] + ',', '', (b ? b.name : 'The buyer') + ' signed ' + req.title + (b && b.signedAt ? ' on ' + S.when(b.signedAt).replace(/ \(.*$/, '') : '') + '.' + (req.amountCents ? ' Contract price ' + c.money(req.amountCents) + '.' : ''), '', 'Countersign here:', url, '', 'Fremont Makers Project Builder'].join('\n');
    return { subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(next.email + (spEmail ? ',' + spEmail : '')) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }
  /* The link, email, copy and preview buttons for whoever signs next, plus reminder, cancel. key: 'ct', 'ds' or a change order id */
  /* The email to a signer, in the team's wording (Company → Email templates, HANDOFF §43) when FMEmails is loaded; else FMSign's. */
  function signMail(c, j, req, signer, url, kind) {
    var from = c.me().name + ', Fremont Makers', base = S.email(req, signer, url, kind, from), E = window.FMEmails;
    var k = req.kind === 'contract' ? (kind === 'reminder' ? 'sign-reminder' : kind === 'request' ? 'contract-sign' : null) : req.kind === 'change_order' && kind === 'request' ? 'change-order' : req.kind === 'design' && kind === 'request' ? 'design-approve' : null;
    if (!E || !j || !k) return base;
    var v = E.varsFor(j, { sender: from, link: url, expires: req.expiresOn, coNumber: req.coNumber });
    v.first = String(signer.name || '').split(/[ &]/)[0]; v.name = signer.name;
    var m = E.compose(k, v, (c.store.settings ? c.store.settings() : {}).emailTemplates);
    return { subject: m.subject, body: m.body, mailto: E.mailto(signer.email, m) };
  }
  function outPanel(c, j, req, key) {
    var esc = c.esc, next = S.nextSigner(req), st = S.status(req, c.TODAY);
    if (st === 'expired') return steps(c, req) + '<div class="fmp1-note fmp1-note--alert p2-small" role="status"><span>The link expired on ' + c.longDate(req.expiresOn) + ' without everyone signing. Pricing is unlocked. Send it again when ready.</span></div>' +
      '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-sgresend="' + esc(key) + '">Send again</button></div>';
    var url = S.link(BASE, next.token), mail = signMail(c, j, req, next, url, 'request'), due = S.reminderDue(req, c.TODAY);
    var mine = next.role === 'fremont';
    var html = steps(c, req) +
      '<div class="sg-linkbox"><span class="p2-small"><b>' + (mine ? esc(next.name) + ' countersigns next.' : 'Send ' + esc(next.name.split(' ')[0]) + ' this link.') + '</b> ' + (mine ? 'Open it while signed in, or they get the link by email.' : 'It\'s only for them and works until ' + c.longDate(req.expiresOn) + '.') + '</span>' +
      '<input class="fmp1-input sg-link" readonly value="' + esc(url) + '" aria-label="Signing link for ' + esc(next.name) + '" data-sgsel>' +
      (LIVE ? '' : '<div class="sg-trynote" role="note"><span><b>Preview:</b> this link starts working once Hermes puts the signing page on the server. To try it now, press <b>' +
        (mine ? 'Countersign as ' + esc(next.name) : 'Sign as ' + esc(next.name.split(' ')[0]) + ' (preview)') + '</b>. It opens the same page ' + (mine ? 'they\'ll' : esc(next.name.split(' ')[0]) + ' will') + ' see.</span>' +
        (mine ? '' : '<a class="fmp1-btn fmp1-btn--primary" href="#/sign/' + esc(next.token) + '">Sign as ' + esc(next.name.split(' ')[0]) + ' (preview)</a>') + '</div>') +
      '<span class="p2-row p2-wrap">' + (mine ? '<a class="fmp1-btn fmp1-btn--primary" href="#/sign/' + esc(next.token) + '">Countersign as ' + esc(next.name) + '</a>' + (LIVE ? '' : '<a class="fmp1-btn" href="' + esc(countersignMail(c, j, req, next, url).mailto) + '" target="_blank" rel="noopener">Email ' + esc(next.name.split(' ')[0]) + ' the link</a>')
        : '<a class="fmp1-btn fmp1-btn--primary" href="' + esc(mail.mailto) + '" target="_blank" rel="noopener" data-sgmailed="' + esc(key) + '">Email it from your mail app</a>') +
      '<button class="fmp1-btn" data-sgcopy="' + esc(url) + '">' + (c.ui.sgCopied === url ? 'Copied ✓' : 'Copy link (to text it)') + '</button>' +
      (mine || !LIVE ? '' : '<a class="fmp1-btn fmp1-btn--quiet" href="#/sign/' + esc(next.token) + '">See what ' + esc(next.name.split(' ')[0]) + ' sees</a>') + '</span></div>';
    if (due) {
      var rm = signMail(c, j, req, next, url, 'reminder');
      html += '<div class="fmp1-note fmp1-note--info p2-small" role="status"><span><b>Day ' + due.day + ' reminder due.</b> ' + esc(next.name) + ' hasn\'t signed yet.</span> <a class="fmp1-btn" href="' + esc(rm.mailto) + '" target="_blank" rel="noopener" data-sgremind="' + esc(key) + '">Email a reminder</a></div>';
    }
    if (c.ui.sgCancel === key) {
      html += '<div class="p2-form"><label class="p2-fld" style="flex:1"><span>Why it\'s canceled (the links stop working)</span><input class="fmp1-input" data-sgcancelwhy data-autofocus value="' + esc(c.ui.sgCancelWhy || '') + '"></label><button class="fmp1-btn fmp1-btn--primary" data-sgcancelgo="' + esc(key) + '">Cancel the request</button><button class="fmp1-btn fmp1-btn--quiet" data-sgcancel="">Keep it</button></div>';
    } else html += '<div class="p2-row"><button class="fmp1-btn" data-sgfix="' + esc(key) + '">Fix a mistake</button><button class="fmp1-btn fmp1-btn--quiet" data-sgcancel="' + esc(key) + '">Cancel request</button><button class="fmp1-btn fmp1-btn--quiet" data-sghistory="' + esc(key) + '" aria-expanded="' + (c.ui.sgHistory === key) + '">History</button></div>';
    if (c.ui.sgHistory === key) html += '<ul class="p2-list p2-small sg-hist">' + req.events.map(function (e) { return '<li><span class="fmp1-faint">' + esc(short(e.at)) + '</span> ' + esc(e.text) + '</li>'; }).join('') + '</ul>';
    return html;
  }

  /* The "Send for signature" card on the Contract tab. r: the ready check. */
  function contractCard(c, j, r) {
    var esc = c.esc, es = j.esign || { state: 'none' }, err = c.ui.sgErr ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span>' + esc(c.ui.sgErr) + '</span></div>' : '';
    if (es.provider === 'fm' && es.request && (es.request.status === 'out')) return err + outPanel(c, j, es.request, 'ct');
    if (es.provider === 'outside' && es.state === 'out_for_signature') {
      return err + '<p class="p2-small">Sent outside the tool (' + esc(S.OUTSIDE[es.method].label) + ') on ' + c.longDate(es.sentOn) + ' by ' + esc(es.sentBy) + '. Pricing is frozen until the signed copy is back.</p>' +
        outsideUpload(c, j, 'ct', es.method) + '<div class="p2-row"><button class="fmp1-btn fmp1-btn--quiet" data-sgoutcancel>Not sending it after all</button></div>';
    }
    var way = c.ui.sgWay || 'tool', last = es.request && es.request.status !== 'out' && es.request.status !== 'completed' ? es.request : null;
    var note = last ? '<div class="fmp1-note fmp1-note--info p2-small"><span>The last request was ' + esc(S.status(last, c.TODAY)) + (last.declined ? ' by ' + esc(last.declined.name) + ': "' + esc(last.declined.reason) + '"' : last.canceled ? ': ' + esc(last.canceled.reason) : '') + '. Fix what\'s needed and send it again.</span></div>' : '';
    var chips = '<div class="p2-chips" role="group" aria-label="How it\'s signed">' + [['tool', 'Sign in the tool'], ['outside', 'Sign outside the tool']].map(function (m) {
      return '<button class="fmp1-btn" data-sgway="' + m[0] + '" aria-pressed="' + (way === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>';
    if (way === 'tool') {
      return note + err + chips + '<p class="p2-small">The buyer gets a link, reads the packet, agrees to sign electronically and types or draws their signature. Then ' + esc(j.fmSigner ? j.fmSigner.name : 'your signer') + ' countersigns. A certificate page (who, when, IP address, the document\'s fingerprint) is added to the signed copy, and it\'s filed under Documents.</p>' +
        '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-sgsend' + (r.ready ? '' : ' disabled') + '>Send for signature</button><span class="p2-small fmp1-faint">' + (r.ready ? 'The link is for ' + esc(buyerOf(j).name) + ' (' + esc(buyerOf(j).email) + ')' : 'Fix the items above first.') + '</span></div>';
    }
    var O = c.ui.sgOut || { method: 'dropbox_web', sentOn: c.TODAY };
    return note + err + chips +
      '<ol class="sg-outsteps">' +
      '<li><b>Get the PDF.</b> <span class="p2-small">Open the contract packet above, then <b>Print or save PDF</b>.</span> <button class="fmp1-btn" data-open-packet' + (r.ready ? '' : ' disabled') + '>Open contract packet</button></li>' +
      '<li><b>Send it for signature your usual way.</b><div class="sg-methods" role="radiogroup" aria-label="How you\'re sending it">' + Object.keys(S.OUTSIDE).map(function (k) {
        return '<label class="sg-method"><input type="radio" name="sg-method" value="' + k + '" data-sgoutf="method"' + (O.method === k ? ' checked' : '') + '><span><b>' + esc(S.OUTSIDE[k].label) + '</b><span class="p2-small fmp1-faint">' + esc(S.OUTSIDE[k].help) + '</span></span></label>'; }).join('') + '</div>' +
        '<div class="p2-row"><button class="fmp1-btn" data-sgout' + (r.ready ? '' : ' disabled') + '>I sent it</button><span class="p2-small fmp1-faint">Freezes the price while you wait. Skip this if it\'s already signed.</span></div></li>' +
      '<li><b>When it comes back signed, upload it here.</b>' + outsideUpload(c, j, 'ct', O.method, !r.ready) + '</li></ol>';
  }
  /* Pick the signed copy, confirm, Mark signed. key: 'ct' or a change order id. */
  function outsideUpload(c, j, key, method, disabled) {
    var esc = c.esc, U = (c.ui.sgUp && c.ui.sgUp.key === key) ? c.ui.sgUp : { key: key, method: method || 'dropbox_web', signedOn: c.TODAY }, held = HELD[j.jobCode + ':' + key];
    var co = key !== 'ct';
    return '<div class="p2-form sg-upform">' +
      '<label class="fmp1-btn p2-filebtn">' + (held ? 'Choose a different file' : 'Choose the signed copy') + '<input type="file" data-sgfile="' + esc(key) + '" accept=".pdf,.jpg,.jpeg,.png,.heic"' + (disabled ? ' disabled' : '') + '></label>' +
      (held ? '<span class="p2-small">' + esc(held.name) + ' · ' + FF.size(held.bytes) + '</span>' : '<span class="p2-small fmp1-faint">PDF or photos of every signed page</span>') +
      (key === 'ct' && !(j.esign && j.esign.provider === 'outside') ? '' : '') +
      '<label class="p2-fld"><span>How it was signed</span><select class="fmp1-input" data-sgupf="method">' + Object.keys(S.OUTSIDE).map(function (k) { return '<option value="' + k + '"' + (U.method === k ? ' selected' : '') + '>' + esc(S.OUTSIDE[k].label) + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-fld"><span>Date signed</span><input type="date" class="fmp1-input" data-sgupf="signedOn" max="' + c.TODAY + '" value="' + esc(U.signedOn || '') + '"></label>' +
      '<label class="p2-row p2-small"><input type="checkbox" data-sgupf="buyer"' + (U.buyer ? ' checked' : '') + '> The buyer signed and dated every signature line</label>' +
      (co ? '' : '<label class="p2-row p2-small"><input type="checkbox" data-sgupf="fm"' + (U.fm ? ' checked' : '') + '> ' + esc(j.fmSigner ? j.fmSigner.name : 'Fremont Makers') + ' countersigned</label>') +
      '<button class="fmp1-btn fmp1-btn--primary" data-sgrecord="' + esc(key) + '"' + (disabled ? ' disabled' : '') + '>Mark signed</button>' +
      (U.errors ? '<ul class="p2-small sg-errs" role="alert">' + U.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
  }
  /* On a change order card while it waits for a signature. */
  /* Who signs, editable right here (owner, Nov 20: "asks for an email but no way to fix it"). Saved on the job as you go, and logged.
     ack: an acknowledgement-only change order, which nobody countersigns. Returns { html, problems }. */
  function whoForm(c, j, ack) {
    var esc = c.esc, k = j.contacts || {}, users = window.P2Users ? window.P2Users.list() : [], signers = window.P2Users ? window.P2Users.signers() : [], P = [];
    if (!String(k.signer || j.customer || '').trim()) P.push('Who signs for the buyer?');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(k.buyerEmail || '').trim())) P.push(k.buyerEmail ? '"' + k.buyerEmail + '" isn\'t an email address. Fix the buyer\'s email.' : 'Add the buyer\'s email (the signing link goes there).');
    if (!ack && !(j.fmSigner && j.fmSigner.name)) P.push('Choose who countersigns for Fremont Makers.');
    if (!ack && j.fmSigner && !j.fmSigner.email) P.push(j.fmSigner.name + ' has no email. Add it on the Users page.');
    var fmIdx = j.fmSigner ? signers.map(function (x) { return x.name; }).indexOf(j.fmSigner.name) : -1;
    var html = '<div class="sg-who"><div class="sg-whogrid">' +
      '<label class="p2-fld"><span>Buyer signs as</span><input class="fmp1-input" data-sgwho="signer" value="' + esc(k.signer || j.customer || '') + '"></label>' +
      '<label class="p2-fld"><span>Buyer\'s email (the link goes here)</span><input class="fmp1-input" type="email" data-sgwho="buyerEmail" value="' + esc(k.buyerEmail || '') + '" placeholder="name@example.com"' + (/buyer's email|email address/.test(P.join(' ')) ? ' aria-invalid="true"' : '') + '></label>' +
      (ack ? '' : '<label class="p2-fld"><span>Countersigns for Fremont Makers</span><select class="fmp1-input" data-sgwhofm><option value="">Choose…</option>' + signers.map(function (x, i) { return '<option value="' + i + '"' + (i === fmIdx ? ' selected' : '') + '>' + esc(x.name) + (x.email ? '' : ' (no email yet)') + '</option>'; }).join('') + '</select></label>') +
      '<label class="p2-fld"><span>Salesperson (gets a copy)</span><select class="fmp1-input" data-sgwhosales><option value="">None</option>' + users.map(function (x) { return '<option' + (x.name === j.salesperson ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label></div>' +
      (P.length ? '<ul class="p2-small sg-errs" role="status">' + P.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="p2-small p2-ok">✓ Ready to send.</p>') + '</div>';
    return { html: html, problems: P };
  }

  /* A change order after Finalize (HANDOFF §44): 1. the invoice to download, 2. get it signed: e-sign in the tool or paper,
     with who signs editable right there, and a way to pull an e-sign request back to fix it. */
  function coBlock(c, j, co) {
    var esc = c.esc, q = co.esign && co.esign.request, err = c.ui.sgErr ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span>' + esc(c.ui.sgErr) + '</span></div>' : '';
    var ack = co.kind === 'courtesy' || co.kind === 'notice', fresh = c.ui.coDone === co.id;
    var head = '<div class="p2-between"><span class="fmp1-eyebrow">' + (fresh ? '✓ Change order ' + co.number + ' is finalized. Next:' : 'Get change order ' + co.number + ' signed') + '</span></div>';
    var step1 = '<li><div><b>Download the ' + (co.amountCents > 0 ? 'invoice' : 'change order') + '.</b> <span class="p2-small fmp1-muted">Print it to sign on paper, or save it as a PDF to send.</span></div>' +
      '<button class="fmp1-btn" data-codoc="' + esc(co.id) + '">Open the change order ' + (co.amountCents > 0 ? 'invoice' : '') + '</button></li>';
    if (q && q.status === 'out') return '<div class="sg-coblock">' + head + err + '<ol class="co-next">' + step1 + '<li><div><b>Out for e-signature.</b></div>' + outPanel(c, j, q, co.id) + '</li></ol></div>';
    var ways = c.ui.sgCoWay || (c.ui.sgCoWay = {}), way = ways[co.id] || 'tool';
    var last = q && q.status !== 'completed' ? '<div class="fmp1-note fmp1-note--info p2-small"><span>The last request was ' + esc(S.status(q, c.TODAY)) + (q.declined ? ': "' + esc(q.declined.reason) + '"' : q.canceled && q.canceled.reason ? ': ' + esc(String(q.canceled.reason).replace(/\.$/, '')) : '') + '. Fix what\'s needed and send it again.</span></div>' : '';
    var pick = '<div class="p2-chips" role="group" aria-label="How it gets signed"><button class="fmp1-btn" data-sgcoway="' + esc(co.id) + '|tool" aria-pressed="' + (way === 'tool') + '">E-sign in the tool</button><button class="fmp1-btn" data-sgcoway="' + esc(co.id) + '|paper" aria-pressed="' + (way === 'paper') + '">Paper or emailed PDF</button></div>';
    var body;
    if (way === 'tool') {
      var w = whoForm(c, j, ack);
      body = w.html + '<div class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary" data-sgsendco="' + esc(co.id) + '"' + (w.problems.length ? ' disabled' : '') + '>Send for e-signature' + (q ? ' again' : '') + '</button>' +
        '<span class="p2-small fmp1-faint">' + (ack ? 'The buyer acknowledges it; nobody countersigns.' : 'The buyer signs, then ' + esc(j.fmSigner ? j.fmSigner.name : 'Fremont Makers') + ' countersigns.') + ' You get a link to email or text.</span></div>';
    } else body = '<p class="p2-small fmp1-muted">Print the change order (step 1), have it signed, or email the PDF your usual way. When it comes back signed, upload it here.</p>' + outsideUpload(c, j, co.id, way === 'paper' ? 'paper' : 'email_pdf');
    return '<div class="sg-coblock">' + head + err + last + '<ol class="co-next">' + step1 + '<li><div><b>Get it signed.</b></div>' + pick + body + '</li></ol></div>';
  }

  /* ---------- the signer's page ---------- */
  function page(c, tk) {
    var esc = c.esc, hit = findByToken(c, tk);
    /* What the signer sees has no way into the tool: no menu, no job links, nothing but the document, signing and a confirmation.
       The bar above it exists only in this preview, so the team can get back; the live page never has it. */
    var team = LIVE ? '' : '<div class="sg-teambar" role="note"><span><b>Preview only.</b> The customer never sees this bar. Live, this page is ' + esc(BASE.replace(/^https?:\/\//, '')) + '/sign/… on its own, with no sign-in and no way into the tool.</span>' +
      (hit ? '<a href="#/job/' + encodeURIComponent(hit.job.jobCode) + '/' + (hit.co ? 'changes' : 'contract') + '">Back to the job</a>' : '<a href="#/projects">Back to projects</a>') + '</div>';
    var top = team + '<header class="sg-top"><span class="sg-brand">' + (window.FMQuote ? window.FMQuote.logoHTML({}) : '') + '<b>Fremont Makers</b></span></header>';
    if (!hit) return top + '<main class="sg-main"><h1 class="fmp1-h">This link isn\'t valid</h1><p>Ask Fremont Makers for a new one.</p></main>';
    var req = hit.req, ck = S.check(req, tk, c.TODAY), me = ck.signer, U = c.ui.sg && c.ui.sg.token === tk ? c.ui.sg : (c.ui.sg = { token: tk, typed: '', consent: false, agree: false, drawn: null, draw: false, initials: {} });
    var design = req.kind === 'design', what = req.kind === 'contract' ? (me.role === 'fremont' ? req.signers[0].name + '\'s contract' : 'your contract') : design ? 'your cabinet design' : 'change order ' + req.coNumber;
    var verb = design ? 'approve' : req.acknowledgementOnly ? 'acknowledge' : (me.role === 'fremont' ? 'countersign' : 'sign');
    var need = me.role === 'buyer' ? (req.initials || []) : [], got = need.filter(function (k) { return U.initials && U.initials[k]; }).length;
    var head = '<h1 class="fmp1-h sg-h1">' + (ck.stage === 'done' ? 'Signed' : 'Please review and ' + verb) + '</h1>';
    var doc = '<div class="sg-doc" data-sgdoc aria-label="Document to ' + verb + '" tabindex="0"><p class="p2-small">Loading the document…</p></div>' +
      '<p class="p2-small fmp1-faint sg-fp" data-sgfp>Document fingerprint (SHA-256) ' + esc(req.sha256.slice(0, 16)) + '…</p>';
    if (ck.stage === 'done') return top + '<main class="sg-main sg-donepage">' + thanks(c, hit, req, me, tk) + '</main>';
    if (!ck.ok) return top + '<main class="sg-main">' + head + '<div class="fmp1-note fmp1-note--alert" role="status"><span>' + esc(ck.error) + '</span></div></main>';
    // A short welcome: what it is, the price, and the steps (HANDOFF §38)
    var steps = need.length ? ['Read it and initial the ' + need.length + ' highlighted sections', 'Agree to sign electronically', 'Sign at the bottom'] : design ? ['Look over the drawings', 'Agree to sign electronically', 'Approve it at the bottom'] : ['Read it through', 'Agree to sign electronically', (me.role === 'fremont' ? 'Countersign' : 'Sign') + ' at the bottom'];
    var welcome = '<section class="sg-welcome"><p class="sg-lede">' + esc(me.name.split(' ')[0]) + ', here\'s ' + esc(what) + (me.role === 'fremont' ? '' : ' from Fremont Makers') + (req.project ? ' for <b>' + esc(req.project) + '</b>' : '') + '.' +
      (req.amountCents && !design ? ' The price is <b>' + c.money(req.amountCents) + '</b>.' : '') + (me.role === 'fremont' && req.signers[0].status === 'signed' ? ' ' + esc(req.signers[0].name) + ' signed it ' + esc(S.when(req.signers[0].signedAt).replace(/ \(.*$/, '')) + '; their initials and signature are shown below.' : '') + '</p>' +
      '<ol class="sg-steps3">' + steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      (need.length ? '<div class="sg-progress" role="status"><span class="sg-bar" aria-hidden="true"><i style="width:' + Math.round(100 * got / need.length) + '%"></i></span><b>Initials ' + got + ' of ' + need.length + '</b>' +
        (got < need.length ? '<button class="fmp1-btn fmp1-btn--primary" data-sgnextinit>' + (got ? 'Next section to initial' : 'Start: go to the first one') + '</button>' : '<span class="p2-ok">✓ All initialed. Sign at the bottom.</span>') + '</div>' : '') +
      '<p class="p2-small fmp1-faint">Works until ' + c.longDate(req.expiresOn) + '. Want paper instead? Reply to the email that brought you here.</p></section>';
    var sigPreview = U.draw ? '<div class="sg-pad"><canvas width="560" height="150" data-sgpad aria-label="Draw your signature here"></canvas><button class="fmp1-btn fmp1-btn--quiet" data-sgclear>Clear</button></div>'
      : '<div class="sg-typed" data-sgprev aria-hidden="true">' + esc(U.typed || me.name) + '</div>';
    var form = '<section class="sg-form" aria-label="Sign">' +
      '<h2 class="fmp1-h">Signing electronically</h2><ul class="sg-consent">' + S.CONSENT.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (need.length && got < need.length ? '<div class="fmp1-note fmp1-note--info p2-small"><span>' + (need.length - got) + ' section' + (need.length - got > 1 ? 's' : '') + ' still to initial.</span> <button class="fmp1-btn" data-sgnextinit>Show me</button></div>' : '') +
      '<label class="sg-check"><input type="checkbox" data-sgf="consent"' + (U.consent ? ' checked' : '') + '> <span>' + esc(S.CONSENT_LABEL) + '</span></label>' +
      '<label class="p2-fld"><span>Type your full name: ' + esc(me.name) + '</span><input class="fmp1-input" data-sgf="typed" autocomplete="name" value="' + esc(U.typed) + '"></label>' +
      '<div class="sg-sigrow"><span class="p2-small fmp1-faint">Your signature</span>' + sigPreview + '<button class="p2-linkbtn p2-small" data-sgdraw>' + (U.draw ? 'Use my typed name instead' : 'Draw it instead') + '</button></div>' +
      '<label class="sg-check"><input type="checkbox" data-sgf="agree"' + (U.agree ? ' checked' : '') + '> <span>' + esc(design ? S.DESIGN_AGREE : req.acknowledgementOnly ? 'I have reviewed the document and I acknowledge it.' : S.AGREE_LABEL) + '</span></label>' +
      (U.errors ? '<ul class="sg-errs" role="alert">' + U.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary sg-signbtn" data-sgsign="' + esc(tk) + '">' + (design ? 'Approve the design' : req.acknowledgementOnly ? 'Acknowledge' : me.role === 'fremont' ? 'Countersign' : 'Sign') + '</button>' +
      '<button class="fmp1-btn fmp1-btn--quiet" data-sgdecline>' + (design ? 'Ask for changes' : 'Decline') + '</button></div>' +
      (U.declining ? '<div class="p2-form"><label class="p2-fld" style="flex:1"><span>What needs to change? Fremont Makers sees this.</span><input class="fmp1-input" data-sgf="why" value="' + esc(U.why || '') + '" data-autofocus></label><button class="fmp1-btn" data-sgdeclinego="' + esc(tk) + '">Send</button></div>' : '') +
      '<p class="p2-small fmp1-faint">Your signature is recorded with the time, your IP address and browser, and this document\'s fingerprint. When everyone has signed, you get a copy with a certificate page.</p></section>';
    return top + '<main class="sg-main">' + head + welcome + doc + form + '</main>';
  }
  /* Thank-you pages: what just happened and what's next (HANDOFF §38) */
  function thanks(c, hit, req, me, tk) {
    var esc = c.esc, done = S.status(req, c.TODAY) === 'completed', when = me.signedAt ? S.when(me.signedAt).replace(/ \(.*$/, '') : '', design = req.kind === 'design';
    var j = c.store.job(hit.job.jobCode), items = [];
    if (design) items = ['Fremont Makers adds the cabinet SKUs and prices the design you approved.', 'You\'ll get the estimate, then the contract to sign.'];
    else if (!done) items = ['Fremont Makers countersigns next (usually within a day).', 'Then you\'ll get the signed copy, with its certificate page' + (req.kind === 'contract' ? ', and your deposit invoice' : '') + ', by email.'];
    else if (me.role === 'fremont' && req.kind === 'contract') {
      var inv = (j.invoices || []).filter(function (i) { return i.number; }), tax = inv.reduce(function (t, i) { return t + (i.taxCents || 0); }, 0);
      items = ['The signed copy with its certificate is filed under Documents.', inv.length ? inv.length + ' invoice' + (inv.length > 1 ? 's' : '') + ' issued (' + inv.map(function (i) { return i.number; }).join(', ') + '), including ' + c.money(tax) + ' sales tax.' : 'Invoices: open the Invoices tab to issue them.',
        'The deposit invoice is ready to send to the customer.', j.financeSent ? 'Sent to finance.' : 'The executed agreement and invoices are ready to send to finance.', 'Next step: collect the deposit, then place the factory order.'];
    } else if (done) items = req.kind === 'contract' ? ['Everyone has signed. Your copy includes a certificate page showing who signed and when.', 'Your deposit invoice comes by email next.'] : ['Everyone has signed. Your copy includes a certificate page.'];
    var staff = me.role === 'fremont';
    return '<div class="sg-done" role="status"><span class="sg-tick" aria-hidden="true">✓</span>' +
      '<h1 class="fmp1-h sg-h1">' + (design ? 'Approved' : req.acknowledgementOnly ? 'Acknowledged' : done && staff ? 'Fully executed' : 'Signed') + '. Thank you, ' + esc(me.name.split(' ')[0]) + '.</h1>' +
      '<p class="sg-lede">' + esc(req.title) + (when ? ' · ' + esc(when) : '') + '</p>' +
      '<ul class="sg-next">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="p2-row p2-wrap" style="justify-content:center">' + (done && !design ? '<button class="fmp1-btn fmp1-btn--primary" data-sgsigned="' + esc(tk) + '">View or save ' + (staff ? 'the' : 'your') + ' signed copy</button>' : '') +
      (staff ? '<a class="fmp1-btn" href="#/job/' + encodeURIComponent(j.jobCode) + '/' + (req.kind === 'contract' ? 'invoices' : req.kind === 'design' ? 'elevations' : 'changes') + '">Go to the project</a>' : '') + '</p>' +
      (staff ? '' : '<p class="p2-small fmp1-faint">You can close this page. Questions? Reply to the email that brought you here.</p>') + '</div>';
  }
  /* Initials and signatures written into the agreement (the countersigner's view and the signed copy). */
  function fillSigned(html, req, c) {
    req.signers.forEach(function (s) {
      if (s.status !== 'signed') return;
      var day = c.longDate(String(s.signedAt || '').slice(0, 10));
      var mark = s.drawn ? '<img class="sig-img" src="' + s.drawn + '" alt="Signature of ' + c.esc(s.name) + '">' : '<b class="sig-typed">' + c.esc(s.typedName || s.name) + '</b>';
      html = html.replace(new RegExp('<span class="doc-sigline" data-sig="' + s.role + '">([^<]*)</span>', 'g'), '<span class="doc-sigline is-signed" data-sig="' + s.role + '">' + mark + '<span>$1</span></span>');
      html = html.replace(new RegExp('<span data-sigdate="' + s.role + '">Date</span>', 'g'), '<span data-sigdate="' + s.role + '">Date · ' + day + '</span>');
      Object.keys(s.initials || {}).forEach(function (k) {
        html = html.replace('<div class="doc-initial" data-initial="' + k + '"><span>Buyer initials</span><b></b></div>', '<div class="doc-initial is-done" data-initial="' + k + '"><span>Buyer initials · ' + day + '</span><b>' + c.esc(s.initials[k].text) + '</b></div>');
      });
    });
    return html;
  }
  /* After each render on the signing page: show the frozen document (with initials and signatures so far), check its
     fingerprint, make the initial boxes clickable, and set up the drawing pad. */
  function after(c, tk) {
    var hit = findByToken(c, tk); if (!hit) return;
    var box = document.querySelector('[data-sgdoc]'), U = c.ui.sg || {}, ck = S.check(hit.req, tk, c.TODAY), me = ck.signer;
    if (box) c.files.get('sign-' + hit.req.id).then(function (blob) {
      if (!blob) { box.innerHTML = '<p class="p2-small">This request was sent from a different browser, so the preview can\'t show the frozen document. Live, the server shows it.</p>'; return; }
      return blob.text().then(function (html) {
        box.innerHTML = fillSigned(html, hit.req, c); fit(box);
        if (me && me.role === 'buyer' && ck.ok) (hit.req.initials || []).forEach(function (k) {
          var b = box.querySelector('[data-initial="' + k + '"]'), sec = box.querySelector('[data-initial-sec="' + k + '"]'); if (!b) return;
          var mine = U.initials && U.initials[k];
          if (sec) sec.classList.toggle('sg-hl', !mine);
          b.innerHTML = mine ? '<span>Initialed</span><b>' + c.esc(mine) + '</b> <button class="p2-linkbtn" data-sguninit="' + k + '">undo</button>' : '<button class="fmp1-btn fmp1-btn--primary sg-initbtn" data-sginit="' + k + '">Initial here: ' + c.esc(S.initialsOf(me.name)) + '</button>';
        });
        if (U.focusKey) { var f = box.querySelector('[data-initial="' + U.focusKey + '"]'); if (f) { var top = f.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight / 2; box.scrollTop = Math.max(0, top); } U.focusKey = null; }
        return sha(html).then(function (h) {
          c.ui.sg && (c.ui.sg.shownHash = h);
          var fp = document.querySelector('[data-sgfp]');
          if (fp) fp.textContent = h === hit.req.sha256 ? 'Document fingerprint (SHA-256) ' + h.slice(0, 16) + '… ✓ same document that was sent' : 'This document doesn\'t match the one that was sent. Don\'t sign it.';
        });
      });
    });
    var cv = document.querySelector('[data-sgpad]');
    if (cv) {
      var g = cv.getContext('2d'), down = false;
      g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1f2a44';
      if (U.drawn) { var im = new Image(); im.onload = function () { g.drawImage(im, 0, 0); }; im.src = U.drawn; }
      function pt(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
      cv.addEventListener('pointerdown', function (e) { down = true; cv.setPointerCapture(e.pointerId); var p = pt(e); g.beginPath(); g.moveTo(p[0], p[1]); e.preventDefault(); });
      cv.addEventListener('pointermove', function (e) { if (!down) return; var p = pt(e); g.lineTo(p[0], p[1]); g.stroke(); });
      cv.addEventListener('pointerup', function () { down = false; U.drawn = cv.toDataURL('image/png'); });
    }
  }
  function fit(box) {
    var w = box.clientWidth - 8, scale = Math.min(1, w / 816);
    [].forEach.call(box.querySelectorAll('.fm-p1-doc'), function (d) { d.style.zoom = scale < 1 ? String(scale) : ''; });
  }

  /* When the last person signs: the signed copy (document + certificate) goes into Documents, and the job or change order moves on. */
  function finish(c, hit, req) {
    return c.files.get('sign-' + req.id).then(function (blob) { return blob ? blob.text() : ''; }).then(function (html) {
      var full = fillSigned(html, req, c) + S.renderCertificate(req, { logoHTML: window.FMQuote ? window.FMQuote.logoHTML({}) : '' });
      return sha(full).then(function (h) {
        var j = c.store.job(hit.job.jobCode), id = j.jobCode + '-signed-' + req.id.slice(-8);
        var name = hit.design ? j.jobCode + ' design version ' + (req.version || '') + ' approved.html' : hit.co ? j.jobCode + ' change order ' + hit.co.number + ' signed.html' : j.jobCode + ' signed contract.html';
        var d = { id: id, jobCode: j.jobCode, kind: hit.design ? 'supporting' : hit.co ? 'change_order' : 'contract', category: hit.design ? 'architectural' : undefined, changeOrder: hit.co ? hit.co.number : null, title: hit.design ? 'Design version ' + (req.version || '') + ', approved by the customer, with certificate' : hit.co ? 'Change order ' + hit.co.number + ', signed, with certificate' : 'Signed contract with certificate',
          file: name, bytes: full.length, type: 'text/html', sha256: h, uploadedBy: 'Signed in the tool', uploadedOn: c.TODAY, signRequest: req.id,
          contains: 'Signed by ' + req.signers.map(function (s) { return s.name; }).join(' and ') + '; certificate of completion' };
        return c.files.put(id, new Blob([full], { type: 'text/html' })).then(function () {
          c.store.update(j.jobCode, function (x) { x.documents = (x.documents || []).filter(function (y) { return y.id !== id; }).concat([d]); return x; }, 'Signed copy with its certificate filed under Documents (' + name + ').', 'system');
          if (hit.design) { var bs = req.signers[0]; c.store.update(j.jobCode, function (x) { x.designApproval = { version: req.version, how: 'signed', note: 'Approved by ' + bs.name + ' with the e-sign link', by: 'Signed in the tool', at: bs.signedAt, requestId: req.id }; return x; }, 'Customer approved design version ' + req.version + ' (' + bs.name + ', signed in the tool). Ready to price.', 'system'); return; }
          if (hit.co) window.P2Flows.coSigned(c, j.jobCode, hit.co.id, 'in the tool by ' + req.signers.map(function (s) { return s.name; }).join(' and '));
          else window.P2Flows.contracted(c, c.store.job(j.jobCode), 'signed in the tool by ' + req.signers[0].name + (req.signers[1] ? ', countersigned by ' + req.signers[1].name : ''));
        });
      });
    });
  }

  /* ---------- events ---------- */
  function keyOf(hit) { return hit.design ? 'ds' : hit.co ? hit.co.id : null; }
  function keyTarget(c, j, key) {
    if (key === 'ct') return { req: j.esign && j.esign.request, co: null, save: null };
    if (key === 'ds') return { req: j.designSign && j.designSign.request, co: null, save: 'ds', design: true };
    var co = j.changeOrders.filter(function (x) { return x.id === key; })[0]; return { req: co && co.esign && co.esign.request, co: co, save: co ? co.id : null };
  }
  function click(c, t) {
    var h = location.hash.replace(/^#\/?/, '').split('/'), j = h[0] === 'job' ? c.store.job(decodeURIComponent(h[1])) : null, k, T;
    // signing page
    if (h[0] === 'sign') {
      var tk = decodeURIComponent(h[1] || ''), hit = findByToken(c, tk), U = c.ui.sg;
      if (!hit) return false;
      if (t.dataset.sginit || t.hasAttribute('data-sgnextinit') || t.dataset.sguninit) {
        var me0 = S.check(hit.req, tk, c.TODAY).signer, need = hit.req.initials || []; U.initials = U.initials || {};
        if (t.dataset.sginit) U.initials[t.dataset.sginit] = S.initialsOf(me0 ? me0.name : '');
        if (t.dataset.sguninit) delete U.initials[t.dataset.sguninit];
        U.focusKey = need.filter(function (k) { return !U.initials[k]; })[0] || null;
        c.render(); return true;
      }
      if (t.hasAttribute('data-sgdraw')) { U.draw = !U.draw; if (!U.draw) U.drawn = null; c.render(); return true; }
      if (t.hasAttribute('data-sgclear')) { U.drawn = null; c.render(); return true; }
      if (t.hasAttribute('data-sgdecline')) { U.declining = !U.declining; c.render(); return true; }
      if (t.dataset.sgdeclinego) {
        var dr = S.decline(hit.req, tk, U.why, ctxFor(c));
        if (!dr.ok) { U.errors = [dr.error]; c.render(); return true; }
        saveReq(c, hit.job.jobCode, keyOf(hit), dr.request, dr.log); U.errors = null; c.render(); return true;
      }
      if (t.dataset.sgsign) {
        var res = S.sign(hit.req, tk, { consent: U.consent, agree: U.agree, typedName: U.typed, drawn: U.draw ? U.drawn : null, initials: U.initials || {} }, ctxFor(c, { sha256: U.shownHash || null }));
        if (!res.ok) { U.errors = res.problems; c.render(); return true; }
        U.errors = null;
        saveReq(c, hit.job.jobCode, keyOf(hit), res.request, res.log);
        if (res.completed) finish(c, hit, res.request).then(function () { c.render(); }); else c.render();
        return true;
      }
      if (t.dataset.sgsigned) {   // opens the signed copy right here, over the signing page; never into the tool
        var dd = (hit.job.documents || []).filter(function (x) { return x.signRequest === hit.req.id; })[0];
        if (dd) { c.openDoc('file', FF.key(dd), c.store.job(hit.job.jobCode)); c.ui.viewer.title = dd.title; c.ui.viewer.from = '[data-sgsigned]'; c.render(); }
        return true;
      }
      return false;
    }
    if (!j) return false;
    if (t.dataset.sgway) { c.ui.sgWay = t.dataset.sgway; c.ui.sgErr = null; c.render(); return true; }
    if (t.hasAttribute('data-sgsend')) { if (!window.P2Flows.readyCheck(c, j).ready) { c.render(); return true; } send(c, j, null); return true; }
    if (t.dataset.sgsendco) { var sco = j.changeOrders.filter(function (x) { return x.id === t.dataset.sgsendco; })[0]; var wf = whoForm(c, j, sco.kind === 'courtesy' || sco.kind === 'notice'); if (wf.problems.length) return err(c, wf.problems.join(' ')), true; c.ui.sgErr = null; send(c, j, sco); return true; }
    if (t.dataset.sgcoway) { var cw = t.dataset.sgcoway.split('|'); (c.ui.sgCoWay || (c.ui.sgCoWay = {}))[cw[0]] = cw[1]; c.ui.sgErr = null; c.render(); return true; }
    if (t.dataset.sgfix) {   // pull the request back (the link stops working), so the details can be fixed and it can be sent again
      T = keyTarget(c, j, t.dataset.sgfix);
      var fx = S.cancel(T.req, c.me().name, 'Pulled back to fix a mistake before sending again.', nowAt(c));
      if (!fx.ok) return err(c, fx.error), true;
      if (T.co) (c.ui.sgCoWay || (c.ui.sgCoWay = {}))[T.co.id] = 'tool';
      c.ui.sgErr = null; saveReq(c, j.jobCode, T.save, fx.request, fx.log); c.render(); return true;
    }
    if (t.dataset.sgresend) { T = keyTarget(c, j, t.dataset.sgresend); send(c, j, T.co); return true; }
    if (t.dataset.sgcopy) { var u = t.dataset.sgcopy; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { c.ui.sgCopied = u; c.render(); }, function () { var i = document.querySelector('[data-sgsel]'); if (i) { i.select(); } }); return true; }
    if (t.dataset.sgcancel != null && t.hasAttribute('data-sgcancel')) { c.ui.sgCancel = t.dataset.sgcancel || null; c.ui.sgCancelWhy = ''; c.render(); return true; }
    if (t.dataset.sgcancelgo) {
      T = keyTarget(c, j, t.dataset.sgcancelgo);
      var cr = S.cancel(T.req, c.me().name, c.ui.sgCancelWhy, nowAt(c));
      if (!cr.ok) return err(c, cr.error), true;
      c.ui.sgCancel = null; c.ui.sgErr = null; saveReq(c, j.jobCode, T.save, cr.request, cr.log); c.render(); return true;
    }
    if (t.dataset.sghistory) { c.ui.sgHistory = c.ui.sgHistory === t.dataset.sghistory ? null : t.dataset.sghistory; c.render(); return true; }
    if (t.hasAttribute('data-sgout')) {
      var O = c.ui.sgOut || { method: 'dropbox_web' }, m = S.markSentOutside(j.esign, { method: O.method, sentOn: c.TODAY, by: c.me().name });
      if (!m.ok) return err(c, m.problems.join(' ')), true;
      c.ui.sgErr = null; c.ui.sgUp = { key: 'ct', method: O.method, signedOn: c.TODAY };
      c.store.update(j.jobCode, function (x) { x.esign = m.state; return x; }, m.log, c.me().name); c.render(); return true;
    }
    if (t.hasAttribute('data-sgoutcancel')) { c.store.update(j.jobCode, function (x) { x.esign = { state: 'none' }; return x; }, 'Outside signature canceled by ' + c.me().name + '. Pricing is unlocked.', c.me().name); c.render(); return true; }
    if (t.dataset.sgcoout) { c.ui.sgCoOut = c.ui.sgCoOut === t.dataset.sgcoout ? null : t.dataset.sgcoout; c.ui.sgUp = { key: t.dataset.sgcoout, method: 'email_pdf', signedOn: c.TODAY }; c.render(); return true; }
    if (t.dataset.sgrecord) { record(c, j, t.dataset.sgrecord); return true; }
    return false;
  }
  function record(c, j, key) {
    var U = c.ui.sgUp && c.ui.sgUp.key === key ? c.ui.sgUp : (c.ui.sgUp = { key: key, method: key === 'ct' ? ((j.esign && j.esign.method) || 'dropbox_web') : 'email_pdf', signedOn: c.TODAY });
    var held = HELD[j.jobCode + ':' + key], T = keyTarget(c, j, key);
    var es = key === 'ct' ? (j.esign || { state: 'none' }) : { state: 'none' };
    var rr = S.recordOutside(es, { method: U.method, signedOn: U.signedOn, file: held ? { name: held.name, bytes: held.bytes, sha256: held.sha256 } : {}, buyerSignedAll: U.buyer, fmSigned: key === 'ct' ? U.fm : true,
      needsCountersign: key === 'ct', fmSignerName: key === 'ct' && j.fmSigner ? j.fmSigner.name : '', by: c.me().name }, { today: c.TODAY });
    if (!held) rr.problems = ['Choose the signed copy first.'].concat(rr.problems || []).filter(function (x, i, a) { return a.indexOf(x) === i && !/Upload the signed copy/.test(x); }), rr.ok = false;
    if (!rr.ok) { U.errors = rr.problems; c.render(); return; }
    var all = j.documents || [], seq = all.length + 1; while (all.some(function (d) { return d.id === j.jobCode + '-doc' + seq; })) seq++;
    var d = Object.assign({ id: j.jobCode + '-doc' + seq, jobCode: j.jobCode, type: held.blob.type, changeOrder: T.co ? T.co.number : null }, rr.document, T.co ? { kind: 'change_order', title: 'Change order ' + T.co.number + ', signed (' + S.OUTSIDE[U.method].label + ')' } : {});
    c.files.put(d.id, held.blob).then(function () {
      delete HELD[j.jobCode + ':' + key]; c.ui.sgUp = null; c.ui.sgCoOut = null;
      var open = T.req && T.req.status === 'out' ? S.cancel(T.req, c.me().name, 'signed outside the tool instead', nowAt(c)).request : null;
      if (T.co) {
        c.store.update(j.jobCode, function (x) { x.documents = (x.documents || []).concat([d]); if (open) x.changeOrders.forEach(function (y) { if (y.id === T.co.id) y.esign = { provider: 'fm', request: open }; }); return x; }, rr.log.replace('Signed outside the tool', 'Change order ' + T.co.number + ' signed outside the tool'), c.me().name);
        window.P2Flows.coSigned(c, j.jobCode, T.co.id, S.OUTSIDE[U.method].label.toLowerCase() + ', signed copy uploaded');
      } else {
        c.store.update(j.jobCode, function (x) { x.esign = Object.assign(rr.state, open ? { canceledRequest: open.id } : {}); x.documents = (x.documents || []).concat([d]); return x; }, rr.log, c.me().name);
        window.P2Flows.contracted(c, c.store.job(j.jobCode), S.OUTSIDE[U.method].label.toLowerCase() + ', signed copy uploaded');
      }
      c.render();
    });
  }
  function input(c, e) {
    var el = e.target, U = c.ui.sg;
    if (el.dataset.sgf && U) {
      if (el.type === 'checkbox') U[el.dataset.sgf] = el.checked; else U[el.dataset.sgf] = el.value;
      if (el.dataset.sgf === 'typed') { var p = document.querySelector('[data-sgprev]'); if (p) p.textContent = el.value || ' '; }
      return true;
    }
    if (el.hasAttribute('data-sgcancelwhy')) { c.ui.sgCancelWhy = el.value; return true; }
    if (el.dataset.sgoutf) { c.ui.sgOut = Object.assign(c.ui.sgOut || { method: 'dropbox_web' }, { method: el.value }); return true; }
    if (el.dataset.sgupf && c.ui.sgUp) { c.ui.sgUp[el.dataset.sgupf] = el.type === 'checkbox' ? el.checked : el.value; return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target;
    if (el.dataset.sgwho || el.hasAttribute('data-sgwhofm') || el.hasAttribute('data-sgwhosales')) {
      var hh = location.hash.replace(/^#\/?/, '').split('/'), jj = c.store.job(decodeURIComponent(hh[1] || '')); if (!jj) return true;
      var v = String(el.value || '').trim(), who = c.me().name;
      if (el.dataset.sgwho) c.store.update(jj.jobCode, function (x) { x.contacts = x.contacts || {}; x.contacts[el.dataset.sgwho] = v; return x; }, (el.dataset.sgwho === 'buyerEmail' ? 'Buyer email' : 'Buyer signer') + ' set to ' + (v || 'blank') + ' by ' + who + '.', who);
      else if (el.hasAttribute('data-sgwhofm')) { var sg = (window.P2Users ? window.P2Users.signers() : [])[+el.value]; c.store.update(jj.jobCode, function (x) { x.fmSigner = sg ? { name: sg.name, email: sg.email } : null; return x; }, sg ? sg.name + ' will countersign for Fremont Makers.' : 'Fremont Makers signer cleared.', who); }
      else c.store.update(jj.jobCode, function (x) { x.salesperson = v || null; return x; }, 'Salesperson set to ' + (v || 'none') + '.', who);
      c.ui.sgErr = null; c.render(); return true;
    }
    if (el.dataset.sgfile) {
      var file = el.files && el.files[0], h = location.hash.replace(/^#\/?/, '').split('/'), j = c.store.job(decodeURIComponent(h[1] || '')), key = el.dataset.sgfile; if (!file || !j) return true;
      if (!c.ui.sgUp || c.ui.sgUp.key !== key) c.ui.sgUp = { key: key, method: key === 'ct' ? ((j.esign && j.esign.method) || (c.ui.sgOut && c.ui.sgOut.method) || 'dropbox_web') : 'email_pdf', signedOn: c.TODAY };
      file.arrayBuffer().then(function (buf) { return sha(buf).catch(function () { return null; }).then(function (s) {
        HELD[j.jobCode + ':' + key] = { blob: new Blob([buf], { type: file.type || 'application/pdf' }), name: file.name, bytes: file.size, sha256: s };
        c.ui.sgUp.errors = null; c.render();
      }); });
      return true;
    }
    return input(c, e);
  }
  /* Opening the mail app with a reminder records that it was sent. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-sgremind], a[data-sgmailed]'); if (!a || !window.P2) return;
    var c = window.P2.ctx(), h = location.hash.replace(/^#\/?/, '').split('/'), j = c.store.job(decodeURIComponent(h[1] || '')); if (!j) return;
    var key = a.dataset.sgremind || a.dataset.sgmailed, T = keyTarget(c, j, key); if (!T.req) return;
    if (a.dataset.sgremind) { var rr = S.remind(T.req, { today: c.TODAY, at: nowAt(c), by: c.me().name }); if (rr.ok) { saveReq(c, j.jobCode, T.save, rr.request, rr.log); setTimeout(c.render, 0); } }
    else saveReq(c, j.jobCode, T.save, T.req, 'Signing link emailed to ' + S.nextSigner(T.req).name + ' from ' + c.me().name + '\'s mail app.');
  });

  /* For the dashboard: contracts waiting on Fremont Makers' countersignature */
  function todo(c) {
    var out = [];
    c.store.jobs().forEach(function (j) { var r = j.esign && j.esign.request; if (r && r.status === 'out') { var n = S.nextSigner(r); if (n && n.role === 'fremont') out.push({ jobCode: j.jobCode, kind: 'countersign', text: 'Countersign ' + j.customer + '\'s contract (' + n.name + ')', tab: 'contract' }); } });
    return out;
  }
  window.P2Sign = { whoForm: whoForm, panel: outPanel, sendDesign: sendDesign, todo: todo, fillSigned: fillSigned, contractCard: contractCard, coBlock: coBlock, sendCO: sendCO, signedHow: signedHow, page: page, after: after, click: click, input: input, change: change, findByToken: findByToken };
  if (window.P2) window.P2.render();
})();
