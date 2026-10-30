/*
 * Phase 2 courtesy change order tests. Run with:   node tests/changeorder.test.js
 * Uses Penrose Change Order 1 (8:34 PM recording) and supplier order #1000173203.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var CO = isNode ? require('../src/fm-phase2-changeorder.js') : globalThis.FMChangeOrder;
var FM = isNode ? require('../src/fm-phase1-ledger.js') : globalThis.FMPhase1;
var Q = isNode ? require('../src/fm-phase1-quote.js') : globalThis.FMQuote;
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
var C = FM.toCents, TODAY = '2026-10-27';
var REC = B.changeOrders[0];
var SO = B.supplierOrders.filter(function (s) { return s.orderNumber === REC.supplierOrder; })[0];

// Change Order 1 as it should be recorded: real costs, linked supplier order.
function penroseInput(over) {
  var i = { number: 1, date: REC.date, reason: 'backorder', note: 'Backordered cabinets swapped for in-stock ones', requestedBy: 'Linds',
    removed: REC.removed, removedSellCents: C(REC.removedSell),
    added: REC.added.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: C(l.unitCost) }; }),
    supplierOrder: { number: SO.orderNumber, paidCents: C(SO.total) }, supplierCreditCents: null };
  for (var k in over) i[k] = over[k]; return i;
}

test('Penrose CO 1 as recorded today is flagged: the added cabinets are at $0 cost', function () {
  var asEntered = penroseInput({ added: REC.added.map(function (l) { return { sku: l.sku, qty: l.qty, unitCostCents: C(l.unitCostAsEntered) }; }) });
  var r = CO.courtesy(asEntered, { today: TODAY });
  eq(r.ok, false); eq(r.problems.length, 2);
  ok(/VDC42RS-VDH cost us\. It was entered at \$0/.test(r.problems[0]), r.problems[0]);
});

test('with real costs, the customer pays nothing and the contract total does not move', function () {
  var r = CO.courtesy(penroseInput(), { today: TODAY });
  eq(r.ok, true);
  eq([r.co.amountCents, r.co.customerChangeCents, r.co.contractDeltaCents], [0, 0, 0]);
  eq(r.co.addedCostCents, 160044);                       // 707.92 + 2 × 446.26, the supplier subtotal
  eq(r.co.addedCostCents, C(SO.subtotal));
});

test('absorbed cost uses what was actually paid, less any supplier credit', function () {
  var r = CO.courtesy(penroseInput(), { today: TODAY });
  eq([r.co.absorbedCents, r.co.absorbedIsEstimate], [165270, true]);   // $1,652.70 paid by card; credit unknown
  ok(/credited the removed cabinets \(DC324-VDH ×2, VDC12-VDH ×1\)/.test(r.warnings[0]), r.warnings[0]);
  var none = CO.courtesy(penroseInput({ supplierCreditCents: C(REC.supplierCredit) }), { today: TODAY });
  eq([none.co.absorbedCents, none.co.absorbedIsEstimate], [165270, false], 'owner, Oct 29: no supplier credit, so $1,652.70 is final');
  var c = CO.courtesy(penroseInput({ supplierCreditCents: 50000 }), { today: TODAY });
  eq([c.co.absorbedCents, c.co.absorbedIsEstimate, c.warnings.length], [115270, false, 0]);
  var n = CO.courtesy(penroseInput({ supplierOrder: null }), { today: TODAY });
  eq(n.co.absorbedCents, 160044); ok(/Link the supplier order/.test(n.warnings[1]));
});

test('a courtesy change order needs a reason (and a note for "other"), lines, a date and a person', function () {
  var r = CO.courtesy({ reason: 'other', removed: [], added: [], date: '2026-11-30' }, { today: TODAY });
  eq(r.problems, ['Add a note saying why.', 'Add the cabinets that came off or went on.', 'The change date can\'t be in the future.', 'Sign in so the change is recorded under your name.']);
  eq(CO.courtesy(penroseInput({ reason: '' }), { today: TODAY }).problems, ['Choose why this change is a courtesy.']);
});

test('only the owner approves; approval logs what the shop absorbed', function () {
  var co = CO.courtesy(penroseInput(), { today: TODAY }).co;
  eq(CO.approve(co, 'Sam', { owners: ['Linds'] }).error, 'Only the owner can approve a courtesy change order.');
  var a = CO.approve(co, 'Linds', { owners: ['Linds'], at: '2026-10-14' });
  eq([a.ok, a.co.status, a.co.approvedBy], [true, 'approved', 'Linds']);
  eq(a.log, 'Change order 1 (courtesy, no charge) approved by Linds. Shop absorbs $1,652.70 (before any supplier credit). Contract total unchanged.');
  eq(CO.approve(a.co, 'Linds', { owners: ['Linds'] }).ok, false);
  eq(co.status, 'draft');   // approve never changes its input
});

test('the customer page says no charge, lists the swap, and never shows cost', function () {
  var co = CO.courtesy(penroseInput(), { today: TODAY }).co;
  var p = CO.printed(co, { contractTotalCents: 1097311 });
  eq(p.headline, 'No charge to you. Your contract total stays $10,973.11.');
  eq(p.why, 'Backordered item substituted: Backordered cabinets swapped for in-stock ones.');
  eq(p.rows.map(function (r) { return [r.action, r.sku, r.qty, r.price]; }), [
    ['Removed', 'DC324-VDH', '2 → 0', ''], ['Removed', 'VDC12-VDH', '1 → 0', ''],
    ['Added', 'VDC42RS-VDH', '0 → 1', 'No charge'], ['Added', 'DC224-VDH', '0 → 2', 'No charge']]);
  ok(JSON.stringify(p).indexOf('1,652.70') < 0 && JSON.stringify(p).indexOf('707') < 0, 'no costs on the customer page');
});

test('the ledger keeps the contract total at $10,973.11 with the courtesy change order attached', function () {
  var co = CO.approve(CO.courtesy(penroseInput(), { today: TODAY }).co, 'Linds', { owners: ['Linds'] }).co;
  co.id = 'co1';
  ['approved', 'signed'].forEach(function (st) {
    co.status = st;
    var s = FM.contractSummary({ originalContractCents: 1097311, changeOrders: [co], invoices: [] });
    eq([s.currentCents, s.changeOrderCents], [1097311, 0], st);
  });
});

test('absorbed total across a job counts approved courtesy change orders only', function () {
  var draft = CO.courtesy(penroseInput(), { today: TODAY }).co;
  var approved = CO.approve(draft, 'Linds', { owners: ['Linds'] }).co;
  eq(CO.absorbedTotal([draft]), { count: 0, cents: 0, estimate: false });
  eq(CO.absorbedTotal([draft, approved]), { count: 1, cents: 165270, estimate: true });
});

/* ---------- the change order flow (8:57 PM recording) ---------- */

