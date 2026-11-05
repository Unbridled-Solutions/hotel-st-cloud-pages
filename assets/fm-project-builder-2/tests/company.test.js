/*
 * Company P&L and Balance Sheet (FMCompany), carried over from the existing tool. Run with:   node tests/company.test.js
 * Uses the owner's numbers as read from the live tool on Nov 5 2026 (preview/company-books.js) and the real jobs.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var CO = isNode ? require('../src/fm-phase2-company.js') : globalThis.FMCompany;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;
var LG = isNode ? require('../src/fm-phase2-legacy.js') : globalThis.FMLegacy;
var SAMPLE = isNode ? require('../preview/sample-data.js') : globalThis.FM_SAMPLE;
var W = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;
var B = isNode ? require('../preview/braddy-penrose-order.js') : globalThis.FM_BRADDY_ORDER;
var LEGACY = isNode ? require('../preview/company-books.js') : globalThis.FM_COMPANY_LEGACY;
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

var COMPANY = CO.fromLegacy(LEGACY);
var STORE = ST.create({ seed: ST.seed({ sample: SAMPLE, willow: W, braddy: B, company: COMPANY }) });
var BOOKS = STORE.books(), FULL = { name: 'Linds', access: 'full' }, COORD = { name: 'Sam', access: 'coordinator' };

test('the preview\'s numbers are exactly what FMLegacy reads from the live bundle', function () {
  var r = LG.read(BUNDLE).company, sorted = function (o) { var x = {}; Object.keys(o).sort().forEach(function (k) { x[k] = o[k]; }); return x; };
  eq(sorted(LEGACY.months), sorted(r.months)); eq(LEGACY.balance, r.balance);
});

test('a month the owner entered: September (Penrose contracted)', function () {
  var m = CO.month(COMPANY, BOOKS, '2026-09');
  eq([m.estimated, m.jobRevenue, m.cabinetCost + m.absorbed, m.grossProfit], [false, 1035232, 554152, 481080], 'revenue less sales tax, net cabinet cost plus the $62.91 courtesy');
  eq([m.totalOpex, m.ebitda, m.belowLine, m.netIncome], [1617086, -1136006, 211514, -1347520]);
});

test('a month nobody entered uses the standard amounts, and says so (October: Willow Creek)', function () {
  var m = CO.month(COMPANY, BOOKS, '2026-10');
  eq([m.estimated, m.jobRevenue, m.grossProfit, m.totalOpex, m.netIncome], [true, 7524307, 2574754, 2199668, 163572]);
  var n = CO.month(COMPANY, BOOKS, '2026-11');
  eq([n.estimated, n.totalRevenue, n.totalOpex, n.netIncome], [true, 0, 2199668, -2411182], 'same as the old page shows for Nov: OpEx $21,996.68, net −$24,111.82');
});

test('periods: rolling three months, a month, a quarter, a year; totals add up', function () {
  eq(CO.columns('rolling3', null, '2026-11-05'), ['2026-11', '2026-12', '2027-01']);
  eq(CO.columns('quarter', '2026-Q3', '2026-11-05'), ['2026-07', '2026-08', '2026-09']);
  eq(CO.columns('year', '2026', '2026-11-05').length, 12);
  var jun = CO.month(COMPANY, BOOKS, '2026-06');
  eq([jun.estimated, jun.beforeRecords, jun.totalOpex], [false, true, 0], 'months before the records start (July) are not estimated');
  eq(CO.statement(COMPANY, BOOKS, CO.columns('year', '2026', '2026-11-05')).total.netIncome, -589868 - 1828600 - 1347520 + 163572 - 2411182 - 2411182, 'the year counts July on: Jul, Aug, Sep entered; Oct, Nov, Dec estimated');
  var s = CO.statement(COMPANY, BOOKS, CO.columns('quarter', '2026-Q3', '2026-11-05'));
  eq([s.total.totalRevenue, s.total.totalOpex, s.estimated], [1035232, 589868 + 1617086 + 1617086, []]);
  eq(s.total.netIncome, s.months.reduce(function (t, m) { return t + m.netIncome; }, 0));
});

test('editing needs Full access, fixes an estimated month, and is logged', function () {
  eq(CO.setMonth(COMPANY, '2026-10', 'rent', 230000, COORD).ok, false);
  var r = CO.setMonth(COMPANY, '2026-10', 'rent', 230000, FULL, '2026-11-05T16:00:00Z');
  ok(r.ok); eq(r.text, 'Company P&L Oct 2026 · Rent / warehouse: $2,255.00 → $2,300.00 (month entered; it was an estimate)');
  var m = CO.month(r.company, BOOKS, '2026-10');
  eq([m.estimated, m.input.rent, m.input.guaranteedPayments], [false, 230000, 1055000], 'the other lines keep the standard amounts');
  eq(COMPANY.months['2026-10'], undefined, 'the original is never changed');
  var st = ST.create({ seed: ST.seed({ sample: SAMPLE, willow: W, braddy: B, company: COMPANY }) });
  st.saveCompany(r, 'Linds', '2026-11-05T16:00:00Z');
  eq([st.company().months['2026-10'].rent, st.log('COMPANY')[0].text.slice(0, 26)], [230000, 'Company P&L Oct 2026 · Ren']);
  var s2 = CO.setStandard(COMPANY, 'insurance', 18000, FULL);
  eq([CO.month(s2.company, BOOKS, '2026-12').input.insurance, CO.month(s2.company, BOOKS, '2026-09').input.insurance], [18000, 0], 'standard amounts only fill months not entered');
});

test('balance sheet: the owner\'s numbers, totals, and the $100,000 difference shown as it is', function () {
  var b = CO.balance(COMPANY);
  eq([b.groups.currentAssets, b.groups.fixedAssets, b.totalAssets], [480772, 60000, 540772]);
  eq([b.groups.currentLiabilities, b.groups.longTermLiabilities, b.groups.equity, b.totalLiabEquity], [2172486, 8280400, 87886, 10540772]);
  eq([b.differenceCents, b.balanced], [-10000000, false]);
});

test('balance sheet hints from the jobs and P&L; edits are Full access and logged; CSV export', function () {
  var b = CO.balance(COMPANY, { receivableCents: 3678301, netIncomeYtdCents: -1 });
  eq(b.hints.map(function (h) { return h.key; }), ['receivable', 'netIncomeYtd']);
  eq(CO.setBalance(COMPANY, 'cash', 500000, COORD).ok, false);
  var r = CO.setBalance(COMPANY, 'cash', 500000, FULL);
  eq([r.ok, r.text, CO.balance(r.company).totalAssets], [true, 'Balance sheet · Cash & checking: $4,807.72 → $5,000.00', 560000]);
  eq(CO.setBalance(COMPANY, 'asOf', '11/05/2026', FULL).ok, false);
  var csv = CO.balanceCSV(COMPANY);
  ok(/^Fremont Makers Cabinet Co\. · Balance Sheet/.test(csv)); ok(csv.indexOf('Less: accumulated depreciation,-18723.35') > -1, csv.slice(0, 400));
});

test('Test / Void jobs never reach the company P&L', function () {
  var st = ST.create({ seed: ST.seed({ sample: SAMPLE, willow: W, braddy: B, company: COMPANY }) });
  st.markTestVoid('FM-2609-276', 'test', FULL);
  eq(CO.month(COMPANY, st.books(), '2026-10').jobRevenue, 0);
});

console.log('company.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
