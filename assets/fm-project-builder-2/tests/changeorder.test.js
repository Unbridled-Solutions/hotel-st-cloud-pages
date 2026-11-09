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
  ok(/credited the removed cabinets \(DC324-VDH ×2, VDC12-VDH ×1, VSB30-VDH ×1\)/.test(r.warnings[0]), r.warnings[0]);
  var none = CO.courtesy(penroseInput({ supplierCreditCents: C(REC.supplierCredit) }), { today: TODAY });
  eq([none.co.absorbedCents, none.co.absorbedIsEstimate], [6291, false], 'owner, Nov 4: $1,589.79 refunded for the returned cabinets, so the shop ate $62.91');
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
    ['Removed', 'DC324-VDH', '2 → 0', ''], ['Removed', 'VDC12-VDH', '1 → 0', ''], ['Changed', 'VSB30-VDH', '3 → 2', ''],
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
  eq(CO.choosePrice(undefined, priced).error, 'Choose how this change is priced: charge it, courtesy, an agreed amount, or no change to the contract.');
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


/* ================= 2.11.0: every kind of change after the contract (HANDOFF §32) ================= */
var SETTINGS = { markupPct: 30, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9 };
var BASE = [{ sku: 'B30-VDH', desc: 'Base 30', qty: 2, unitCostCents: 30000, markupPct: 30 }, { sku: 'W3042-VDH', desc: 'Wall 3042', qty: 4, unitCostCents: 25000, markupPct: 30 }];

test('add a cabinet by hand (not on a PDF); a SKU already there just goes up', function () {
  var r = CO.addLine(BASE, { sku: 'pwb18k-vdh', desc: 'Pantry', qty: 1, unitCostCents: 22736 });
  eq([r.ok, r.lines.length, r.lines[2].sku], [true, 3, 'PWB18K-VDH']);
  eq(CO.addLine(BASE, { sku: 'B30-VDH', qty: 1, unitCostCents: 30000 }).lines[0].qty, 3);
  eq(CO.addLine(BASE, { sku: '', qty: 0 }).problems.length, 3);
  eq(BASE[0].qty, 2);
});

test('swap: the old line goes down, the new one goes on; priced as the difference', function () {
  var s = CO.swapLine(BASE, 'B30-VDH', { sku: 'B36-VDH', desc: 'Base 36', unitCostCents: 34000 }, 1);
  eq(s.lines.map(function (l) { return l.sku + ':' + l.qty; }), ['B30-VDH:1', 'W3042-VDH:4', 'B36-VDH:1']);
  var d = CO.diffLines(BASE, s.lines);
  eq([d.added.map(function (l) { return l.sku; }), d.removed.map(function (l) { return l.sku + ' ' + l.from + '→' + l.to; })], [['B36-VDH'], ['B30-VDH 2→1']]);
  var p = CO.priceChange({ added: d.added, removed: d.removed }, SETTINGS, Q);
  eq(p.ok, true); ok(p.deltaCents > 0 && p.deltaCents < 10000, 'a bigger cabinet costs a little more: ' + p.deltaCents);
  eq(CO.swapLine(BASE, 'B30-VDH', { sku: 'B30-VDH', unitCostCents: 1 }).ok, false);
  eq(CO.swapLine(BASE, 'B30-VDH', { sku: 'B36-VDH', unitCostCents: 34000 }, 3).error, 'Swap between 1 and 2 of B30-VDH.');
});

test('return with a restocking fee: customer credited what they paid, fee added (taxable), a credit overall', function () {
  var cur = JSON.parse(JSON.stringify(BASE)); cur[1].qty = 2;
  var d = CO.diffLines(BASE, cur);
  var p = CO.priceChange({ added: d.added, removed: d.removed, extras: [{ label: 'Restocking fee', amountCents: 9000, taxable: true }, { label: '', amountCents: 500 }] }, SETTINGS, Q);
  eq(p.ok, true); ok(p.deltaCents < 0, 'a credit: ' + p.deltaCents);
  eq([p.summary.otherCents, p.extras.length, p.lines[p.lines.length - 1].desc], [9000, 1, 'Restocking fee (taxable)']);
  eq(p.removedCostCents, 50000);
  var inv = CO.invoiceFor({ number: 2, amountCents: p.deltaCents }); eq(inv.role, 'change_order_credit');
});