var HOUSE = [ { sku: 'W362424-SBW', desc: 'Bayview White Shaker W362424', qty: 1 },
              { sku: 'SM8(SCR)-SBW', desc: 'Bayview White Shaker SM8(SCR)', qty: 3 } ];
var PDF = [ { sku: 'SM8(SCR)-SBW', desc: 'Bayview White Shaker SM8(SCR)', qty: 1 },
            { sku: 'W3024-SBW', desc: 'Bayview White Shaker W3024', qty: 4 },
            { sku: 'FPV4296-UMO', desc: 'Moss Green Shaker FPV4296', qty: 3 },
            { sku: 'W3024-SWD', desc: 'Bayview Wood Shaker W3024', qty: 2 } ];

test('adding a PDF never lowers a quantity (today: SM8(SCR) went 3 → 1)', function () {
  var m = CO.mergeLines(HOUSE, PDF, 'add');
  eq(m.changed, [{ sku: 'SM8(SCR)-SBW', desc: 'Bayview White Shaker SM8(SCR)', from: 3, to: 4 }]);
  eq(m.added.map(function (a) { return a.sku + ' ' + a.from + '→' + a.to; }), ['W3024-SBW 0→4', 'FPV4296-UMO 0→3', 'W3024-SWD 0→2']);
  eq(m.removed, []);
  var r = CO.mergeLines(HOUSE, PDF.slice(0, 2), 'replace');
  eq([r.removed.map(function (x) { return x.sku; }), r.changed[0].to], [['W362424-SBW'], 1]);
});

test('color check flags cabinets that don\'t match the house (Mesa Ridge is Moss Green)', function () {
  eq(W.models['Mesa Ridge'].suffix, 'UMO');
  eq(CO.colorCheck(PDF, 'UMO').map(function (x) { return x.sku; }), ['SM8(SCR)-SBW', 'W3024-SBW', 'W3024-SWD']);
  eq(CO.colorCheck([{ sku: 'FP9624-1.5-VDH', qty: 1 }], 'VDH'), []);
});

