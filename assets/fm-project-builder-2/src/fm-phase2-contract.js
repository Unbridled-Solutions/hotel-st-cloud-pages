/*
 * Fremont Makers · Project Builder · Phase 2 · Contract and e-signature (Dropbox Sign, formerly HelloSign)
 * Version 0.4.0-phase2. Pure functions: no DOM, storage, network or API keys.
 * UMD: require() in Node, window.FMContract in a browser.
 *
 * What it does:
 *   readiness()          – may this job be contracted? Blockers stop it, warnings don't.
 *   defaultDueDates()    – invoice due dates: deposit on signing, last payment at install.
 *   invoiceAmounts()     – split the total by the plan so the invoices add up exactly.
 *   signatureRequest()   – the request body the SERVER sends to Dropbox Sign, for each way of signing.
 *   embeddedOpenOptions()– options for hellosign-embedded's open() in the browser.
 *   applyEvent()         – turn a Dropbox Sign callback event into the job's e-sign state + status.
 *   recordPaperSigned()  – a wet-signed copy is uploaded instead; it also makes the job Contracted.
 *
 * The API key never reaches the browser. The server makes every Dropbox Sign call and
 * verifies callbacks (HMAC-SHA256 of event_time + event_type with the API key).
 * See HANDOFF.md §16.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMContract = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.4.0-phase2';
  var API = 'https://api.hellosign.com/v3';
  var CALLBACK_ACK = 'Hello API Event Received';

  /* Text tags printed (hidden) in the contract PDF so Dropbox Sign places fields itself.
     signer1 = buyer, signer2 = Fremont Makers countersignature. */
  var TAGS = {
    buyerSignature: '[sig|req|signer1]', buyerDate: '[date|req|signer1]',
    buyerName: '[text|req|signer1|Printed name|buyer_name]', buyerInitials: '[initial|req|signer1]',
    fmSignature: '[sig|req|signer2]', fmDate: '[date|req|signer2]',
    fmName: '[text|req|signer2|Printed name|fm_name]'
  };

  // Job e-sign states, in order. A later state is never replaced by an earlier one.
  var STATES = ['none', 'sending', 'out_for_signature', 'buyer_signed', 'signed', 'signed_pdf_ready'];
  var STOP_STATES = { declined: 1, canceled: 1, error: 1 };

  function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()); }
  function blank(s) { return s == null || String(s).trim() === ''; }
  function day(iso) { var p = String(iso).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function iso(d) { return new Date(d * 864e5).toISOString().slice(0, 10); }
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

  /* Placeholder text from today's form that sometimes ends up saved as a real value. */
  var PLACEHOLDERS = ['123 main st', 'e.g.', 'person who will sign', 'buyer@email.com', 'for hellosign'];
  function looksPlaceholder(s) {
    var v = String(s || '').toLowerCase();
    return PLACEHOLDERS.some(function (p) { return v.indexOf(p) === 0; });
  }

  /*
   * job.fmSigner: { name, email } – the employee who signs for Fremont Makers on THIS job (owner decision:
   *   chosen job by job from the approved list, opts.authorizedSigners).
   * job: { status, customer, signer, buyerEmail, project, installAddress, installDate,
   *        totalCents, lineCount, paymentPlan:[pct…], dueDates:[iso…], quoteProblems }
   * opts: { today: 'YYYY-MM-DD', farMonths: 12, authorizedSigners: [{ name, email }…] }
   */
  function readiness(job, opts) {
    opts = opts || {}; var today = opts.today; var far = (opts.farMonths || 12) * 30.5;
    var B = [], W = [];
    function block(id, step, msg) { B.push({ id: id, step: step, message: msg }); }
    function warn(id, step, msg) { W.push({ id: id, step: step, message: msg }); }

    if (job.status && job.status !== 'proposed')
      block('status', 'job', 'Only a Proposed job can be contracted (this one is ' + job.status + ').');
    if (blank(job.customer)) block('customer', 'customer', 'Add the customer.');
    if (blank(job.signer) || looksPlaceholder(job.signer)) block('signer', 'customer', 'Add the name of the person who will sign.');
    if (!isEmail(job.buyerEmail) || looksPlaceholder(job.buyerEmail)) block('buyerEmail', 'customer', 'Add the signer\'s email address. Dropbox Sign sends the contract there.');
    if (blank(job.project)) block('project', 'customer', 'Add a project name.');
    var fs = job.fmSigner;
    if (!fs || blank(fs.name) || !isEmail(fs.email)) block('fmSigner', 'contract', 'Choose who signs for Fremont Makers on this job.');
    else if (opts.authorizedSigners && !opts.authorizedSigners.some(function (a) { return String(a.email).toLowerCase() === String(fs.email).toLowerCase(); }))
      block('fmSigner', 'contract', fs.name + ' isn\'t on the list of people who can sign for Fremont Makers.');
    if (blank(job.installAddress) || looksPlaceholder(job.installAddress)) block('installAddress', 'homes', 'Add the install address.');
    if (!(job.lineCount > 0)) block('lines', 'cabinets', 'The quote has no cabinet lines.');
    if (!(job.totalCents > 0)) block('total', 'price', 'The contract total is $0.00.');
    if (job.quoteProblems > 0) block('quoteMath', 'price', 'The quote has ' + job.quoteProblems + ' arithmetic problem' + (job.quoteProblems === 1 ? '' : 's') + '. Reprice it first.');

    var plan = job.paymentPlan || [];
    var sum = plan.reduce(function (a, b) { return a + b; }, 0);
    if (!plan.length || Math.abs(sum - 100) > 1e-9) block('plan', 'price', 'The payment plan adds up to ' + sum + '%, not 100%.');

    if (!isISO(job.installDate)) block('installDate', 'schedule', 'Set the install / delivery date.');
    else if (today) {
      var gap = day(job.installDate) - day(today);
      if (gap < 0) block('installDate', 'schedule', 'The install date ' + job.installDate + ' is in the past.');
      else if (gap > far) warn('installFar', 'schedule', 'Install is ' + Math.round(gap / 30.5) + ' months out (' + job.installDate + '). Check the year.');
    }

    var due = job.dueDates || [];
    if (due.length !== plan.length || due.some(function (d) { return !isISO(d); }))
      block('dueDates', 'schedule', 'Every invoice needs a due date.');
    else {
      for (var i = 1; i < due.length; i++) if (due[i] < due[i - 1]) { block('dueOrder', 'schedule', 'Invoice ' + (i + 1) + ' is due before invoice ' + i + '.'); break; }
      if (today && due[0] < today) block('depositPast', 'schedule', 'The deposit would be due ' + due[0] + ', which is already past.');
      if (today && due[0] > today && day(due[0]) - day(today) > 30)
        warn('depositLate', 'schedule', 'The deposit isn\'t due until ' + due[0] + '. The factory order waits for it.');
      if (isISO(job.installDate) && due[due.length - 1] > job.installDate)
        warn('finalAfterInstall', 'schedule', 'The last invoice is due after install.');
    }
    return { ready: B.length === 0, blockers: B, warnings: W };
  }

  /* Deposit due on signing (today); the last payment at install; the ones between spread evenly. */
  function defaultDueDates(today, installDate, plan) {
    var n = (plan || []).length; if (!n) return [];
    if (!isISO(installDate) || n === 1) { var out = []; for (var k = 0; k < n; k++) out.push(today); if (n > 1 && isISO(installDate)) out[n - 1] = installDate; return out; }
    var a = day(today), b = Math.max(day(installDate), a), r = [];
    for (var i = 0; i < n; i++) r.push(iso(Math.round(a + (b - a) * i / (n - 1))));
    return r;
  }

  /* Split totalCents by plan percentages; the last invoice absorbs rounding so they add up exactly. */
  function invoiceAmounts(totalCents, plan) {
    var out = [], used = 0;
    plan.forEach(function (p, i) {
      var c = i === plan.length - 1 ? totalCents - used : Math.round(totalCents * p / 100);
      used += c; out.push(c);
    });
    return out;
  }

  /*
   * How the contract gets signed:
   *   'email'     – Dropbox Sign emails the buyer. No frame. (signature_request/send)
   *   'review'    – Our employee checks the request in a Dropbox Sign frame and presses Send there.
   *                 (unclaimed_draft/create_embedded → claim_url)
   *   'in_person' – The buyer signs right now in a frame on our screen (office or tablet).
   *                 (signature_request/create_embedded → embedded/sign_url per signer)
   * opts: { mode, clientId, requesterEmail, countersigner:{name,email}, testMode, contractVersion, fileName }
   * Returns { method, url, body, then } – `then` names the follow-up call, if any.
   * The server adds the PDF as `files[0]` (multipart) before sending.
   */
  function signatureRequest(job, opts) {
    opts = opts || {};
    var mode = opts.mode || 'email';
    if (['email', 'review', 'in_person'].indexOf(mode) < 0) throw new Error('Unknown signing mode: ' + mode);
    if ((mode === 'review' || mode === 'in_person') && blank(opts.clientId)) throw new Error('Signing in a frame needs the API app client_id.');
    if (mode === 'review' && !isEmail(opts.requesterEmail)) throw new Error('Review-and-send needs the employee\'s Dropbox Sign email (requester_email_address).');
    var signers = [{ name: job.signer, email_address: String(job.buyerEmail).trim(), order: 0 }];
    // Owner decision 2026-10-27: Fremont Makers countersigns every contract, after the buyer.
    // The company signer is chosen per job (job.fmSigner); opts.countersigner overrides it.
    var cs = opts.countersigner || job.fmSigner;
    if (!cs || blank(cs.name) || !isEmail(cs.email))
      throw new Error('Fremont Makers countersigns every contract. Choose who signs for Fremont Makers on this job first.');
    signers.push({ name: cs.name, email_address: String(cs.email).trim(), order: 1 });

    var body = {
      title: 'Fremont Makers · ' + job.jobCode + ' · ' + job.customer + ' · ' + job.project,
      subject: 'Your Fremont Makers contract: ' + job.project + ' (' + job.jobCode + ')',
      message: 'Please review and sign your cabinet contract for ' + job.project + '. ' +
               'The first invoice is due on signing; the factory order is placed once it is paid.',
      signers: signers,
      use_text_tags: true, hide_text_tags: true,
      metadata: { fm_job_code: job.jobCode, fm_contract_version: String(opts.contractVersion || 1) },
      test_mode: !!opts.testMode
    };
    var r = { method: 'POST', body: body, then: null };
    if (mode === 'email') r.url = API + '/signature_request/send';
    else if (mode === 'in_person') {
      r.url = API + '/signature_request/create_embedded'; body.client_id = opts.clientId;
      r.then = 'GET ' + API + '/embedded/sign_url/{signature_id} for the buyer, when they are ready to sign';
    } else {
      r.url = API + '/unclaimed_draft/create_embedded'; body.client_id = opts.clientId;
      body.type = 'request_signature'; body.requester_email_address = opts.requesterEmail;
      body.is_for_embedded_signing = false; // signers get Dropbox Sign's email once our employee presses Send
      r.then = 'open claim_url in the frame';
    }
    return r;
  }

  /* Options for hellosign-embedded's client.open(url, options). skipDomainVerification
     only works for test-mode requests, so it is never set in production. */
  function embeddedOpenOptions(o) {
    var r = { clientId: o.clientId };
    if (o.testMode) { r.skipDomainVerification = true; r.testMode = true; }
    if (o.container) r.container = o.container;
    return r;
  }

  /*
   * Apply a verified Dropbox Sign callback event.
   * state: { requestId, state, seen:[keys], jobStatus }
   * event: the parsed `json` field: { event:{event_type,event_time}, signature_request:{signature_request_id, signatures:[{signer_email_address,status_code}]} }
   * Returns { state: newState, changed, log: text for the activity log or null, jobStatus }
   */
  function applyEvent(state, payload) {
    var ev = (payload && payload.event) || {};
    var sr = (payload && payload.signature_request) || {};
    var s = { requestId: state.requestId, state: state.state || 'none', seen: (state.seen || []).slice(), jobStatus: state.jobStatus || 'proposed' };
    var key = ev.event_type + '@' + ev.event_time;
    if (!ev.event_type) return { state: s, changed: false, log: null, jobStatus: s.jobStatus };
    if (s.requestId && sr.signature_request_id && sr.signature_request_id !== s.requestId)
      return { state: s, changed: false, log: null, jobStatus: s.jobStatus, ignored: 'different request' };
    if (s.seen.indexOf(key) >= 0) return { state: s, changed: false, log: null, jobStatus: s.jobStatus, ignored: 'duplicate' };
    if (s.state === 'signed_on_paper') return { state: s, changed: false, log: null, jobStatus: s.jobStatus, ignored: 'signed on paper' };
    s.seen.push(key);

    function who() {
      var signed = (sr.signatures || []).filter(function (g) { return g.status_code === 'signed'; });
      return signed.length ? signed[signed.length - 1].signer_email_address : 'a signer';
    }
    function advance(to) {
      if (STOP_STATES[s.state]) return false;
      if (STATES.indexOf(to) > STATES.indexOf(s.state)) { s.state = to; return true; }
      return false;
    }
    var log = null, changed = false;
    switch (ev.event_type) {
      case 'signature_request_sent': changed = advance('out_for_signature'); log = 'Contract sent for signature (Dropbox Sign).'; break;
      case 'signature_request_viewed': log = 'Buyer opened the contract.'; break;
      case 'signature_request_signed': changed = advance('buyer_signed'); log = 'Signed by ' + who() + '.'; break;
      case 'signature_request_all_signed':
        changed = advance('signed'); log = 'All signatures complete. Job is now Contracted.';
        if (s.jobStatus === 'proposed') { s.jobStatus = 'contracted'; changed = true; }
        break;
      case 'signature_request_downloadable': changed = advance('signed_pdf_ready'); log = 'Signed PDF ready; attached to the job\'s documents.'; break;
      case 'signature_request_declined':
        if (s.state !== 'signed' && s.state !== 'signed_pdf_ready') { s.state = 'declined'; changed = true; }
        log = 'Buyer declined to sign. The quote is unlocked for changes.'; break;
      case 'signature_request_canceled':
        if (s.state !== 'signed' && s.state !== 'signed_pdf_ready') { s.state = 'canceled'; changed = true; }
        log = 'Signature request canceled.'; break;
      case 'signature_request_invalid':
        s.state = 'error'; changed = true; log = 'Dropbox Sign could not process the contract PDF (check the signature fields).'; break;
      default: log = null;
    }
    return { state: s, changed: changed, log: log, jobStatus: s.jobStatus };
  }

  /* While a request is out (or signed), pricing is frozen. Declined/canceled/error unfreeze it. */
  function isQuoteFrozen(esignState) {
    return ['sending', 'out_for_signature', 'buyer_signed', 'signed', 'signed_pdf_ready', 'signed_on_paper'].indexOf(esignState) >= 0;
  }

  /*
   * A wet-signed (paper) contract is uploaded instead of, or after, a Dropbox Sign request.
   * esState: the job's e-sign state (as in applyEvent).
   * upload: { fileName, bytes, sha256, signedDate, uploadedBy, buyerSignedAll, fmSigned, fmSignerName }
   * opts:   { today, ready, requireCountersign (default true) (readiness().ready for the contract version printed) }
   * Returns { ok, errors[], state, jobStatus, log, cancelRequestId, document }.
   * If a Dropbox Sign request is still out, the server cancels it (cancelRequestId) so the buyer
   * can't sign twice. The paper copy is stored with its SHA-256 like every other job document.
   */
  var PAPER_TYPES = /\.(pdf|jpe?g|png|heic)$/i, MAX_BYTES = 25 * 1024 * 1024;
  function recordPaperSigned(esState, upload, opts) {
    esState = esState || {}; upload = upload || {}; opts = opts || {};
    var st = esState.state || 'none', errs = [];
    if (st === 'signed' || st === 'signed_pdf_ready' || st === 'signed_on_paper')
      errs.push('This contract is already signed.');
    if (opts.ready === false) errs.push('Fix the ready-check blockers first. The paper copy has to match a complete contract.');
    if (!PAPER_TYPES.test(upload.fileName || '')) errs.push('Upload a PDF or a photo (JPG, PNG or HEIC) of the signed contract.');
    if (!(upload.bytes > 0)) errs.push('The file is empty.');
    else if (upload.bytes > MAX_BYTES) errs.push('The file is over 25 MB. Scan it at a lower resolution.');
    if (!/^[0-9a-f]{64}$/.test(upload.sha256 || '')) errs.push('The file\'s checksum is missing.');
    if (!isISO(upload.signedDate)) errs.push('Enter the date it was signed.');
    else if (opts.today && upload.signedDate > opts.today) errs.push('The signed date can\'t be in the future.');
    if (blank(upload.uploadedBy)) errs.push('Sign in so the upload is recorded under your name.');
    if (!upload.buyerSignedAll) errs.push('Confirm the buyer signed and dated every signature line.');
    // Countersigning is required unless a caller explicitly passes requireCountersign: false (owner decision 2026-10-27).
    if (opts.requireCountersign !== false && !upload.fmSigned) errs.push('Confirm Fremont Makers countersigned.');
    if (errs.length) return { ok: false, errors: errs, state: esState, jobStatus: esState.jobStatus || 'proposed', log: null };

    var out = ['sending', 'out_for_signature', 'buyer_signed'].indexOf(st) >= 0 && esState.requestId ? esState.requestId : null;
    var s = { requestId: esState.requestId || null, state: 'signed_on_paper', seen: (esState.seen || []).slice(), jobStatus: 'contracted' };
    return {
      ok: true, errors: [], state: s, jobStatus: 'contracted', cancelRequestId: out,
      log: 'Signed on paper (dated ' + upload.signedDate + ')' + (upload.fmSignerName ? ', countersigned by ' + upload.fmSignerName : '') + '. Signed copy uploaded by ' + upload.uploadedBy + ': ' +
           upload.fileName + ' (' + upload.sha256.slice(0, 12) + '…).' + (out ? ' Dropbox Sign request canceled.' : '') + ' Job is now Contracted.',
      document: { kind: 'signed-contract', source: 'paper', fileName: upload.fileName, bytes: upload.bytes, sha256: upload.sha256,
                  signedDate: upload.signedDate, uploadedBy: upload.uploadedBy, fmSigner: upload.fmSignerName || null }
    };
  }

  return {
    VERSION: VERSION, recordPaperSigned: recordPaperSigned, API: API, CALLBACK_ACK: CALLBACK_ACK, TAGS: TAGS, STATES: STATES,
    readiness: readiness, defaultDueDates: defaultDueDates, invoiceAmounts: invoiceAmounts,
    signatureRequest: signatureRequest, embeddedOpenOptions: embeddedOpenOptions,
    applyEvent: applyEvent, isQuoteFrozen: isQuoteFrozen, isEmail: isEmail
  };
}));