test('damaged: replaced at our cost, no change to the contract, claim pending until paid', function () {
  var n = CO.notice({ number: 2, date: '2026-11-06', type: 'damage', note: 'W3042 arrived cracked', requestedBy: 'Linds',
    replaced: [{ sku: 'W3042-VDH', desc: 'Wall 3042', qty: 1, unitCostCents: 25000, claim: 'freight', why: 'cracked side' }] });
  eq(n.ok, true);
  eq([n.co.kind, n.co.status, n.co.amountCents, n.co.absorbedCents, n.co.absorbedIsEstimate, n.co.reason], ['notice', 'recorded', 0, 25000, true, 'Damaged cabinet replaced']);
  var c = CO.recordCredit(n.co, { for: 'damaged', from: 'freight', amountCents: 25000, on: '2026-11-20', reference: 'Claim 8812' }, { by: 'Linds', today: '2026-11-30' });
  eq([c.ok, c.co.absorbedCents, c.co.absorbedIsEstimate, c.deltaCents], [true, 0, false, -25000]);
  ok(/Freight carrier credited \$250\.00 for the damage claim \(Claim 8812\)\. Shop absorbs \$0\.00 \(was \$250\.00\)\./.test(c.log), c.log);
  eq(CO.notice({ number: 2, date: '2026-11-06', type: 'damage', note: 'x', requestedBy: 'L', replaced: [{ sku: 'A', qty: 1, unitCostCents: 0 }] }).problems,
     ['Enter what the replacement A costs us.', 'Say who the damage claim for A goes to (or that we cover it).']);
});

test('backordered, wait for it: nothing changes but the date, which must be given', function () {
  var n = CO.notice({ number: 3, date: '2026-11-06', type: 'backorder', note: 'B30 backordered', requestedBy: 'Linds', waitFor: [{ sku: 'B30-VDH', qty: 2 }], newDeliveryDate: '2026-12-12' });
  eq([n.ok, n.co.reason, n.co.absorbedCents, n.co.newDeliveryDate], [true, 'Backordered: new delivery date', 0, '2026-12-12']);
  eq(CO.notice({ number: 3, date: '2026-11-06', type: 'backorder', note: 'x', requestedBy: 'L', waitFor: [{ sku: 'B30-VDH', qty: 2 }] }).problems, ['Enter when the backordered cabinets are now expected.']);
});

test('"no change to the contract" only when nothing sells; a suggestion never picks for you', function () {
  eq(CO.choosePrice('nochange', null, null, { sellChanges: false }), { ok: true, amountCents: 0, kind: 'notice' });
  ok(/replacements and new dates only/.test(CO.choosePrice('nochange', null, null, { sellChanges: true }).error));
  eq(CO.suggest('damage', { added: [], removed: [], replaced: [{}] }, []).choice, 'nochange');
  eq(CO.suggest('backorder', { added: [{}], removed: [{}] }, []).choice, 'courtesy');
  eq(CO.suggest('remove', { added: [], removed: [{}] }, []).choice, 'charge');
  eq(CO.suggest('other', { added: [], removed: [] }, [{ label: 'Freight', amountCents: 5000 }]), null);
});

test('Penrose CO 1 keeps its numbers under the new rules ($62.91 absorbed after the refund)', function () {
  var r = CO.courtesy(penroseInput({ supplierCreditCents: C(REC.supplierCredit) }), { today: TODAY });
  eq([r.co.absorbedCents, r.co.absorbedIsEstimate, CO.absorbedFor(r.co).cents], [6291, false, 6291]);
  var a = CO.approve(r.co, 'Linds', { owners: ['Linds'] }).co;
  eq(CO.absorbedOnJob([a]), 6291);
  eq(CO.absorbedOnJob([r.co]), 0, 'a draft or pending courtesy is not counted yet');
});

