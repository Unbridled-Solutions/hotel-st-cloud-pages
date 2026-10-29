/*
 * Phase 2 reports and customers tests. Run with:   node tests/reports.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var R = isNode ? require('../src/fm-phase2-reports.js') : globalThis.FMReports;
var CU = isNode ? require('../src/fm-phase2-customers.js') : globalThis.FMCustomers;

var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

// A signed job worked out by hand: $10,000 contract with $700 tax; deposit $5,000 paid Oct 2 (check 1001), final $5,000 open, due Oct 20.
// A $500 change order (signed) with its own invoice, paid Oct 25. Cost $6,000.
function job() {
  return { jobCode: 'FM-1', customer: 'Garcia, "Ana"', projectName: 'Kitchen', stage: 'deposit_paid', quoteDate: '2026-09-20', contractedOn: '2026-10-01', deliveryDate: '2026-11-15',
    originalContractCents: 1000000, taxCents: 70000, costCents: 600000, absorbedCents: 0, pricing: { taxPct: 7.9 },
    changeOrders: [{ id: 'FM-1-co1', number: 1, date: '2026-10-24', kind: 'charge', status: 'signed', amountCents: 50000, reason: 'Customer request', removed: [{ sku: 'B18', qty: 1 }], added: [{ sku: '3DB18', qty: 1 }] }],
    invoices: [
      { id: 'FM-1-inv1', label: 'Invoice 1 · 50%', role: 'deposit', dueDate: '2026-10-01', amountCents: 500000, status: 'paid', payments: [{ amountCents: 500000, date: '2026-10-02', method: 'check', reference: '1001' }] },
      { id: 'FM-1-inv2', label: 'Invoice 2 · 50%', role: 'progress', dueDate: '2026-10-20', amountCents: 500000, status: 'open', payments: [] },
      { id: 'FM-1-inv3', label: 'Change order 1 invoice', role: 'change_order', dueDate: '2026-10-24', amountCents: 50000, status: 'paid', payments: [{ amountCents: 50000, date: '2026-10-25', method: 'card', reference: '' }] }] };
}
var quote = { jobCode: 'FM-2', customer: 'Lee', stage: 'quote', originalContractCents: 300000, taxCents: 20000, invoices: [], changeOrders: [] };

test('jobs report: contract to cash, quotes left out unless asked', function () {
  var t = R.jobs([job(), quote]);
  eq(t.rows.length, 1);
  var r = t.rows[0];
  eq([r.contractCents, r.changeOrderCents, r.invoicedCents, r.paidCents, r.balanceCents, r.revenueCents, r.grossProfitCents, r.marginPct], [1050000, 50000, 1050000, 550000, 500000, 980000, 380000, 38.8]);
  eq(R.jobs([job(), quote], { includeQuotes: true }).rows.length, 2);
});
test('invoices report: open and overdue', function () {
  var t = R.invoices([job()], { today: '2026-10-29' });
  eq(t.rows.map(function (r) { return [r.invoice, r.status, r.openCents, r.daysOverdue]; }), [['FM-1-inv1', 'Paid', 0, ''], ['FM-1-inv2', 'Overdue', 500000, 9], ['FM-1-inv3', 'Paid', 0, '']]);
  eq(t.totals.openCents, 500000);
});
test('payments in a period, with the tax inside each', function () {
  var t = R.payments([job()], { from: '2026-10-01', to: '2026-10-31' });
  // tax share = payment × 70,000 / 1,050,000
  eq(t.rows.map(function (r) { return [r.date, r.method, r.reference, r.amountCents, r.taxCents]; }), [['2026-10-02', 'Check', '1001', 500000, 33333], ['2026-10-25', 'Card', '', 50000, 3333]]);
  eq(R.payments([job()], { from: '2026-10-10', to: '2026-10-31' }).rows.length, 1);
});
test('sales tax: billed (signed in period) and collected (paid in period)', function () {
  var t = R.salesTax([job()], { from: '2026-10-01', to: '2026-10-31' });
  eq([t.rows[0].billedTaxCents, t.rows[0].collectedCents, t.rows[0].collectedTaxCents, t.rows[0].taxRatePct], [70000, 550000, 36667, 7.9]);
  eq(R.salesTax([job()], { from: '2026-11-01', to: '2026-11-30' }).rows.length, 0);
});
test('change orders report and CSV for spreadsheets', function () {
  var co = R.changeOrders([job()]);
  eq([co.rows[0].kind, co.rows[0].removed, co.rows[0].added, co.rows[0].amountCents], ['Charged', 'B18 x1', '3DB18 x1', 50000]);
  var csv = R.toCSV(R.jobs([job()]));
  ok(csv.charCodeAt(0) === 0xFEFF, 'BOM for Excel');
  var lines = csv.slice(1).split('\r\n');
  eq(lines[0].split(',').slice(0, 3), ['Job', 'Customer', 'Project']);
  ok(lines[1].indexOf('FM-1,"Garcia, ""Ana""",Kitchen') === 0, 'quotes and commas escaped: ' + lines[1]);
  ok(lines[1].indexOf(',10500.00,') > 0 && lines[2].indexOf('Total,') === 0, 'money as plain numbers, total row');
  eq(R.toCSV({ columns: [{ key: 'a', label: 'A' }], rows: [{ a: '=HYPERLINK("x")' }], totals: {} }).slice(1).split('\r\n')[1], '"\'=HYPERLINK(""x"")"', 'formula guarded');
  eq(R.fileName({ key: 'payments', usesPeriod: true }, { from: '2026-10-01', to: '2026-10-31' }), 'fremont-makers-payments-2026-10-01-to-2026-10-31.csv');
});
test('periods from today', function () {
  var p = {}; R.periods('2026-10-29').forEach(function (x) { p[x.key] = [x.from, x.to]; });
  eq([p.month, p.lastmonth, p.quarter, p.lastquarter, p.ytd, p.lastyear],
     [['2026-10-01', '2026-10-31'], ['2026-09-01', '2026-09-30'], ['2026-10-01', '2026-12-31'], ['2026-07-01', '2026-09-30'], ['2026-01-01', '2026-10-29'], ['2025-01-01', '2025-12-31']]);
});

test('customer profiles from jobs, without duplicates or change-order projects', function () {
  var jobs = [{ customer: 'Willow Creek Estates', kind: 'builder_order', houses: [{}, {}], contacts: { signer: 'Dana Ruiz', buyerEmail: 'dana@wce.example' }, installAddress: 'Lot 1-10, Willow Creek', projectName: 'Phase 1' },
    { customer: 'willow creek estates ', contacts: { signer: 'Dana Ruiz', buyerEmail: '' }, installAddress: 'Lot 1-10, Willow Creek' },
    { customer: 'Willow Creek change order', parentJobCode: 'X' }, { customer: 'Sample quote (preview)', contacts: { signer: 'Sample customer' } }];
  var cs = CU.fromJobs(jobs, []);
  eq(cs.map(function (c) { return [c.name, c.kind, c.contacts.length, c.addresses.length]; }), [['Willow Creek Estates', 'builder', 1, 1], ['Sample quote (preview)', 'homeowner', 0, 0]]);
  eq([CU.signer(cs[0]).name, CU.signer(cs[0]).email, CU.jobsFor(cs[0], jobs).length], ['Dana Ruiz', 'dana@wce.example', 2]);
  eq(CU.fromJobs(jobs, cs).length, 2, 'running it again adds nothing');
});
test('customer checks and templates (no pricing on either)', function () {
  var c = CU.blank('Garcia'); c.contacts.push({ name: 'Ana', email: 'ana@', signs: true }, { name: 'Luis', email: '', signs: true });
  eq(CU.check(c, [{ id: 'z', name: 'garcia' }]), ['There\'s already a customer called Garcia.', 'Ana: that email doesn\'t look right.', 'Luis signs contracts, so they need an email for Dropbox Sign.']);
  var t = CU.templateFromSets('Willow Creek 2027', [{ key: 'San Luis', qty: 2, lines: [{ sku: 'B33-SBW', qty: 1, unitCost: 214.5 }, { sku: 'X', qty: 0 }] }, { key: 'Mesa Ridge', qty: 2, lines: [] }],
    [{ id: 'r', name: 'Kitchen', set: 'San Luis', walls: [] }], { fromJob: 'FM-2609-276', today: '2026-10-29' });
  eq([t.kind, t.models.length, t.models[0].lines, t.models[0].rooms.length, t.models[1].rooms.length], ['builder', 2, [{ sku: 'B33-SBW', desc: '', qty: 1, unitCostCents: 21450 }], 1, 0]);
  ok(!('pricing' in t) && !JSON.stringify(t).match(/markup|taxPct/), 'no pricing in a template');
  eq(CU.summary(t), '2 models, 4 houses · 1 cabinet lines · 1 room drawn');
});

console.log('reports.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
