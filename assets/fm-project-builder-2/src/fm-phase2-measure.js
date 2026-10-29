/*
 * Fremont Makers Project Builder · Phase 2 · Field measure (HANDOFF §24).  window.FMMeasure
 *
 * Measurements taken on site, on a phone: rooms → walls → windows, doors, outlets and plumbing, ceiling and soffit,
 * photos and notes, with who measured and when. Pure functions only (no DOM, no storage); the screens are in
 * preview/phase2-measure.js. A visit becomes Elevation rooms (FMElev) with the walls and openings filled in.
 *
 * A visit:  { id, jobCode|null, lead: { customer, address }|null, measuredBy: { name, role: 'staff'|'builder'|'buyer' },
 *             measuredOn: 'YYYY-MM-DD', confirmedBy: { name, on }|null, notes,
 *             rooms: [ { id, name, ceiling, soffit, notes, walls: [ { id, name, position, length, notes, photos: [photoId],
 *                     openings: [ { kind: 'window'|'door', fromLeft, width, height, fromFloor } ],
 *                     marks: [ { kind, fromLeft, fromFloor } ] } ] } ],
 *             broughtInto: [ { jobCode, on, by } ] }
 * Lengths are inches (numbers). Typed text goes through parseLength first.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMMeasure = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.1.0';

  var MARKS = {
    drain: { label: 'Sink drain', short: 'Drain' },
    water: { label: 'Water supply', short: 'Water' },
    gas: { label: 'Gas line', short: 'Gas' },
    outlet: { label: 'Outlet', short: 'Outlet' },
    switch: { label: 'Light switch', short: 'Switch' },
    vent: { label: 'Vent or duct', short: 'Vent' },
    light: { label: 'Light or fan box', short: 'Light' }
  };
  var POSITIONS = ['back', 'left', 'right', 'front', 'island'];

  /* "10' 6 1/2", "126 1/2", "126.5", "34-5/8", "3/4", "10ft 6in", "2' " → inches. NaN if it can't be read. */
  function parseLength(text) {
    if (typeof text === 'number') return isFinite(text) ? text : NaN;
    var s = String(text == null ? '' : text).trim().toLowerCase()
      .replace(/[″"]|inches|inch|in\b/g, ' ').replace(/[′’']|feet|foot|ft\b/g, "'")
      .replace(/[⅛]/g, ' 1/8').replace(/[¼]/g, ' 1/4').replace(/[⅜]/g, ' 3/8').replace(/[½]/g, ' 1/2')
      .replace(/[⅝]/g, ' 5/8').replace(/[¾]/g, ' 3/4').replace(/[⅞]/g, ' 7/8').replace(/\s+/g, ' ').trim();
    if (!s) return NaN;
    var ft = 0, rest = s, m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(.*)$/);
    if (m) { ft = +m[1]; rest = m[2].replace(/^-\s*/, '').trim(); }
    if (!rest) return ft * 12;
    // whole and fraction: "6 1/2", "6-1/2", "1/2", "6.5", "6"
    m = rest.match(/^(\d+(?:\.\d+)?)?(?:\s*[- ]\s*)?(?:(\d+)\/(\d+))?$/);
    if (!m || (m[1] == null && m[2] == null)) return NaN;
    if (m[2] != null && +m[3] === 0) return NaN;
    var inch = (m[1] != null ? +m[1] : 0) + (m[2] != null ? +m[2] / +m[3] : 0);
    return ft * 12 + inch;
  }
  /* 125.5 → 125 1/2″ (to the 1/16″) */
  function fmt(x) {
    x = q16(+x || 0); var w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16), d = 16;
    while (f && f % 2 === 0) { f /= 2; d /= 2; }
    return (w || !f ? w : '') + (f ? (w ? ' ' : '') + f + '/' + d : '') + '″';
  }
  /* to the nearest 1/16″, the finest a tape gives */
  function q16(x) { return Math.round(x * 16) / 16; }

  var seq = 0;
  function newId(p) { seq++; return (p || 'm') + '-' + Date.now().toString(36) + '-' + seq; }
  function blankVisit(opts) {
    opts = opts || {};
    return { id: newId('visit'), jobCode: opts.jobCode || null, lead: opts.lead || null,
      measuredBy: { name: opts.by || '', role: 'staff' }, measuredOn: opts.today || '', confirmedBy: null, notes: '',
      rooms: [], broughtInto: [] };
  }
  function blankRoom(name) { return { id: newId('room'), name: name || 'Kitchen', ceiling: 96, soffit: 0, notes: '', walls: [] }; }
  function blankWall(room) {
    var n = room.walls.length, used = room.walls.map(function (w) { return w.position; });
    var pos = ['back', 'left', 'right', 'front'].filter(function (p) { return used.indexOf(p) < 0; })[0] || 'back';
    return { id: newId('wall'), name: 'Wall ' + (n + 1), position: pos, length: null, notes: '', photos: [], openings: [], marks: [] };
  }

  /* Problems to fix before the numbers are used. level: 'error' (missing or impossible) or 'warn' (worth a second look). */
  function checkVisit(v) {
    var out = [];
    function add(level, room, wall, text) { out.push({ level: level, room: room ? room.id : null, wall: wall ? wall.id : null, text: (room ? room.name + (wall ? ' · ' + wall.name : '') + ': ' : '') + text }); }
    if (!v.measuredBy || !String(v.measuredBy.name || '').trim()) add('error', null, null, 'Say who measured.');
    if (!v.rooms.length) add('error', null, null, 'Add a room.');
    v.rooms.forEach(function (r) {
      var ceil = +r.ceiling;
      if (!(ceil > 0)) add('error', r, null, 'Enter the ceiling height.');
      else if (ceil < 84 || ceil > 144) add('warn', r, null, 'Ceiling of ' + ceil + '″ is unusual. Check it.');
      if (+r.soffit < 0 || (ceil > 0 && +r.soffit >= ceil)) add('error', r, null, 'The soffit has to be lower than the ceiling.');
      if (!r.walls.length) add('error', r, null, 'Add the walls.');
      var seen = {};
      r.walls.forEach(function (w) {
        var L = +w.length;
        if (!(L > 0)) add('error', r, w, 'Enter the length.');
        else if (L > 480) add('warn', r, w, 'Length of ' + L + '″ (over 40′). Check it.');
        if (w.position !== 'island' && seen[w.position]) add('warn', r, w, 'Two walls are both on the ' + w.position + '. The 3D view and plan put one on top of the other.');
        seen[w.position] = 1;
        (w.openings || []).forEach(function (o, i) {
          var nm = (o.kind === 'door' ? 'Door' : 'Window') + ' ' + (i + 1);
          if (!(+o.width > 0) || !(+o.height > 0)) add('error', r, w, nm + ': enter width and height.');
          if (L > 0 && (+o.fromLeft || 0) + (+o.width || 0) > L + 0.01) add('error', r, w, nm + ' runs past the end of the wall.');
          var top = (o.kind === 'door' ? 0 : +o.fromFloor || 0) + (+o.height || 0);
          if (ceil > 0 && top > ceil + 0.01) add('error', r, w, nm + ' goes above the ceiling.');
          if (o.kind !== 'door' && !(+o.fromFloor > 0)) add('warn', r, w, nm + ': enter its height off the floor.');
        });
        (w.marks || []).forEach(function (k) {
          if (L > 0 && (+k.fromLeft || 0) > L + 0.01) add('error', r, w, (MARKS[k.kind] || MARKS.outlet).label + ' is past the end of the wall.');
        });
      });
    });
    return out;
  }

  /* One visit room → one Elevations room (FMElev shape). Cabinets are added later from the quote. */
  function toElevationRoom(r, visit, set) {
    return {
      id: newId('room'), name: r.name, set: set,
      measured: { visitId: visit.id, by: visit.measuredBy.name, role: visit.measuredBy.role, on: visit.measuredOn, confirmedBy: visit.confirmedBy ? visit.confirmedBy.name : null },
      walls: r.walls.map(function (w) {
        return { id: newId('wall'), name: w.name, position: w.position || 'back', lengthIn: q16(+w.length || 0), specs: { ceiling: +r.ceiling || 96, soffit: +r.soffit || 0 },
          cornerLeft: false, cornerRight: false, base: [], upper: [], notes: w.notes || '', photos: (w.photos || []).slice(), measured: true,
          openings: (w.openings || []).map(function (o) { return { kind: o.kind === 'door' ? 'door' : 'window', fromLeft: +o.fromLeft || 0, width: +o.width || 0, height: +o.height || 0, fromFloor: o.kind === 'door' ? 0 : (+o.fromFloor || 0) }; }),
          marks: (w.marks || []).map(function (k) { return { kind: k.kind, fromLeft: +k.fromLeft || 0, fromFloor: +k.fromFloor || 0 }; }) };
      })
    };
  }

  /* Puts the field numbers onto a job's existing room: walls matched by name, then by order; the cabinets stay.
     Returns the updated room and what changed. */
  /* pairs each field wall with a wall of the room: same name first, then the walls left over, in order */
  function pairWalls(walls, fieldWalls) {
    var taken = {}, pair = {};
    fieldWalls.forEach(function (fw) {
      var w = walls.filter(function (x) { return !taken[x.id] && String(x.name).toLowerCase() === String(fw.name).toLowerCase(); })[0];
      if (w) { pair[fw.id] = w; taken[w.id] = 1; }
    });
    fieldWalls.forEach(function (fw) {
      if (pair[fw.id]) return;
      var w = walls.filter(function (x) { return !taken[x.id]; })[0];
      if (w) { pair[fw.id] = w; taken[w.id] = 1; }
    });
    return pair;
  }
  function applyToRoom(room, r, visit) {
    var out = JSON.parse(JSON.stringify(room)), changes = [];
    var fresh = toElevationRoom(r, visit, room.set), pair = pairWalls(out.walls, fresh.walls);
    fresh.walls.forEach(function (fw) {
      var w = pair[fw.id];
      if (!w) { out.walls.push(fw); changes.push({ wall: fw.name, text: 'added (' + fmt(fw.lengthIn) + ')' }); return; }
      var was = +w.lengthIn;
      if (Math.abs(was - fw.lengthIn) > 0.01) changes.push({ wall: w.name, text: 'length ' + fmt(was) + ' → ' + fmt(fw.lengthIn), diff: fw.lengthIn - was });
      w.lengthIn = fw.lengthIn; w.specs = w.specs || {}; w.specs.ceiling = fw.specs.ceiling; w.specs.soffit = fw.specs.soffit;
      w.openings = fw.openings; w.marks = fw.marks; w.photos = fw.photos; w.notes = fw.notes; w.measured = true;
      if (fw.position && fw.position !== w.position) { changes.push({ wall: w.name, text: 'position ' + w.position + ' → ' + fw.position }); w.position = fw.position; }
    });
    out.measured = fresh.measured;
    return { room: out, changes: changes };
  }

  /* Plan (what the quote was drawn from) vs field: walls matched by name, then order. */
  function compare(planRoom, r) {
    var rows = [], pair = pairWalls(planRoom.walls || [], r.walls || []);
    (r.walls || []).forEach(function (fw) {
      var pw = pair[fw.id] || null;
      var plan = pw ? +pw.lengthIn : null, field = +fw.length || 0;
      rows.push({ wall: fw.name, plan: plan, field: field, diff: plan == null ? null : q16(field - plan), flag: plan != null && Math.abs(field - plan) >= 0.25 });
    });
    return rows;
  }

  return { VERSION: VERSION, MARKS: MARKS, POSITIONS: POSITIONS, parseLength: parseLength, q16: q16, fmt: fmt, newId: newId,
    blankVisit: blankVisit, blankRoom: blankRoom, blankWall: blankWall, checkVisit: checkVisit,
    toElevationRoom: toElevationRoom, applyToRoom: applyToRoom, compare: compare };
}));
