/*
 * Willow Creek full-order pricing tests. Run with:   node tests/pricing.test.js
 * Expected values come from "Willow Creek Full House Order.pdf" and the
 * Oct 27 10:02 AM screen recording.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var PR = isNode ? require('../src/fm-phase1-pricing.js') : globalThis.FMPricing;
var ORDER = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;
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

var priced = PR.priceOrder(ORDER);
function house(name) { return priced.houses.filter(function (h) { return h.name === name; })[0]; }

test('all 10 houses and 154 SKU lines are in the order', function () {
  eq(priced.houses.length, 10);
  eq(priced.skuLineCount, 154);
  eq(priced.houses.map(function (h) { return h.lineCount; }), [12, 12, 15, 15, 19, 19, 15, 15, 16, 16]);
});

test('every SKU line and every contract figure reconciles to the cent', function () {
  eq(PR.reconcileWithContract(ORDER), []);
});

test('house totals, model totals and order total match the contract', function () {
  eq(priced.houses.map(function (h) { return [h.name, h.totalCents]; }), [
    ['San Luis 1', 608597], ['San Luis 2', 608597], ['Mesa Ridge 1', 749775], ['Mesa Ridge 2', 749775],
    ['Sangre Vista 1', 754416], ['Sangre Vista 2', 754416], ['Pinyon Crest 1', 779198], ['Pinyon Crest 2', 779198],
    ['Cimarron Peak 1', 715381], ['Cimarron Peak 2', 715381]
  ]);
  eq(priced.orderTotalCents, 7214734);
  eq(priced.models.map(function (m) { return [m.model, m.houses, m.totalCents]; }), [
    ['San Luis', 2, 1217194], ['Mesa Ridge', 2, 1499550], ['Sangre Vista', 2, 1508832], ['Pinyon Crest', 2, 1558396], ['Cimarron Peak', 2, 1430762]
  ]);
});

test('full order agrees with the Phase 1 job data (house codes and totals)', function () {
  var w = FM.jobsFromLegacy(SAMPLE.legacyProjects).filter(function (j) { return j.jobCode === 'FM-2609-276'; })[0];
  var fromJob = {}; w.houses.forEach(function (h) { fromJob[h.jobCode] = h.totalCents; });
  priced.houses.forEach(function (h) { eq(h.totalCents, fromJob[h.jobCode], h.name); });
  eq(FM.modelTotals(w.houses).orderTotalCents, priced.orderTotalCents);
});

test('San Luis 1 breakdown: discount, assembly, G&A, tax', function () {
  var h = house('San Luis 1');
  eq([h.costCents, h.cabinetsCents, h.discountCents, h.productCents, h.assemblyCents, h.gaCents, h.taxCents, h.totalCents],
    [337079, 570440, 40449, 529991, 25625, 11112, 41869, 608597]);
  eq(h.assembly, { rate: 20.5, hours: 12.5 });
});

test('discount is 12% of manufacturer cost, not of the sell total', function () {
  priced.houses.forEach(function (h) { eq(h.discountCents, Math.round(h.costCents * 0.12), h.name); });
  ok(house('San Luis 1').discountCents !== Math.round(house('San Luis 1').cabinetsCents * 0.12));
});

test('legacy rounding: three houses print lines that are 1¢ off their total', function () {
  eq(priced.houses.filter(function (h, i) { return i % 2 === 0; }).map(function (h) { return [h.model, h.roundingGapCents, h.lineSumGapCents]; }), [
    ['San Luis', 0, 0], ['Mesa Ridge', -1, -1], ['Sangre Vista', 0, 0], ['Pinyon Crest', -1, 1], ['Cimarron Peak', 1, 1]
  ]);
});

test('cents mode always adds up, but would move signed totals by up to 2¢', function () {
  var cents = PR.priceOrder(ORDER, { mode: 'cents' });
  cents.houses.forEach(function (h) {
    eq(h.roundingGapCents, 0, h.name + ' gap');
    eq(h.lineSumGapCents, 0, h.name + ' line gap');
  });
  eq(cents.houses.filter(function (h, i) { return i % 2 === 0; }).map(function (h, i) { return [h.model, h.totalCents - priced.houses[i * 2].totalCents]; }),
    [['San Luis', 0], ['Mesa Ridge', -2], ['Sangre Vista', 0], ['Pinyon Crest', 0], ['Cimarron Peak', 2]]);
  eq(cents.orderTotalCents - priced.orderTotalCents, 0, 'order total happens to net to zero');
});

test('markups by model, and lines sold at cost', function () {
  function rates(name) { var s = {}; house(name).lines.forEach(function (l) { s[l.markupPct] = (s[l.markupPct] || 0) + 1; }); return s; }
  eq(rates('San Luis 1'), { 0: 1, 50: 1, 70: 10 });
  eq(rates('Mesa Ridge 1'), { 0: 1, 10: 1, 19: 13 });
  eq(rates('Sangre Vista 1'), { 0: 2, 42: 17 });
  eq(rates('Pinyon Crest 1'), { 0: 2, 18: 13 });
  eq(rates('Cimarron Peak 1'), { 0: 2, 58: 1, 72: 13 });
  eq(house('Cimarron Peak 1').atCostSkus, ['F342-SBW', 'TUK-SBW']);
});

test('cabinet profit and margin by model', function () {
  eq(priced.houses.filter(function (h, i) { return i % 2 === 0; }).map(function (h) { return [h.model, h.cabinetProfitCents, h.cabinetMarginPct, h.blendedMarkupPct]; }), [
    ['San Luis', 233361, 40.9, 69.2], ['Mesa Ridge', 116157, 15.8, 18.8], ['Sangre Vista', 214541, 29.3, 41.5],
    ['Pinyon Crest', 116361, 15.1, 17.8], ['Cimarron Peak', 280637, 41.5, 70.9]
  ]);
});

test('pricing never changes its input', function () {
  var before = JSON.stringify(ORDER);
  PR.priceOrder(ORDER); PR.priceOrder(ORDER, { mode: 'cents' }); PR.reconcileWithContract(ORDER);
  eq(JSON.stringify(ORDER), before);
});

var summary = 'Willow Creek pricing · ' + PR.VERSION + '\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
