/*
 * Fremont Makers · Project Builder · Phase 2 · Signing in the tool (FMSign)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMSign in a browser.
 *
 * Owner, Nov 6: the Dropbox Sign API costs $75/month, too much for now. So the tool collects signatures itself:
 *   1. The team sends a contract or change order. The server freezes the document (a PDF made at send time) and records its
 *      SHA-256, and makes one secret link per signer (buyer first, then Fremont Makers).
 *   2. The link goes out by the team's own email or text (no email service needed), or by the server's email later.
 *   3. The signer opens the link, sees the frozen document, agrees to sign electronically, types (or draws) their signature.
 *   4. When everyone has signed, a "Signatures and certificate of completion" page is added to the document: who signed,
 *      when, from which IP address and browser, how, and the document's fingerprint. That page is what makes an
 *      electronic signature hold up: intent, consent, a record tied to the exact document, and a copy for every signer
 *      (US ESIGN Act and Colorado's UETA, C.R.S. 24-71.3).
 * Or the team signs outside the tool (Dropbox Sign website, DocuSign, emailed PDF, paper) and uploads the signed copy:
 * markSentOutside() and recordOutside().
 * The server sets every time, IP address and browser itself; it never trusts the signer's page for those. HANDOFF.md §34.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMSign = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var SETTINGS = { expiryDays: 30, reminderDays: [3, 7] };

  /* What the signer agrees to before signing (ESIGN Act §7001(c) consumer disclosure, in plain words). */
  var CONSENT = [
    'You agree to receive and sign this document electronically. Your electronic signature means the same as signing on paper.',
    'You can ask Fremont Makers for a paper copy at any time, free, and you can choose to sign on paper instead before you sign here.',
    'You can withdraw this agreement to sign electronically before you sign by replying to the email that brought you this link, or by writing to Fremont Makers, 719 Main Street, Cañon City, CO 81212. Withdrawing doesn\'t undo anything already signed.',
    'You need a device with a current web browser and a way to open PDF files. When everyone has signed, you can download the signed copy from this link; please save it.',
    'This agreement covers this document only. Tell Fremont Makers if your email address changes.'
  ];
  var CONSENT_LABEL = 'I agree to use electronic records and signatures for this document.';
  var AGREE_LABEL = 'I have reviewed the document and I sign it.';

  var OUTSIDE = {
    dropbox_web: { label: 'Dropbox Sign website', help: 'Upload the PDF at sign.dropbox.com and send it there (no API needed).' },
    docusign: { label: 'DocuSign or another e-sign service', help: 'Any service that gives back a signed PDF.' },
    email_pdf: { label: 'Emailed PDF', help: 'Email the PDF; the buyer prints, signs and sends back a scan or photo.' },
    paper: { label: 'Paper, in person', help: 'Print it, sign it together, then scan or photograph every page.' }
  };
  var ROLES = { buyer: 'Buyer', fremont: 'Fremont Makers' };

  function blank(s) { return s == null || String(s).trim() === ''; }
  function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); }
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function day(iso) { var p = String(iso).slice(0, 10).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function isoDay(d) { return new Date(d * 864e5).toISOString().slice(0, 10); }
  function addDays(iso, n) { return isoDay(day(iso) + n); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function goodToken(t) { return typeof t === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(t); }
  function goodHash(h) { return typeof h === 'string' && /^[0-9a-f]{64}$/.test(h); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /*
   * Start a signing request.
   * doc:  { kind: 'contract' | 'change_order', title, sha256, pages?, coNumber? }   (sha256 of the frozen document)
   * opts: { jobCode, buyer: { name, email }, fremont: { name, email } | null, acknowledgementOnly, tokens: [buyer, fremont], id, today, at, by }
   *        acknowledgementOnly: courtesy or no-change change orders; the buyer acknowledges and nobody countersigns.
   * Returns { ok, problems[], request }.
   */
  function create(doc, opts) {
    doc = doc || {}; opts = opts || {};
    var P = [], buyer = opts.buyer || {}, fm = opts.acknowledgementOnly ? null : (opts.fremont || null), tokens = opts.tokens || [];
    if (doc.kind !== 'contract' && doc.kind !== 'change_order') P.push('Say what is being signed.');
    if (!goodHash(doc.sha256)) P.push('The document\'s fingerprint (SHA-256) is missing, so it can\'t be frozen for signing.');
    if (blank(buyer.name)) P.push('Add the name of the person signing for the buyer.');
    if (!isEmail(buyer.email)) P.push('Add the buyer\'s email address. Their copy and any reminders go there.');
    if (!opts.acknowledgementOnly) {
      if (!fm || blank(fm.name)) P.push('Choose who signs for Fremont Makers.');
      else if (!isEmail(fm.email)) P.push(fm.name + ' needs an email address on the Users page.');
    }
    if (!goodToken(tokens[0]) || (fm && !goodToken(tokens[1]))) P.push('The signing links weren\'t made. The server makes them from 32 random bytes.');
    if (tokens[0] && tokens[0] === tokens[1]) P.push('Each signer needs their own link.');
    if (!isISO(opts.today)) P.push('Today\'s date is missing.');
    if (blank(opts.by)) P.push('Sign in so the request is sent under your name.');
    if (P.length) return { ok: false, problems: P, request: null };
    var signers = [{ role: 'buyer', name: String(buyer.name).trim(), email: buyer.email.trim(), order: 1, token: tokens[0], status: 'waiting' }];
    if (fm) signers.push({ role: 'fremont', name: String(fm.name).trim(), email: fm.email.trim(), order: 2, token: tokens[1], status: 'waiting' });
    var req = {
      id: opts.id || ('sig-' + (opts.jobCode || 'job') + '-' + tokens[0].slice(0, 8)), version: VERSION,
      kind: doc.kind, title: doc.title || (doc.kind === 'contract' ? 'Contract packet' : 'Change order ' + doc.coNumber),
      jobCode: opts.jobCode || null, coNumber: doc.coNumber != null ? doc.coNumber : null, pages: doc.pages || null,
      sha256: doc.sha256, acknowledgementOnly: !!opts.acknowledgementOnly,
      sentOn: opts.today, sentAt: opts.at || opts.today, sentBy: opts.by, expiresOn: addDays(opts.today, SETTINGS.expiryDays),
      status: 'out', signers: signers, reminders: [],
      events: [{ at: opts.at || opts.today, type: 'sent', by: opts.by, text: 'Sent for ' + (opts.acknowledgementOnly ? 'acknowledgement' : 'signature') + ' to ' + signers.map(function (s) { return s.name + ' (' + s.email + ')'; }).join(', then ') + ' by ' + opts.by + '.' }]
    };
    return { ok: true, problems: [], request: req };
  }

  /* Where a request stands on a given day. 'out' turns into 'expired' after expiresOn. */
  function status(req, today) {
    if (!req) return 'none';
    if (req.status === 'out' && today && isISO(req.expiresOn) && day(today) > day(req.expiresOn)) return 'expired';
    return req.status;
  }
  function signerFor(req, token) { return (req.signers || []).filter(function (s) { return s.token === token; })[0] || null; }
  function nextSigner(req) { return (req.signers || []).filter(function (s) { return s.status !== 'signed'; }).sort(function (a, b) { return a.order - b.order; })[0] || null; }

  /* Can this link be used right now? Returns { ok, error, signer, stage: 'sign' | 'done' | 'wait' | 'closed' }. */
  function check(req, token, today) {
    var s = req ? signerFor(req, token) : null;
    if (!s) return { ok: false, stage: 'closed', error: 'This signing link isn\'t valid. Ask Fremont Makers for a new one.' };
    var st = status(req, today);
    if (st === 'completed') return { ok: false, stage: 'done', signer: s, error: 'Everyone has signed. You can download the signed copy.' };
    if (s.status === 'signed') return { ok: false, stage: 'done', signer: s, error: 'You\'ve signed. Fremont Makers will send the finished copy when everyone has signed.' };
    if (st === 'expired') return { ok: false, stage: 'closed', signer: s, error: 'This link expired on ' + req.expiresOn + '. Ask Fremont Makers to send it again.' };
    if (st === 'canceled') return { ok: false, stage: 'closed', signer: s, error: 'Fremont Makers canceled this request. They\'ll send a new one if anything still needs signing.' };
    if (st === 'declined') return { ok: false, stage: 'closed', signer: s, error: 'This request was declined, so it can\'t be signed.' };
    var first = nextSigner(req);
    if (first && first.token !== s.token) return { ok: false, stage: 'wait', signer: s, error: 'Waiting for ' + first.name + ' to sign first. You\'ll get the link again when it\'s your turn.' };
    return { ok: true, stage: 'sign', signer: s, error: null };
  }

  function stamp(ctx) { ctx = ctx || {}; return { at: ctx.at || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null }; }

  /* The signer opened the link. Records "viewed" once per signer. Returns { ok, request, check }. */
  function open(req, token, ctx) {
    var ck = check(req, token, ctx && ctx.today), r = clone(req);
    if (!ck.signer) return { ok: false, request: r, check: ck };
    var s = signerFor(r, token);
    if (!s.viewedAt && ck.ok) {
      var t = stamp(ctx); s.viewedAt = t.at;
      r.events.push({ at: t.at, type: 'viewed', role: s.role, name: s.name, ip: t.ip, userAgent: t.userAgent, text: s.name + ' opened the document.' });
    }
    return { ok: ck.ok, request: r, check: ck };
  }

  /*
   * Sign.
   * input: { consent: true, agree: true, typedName, drawn: 'data:image/png;base64,…' | null }
   * ctx:   { at, today, ip, userAgent, sha256 }   (sha256: fingerprint of the document the server is showing right now)
   * Returns { ok, problems[], request, completed, next (the signer to send it to next), log }.
   */
  function sign(req, token, input, ctx) {
    input = input || {}; ctx = ctx || {};
    var ck = check(req, token, ctx.today), P = [];
    if (!ck.ok) return { ok: false, problems: [ck.error], request: req, completed: false };
    var r = clone(req), s = signerFor(r, token);
    if (ctx.sha256 && ctx.sha256 !== r.sha256) P.push('The document changed after it was sent, so it can\'t be signed. Ask Fremont Makers to send it again.');
    if (!input.consent) P.push('Tick the box to agree to sign electronically. Or ask Fremont Makers for a paper copy.');
    if (blank(input.typedName)) P.push('Type your full name to sign.');
    else if (norm(input.typedName) !== norm(s.name)) P.push('Type your name as it appears on the document: ' + s.name + '. If that name is wrong, ask Fremont Makers to correct it and resend.');
    if (input.drawn != null && !/^data:image\/png;base64,[A-Za-z0-9+/=]{100,}$/.test(input.drawn)) P.push('The drawn signature didn\'t come through. Draw it again or use your typed name.');
    if (!input.agree) P.push('Tick the box to confirm you have reviewed and sign the document.');
    if (P.length) return { ok: false, problems: P, request: req, completed: false };
    var t = stamp(ctx);
    if (!s.viewedAt) { s.viewedAt = t.at; r.events.push({ at: t.at, type: 'viewed', role: s.role, name: s.name, ip: t.ip, userAgent: t.userAgent, text: s.name + ' opened the document.' }); }
    s.status = 'signed'; s.consentAt = t.at; s.signedAt = t.at; s.ip = t.ip; s.userAgent = t.userAgent;
    s.typedName = String(input.typedName).trim(); s.method = input.drawn ? 'drawn' : 'typed'; if (input.drawn) s.drawn = input.drawn;
    r.events.push({ at: t.at, type: 'consented', role: s.role, name: s.name, ip: t.ip, userAgent: t.userAgent, text: s.name + ' agreed to sign electronically.' });
    var verb = r.acknowledgementOnly ? 'acknowledged' : 'signed';
    r.events.push({ at: t.at, type: 'signed', role: s.role, name: s.name, ip: t.ip, userAgent: t.userAgent, text: s.name + ' ' + verb + ' (' + (s.method === 'drawn' ? 'drew a signature' : 'typed their name') + ').' });
    var next = nextSigner(r), completed = !next;
    if (completed) { r.status = 'completed'; r.completedAt = t.at; r.events.push({ at: t.at, type: 'completed', text: 'Everyone has ' + verb + '. Signed copy sent to ' + r.signers.map(function (x) { return x.email; }).join(' and ') + '.' }); }
    return { ok: true, problems: [], request: r, completed: completed, next: next ? { name: next.name, email: next.email, role: next.role, token: next.token } : null,
             log: (r.kind === 'contract' ? 'Contract' : 'Change order ' + r.coNumber) + ' ' + verb + ' by ' + s.name + ' (' + ROLES[s.role] + ').' + (completed ? ' Everyone has ' + verb + '.' : ' Next: ' + next.name + '.') };
  }

  /* The signer declines. A reason is required so the team knows what to fix. */
  function decline(req, token, reason, ctx) {
    var ck = check(req, token, ctx && ctx.today);
    if (!ck.ok) return { ok: false, error: ck.error, request: req };
    if (blank(reason)) return { ok: false, error: 'Tell Fremont Makers why, so they can fix it.', request: req };
    var r = clone(req), s = signerFor(r, token), t = stamp(ctx);
    r.status = 'declined'; r.declined = { role: s.role, name: s.name, at: t.at, reason: String(reason).trim() };
    r.events.push({ at: t.at, type: 'declined', role: s.role, name: s.name, ip: t.ip, userAgent: t.userAgent, text: s.name + ' declined: ' + String(reason).trim() });
    return { ok: true, request: r, log: (r.kind === 'contract' ? 'Contract' : 'Change order ' + r.coNumber) + ' declined by ' + s.name + ': ' + String(reason).trim() + '. Pricing is unlocked.' };
  }

  /* The team cancels a request that's still out (to fix something and resend, or because it was signed another way). */
  function cancel(req, by, reason, at) {
    if (!req || req.status !== 'out') return { ok: false, error: 'Only a request that\'s still out can be canceled.', request: req };
    if (blank(by)) return { ok: false, error: 'Sign in first.', request: req };
    if (blank(reason)) return { ok: false, error: 'Say why it\'s canceled.', request: req };
    var r = clone(req); r.status = 'canceled'; r.canceled = { by: by, at: at || null, reason: String(reason).trim() };
    r.events.push({ at: at || null, type: 'canceled', by: by, text: 'Canceled by ' + by + ': ' + String(reason).trim() + '. The signing links no longer work.' });
    return { ok: true, request: r, log: 'Signature request canceled by ' + by + ': ' + String(reason).trim() + '. Pricing is unlocked.' };
  }

  /*
   * Reminders on days 3 and 7 (owner, Nov 6). Without an email service, the tool shows "Reminder due" and the team sends it
   * from their own email; with one, the server's daily job sends it. Returns { day, signer } or null.
   */
  function reminderDue(req, today) {
    if (!req || status(req, today) !== 'out' || !isISO(today)) return null;
    var age = day(today) - day(req.sentOn), done = (req.reminders || []).map(function (x) { return x.day; });
    var d = SETTINGS.reminderDays.filter(function (x) { return age >= x && done.indexOf(x) < 0; }).pop();
    if (d == null) return null;
    var s = nextSigner(req);
    return s ? { day: d, signer: { name: s.name, email: s.email, role: s.role, token: s.token } } : null;
  }
  function remind(req, opts) {
    opts = opts || {};
    var due = reminderDue(req, opts.today), r = clone(req), s = nextSigner(r);
    if (!s || status(req, opts.today) !== 'out') return { ok: false, error: 'Nothing is waiting on a signature.', request: req };
    var d = due ? due.day : null;
    // Each scheduled reminder is recorded once; earlier ones that were skipped count as covered by this one.
    SETTINGS.reminderDays.forEach(function (x) { if (d != null && x <= d && !(r.reminders || []).some(function (y) { return y.day === x; })) r.reminders.push({ day: x, on: opts.today, by: opts.by || null }); });
    if (d == null) r.reminders.push({ day: null, on: opts.today, by: opts.by || null });
    r.events.push({ at: opts.at || opts.today, type: 'reminded', by: opts.by || null, text: 'Reminder sent to ' + s.name + ' (' + s.email + ')' + (opts.by ? ' by ' + opts.by : '') + '.' });
    return { ok: true, request: r, log: 'Signing reminder sent to ' + s.name + '.' };
  }

  /* The job's e-sign state, in the shape the rest of the tool already uses (FMContract.isQuoteFrozen and the contract tab). */
  function jobState(req, today) {
    var st = status(req, today);
    var map = { out: (req && req.signers.some(function (s) { return s.role === 'buyer' && s.status === 'signed'; })) ? 'buyer_signed' : 'out_for_signature',
                completed: 'signed', declined: 'declined', canceled: 'canceled', expired: 'expired' };
    return { provider: 'fm', requestId: req ? req.id : null, state: map[st] || 'none', jobStatus: st === 'completed' ? 'contracted' : 'proposed' };
  }

  /* Links. The live tool serves the signing page at /projectbuilder/sign/<token> (public, no sign-in, https only). */
  function link(base, token) { return String(base || '').replace(/\/+$/, '') + '/sign/' + token; }

  /* A ready-to-send email for the team's own mail app: { subject, body, mailto }. kind: 'request' | 'reminder' | 'copy'. */
  function email(req, signer, url, kind, from) {
    var what = req.kind === 'contract' ? 'your Fremont Makers contract' : 'change order ' + req.coNumber + ' from Fremont Makers';
    var act = req.acknowledgementOnly ? 'review and acknowledge' : 'review and sign';
    var subject = kind === 'copy' ? 'Signed copy: ' + req.title : kind === 'reminder' ? 'Reminder: please ' + act + ' ' + what : 'Please ' + act + ' ' + what;
    var lines = kind === 'copy'
      ? ['Hi ' + signer.name.split(' ')[0] + ',', '', 'Everyone has signed ' + req.title + '. Download your signed copy here:', url, '', 'Please save it for your records.']
      : ['Hi ' + signer.name.split(' ')[0] + ',', '', (kind === 'reminder' ? 'A quick reminder: ' : '') + 'Please ' + act + ' ' + what + ' (' + req.title + ') here:', url, '',
         'The link is just for you and works until ' + longDate(req.expiresOn) + '. You can ask us for a paper copy at any time.'];
    lines.push('', 'Thank you,', from || 'Fremont Makers');
    var body = lines.join('\n');
    return { subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(signer.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }

  /* ---------- signing outside the tool ---------- */
  /* The team sent it another way. Pricing freezes until it comes back or is canceled. */
  function markSentOutside(esState, input) {
    input = input || {}; var st = (esState && esState.state) || 'none', P = [];
    if (['signed', 'signed_on_paper', 'signed_outside', 'out_for_signature', 'buyer_signed'].indexOf(st) >= 0) P.push(st.indexOf('signed') === 0 ? 'This is already signed.' : 'It\'s already out for signature. Cancel that first.');
    if (!OUTSIDE[input.method]) P.push('Choose how it was sent.');
    if (!isISO(input.sentOn)) P.push('Enter the date it was sent.');
    if (blank(input.by)) P.push('Sign in first.');
    if (P.length) return { ok: false, problems: P, state: esState };
    return { ok: true, problems: [], state: { provider: 'outside', method: input.method, sentOn: input.sentOn, sentBy: input.by, state: 'out_for_signature', jobStatus: 'proposed' },
             log: 'Sent for signature outside the tool (' + OUTSIDE[input.method].label + ') by ' + input.by + '. Pricing is frozen until the signed copy is uploaded or this is canceled.' };
  }

  /*
   * The signed copy came back. Upload it and mark it signed.
   * input: { method, signedOn, file: { name, bytes, sha256 }, buyerSignedAll, fmSigned, fmSignerName, by, needsCountersign (default true) }
   * Returns { ok, problems[], state, log, document }. If a request in the tool is still out, the caller cancels it.
   */
  var SIGNED_TYPES = /\.(pdf|jpe?g|png|heic)$/i, MAX_BYTES = 25 * 1024 * 1024;
  function recordOutside(esState, input, opts) {
    input = input || {}; opts = opts || {}; var st = (esState && esState.state) || 'none', f = input.file || {}, P = [];
    if (st === 'signed' || st === 'signed_on_paper' || st === 'signed_outside') P.push('This is already signed.');
    if (!OUTSIDE[input.method]) P.push('Choose how it was signed.');
    if (!SIGNED_TYPES.test(f.name || '')) P.push('Upload the signed copy as a PDF or a photo (JPG, PNG or HEIC).');
    else if (!(f.bytes > 0)) P.push('The file is empty.');
    else if (f.bytes > MAX_BYTES) P.push('The file is over 25 MB. Scan it at a lower resolution.');
    if (f.name && !goodHash(f.sha256)) P.push('The file\'s fingerprint couldn\'t be worked out. Try the upload again.');
    if (!isISO(input.signedOn)) P.push('Enter the date it was signed.');
    else if (opts.today && input.signedOn > opts.today) P.push('The signed date can\'t be in the future.');
    if (!input.buyerSignedAll) P.push('Check the buyer signed and dated every signature line.');
    if (input.needsCountersign !== false && !input.fmSigned) P.push('Check Fremont Makers countersigned.');
    if (blank(input.by)) P.push('Sign in so the upload is recorded under your name.');
    if (P.length) return { ok: false, problems: P, state: esState };
    var how = OUTSIDE[input.method].label;
    return {
      ok: true, problems: [],
      state: { provider: 'outside', method: input.method, state: input.method === 'paper' ? 'signed_on_paper' : 'signed_outside', signedOn: input.signedOn, jobStatus: 'contracted' },
      log: 'Signed outside the tool (' + how + ', dated ' + input.signedOn + ')' + (input.fmSignerName ? ', countersigned by ' + input.fmSignerName : '') + '. Signed copy uploaded by ' + input.by + ': ' + f.name + '.',
      document: { kind: 'contract', source: input.method, file: f.name, bytes: f.bytes, sha256: f.sha256, signedOn: input.signedOn, uploadedBy: input.by, uploadedOn: opts.today || null, title: 'Signed copy (' + how + ')' }
    };
  }

  /* ---------- the certificate ---------- */
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  /* Times are kept in UTC and shown in Mountain Time (Cañon City), with UTC alongside. */
  function when(at, tz) {
    if (!at) return '—';
    if (!/T/.test(at)) return longDate(at);
    try {
      var d = new Date(at), local = d.toLocaleString('en-US', { timeZone: tz || 'America/Denver', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      return local + ' (' + d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC)';
    } catch (e) { return String(at); }
  }
  function browser(ua) {
    ua = String(ua || ''); if (!ua) return '—';
    var b = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    var o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '';
    return b + (o ? ' on ' + o : '');
  }

  /* The facts on the certificate, for the page and for anyone checking it later. */
  function certificate(req) {
    return {
      requestId: req.id, title: req.title, jobCode: req.jobCode, kind: req.kind, coNumber: req.coNumber, sha256: req.sha256, pages: req.pages,
      sentAt: req.sentAt, sentBy: req.sentBy, completedAt: req.completedAt || null, status: req.status, acknowledgementOnly: req.acknowledgementOnly,
      signers: req.signers.map(function (s) {
        return { role: ROLES[s.role], name: s.name, email: s.email, status: s.status, viewedAt: s.viewedAt || null, consentAt: s.consentAt || null, signedAt: s.signedAt || null,
                 ip: s.ip || null, userAgent: s.userAgent || null, browser: browser(s.userAgent), method: s.method || null, typedName: s.typedName || null };
      }),
      events: req.events.map(function (e) { return { at: e.at, type: e.type, text: e.text, ip: e.ip || null }; })
    };
  }

  /*
   * "Signatures and certificate of completion", printed after the signed document. Uses the document print styles
   * (src/fm-phase1-print.css). opts: { logoHTML, timeZone }
   */
  function renderCertificate(req, opts) {
    opts = opts || {}; var c = certificate(req), tz = opts.timeZone, verb = req.acknowledgementOnly ? 'Acknowledged' : 'Signed';
    var sigs = req.signers.map(function (s) {
      var mark = s.status !== 'signed' ? '<span class="sig-none">Not signed</span>' : s.drawn ? '<img class="sig-img" src="' + s.drawn + '" alt="Signature of ' + esc(s.name) + '">' : '<span class="sig-typed">' + esc(s.typedName) + '</span>';
      return '<div class="sig-box"><span class="sig-role">' + esc(ROLES[s.role]) + '</span>' + mark + '<span class="sig-line">' + esc(s.name) + ' · ' + esc(s.email) + '</span><span class="sig-when">' + (s.signedAt ? verb + ' ' + esc(when(s.signedAt, tz)) : '') + '</span></div>';
    }).join('');
    var rows = c.signers.map(function (s) {
      return '<tr><td><b>' + esc(s.name) + '</b><br>' + esc(s.role) + '<br>' + esc(s.email) + '</td><td>Opened ' + esc(when(s.viewedAt, tz)) + '<br>Agreed to e-sign ' + esc(when(s.consentAt, tz)) + '<br><b>' + verb + ' ' + esc(when(s.signedAt, tz)) + '</b></td>' +
        '<td>' + (s.method === 'drawn' ? 'Drew a signature' : s.method === 'typed' ? 'Typed their name' : '—') + '<br>IP ' + esc(s.ip || '—') + '<br>' + esc(s.browser) + '</td></tr>';
    }).join('');
    var log = c.events.map(function (e) { return '<tr><td>' + esc(when(e.at, tz)) + '</td><td>' + esc(e.text) + (e.ip ? ' <span class="cert-ip">IP ' + esc(e.ip) + '</span>' : '') + '</td></tr>'; }).join('');
    return '<article class="fm-p1-doc doc-sheet doc-cert" aria-label="Certificate of completion">' +
      '<header class="doc-head">' + (opts.logoHTML || '') + '<div class="doc-title doc-title--long"><div class="doc-kicker">' + verb + ' electronically</div><h1>Signatures and certificate of completion</h1></div></header>' +
      '<section class="doc-fields"><div><span class="k">Document</span><span class="v">' + esc(c.title) + '</span></div><div><span class="k">Job</span><span class="v">' + esc(c.jobCode || '—') + '</span></div>' +
      '<div><span class="k">Request</span><span class="v">' + esc(c.requestId) + '</span></div><div><span class="k">Completed</span><span class="v">' + esc(c.completedAt ? when(c.completedAt, tz) : 'Not yet: ' + c.status) + '</span></div></section>' +
      '<section class="sig-grid">' + sigs + '</section>' +
      '<section class="doc-sec"><h2>Signers</h2><table class="cert-table"><thead><tr><th>Who</th><th>When</th><th>How</th></tr></thead><tbody>' + rows + '</tbody></table></section>' +
      '<section class="doc-sec"><h2>Document fingerprint</h2><p>SHA-256 of the document as sent' + (c.pages ? ' (' + c.pages + ' pages)' : '') + ': <span class="cert-hash">' + esc(c.sha256) + '</span>. Each signer saw and signed this exact document; any change to it gives a different fingerprint.</p></section>' +
      '<section class="doc-sec"><h2>History</h2><table class="cert-table cert-log"><tbody>' + log + '</tbody></table></section>' +
      '<p class="doc-law">Each signer agreed to sign electronically before signing, under the U.S. Electronic Signatures in Global and National Commerce Act (15 U.S.C. §7001) and the Colorado Uniform Electronic Transactions Act (C.R.S. 24-71.3). ' +
      'Times are recorded by Fremont Makers\' server. Signed in the Fremont Makers Project Builder.</p>' +
      '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · 719 Main Street, Cañon City, CO 81212</span><span class="pg">Certificate of completion</span></footer></article>';
  }

  return { VERSION: VERSION, SETTINGS: SETTINGS, CONSENT: CONSENT, CONSENT_LABEL: CONSENT_LABEL, AGREE_LABEL: AGREE_LABEL, OUTSIDE: OUTSIDE, ROLES: ROLES,
           create: create, status: status, check: check, open: open, sign: sign, decline: decline, cancel: cancel,
           reminderDue: reminderDue, remind: remind, jobState: jobState, link: link, email: email, nextSigner: nextSigner,
           markSentOutside: markSentOutside, recordOutside: recordOutside, certificate: certificate, renderCertificate: renderCertificate, when: when, browser: browser };
}));
