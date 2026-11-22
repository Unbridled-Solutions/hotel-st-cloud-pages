/* Job costs, the order board, close-out, and the sales tax rate (FMCloseout). HANDOFF §42. Run with the package runner. */
var isNode = typeof require === 'function' && typeof module === 'object';
if (isNode) { globalThis.FMPhase1 = require('../src/fm-phase1-ledger.js'); }
var CL = isNode ? require('../src/fm-phase2-closeout.js') : globalThis.FMCloseout;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function job(stage, paid) {
  var inv = [{ id: 'i1', label: 'Invoice 1', role: 'deposit', amountCents: 500000, dueDate: '2026-11-19', status: 'open', payments: [] }, { id: 'i2', label: 'Invoice 2', role: 'progress', amountCents: 500000, dueDate: '2026-12-14', status: 'open', payments: [] }];
  (paid || []).forEach(function (k) { inv[k].payments.push({ date: '2026-11-19', amountCents: inv[k].amountCents, method: 'check', reference: '101' }); });
  return { jobCode: 'FM-2611-101', customer: 'Rod Stambaugh', stage: stage || 'contract_signed', originalContractCents: 1000000, taxCents: 50000, costCents: 600000, history: [], changeOrders: [], invoices: inv, pricing: { taxPct: 2.9, assemblyHours: 4, gaPct: 5 } };
}

test('a supplier invoice becomes a cost entry: lines with a kind, shipping as freight, the total paid; subtotal mismatch is flagged', function () {
  var res = { orderNumber: '50123', orderDate: '2026-11-12', items: [{ isSku: true, sku: 'B24', desc: 'Base', qty: 2, subtotalCents: 40000 }, { isSku: false, name: 'Crown molding', desc: '8 ft', qty: 3, subtotalCents: 9000 }],
    fees: [{ label: 'Shipping', qty: 1, amountCents: 5000 }], totals: { subtotal: 54000, discount: 4000, tax: 1500, shipping: 0, total: 51500 } };
  var r = CL.fromSupplier(res, { file: 'inv.pdf', by: 'Linds', today: '2026-11-19' });
  eq([r.ok, r.problems, r.entry.lines.map(function (l) { return l.kind; }), r.entry.totalCents, r.entry.orderNumber], [true, [], ['cabinets', 'moldings', 'freight'], 51500, '50123']);
  res.totals.subtotal = 60000; ok(CL.fromSupplier(res, { by: 'Linds' }).problems.length === 1);
  eq(CL.fromSupplier({ items: [] }, { by: 'Linds' }).ok, false);
});

test('a cost typed by hand needs who, how much and what for', function () {
  eq(CL.manual({ vendor: '', amountCents: 0, kind: 'x' }).problems.length, 3);
  var r = CL.manual({ vendor: 'Home Depot', amountCents: 12345, kind: 'hardware' }, { by: 'Linds', today: '2026-11-19' });
  eq([r.ok, r.entry.totalCents, r.entry.lines[0].kind], [true, 12345, 'hardware']);
});

test('actual vs quoted (net of the manufacturer discount): removed entries are kept but not counted; margin uses price before tax', function () {
  var j = job('delivered');
  eq(CL.margin(j), { priceCents: 950000, quotedCostCents: 600000, quotedListCents: 600000, mfrDiscountCents: 0, actualCostCents: null, quotedPct: 36.8, actualPct: null, diffCents: null });
  j.jobCosts = [CL.manual({ vendor: 'WC', amountCents: 620000, kind: 'cabinets' }).entry, Object.assign(CL.manual({ vendor: 'X', amountCents: 999, kind: 'other' }).entry, { removed: { by: 'L', on: 'd' } })];
  var m = CL.margin(j); eq([m.actualCostCents, m.actualPct, m.diffCents, CL.costs(j).count], [620000, 34.7, 20000, 1]);
  m = CL.margin(j, { mfrDiscountCents: 30000 }); eq([m.quotedCostCents, m.quotedListCents, m.diffCents], [570000, 600000, 50000], 'quoted cost net of the manufacturer discount');
});

test('the board: signed jobs only, by stage; moves forward one step at a time with the ledger\'s checks', function () {
  var cols = CL.board([job('quote'), job('contract_signed'), Object.assign(job('delivered'), { testVoid: true }), job('factory_ordered')]);
  eq(cols.map(function (c) { return c.jobs.length; }), [1, 0, 1, 0, 0, 0]);
  var r = CL.moveTo(job('contract_signed'), 'factory_ordered', '2026-11-20', 'Linds');
  ok(!r.ok && /deposit/i.test(r.error), 'deposit not paid blocks the move');
  r = CL.moveTo(job('contract_signed', [0]), 'factory_ordered', '2026-11-20', 'Linds');
  eq([r.ok, r.job.stage, r.steps.length], [true, 'factory_ordered', 2]);
  r = CL.moveTo(job('factory_ordered', [0]), 'complete', '2026-11-20', 'Linds');
  eq([r.ok, r.partial, r.job.stage], [true, true, 'delivered'], 'stops at the open balance, keeps the steps made');
  eq(CL.moveTo(job('delivered'), 'deposit_paid', '2026-11-20', 'L').ok, false);
});

