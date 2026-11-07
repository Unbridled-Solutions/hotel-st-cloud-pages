/*
 * Job documents tests (FMFiles). Run with:   node tests/files.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var FF = isNode ? require('../src/fm-phase2-files.js') : globalThis.FMFiles;
var B = isNode ? require('../preview/braddy-penrose-order.js') : globalThis.FM_BRADDY_ORDER;
var W = isNode ? require('../preview/willow-creek-full-order.js') : globalThis.FM_WILLOW_ORDER;

var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
var OPTS = { jobCode: 'FM-2609-314', by: 'Linds', today: '2026-11-06', existing: [] };

test('an architectural PDF uploads with who, when, kind and a name from the file', function () {
  var r = FF.check({ name: 'Penrose_Kitchen_Plans_RevB.pdf', size: 2400000, type: 'application/pdf', sha256: 'aa' }, { category: 'architectural', note: 'Rev B from the architect' }, OPTS);
  eq(r.ok, true);
  eq([r.doc.kind, r.doc.category, r.doc.title, r.doc.uploadedBy, r.doc.uploadedOn, r.doc.note, r.doc.image, r.doc.changeOrder], ['supporting', 'architectural', 'Penrose Kitchen Plans RevB', 'Linds', '2026-11-06', 'Rev B from the architect', false, null]);
});

test('photos are images; HEIC from a phone is accepted', function () {
  var r = FF.check({ name: 'IMG_4412.HEIC', size: 3100000, type: '' }, { category: 'photo' }, OPTS);
  eq([r.ok, r.doc.image, r.doc.type], [true, true, 'image/heic']);
});

test('an upload needs a kind, a supported type, a size under 25 MB and a person', function () {
  var r = FF.check({ name: 'setup.exe', size: 0 }, {}, { jobCode: 'X' });
  eq(r.problems.length, 4);
  ok(/isn't a type the tool keeps/.test(r.problems[0]), r.problems[0]);
  eq(r.problems.slice(1), ['That file is empty.', 'Choose what kind of document it is.', 'Sign in so the upload is recorded under your name.']);
  ok(/limit is 25 MB/.test(FF.check({ name: 'drone.jpg', size: 40e6 }, { category: 'photo' }, OPTS).problems[0]));
});

test('the same file twice is refused; a different file with the same name is renamed', function () {
  var first = FF.check({ name: 'plan.pdf', size: 10, sha256: 'abc' }, { category: 'architectural' }, OPTS).doc;
  var again = FF.check({ name: 'copy.pdf', size: 10, sha256: 'abc' }, { category: 'architectural' }, Object.assign({}, OPTS, { existing: [first] }));
  eq(again.problems, ['This exact file is already on the job as "plan".']);
  var other = FF.check({ name: 'plan.pdf', size: 12, sha256: 'def' }, { category: 'architectural' }, Object.assign({}, OPTS, { existing: [first] }));
  eq([other.ok, other.doc.file], [true, 'plan (2).pdf']); ok(/saved as plan \(2\)\.pdf/.test(other.warnings[0]));
});

test('a file attached to a change order belongs to it and needs no kind', function () {
  var r = FF.check({ name: 'damage.jpg', size: 900000 }, { changeOrder: 2 }, OPTS);
  eq([r.ok, r.doc.kind, r.doc.changeOrder, r.doc.category], [true, 'change_order', 2, 'other']);
});

test('remove keeps the file with who, when and why; restore brings it back; signed files stay', function () {
  var d = FF.check({ name: 'old plan.pdf', size: 10 }, { category: 'architectural' }, OPTS).doc;
  var r = FF.remove(d, 'Linds', '2026-11-06', 'superseded by Rev B');
  eq([r.ok, r.doc.removed], [true, { by: 'Linds', on: '2026-11-06', reason: 'superseded by Rev B' }]);
  ok(!d.removed, 'input unchanged');
  eq(FF.restore(r.doc, 'Linds').doc.removed, undefined);
  eq(FF.remove(B.documents[0], 'Linds').ok, false);
});

test('Documents sections: Braddy has the contract, its supplier order and change order 1 PDF (VSB30 3 → 2 confirmed)', function () {
  var docs = B.documents.filter(function (d) { return d.jobCode === 'FM-2609-314'; });
  var s = FF.sections(docs, [{ number: 1, reason: 'Backordered item substituted', status: 'approved' }]);
  eq([s.contract.length, s.supplier.length, s.changeOrders.length, s.changeOrders[0].docs.length, s.supportingCount], [1, 1, 1, 1, 0]);
  var co = s.changeOrders[0].docs[0];
  eq([co.file, co.sha256, co.bytes], ['FM-2609-314 · Braddy Builders COR 1.pdf', '8bbd4a2c83b3b68a8e2734d3b08d55765ccc3b02453e88650d7038d072d02bb6', 401071]);
  eq(co.flag, undefined); ok(/VSB30 3 → 2/.test(co.contains) && /Owner, Nov 6/.test(co.note), co.note);
});

test('Willow Creek change order 1: both PDFs (change order and its invoice) sit under change order 1', function () {
  var docs = W.changeOrders[0].documents.map(function (d) { return Object.assign({ changeOrder: 1 }, d); });
  var s = FF.sections(docs, [{ number: 1, reason: 'SKUs updated Oct 2026', status: 'paid' }]);
  eq(s.changeOrders[0].docs.map(function (d) { return d.sha256.slice(0, 8); }), ['34343481', '93d8eb1a']);
});

test('supporting documents group by kind, removed files are listed apart', function () {
  var a = FF.check({ name: 'a.pdf', size: 1 }, { category: 'architectural' }, OPTS).doc, p = FF.check({ name: 'b.jpg', size: 1 }, { category: 'photo' }, OPTS).doc;
  var gone = FF.remove(FF.check({ name: 'c.jpg', size: 1 }, { category: 'photo' }, OPTS).doc, 'Linds', '2026-11-06').doc;
  var s = FF.sections([p, a, gone], []);
  eq(s.supporting.map(function (g) { return g.category + ':' + g.docs.length; }), ['architectural:1', 'photo:1']);
  eq([s.removed.length, s.count], [1, 2]);
});

test('copies signed in the tool can\'t be removed', function () {
  var r = FF.remove({ kind: 'contract', title: 'Signed contract with certificate', uploadedBy: 'Signed in the tool', signRequest: 'sig-x' }, 'Linds', '2026-11-06', 'oops');
  eq([r.ok, r.error], [false, 'Copies signed in the tool stay on the job.']);
});

console.log('files.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
