/* Emails to the customer (FMEmails). HANDOFF §43. Run with the package runner. */
var isNode = typeof require === 'function' && typeof module === 'object';
if (isNode) { globalThis.FMPhase1 = require('../src/fm-phase1-ledger.js'); }
var EM = isNode ? require('../src/fm-phase2-emails.js') : globalThis.FMEmails;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function job(stage, paid) {
  var inv = [{ id: 'i1', number: 'FM-2611-101-1', label: 'Deposit', role: 'deposit', amountCents: 500000, taxCents: 12000, dueDate: '2026-11-19', status: 'open', payments: [] },
    { id: 'i2', number: 'FM-2611-101-2', label: 'At delivery', role: 'progress', amountCents: 500000, dueDate: '2026-12-14', status: 'open', payments: [] }];
  (paid || []).forEach(function (k) { inv[k].payments.push({ date: '2026-11-18', amountCents: inv[k].amountCents, method: 'check', reference: '101' }); });
  return { jobCode: 'FM-2611-101', customer: 'Rod Stambaugh', projectName: 'Stambaugh kitchen', stage: stage || 'contract_signed', originalContractCents: 1000000,
    contacts: { signer: 'Rod Stambaugh', buyerEmail: 'rod@example.com' }, history: [], changeOrders: [], invoices: inv, deliveryDate: '2026-12-10' };
}

test('every template fills in from a job with nothing left in {braces}', function () {
  var j = job('delivered', [0]); j.changeOrders = [{ number: 1, kind: 'charge', amountCents: 25000, status: 'sent' }];
  var v = EM.varsFor(j, { sender: 'Linds, Fremont Makers', link: 'https://tools.fremontmakers.com/projectbuilder/sign/abc', expires: '2026-12-01', invoices: [j.invoices[1]], payment: j.invoices[0].payments[0], coNumber: 1, warrantyEnd: '2027-11-02', reviewLink: 'https://g.page/r/fm/review' });
  EM.TEMPLATES.forEach(function (t) { var m = EM.compose(t.kind, v); ok(!/\{\w+\}/.test(m.subject + m.body), t.kind + ' left a placeholder: ' + m.subject + ' / ' + m.body); ok(/Rod/.test(m.body), t.kind + ' greets the buyer'); });
  var inv = EM.compose('invoice', v);
  eq(inv.subject, 'Fremont Makers invoice FM-2611-101-2 · Stambaugh kitchen');
  ok(/FM-2611-101-2 · At delivery: \$5,000\.00, due December 14, 2026/.test(inv.body), inv.body);
  ok(/Checks payable to Fremont Makers LLC/.test(inv.body));
  var rc = EM.compose('payment-receipt', v);
  ok(/\$5,000\.00 on November 18, 2026/.test(rc.body) && /Balance to finish: \$5,000\.00/.test(rc.body), rc.body);
  ok(/review/.test(EM.compose('thank-you', v).body) && /November 2, 2027/.test(EM.compose('thank-you', v).body));
  ok(/\$250\.00/.test(EM.compose('change-order', v).body));
});

test('the team\'s saved wording wins; a blank one falls back to the original', function () {
  var v = EM.varsFor(job(), { sender: 'Linds' });
  eq(EM.compose('order-placed', v, { 'order-placed': { subject: 'Ordered! {project}', body: '' } }).subject, 'Ordered! Stambaugh kitchen');
  ok(/placed the factory order/.test(EM.compose('order-placed', v, { 'order-placed': { subject: 'Ordered! {project}', body: '' } }).body));
  eq(EM.template('order-placed', { 'order-placed': { subject: '  ', body: '' } }).edited, false);
  eq(EM.compose('order-placed', v, { 'order-placed': { subject: 'Hi {nope}', body: 'x' } }).subject, 'Hi {nope}', 'a typo shows rather than vanishing');
});

test('suggestions follow the job: contract out → sign; signed → thank-you + invoice; ordered; delivered; paid → thank you', function () {
  var sign = { nextSigner: function (r) { return r.signers[0]; }, reminderDue: function () { return null; } };
  var q = job('quote'); q.esign = { request: { status: 'out', signers: [{ role: 'buyer', name: 'Rod Stambaugh' }] } };
  eq(EM.suggest(q, { sign: sign, today: '2026-11-19' }).map(function (s) { return s.kind; }), ['contract-sign']);
  sign.reminderDue = function () { return { day: 3 }; };
  eq(EM.suggest(q, { sign: sign, today: '2026-11-19' })[0].kind, 'sign-reminder');
  var cs = EM.suggest(job('contract_signed'), { today: '2026-11-19' }).map(function (s) { return s.kind; });
  eq(cs, ['contract-signed', 'invoice']);
  eq(EM.suggest(job('contract_signed'), { today: '2026-11-19', ready: [] }).map(function (s) { return s.kind; }), ['contract-signed'], 'uses the ready list when given');
  eq(EM.suggest(job('factory_ordered', [0]), { today: '2026-11-19' }).map(function (s) { return s.kind; }), ['order-placed', 'payment-receipt']);
  eq(EM.suggest(job('delivered', [0]), { today: '2026-12-14' }).map(function (s) { return s.kind; }), ['invoice', 'delivered', 'payment-receipt']);
  eq(EM.suggest(job('complete', [0, 1]), { today: '2026-12-20' }).map(function (s) { return s.kind; }), ['payment-receipt', 'thank-you']);
  var lost = job('lost'); eq(EM.suggest(lost, {}), []);
  var d = job('quote'); d.designFirst = true; d.elevations = { rooms: [{ name: 'Kitchen' }] };
  eq(EM.suggest(d, {})[0].kind, 'design-approve');
});

test('writing an email never changes the job', function () {
  var j = job('delivered', [0]), before = JSON.stringify(j);
  EM.TEMPLATES.forEach(function (t) { EM.compose(t.kind, EM.varsFor(j, { invoices: j.invoices })); });
  EM.suggest(j, { today: '2026-12-14' });
  eq(JSON.stringify(j), before);
});

test('a template the team types is checked: fill-ins must be ones that email knows', function () {
  eq(EM.check('invoice', { subject: 'Invoice {invoiceNumbers}', body: 'Hi {first}, {invoiceList}' }).ok, true);
  eq(EM.check('invoice', { subject: 'Invoice {invoiceNumber}', body: '' }).problems, ['{invoiceNumber} isn\'t a fill-in for this email.']);
  eq(EM.check('nope', {}).ok, false);
  eq(EM.mailto('a@b.co', { subject: 'Hi & bye', body: 'L1\nL2' }), 'mailto:a%40b.co?subject=Hi%20%26%20bye&body=L1%0AL2');
});

console.log('emails.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
