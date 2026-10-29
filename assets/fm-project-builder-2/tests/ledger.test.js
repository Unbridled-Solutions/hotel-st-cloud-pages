/*
 * Phase 1 ledger tests. Run with:   node tests/ledger.test.js
 * No dependencies. Expected values come from the Oct 27, 2026 screen recording.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var SAMPLE = isNode ? require('../preview/sample-data.js') : globalThis.FM_SAMPLE;

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

var TODAY = SAMPLE.today;
var C = FM.toCents;

function freshJobs() { return FM.jobsFromLegacy(SAMPLE.legacyProjects); }
function attachedJobs() {
  var props = FM.detectLegacyChangeOrders(SAMPLE.legacyProjects);
  return FM.attachChangeOrder(freshJobs(), props[0]).jobs;
}
function job(jobs, code) { return jobs.filter(function (j) { return j.jobCode === code; })[0]; }

/* ---------- money ---------- */
test('toCents and fmt round-trip', function () {
  eq(C('$72,147.34'), 7214734);
  eq(C(8740.71), 874071);
  eq(FM.fmt(8088805), '$80,888.05');
  eq(FM.fmt(874071, { sign: true }), '+$8,740.71');
  eq(FM.fmt(-5), '-$0.05');
});

/* ---------- read-only adapter ---------- */
test('adapter never mutates legacy records', function () {
  var before = JSON.stringify(SAMPLE.legacyProjects);
  var jobs = freshJobs();
  FM.detectLegacyChangeOrders(SAMPLE.legacyProjects);
  FM.attachChangeOrder(jobs, FM.detectLegacyChangeOrders(SAMPLE.legacyProjects)[0]);
  FM.applyAction(job(jobs, 'FM-2609-276'), 'order', { date: TODAY });
  eq(JSON.stringify(SAMPLE.legacyProjects), before);
});

test('legacy status maps to stage', function () {
  var jobs = freshJobs();
  eq(job(jobs, 'FM-2609-276').stage, 'deposit_paid');
  eq(job(jobs, 'FM-2609-314').stage, 'deposit_paid');
  eq(job(jobs, 'FM-2609-991').stage, 'lost');
  eq(job(jobs, 'FM-2610-475').stage, 'quote');
});

/* ---------- fix 1 + 2: change orders ---------- */
test('today: CO is a separate Proposed project and pipeline is wrong', function () {
  var t = FM.legacyPipelineTotals(SAMPLE.legacyProjects);
  eq(t.Proposed, 874071);
  eq(t.Contracted, 8312045);
});

test('detects the Willow Creek change order with high confidence', function () {
  var p = FM.detectLegacyChangeOrders(SAMPLE.legacyProjects);
  eq(p.length, 1);
  eq(p[0].legacyJobCode, 'FM-2610-475');
  eq(p[0].parentJobCode, 'FM-2609-276');
  eq(p[0].confidence, 'high');
  eq(p[0].amountCents, 874071);
  eq(p[0].dateConflict, { listed: '2026-10-23', document: '2026-10-26' });
  eq(p[0].suggested.status, 'invoiced');
  eq(p[0].suggested.date, '2026-10-26');
});

test('before attaching, Willow invoices exceed the contract', function () {
  var w = job(freshJobs(), 'FM-2609-276');
  var s = FM.contractSummary(w);
  eq(s.currentCents, 7214734);
  eq(s.invoicedCents, 8088805);
  eq(s.invoicesMatchContract, false);
  ok(FM.jobWarnings(w).some(function (x) { return x.key === 'billing'; }), 'billing warning');
});

test('after attaching, the CO adds to the contract total', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  var s = FM.contractSummary(w);
  eq(s.originalCents, 7214734);
  eq(s.changeOrderCents, 874071);
  eq(s.currentCents, 8088805);   // $80,888.05
  eq(s.paidCents, 3536433);
  eq(s.balanceCents, 4552372);   // $45,523.72
  eq(s.invoicesMatchContract, true);
  eq(w.invoices[2].changeOrderId, w.changeOrders[0].id);
});

test('attached CO record disappears from the job list', function () {
  var jobs = attachedJobs();
  eq(jobs.length, 3);
  ok(!job(jobs, 'FM-2610-475'));
});

test('draft and sent COs do not count; void does not count', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  ['draft', 'sent', 'void'].forEach(function (st) {
    var j = JSON.parse(JSON.stringify(w)); j.changeOrders[0].status = st;
    eq(FM.contractSummary(j).currentCents, 7214734, st);
  });
});

test('pipeline totals after attaching', function () {
  var t = FM.pipelineTotals(attachedJobs(), TODAY);
  eq(t.proposedCents, 0);
  eq(t.contractedCents, 9186116);   // $91,861.16
  eq(t.lostCents, 874471);
  eq(t.outstandingCents, 4776746);  // $47,767.46
  eq(t.overdueCents, 874071);       // CO 1 invoice, due Oct 26
  eq(t.counts, { proposed: 0, contracted: 2, completed: 0, lost: 1 });
});

/* ---------- fix 3: model totals ---------- */
test('model totals come from house totals and add up to the order', function () {
  var w = job(freshJobs(), 'FM-2609-276');
  var m = FM.modelTotals(w.houses);
  eq(m.rows.map(function (r) { return [r.model, r.count, r.totalCents]; }), [
    ['Cimarron Peak', 2, 1430762], ['Mesa Ridge', 2, 1499550], ['Pinyon Crest', 2, 1558396],
    ['San Luis', 2, 1217194], ['Sangre Vista', 2, 1508832]
  ]);
  eq(m.orderTotalCents, w.originalContractCents);
});

