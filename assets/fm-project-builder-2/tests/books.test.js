/*
 * Phase 2 Company Books tests. Run with:   node tests/books.test.js
 * A small fixture with hand-checked numbers (today = 2026-10-28).
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var BK = isNode ? require('../src/fm-phase2-books.js') : globalThis.FMBooks;

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

var TODAY = '2026-10-28';
function inv(id, role, amt, due, pays) { return { id: id, label: id, role: role, amountCents: amt, dueDate: due, status: 'open', payments: pays || [] }; }
var JOBS = [
  { jobCode: 'A', customer: 'Alpha', project: 'A1', stage: 'factory_ordered', contractedOn: '2026-09-16', quoteDate: '2026-09-10', deliveryDate: '2026-11-09',
    contractCents: 1000000, taxCents: 80000, costCents: 500000, absorbedCents: 20000,
    invoices: [inv('A dep', 'deposit', 500000, '2026-09-16', [{ amountCents: 500000, date: '2026-09-16', method: 'unknown', reference: '' }]),
               inv('A prog', 'progress', 300000, '2026-10-20'), inv('A final', 'progress', 200000, '2026-11-05')] },
  { jobCode: 'B', customer: 'Beta', project: 'B1', stage: 'quote', quoteDate: '2026-10-01', contractCents: 400000, taxCents: 0, costCents: null, invoices: [] },
  { jobCode: 'C', customer: 'Gamma', project: 'C1', stage: 'lost', quoteDate: '2026-09-01', contractCents: 300000, taxCents: 0, costCents: null, invoices: [] },
  { jobCode: 'D', customer: 'Delta', project: 'D1', stage: 'contract_signed', contractedOn: '2026-10-25', quoteDate: '2026-10-20',
    contractCents: 200000, taxCents: 10000, costCents: null, absorbedCents: 0,
    invoices: [inv('D dep', 'deposit', 100000, '2026-10-25'), inv('D final', 'progress', 100000, '2026-12-01')] }
];

test('pipeline: value by stage, work in progress, win rate', function () {
  var p = BK.pipeline(JOBS, TODAY);
  var by = {}; p.columns.forEach(function (c) { by[c.stage] = [c.count, c.cents]; });
  eq([by.quote, by.contract_signed, by.factory_ordered, by.lost], [[1, 400000], [1, 200000], [1, 1000000], [1, 300000]]);
  eq([p.quotedCents, p.inProgressCents, p.winRatePct, p.decidedCount], [400000, 1200000, 66.7, 3]);
  eq(p.columns[3].jobs[0].balanceCents, 500000);
});

test('pipeline groups: quotes out, in production, finishing up; collected and owed; stale quotes flagged', function () {
  var g = BK.pipelineGroups(JOBS, TODAY), by = {};
  g.groups.forEach(function (x) { by[x.key] = [x.count, x.cents, x.owedCents]; });
  eq(by, { quotes: [1, 400000, 0], production: [2, 1200000, 700000], finishing: [0, 0, 0], complete: [0, 0, 0], lost: [1, 300000, 0] });
  var prod = g.groups[1].rows;
  eq(prod.map(function (r) { return [r.jobCode, r.collectedPct, r.owedCents, r.ageDays]; }), [['A', 50, 500000, 42], ['D', 0, 200000, 3]]);   // A delivers Nov 9; D has no date
  eq([g.groups[0].rows[0].ageDays, g.groups[0].rows[0].staleQuote, g.staleQuotes], [27, false, 0]);
  eq(BK.pipelineGroups(JOBS, '2026-11-15').staleQuotes, 1);
});

test('deposits due: grouped by when they\'re due; deposits holding a factory order are flagged', function () {
  var d = BK.depositsDue(JOBS, TODAY);
  eq(d.groups.map(function (g) { return [g.name, g.items.map(function (x) { return x.label; }), g.cents]; }), [
    ['Overdue', ['A prog', 'D dep'], 400000], ['Due in the next 7 days', [], 0], ['Due in 8–30 days', ['A final'], 200000],
    ['Later', ['D final'], 100000], ['No due date', [], 0]]);
  eq([d.totalCents, d.count], [700000, 4]);
  eq(d.factoryHolds.map(function (x) { return x.label; }), ['D dep']);
  eq(d.groups[0].items[0].daysUntil, -8);
});

test('reconcile: payments without a check number and missing costs', function () {
  var r = BK.reconcile(JOBS);
  eq(r.rows.map(function (x) { return [x.jobCode, x.issues.map(function (i) { return i.kind; })]; }), [['A', ['reference']], ['D', ['cost']]]);
  eq([r.issueCount, r.cleanCount], [2, 0]);
  var bad = JSON.parse(JSON.stringify(JOBS)); bad[0].invoices.pop();
  eq(BK.reconcile(bad).rows[0].issues[0].text, 'Invoices total $8,000.00; the contract is $10,000.00.');
});

test('P&L: gross profit for jobs contracted in the period, sales tax kept out of revenue', function () {
  var pl = BK.profitAndLoss(JOBS, '2026-01-01', TODAY);
  eq(pl.jobs.map(function (j) { return [j.jobCode, j.revenueCents, j.grossProfitCents]; }), [['A', 920000, 400000], ['D', 190000, 190000]]);
  eq(pl.totals, { contractCents: 1200000, taxCents: 90000, revenueCents: 1110000, costCents: 500000, absorbedCents: 20000, grossProfitCents: 590000, marginPct: 53.2 });
  eq(pl.missingCost, 1);
  eq([pl.cash.collectedCents, pl.cash.salesTaxCents, pl.cash.netOfTaxCents], [500000, 40000, 460000]);
  eq(BK.profitAndLoss(JOBS, '2026-10-01', TODAY).jobs.map(function (j) { return j.jobCode; }), ['D']);
});

test('balance sheet: what customers owe, deposits held, sales tax collected', function () {
  var b = BK.balanceSheet(JOBS, TODAY);
  eq([b.assets[0].cents, b.overdueCents], [700000, 400000]);
  eq(b.liabilities.map(function (l) { return [l.key, l.cents]; }), [['deposits', 500000], ['salesTax', 40000]]);
  eq(b.memo[0].cents, 0);
});

test('dashboard: key numbers, to-dos and upcoming deliveries', function () {
  var d = BK.dashboard(JOBS, TODAY), k = {};
  d.kpis.forEach(function (x) { k[x.key] = x.cents !== undefined ? x.cents : x.pct; });
  eq(k, { contractedYtd: 1200000, collected30: 0, receivable: 700000, due14: 200000, quoted: 400000, margin: 53.2 });
  eq(d.attention.length, 4);
  ok(/A prog is 8 days overdue/.test(d.attention[0].text), d.attention[0].text);
  eq([d.attention[0].kind, d.attention[0].status, d.attention[0].title, d.attention[0].action, d.attention[0].tab], ['overdue', 'Overdue', 'Invoice overdue', 'Record payment', 'invoices']);
  eq(d.deliveries, [{ jobCode: 'A', customer: 'Alpha', project: 'A1', deliveryDate: '2026-11-09', balanceCents: 500000 }]);
});

console.log('books.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
