/* Elevation designs (FMDesigns). Run with:   node tests/designs.test.js */
var isNode = typeof require === "function" && typeof module === "object";
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push("  ok   " + name); } catch (e) { failed++; results.push("  FAIL " + name + "\n         " + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ": " : "") + "expected " + sb + ", got " + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }
var DS = isNode ? require('../src/fm-phase2-designs.js') : globalThis.FMDesigns;
var ROOM = { id: 'r1', name: 'Office', set: 'Old name', walls: [{ id: 'w1', name: 'Back', lengthIn: 120, base: [{ id: 'b', sku: 'B24' }], upper: [] }] };

test('a new design needs a name and a room kind; codes count up', function () {
  eq(DS.create({}, { by: 'Linds' }).ok, false);
  var r = DS.create({ name: 'Office kitchen', kind: 'office' }, { by: 'Linds', today: '2026-11-19', existing: [{ jobCode: 'DES-0004' }] });
  eq([r.ok, r.design.jobCode, r.design.designTemplate.kind, !!r.design.elevations.sketch], [true, 'DES-0005', 'office', true]);
});

test('saving a project as a design copies its drawings (no prices) and leaves the project alone', function () {
  var p = { jobCode: 'FM-1', projectName: 'Penrose', elevations: { rooms: [ROOM], sizes: { B24: { w: 24 } } } };
  var r = DS.fromProject(p, { name: 'Penrose kitchen', kind: 'kitchen' }, { by: 'Linds', existing: [] });
  eq([r.ok, r.design.elevations.rooms[0].set, r.design.designTemplate.from], [true, 'Penrose kitchen', 'FM-1']);
  eq(p.elevations.rooms[0].set, 'Old name');
  eq(DS.fromProject({ elevations: { rooms: [] } }, {}, {}).ok, false);
});

test('starting a project from a design: design-first, the drawings copied to the project, no SKUs or prices yet', function () {
  var d = DS.create({ name: 'Office kitchen', kind: 'office' }, { by: 'Linds', existing: [] }).design; d.elevations.rooms = [JSON.parse(JSON.stringify(ROOM))];
  eq(DS.startProject(d, {}, { code: 'FM-2611-101', by: 'Linds' }).ok, false);
  var r = DS.startProject(d, { customer: 'Rod Stambaugh', project: 'Office kitchen', email: 'rod@example.com' }, { code: 'FM-2611-101', by: 'Linds', today: '2026-11-19', pricing: { markupPct: 35 } });
  var j = r.job;
  eq([j.designFirst, j.fromDesign.code, j.stage, j.models[0].lines.length, j.elevations.rooms[0].set, j.contacts.signer, j.invoices.length], [true, 'DES-0001', 'quote', 0, 'Office kitchen', 'Rod Stambaugh', 2]);
  eq(d.elevations.rooms[0].set, 'Old name', 'the design itself is unchanged');
});

test('the library lists designs and which projects started from them', function () {
  var all = [{ jobCode: 'DES-0001', customer: 'Office kitchen', designTemplate: { kind: 'office', on: '2026-11-19' }, elevations: { rooms: [ROOM] } }, { jobCode: 'FM-2611-101', customer: 'Rod', fromDesign: { code: 'DES-0001' } }, { jobCode: 'FM-1', customer: 'Other' }];
  var lib = DS.library(all);
  eq(lib.length, 1); eq([lib[0].walls, lib[0].projects.length, lib[0].kindLabel], [1, 1, 'Office or bar']);
});

console.log('designs.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
