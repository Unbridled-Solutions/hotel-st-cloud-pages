/*
 * Phase 2 elevation tests. Run with:   node tests/elevations.test.js
 * Sizes are inches; every expected number below is worked out by hand.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var EL = isNode ? require('../src/fm-phase2-elevations.js') : globalThis.FMElev;

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
function pick(s) { return [s.kind, s.layer, s.w, s.h, s.d, s.sure]; }
var n = 0; function it(x) { x.id = 'i' + (++n); return x; }

test('SKU codes give the cabinet and its size', function () {
  eq(pick(EL.parseSku('W3042-SBW')), ['wall', 'upper', 30, 42, 12, true]);
  eq(pick(EL.parseSku('W362424-UMO')), ['wall', 'upper', 36, 24, 24, true]);
  eq(pick(EL.parseSku('WC2442-VDH')), ['wall', 'upper', 24, 42, 12, true]);
  eq(pick(EL.parseSku('SB36-SBW')), ['base', 'base', 36, 34.5, 24, true]);
  eq(pick(EL.parseSku('BC33-VDH')), ['base', 'base', 33, 34.5, 24, true]);
  eq([EL.parseSku('3DB24-UMO').drawers, EL.parseSku('3DB24-UMO').w], [3, 24]);
  eq(pick(EL.parseSku('F342-SBW')), ['filler', 'upper', 3, 42, 0.75, true]);
  eq(pick(EL.parseSku('VS30-SBW')), ['vanity', 'base', 30, 34.5, 21, true]);
  eq(pick(EL.parseSku('U188424')), ['tall', 'base', 18, 84, 24, true]);
});

test('codes the tool can only guess are flagged; trim is listed but not drawn; staff sizes win', function () {
  var dc = EL.parseSku('DC224-VDH');
  eq([dc.kind, dc.w, dc.drawers, dc.sure], ['base', 24, 2, false]);
  eq([EL.parseSku('TKC-SBW').kind, EL.parseSku('SM8(SCR)-SBW').kind, EL.parseSku('ACM8-UMO').kind, EL.parseSku('S2496-SWD').kind], ['trim', 'trim', 'trim', 'trim']);
  var u = EL.parseSku('XQ1234-SWD');
  eq([u.kind, u.sure, u.drawn], ['unknown', false, false]);
  var fixed = EL.parseSku('FPV4296-SWD', { FPV4296: { kind: 'panel', w: 0.75, h: 96, d: 42 } });
  eq(pick(fixed), ['panel', 'base', 0.75, 96, 42, true]);
});

test('inches and feet print the way a drawing reads', function () {
  eq([EL.inches(34.5), EL.inches(0.75), EL.inches(1.5), EL.inches(36), EL.inches(18.0625)], ['34 1/2″', '3/4″', '1 1/2″', '36″', '18 1/16″']);
  eq([EL.feetInches(99), EL.feetInches(126), EL.feetInches(96), EL.feetInches(8)], ['8′ 3″', '10′ 6″', '8′ 0″', '8″']);
});

test('a wall lines cabinets up left to right; uppers top out together', function () {
  var wall = { lengthIn: 126, base: [it({ sku: 'B33-SBW' }), it({ appliance: 'dishwasher' }), it({ sku: 'SB36-SBW' }), it({ sku: 'B33-SBW' })],
    upper: [it({ sku: 'W3342-SBW' }), it({ sku: 'W3342-SBW', gapBefore: 60 })], openings: [{ kind: 'window', fromLeft: 60, width: 30, height: 36, fromFloor: 44 }] };
  var L = EL.layoutWall(wall);
  eq(L.base.map(function (p) { return [p.x, p.w]; }), [[0, 33], [33, 24], [57, 36], [93, 33]]);
  eq(L.upper.map(function (p) { return [p.x, p.y, p.h]; }), [[0, 54, 42], [93, 54, 42]]);
  eq([L.upperTop, L.open.base, L.open.upper, L.issues.length], [96, 0, 0, 0]);
  wall.upper.push(it({ sku: 'W3018-SBW' }));
  var L2 = EL.layoutWall(wall);
  eq(L2.upper[2].y, 78);   // a short upper hangs from the same top line
  eq(L2.issues.map(function (i) { return i.text; }), ['The upper run is 30″ too long for this wall.']);
});

test('uppers step past a pantry, but sit above a fridge', function () {
  var L = EL.layoutWall({ lengthIn: 96, base: [it({ sku: 'U188424' })], upper: [it({ sku: 'W3030' })] });
  eq([L.upper[0].x, L.upper[0].y], [18, 54]);
  var F = EL.layoutWall({ lengthIn: 96, base: [it({ appliance: 'fridge' })], upper: [it({ sku: 'W362424' })] });
  eq([F.upper[0].x, F.upper[0].y, F.base[0].h], [0, 72, 70]);
});

test('problems: leftover space, covered window, a corner, a cabinet that is too tall', function () {
  var L = EL.layoutWall({ lengthIn: 129, base: [it({ sku: 'B33' }), it({ appliance: 'dishwasher' }), it({ sku: 'SB36' }), it({ sku: 'B33' })], upper: [it({ sku: 'W3342' })],
    openings: [{ kind: 'window', fromLeft: 20, width: 30, height: 36, fromFloor: 44 }] });
  eq(L.issues.map(function (i) { return i.level + ': ' + i.text; }), ['warn: 3″ left at the right end of the base run. Add a filler or a space.', 'error: W3342 covers the window.']);
  var C = EL.layoutWall({ lengthIn: 132, cornerRight: true, base: [it({ appliance: 'fridge' }), it({ sku: 'B18' }), it({ appliance: 'range' }), it({ sku: 'B18' })] });
  eq([C.open.base, C.issues[0].level], [6, 'warn']);
  var T = EL.layoutWall({ lengthIn: 60, specs: { ceiling: 84 }, base: [it({ sku: 'U249624' })] });
  eq(T.issues[0].text, 'U249624 is 96″ tall; only 84″ fits under the ceiling.');
});

var LINES = [{ sku: 'W3342-SBW', qty: 2 }, { sku: 'B33-SBW', qty: 2 }, { sku: 'SB36-SBW', qty: 1 }, { sku: 'VS30-SBW', qty: 2 }, { sku: 'TKC-SBW', qty: 3 }, { sku: 'F342-SBW', qty: 1 }];

test('quoted vs placed: what is left, what is extra, trim kept out', function () {
  var rooms = [{ walls: [{ base: [{ sku: 'B33-SBW' }, { sku: 'B33-SBW' }, { sku: 'SB36-SBW' }, { sku: 'B18-SBW' }], upper: [{ sku: 'W3342-SBW' }] }] }];
  var r = EL.reconcile(LINES, rooms);
  eq(r.rows.map(function (x) { return [x.sku, x.quoted, x.placed, x.status]; }), [
    ['W3342-SBW', 2, 1, 'missing'], ['B33-SBW', 2, 2, 'ok'], ['SB36-SBW', 1, 1, 'ok'], ['VS30-SBW', 2, 0, 'missing'], ['F342-SBW', 1, 0, 'missing'], ['B18-SBW', 0, 1, 'extra']]);
  eq([r.missing, r.extra, r.allPlaced, r.notDrawn.map(function (x) { return x.sku; })], [4, 1, false, ['TKC-SBW']]);
});

test('place the rest: adds what fits, in quote order, and says what did not', function () {
  var res = EL.autoPlace({ lengthIn: 60, base: [], upper: [] }, [{ sku: 'VS30-SBW', qty: 3 }, { sku: 'TKC-SBW', qty: 2 }], []);
  eq([res.added, res.skipped], [['VS30-SBW', 'VS30-SBW'], [{ sku: 'VS30-SBW', why: 'no room' }]]);
  eq(EL.layoutWall(res.wall).open.base, 0);
});

test('drawings: elevation has the measurements and SKUs; the 3D view turns', function () {
  var wall = { lengthIn: 126, base: [it({ sku: 'B33-SBW' }), it({ appliance: 'dishwasher' }), it({ sku: 'SB36-SBW' }), it({ sku: 'B33-SBW' })], upper: [it({ sku: 'W3342-SBW' })] };
  var lay = EL.layoutWall(wall), svg = EL.svgElevation(lay, { title: 'Sink wall', color: 'SBW' });
  ok(/^<svg/.test(svg) && /<\/svg>$/.test(svg), 'svg');
  ['Wall 10′ 6″ (126″)', 'Base run 126″', '>SB36<', '>B33<', '36″ counter', 'Ceiling 96″', '4 1/2″'].forEach(function (s) { ok(svg.indexOf(s) >= 0, 'missing ' + s); });
  var a = EL.svg3D([{ position: 'back', layout: lay }], { yaw: -30 }), b = EL.svg3D([{ position: 'back', layout: lay }], { yaw: 30 });
  ok((a.match(/<polygon/g) || []).length > 20, '3D faces');
  ok(a !== b, 'turning changes the view');
});

test('drag: into open space it lands where dropped (snapped); onto cabinets it reorders and the rest close up', function () {
  var wall = { lengthIn: 120, base: [{ id: 'a', sku: 'B33' }, { id: 'b', sku: 'B18' }], upper: [{ id: 'u', sku: 'W3030' }], openings: [] };
  var m = EL.moveItem(wall, 'b', 70.1, null);
  eq([m.mode, m.x, m.wall.base.map(function (i) { return [i.id, i.gapBefore]; })], ['placed', 70, [['a', 0], ['b', 37]]]);
  var s = EL.moveItem(wall, 'b', 34.4, null);   // within 2″ of B33's right edge: snaps against it
  eq([s.mode, s.x], ['placed', 33]);
  var e = EL.moveItem(wall, 'b', 101, null);    // within 2″ of the wall end: right side snaps to 120
  eq(e.x, 102);
  var r = EL.moveItem({ lengthIn: 120, base: [{ id: 'a', sku: 'B33' }, { id: 'd', appliance: 'dishwasher' }, { id: 's', sku: 'SB36' }] }, 'a', 40, null);
  eq([r.mode, r.wall.base.map(function (i) { return i.id; }), EL.layoutWall(r.wall).base.map(function (p) { return p.x; })], ['reordered', ['d', 'a', 's'], [0, 24, 57]]);
  eq(EL.moveItem(wall, 'u', 50, null).wall.upper[0].gapBefore, 50);
});

test('corner cabinets: blind and diagonal codes; a corner cabinet sets aside its footprint on the wall it meets', function () {
  eq([pick(EL.parseSku('BBC42-SBW')), EL.parseSku('BBC42-SBW').corner, EL.parseSku('BBC42-SBW').foot], [['base', 'base', 42, 34.5, 24, true], 'blind', 24]);
  eq([pick(EL.parseSku('LS36')), EL.parseSku('LS36').corner, EL.parseSku('LS36').foot], [['base', 'base', 36, 34.5, 36, true], 'diagonal', 36]);
  eq([pick(EL.parseSku('WDC2430')), EL.parseSku('WDC2430').foot], [['wall', 'upper', 24, 30, 24, true], 24]);
  var room = { walls: [
    { id: 'bk', name: 'Back', position: 'back', lengthIn: 120, base: [{ id: 'c', sku: 'LS36' }, { id: 'b1', sku: 'B30' }], upper: [] },
    { id: 'lf', name: 'Left', position: 'left', lengthIn: 120, base: [{ id: 'b2', sku: 'B33' }], upper: [] }] };
  var R = EL.layoutRoom(room);
  eq([R[1].layout.reserve.right.base, R[1].layout.reserve.rightLabel, R[0].layout.base[0].cornerEnd], [36, 'Back', 'left']);
  eq(R[1].layout.open.base, 120 - 36 - 33);
  room.walls[0].base = [{ id: 'b0', sku: 'B36' }];
  room.walls[1].base = [{ id: 'b3', sku: 'B30' }, { id: 'b4', sku: 'B30' }, { id: 'b5', sku: 'B30' }, { id: 'b6', sku: 'B30' }];
  ok(/both run into the same corner/.test(EL.layoutRoom(room)[0].layout.issues.map(function (i) { return i.text; }).join(' ')), 'corner clash');
  var mid = EL.layoutWall({ lengthIn: 120, base: [{ id: 'x', sku: 'B30' }, { id: 'y', sku: 'LS36' }, { id: 'z', sku: 'B30' }] });
  ok(/corner cabinet/.test(mid.issues[0].text), 'corner cabinet in the middle');
});

test('staggered uppers, islands, crown, trim feet, sizes from the supplier PDF, floor plan', function () {
  var st = EL.layoutWall({ lengthIn: 96, upper: [{ id: 'a', sku: 'W3042' }, { id: 'b', sku: 'W3036', topOffset: -3 }] });
  eq(st.upper.map(function (p) { return [p.y, p.y + p.h]; }), [[54, 96], [57, 93]]);
  var isl = EL.layoutWall({ position: 'island', lengthIn: 72, base: [{ id: 'i', sku: 'B36' }, { id: 'j', sku: 'B36' }], upper: [{ id: 'k', sku: 'W3030' }] });
  eq([isl.island, isl.crown, isl.issues[0].level], [true, false, 'warn']);
  ok(EL.svgElevation(isl).indexOf('Island 6′ 0″') >= 0, 'island drawing');
  var wall = { lengthIn: 126, crown: 'on', base: [{ id: 'p', sku: 'B33' }, { id: 'q', appliance: 'dishwasher' }, { id: 'r', sku: 'SB36' }, { id: 's', sku: 'B33' }],
    upper: [{ id: 't', sku: 'W3342' }, { id: 'u', sku: 'W3342', gapBefore: 60 }] };
  var lay = EL.layoutWall(wall);
  ok(EL.svgElevation(lay).indexOf('class="crown"') >= 0, 'crown drawn');
  eq(EL.trimCheck([{ sku: 'ACM8-SBW', qty: 2 }, { sku: 'TKC-SBW', qty: 3 }], [{ layout: lay }]).map(function (r) { return [r.label, r.quotedFt, r.neededFt, r.ok]; }),
    [['Crown molding', 16, 9, true], ['Toe kick', 24, 14, true]]);
  var pdf = EL.sizesFromLines([{ sku: 'FPV4296-SWD', width: 0.75, height: 96, depth: 42 }]);
  var sp = EL.parseSku('FPV4296-SWD', pdf);
  eq([sp.w, sp.h, sp.d, sp.sure, sp.note], [0.75, 96, 42, true, 'Size from the supplier PDF.']);
  var plan = EL.svgPlan(EL.layoutRoom({ walls: [{ id: 'w1', name: 'Sink wall', position: 'back', lengthIn: 126, base: wall.base, upper: wall.upper, openings: [{ kind: 'window', fromLeft: 60, width: 30, height: 36, fromFloor: 44 }] },
    { id: 'w2', name: 'Island', position: 'island', islandX: 30, islandY: 60, lengthIn: 72, base: [{ id: 'm', sku: 'B36' }, { id: 'n2', sku: 'B36' }] }] }), { title: 'Kitchen' });
  ['Sink wall · 10′ 6″', 'Island · 6′ 0″', '60″ from back wall', '>SB36<'].forEach(function (x) { ok(plan.indexOf(x) >= 0, 'plan missing ' + x); });
});

test('supplier codes with the colorway first (Buy Wholesale Cabinets)', function () {
  eq(EL.splitSku('SW-U188424'), { code: 'U188424', color: 'SW', brand: 'bwc' });
  eq(EL.splitSku('W3042-SBW'), { code: 'W3042', color: 'SBW' });
  eq(pick(EL.parseSku('SW-U188424')), ['tall', 'base', 18, 84, 24, true]);
  eq(EL.splitSku('FP9624-1.5').code, 'FP9624-1.5');
  eq(EL.splitSku('TK-8').code, 'TK-8');
});

function checks(room) { var out = []; EL.layoutRoom(room).forEach(function (x) { x.layout.checks.forEach(function (c) { out.push(c); }); }); return out; }
function rules(room) { return checks(room).map(function (c) { return c.rule; }); }
test('layout checks: range landing and clearance', function () {
  var room = { walls: [{ id: 'w', name: 'Range wall', position: 'back', lengthIn: 57, base: [it({ sku: 'B09' }), it({ appliance: 'range' }), it({ sku: 'B18' })], upper: [it({ sku: 'W0930' }), it({ sku: 'W3030' })] }] };
  var c = checks(room);
  eq(c.map(function (x) { return x.rule; }), ['range-landing', 'range-clearance']);
  eq(c[0].text, 'Range: 9″ of counter on the left, 18″ on the right. Plan at least 12″ on one side and 15″ on the other.');
  eq(c[1].text, 'W3030 is 18″ over the range; 30″ is usual. Add a hood or raise the cabinet.');
  room.walls[0].upper.splice(1, 0, it({ appliance: 'hood' }));
  eq(rules(room), ['range-landing'], 'a hood takes away the clearance warning');
});
test('layout checks: sink, dishwasher, fridge', function () {
  var c = checks({ walls: [{ id: 'w', name: 'Sink wall', position: 'back', lengthIn: 105, base: [it({ sku: 'SB36' }), it({ sku: 'B30' }), it({ sku: 'B15' }), it({ appliance: 'dishwasher' })] }] });
  eq(c.map(function (x) { return x.rule; }), ['sink-landing', 'dw-sink']);
  eq(c[1].text, 'Dishwasher is 45″ from the sink; within 36″ is usual.');
  eq(rules({ walls: [{ id: 'w', position: 'back', lengthIn: 51, base: [it({ appliance: 'fridge' }), it({ sku: 'B15' })] }] }), ['fridge-wall']);
  eq(rules({ walls: [{ id: 'w', position: 'back', lengthIn: 63, base: [it({ sku: 'BF3' }), it({ appliance: 'fridge' }), it({ sku: 'B24' })] }] }), []);
});
test('layout checks: fillers at corners', function () {
  var c = checks({ walls: [{ id: 'w', position: 'back', lengthIn: 60, cornerLeft: true, base: [it({ sku: '3DB18' })] }] });
  eq(c[0].text, '3DB18 sits right against the corner. Add a filler (about 3″) so its drawers clear the cabinets on the other wall.');
  eq(rules({ walls: [{ id: 'w', position: 'back', lengthIn: 60, cornerLeft: true, base: [it({ sku: 'BF3' }), it({ sku: '3DB18' })] }] }), []);
  eq(rules({ walls: [{ id: 'w', position: 'back', lengthIn: 60, base: [it({ sku: 'BBC42' }), it({ sku: 'B15' })] }] }), ['corner-filler']);
});
test('layout checks: island walkways', function () {
  function room(y) { return { walls: [{ id: 'b', name: 'Sink wall', position: 'back', lengthIn: 120, base: [it({ sku: 'B36' }), it({ sku: 'B36' }), it({ sku: 'B36' })] },
    { id: 'i', name: 'Island', position: 'island', islandX: 30, islandY: y, lengthIn: 48, base: [it({ sku: 'B24' }), it({ sku: 'B24' })] }] }; }
  var c = checks(room(60));
  eq([c.length, c[0].level, c[0].text], [1, 'tip', 'Walkway between the island and Sink wall is 36″; 42″ is usual (48″ with two cooks).']);
  eq(checks(room(54))[0].level, 'warn');
  eq(checks(room(72)).length, 0);
});
test('change orders: quote lines and drawings follow', function () {
  var lines = EL.applyLineChanges([{ sku: 'DC224-VDH', qty: 2 }, { sku: 'B15-VDH', qty: 1 }], { removed: [{ sku: 'DC224-VDH', qty: 1 }, { sku: 'B15-VDH', qty: 1 }], added: [{ sku: 'VDC42RS-VDH', qty: 1 }] });
  eq(lines.map(function (l) { return [l.sku, l.qty]; }), [['DC224-VDH', 1], ['VDC42RS-VDH', 1]]);
  var rooms = [{ name: 'Kitchen', walls: [{ id: 'w', name: 'Sink wall', position: 'back', lengthIn: 60, base: [{ id: 'a', sku: 'B15' }, { id: 'b', sku: 'B18', gapBefore: 2 }, { id: 'c', sku: 'B12' }] }] }];
  var before = EL.layoutWall(rooms[0].walls[0]).base[2].x;
  var r = EL.reviseRooms(rooms, { removed: [{ sku: 'B18', qty: 1 }] });
  eq(r.pulled, [{ sku: 'B18', code: 'B18', room: 'Kitchen', wall: 'Sink wall', run: 'base' }]);
  var after = EL.layoutWall(r.rooms[0].walls[0]).base;
  eq([after.length, after[1].x, before], [2, 35, 35], 'the cabinet after it stays put');
  eq(rooms[0].walls[0].base.length, 3, 'original untouched');
});

test('Buy Wholesale Cabinets 2026 catalog codes', function () {
  function sz(c) { var s = EL.parseSku(c); return [s.kind, s.w, s.h, s.d]; }
  eq(sz('SW-W3018'), ['wall', 30, 18, 12]);
  eq(sz('SW-W1830GD'), ['wall', 18, 30, 12]);
  eq(sz('SW-W362424'), ['wall', 36, 24, 24]);
  eq(sz('SW-O339624'), ['tall', 33, 96, 24]);
  eq(sz('SW-U249024'), ['tall', 24, 90, 24]);
  eq(sz('SW-3DB18'), ['base', 18, 34.5, 24]);
  eq(sz('SW-BFH30'), ['base', 30, 34.5, 24]);
  eq(sz('SW-BWB18'), ['base', 18, 34.5, 24]);
  eq(sz('SW-FSB36'), ['base', 36, 34.5, 24]);
  eq(sz('SW-VS30'), ['vanity', 30, 34.5, 21]);
  eq(sz('SW-V3021DL'), ['vanity', 30, 34.5, 21]);
  eq(sz('SW-VSD42'), ['vanity', 42, 34.5, 21]);
  eq(sz('SW-MO3036'), ['wall', 30, 36, 12]);
  eq(sz('SW-WSD630'), ['wall', 30, 6, 12]);
  eq(sz('SW-REPV2496'), ['panel', 1.5, 96, 24]);
  var f = EL.parseSku('SW-F396'); eq([f.layer, f.w, f.h], ['base', 3, 96], 'tall filler stands on the floor');
  eq(EL.parseSku('SW-F342').layer, 'upper');
  var dcw = EL.parseSku('SW-DCW2436'); eq([dcw.corner, dcw.foot, dcw.h], ['diagonal', 24, 36]);
  var erb = EL.parseSku('SW-ERB36'); eq([erb.corner, erb.foot], ['diagonal', 36]);
  var bbc = EL.parseSku('SW-BBC42'); eq([bbc.w, bbc.corner, bbc.sure], [39, 'blind', true], 'catalog box width');
  eq(EL.parseSku('BBC42-SBW').w, 42, 'other suppliers keep the code width');
  ['SW-FPV4296', 'SW-CM8', 'SW-RCM4S(LCM)', 'SW-LRM8', 'SW-TKC', 'SW-USV2496', 'SW-WDEP36', 'SW-RS24', 'SW-SBF4242'].forEach(function (c) { eq(EL.parseSku(c).kind, 'trim', c); });
  eq(EL.trimCheck([{ sku: 'SW-RCM4S(LCM)', qty: 2 }, { sku: 'SW-CM8', qty: 1 }], []).filter(function (r) { return r.key === 'crown'; })[0].quotedFt, 24, 'RCM4S is an 8′ stick');
});

test('room templates: copy rooms to another model or job', function () {
  var src = [{ id: 'r1', name: 'Kitchen', set: 'San Luis', walls: [{ id: 'w1', name: 'Sink wall', position: 'back', lengthIn: 120,
    base: [{ id: 'a', sku: 'B33-SBW' }, { id: 'b', appliance: 'dishwasher' }, { id: 'c2', sku: 'SB36-SBW', gapBefore: 1.5 }], upper: [{ id: 'd', sku: 'W3042-SBW' }] }] }];
  var r = EL.copyRooms(src, [{ sku: 'B33-UMO', qty: 1 }, { sku: 'SB36-UMO', qty: 1 }], { set: 'Mesa Ridge' });
  var w = r.rooms[0].walls[0];
  eq([r.rooms[0].set, r.rooms[0].name, w.base.map(function (i) { return i.sku || i.appliance; }), w.base[2].gapBefore, w.upper[0].sku],
     ['Mesa Ridge', 'Kitchen', ['B33-UMO', 'dishwasher', 'SB36-UMO'], 1.5, 'W3042-SBW']);
  eq([r.items, r.unmatched], [3, [{ code: 'W3042', count: 1 }]]);
  ok(r.rooms[0].id !== 'r1' && w.id !== 'w1' && w.base[0].id !== 'a', 'new ids');
  eq(src[0].walls[0].base[0].sku, 'B33-SBW', 'source untouched');
});

console.log('elevations.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
