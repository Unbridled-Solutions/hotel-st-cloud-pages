/* The estimate, step by step (FMEstimate). Run with:   node tests/estimate.test.js */
var isNode = typeof require === "function" && typeof module === "object";
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push("  ok   " + name); } catch (e) { failed++; results.push("  FAIL " + name + "\n         " + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ": " : "") + "expected " + sb + ", got " + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }
if (isNode) { globalThis.FMPhase1 = require('../src/fm-phase1-ledger.js'); globalThis.FMQuote = require('../src/fm-phase1-quote.js'); }
var ES = isNode ? require('../src/fm-phase2-estimate.js') : globalThis.FMEstimate;
function job() { return { jobCode: 'FM-2611-101', stage: 'quote', pricing: { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9, assemblyHours: 6, assemblyRateCents: 2050 },
  models: [{ name: 'Office kitchen', qty: 1, lines: [{ sku: 'B24-SBW', desc: 'Base 24', qty: 2, unitCostCents: 20000, markupPct: 35 }, { sku: 'W3030-SBW', desc: 'Wall 30x30', qty: 1, unitCostCents: 15000, markupPct: 35 }] }] }; }

test('totals: cabinets, discount, assembly, G&A and tax per model, plus extras; product extras are taxed, labor and discounts are not', function () {
  var j = job(), t = ES.totals(j);
  eq(t.lineCount, 2); ok(t.totalCents > 0);
  j.extras = [{ label: 'Hardware', kind: 'product', amountCents: 25000 }, { label: 'Install', kind: 'labor', amountCents: 40000 }, { label: 'Fall sale', kind: 'discount', amountCents: 10000, taxable: false }];
  var t2 = ES.totals(j);
  eq(t2.extras.amountCents, 25000 + 40000 - 10000);
  eq(t2.extras.taxCents, Math.round(25000 * 7.9 / 100));
  eq(t2.totalCents - t.totalCents, 55000 + Math.round(25000 * 7.9 / 100));
});

test('review: margin per line after the manufacturer discount; low-margin, at-cost and no-cost lines are flagged', function () {
  var j = job(); j.models[0].lines.push({ sku: 'TK8', qty: 1, unitCostCents: 3000, markupPct: 0 }, { sku: 'F342', qty: 1, unitCostCents: 0, markupPct: 35 }, { sku: 'W1230', qty: 1, unitCostCents: 9000, markupPct: 10 });
  var r = ES.review(j);
  var b = r.lines.filter(function (l) { return l.sku === 'B24-SBW'; })[0];
  eq(Math.round(b.marginPct * 10) / 10, 28.5);   // $540 less the $48 discount = $492, against $352 net cost
  ok(r.flags.some(function (f) { return /TK8 is at cost/.test(f.text); }));
  ok(r.flags.some(function (f) { return /F342 has no cost/.test(f.text) && f.level === 'error'; }));
  ok(r.flags.some(function (f) { return /W1230 makes .*under the 20% minimum/.test(f.text); }));
  eq(r.ok, false);
});

test('review compares the elevations: drawn but not quoted, quoted but not drawn', function () {
  var r = ES.review(job(), { rows: [{ sku: 'B24-SBW', quoted: 2, placed: 3 }, { sku: 'W3030-SBW', quoted: 1, placed: 0 }], drawn: true });
  ok(r.flags.some(function (f) { return f.kind === 'elev' && f.fix && f.fix.add === 1 && /B24-SBW: 3 on the elevations, 2 on the estimate/.test(f.text); }));
  ok(r.flags.some(function (f) { return f.kind === 'elev' && /W3030-SBW: 1 on the estimate, 0 on the elevations/.test(f.text); }));
});

test('approve records who and the total; any change afterwards shows as changed', function () {
  var j = job(), a = ES.approve(j, { name: 'Linds' }, '2026-11-19T10:00:00Z');
  eq(a.ok, true); j.estimateApproval = a.approval;
  eq(ES.status(j).key, 'approved');
  j.models[0].lines[0].qty = 3; eq(ES.status(j).key, 'changed');
  j.models[0].lines[0].qty = 2; j.pricing.taxPct = 8; eq(ES.status(j).key, 'changed');
});

test('approval is blocked by errors; design-first projects need design approval before pricing', function () {
  var j = job(); j.models[0].lines[0].unitCostCents = 0;
  eq(ES.approve(j, { name: 'Linds' }).ok, false);
  var d = { designFirst: true }; eq(ES.needsDesignApproval(d), true);
  eq(ES.approveDesign(d, { how: 'inPerson', version: 1, note: '' }, { name: 'Linds' }).ok, false);
  eq(ES.approveDesign(d, { how: 'inPerson', version: 0, note: 'Rod at the office' }, { name: 'Linds' }).ok, false);
  var ok1 = ES.approveDesign(d, { how: 'inPerson', version: 1, note: 'Rod at the office, Nov 19' }, { name: 'Linds' });
  eq([ok1.ok, ok1.approval.version], [true, 1]); d.designApproval = ok1.approval; eq(ES.needsDesignApproval(d), false);
});

console.log('estimate.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