test('a whole-order PDF is split by color, with the models that use each color', function () {
  var models = {}; Object.keys(W.models).forEach(function (n) { models[n] = W.models[n].suffix; });
  var s = CO.splitByColor(PDF.concat([{ sku: 'XYZ-QQQ', qty: 1 }]), models);
  eq(s.groups.map(function (g) { return [g.suffix, g.models, g.lines.length]; }),
     [['SBW', ['San Luis', 'Cimarron Peak'], 2], ['UMO', ['Mesa Ridge', 'Pinyon Crest'], 1], ['SWD', ['Sangre Vista'], 1]]);
  eq(s.unmatched.map(function (l) { return l.sku; }), ['XYZ-QQQ']);
});

test('a change is priced with the job\'s own settings (Penrose: +1 BC24 = $471.80)', function () {
  var settings = { markupPct: 30, discountPctOfCost: 5, gaPct: 5, taxPct: 8.7 };
  var bc24 = { sku: 'BC24-VDH', desc: 'Dark Hickory Shaker BC24', qty: 1, unitCostCents: 33196 };
  // unit 431.55, discount 16.60, product 414.95, G&A 20.75, tax 36.10 → 471.80
  var p = CO.priceChange({ added: [bc24], removed: [] }, settings);
  eq([p.ok, p.addedCents, p.deltaCents], [true, 47180, 47180]);
  var swap = CO.priceChange({ added: [bc24], removed: [bc24] }, settings);
  eq(swap.deltaCents, 0);
  eq(CO.priceChange({ added: [{ sku: 'X-VDH', qty: 1.5, unitCostCents: 100 }] }, settings).ok, false);
});

test('a change order can use its own settings and assembly labor (Willow Creek CO 1: 5% discount, 5 h × $20.50)', function () {
  var settings = { markupPct: 35, discountPctOfCost: 5, gaPct: 2, taxPct: 7.9, labor: [{ role: 'Assembly', rateCents: 2050, hours: 5 }] };
  var line = { sku: 'B30-SBW', desc: 'Bayview White Shaker B30', qty: 2, unitCostCents: 40000, markupPct: 50 };
  // unit 600.00 → cabinets 1,200.00; discount 5% of 800.00 = 40.00; product 1,160.00; labor 102.50; G&A 2% of 1,262.50 = 25.25; tax 7.9% of 1,160.00 = 91.64 → 1,379.39
  var p = CO.priceChange({ added: [line], removed: [] }, settings);
  eq([p.summary.cabinetsCents, p.summary.discountCents, p.summary.laborCents, p.summary.gaCents, p.summary.taxCents, p.deltaCents], [120000, -4000, 10250, 2525, 9164, 137939]);
  eq(p.lines.map(function (l) { return [l.sku, l.qty, l.unitCents, l.totalCents]; }), [['B30-SBW', 2, 60000, 120000]]);
  var swap = CO.priceChange({ added: [line], removed: [Object.assign({}, line, { qty: 1 })] }, settings);
  eq(swap.lines.map(function (l) { return [l.qty, l.totalCents, !!l.removed]; }), [[2, 120000, false], [-1, -60000, true]]);
  eq(swap.summary.laborCents, 10250, 'labor is charged on the added side only');
  eq(CO.priceChange({ added: [line] }, { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9 }).summary.discountCents, -9600, 'the job\'s 12% when not overridden');
});

test('there is no default price choice; an agreed amount needs a reason', function () {
  var priced = { ok: true, deltaCents: 746638 };
  eq(CO.choosePrice(undefined, priced).error, 'Choose how this change is priced: charge it, courtesy, or an agreed amount.');
  eq(CO.choosePrice('courtesy', priced), { ok: true, amountCents: 0, kind: 'courtesy' });
  eq(CO.choosePrice('charge', priced).amountCents, 746638);
  eq(CO.choosePrice('custom', priced, { amountCents: 780000 }).error, 'Say why the agreed amount differs from the priced change.');
  var c = CO.choosePrice('custom', priced, { amountCents: 780000, note: 'Includes rush freight' });
  eq([c.amountCents, c.differsByCents], [780000, 33362]);
});

test('each change order gets its own invoice, due on signing (owner decision, question 2)', function () {
  var inv = CO.invoiceFor({ id: 'co2', number: 2, amountCents: 47180 }, { today: '2026-10-27' });
  eq([inv.role, inv.label, inv.amountCents, inv.due, inv.status], ['change_order', 'Change order 2', 47180, '2026-10-27', 'waiting for signature']);
  eq(CO.invoiceFor({ number: 1, amountCents: 0 }), null);
  eq(CO.invoiceFor({ number: 3, amountCents: -12000 }).role, 'change_order_credit');
});

console.log('changeorder.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
