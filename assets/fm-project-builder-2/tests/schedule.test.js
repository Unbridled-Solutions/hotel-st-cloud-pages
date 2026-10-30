/*
 * Changing the payment schedule after signing. Run with:   node tests/schedule.test.js
 * Uses the real Penrose job (invoices 1 and 2 paid, invoice 3 open) and Willow Creek (change order invoice).
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var SC = isNode ? require('../src/fm-phase2-schedule.js') : globalThis.FMSchedule;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;
var SAMPLE = isNode ? require('../preview/sample-data.js') : globalThis.FM_SAMPLE;
var W = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;
var B = isNode ? require('../preview/braddy-penrose-order.js') : globalThis.FM_BRADDY_ORDER;

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

var SEED = ST.seed({ sample: SAMPLE, willow: W, braddy: B }), TODAY = '2026-10-27';
function job(code) { return JSON.parse(JSON.stringify(SEED.jobs.filter(function (j) { return j.jobCode === code; })[0])); }
var FULL = { name: 'Linds', access: 'full' }, COORD = { name: 'Sam', access: 'coordinator' }, ASK = { askedBy: 'customer', askedName: 'Bernard Braddy', reason: 'Delivery moved' };

test('change-order invoices stay out of the schedule', function () {
  eq(SC.draftFrom(job('FM-2609-276')).map(function (r) { return r.label; }), ['Invoice 1 · 50% at order', 'Invoice 2 · 50% at delivery']);
});

test('a date-only change applies for anyone, and is logged with who asked and why', function () {
  var j = job('FM-2609-314'), d = SC.draftFrom(j); d[2].dueDate = '2026-11-20';
  var r = SC.apply(j, d, COORD, ASK, { today: TODAY });
  ok(r.ok, (r.errors || []).join(' '));
  eq(r.job.invoices[2].dueDate, '2026-11-20');
  ok(/Invoice 3 · 20% due Nov 9 → Nov 20/.test(r.log), r.log);
  eq(r.job.scheduleRevisions.length, 1);
});

test('paid invoices are locked; the total must not change; dates stay in order', function () {
  var j = job('FM-2609-314'), d = SC.draftFrom(j); d[0].dueDate = '2026-10-30';
  ok(/has a payment recorded/.test(SC.check(j, d, { today: TODAY }).errors[0]));
  d = SC.draftFrom(j); d[2].amountCents -= 100;
  ok(/\$1\.00 short/.test(SC.check(j, d, { today: TODAY }).errors.join(' ')));
  d = SC.draftFrom(j); d[2].dueDate = '2026-09-01';
  var e = SC.check(j, d, { today: TODAY }).errors.join(' ');
  ok(/already past/.test(e) && /date order/.test(e), e);
});

test('moving money or splitting needs Full access; a split adds a named invoice and keeps the total', function () {
  var j = job('FM-2609-314'), d = SC.split(SC.draftFrom(j), 2, 'Final · after punch list');
  d[3].dueDate = '2026-11-30';
  eq(d.map(function (r) { return r.amountCents; }).slice(2), [112187, 112187]);
  var r = SC.apply(j, d, COORD, ASK, { today: TODAY });
  eq([r.ok, r.needsApproval], [false, true]);
  r = SC.apply(j, d, FULL, ASK, { today: TODAY });
  ok(r.ok, (r.errors || []).join(' '));
  eq(r.job.invoices.map(function (i) { return [i.id, i.label, i.amountCents]; }).slice(2), [['FM-2609-314-inv3', 'Invoice 3 · 10.2%', 112187], ['FM-2609-314-inv4', 'Final · after punch list', 112187]]);
  ok(/New: Final · after punch list \$1,121\.87 due Nov 30/.test(r.log), r.log);
});

test('a reason and who asked are required; nothing changed is an error', function () {
  var j = job('FM-2609-314'), d = SC.draftFrom(j);
  eq(SC.check(j, d, { today: TODAY }).errors, ['Nothing changed.']);
  d[2].dueDate = '2026-11-12';
  eq(SC.apply(j, d, FULL, { askedName: 'Bernard' }, { today: TODAY }).errors, ['Say why the schedule is changing.']);
  eq(SC.apply(j, d, FULL, { reason: 'x' }, { today: TODAY }).errors, ['Say who asked for the change.']);
});

test('Willow Creek: the change order invoice is kept as it is when the schedule changes', function () {
  var j = job('FM-2609-276'), d = SC.draftFrom(j); d[1].dueDate = '2026-11-24';
  var r = SC.apply(j, d, FULL, { askedBy: 'us', askedName: 'Linds', reason: 'Factory delay' }, { today: TODAY });
  ok(r.ok, (r.errors || []).join(' '));
  eq(r.job.invoices.map(function (i) { return [i.label, i.dueDate]; }), [['Invoice 1 · 50% at order', '2026-10-01'], ['Invoice 2 · 50% at delivery', '2026-11-24'], ['Change order 1 invoice', '2026-10-26']]);
});

console.log('schedule.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
