/*
 * Phase 2 contract + e-signature tests. Run with:   node tests/contract.test.js
 * The "blank job" is the one issued in the 1:47 PM recording (FM-2610-604).
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var K = isNode ? require('../src/fm-phase2-contract.js') : globalThis.FMContract;

var results = [], failed = 0;
function test(name, fn) {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, msg) {
  var sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function ids(list) { return list.map(function (x) { return x.id; }); }

var TODAY = '2026-10-27';
var FMS = { name: 'Fremont Makers signer', email: 'office@example.com' };   // company signer to be named by the owner
function penrose() {
  return { jobCode: 'FM-2609-314', status: 'proposed', customer: 'Braddy Builders', signer: 'Bernard Braddy',
    fmSigner: { name: 'Linds', email: 'linds@example.com' },
    buyerEmail: 'bernard@example.com', project: 'Penrose', installAddress: '1410 Penrose Ave, Cañon City CO',
    installDate: '2026-11-09', totalCents: 1097311, lineCount: 18, paymentPlan: [50, 30, 20],
    dueDates: K.defaultDueDates(TODAY, '2026-11-09', [50, 30, 20]), quoteProblems: 0 };
}
// What the 1:47 PM recording issued: empty quote, placeholders, install typed as 2028.
var BLANK = { jobCode: 'FM-2610-604', status: 'proposed', customer: '', signer: '', buyerEmail: 'lwyss@unbridled.com',
  project: '', installAddress: '123 Main St, Canon City CO', installDate: '2028-11-02', totalCents: 0, lineCount: 0,
  paymentPlan: [50, 30, 20], dueDates: ['2028-08-04', '2028-09-18', '2028-11-02'], quoteProblems: 0 };

test('a complete Penrose job is ready to contract', function () {
  var r = K.readiness(penrose(), { today: TODAY });
  eq(r.ready, true); eq(r.blockers, []); eq(r.warnings, []);
});

test('the blank job from the recording is blocked, with a reason for each gap', function () {
  var r = K.readiness(BLANK, { today: TODAY });
  eq(r.ready, false);
  eq(ids(r.blockers), ['customer', 'signer', 'project', 'fmSigner', 'installAddress', 'lines', 'total']);
  eq(ids(r.warnings), ['installFar']);   // the deposit is due on signing, so its stored date raises nothing
});

test('placeholders and bad emails count as missing', function () {
  var j = penrose(); j.signer = 'Person who will sign'; j.buyerEmail = 'bernard@';
  eq(ids(K.readiness(j, { today: TODAY }).blockers), ['signer', 'buyerEmail']);
});

test('quote arithmetic problems block the contract', function () {
  var j = penrose(); j.quoteProblems = 8;
  var r = K.readiness(j, { today: TODAY });
  eq(ids(r.blockers), ['quoteMath']); ok(/8 arithmetic problems/.test(r.blockers[0].message));
});

test('only a Proposed job can be contracted', function () {
  var j = penrose(); j.status = 'contracted';
  eq(ids(K.readiness(j, { today: TODAY }).blockers), ['status']);
});

test('plan must add to 100%, and dates must be present, in order and not past (deposit is due on signing)', function () {
  var j = penrose(); j.paymentPlan = [50, 30, 10]; j.dueDates = ['2026-10-27', '2026-11-03', '2026-11-09'];
  eq(ids(K.readiness(j, { today: TODAY }).blockers), ['plan']);
  j = penrose(); j.dueDates = ['2026-10-27', '2026-11-12', '2026-11-09'];
  eq(ids(K.readiness(j, { today: TODAY }).blockers), ['dueOrder']);
  j = penrose(); j.dueDates = ['2026-08-11', '2026-09-25', '2026-11-09'];  // today's "90 days back from install"
  eq(ids(K.readiness(j, { today: TODAY }).blockers), ['duePast']);
  ok(/Invoice 2 is due Sep 25, 2026/.test(K.readiness(j, { today: TODAY }).blockers[0].message));
  j = penrose(); j.dueDates = ['2026-10-20', '2026-11-03', '2026-11-09'];  // quote made a week ago: the deposit date is stale
  eq(ids(K.readiness(j, { today: TODAY }).blockers), [], 'a stale deposit date never blocks: the deposit is due on signing');
  j = penrose(); j.installDate = '2026-10-01';
  ok(ids(K.readiness(j, { today: TODAY }).blockers).indexOf('installDate') >= 0);
});

test('default due dates: deposit today, last at install, middle between', function () {
  eq(K.defaultDueDates(TODAY, '2026-11-09', [50, 30, 20]), ['2026-10-27', '2026-11-03', '2026-11-09']);
  eq(K.defaultDueDates(TODAY, '2026-12-26', [50, 50]), ['2026-10-27', '2026-12-26']);
  eq(K.defaultDueDates(TODAY, '', [50, 30, 20]), ['2026-10-27', '2026-10-27', '2026-10-27']);
});

test('invoice amounts add up exactly to the contract total', function () {
  var a = K.invoiceAmounts(1097311, [50, 30, 20]);
  eq(a, [548656, 329193, 219462]); eq(a[0] + a[1] + a[2], 1097311);
});

test('email mode: signature_request/send, buyer then Fremont Makers, text tags on', function () {
  var r = K.signatureRequest(penrose(), { mode: 'email', countersigner: { name: 'Linds', email: 'office@example.com' } });
  eq(r.url, 'https://api.hellosign.com/v3/signature_request/send');
  eq(r.body.signers.map(function (s) { return [s.name, s.order]; }), [['Bernard Braddy', 0], ['Linds', 1]]);
  eq([r.body.use_text_tags, r.body.hide_text_tags, r.body.test_mode], [true, true, false]);
  eq(r.body.metadata.fm_job_code, 'FM-2609-314'); eq(r.body.client_id, undefined);
});

test('in-person mode: create_embedded with client_id, then a sign_url per signer', function () {
  var r = K.signatureRequest(penrose(), { mode: 'in_person', clientId: 'abc123', testMode: true, countersigner: FMS });
  eq(r.url, 'https://api.hellosign.com/v3/signature_request/create_embedded');
  eq([r.body.client_id, r.body.test_mode], ['abc123', true]); ok(/embedded\/sign_url/.test(r.then));
});

test('review mode: unclaimed draft opened in the frame; needs client_id and requester email', function () {
  var r = K.signatureRequest(penrose(), { mode: 'review', clientId: 'abc123', requesterEmail: 'office@example.com', countersigner: FMS });
  eq(r.url, 'https://api.hellosign.com/v3/unclaimed_draft/create_embedded');
  eq([r.body.type, r.body.requester_email_address, r.body.is_for_embedded_signing], ['request_signature', 'office@example.com', false]);
  var threw = 0; try { K.signatureRequest(penrose(), { mode: 'review', requesterEmail: 'office@example.com', countersigner: FMS }); } catch (e) { threw++; }
  try { K.signatureRequest(penrose(), { mode: 'in_person', countersigner: FMS }); } catch (e) { threw++; }
  eq(threw, 2);
});

test('Fremont Makers countersigns every contract: no company signer, no request', function () {
  var msgs = [];
  [undefined, { name: '', email: 'office@example.com' }, { name: 'Linds', email: 'nope' }].forEach(function (c) {
    var j = penrose(); delete j.fmSigner;
    try { K.signatureRequest(j, { mode: 'email', countersigner: c }); } catch (e) { msgs.push(e.message); }
  });
  eq(msgs.length, 3); ok(/countersigns every contract/.test(msgs[0]));
  var r = K.signatureRequest(penrose(), { mode: 'email', countersigner: FMS });
  eq(r.body.signers.map(function (s) { return s.order; }), [0, 1]);
});

test('the company signer is chosen per job, from the approved list', function () {
  var LIST = [{ name: 'Linds', email: 'linds@example.com' }, { name: 'Sam', email: 'sam@example.com' }];
  var j = penrose(); eq(K.readiness(j, { today: TODAY, authorizedSigners: LIST }).ready, true);
  var r = K.signatureRequest(j, { mode: 'email' });
  eq(r.body.signers.map(function (s) { return [s.name, s.email_address, s.order]; }), [['Bernard Braddy', 'bernard@example.com', 0], ['Linds', 'linds@example.com', 1]]);
  j.fmSigner = { name: 'Sam', email: 'SAM@example.com' };
  eq(K.signatureRequest(j, { mode: 'email' }).body.signers[1].name, 'Sam');
  eq(K.readiness(j, { today: TODAY, authorizedSigners: LIST }).ready, true);
  j.fmSigner = { name: 'Temp', email: 'temp@example.com' };
  var b = K.readiness(j, { today: TODAY, authorizedSigners: LIST }).blockers;
  eq(ids(b), ['fmSigner']); ok(/Temp isn.t on the list/.test(b[0].message));
  delete j.fmSigner; eq(ids(K.readiness(j, { today: TODAY }).blockers), ['fmSigner']);
});

test('frame options never skip domain checks outside test mode', function () {
  eq(K.embeddedOpenOptions({ clientId: 'abc' }), { clientId: 'abc' });
  eq(K.embeddedOpenOptions({ clientId: 'abc', testMode: true, container: '#x' }), { clientId: 'abc', skipDomainVerification: true, testMode: true, container: '#x' });
});

function ev(type, t, signed) {
  return { event: { event_type: type, event_time: String(t) },
    signature_request: { signature_request_id: 'sr1', signatures: (signed || []).map(function (e) { return { signer_email_address: e, status_code: 'signed' }; }) } };
}

test('events move the job: sent → buyer signed → all signed (Contracted) → PDF ready', function () {
  var s = { requestId: 'sr1', state: 'sending', jobStatus: 'proposed' }, r;
  r = K.applyEvent(s, ev('signature_request_sent', 1)); eq(r.state.state, 'out_for_signature'); s = r.state;
  r = K.applyEvent(s, ev('signature_request_viewed', 2)); eq([r.state.state, r.log], ['out_for_signature', 'Buyer opened the contract.']); s = r.state;
  r = K.applyEvent(s, ev('signature_request_signed', 3, ['bernard@example.com'])); eq(r.log, 'Signed by bernard@example.com.'); s = r.state;
  eq([s.state, s.jobStatus], ['buyer_signed', 'proposed']);
  r = K.applyEvent(s, ev('signature_request_all_signed', 4)); s = r.state; eq([s.state, r.jobStatus], ['signed', 'contracted']);
  r = K.applyEvent(s, ev('signature_request_downloadable', 5)); eq(r.state.state, 'signed_pdf_ready');
});

test('duplicate, late and foreign events are ignored', function () {
  var s = { requestId: 'sr1', state: 'signed', jobStatus: 'contracted', seen: ['signature_request_all_signed@4'] };
  eq(K.applyEvent(s, ev('signature_request_all_signed', 4)).ignored, 'duplicate');
  var late = K.applyEvent(s, ev('signature_request_sent', 1)); eq([late.state.state, late.changed], ['signed', false]);
  var other = ev('signature_request_signed', 9); other.signature_request.signature_request_id = 'sr2';
  eq(K.applyEvent(s, other).ignored, 'different request');
});

test('declined unfreezes the quote; a signed contract cannot be declined afterwards', function () {
  var r = K.applyEvent({ requestId: 'sr1', state: 'out_for_signature' }, ev('signature_request_declined', 7));
  eq(r.state.state, 'declined'); eq(K.isQuoteFrozen('declined'), false); eq(K.isQuoteFrozen('out_for_signature'), true);
  r = K.applyEvent({ requestId: 'sr1', state: 'signed', jobStatus: 'contracted' }, ev('signature_request_declined', 8));
  eq([r.state.state, r.jobStatus], ['signed', 'contracted']);
});

test('callback reply text is the one Dropbox Sign requires', function () {
  eq(K.CALLBACK_ACK, 'Hello API Event Received');
});

var SHA = 'a3f1c2d4e5b6978877665544332211009988aabbccddeeff0011223344556677';
function paper(over) {
  var u = { fileName: 'Penrose signed.pdf', bytes: 812345, sha256: SHA, signedDate: '2026-10-27', uploadedBy: 'Linds', buyerSignedAll: true, fmSigned: true };
  for (var k in over) u[k] = over[k]; return u;
}

test('a paper-signed upload makes the job Contracted and becomes a job document', function () {
  var r = K.recordPaperSigned({ state: 'none', jobStatus: 'proposed' }, paper(), { today: TODAY, ready: true, requireCountersign: true });
  eq([r.ok, r.state.state, r.jobStatus, r.cancelRequestId], [true, 'signed_on_paper', 'contracted', null]);
  eq([r.document.source, r.document.sha256, r.document.uploadedBy], ['paper', SHA, 'Linds']);
  ok(/Signed on paper \(dated 2026-10-27\)\. Signed copy uploaded by Linds/.test(r.log), r.log);
  var r2 = K.recordPaperSigned({ state: 'none' }, paper({ fmSignerName: 'Sam' }), { today: TODAY, ready: true });
  ok(/countersigned by Sam\./.test(r2.log), r2.log); eq(r2.document.fmSigner, 'Sam');
  eq(K.isQuoteFrozen('signed_on_paper'), true);
});

test('paper upload while Dropbox Sign is out cancels that request', function () {
  var r = K.recordPaperSigned({ requestId: 'sr1', state: 'out_for_signature', jobStatus: 'proposed' }, paper(), { today: TODAY, ready: true });
  eq([r.ok, r.cancelRequestId], [true, 'sr1']); ok(/Dropbox Sign request canceled/.test(r.log));
});

test('paper upload checks: file, date, uploader, signatures, ready check, already signed', function () {
  var bad = K.recordPaperSigned({ state: 'none' }, paper({ fileName: 'contract.docx', bytes: 0, sha256: '', signedDate: '2026-11-01',
    uploadedBy: '', buyerSignedAll: false, fmSigned: false }), { today: TODAY, ready: false, requireCountersign: true });
  eq(bad.ok, false); eq(bad.errors.length, 8); eq(bad.jobStatus, 'proposed');
  eq(K.recordPaperSigned({ state: 'signed' }, paper(), { today: TODAY }).errors, ['This contract is already signed.']);
  eq(K.recordPaperSigned({ state: 'none' }, paper({ bytes: 30 * 1024 * 1024 }), { today: TODAY }).errors, ['The file is over 25 MB. Scan it at a lower resolution.']);
  eq(K.recordPaperSigned({ state: 'none' }, paper({ fmSigned: false }), { today: TODAY }).errors, ['Confirm Fremont Makers countersigned.']);   // required by default
});

test('Dropbox Sign events after a paper signing are ignored', function () {
  var r = K.applyEvent({ requestId: 'sr1', state: 'signed_on_paper', jobStatus: 'contracted' }, ev('signature_request_declined', 11));
  eq([r.ignored, r.state.state, r.jobStatus], ['signed on paper', 'signed_on_paper', 'contracted']);
});

console.log('contract.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
