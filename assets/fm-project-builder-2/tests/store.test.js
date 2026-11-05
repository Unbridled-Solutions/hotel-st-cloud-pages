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
/* Penrose invoice 3 as it stood on Oct 27, still open (paid Nov 4), for the payment tests. */
var SAMPLE27 = JSON.parse(JSON.stringify(SAMPLE)); SAMPLE27.today = '2026-10-27';
SAMPLE27.legacyProjects.forEach(function (p) { (p.invoices || []).forEach(function (i) { if (i.paidDate && i.paidDate > '2026-10-27') { i.status = 'Due'; delete i.paidDate; delete i.check; } }); });
var SEED27 = ST.seed({ sample: SAMPLE27, willow: W, braddy: B });
function fresh() { return ST.create({ seed: SEED }); }

test('seed: the Willow Creek change order is attached, not a separate project', function () {
  var s = fresh();
  eq(s.jobs().map(function (j) { return j.jobCode; }), ['FM-2609-276', 'FM-2609-314', 'FM-2609-991']);
  eq(FM.contractSummary(s.job('FM-2609-276')).currentCents, 8088805);
});

test('seed: tax and supplier cost for the books come from the signed quotes', function () {
  var s = fresh(), w = s.job('FM-2609-276'), p = s.job('FM-2609-314');
  eq([w.taxCents, w.costCents], [502418 + 62080, 5042754 + 538873]);   // 10 houses (tax $5,024.18, cost $50,427.54) + change order 1 (tax $620.80, cost $5,388.73 from its line costs)
  eq([p.taxCents, p.costCents, p.absorbedCents], [62079, 576696, 6291]);   // $1,652.70 paid − $1,589.79 refunded
  eq(p.changeOrders.map(function (c) { return [c.number, c.kind, c.amountCents]; }), [[1, 'courtesy', 0]]);
  eq(p.documents.length, 2); eq(w.documents.length, 3);
  eq([w.contractedOn, p.contractedOn, s.job('FM-2609-991').contractedOn], ['2026-10-01', '2026-09-16', null]);
});

test('books on the real jobs: P&L this year', function () {
  var pl = BK.profitAndLoss(fresh().books(), '2026-01-01', SEED.today);
  eq(pl.jobs.map(function (j) { return [j.jobCode, j.revenueCents, j.grossProfitCents]; }),
     [['FM-2609-276', 7524307, 2574754], ['FM-2609-314', 1035232, 481080]]);   // cost is the quoted cost less the manufacturer's discount (owner, Nov 4); Willow Creek includes change order 1
  eq(pl.jobs.map(function (j) { return [j.quotedCostCents, j.mfrDiscountCents, j.costCents]; }), [[5581627, 632074, 4949553], [576696, 28835, 547861]]);
});

test('books on the real jobs: reconcile finds Penrose invoice 1 has no check number', function () {
  var r = BK.reconcile(fresh().books());
  eq(r.rows.map(function (x) { return [x.jobCode, x.issues.map(function (i) { return i.kind; })]; }), [['FM-2609-276', []], ['FM-2609-314', ['reference']]]);
});

