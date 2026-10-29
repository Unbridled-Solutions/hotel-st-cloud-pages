/*
 * Phase 1.1 activity + audit tests. Run with:   node tests/activity.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var ACT = isNode ? require('../src/fm-phase1-activity.js') : globalThis.FMActivity;
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

var OWNER = { id: 'u-linds', name: 'Linds', role: 'owner' };
var STAFF = { id: 'u-shop', name: 'Shop lead', role: 'staff' };
var AT = '2026-10-27T16:00:00Z';

function willow() {
  var jobs = FM.jobsFromLegacy(SAMPLE.legacyProjects);
  jobs = FM.attachChangeOrder(jobs, FM.detectLegacyChangeOrders(SAMPLE.legacyProjects)[0]).jobs;
  return jobs.filter(function (j) { return j.jobCode === 'FM-2609-276'; })[0];
}

/* ---------- who / when / append-only ---------- */
test('every entry needs who and when', function () {
  eq(ACT.addNote([], 'FM-2609-276', { text: 'hi' }, null, AT).error, 'Every entry needs the employee who made it.');
  eq(ACT.addNote([], 'FM-2609-276', { text: 'hi' }, OWNER, '').error, 'Every entry needs a server timestamp.');
  eq(ACT.addNote([], 'FM-2609-276', { text: '  ' }, OWNER, AT).error, 'Write a note first.');
});

test('append never changes the existing log', function () {
  var log0 = [];
  var r1 = ACT.addNote(log0, 'FM-2609-276', { text: 'First' }, OWNER, AT);
  var r2 = ACT.addNote(r1.log, 'FM-2609-276', { text: 'Second' }, STAFF, AT);
  eq(log0.length, 0); eq(r1.log.length, 1); eq(r2.log.length, 2);
  eq(r2.log.map(function (e) { return e.id; }), ['act-00001', 'act-00002']);
  eq(r2.log[1].actor, { id: 'u-shop', name: 'Shop lead', role: 'staff' });
});

test('hash chain verifies and catches tampering', function () {
  var log = ACT.addNote([], 'FM-2609-276', { text: 'Deposit check in safe' }, OWNER, AT).log;
  log = ACT.addNote(log, 'FM-2609-276', { text: 'Called builder' }, STAFF, AT).log;
  log = ACT.addNote(log, 'FM-2609-276', { text: 'Ordered hardware' }, STAFF, AT).log;
  eq(ACT.verify(log).ok, true);
  var tampered = JSON.parse(JSON.stringify(log)); tampered[1].summary = 'Never called';
  eq(ACT.verify(tampered), { ok: false, count: 3, brokenAt: 1, brokenId: 'act-00002' });
  var dropped = [log[0], log[2]];
  eq(ACT.verify(dropped).brokenAt, 1, 'deleted entry breaks the chain');
});

test('corrections add an entry and keep the original', function () {
  var log = ACT.addNote([], 'FM-2609-276', { text: 'Deliver to lot 14', pinned: true }, STAFF, AT).log;
  eq(ACT.correct(log, 'act-00001', { summary: 'Deliver to lot 41' }, '', OWNER, AT).error, 'Say why it’s being corrected.');
  log = ACT.correct(log, 'act-00001', { summary: 'Deliver to lot 41' }, 'Typo in lot number', OWNER, AT).log;
  eq(log.length, 2);
  eq(log[0].summary, 'Deliver to lot 14', 'original untouched');
  var t = ACT.timeline(log, 'FM-2609-276');
  eq(t.items.length, 1);
  eq([t.items[0].summary, t.items[0].original, t.items[0].corrections.length], ['Deliver to lot 41', 'Deliver to lot 14', 1]);
  eq(t.pinned.length, 1);
  log = ACT.correct(log, 'act-00001', { pinned: false }, 'No longer needed up top', OWNER, AT).log;
  eq(ACT.timeline(log, 'FM-2609-276').pinned.length, 0, 'unpin is a correction too');
});

