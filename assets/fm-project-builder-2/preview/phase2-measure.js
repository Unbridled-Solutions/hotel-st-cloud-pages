/*
 * Phase 2 preview · Field measure (HANDOFF §24). Uses FMMeasure (src/fm-phase2-measure.js) and FMElev for the drawings.
 *
 *   #/measure          site visits, newest first, and "Start a site visit"
 *   #/measure/<id>     one visit: rooms → walls → windows, doors, outlets and plumbing, photos, notes (built for a phone)
 *
 * Visits live in their own storage (fm_phase2_visits); photos are stored one per key (fm_phase2_photo_<id>), shrunk to 1024 px.
 * In production the server keeps visits and photos, and the phone keeps working without signal and syncs later (§24).
 * A visit is brought into a job from the job's Elevations tab (compare, then "Use field measurements"), or starts a new project.
 */
(function () {
  'use strict';
  var M = window.FMMeasure, EL = window.FMElev;
  var KEY = 'fm_phase2_visits', PHOTO = 'fm_phase2_photo_';
  var POS = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall', island: 'Island or peninsula' };
  var ROLE = { staff: 'Fremont Makers', builder: 'Builder', buyer: 'Buyer' };

  /* ---------- storage ---------- */
  var cache = null;
  function all() {
    if (cache) return cache;
    try { cache = JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch (e) { cache = []; }
    if (!Array.isArray(cache)) cache = [];
    return cache;
  }
  function persist() { try { window.localStorage.setItem(KEY, JSON.stringify(all())); } catch (e) { /* kept in memory for this session */ } }
  function visit(id) { return all().filter(function (v) { return v.id === id; })[0] || null; }
  function forJob(code) { return all().filter(function (v) { return v.jobCode === code; }); }
  function photoSrc(id) { try { return window.localStorage.getItem(PHOTO + id) || ''; } catch (e) { return ''; } }
  function edit(v, fn) { fn(v); v.updatedAt = new Date().toISOString(); persist(); }

  /* ---------- helpers ---------- */
  function len(x) { return x == null || x === '' || isNaN(+x) ? '' : EL.inches(+x); }
  function lenIn(c, attr, label, val, hint) {
    var shown = val == null || val === '' ? '' : typeof val === 'number' ? EL.inches(val).replace('″', '') : String(val);   // reads like a tape: 47 1/2
    return '<label class="p2-fld p2-ms-len"><span>' + label + '</span><input class="fmp1-input" inputmode="decimal" autocomplete="off" ' + attr + ' value="' + c.esc(shown) + '"' +
      (hint ? ' placeholder="' + c.esc(hint) + '"' : '') + '><em class="p2-small fmp1-faint">' + (val === '' || val == null ? (hint ? '' : '') : '= ' + (+val >= 12 ? EL.feetInches(+val) : len(val))) + '</em></label>';
  }
  function status(v) {
    var p = M.checkVisit(v), err = p.filter(function (x) { return x.level === 'error'; }).length;
    if (v.broughtInto && v.broughtInto.length) return { tone: 'fmp1-pill--good', text: 'In ' + v.broughtInto.map(function (b) { return b.jobCode; }).join(', ') };
    if (err) return { tone: '', text: err + ' to finish' };
    return { tone: 'fmp1-pill--good', text: 'Ready to use' };
  }
  function who(v) { return (v.measuredBy.name || '—') + (v.measuredBy.role !== 'staff' ? ' (' + ROLE[v.measuredBy.role] + ')' : ''); }
  function forWhat(c, v) {
    var j = v.jobCode ? c.store.job(v.jobCode) : null;
    return j ? j.customer + ' · ' + (j.projectName || j.jobCode) : v.lead ? (v.lead.customer || 'New lead') + (v.lead.address ? ' · ' + v.lead.address : '') : 'No job yet';
  }

  /* ---------- list ---------- */
  function list(c) {
    var esc = c.esc, u = c.ui.ms = c.ui.ms || {};
    var jobs = c.store.jobs().filter(function (j) { return j.stage !== 'lost' && j.stage !== 'complete'; });
    var rows = all().slice().sort(function (a, b) { return String(b.updatedAt || b.measuredOn).localeCompare(String(a.updatedAt || a.measuredOn)); }).map(function (v) {
      var st = status(v);
      return '<li><a class="p2-ms-row" href="#/measure/' + encodeURIComponent(v.id) + '"><span><b>' + esc(forWhat(c, v)) + '</b><br><span class="p2-small fmp1-muted">' + esc(c.longDate(v.measuredOn)) + ' · ' + esc(who(v)) + ' · ' +
        v.rooms.length + ' room' + (v.rooms.length === 1 ? '' : 's') + ', ' + v.rooms.reduce(function (t, r) { return t + r.walls.length; }, 0) + ' walls</span></span><span class="fmp1-pill ' + st.tone + '">' + esc(st.text) + '</span></a></li>';
    }).join('');
    var start = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Start a site visit</span>' +
      '<div class="p2-chips" role="group" aria-label="For"><button class="fmp1-btn" data-msfor="job" aria-pressed="' + (u.forWhat !== 'lead') + '">For a project</button><button class="fmp1-btn" data-msfor="lead" aria-pressed="' + (u.forWhat === 'lead') + '">For a lead (no project yet)</button></div>' +
      (u.forWhat === 'lead' ? '<div class="p2-el-2"><label class="p2-fld"><span>Customer</span><input class="fmp1-input" data-msnew="customer" value="' + esc(u.customer || '') + '"></label></div>' + window.FMAddress.fieldsHTML(function (f) { return 'data-msaddr="' + f + '"'; }, u.addr, { legend: 'Address' }) :
        '<label class="p2-fld"><span>Project</span><select class="fmp1-input" data-msnew="job"><option value="">Choose…</option>' + jobs.map(function (j) { return '<option value="' + esc(j.jobCode) + '"' + (u.job === j.jobCode ? ' selected' : '') + '>' + esc(j.jobCode + ' · ' + j.customer + ' · ' + (j.projectName || '')) + '</option>'; }).join('') + '</select></label>') +
      (u.err ? '<p class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(u.err) + '</p>' : '') +
      '<button class="fmp1-btn fmp1-btn--primary" data-msstart>Start measuring</button></div>';
    return '<div class="p2-head"><h1 class="fmp1-h p2-h1">Field measure</h1><p class="p2-sub">Measure on site from a phone: walls, windows, doors, outlets and plumbing, photos. The numbers then go straight onto the job\'s elevations.</p></div>' +
      start + '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Site visits · ' + all().length + '</span>' + (rows ? '<ul class="p2-list p2-ms-list">' + rows + '</ul>' : '<p class="p2-empty">No site visits yet.</p>') + '</div>';
  }

  /* ---------- one visit ---------- */
  function page(c, id) {
    var v = visit(id), esc = c.esc;
    if (!v) return '<h1 class="fmp1-h p2-h1">Site visit not found</h1><a class="fmp1-btn" href="#/measure">Back to field measure</a>';
    var u = c.ui.ms = c.ui.ms || {};
    if (u.visit !== v.id) { u.visit = v.id; u.room = v.rooms[0] ? v.rooms[0].id : null; u.wall = null; u.msg = null; }
    var room = v.rooms.filter(function (r) { return r.id === u.room; })[0] || v.rooms[0] || null; if (room) u.room = room.id;
    var probs = M.checkVisit(v), j = v.jobCode ? c.store.job(v.jobCode) : null, st = status(v);
    var head = '<div class="fmp1-card p2-pad p2-ms-head"><div class="p2-between"><div><a class="p2-small" href="#/measure">← Field measure</a><h1 class="fmp1-h p2-h1" style="margin:2px 0">' + esc(forWhat(c, v)) + '</h1>' +
      '<span class="p2-small fmp1-muted">' + (j ? '<a href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations">' + esc(j.jobCode) + '</a> · ' : '') + esc(c.longDate(v.measuredOn)) + '</span></div><span class="fmp1-pill ' + st.tone + '">' + esc(st.text) + '</span></div>' +
      '<div class="p2-el-2"><label class="p2-fld"><span>Measured by</span><input class="fmp1-input" data-msv="measuredBy.name" value="' + esc(v.measuredBy.name) + '"></label>' +
      '<label class="p2-fld"><span>Who is that</span><select class="fmp1-input" data-msv="measuredBy.role">' + Object.keys(ROLE).map(function (k) { return '<option value="' + k + '"' + (v.measuredBy.role === k ? ' selected' : '') + '>' + ROLE[k] + '</option>'; }).join('') + '</select></label></div>' +
      (u.msg ? '<div class="fmp1-note fmp1-note--info p2-small" role="status">' + esc(u.msg) + '</div>' : '') + '</div>';
    var tabs = '<div class="p2-row p2-ms-tabs" role="tablist" aria-label="Rooms">' + v.rooms.map(function (r) {
      return '<button class="fmp1-btn' + (room && r.id === room.id ? ' fmp1-btn--primary' : '') + '" role="tab" aria-selected="' + !!(room && r.id === room.id) + '" data-msroom="' + esc(r.id) + '">' + esc(r.name) + '</button>'; }).join('') +
      '<button class="fmp1-btn fmp1-btn--quiet" data-msaddroom>+ Room</button></div>';
    var body = room ? roomHTML(c, v, room, u, j) : '<p class="p2-empty">Add the first room.</p>';
    var probList = probs.length ? '<ul class="p2-list p2-small">' + probs.map(function (p) { return '<li style="justify-content:flex-start"><span class="p2-dot' + (p.level === 'error' ? ' alert' : '') + '" aria-hidden="true"></span><span>' + esc(p.text) + '</span></li>'; }).join('') + '</ul>' :
      '<p class="p2-ok p2-small">✓ Every wall has its numbers.</p>';
    var confirm = '<label class="p2-el-check"><input type="checkbox" data-msconfirm' + (v.confirmedBy ? ' checked' : '') + '> The buyer saw and confirmed these measurements</label>' +
      (v.confirmedBy ? '<label class="p2-fld"><span>Buyer\'s name</span><input class="fmp1-input" data-msv="confirmedBy.name" value="' + esc(v.confirmedBy.name || '') + '"></label>' : '');
    var use = j ? '<a class="fmp1-btn fmp1-btn--primary" href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations">Compare and use on ' + esc(j.jobCode) + '</a>' :
      '<button class="fmp1-btn fmp1-btn--primary" data-msproject' + (probs.some(function (p) { return p.level === 'error'; }) ? ' disabled title="Finish the measurements first"' : '') + '>Start a project from this visit</button>';
    var foot = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Before you leave the house</span>' + probList + confirm +
      '<label class="p2-fld"><span>Notes for the whole visit</span><textarea class="fmp1-input" rows="2" data-msv="notes">' + esc(v.notes || '') + '</textarea></label>' +
      '<div class="p2-row">' + use + '<button class="p2-linkbtn p2-small" data-msdelete style="color:var(--fmp1-alert-ink);margin-left:auto">Delete this visit</button></div></div>';
    return '<div class="p2-ms">' + head + tabs + body + foot + '</div>';
  }

  function roomHTML(c, v, room, u, j) {
    var esc = c.esc, planRoom = planFor(c, j, room);
    var top = '<div class="fmp1-card p2-pad"><div class="p2-el-2"><label class="p2-fld"><span>Room name</span><input class="fmp1-input" data-msr="name" value="' + esc(room.name) + '"></label>' +
      lenIn(c, 'data-msr="ceiling"', 'Ceiling height', room.ceiling) + lenIn(c, 'data-msr="soffit"', 'Soffit (0 if none)', room.soffit) + '</div>' +
      '<label class="p2-fld"><span>Room notes (out of plumb, floor slope, anything odd)</span><textarea class="fmp1-input" rows="2" data-msr="notes">' + esc(room.notes || '') + '</textarea></label></div>';
    var firstMissing = (room.walls.filter(function (w) { return !(+w.length > 0); })[0] || {}).id;
    var walls = room.walls.map(function (w, i) {
      var open = u.wall === w.id || (u.wall == null && w.id === firstMissing);
      var plan = planRoom ? (planRoom.walls.filter(function (pw) { return pw.name.toLowerCase() === w.name.toLowerCase(); })[0] || planRoom.walls[i]) : null;
      var sum = '<button class="p2-ms-wallhead" data-mswall="' + esc(w.id) + '" aria-expanded="' + open + '"><span><b>' + esc(w.name) + '</b> <span class="p2-small fmp1-muted">' + esc(POS[w.position] || w.position) + '</span></span>' +
        '<span class="p2-small">' + (+w.length > 0 ? EL.feetInches(+w.length) : '<b style="color:var(--fmp1-alert-ink)">length?</b>') + ' · ' + w.openings.length + ' opening' + (w.openings.length === 1 ? '' : 's') + ' · ' + w.marks.length + ' mark' + (w.marks.length === 1 ? '' : 's') + (w.photos.length ? ' · ' + w.photos.length + ' photo' + (w.photos.length === 1 ? '' : 's') : '') + '</span></button>';
      if (!open) return '<div class="fmp1-card p2-ms-wall">' + sum + '</div>';
      return '<div class="fmp1-card p2-ms-wall is-open">' + sum + '<div class="p2-ms-wallbody">' + wallBody(c, room, w, plan) + '</div></div>';
    }).join('');
    return top + walls + '<button class="fmp1-btn p2-ms-add" data-msaddwall>+ Add a wall</button>' +
      (v.rooms.length > 1 ? '<button class="p2-linkbtn p2-small" data-msrmroom style="color:var(--fmp1-alert-ink)">Remove this room</button>' : '');
  }
  function wallBody(c, room, w, plan) {
    var esc = c.esc, k = esc(w.id);
    var openings = w.openings.map(function (o, i) {
      return '<div class="p2-ms-item"><div class="p2-between"><b class="p2-small">' + (o.kind === 'door' ? 'Door' : 'Window') + ' ' + (i + 1) + '</b><button class="p2-linkbtn p2-small" data-msrmopen="' + k + ':' + i + '">Remove</button></div><div class="p2-ms-4">' +
        lenIn(c, 'data-mso="' + k + ':' + i + ':fromLeft"', 'From left', o.fromLeft) + lenIn(c, 'data-mso="' + k + ':' + i + ':width"', 'Width', o.width) +
        lenIn(c, 'data-mso="' + k + ':' + i + ':height"', 'Height', o.height) + (o.kind === 'door' ? '' : lenIn(c, 'data-mso="' + k + ':' + i + ':fromFloor"', 'Off the floor', o.fromFloor)) + '</div></div>';
    }).join('');
    var marks = w.marks.map(function (m, i) {
      return '<div class="p2-ms-item"><div class="p2-between"><b class="p2-small">' + esc((M.MARKS[m.kind] || {}).label || m.kind) + '</b><button class="p2-linkbtn p2-small" data-msrmmark="' + k + ':' + i + '">Remove</button></div><div class="p2-ms-4">' +
        lenIn(c, 'data-msm="' + k + ':' + i + ':fromLeft"', 'From left (center)', m.fromLeft) + lenIn(c, 'data-msm="' + k + ':' + i + ':fromFloor"', 'Off the floor (center)', m.fromFloor) + '</div></div>';
    }).join('');
    var photos = w.photos.map(function (pid) { var src = photoSrc(pid); return src ? '<span class="p2-ms-photo"><img src="' + src + '" alt="Photo of ' + esc(w.name) + '"><button class="p2-linkbtn p2-small" data-msrmphoto="' + k + ':' + esc(pid) + '" aria-label="Remove photo">✕</button></span>' : ''; }).join('');
    var preview = '';
    if (+w.length > 0) {
      var er = M.toElevationRoom({ name: room.name, ceiling: room.ceiling, soffit: room.soffit, walls: [w] }, { id: 'x', measuredBy: { name: '' }, measuredOn: '' }, 'x');
      var lay = EL.layoutWall(er.walls[0], {}, {});
      preview = '<div class="p2-el-canvas p2-ms-preview">' + EL.svgElevation(lay, { title: room.name + ' · ' + w.name, uid: 'ms' }) + '</div>';
    }
    return '<div class="p2-el-2"><label class="p2-fld"><span>Wall name</span><input class="fmp1-input" data-msw="' + k + ':name" value="' + esc(w.name) + '"></label>' +
      '<label class="p2-fld"><span>Where it is</span><select class="fmp1-input" data-msw="' + k + ':position">' + Object.keys(POS).map(function (p) { return '<option value="' + p + '"' + (w.position === p ? ' selected' : '') + '>' + POS[p] + '</option>'; }).join('') + '</select></label></div>' +
      lenIn(c, 'data-msw="' + k + ':length"' + (c.ui.ms.focus === w.id ? ' data-autofocus' : ''), 'Wall length, corner to corner (10\' 6 1/2 or 126 1/2)', w.length, plan ? 'plan says ' + EL.inches(+plan.lengthIn) : '') +
      (plan && +w.length > 0 && Math.abs(+w.length - +plan.lengthIn) >= 0.25 ? '<p class="p2-small" style="color:var(--fmp1-alert-ink)">' + (+w.length > +plan.lengthIn ? EL.inches(+w.length - +plan.lengthIn) + ' longer' : EL.inches(+plan.lengthIn - +w.length) + ' shorter') + ' than the drawing (' + EL.inches(+plan.lengthIn) + ').</p>' : '') +
      '<div class="p2-el-run"><b class="p2-small">Windows and doors</b>' + openings + '<div class="p2-row"><button class="fmp1-btn fmp1-btn--quiet" data-msopen="' + k + ':window">+ Window</button><button class="fmp1-btn fmp1-btn--quiet" data-msopen="' + k + ':door">+ Door</button></div></div>' +
      '<div class="p2-el-run"><b class="p2-small">Outlets and plumbing</b>' + marks + '<div class="p2-row p2-ms-marks">' + Object.keys(M.MARKS).map(function (m) { return '<button class="fmp1-btn fmp1-btn--quiet" data-msmark="' + k + ':' + m + '">+ ' + M.MARKS[m].short + '</button>'; }).join('') + '</div></div>' +
      '<div class="p2-el-run"><b class="p2-small">Photos</b><div class="p2-ms-photos">' + photos + '</div><label class="fmp1-btn p2-ms-camera">📷 Take or add a photo<input type="file" accept="image/*" capture="environment" data-msphoto="' + k + '" hidden></label></div>' +
      '<label class="p2-fld"><span>Notes for this wall</span><textarea class="fmp1-input" rows="2" data-msw="' + k + ':notes">' + esc(w.notes || '') + '</textarea></label>' +
      preview + '<div class="p2-row"><button class="fmp1-btn" data-msnextwall="' + k + '">Done with this wall</button><button class="p2-linkbtn p2-small" data-msrmwall="' + k + '" style="color:var(--fmp1-alert-ink);margin-left:auto">Remove wall</button></div>';
  }
  /* the job's drawn room with the same name (to show "plan says …") */
  function planFor(c, j, room) {
    if (!j || !j.elevations || !j.elevations.rooms) return null;
    return j.elevations.rooms.filter(function (r) { return r.name.toLowerCase() === room.name.toLowerCase(); })[0] || null;
  }

  /* ---------- events ---------- */
  function cur(c) {
    var h = (location.hash || '').replace(/^#\/?/, '').split('/');
    if (h[0] !== 'measure') return null;
    return { id: decodeURIComponent(h[1] || ''), v: h[1] ? visit(decodeURIComponent(h[1])) : null };
  }
  function findWall(v, id) { var out = null; v.rooms.forEach(function (r) { r.walls.forEach(function (w) { if (w.id === id) out = { room: r, wall: w }; }); }); return out; }

  function click(c, t) {
    var x = cur(c); if (!x) return false;
    var u = c.ui.ms = c.ui.ms || {}, d = t.dataset;
    if (d.msfor) { u.forWhat = d.msfor; u.err = null; c.render(); return true; }
    if (t.hasAttribute('data-msstart')) {
      var by = c.me().name, v;
      if (u.forWhat === 'lead') {
        if (!String(u.customer || '').trim()) { u.err = 'Enter the customer\'s name.'; c.render(); return true; }
        v = M.blankVisit({ by: by, today: c.TODAY, lead: { customer: u.customer.trim(), address: window.FMAddress.format(u.addr), addr: u.addr || window.FMAddress.blank() } });
      } else {
        var j = c.store.job(u.job || ''); if (!j) { u.err = 'Choose the project.'; c.render(); return true; }
        v = startForJob(c, j);
      }
      if (!v.rooms.length) { var r0 = M.blankRoom('Kitchen'); r0.walls.push(M.blankWall(r0)); v.rooms.push(r0); }
      all().push(v); persist(); u.err = null; u.customer = ''; u.addr = null;
      c.go('#/measure/' + encodeURIComponent(v.id)); return true;
    }
    var vv = x.v; if (!vv) return false;
    if (d.msroom) { u.room = d.msroom; u.wall = null; c.render(); return true; }
    if (t.hasAttribute('data-msaddroom')) {
      var nr = M.blankRoom(vv.rooms.length ? 'Room ' + (vv.rooms.length + 1) : 'Kitchen'); nr.walls.push(M.blankWall(nr));
      edit(vv, function (q) { q.rooms.push(nr); }); u.room = nr.id; u.wall = nr.walls[0].id; c.render(); return true;
    }
    if (t.hasAttribute('data-msrmroom')) { edit(vv, function (q) { q.rooms = q.rooms.filter(function (r) { return r.id !== u.room; }); }); u.room = null; c.render(); return true; }
    var room = vv.rooms.filter(function (r) { return r.id === u.room; })[0] || vv.rooms[0];
    if (d.mswall) { u.wall = u.wall === d.mswall ? '' : d.mswall; u.focus = u.wall; c.render(); u.focus = null; return true; }
    if (t.hasAttribute('data-msaddwall') && room) { var nw = M.blankWall(room); edit(vv, function () { room.walls.push(nw); }); u.wall = nw.id; u.focus = nw.id; c.render(); u.focus = null; return true; }
    if (d.msnextwall && room) {
      var idx = room.walls.map(function (w) { return w.id; }).indexOf(d.msnextwall);
      u.wall = room.walls[idx + 1] ? room.walls[idx + 1].id : ''; u.focus = u.wall; c.render(); u.focus = null; return true;
    }
    if (d.msrmwall) { edit(vv, function (q) { q.rooms.forEach(function (r) { r.walls = r.walls.filter(function (w) { return w.id !== d.msrmwall; }); }); }); u.wall = ''; c.render(); return true; }
    if (d.msopen) { var p = d.msopen.split(':'), fw = findWall(vv, p[0]); if (fw) edit(vv, function () { fw.wall.openings.push({ kind: p[1], fromLeft: '', width: p[1] === 'door' ? 32 : '', height: p[1] === 'door' ? 80 : '', fromFloor: p[1] === 'door' ? 0 : '' }); }); c.render(); return true; }
    if (d.msrmopen) { var q = d.msrmopen.split(':'), fw2 = findWall(vv, q[0]); if (fw2) edit(vv, function () { fw2.wall.openings.splice(+q[1], 1); }); c.render(); return true; }
    if (d.msmark) { var mk = d.msmark.split(':'), fw3 = findWall(vv, mk[0]); if (fw3) edit(vv, function () { fw3.wall.marks.push({ kind: mk[1], fromLeft: '', fromFloor: mk[1] === 'outlet' ? 44 : mk[1] === 'switch' ? 48 : '' }); }); c.render(); return true; }
    if (d.msrmmark) { var mm = d.msrmmark.split(':'), fw4 = findWall(vv, mm[0]); if (fw4) edit(vv, function () { fw4.wall.marks.splice(+mm[1], 1); }); c.render(); return true; }
    if (d.msrmphoto) {
      var ph = d.msrmphoto.split(':'), fw5 = findWall(vv, ph[0]);
      if (fw5) edit(vv, function () { fw5.wall.photos = fw5.wall.photos.filter(function (z) { return z !== ph[1]; }); });
      try { window.localStorage.removeItem(PHOTO + ph[1]); } catch (e) { /* ignore */ }
      c.render(); return true;
    }
    if (t.hasAttribute('data-msdelete')) {
      if (!u.confirmDelete) { u.confirmDelete = true; u.msg = 'Tap Delete again to delete this visit and its photos for good.'; c.render(); return true; }
      vv.rooms.forEach(function (r) { r.walls.forEach(function (w) { w.photos.forEach(function (pid) { try { window.localStorage.removeItem(PHOTO + pid); } catch (e) { /* ignore */ } }); }); });
      cache = all().filter(function (z) { return z.id !== vv.id; }); persist(); u.confirmDelete = false; u.msg = null; c.go('#/measure'); return true;
    }
    if (t.hasAttribute('data-msproject')) { startProject(c, vv); return true; }
    return false;
  }
  function startForJob(c, j) {
    var v = M.blankVisit({ by: c.me().name, today: c.TODAY, jobCode: j.jobCode, lead: { customer: j.customer, address: j.installAddress || '', addr: j.installAddr || window.FMAddress.parse(j.installAddress) } });
    // list the job's drawn rooms and walls (names and positions only; the numbers are measured fresh)
    ((j.elevations && j.elevations.rooms) || []).forEach(function (er) {
      if (v.rooms.some(function (r) { return r.name === er.name; })) return;
      var r = M.blankRoom(er.name); r.ceiling = (er.walls[0] && er.walls[0].specs && +er.walls[0].specs.ceiling) || 96;
      er.walls.forEach(function (w) { var nw = M.blankWall(r); nw.name = w.name; nw.position = w.position || nw.position; r.walls.push(nw); });
      v.rooms.push(r);
    });
    return v;
  }
  /* a lead's visit → New Project draft with the customer, address and the rooms (cabinets come from the supplier PDF) */
  function startProject(c, v) {
    var rooms = v.rooms.map(function (r) { return M.toElevationRoom(r, v, 'm1'); });
    var d = { step: 0, customer: '__new', newCustomer: (v.lead && v.lead.customer) || '', project: (v.lead && v.lead.customer ? v.lead.customer + ' kitchen' : ''), signer: '', email: '', kind: 'single', address: (v.lead && v.lead.address) || '',
      models: [{ id: 'm1', name: '', qty: 1, lines: [], pdf: '' }], pricing: { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9, assembly: '640.00', plan: [50, 50], atCost: true }, copiedFrom: '',
      bid: false, bidAmount: '', install: '', errors: [], elevations: { rooms: rooms, sizes: {} }, fromVisit: v.id,
      note: 'From the site visit on ' + c.longDate(v.measuredOn) + ' (' + who(v) + '): ' + rooms.length + ' room' + (rooms.length === 1 ? '' : 's') + ' of field measurements come along. Add the cabinets from the supplier PDF in step 3.' };
    if (v.lead && v.lead.addr) d.addr = JSON.parse(JSON.stringify(v.lead.addr));
    if (window.P2NewProject) d = window.P2NewProject.migrate(d);   // today's pricing defaults (assembly hours × rate) and address fields
    c.ui.draft = d; try { window.localStorage.setItem('fm_phase2_draft', JSON.stringify(d)); } catch (e) { /* in memory */ }
    c.go('#/new');
  }

  function setPath(obj, path, val) { var p = path.split('.'), o = obj; for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = val; }
  function lengthOr(raw) { if (String(raw).trim() === '') return ''; var n = M.parseLength(raw); return isNaN(n) ? null : M.q16(n); }
  function change(c, e) {
    var x = cur(c); if (!x) return false;
    var el = e.target, d = el.dataset, u = c.ui.ms = c.ui.ms || {};
    if (d.msnew) { u[d.msnew] = el.value; u.err = null; if (d.msnew === 'job') c.render(); return true; }
    if (d.msaddr) { u.addr = u.addr || window.FMAddress.blank(); u.addr[d.msaddr] = el.value; return true; }
    var v = x.v; if (!v) return false;
    var room = v.rooms.filter(function (r) { return r.id === u.room; })[0] || v.rooms[0];
    function bad() { u.msg = '"' + el.value + '" isn\'t a length. Try 126 1/2 or 10\' 6 1/2.'; c.render(); return true; }
    if (d.msv) { edit(v, function (q) { setPath(q, d.msv, el.value); }); if (d.msv !== 'notes') c.render(); return true; }
    if (el.hasAttribute('data-msconfirm')) { edit(v, function (q) { q.confirmedBy = el.checked ? { name: '', on: c.TODAY } : null; }); c.render(); return true; }
    if (d.msr && room) {
      if (d.msr === 'name' || d.msr === 'notes') { edit(v, function () { room[d.msr] = el.value; }); if (d.msr === 'name') c.render(); return true; }
      var n = lengthOr(el.value); if (n === null) return bad();
      edit(v, function () { room[d.msr] = n; }); u.msg = null; c.render(); return true;
    }
    if (d.msw) {
      var p = d.msw.split(':'), fw = findWall(v, p[0]); if (!fw) return true;
      if (p[1] === 'length') { var L = lengthOr(el.value); if (L === null) return bad(); edit(v, function () { fw.wall.length = L; }); u.wall = fw.wall.id; u.msg = null; c.render(); return true; }
      edit(v, function () { fw.wall[p[1]] = el.value; }); if (p[1] !== 'notes') c.render(); return true;
    }
    if (d.mso || d.msm) {
      var q = (d.mso || d.msm).split(':'), fw2 = findWall(v, q[0]); if (!fw2) return true;
      var n2 = lengthOr(el.value); if (n2 === null) return bad();
      edit(v, function () { fw2.wall[d.mso ? 'openings' : 'marks'][+q[1]][q[2]] = n2; }); u.msg = null; c.render(); return true;
    }
    if (d.msphoto) { addPhoto(c, v, d.msphoto, el.files && el.files[0]); return true; }
    return false;
  }
  /* shrink to 1024 px on the long side, JPEG, so a wall's photos stay small on the phone */
  function addPhoto(c, v, wallId, file) {
    if (!file) return;
    var u = c.ui.ms, fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1024 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        var data = cv.toDataURL('image/jpeg', 0.72), id = M.newId('photo');
        try { window.localStorage.setItem(PHOTO + id, data); }
        catch (e) { u.msg = 'This phone is out of room for photos in the preview. In the live tool photos go to the server.'; c.render(); return; }
        var fw = findWall(v, wallId); if (fw) edit(v, function () { fw.wall.photos.push(id); });
        u.msg = 'Photo added to ' + (fw ? fw.wall.name : 'the wall') + '.'; c.render();
      };
      img.onerror = function () { u.msg = 'That file isn\'t a photo the browser can read.'; c.render(); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- on the job's Elevations tab: compare and use ---------- */
  function jobPanel(c, j, ctx) {
    var vs = forJob(j.jobCode).filter(function (v) { return v.rooms.length; }), esc = c.esc;
    var startBtn = '<button class="fmp1-btn" data-msjobstart="' + esc(j.jobCode) + '">Measure on site</button>';
    if (!vs.length) return '<div class="p2-row p2-small p2-ms-jobbar"><span class="fmp1-faint">No field measurements yet.</span>' + startBtn + '</div>';
    var v = vs[vs.length - 1], probs = M.checkVisit(v).filter(function (p) { return p.level === 'error'; });
    var rows = [];
    v.rooms.forEach(function (r) {
      var pr = (ctx.rooms || []).filter(function (x) { return x.name.toLowerCase() === r.name.toLowerCase(); })[0];
      if (!pr) { rows.push('<tr><td>' + esc(r.name) + '</td><td colspan="3">New room (' + r.walls.length + ' walls)</td></tr>'); return; }
      M.compare(pr, r).forEach(function (q) {
        rows.push('<tr' + (q.flag ? ' class="p2-ms-diff"' : '') + '><td>' + esc(r.name + ' · ' + q.wall) + '</td><td class="r">' + (q.plan == null ? '—' : EL.inches(q.plan)) + '</td><td class="r">' + (q.field ? EL.inches(q.field) : '—') + '</td><td class="r">' + (!q.field ? 'not measured' : q.diff == null ? 'new wall' : q.diff === 0 ? '✓' : (q.diff > 0 ? '+' : '−') + EL.inches(Math.abs(q.diff))) + '</td></tr>');
      });
    });
    var used = (v.broughtInto || []).filter(function (b) { return b.jobCode === j.jobCode; })[0];
    return '<details class="p2-ms-jobpanel"' + (used ? '' : ' open') + '><summary class="p2-small"><b>Field measurements</b> · ' + esc(c.longDate(v.measuredOn)) + ' · ' + esc(who(v)) + (v.confirmedBy && v.confirmedBy.name ? ' · confirmed by ' + esc(v.confirmedBy.name) : '') +
      (used ? ' · used ' + esc(c.longDate(used.on)) : '') + '</summary>' +
      '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>Wall</th><th class="r">Drawing</th><th class="r">Field</th><th class="r">Difference</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      (probs.length ? '<p class="p2-small" style="color:var(--fmp1-alert-ink)">Finish the visit first: ' + probs.map(function (p) { return esc(p.text); }).join(' · ') + '</p>' : '') +
      '<div class="p2-row"><a class="fmp1-btn fmp1-btn--quiet" href="#/measure/' + encodeURIComponent(v.id) + '">Open the visit</a>' +
      (ctx.editable ? '<button class="fmp1-btn fmp1-btn--primary" data-msuse="' + esc(v.id) + '"' + (probs.length ? ' disabled' : '') + '>Use field measurements</button>' :
        '<span class="p2-small fmp1-faint">' + (j.stage === 'quote' ? 'Locked while the contract is out.' : 'The drawings are signed. If the field numbers change the cabinets, start a change order.') + '</span>') + startBtn + '</div></details>';
  }
  function useVisit(c, j, v, set, save) {
    var changes = [], added = [];
    save(c, j, 'used field measurements from ' + c.longDate(v.measuredOn) + ' (' + who(v) + ').', function (E) {
      v.rooms.forEach(function (r) {
        var i = -1; E.rooms.forEach(function (x, k) { if (x.set === set && x.name.toLowerCase() === r.name.toLowerCase()) i = k; });
        if (i < 0) { E.rooms.push(M.toElevationRoom(r, v, set)); added.push(r.name); return; }
        var res = M.applyToRoom(E.rooms[i], r, v); E.rooms[i] = res.room;
        res.changes.forEach(function (q) { changes.push(r.name + ' · ' + q.wall + ': ' + q.text); });
      });
    });
    edit(v, function (q) { q.broughtInto = (q.broughtInto || []).filter(function (b) { return b.jobCode !== j.jobCode; }).concat([{ jobCode: j.jobCode, on: c.TODAY, by: c.me().name }]); });
    return 'Used the field measurements. ' + (changes.length ? 'Changed: ' + changes.join('; ') + '. ' : 'Every wall length matched the drawing. ') + (added.length ? 'New rooms: ' + added.join(', ') + '. ' : '') + 'Check the layout checks; Undo puts it back.';
  }
  function jobClick(c, t, j) {
    if (t.dataset.msjobstart) {
      var v = startForJob(c, j); if (!v.rooms.length) { var r0 = M.blankRoom('Kitchen'); r0.walls.push(M.blankWall(r0)); v.rooms.push(r0); }
      all().push(v); persist(); c.go('#/measure/' + encodeURIComponent(v.id)); return true;
    }
    return false;
  }

  window.P2Measure = { list: list, page: page, click: click, change: change, jobPanel: jobPanel, jobClick: jobClick, useVisit: useVisit, visit: visit, forJob: forJob, photoSrc: photoSrc,
    measuredNote: function (room) {
      var m = room && room.measured; if (!m) return '';
      var mo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(m.on || ''), on = mo ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo[2] - 1] + ' ' + (+mo[3]) + ', ' + mo[1] : (m.on || '');
      return 'Field measured ' + on + ' by ' + (m.by || '—') + (m.role && m.role !== 'staff' ? ' (' + ROLE[m.role] + ')' : '') + (m.confirmedBy ? ' · confirmed by the buyer, ' + m.confirmedBy : '');
    } };
  var appRoot = document.getElementById('p2');
  if (appRoot && window.P2) window.P2.render();
})();
