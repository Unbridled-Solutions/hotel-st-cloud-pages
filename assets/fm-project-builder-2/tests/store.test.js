/*
 * Phase 2 store tests, on the real sample jobs. Run with:   node tests/store.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;
var BK = isNode ? require('../src/fm-phase2-books.js') : globalThis.FMBooks;
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

var SEED = ST.seed({ sample: SAMPLE, willow: W, braddy: B });
function fresh() { return ST.create({ seed: SEED }); }

test('seed: the Willow Creek change order is attached, not a separate project', function () {
  var s = fresh();
  eq(s.jobs().map(function (j) { return j.jobCode; }), ['FM-2609-276', 'FM-2609-314', 'FM-2609-991']);
  eq(FM.contractSummary(s.job('FM-2609-276')).currentCents, 8088805);
});

test('seed: tax and supplier cost for the books come from the signed quotes', function () {
  var s = fresh(), w = s.job('FM-2609-276'), p = s.job('FM-2609-314');
  eq([w.taxCents, w.costCents], [502418 + 62080, 5042754 + 538880]);   // 10 houses (tax $5,024.18, cost $50,427.54) + change order 1 (tax $620.80, cost $5,388.80)
  eq([p.taxCents, p.costCents, p.absorbedCents], [62079, 576696, 165270]);
  eq(p.changeOrders.map(function (c) { return [c.number, c.kind, c.amountCents]; }), [[1, 'courtesy', 0]]);
  eq(p.documents.length, 2); eq(w.documents.length, 3);
  eq([w.contractedOn, p.contractedOn, s.job('FM-2609-991').contractedOn], ['2026-10-01', '2026-09-16', null]);
});

test('books on the real jobs: P&L this year', function () {
  var pl = BK.profitAndLoss(fresh().books(), '2026-01-01', SEED.today);
  eq(pl.jobs.map(function (j) { return [j.jobCode, j.revenueCents, j.grossProfitCents]; }),
     [['FM-2609-276', 7524307, 1942673], ['FM-2609-314', 1035232, 293266]]);   // Willow Creek includes change order 1's tax ($620.80) and cost ($5,388.80)
});

test('books on the real jobs: reconcile finds Penrose invoice 1 has no check number', function () {
  var r = BK.reconcile(fresh().books());
  eq(r.rows.map(function (x) { return [x.jobCode, x.issues.map(function (i) { return i.kind; })]; }), [['FM-2609-276', []], ['FM-2609-314', ['reference']]]);
});

test('record a payment: checks the amount, date, method and check number, then logs it', function () {
  var s = fresh(), inv = s.job('FM-2609-314').invoices[2];
  var bad = s.recordPayment('FM-2609-314', inv.id, { amountCents: 999999, date: '2026-11-30', method: 'check', reference: '' }, 'Linds');
  eq(bad.errors, ['That\'s more than the $2,243.74 still owed on this invoice.', 'The date can\'t be in the future.', 'Enter the check number.']);
  var good = s.recordPayment('FM-2609-314', inv.id, { amountCents: 224374, date: '2026-10-27', method: 'check', reference: '3012' }, 'Linds', '2026-10-27T15:00:00Z');
  ok(good.ok);
  eq(FM.invoicePaidCents(s.job('FM-2609-314').invoices[2]), 224374);
  eq(s.log('FM-2609-314')[0].text, 'Payment of $2,243.74 recorded on Invoice 3 · 20% (Check 3012).');
  eq(BK.depositsDue(s.books(), SEED.today).groups.reduce(function (t, g) { return t.concat(g.items.map(function (x) { return x.jobCode; })); }, []).indexOf('FM-2609-314'), -1);
});

test('jobs are added once; updates are logged with who did it; the seed is never changed', function () {
  var s = fresh();
  ok(s.addJob({ jobCode: 'FM-2610-700', customer: 'Test', invoices: [], changeOrders: [] }, 'Linds').ok);
  eq(s.addJob({ jobCode: 'FM-2610-700' }, 'Linds').error, 'Job FM-2610-700 already exists.');
  s.update('FM-2609-276', function (j) { j.deliveryDate = '2026-11-24'; return j; }, 'Delivery moved to Nov 24 (estimate).', 'Sam');
  eq([s.job('FM-2609-276').deliveryDate, s.log()[0].by], ['2026-11-24', 'Sam']);
  eq(SEED.jobs.length, 3); eq(SEED.jobs[0].deliveryDate, '2026-11-20');
});

test('Willow Creek change order 1 comes in with its lines and its own pricing (5% discount, 5 h assembly)', function () {
  var w = fresh().job('FM-2609-276'), co = w.changeOrders[0], sm = co.priced.summary;
  eq([co.kind, co.amountCents, co.priced.lines.length, co.pricing.discountPctOfCost, co.pricing.labor[0].hours], ['charge', 874071, 14, 5, 5]);
  eq(sm.cabinetsCents + sm.discountCents + sm.laborCents + sm.gaCents + sm.taxCents, 874070, 'printed parts add to $8,740.70; the PDF shows $8,740.71 (old-tool rounding)');
  eq(co.priced.lines.reduce(function (t, l) { return t + l.totalCents; }, 0), 812764, 'line totals $8,127.64 vs Cabinets $8,127.63');
  eq(Math.round(538880 * 5 / 100), 26944, 'cost $5,388.80 × 5% = the printed discount');
  eq(w.documents.filter(function (d) { return d.changeOrder === 1; }).map(function (d) { return d.pages; }), [2, 1]);
});

test('Test / Void: Full access only, needs a reason, leaves every total, Restore puts it back', function () {
  var s = fresh(), full = { name: 'Linds', access: 'full' }, coord = { name: 'Sam', access: 'coordinator' };
  var before = BK.dashboard(s.books(), SEED.today);
  eq(s.markTestVoid('FM-2609-314', 'test project', coord).error, 'Only someone with Full access can mark a project Test / Void.');
  ok(/Say why/.test(s.markTestVoid('FM-2609-314', '  ', full).error));
  ok(s.markTestVoid('FM-2609-314', 'test project', full, '2026-10-30T10:00:00Z').ok);
  eq(s.jobs().map(function (j) { return j.jobCode; }), ['FM-2609-276', 'FM-2609-991'], 'left out of the list');
  eq(s.jobs({ all: true }).length, 3, 'still there with { all: true }');
  eq(s.books().length, 2);
  eq(s.job('FM-2609-314').stage, SEED.jobs[1].stage, 'stage kept');
  ok(/no longer count/.test(s.log()[0].text), 'payments noted in the log');
  eq(BK.dashboard(s.jobs({ all: true }).map(ST.toBooks), SEED.today), BK.dashboard(s.books(), SEED.today), 'books ignore it even if passed in');
  ok(JSON.stringify(BK.dashboard(s.books(), SEED.today)) !== JSON.stringify(before), 'totals changed');
  eq(s.restore('FM-2609-314', coord).error, 'Only someone with Full access can restore a project.');
  ok(s.restore('FM-2609-314', full).ok);
  eq(BK.dashboard(s.books(), SEED.today), before, 'restored totals match');
});

console.log('store.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