/* ---------- factory delay ---------- */
test('factory delay moves delivery and suggests moving Invoice 2', function () {
  var w = willow();
  var r = ACT.recordFactoryDelay(w, [], { vendor: 'Wholesale Cabinets', originalShipDate: '2026-11-14', newShipDate: '2026-12-02', reason: 'Moss Green backordered', customerNotified: true }, STAFF, AT);
  eq(r.ok, true);
  eq(r.job.deliveryDate, '2026-12-08');
  eq(w.deliveryDate, '2026-11-20', 'input job untouched');
  eq(r.entries.map(function (e) { return e.type; }), ['factory_delay', 'delivery_date_changed']);
  eq(r.entries[1].data.causeId, r.entries[0].id);
  eq(r.entries[1].before, { deliveryDate: '2026-11-20' });
  eq(r.suggestions, [{ invoiceId: 'FM-2609-276-inv2', label: 'Invoice 2 · 50% at delivery', from: '2026-11-20', to: '2026-12-08' }]);
  eq(ACT.isDelayed(r.job), true);
  var s = ACT.recordShipped(r.job, r.log, { vendor: 'Wholesale Cabinets', shipDate: '2026-12-02', tracking: 'PRO 55120' }, STAFF, AT);
  eq(ACT.isDelayed(s.job), false);
  eq(ACT.verify(s.log).ok, true);
});

test('factory delay checks its inputs', function () {
  var w = willow();
  eq(ACT.recordFactoryDelay(w, [], { vendor: 'X', originalShipDate: '2026-11-14', newShipDate: '2026-11-10', reason: 'r' }, STAFF, AT).error, 'The new ship date must be after the original one.');
  eq(ACT.recordFactoryDelay(w, [], { vendor: 'X', originalShipDate: '2026-11-14', newShipDate: '2026-11-20' }, STAFF, AT).error, 'Enter the reason for the delay.');
});

/* ---------- payment schedule ---------- */
test('date-only change applies at once and is logged', function () {
  var w = willow();
  var r = ACT.proposeScheduleChange(w, [], {
    changes: [{ invoiceId: 'FM-2609-276-inv2', dueDate: '2026-12-08' }],
    requestedBy: { kind: 'customer', name: 'Willow Creek Estates' }, reason: 'Delivery moved after factory delay'
  }, STAFF, AT);
  eq(r.status, 'applied');
  eq(r.job.invoices[1].dueDate, '2026-12-08');
  eq(r.log.map(function (e) { return e.type; }), ['schedule_change_requested', 'schedule_change_applied']);
  eq(r.log[1].before[1].dueDate, '2026-11-20');
  eq(r.log[1].after[1].dueDate, '2026-12-08');
  ok(/Invoice 2 due Nov 20 → Dec 8/.test(r.log[0].summary), r.log[0].summary);
});

test('moving money waits for an owner', function () {
  var w = willow();
  var r = ACT.proposeScheduleChange(w, [], {
    changes: [{ invoiceId: 'FM-2609-276-inv2', amountCents: 3578301 }, { invoiceId: 'FM-2609-276-inv3', amountCents: 974071 }],
    requestedBy: { kind: 'employee', name: 'Shop lead' }, reason: 'Builder wants more paid up front on CO'
  }, STAFF, AT);
  eq(r.status, 'pending');
  eq(r.job.invoices[1].amountCents, 3678301, 'not applied yet');
  eq(ACT.pendingScheduleRequests(r.log, 'FM-2609-276').length, 1);
  eq(ACT.decideScheduleChange(r.job, r.log, r.request.id, 'approve', '', STAFF, AT).error, 'Only an owner can approve or reject changes that move money between invoices.');
  var a = ACT.decideScheduleChange(r.job, r.log, r.request.id, 'approve', 'OK by phone', OWNER, AT);
  eq(a.status, 'applied');
  eq([a.job.invoices[1].amountCents, a.job.invoices[2].amountCents], [3578301, 974071]);
  eq(ACT.pendingScheduleRequests(a.log, 'FM-2609-276').length, 0);
  eq(a.log[1].actor.name, 'Linds');
});