test('finds the penny differences in the old packet', function () {
  var w = job(freshJobs(), 'FM-2609-276');
  var packet = SAMPLE.legacyPacketModelTotals.map(function (r) { return { model: r.model, totalCents: C(r.total) }; });
  var d = FM.compareModelTotals(FM.modelTotals(w.houses).rows, packet);
  eq(d.map(function (x) { return [x.model, x.diffCents]; }), [['Cimarron Peak', 1], ['Pinyon Crest', -1], ['San Luis', -1], ['Sangre Vista', 1]]);
});

/* ---------- fix 4: invoice percentages ---------- */
test('invoice shares are measured against the current total (incl. COs)', function () {
  var w = job(attachedJobs(), 'FM-2609-276');   // current total $80,888.05
  var p1 = FM.invoicePercent(w.invoices[0], w), p2 = FM.invoicePercent(w.invoices[1], w), p3 = FM.invoicePercent(w.invoices[2], w);
  eq([p1.actual, p1.basisLabel, p1.stated, p1.mismatch], [43.72, 'current total', 50, true]);
  eq([p2.actual, p2.basisLabel, p2.stated, p2.mismatch], [45.47, 'current total', 50, true]);
  eq([p3.actual, p3.basisLabel, p3.stated, p3.mismatch], [10.81, 'current total', null, false]);
});

test('invoice shares add up to 100% once the CO is attached', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  var total = w.invoices.reduce(function (t, i) { return t + FM.invoicePercent(i, w).actual; }, 0);
  eq(Math.round(total * 100) / 100, 100);
});

test('before attaching, shares exceed 100% (the billing problem shows)', function () {
  var w = job(freshJobs(), 'FM-2609-276');      // current total still $72,147.34
  var shares = w.invoices.map(function (i) { return FM.invoicePercent(i, w).actual; });
  eq(shares, [49.02, 50.98, 12.12]);
});

test('jobs without change orders: current total equals original', function () {
  var b = job(attachedJobs(), 'FM-2609-314');
  eq(b.invoices.map(function (i) { var p = FM.invoicePercent(i, b); return [p.actual, p.mismatch]; }),
    [[48.88, true], [30.67, true], [20.45, true]]);
});

test('a draft CO does not change the basis', function () {
  var w = job(attachedJobs(), 'FM-2609-276'); w.changeOrders[0].status = 'draft';
  eq(FM.invoicePercent(w.invoices[0], w).actual, 49.02);
});

test('invoice states relative to today', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  eq(FM.invoiceState(w.invoices[0], TODAY).key, 'paid');
  eq(FM.invoiceState(w.invoices[1], TODAY).label, 'Due in 24 days');
  eq(FM.invoiceState(w.invoices[2], TODAY).label, '1 day overdue');
});

/* ---------- fix 5: stages and locking ---------- */
test('contracted jobs are locked; quotes are editable', function () {
  var jobs = freshJobs();
  eq(FM.canEditLineItems(job(jobs, 'FM-2609-276')).ok, false);
  eq(FM.canEditLineItems(job(jobs, 'FM-2610-475')).ok, true);
  eq(FM.canEditLineItems(job(jobs, 'FM-2609-991')).ok, false);
});

test('stage moves forward only through actions, with a date', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  eq(FM.availableActions(w).map(function (a) { return a.id; }), ['order']);
  eq(FM.applyAction(w, 'order', {}).error, 'Enter a date.');
  eq(FM.applyAction(w, 'final', { date: TODAY }).ok, false);
  var r = FM.applyAction(w, 'order', { date: TODAY }, 'Linds');
  eq(r.ok, true);
  eq(r.job.stage, 'factory_ordered');
  eq(r.job.history[0], { from: 'deposit_paid', to: 'factory_ordered', date: TODAY, reason: null, by: 'Linds' });
  eq(w.stage, 'deposit_paid', 'original untouched');
});

test('final payment is blocked while a balance is open', function () {
  var w = job(attachedJobs(), 'FM-2609-276');
  w = FM.applyAction(w, 'order', { date: TODAY }).job;
  w = FM.applyAction(w, 'deliver', { date: '2026-11-20' }).job;
  var a = FM.availableActions(w)[0];
  eq(a.blockedReason, 'Balance of $45,523.72 is still open.');
  eq(FM.applyAction(w, 'final', { date: '2026-11-20' }).ok, false);
});

test('contract cannot be voided once payments exist; lost needs a reason to reopen', function () {
  var w = job(freshJobs(), 'FM-2609-276'); w.stage = 'contract_signed';
  ok(/Payments are recorded/.test(FM.applyAction(w, 'void', { reason: 'x' }).error));
  var lost = job(freshJobs(), 'FM-2609-991');
  eq(FM.applyAction(lost, 'reopen', {}).error, 'Enter a reason.');
  eq(FM.applyAction(lost, 'reopen', { reason: 'Customer came back' }).job.stage, 'quote');
});

test('data warnings on Willow Creek', function () {
  var keys = FM.jobWarnings(job(attachedJobs(), 'FM-2609-276')).map(function (w) { return w.key; });
  eq(keys, ['address', 'email']);
  var b = FM.jobWarnings(job(attachedJobs(), 'FM-2609-314')).map(function (w) { return w.key; });
  eq(b, ['email', 'ref-FM-2609-314-inv1']);
});

/* ---------- report ---------- */
var summary = 'Phase 1 ledger · ' + FM.VERSION + '\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
