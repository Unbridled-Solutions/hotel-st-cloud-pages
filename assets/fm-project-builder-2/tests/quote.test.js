/*
 * House-quote math + document tests. Run with:   node tests/quote.test.js
 * Uses the full Willow Creek order (preview/willow-creek-full-order.js),
 * built from the contract packet PDF and the 10:02 AM screen recording.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var Q = isNode ? require('../src/fm-phase1-quote.js') : globalThis.FMQuote;
var O = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;

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

var MODELS = Object.keys(O.models);
function priced(name) { return Q.priceHouse(Q.inputFromOrderModel(O.models[name], O.pricing)); }

/* ---------- the problem, as printed today ---------- */
test('every signed house quote has arithmetic a customer can catch', function () {
  var counts = {};
  MODELS.forEach(function (n) {
    counts[n] = Q.verifyPrinted(Q.printedFromOrderModel(O.models[n], O.pricing)).length;
  });
  eq(counts, { 'San Luis': 5, 'Mesa Ridge': 8, 'Sangre Vista': 4, 'Pinyon Crest': 7, 'Cimarron Peak': 8 });
});

test('Cimarron Peak today: summary $7,153.82 vs printed $7,153.81', function () {
  var p = Q.verifyPrinted(Q.printedFromOrderModel(O.models['Cimarron Peak'], O.pricing));
  eq(p.filter(function (x) { return x.kind === 'total'; })[0].text, 'Summary adds up to $7,153.82, printed total $7,153.81');
  eq(p.filter(function (x) { return x.kind === 'cabinets'; })[0].text, 'Lines add up to $6,765.71, printed Cabinets $6,765.70');
  ok(p.some(function (x) { return x.text === 'ACM8-SBW: 2 × $124.61 = $249.22, printed $249.23'; }), 'ACM8 line, as on the packet');
  ok(p.some(function (x) { return x.text === 'VS30-SBW: 3 × $396.05 = $1,188.15, printed $1,188.14'; }), 'VS30 line, as on the packet');
});

test('discount label: "12%" reads as 7–10% of the cabinets line', function () {
  var labels = MODELS.map(function (n) {
    return Q.verifyPrinted(Q.printedFromOrderModel(O.models[n], O.pricing)).filter(function (x) { return x.kind === 'discount-label'; })[0].text;
  });
  eq(labels[4], 'Discount says 12% but is 7.02% of the Cabinets line above it');
  eq(labels.length, 5);
});

/* ---------- fix 1: printed math always adds up ---------- */
test('corrected quotes pass every printed-math check, all five models', function () {
  MODELS.forEach(function (n) {
    var p = priced(n);
    var printed = {
      lines: p.lines.map(function (l) { return { sku: l.sku, qty: l.qty, unitCents: l.unitCents, totalCents: l.totalCents }; }),
      cabinetsCents: p.summary.cabinetsCents, discountCents: p.summary.discountCents, laborCents: p.summary.laborCents,
      gaCents: p.summary.gaCents, taxCents: p.summary.taxCents, totalCents: p.summary.totalCents,
      gaPct: O.pricing.gaPct, taxPct: O.pricing.taxPct
    };
    eq(Q.verifyPrinted(printed), [], n);
  });
});

test('unit price is rounded first, then multiplied', function () {
  var acm8 = priced('Cimarron Peak').lines.filter(function (l) { return l.sku === 'ACM8-SBW'; })[0];
  eq([acm8.unitCents, acm8.qty, acm8.totalCents], [12461, 2, 24922]);   // $124.61 × 2 = $249.22
});

test('summary rows include the subtotal every % is based on', function () {
  var p = priced('Cimarron Peak');
  eq(p.rows.map(function (r) { return [r.label, r.cents]; }), [
    ['Cabinets', 676570], ['Mfr. bulk discount', -47512], ['Product subtotal', 629058], ['Assembly labor', 23575],
    ['G&A (2% of product + labor)', 13053], ['Tax (7.9% of product)', 49696], ['Contracted total', 715382]
  ]);
});

test('corrected totals vs signed: within 7¢ on every model', function () {
  var diffs = {};
  MODELS.forEach(function (n) { diffs[n] = Math.round(O.models[n].contract.total * 100) - priced(n).summary.totalCents; });
  eq(diffs, { 'San Luis': 2, 'Mesa Ridge': -7, 'Sangre Vista': 3, 'Pinyon Crest': 4, 'Cimarron Peak': -1 });
});