test('a charged return: once the supplier credit comes in short, the shortfall is absorbed', function () {
  var co = { kind: 'charge', status: 'signed', number: 4, removed: [{ sku: 'W3042-VDH', qty: 2 }], removedCostCents: 50000, replaced: [], replacedCostCents: 0 };
  eq(CO.absorbedFor(co), { cents: 0, estimate: true });
  var c = CO.recordCredit(co, { for: 'returned', amountCents: 42500, on: '2026-11-10' }, { by: 'Linds', today: '2026-11-10' });
  eq([c.co.absorbedCents, c.co.absorbedIsEstimate, c.co.supplierCreditCents], [7500, false, 42500]);
  var none = CO.recordCredit(co, { for: 'returned', none: true, on: '2026-11-10' }, { by: 'Linds', today: '2026-11-10' });
  eq(none.co.absorbedCents, 50000);
  eq(CO.recordCredit(co, { for: 'damaged', amountCents: 1, on: '2026-11-10' }, { by: 'L' }).error, 'Nothing was replaced on this change order.');
  eq(CO.recordCredit(co, { for: 'returned', amountCents: 1, on: '2026-12-10' }, { by: 'L', today: '2026-11-10' }).error, 'The credit date can\'t be in the future.');
});

test('withdraw a change order the buyer declined; one that went through can\'t be', function () {
  var w = CO.withdraw({ number: 5, status: 'sent' }, 'Linds', 'Buyer declined', '2026-11-06');
  eq([w.ok, w.co.status, w.co.withdrawn.reason], [true, 'withdrawn', 'Buyer declined']);
  eq(CO.withdraw({ number: 5, status: 'sent' }, 'Linds', '').ok, false);
  ok(/make a new change order to undo it/.test(CO.withdraw({ number: 1, status: 'signed' }, 'Linds', 'x').error));
  eq(CO.counts(w.co), false);
});

test('the customer document: courtesy and no-change versions say so and print no cost', function () {
  var D = isNode ? require('../src/fm-phase1-docs.js') : globalThis.FMDocs;
  var job = FM.normalizeLegacyProject({ id: 'p', jobCode: 'FM-2609-314', customer: 'Braddy Builders', project: 'Penrose', status: 'contract', contractTotal: 10973.11, payments: [] });
  var court = CO.courtesy(penroseInput(), { today: TODAY }).co; court.number = 1; court.reason = 'Backordered item substituted';
  var h = D.renderChangeOrderDoc(job, court, {});
  ok(/Courtesy: this change is \$0\./.test(h), 'courtesy lead'); ok(/DC324-VDH/.test(h) && /No charge/.test(h)); ok(!/707\.92|1,652\.70/.test(h), 'no cost printed');
  var n = CO.notice({ number: 2, date: '2026-11-06', type: 'damage', note: 'cracked', requestedBy: 'L', replaced: [{ sku: 'W3042-VDH', qty: 1, unitCostCents: 25000, claim: 'supplier', why: 'cracked side' }], newDeliveryDate: '2026-11-20' }).co;
  var h2 = D.renderChangeOrderDoc(job, n, {});
  ok(/No change to your contract\./.test(h2) && /replaced: cracked side/.test(h2) && /November 20, 2026/.test(h2), 'notice'); ok(!/250\.00/.test(h2) && !/Supplier/.test(h2), 'no cost or claim printed');
});

test('a pasted SKU list: quantity before or after, repeats add up, no quantity means 1, junk is listed', function () {
  var r = CO.parseSkus('W3042-SBW 2\n2 x DC224-VDH\nVDC42RS-VDH, 1\nB15-SBW x3\nW3042-sbw\nhello there friend\n');
  eq(r.lines.map(function (l) { return [l.sku, l.qty]; }), [['W3042-SBW', 3], ['DC224-VDH', 2], ['VDC42RS-VDH', 1], ['B15-SBW', 3]]);
  eq(r.skipped, ['hello there friend']);
});

test('a spreadsheet export with a header uses its SKU, quantity, description and cost columns', function () {
  var r = CO.parseSkus('Item,Description,Qty,Unit Price\nW3042-SBW,"Wall 30x42",2,$153.88\nDC224-VDH,Drawer base,1,446.26\n');
  eq(r.lines, [{ sku: 'W3042-SBW', qty: 2, desc: 'Wall 30x42', unitCostCents: 15388 }, { sku: 'DC224-VDH', qty: 1, desc: 'Drawer base', unitCostCents: 44626 }]);
  var tab = CO.parseSkus('SKU\tQty\nB15-SBW\t4');
  eq(tab.lines, [{ sku: 'B15-SBW', qty: 4 }]);
});

console.log('changeorder.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