test('record a payment: checks the amount, date, method and check number, then logs it', function () {
  var s = ST.create({ seed: SEED27 }), inv = s.job('FM-2609-314').invoices[2];
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

test('P&L breaks out every charge; the parts add up to the contract, and gross profit is unchanged', function () {
  var pl = BK.profitAndLoss(fresh().books(), '2026-01-01', SEED.today), w = pl.jobs[0], p = pl.jobs[1];
  eq([w.cabinetsCents, w.discountCents, w.laborCents, w.gaCents, w.otherCents, w.taxCents], [7777631, -632074, 231212, 147535, 3, 564498]);
  eq(w.cabinetsCents + w.discountCents + w.laborCents + w.gaCents + w.otherCents + w.taxCents, w.contractCents, 'Willow Creek adds up to $80,888.05');
  eq(w.parts.map(function (x) { return x.label; }), ['San Luis × 2', 'Mesa Ridge × 2', 'Sangre Vista × 2', 'Pinyon Crest × 2', 'Cimarron Peak × 2', 'Change order 1']);
  eq(w.parts[5].laborCents, 10250, 'the change order brings its own 5 h of assembly');
  eq(p.parts.map(function (x) { return [x.label, x.totalCents]; }), [['Penrose', 878505], ['Agreed bid price above the itemized quote (grandfathered)', 218806]]);
  eq([p.laborCents, p.taxCents, p.otherCents, p.grossProfitCents], [64000, 62079, 218806, 481080]);
  eq(pl.totals.laborCents, 231212 + 64000);
  eq([pl.totals.agreedCents, pl.totals.roundingCents, pl.totals.unbrokenCents], [218806, 3, 0], 'Other = Penrose agreed price + 3¢ old-tool rounding; nothing unexplained');
  var R = isNode ? require('../src/fm-phase2-reports.js') : globalThis.FMReports, row = R.jobs(fresh().jobs()).rows.filter(function (r) { return r.jobCode === 'FM-2609-276'; })[0];
  eq([row.cabinetsCents, row.laborCents, row.gaCents, row.taxCents, row.quotedCostCents, row.mfrDiscountCents, row.costCents, row.grossProfitCents], [7777631, 231212, 147535, 564498, 5581627, 632074, 4949553, 2574754], 'the finance CSV carries the same breakdown and net cost');
  eq(pl.totals.cabinetsCents + pl.totals.discountCents + pl.totals.laborCents + pl.totals.gaCents + pl.totals.otherCents + pl.totals.taxCents, pl.totals.contractCents);
});

test('data saved before the breakdown picks it up from the seed on load (and the change order\'s tax and cost)', function () {
  var old = JSON.parse(JSON.stringify(SEED));
  old.jobs.forEach(function (j) { delete j.charges; (j.changeOrders || []).forEach(function (c) { delete c.priced; delete c.pricing; c.taxCents = 0; c.costCents = 0; }); });
  var p0 = old.jobs[1]; p0.changeOrders[0].supplierCreditCents = 0; p0.changeOrders[0].absorbedCents = 165270; p0.absorbedCents = 165270;   // saved before the refund was known
  var w0 = old.jobs[0]; w0.taxCents -= 62080; w0.costCents -= 538873; w0.documents = w0.documents.slice(0, 1);
  var s = ST.create({ seed: SEED, storage: { load: function () { return old; }, save: function () {} } }), w = s.job('FM-2609-276');
  eq([w.charges.parts.length, w.taxCents, w.costCents, w.documents.length, w.changeOrders[0].priced.lines.length], [5, 564498, 5581627, 3, 14]);
  eq([s.job('FM-2609-314').absorbedCents, s.job('FM-2609-314').changeOrders[0].supplierCreditCents], [6291, 158979], 'the Penrose refund reaches saved data too');
  var pl = BK.profitAndLoss(s.books(), '2026-01-01', SEED.today);
  eq(pl.jobs.map(function (j) { return j.grossProfitCents; }), [2574754, 481080], 'same gross profit as fresh data');
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


test('Nov 5: payments made in the existing tool, and the real change order cost, reach data saved earlier', function () {
  eq(FM.invoicePaidCents(fresh().job('FM-2609-314').invoices[2]), 224374, 'Penrose invoice 3, check 2980, Nov 4');
  var co = fresh().job('FM-2609-276').invoices.filter(function (i) { return i.role === 'change_order'; })[0];
  eq([FM.invoicePaidCents(co), co.payments[0].reference, co.payments[0].date], [874071, '5568', '2026-10-28']);
  var old = JSON.parse(JSON.stringify(SEED27)), w0 = old.jobs[0];
  w0.changeOrders[0].costCents = 538880; w0.changeOrders[0].costIsEstimate = true; w0.costCents += 7; w0.costNote = 'worked back';
  var s = ST.create({ seed: SEED, storage: { load: function () { return old; }, save: function () {} } }), w = s.job('FM-2609-276');
  eq([w.changeOrders[0].costCents, w.changeOrders[0].costIsEstimate, w.costCents, w.costNote], [538873, false, 5581627, null]);
  eq(FM.invoicePaidCents(s.job('FM-2609-314').invoices[2]), 224374, 'the Nov 4 payment fills in');
  var s2 = ST.create({ seed: SEED, storage: { load: function () { var o = JSON.parse(JSON.stringify(SEED27)); o.jobs[1].invoices[2].payments = [{ amountCents: 100000, date: '2026-11-01', method: 'cash', reference: '' }]; return o; }, save: function () {} } });
  eq(s2.job('FM-2609-314').invoices[2].payments.length, 1, 'a payment already recorded in the new tool is never overwritten');
});

console.log('store.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
