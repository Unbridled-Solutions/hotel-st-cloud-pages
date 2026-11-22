/* Cabinet colors (FMColors) and the grouped change order lines. HANDOFF §44. Run with the package runner. */
var isNode = typeof require === 'function' && typeof module === 'object';
var C = isNode ? require('../src/fm-phase2-colors.js') : globalThis.FMColors;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

test('the catalog has the 88 fremontmakers.com colors, each with a chip and a page; supplier codes resolve', function () {
  eq(C.CATALOG.length, 88); ok(C.CATALOG.every(function (c) { return C.isHex(c.hex) && /^https:\/\/fremontmakers\.com\/catalog\//.test(c.url) && c.name; }));
  eq(C.hex('SBW'), '#f4f1ea'); eq(C.name('SBW'), 'Bayview White Shaker'); eq(C.short('SBW'), 'White');
  eq(C.short('scandi-sage-green'), 'Scandi Sage Green'); eq(C.hex('#123abc'), '#123abc'); eq(C.hex('nope'), null);
});

test('adding colors: from the catalog once, or your own with a name and a color; the list passed in never changes', function () {
  var list = [];
  var r = C.add(list, 'majestic-sage-green'); eq([r.ok, r.list, list], [true, ['majestic-sage-green'], []]);
  eq(C.add(r.list, 'majestic-sage-green').ok, false, 'no duplicates'); eq(C.add([], 'SBW').ok, false, 'shop colors are already there'); eq(C.add([], 'nope').ok, false);
  var o = C.add(r.list, { name: 'Urbane Bronze', hex: '#54504A' }); eq([o.ok, o.key, o.list[1].hex], [true, 'c-urbane-bronze', '#54504a']);
  eq(C.add(o.list, { name: '', hex: '#000000' }).ok, false); eq(C.add(o.list, { name: 'X', hex: 'red' }).ok, false);
  eq(C.choices(o.list).map(function (c) { return c.name; }), ['White', 'Natural wood', 'Moss green', 'Dark hickory', 'Majestic Sage Green', 'Urbane Bronze']);
  C.use(o.list); eq(C.hex('c-urbane-bronze'), '#54504a'); C.use([]);
  ok(C.search('sage', o.list).every(function (c) { return c.key !== 'majestic-sage-green'; }), 'search hides colors already chosen');
  ok(C.search('', []).every(function (c) { return c.key !== 'bayview-white-shaker'; }), 'the shop white is already a choice');
  eq(C.remove(o.list, 'majestic-sage-green').length, 1);
});

test('drawings use any color: a supplier code, a catalog color, or a hex', function () {
  if (typeof FMElev === 'undefined') return;
  eq(FMElev.finishFor('SBW'), '#F4F1EA'); eq(FMElev.finishFor('scandi-sage-green'), '#b9bda5'); eq(FMElev.finishFor('#336699'), '#336699');
});

test('a change order prints cabinet lines grouped by color, with what each one is instead of repeating the SKU', function () {
  if (typeof FMDocs === 'undefined' || typeof FMPhase1 === 'undefined') return;
  var job = { jobCode: 'FM-2611-101', customer: 'Rod', projectName: 'Kitchen', originalContractCents: 1000000, invoices: [], changeOrders: [], contacts: {} };
  var co = { number: 2, date: '2026-11-20', kind: 'charge', amountCents: 120000, reason: 'Add', pricing: { discountPctOfCost: 5, gaPct: 2, taxPct: 7.9 },
    priced: { lines: [{ sku: 'W3042-SBW', desc: 'Bayview White Shaker W3042', qty: 2, unitCents: 50000, totalCents: 100000 }, { sku: 'OCM8-SBW', desc: 'Bayview White Shaker OCM8', qty: 1, unitCents: 3000, totalCents: 3000 }],
      summary: { cabinetsCents: 103000, taxCents: 8000 } } };
  var h = FMDocs.renderChangeOrderDoc(job, co, {});
  ok(/class="doc-head doc-head--center"/.test(h) && /<h1>Change Order 2 Invoice<\/h1>/.test(h), 'centered header');
  ok(/class="doc-group".*Bayview White Shaker <span class="doc-ccode">SBW/.test(h), 'color group');
  ok(/W3042-SBW<\/span><span class="doc-what">Wall cabinet 30″ wide, 42″ tall/.test(h), 'description from the code');
  ok(/Outside corner molding, 8 ft/.test(h), 'trim named'); ok(!/>Bayview White Shaker W3042</.test(h), 'no repeated SKU text');
  ok(/Amount due this invoice<\/td><td class="r">\$1,200\.00/.test(h));
});

console.log('colors.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