/* ---------- fix 2: discount label ---------- */
test('customer rows never print the discount %; internal note explains it', function () {
  var p = priced('Cimarron Peak');
  var d = p.rows.filter(function (r) { return r.key === 'discount'; })[0];
  eq(d.label, 'Mfr. bulk discount');
  eq(p.internal.discountNote, '12% of your cost $3,959.33 (not of the customer price)');
  var html = Q.renderHouseQuoteDoc(p, { house: 'Cimarron Peak 2' });
  ok(html.indexOf('discount (12%)') === -1 && html.indexOf('Mfr. bulk discount</td>') > -1, 'doc label');
});

test('the Fremont Makers logo (mark + wordmark) is top left on the customer document', function () {
  var html = Q.renderHouseQuoteDoc(priced('Cimarron Peak'), { house: 'Cimarron Peak 2' });
  var head = html.slice(html.indexOf('<header class="doc-head">'), html.indexOf('</header>'));
  ok(head.indexOf('<header class="doc-head"><div class="doc-logo" role="img" aria-label="Fremont Makers, making freedom">') === 0, 'logo is the first thing in the header');
  ok(head.indexOf('src="assets/brand/fm-tagline-juniper.png"') > -1, 'official making-freedom logo in Juniper');
  ok(head.indexOf('fm-mark') === -1, 'no separate F/M mark (owner, Oct 28)');
  ok(Q.logoHTML({ logoBase: '/project-builder/phase1/assets/brand/' }).indexOf('src="/project-builder/phase1/assets/brand/fm-tagline-juniper.png"') > -1, 'logoBase moves the files');
});

test('the customer document never shows cost, markup or margin', function () {
  var p = priced('Cimarron Peak');
  var html = Q.renderHouseQuoteDoc(p, { house: 'Cimarron Peak 2', buyer: 'Willow Creek Estates', signer: 'Rod Stambaugh' });
  ok(html.indexOf('$278.56') === -1, 'unit cost leaked');
  ok(html.indexOf('$3,959.33') === -1, 'cost total leaked');
  ok(!/markup|margin/i.test(html), 'markup/margin leaked');
  ok(html.indexOf('Signer: Rod Stambaugh') > -1, 'signer shown');
  ok(html.indexOf('Not set') > -1, 'missing address is called out, not "—"');
});

/* ---------- signed contracts are never repriced ---------- */
test('reconcileToSigned keeps the signed total and shows the rounding line', function () {
  var r = Q.reconcileToSigned(priced('Mesa Ridge'), 749775);
  eq(r.summary.totalCents, 749775);
  eq(r.rows.slice(-2).map(function (x) { return [x.label, x.cents]; }), [['Rounding adjustment (to signed total)', -7], ['Contracted total', 749775]]);
  var same = Q.reconcileToSigned(priced('Cimarron Peak'), priced('Cimarron Peak').summary.totalCents);
  ok(!same.rows.some(function (x) { return x.key === 'rounding'; }), 'no row when nothing to adjust');
});

test('reconciled quotes still add up line by line', function () {
  MODELS.forEach(function (n) {
    var r = Q.reconcileToSigned(priced(n), Math.round(O.models[n].contract.total * 100));
    var sum = r.rows.filter(function (x) { return !x.total && !x.subtotal && x.key !== 'cabinets'; })
      .reduce(function (t, x) { return t + x.cents; }, r.summary.cabinetsCents);
    eq(sum, r.summary.totalCents, n);
  });
});

test('a difference over $1.00 is a pricing change, not rounding', function () {
  eq(Q.reconcileToSigned(priced('San Luis'), 600000).error, 'Corrected math differs from the signed total by $85.95. That needs a change order, not a rounding adjustment.');
});

/* ---------- inputs ---------- */
test('bad lines are refused', function () {
  eq(Q.priceHouse({ lines: [{ sku: 'X', qty: 1.5, unitCostCents: 100, markupPct: 10 }] }).error, 'Line 1 needs a whole-number quantity.');
  eq(Q.priceHouse({ lines: [{ sku: 'X', qty: 1, unitCostCents: 100, markupPct: -5 }] }).error, 'Line 1 needs a markup of 0% or more.');
});

test('at-cost lines are listed for the internal view', function () {
  eq(priced('Cimarron Peak').internal.atCostLines, ['F342-SBW', 'TUK-SBW']);
});

var summary = 'Phase 1 house quotes · ' + Q.VERSION + '\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
