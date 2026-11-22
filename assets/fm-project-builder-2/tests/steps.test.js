/* One clear next step and the Today list (FMSteps). Run with:   node tests/steps.test.js */
var isNode = typeof require === 'function' && typeof module === 'object';
var STP = isNode ? require('../src/fm-phase2-steps.js') : globalThis.FMSteps;
var SG = isNode ? require('../src/fm-phase2-sign.js') : globalThis.FMSign;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function base(x) { return Object.assign({ jobCode: 'FM-1', customer: 'Rod', stage: 'quote', contacts: { signer: 'Rod', buyerEmail: 'rod@example.com' }, models: [{ name: 'Kitchen', lines: [] }] }, x || {}); }
function states(r) { return r.steps.map(function (s) { return s.state[0]; }).join(''); }

test('a sketch project: Design is the step, drawing then approval is next up', function () {
  var r = STP.of(base({ designFirst: true }));
  eq([states(r), r.next.text, r.next.tab], ['dnlll', 'Draw the elevations', 'elevations']);
  r = STP.of(base({ designFirst: true, elevations: { rooms: [{}] } }));
  eq(r.next.text, 'Get the customer\'s approval on the design');
});

test('approved design: add SKUs, approve the estimate, then build and send the contract', function () {
  var j = base({ designFirst: true, designApproval: { version: 1 } });
  eq([states(STP.of(j)), STP.of(j).next.text], ['ddnll', 'Add the SKUs and price it']);
  j.models[0].lines = [{ sku: 'B24' }];
  eq(STP.of(j, { estimateStatus: { key: 'none' } }).next.tab, 'estimate');
  eq(STP.of(j, { estimateStatus: { key: 'approved' } }).next.text, 'Build and send the contract');
  j.esign = { state: 'buyer_signed' }; eq(STP.of(j, { estimateStatus: { key: 'approved' } }).next.text, 'Countersign the contract');
});

test('after signing: deposit, factory order, delivery, final payment, close out', function () {
  eq(STP.of(base({ stage: 'contract_signed' })).next.text, 'Collect the deposit');
  eq(STP.of(base({ stage: 'deposit_paid' })).next.action, 'factory');
  eq([states(STP.of(base({ stage: 'delivered' }))), STP.of(base({ stage: 'delivered' })).next.text], ['ddddn', 'Collect the final payment']);
  eq(states(STP.of(base({ stage: 'complete' }))), 'ddddd');
});

test('Today: countersign first, then reminders due, approvals and courtesy change orders', function () {
  var req = SG.create({ kind: 'contract', sha256: 'a'.repeat(64) }, { jobCode: 'FM-1', buyer: { name: 'Rod', email: 'r@x.com' }, fremont: { name: 'Kristy', email: 'k@x.com' }, tokens: ['a'.repeat(40), 'b'.repeat(40)], today: '2026-11-10', by: 'L' }).request;
  var signed = SG.sign(req, 'a'.repeat(40), { consent: true, agree: true, typedName: 'Rod' }, { at: '2026-11-11T10:00:00Z', today: '2026-11-11' }).request;
  var jobs = [base({ jobCode: 'FM-1', esign: { request: signed }, salesperson: 'Lindsay' }), base({ jobCode: 'FM-2', esign: { request: req } }), base({ jobCode: 'FM-3', designFirst: true, elevations: { rooms: [{}] } }), base({ jobCode: 'FM-4', stage: 'deposit_paid', changeOrders: [{ number: 2, status: 'pending approval' }] })];
  var t = STP.today(jobs, SG, '2026-11-14');
  eq(t.map(function (x) { return [x.jobCode, x.kind]; }), [['FM-1', 'countersign'], ['FM-1', 'remind'], ['FM-2', 'remind'], ['FM-3', 'design'], ['FM-4', 'courtesy']]);
});

console.log('steps.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