test('close-out check: open balance and unsigned change orders block; no costs only warns', function () {
  var j = job('delivered', [0]); j.changeOrders = [{ number: 'CO-1', status: 'sent' }];
  var k = CL.check(j); eq([k.ready, k.blockers.map(function (b) { return b.key; })], [false, ['paid', 'invoices', 'changes']]);
  j = job('final_paid', [0, 1]); k = CL.check(j); eq([k.ready, k.items.filter(function (i) { return i.key === 'costs'; })[0].ok], [true, false]);
});

test('review and referrals; the warranty runs a year from purchase (the contract date)', function () {
  eq(CL.logReview({}, 'L').ok, false);
  eq(CL.logReview({ askedOn: '2026-11-19', where: 'Google', photosOk: 1 }, 'L', '2026-11-19').review.photosOk, true);
  eq(CL.addReferral({ name: 'Ann' }, 'L').ok, false);
  eq(CL.addReferral({ name: 'Ann', phone: '719' }, 'L', 'd', 'FM-1').ok, true);
  var j = job('delivered'); j.history = [{ from: 'factory_ordered', to: 'delivered', date: '2026-11-20' }];
  eq(CL.warrantyEnd(j), '2027-11-20', 'no contract date: from delivery'); j.contractedOn = '2026-10-02'; eq(CL.warrantyEnd(j), '2027-10-02'); eq(CL.warrantyEnd(job()), null); eq(CL.CARE.length, 5);
});

test('tax rate: address parts must add up and carry the check date; typed needs a reason; signed jobs are frozen', function () {
  var q = job('quote');
  eq(CL.checkRate({ ratePct: 7.9, source: 'address', parts: [{ name: 'State', pct: 2.9 }, { name: 'County', pct: 1 }, { name: 'City', pct: 4 }], checkedOn: '2026-11-19' }, q), []);
  eq(CL.checkRate({ ratePct: 8, source: 'address', parts: [{ name: 'State', pct: 2.9 }], checkedOn: '2026-11-19' }, q).length, 1);
  eq(CL.checkRate({ ratePct: 0, source: 'typed', reason: '' }, q).length, 1);
  eq(CL.checkRate({ ratePct: 0, source: 'typed', reason: 'Tax-exempt buyer' }, q), []);
  ok(CL.checkRate({ ratePct: 0, source: 'typed', reason: 'x' }, job('contract_signed')).length === 1);
  var w = CL.whatsTaxed(Object.assign(q, { extras: [{ label: 'Range hood', kind: 'product' }, { label: 'Haul away', kind: 'service' }] }));
  eq(w.map(function (x) { return x.taxed; }), [true, false, false, true, false]);
});

test('never writes over the job it was given: board moves and checks return a new record; removed costs stay on file', function () {
  var j = job('contract_signed', [0]), before = JSON.stringify(j);
  var r = CL.moveTo(j, 'delivered', '2026-11-20', 'Linds');
  eq([r.ok, r.job.stage, JSON.stringify(j) === before], [true, 'delivered', true]);
  eq(r.job.invoices[0].payments.length, 1, 'payments carried over untouched');
  var k = job('delivered'); k.jobCosts = [Object.assign(CL.manual({ vendor: 'WC', amountCents: 100, kind: 'cabinets' }).entry, { removed: { by: 'L', on: 'd' } })];
  var b2 = JSON.stringify(k); CL.check(k); CL.costs(k); CL.margin(k); CL.whatsTaxed(k);
  eq([JSON.stringify(k) === b2, k.jobCosts.length, CL.costs(k).count], [true, 1, 0]);
});

test('a blocked board move says where to fix it: the deposit or final payment on the Invoices tab, with that invoice', function () {
  var j = job('contract_signed'), b = CL.blocker(j);
  eq([b.fix.tab, b.fix.invoiceId, b.fix.label], ['invoices', 'i1', 'Record the deposit payment']);
  var r = CL.moveTo(j, 'factory_ordered', '2026-11-19', 'Linds');
  eq([r.ok, r.fix.tab, r.fix.invoiceId, r.stoppedAt], [false, 'invoices', 'i1', 'contract_signed']);
  eq(CL.blocker(job('contract_signed', [0])), null);
  var d = CL.moveTo(job('delivered', [0]), 'final_paid', '2026-11-19', 'Linds');
  eq([d.ok, d.fix.tab, d.fix.invoiceId], [false, 'invoices', 'i2']);
  eq(CL.moveTo(job('delivered'), 'contract_signed', '2026-11-19', 'Linds').fix.tab, 'overview');
  eq(CL.blocker(job('complete')), null);
});

test('an open supplier claim blocks close-out and the board\'s move to Complete (HANDOFF §45)', function () {
  if (typeof FMShipping === 'undefined') return;
  var j = job('final_paid', [0, 1]); j.claims = [{ id: 'c1', number: 1, status: 'submitted', items: [{ sku: 'B30', qty: 1 }] }];
  var r = CL.moveTo(j, 'complete', '2026-11-20', 'Linds'); eq([r.ok, r.fix.tab], [false, 'shipping']);
  ok(CL.check(j, {}).blockers.some(function (b) { return b.key === 'claims'; }));
  j.claims[0].status = 'closed'; eq(CL.moveTo(j, 'complete', '2026-11-20', 'Linds').ok, true);
});

console.log('closeout.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
