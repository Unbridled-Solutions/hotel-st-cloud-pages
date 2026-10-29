/*
 * Phase 1 customer documents you can open from a job. Run with:   node tests/docs.test.js
 * Uses the sample Penrose and Willow Creek jobs (preview/sample-data.js).
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var Q = isNode ? require('../src/fm-phase1-quote.js') : globalThis.FMQuote;
var D = isNode ? require('../src/fm-phase1-docs.js') : globalThis.FMDocs;
var SAMPLE = isNode ? require('../preview/sample-data.js') : globalThis.FM_SAMPLE;
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
function has(html, s) { ok(html.indexOf(s) > -1, 'missing: ' + s); }
function hasNot(html, s) { ok(html.indexOf(s) === -1, 'should not contain: ' + s); }
function count(html, s) { return html.split(s).length - 1; }

var TODAY = SAMPLE.today;
var JOBS = FM.jobsFromLegacy(SAMPLE.legacyProjects);
function job(code) { return JOBS.filter(function (j) { return j.jobCode === code; })[0]; }
var PEN = job('FM-2609-314'), WIL = job('FM-2609-276');

test('every document starts with the logo', function () {
  var html = D.renderInvoiceDoc(PEN, PEN.invoices[1], { today: TODAY });
  ok(html.indexOf('<header class="doc-head"><div class="doc-logo"') > -1, 'logo first in header');
  has(html, 'fm-tagline-juniper.png'); hasNot(html, 'fm-mark');
});

test('a paid invoice: amount, share, check number, PAID stamp, nothing due', function () {
  var html = D.renderInvoiceDoc(PEN, PEN.invoices[1], { today: TODAY, index: 1, count: 3 });
  has(html, '<h1>Invoice 2</h1>'); has(html, '$3,365.60'); has(html, '30.67% of the contract total');
  has(html, 'October 5, 2026 · Check 2967'); has(html, 'class="doc-stamp"');
  has(html, 'Amount due this invoice</td><td class="r">$0.00'); has(html, 'Invoice 2 of 3');
  has(html, 'Signer: Bernard Braddy'); has(html, 'November 9, 2026');
});

test('a paid invoice with no check number says so; the deposit explains the factory order', function () {
  var html = D.renderInvoiceDoc(PEN, PEN.invoices[0], { today: TODAY });
  has(html, 'no check number recorded'); has(html, 'The factory order is placed once this invoice is paid in full.');
});

test('an unpaid invoice shows what is due and no stamp', function () {
  var html = D.renderInvoiceDoc(PEN, PEN.invoices[2], { today: TODAY });
  has(html, 'Amount due this invoice</td><td class="r">$2,243.74'); hasNot(html, 'doc-stamp'); hasNot(html, '<td>Paid</td>');
});

test('a change order invoice is billed on its own, without a contract share', function () {
  var co = WIL.invoices.filter(function (i) { return i.role === 'change_order'; })[0];
  var html = D.renderInvoiceDoc(WIL, co, { today: TODAY });
  has(html, 'Billed separately for a change order.'); has(html, '$8,740.71'); hasNot(html, 'of the contract total</span>');
});

test('payment schedule lists every invoice and flags totals that don\'t match', function () {
  var p = D.renderScheduleDoc(PEN, { today: TODAY });
  eq(count(p, '<tr><td>Invoice'), 3); has(p, 'Total invoiced</td><td class="r">$10,973.11'); hasNot(p, 'Invoices total');
  var w = D.renderScheduleDoc(WIL, { today: TODAY });
  has(w, 'Invoices total $80,888.05; the contract total is $72,147.34.');   // the change order isn't attached yet
});

test('contract packet: summary, schedule, each invoice, then the quote pages', function () {
  var priced = Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing));
  var quote = D.renderBidQuoteDoc(priced, 1097311, { house: 'Penrose', buyer: 'Braddy Builders', jobCode: 'FM-2609-314' });
  var html = D.renderPacket(PEN, { today: TODAY, quotes: [quote], agreementOnFile: true });
  eq(count(html, '<article class="fm-p1-doc'), 1 + 1 + 3 + 1);
  has(html, 'aria-label="Contract summary"'); has(html, 'Contract total</td><td class="r">$10,973.11');
  has(html, 'The signed Customer Sales Agreement is attached to this job');
  ok(html.indexOf('aria-label="Payment schedule"') < html.indexOf('aria-label="Invoice 1') && html.indexOf('aria-label="Invoice 3') < html.indexOf('aria-label="Final Job Quote Penrose"'), 'page order');
  has(D.renderPacket(PEN, { today: TODAY }), 'is not on file');
});

test('a builder-order packet is titled with the customer; long titles get the smaller size', function () {
  var html = D.renderPacket(WIL, { today: TODAY });
  has(html, '<div class="doc-kicker">Contract packet · 10 houses</div><h1>Willow Creek Estates</h1>');
  hasNot(html, '<h1>2 Cimarron Peak');
  var long = JSON.parse(JSON.stringify(PEN)); long.projectName = 'Penrose Lot 14 with the long name & garage';
  var p = D.renderPacket(long, { today: TODAY });
  has(p, 'doc-title doc-title--long'); has(p, '<h1>Penrose Lot 14 with the long name &amp; garage</h1>'); hasNot(p, '&amp;amp;');
});

test('a bid-priced quote prints quantities and one agreed price, and no cost or line prices', function () {
  var priced = Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing));
  var html = D.renderBidQuoteDoc(priced, 1097311, { house: 'Penrose' });
  eq(count(html, '<td class="sku">'), 18);
  has(html, 'Agreed bid price</td><td class="r">$10,973.11');
  eq((html.match(/\$[0-9,]+\.\d\d/g) || []), ['$10,973.11']);
});

console.log('docs.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
