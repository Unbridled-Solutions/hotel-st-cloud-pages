/*
 * Signing in the tool (FMSign). Run with:   node tests/sign.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var S = isNode ? require('../src/fm-phase2-sign.js') : globalThis.FMSign;

var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

var HASH = 'a'.repeat(64), T1 = 'b1'.repeat(20), T2 = 'c2'.repeat(20);
var DOC = { kind: 'contract', title: 'Contract packet · FM-2611-401', sha256: HASH, pages: 9 };
var OPTS = { jobCode: 'FM-2611-401', buyer: { name: 'Dana Ortiz', email: 'dana@example.com' }, fremont: { name: 'Kristy Slaughenhaupt', email: 'kristy@example.com' },
             tokens: [T1, T2], today: '2026-11-06', at: '2026-11-06T16:00:00Z', by: 'Linds' };
var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
function ctx(at, extra) { return Object.assign({ at: at, today: at.slice(0, 10), ip: '203.0.113.7', userAgent: UA, sha256: HASH }, extra || {}); }
function sent() { return S.create(DOC, OPTS).request; }
function buyerSigned() { return S.sign(sent(), T1, { consent: true, agree: true, typedName: 'dana ortiz' }, ctx('2026-11-07T15:30:00Z')).request; }

test('a request has the buyer first, then Fremont Makers, a 30-day expiry and a sent event', function () {
  var r = S.create(DOC, OPTS);
  eq(r.ok, true, r.problems.join(' '));
  eq(r.request.signers.map(function (s) { return [s.role, s.order, s.status]; }), [['buyer', 1, 'waiting'], ['fremont', 2, 'waiting']]);
  eq([r.request.status, r.request.expiresOn, r.request.events[0].type], ['out', '2026-12-06', 'sent']);
});

test('a request needs a fingerprint, emails, a Fremont Makers signer and two different links', function () {
  var r = S.create({ kind: 'contract', sha256: 'x' }, { buyer: { name: 'A' }, fremont: { name: 'K' }, tokens: ['short', 'short'], today: '2026-11-06', by: 'L' });
  eq(r.ok, false);
  ok(r.problems.some(function (p) { return /fingerprint/.test(p); }));
  ok(r.problems.some(function (p) { return /buyer's email/.test(p); }));
  ok(r.problems.some(function (p) { return /K needs an email/.test(p); }));
  ok(r.problems.some(function (p) { return /links weren't made/.test(p); }));
  ok(r.problems.some(function (p) { return /own link/.test(p); }));
});

test('Fremont Makers can\'t sign before the buyer', function () {
  var c = S.check(sent(), T2, '2026-11-06');
  eq([c.ok, c.stage], [false, 'wait']);
  ok(/Waiting for Dana Ortiz/.test(c.error));
});

test('signing needs consent, the signer\'s own name and the agree box; name match ignores case and punctuation', function () {
  var bad = S.sign(sent(), T1, { typedName: 'Dan Ortiz' }, ctx('2026-11-07T15:30:00Z'));
  eq(bad.ok, false);
  eq(bad.problems.length, 3);
  ok(/as it appears on the document: Dana Ortiz/.test(bad.problems[1]));
  var good = S.sign(sent(), T1, { consent: true, agree: true, typedName: ' DANA  ortiz. ' }, ctx('2026-11-07T15:30:00Z'));
  eq(good.ok, true, (good.problems || []).join(' '));
});

test('the buyer signs: IP, browser, time and method are recorded and Fremont Makers is next', function () {
  var r = S.sign(sent(), T1, { consent: true, agree: true, typedName: 'Dana Ortiz' }, ctx('2026-11-07T15:30:00Z'));
  var b = r.request.signers[0];
  eq([b.status, b.signedAt, b.ip, b.method, r.completed, r.next.name], ['signed', '2026-11-07T15:30:00Z', '203.0.113.7', 'typed', false, 'Kristy Slaughenhaupt']);
  eq(r.request.events.map(function (e) { return e.type; }), ['sent', 'viewed', 'consented', 'signed']);
  eq(S.jobState(r.request, '2026-11-07').state, 'buyer_signed');
  eq(S.browser(UA), 'Safari on iPhone');
});

test('a changed document can\'t be signed', function () {
  var r = S.sign(sent(), T1, { consent: true, agree: true, typedName: 'Dana Ortiz' }, ctx('2026-11-07T15:30:00Z', { sha256: 'f'.repeat(64) }));
  eq(r.ok, false);
  ok(/changed after it was sent/.test(r.problems[0]));
});

test('countersigning completes it; the job state is signed and contracted', function () {
  var r = S.sign(buyerSigned(), T2, { consent: true, agree: true, typedName: 'Kristy Slaughenhaupt' }, ctx('2026-11-07T18:05:00Z'));
  eq([r.ok, r.completed, r.request.status, r.request.completedAt], [true, true, 'completed', '2026-11-07T18:05:00Z']);
  eq(S.jobState(r.request).state, 'signed');
  eq(S.jobState(r.request).jobStatus, 'contracted');
  eq(S.check(r.request, T1, '2026-11-08').stage, 'done');
});

test('a drawn signature is kept; a broken one is refused', function () {
  var png = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(12);
  var r = S.sign(sent(), T1, { consent: true, agree: true, typedName: 'Dana Ortiz', drawn: png }, ctx('2026-11-07T15:30:00Z'));
  eq([r.ok, r.request.signers[0].method, r.request.signers[0].drawn === png], [true, 'drawn', true]);
  eq(S.sign(sent(), T1, { consent: true, agree: true, typedName: 'Dana Ortiz', drawn: 'data:text/html,x' }, ctx('2026-11-07T15:30:00Z')).ok, false);
});

test('it expires after 30 days; an expired link can\'t be signed and unfreezes pricing', function () {
  var r = sent();
  eq(S.status(r, '2026-12-06'), 'out');
  eq(S.status(r, '2026-12-07'), 'expired');
  eq(S.check(r, T1, '2026-12-07').stage, 'closed');
  eq(S.jobState(r, '2026-12-07').state, 'expired');
});

test('decline needs a reason; cancel needs a reason and closes the links', function () {
  eq(S.decline(sent(), T1, '', ctx('2026-11-07T15:30:00Z')).ok, false);
  var d = S.decline(sent(), T1, 'Hardware isn\'t what we picked', ctx('2026-11-07T15:30:00Z'));
  eq([d.ok, d.request.status, S.jobState(d.request).state], [true, 'declined', 'declined']);
  eq(S.cancel(sent(), 'Linds', '').ok, false);
  var c = S.cancel(sent(), 'Linds', 'Wrong install date; resending', '2026-11-07T10:00:00Z');
  eq([c.ok, S.check(c.request, T1, '2026-11-07').stage], [true, 'closed']);
});

test('reminders fall due on day 3 and day 7, each once, to whoever signs next', function () {
  var r = sent();
  eq(S.reminderDue(r, '2026-11-08'), null);
  var d3 = S.reminderDue(r, '2026-11-09');
  eq([d3.day, d3.signer.name], [3, 'Dana Ortiz']);
  r = S.remind(r, { today: '2026-11-09', by: 'Linds' }).request;
  eq(S.reminderDue(r, '2026-11-10'), null);
  eq(S.reminderDue(r, '2026-11-13').day, 7);
  var late = S.remind(sent(), { today: '2026-11-14', by: 'Linds' }).request;   // missed day 3: one reminder covers both
  eq(late.reminders.map(function (x) { return x.day; }), [3, 7]);
  eq(S.reminderDue(buyerSigned(), '2026-11-09').signer.name, 'Kristy Slaughenhaupt');
});

test('courtesy change orders: the buyer acknowledges and nobody countersigns', function () {
  var r = S.create({ kind: 'change_order', coNumber: 2, sha256: HASH }, Object.assign({}, OPTS, { acknowledgementOnly: true, fremont: null, tokens: [T1] }));
  eq([r.ok, r.request.signers.length, r.request.title], [true, 1, 'Change order 2']);
  var s = S.sign(r.request, T1, { consent: true, agree: true, typedName: 'Dana Ortiz' }, ctx('2026-11-07T15:30:00Z'));
  eq([s.completed, /acknowledged by Dana Ortiz/.test(s.log)], [true, true]);
});

test('the email for the team\'s own mail app carries the link and the expiry date', function () {
  var r = sent(), e = S.email(r, r.signers[0], S.link('https://tools.fremontmakers.com/projectbuilder/', T1), 'request', 'Linds, Fremont Makers');
  ok(/^mailto:dana%40example\.com\?subject=/.test(e.mailto), e.mailto);
  ok(e.body.indexOf('https://tools.fremontmakers.com/projectbuilder/sign/' + T1) > 0);
  ok(/December 6, 2026/.test(e.body));
});

test('the certificate lists each signer with time, IP, browser, method and the fingerprint', function () {
  var done = S.sign(buyerSigned(), T2, { consent: true, agree: true, typedName: 'Kristy Slaughenhaupt' }, ctx('2026-11-07T18:05:00Z')).request;
  var c = S.certificate(done);
  eq(c.signers.map(function (s) { return [s.name, s.ip, s.method, s.browser]; }), [['Dana Ortiz', '203.0.113.7', 'typed', 'Safari on iPhone'], ['Kristy Slaughenhaupt', '203.0.113.7', 'typed', 'Safari on iPhone']]);
  var html = S.renderCertificate(done, { timeZone: 'UTC' });
  ok(html.indexOf(HASH) > 0 && /certificate of completion/i.test(html) && /Colorado Uniform Electronic Transactions Act/.test(html));
  ok(html.indexOf('<script') < 0);
});

test('signing outside the tool: mark it sent, then upload the signed copy', function () {
  var m = S.markSentOutside({ state: 'none' }, { method: 'dropbox_web', sentOn: '2026-11-06', by: 'Linds' });
  eq([m.ok, m.state.state, m.state.provider], [true, 'out_for_signature', 'outside']);
  var bad = S.recordOutside(m.state, { method: 'dropbox_web', signedOn: '2026-11-20', file: { name: 'x.docx', bytes: 10 } }, { today: '2026-11-08' });
  eq(bad.ok, false);
  ok(bad.problems.length >= 4, bad.problems.join(' | '));
  var r = S.recordOutside(m.state, { method: 'dropbox_web', signedOn: '2026-11-08', file: { name: 'Ortiz signed.pdf', bytes: 400000, sha256: HASH }, buyerSignedAll: true, fmSigned: true, fmSignerName: 'Kristy Slaughenhaupt', by: 'Linds' }, { today: '2026-11-08' });
  eq([r.ok, r.state.state, r.document.kind, r.document.title], [true, 'signed_outside', 'contract', 'Signed copy (Dropbox Sign website)']);
  eq(S.recordOutside({ state: 'none' }, { method: 'paper', signedOn: '2026-11-08', file: { name: 'scan.jpg', bytes: 9, sha256: HASH }, buyerSignedAll: true, fmSigned: true, by: 'L' }, {}).state.state, 'signed_on_paper');
});

console.log('sign.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
