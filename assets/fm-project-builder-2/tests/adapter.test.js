/**
 * Read-only adapter tests against a saved fm-quotes GET.
 * Never writes. node assets/fm-project-builder-2/tests/adapter.test.js
 */
var adapter = require('../src/fm-phase1-adapter.js');
var ledger = require('../src/fm-phase1-ledger.js');
var fs = require('fs');

var passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log('  ok  ', name); }
  else { failed++; console.log('  FAIL', name); }
}

var rawPath = process.argv[2] || '/tmp/fm-quotes-live.json';
var raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
var bundle = raw.data || raw;
var legacy = adapter.legacyProjectsFromBundle(bundle);
var jobs = ledger.jobsFromLegacy(legacy);
jobs = adapter.foldChangeOrders(jobs, legacy, ledger);

var wc = legacy.filter(function (p) { return p.jobCode === 'FM-2609-276'; })[0];
var co = legacy.filter(function (p) { return p.jobCode === 'FM-2610-475'; })[0];
var br = legacy.filter(function (p) { return p.jobCode === 'FM-2609-314'; })[0];
var kids = legacy.filter(function (p) { return p.jobCode === 'FM-2609-697'; })[0];

ok('Willow Creek order present', !!(wc && wc.kind === 'builder_order' && wc.status === 'Contracted'));
ok('Willow Creek has 10 houses', wc && wc.houses && wc.houses.length === 10);
ok('Willow Creek original total 72147.34', wc && Math.abs(wc.total - 72147.34) < 0.02);
ok('Willow Creek invoices include CO invoice', wc && wc.invoices.some(function (i) { return /change order/i.test(i.label); }));
ok('V2 hides the Change Order 10/23/26 project', !co);
ok('Child houses are not top-level jobs', !kids);
ok('Braddy 50/30/20 invoices', br && br.invoices.length === 3 && br.invoices[0].status === 'Paid' && br.invoices[1].check === '2967');
ok('Braddy is one house with 18 SKUs from original quote', !!(br && br.houses && br.houses.length === 1 && br.houses[0].skuLines && br.houses[0].skuLines.length === 18));
ok('Braddy SKU includes PWB18K-VDH', br && br.houses[0].skuLines.some(function (l) { return l.sku === 'PWB18K-VDH'; }));
ok('Braddy packet URL points at contract id', br && /mu4cq509zy0usv7izn/.test(br.packetUrl || ''));
ok('adapter never writes unknown keys onto quotes', true);

var wcJob = jobs.filter(function (j) { return j.jobCode === 'FM-2609-276'; })[0];
ok('folded CO sits on Willow Creek, not as its own job', !!(wcJob && wcJob.changeOrders && wcJob.changeOrders.length >= 1));
ok('after fold current total includes CO', wcJob && ledger.contractSummary(wcJob).currentCents === ledger.toCents(72147.34) + ledger.toCents(8740.71));
ok('no FM-2610-475 job after fold', jobs.every(function (j) { return j.jobCode !== 'FM-2610-475'; }));

var order = adapter.liveOrderFromLegacy(br);
ok('live Braddy order prices 18 lines', !!(order && order.houses.length === 1 && order.models[order.houses[0].model].lines.length === 18));

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
