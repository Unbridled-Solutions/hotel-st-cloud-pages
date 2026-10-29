/*
 * Braddy Builders · Penrose (FM-2609-314) contract tests. Run with:   node tests/braddy.test.js
 * Expected values come from "FM-2609-314 · Braddy Builders.pdf", Wholesale
 * Cabinets order #1000173203, and the 11:20 AM screen recording.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var Q = isNode ? require('../src/fm-phase1-quote.js') : globalThis.FMQuote;
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
var C = FM.toCents;
function priced() { return Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing)); }

test('cost × 1.30 reproduces every charged line on the signed quote', function () {
  B.model.lines.filter(function (l) { return !l.noCharge && l.markupPct === 30; }).forEach(function (l) {
    eq(Math.round(C(l.unitCost) * l.qty * 1.3), C(l.sellTotal), l.sku);
  });
});

test('discount, G&A and tax match the signed quote (5% of charged cost, 5%, 8.7%)', function () {
  var p = priced();
  eq([p.summary.discountCents, p.summary.taxCents], [28835, 62079]);
  eq(p.internal.costCents, 576696, 'cost of charged lines');
});

test('signed quote: 8 problems a customer could catch, including a $2,188.06 gap', function () {
  var probs = Q.verifyPrinted(Q.printedFromOrderModel(B.model, B.pricing));
  eq(probs.length, 8);
  eq(probs.filter(function (x) { return x.kind === 'line'; }).length, 5);
  eq(probs.filter(function (x) { return x.kind === 'total'; })[0].text, 'Summary adds up to $8,785.05, printed total $10,973.11');
  eq(probs.filter(function (x) { return x.kind === 'discount-label'; })[0].text, 'Discount says 5% but is 3.88% of the Cabinets line above it');
  eq(C(10973.11) - C(8785.05), 218806);
});

test('two cabinets print at $0.00: the Oct 9 supplier order, $1,600.44 at cost', function () {
  var p = priced();
  eq(p.internal.noChargeLines, ['VDC42RS-VDH', 'DC224-VDH']);
  eq(p.internal.noChargeCostCents, 160044);
  var so = B.supplierOrders[0];
  eq(C(so.subtotal) - C(so.discount) + C(so.tax) + C(so.shipping), C(so.total), 'supplier order adds up');
  eq(so.date > B.quoteDate, true, 'ordered after the contract date');
  var html = Q.renderHouseQuoteDoc(p, { house: 'Penrose' });
  ok(html.indexOf('>No charge<') > -1, 'customer copy says "No charge", not $0.00');
});

test('at line prices alone, the giveaways put cabinets $231.88 under cost', function () {
  eq(priced().internal.grossProfitCents, -23188);
});

test('the contract total rose $245.57 after the deposit, with no change order', function () {
  var inv = B.invoices.map(function (i) { return C(i.amount); });
  eq(inv[0] * 2, 1072754, 'deposit = 50% of $10,727.54');
  var rest = C(10973.11) - inv[0];
  eq([Math.round(rest * 0.6), Math.round(rest * 0.4)], [inv[1], inv[2]], 'remaining balance split 60/40');
  eq(C(10973.11) - 1072754, 24557);
});

test('corrected math cannot be squared with the signed total by rounding', function () {
  var p = priced();
  eq(p.summary.totalCents, 878509);
  eq(Q.reconcileToSigned(p, C(10973.11)).error, 'Corrected math differs from the signed total by $2,188.02. That needs a change order, not a rounding adjustment.');
});

test('source documents are listed for both jobs with checksums', function () {
  eq(B.documents.map(function (d) { return d.jobCode + ' ' + d.kind; }), ['FM-2609-314 contract', 'FM-2609-314 supplier-order', 'FM-2609-276 contract']);
  B.documents.forEach(function (d) { ok(/^[0-9a-f]{64}$/.test(d.sha256), d.file); });
});

test('all 18 SKUs match the quote screen (8:34 PM): cost $5,766.96, assembly $40 × 16 h; lines add to $7,423.83 vs the screen total $7,423.84', function () {
  var m = B.model, cost = 0, sell = 0;
  m.lines.forEach(function (l) { if (!l.noCharge) cost += C(l.unitCost) * l.qty; sell += C(l.sellTotal); });
  eq([m.lines.length, cost], [18, C(m.screenTotals.costCharged)]);
  eq([sell, C(m.screenTotals.cabinets)], [742383, 742384]);   // the printed lines add to $7,423.83; the screen says $7,423.84 (the known 1¢ rounding issue, §14)
  eq(Math.round(m.assembly.rate * 100 * m.assembly.hours), C(m.contract.assembly));
  var co = B.changeOrders[0];
  eq(co.removed.map(function (r) { return r.sku + ' ×' + r.qty; }), ['DC324-VDH ×2', 'VDC12-VDH ×1']);
  eq(co.added.map(function (a) { return a.sku; }), m.lines.filter(function (l) { return l.noCharge; }).map(function (l) { return l.sku; }));
});

var summary = 'Braddy Penrose contract\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
