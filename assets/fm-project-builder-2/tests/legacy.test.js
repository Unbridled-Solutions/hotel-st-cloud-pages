/*
 * Reading the existing tool's real cloud data (FMLegacy). Run with:   node tests/legacy.test.js
 * Uses the live bundle as read Nov 5 2026 (tests/fixtures/legacy-bundle-2026-11-05.js) and checks it lands exactly on the
 * records the rest of the package was built and tested on (preview/sample-data.js, the Willow Creek and Penrose order files).
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var LG = isNode ? require('../src/fm-phase2-legacy.js') : globalThis.FMLegacy;
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;
var BK = isNode ? require('../src/fm-phase2-books.js') : globalThis.FMBooks;
var SAMPLE = isNode ? require('../preview/sample-data.js') : globalThis.FM_SAMPLE;
var W = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;
var B = isNode ? require('../preview/braddy-penrose-order.js') : globalThis.FM_BRADDY_ORDER;
var BUNDLE = isNode ? require('./fixtures/legacy-bundle-2026-11-05.js') : globalThis.FM_LEGACY_BUNDLE;

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

var R = LG.read(BUNDLE);
function proj(code) { return R.legacyProjects.filter(function (p) { return p.jobCode === code; })[0]; }
function sample(code) { return SAMPLE.legacyProjects.filter(function (p) { return p.jobCode === code; })[0]; }

test('the project list gives the three real projects; houses are part of their order, not projects', function () {
  eq(R.legacyProjects.map(function (p) { return [p.jobCode, p.customer, p.status, p.total]; }),
    [['FM-2609-276', 'Willow Creek Estates', 'Contracted', 72147.34], ['FM-2609-314', 'Braddy Builders', 'Contracted', 10973.11], ['FM-2609-991', 'Stonewall Holdings', 'Lost', 8744.71]]);
});

test('every field the package reads matches the records it was built on', function () {
  ['FM-2609-276', 'FM-2609-314', 'FM-2609-991'].forEach(function (code) {
    var r = proj(code), s = sample(code);
    ['jobCode', 'customer', 'status', 'total', 'quoteDate', 'deliveryDate', 'houses', 'invoices', 'changeLog', 'kind'].forEach(function (k) { eq(r[k], s[k], code + ' ' + k); });
    if (s.signerName) eq(r.signerName, s.signerName, code + ' signerName');
  });
  eq(proj('FM-2609-314').projectName, 'Penrose');
  eq(proj('FM-2609-991').signerName, 'Stonewall Holdings', 'the real record has a signer the recording did not show');
  eq(proj('FM-2609-276').changeOrders, [{ number: 1, date: '2026-10-26', reason: 'SKUs updated Oct 2026', amount: 8740.71, status: 'invoiced' }], 'kept inside the job, as the existing tool stores it');
});

test('payments come across with dates and check numbers (Penrose paid in full Nov 4; Willow Creek CO 1 paid Oct 28)', function () {
  eq(proj('FM-2609-314').invoices.map(function (i) { return [i.status, i.paidDate || '', i.check || '']; }), [['Paid', '2026-09-16', ''], ['Paid', '2026-10-05', '2967'], ['Paid', '2026-11-04', '2980']]);
  eq(proj('FM-2609-276').invoices.map(function (i) { return [i.label, i.amount, i.status, i.check || '']; }),
    [['Invoice 1 · 50% at order', 35364.33, 'Paid', '5547'], ['Invoice 2 · 50% at delivery', 36783.01, 'Due', ''], ['Change order 1 invoice', 8740.71, 'Paid', '5568']]);
});

test('what the old screen captures got wrong is corrected by the real data', function () {
  var w = proj('FM-2609-276');
  eq([w.buyerEmail, w.installAddress], ['', undefined], 'the recording showed the box\'s placeholder text ("for HelloSign") and a sample address; both are empty in the real record');
  eq(R.legacyProjects.filter(function (p) { return p.jobCode === 'FM-2610-475'; }).length, 0, 'the change order once saved as its own project is no longer listed');
});

test('stored-but-unlisted records and orphaned test houses are reported, not imported', function () {
  var why = {}; R.skipped.forEach(function (s) { why[s.jobCode] = s.why; });
  ok(/not on the project list/.test(why['FM-2610-475']), 'the stray change order record');
  eq(R.skipped.filter(function (s) { return s.customer === 'Willow CreekTEST'; }).length, 5, 'five leftover test houses');
  ok(R.skipped.every(function (s) { return s.why; }));
});

test('job details: pricing, assembly, lines and each Willow Creek house', function () {
  var p = R.details['FM-2609-314'], w = R.details['FM-2609-276'];
  eq([p.payPlan, p.pricing, p.labor], ['50-30-20', { mfrDiscountPct: 5, gaPct: 5, taxPct: 8.7 }, [{ role: 'Assembly', rate: 40, hours: 16 }]]);
  eq([p.pricing.mfrDiscountPct, p.pricing.gaPct, p.pricing.taxPct], [B.pricing.mfrDiscountPct, B.pricing.gaPct, B.pricing.taxPct], 'same as the Penrose order file');
  eq(p.lines.length, 18);
  eq([w.payPlan, w.houses.length, w.houses[0].name, w.houses[0].lines.length], ['50-50', 10, 'Cimarron Peak 1', 16]);
  eq(w.houses.map(function (h) { return h.lines.length; }), SAMPLE.legacyProjects[1].houses.map(function (h) { return h.lines; }));
});

test('change orders: Willow Creek CO 1 with its 14 lines and real cost; Penrose CO 1 is the courtesy one', function () {
  var co = R.details['FM-2609-276'].changeOrders[0], pc = R.details['FM-2609-314'].changeOrders[0];
  eq([co.number, co.kind, co.amount, co.billed, co.added.length, co.costTotal, co.signatures], [1, 'charge', 8740.71, true, 14, 5388.73, 'pending']);
  eq(co.costTotal, W.changeOrders[0].costTotal, 'matches the Willow Creek order file');
  eq(co.pricing, { mfrDiscountPct: 5, gaPct: 2, taxPct: 7.9, labor: [{ role: 'Assembly', rate: 20.5, hours: 5 }] });
  eq([pc.kind, pc.billed, pc.lines.length], ['courtesy', false, 18]);
});

test('the jobs it gives seed the store and books exactly as the sample does', function () {
  var a = ST.seed({ sample: { today: SAMPLE.today, legacyProjects: R.legacyProjects }, willow: W, braddy: B });
  var b = ST.seed({ sample: SAMPLE, willow: W, braddy: B });
  var pick = function (s) { return s.jobs.map(function (j) { var c = FM.contractSummary(j); return [j.jobCode, j.stage, c.currentCents, c.paidCents, c.balanceCents]; }); };
  eq(pick(a), pick(b).filter(function (r) { return r[0] !== 'FM-2610-475'; }));
  var pl = BK.profitAndLoss(ST.create({ seed: a }).books(), '2026-01-01', SAMPLE.today);
  eq([pl.totals.revenueCents, pl.totals.grossProfitCents], [8559539, 3055834]);
});

test('company books: P&L months and the Balance Sheet, in cents', function () {
  eq(Object.keys(R.company.months).sort(), ['2026-07', '2026-08', '2026-09']);
  eq([R.company.months['2026-08'].guaranteedPayments, R.company.months['2026-08'].contractLabor, R.company.months['2026-07'].professional], [1055000, 329300, 425000]);
  var v = R.company.balance.values;
  eq([R.company.balance.asOf, v.cash, v.equipment, v.accumDepreciation, v.noteCurrent, v.noteLongTerm, v.retained], ['', 480772, 1932335, 1872335, 1719600, 8280400, -10019688]);
});

test('reading never changes the bundle', function () {
  var before = JSON.stringify(BUNDLE); LG.read(BUNDLE); eq(JSON.stringify(BUNDLE), before);
});

console.log('legacy.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
