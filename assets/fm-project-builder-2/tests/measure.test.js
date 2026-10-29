/*
 * Phase 2 field measure tests. Run with:   node tests/measure.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var M = isNode ? require('../src/fm-phase2-measure.js') : globalThis.FMMeasure;
var EL = isNode ? require('../src/fm-phase2-elevations.js') : globalThis.FMElev;

var results = [], failed = 0;
function test(name, fn) {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

test('lengths typed the way a tape reads', function () {
  eq(["10' 6 1/2", '126 1/2', '126.5', "10'6-1/2\"", '34-5/8', '3/4', '96', "8'", '10 ft 6 in', '34⅝', ' 36 " '].map(M.parseLength),
     [126.5, 126.5, 126.5, 126.5, 34.625, 0.75, 96, 96, 126, 34.625, 36]);
  ok(isNaN(M.parseLength('')) && isNaN(M.parseLength('abc')) && isNaN(M.parseLength('5/0')), 'nonsense is NaN');
  eq(M.q16(126.53), 126.5);
});

function visit() {
  var v = M.blankVisit({ by: 'Tim Slaughenhaupt', today: '2026-10-29', jobCode: 'FM-2610-101' });
  var r = M.blankRoom('Kitchen'); v.rooms.push(r);
  var a = M.blankWall(r); a.name = 'Sink wall'; a.length = 125.5; a.openings.push({ kind: 'window', fromLeft: 48, width: 30, height: 36, fromFloor: 44 });
  a.marks.push({ kind: 'drain', fromLeft: 63, fromFloor: 18 }); r.walls.push(a);
  var b = M.blankWall(r); b.name = 'Range wall'; b.length = 132; r.walls.push(b);
  return v;
}
test('walls get positions in order and a clean visit has no problems', function () {
  var v = visit();
  eq(v.rooms[0].walls.map(function (w) { return w.position; }), ['back', 'left']);
  eq(M.checkVisit(v), []);
});
test('checks catch missing and impossible numbers', function () {
  var v = visit(), r = v.rooms[0];
  v.measuredBy.name = ''; r.walls[1].length = null; r.walls[0].openings[0].fromLeft = 100; r.ceiling = 70;
  r.walls[0].openings.push({ kind: 'door', fromLeft: 0, width: 32, height: 0 });
  eq(M.checkVisit(v).map(function (x) { return x.level + ': ' + x.text; }), [
    'error: Say who measured.',
    'warn: Kitchen: Ceiling of 70″ is unusual. Check it.',
    'error: Kitchen · Sink wall: Window 1 runs past the end of the wall.',
    'error: Kitchen · Sink wall: Window 1 goes above the ceiling.',
    'error: Kitchen · Sink wall: Door 2: enter width and height.',
    'error: Kitchen · Range wall: Enter the length.']);
});
test('a visit room becomes an Elevations room that lays out', function () {
  var v = visit(), er = M.toElevationRoom(v.rooms[0], v, 'Main');
  eq([er.name, er.set, er.measured.by, er.walls.length, er.walls[0].lengthIn, er.walls[0].specs.ceiling, er.walls[0].openings[0].fromFloor, er.walls[0].marks[0].kind],
     ['Kitchen', 'Main', 'Tim Slaughenhaupt', 2, 125.5, 96, 44, 'drain']);
  var lay = EL.layoutRoom(er);
  eq([lay.length, lay[0].layout.lengthIn, lay[0].layout.openings.length, lay[0].layout.marks.length], [2, 125.5, 1, 1]);
  ok(EL.svgElevation(lay[0].layout).indexOf('Drain') > -1, 'drain drawn');
});
test('field numbers onto a drawn room keep the cabinets, and the plan comparison flags differences', function () {
  var v = visit(), plan = { id: 'r', name: 'Kitchen', set: 'Main', walls: [
    { id: 'w1', name: 'Sink wall', position: 'back', lengthIn: 126, base: [{ id: 'a', sku: 'B33' }], upper: [], openings: [] },
    { id: 'w2', name: 'Wall B', position: 'left', lengthIn: 132, base: [{ id: 'b', sku: 'B18' }], upper: [], openings: [] }] };
  eq(M.compare(plan, v.rooms[0]), [{ wall: 'Sink wall', plan: 126, field: 125.5, diff: -0.5, flag: true }, { wall: 'Range wall', plan: 132, field: 132, diff: 0, flag: false }]);
  var res = M.applyToRoom(plan, v.rooms[0], v);
  eq([res.room.walls[0].lengthIn, res.room.walls[0].base[0].sku, res.room.walls[1].base[0].sku, res.room.walls[0].openings.length, res.room.measured.by],
     [125.5, 'B33', 'B18', 1, 'Tim Slaughenhaupt']);
  eq(res.changes, [{ wall: 'Sink wall', text: 'length 126″ → 125 1/2″', diff: -0.5 }]);
  eq(plan.walls[0].lengthIn, 126, 'original untouched');
});

console.log('measure.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