test('rejecting needs a reason and changes nothing', function () {
  var w = willow();
  var r = ACT.proposeScheduleChange(w, [], {
    changes: [{ invoiceId: 'FM-2609-276-inv2', amountCents: 3578301 }, { invoiceId: 'FM-2609-276-inv3', amountCents: 974071 }],
    requestedBy: { kind: 'customer', name: 'Willow Creek Estates' }, reason: 'x'
  }, STAFF, AT);
  eq(ACT.decideScheduleChange(r.job, r.log, r.request.id, 'reject', '', OWNER, AT).error, 'Say why it’s rejected.');
  var d = ACT.decideScheduleChange(r.job, r.log, r.request.id, 'reject', 'Keep 50/50', OWNER, AT);
  eq(d.status, 'rejected');
  eq(d.job.invoices[1].amountCents, 3678301);
  eq(d.log[1].type, 'schedule_change_rejected');
});

test('schedule rules: paid invoices locked, totals must match', function () {
  var w = willow();
  var base = { requestedBy: { kind: 'customer', name: 'W' }, reason: 'r' };
  base.changes = [{ invoiceId: 'FM-2609-276-inv1', dueDate: '2026-10-05' }];
  eq(ACT.proposeScheduleChange(w, [], base, STAFF, AT).error, 'Invoice 1 · 50% at order has a payment recorded and is locked.');
  base.changes = [{ invoiceId: 'FM-2609-276-inv2', amountCents: 3500000 }];
  eq(ACT.proposeScheduleChange(w, [], base, STAFF, AT).error, 'Invoices must add up to the current total of $80,888.05. These add up to $79,105.04.');
  eq(ACT.proposeScheduleChange(w, [], { changes: base.changes, reason: 'r' }, STAFF, AT).error, 'Say who asked for the change.');
});

test('approval re-checks the job as it is now', function () {
  var w = willow();
  var r = ACT.proposeScheduleChange(w, [], {
    changes: [{ invoiceId: 'FM-2609-276-inv2', amountCents: 3578301 }, { invoiceId: 'FM-2609-276-inv3', amountCents: 974071 }],
    requestedBy: { kind: 'customer', name: 'W' }, reason: 'r'
  }, STAFF, AT);
  var paidMeanwhile = JSON.parse(JSON.stringify(r.job));
  paidMeanwhile.invoices[2].payments = [{ amountCents: 874071, date: '2026-10-28', method: 'check', reference: '6001' }];
  var a = ACT.decideScheduleChange(paidMeanwhile, r.log, r.request.id, 'approve', '', OWNER, AT);
  eq(a.error, 'Can’t approve as requested: Change order 1 invoice has a payment recorded and is locked.');
});

/* ---------- system events, timeline, export ---------- */
test('system events: stage change and CO attached', function () {
  var w = willow();
  var moved = FM.applyAction(w, 'order', { date: '2026-10-28' }, 'Linds').job;
  var log = ACT.logStageChange([], w, moved, OWNER, AT).log;
  log = ACT.logChangeOrderAttached(log, w, w.changeOrders[0], OWNER, AT).log;
  eq(log[0].summary, 'Deposit paid → Factory order placed');
  eq(log[0].before, { stage: 'deposit_paid' });
  eq(log[1].summary, 'Change Order 1 attached · +$8,740.71 · contract now $80,888.05');
});

test('timeline is per job, newest first; CSV export has every entry', function () {
  var log = ACT.addNote([], 'FM-2609-276', { text: 'A' }, OWNER, '2026-10-27T15:00:00Z').log;
  log = ACT.addNote(log, 'FM-2609-314', { text: 'Other job' }, OWNER, '2026-10-27T15:30:00Z').log;
  log = ACT.recordCustomerContact(log, 'FM-2609-276', { method: 'Phone', text: 'Builder confirmed lot access' }, STAFF, '2026-10-27T16:00:00Z').log;
  var t = ACT.timeline(log, 'FM-2609-276');
  eq(t.items.map(function (i) { return i.summary; }), ['Phone: Builder confirmed lot access', 'A']);
  var csv = ACT.exportCSV(log, 'FM-2609-276').split('\n');
  eq(csv.length, 3);
  eq(csv[0], '"id","at","job","employee","role","type","summary","before","after","hash"');
  ok(csv[1].indexOf('"Linds","owner","Note","A"') > -1, csv[1]);
});

var summary = 'Phase 1.1 activity · ' + ACT.VERSION + '\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
