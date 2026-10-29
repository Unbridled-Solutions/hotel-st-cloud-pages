/*
 * Phase 2 bid page and grandfathered-price tests. Run with:   node tests/bid.test.js
 * Penrose (FM-2609-314): corrected itemized price $8,785.09, signed bid $10,973.11.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var Q = isNode ? require('../src/fm-phase1-quote.js') : globalThis.FMQuote;
var BID = isNode ? require('../src/fm-phase2-bid.js') : globalThis.FMBid;
var B = isNode ? require('../preview/braddy-penrose-order.js') : globalThis.FM_BRADDY_ORDER;
var W = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;

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
function penrose() { return Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing)); }

test('bid page: every cabinet with quantity, one agreed price, and no prices anywhere', function () {
  var p = BID.bidPage(penrose(), 1097311);
  eq(p.customer.rows.length, 18);
  eq(p.customer.rows[1], { description: 'Dark Hickory Shaker SM8', sku: 'SM8-VDH', qty: 5 });
  eq([p.customer.totalLabel, p.customer.totalCents], ['Agreed bid price', 1097311]);
  var page = JSON.stringify(p.customer);
  ok(!/Cents"|unit|cost|markup|8785|2188/i.test(page.replace('totalCents', '')), 'customer page has no prices or margin: ' + page.slice(0, 200));
});

test('bid page keeps the itemized price and the difference internally', function () {
  var i = BID.bidPage(penrose(), 1097311).internal;
  eq([i.itemizedCents, i.bidCents, i.differenceCents], [878509, 1097311, 218802]);
  eq(i.note, 'Bid is $2,188.02 above the itemized price.');
});

test('a bid needs an agreed price', function () {
  var threw = false; try { BID.bidPage(penrose(), 0); } catch (e) { threw = /agreed bid price/.test(e.message); }
  ok(threw);
});

test('Penrose comes over at its signed total with one grandfathered line', function () {
  var g = BID.grandfather(penrose(), 1097311, { jobCode: 'FM-2609-314', signedDate: '2026-09-16' });
  eq([g.kind, g.totalCents, g.differenceCents, g.internalOnly], ['grandfathered', 1097311, 218802, true]);
  eq(g.line, { key: 'grandfathered', label: 'Agreed price (grandfathered from signed contract, 2026-09-16)', cents: 218802 });
  eq(g.log, 'FM-2609-314: brought over at its signed total $10,973.11. Corrected itemized price $8,785.09; $2,188.02 recorded as agreed (grandfathered) pricing.');
});

test('a few cents stays a rounding adjustment, not a grandfathered line', function () {
  var p = penrose();
  eq(BID.grandfather(p, 878509).kind, 'match');
  var r = BID.grandfather(p, 878505); eq([r.kind, r.differenceCents, r.line], ['rounding', -4, null]);
});

test('Willow Creek houses (not bid-priced) need no grandfathered line', function () {
  var kinds = Object.keys(W.models).map(function (k) { var m = W.models[k];
    var priced = Q.priceHouse(Q.inputFromOrderModel(m, W.pricing));
    return BID.grandfather(priced, FM.toCents(m.contract.total)).kind;
  });
  ok(kinds.every(function (k) { return k === 'match' || k === 'rounding'; }), JSON.stringify(kinds));
});

console.log('bid.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
