/*
 * Phase 2 preview · Elevations tab (HANDOFF §23). Uses FMElev (src/fm-phase2-elevations.js) for every size, layout and drawing.
 *
 * Cabinets come from the job's quote lines (the supplier PDF imported in New Project or a change order); nothing is typed in twice.
 * Editable while the job is a quote; locked once the contract goes out; the drawings at signing go into the contract packet.
 * Saved on the job as job.elevations = { rooms: [{ id, name, set, walls: [wall] }], sizes: { CODE: {kind,w,h,d} }, versions: [] }.
 */
(function () {
  'use strict';
  var EL = window.FMElev, K = window.FMContract, D = window.FMDocs;
  var POS = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall', island: 'Island or peninsula' };
  var KINDS = { base: 'Base cabinet', wall: 'Wall (upper) cabinet', tall: 'Tall cabinet', vanity: 'Vanity', filler: 'Filler', panel: 'End panel', trim: 'Trim (not drawn)' };
  var HEIGHTS = [['ceiling', 'Ceiling'], ['soffit', 'Soffit'], ['toeKick', 'Toe kick'], ['baseHeight', 'Base height'], ['counter', 'Countertop'], ['gapToUppers', 'Counter to uppers']];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function blankE() { return { rooms: [], sizes: {}, versions: [] }; }

  /* change orders made here that changed cabinets and are in force (signed by the buyer, or an approved courtesy) */
  function coChanges(j) {
    return (j.changeOrders || []).filter(function (co) {
      return /-co\d+$/.test(co.id || '') && (co.status === 'signed' || co.status === 'approved') && ((co.added || []).length + (co.removed || []).length) > 0;
    });
  }
  /* the cabinets after change orders; skip says which ones the job's own lines already include */
  function linesAfter(j, lines, skip) {
    return coChanges(j).reduce(function (l, co) { return co.inLines || (skip && skip(co)) ? l : EL.applyLineChanges(l, co); }, lines);
  }
  function setsFor(c, j) {
    if (c.W && j.jobCode === c.W.jobCode) return Object.keys(c.W.models).map(function (k) {
      var nh = c.W.houses.filter(function (h) { return h.model === k; }).length;
      var other = function (co) { return co.house && !c.W.houses.some(function (h) { return h.jobCode === co.house && h.model === k; }); };
      return { key: k, name: k + ' · ' + nh + ' houses', lines: linesAfter(j, c.W.models[k].lines, other), color: c.W.models[k].suffix };
    });
    if (c.B && j.jobCode === c.B.jobCode) return [{ key: 'main', name: j.projectName || 'Project', lines: linesAfter(j, c.B.model.lines), color: c.B.model.suffix }];
    if (j.models && j.models.length) return j.models.map(function (m, i) {
      // a signed change order already rewrote the first model's lines; an approved courtesy did not
      var lines = i === 0 ? linesAfter(j, m.lines) : m.lines;
      return { key: m.name || 'Model ' + (i + 1), name: (m.name || 'Project') + (m.qty > 1 ? ' · ' + m.qty + ' houses' : ''), lines: lines, color: m.lines[0] ? EL.splitSku(m.lines[0].sku).color : '' };
    });
    return [];
  }
  function frozen(j) { return K.isQuoteFrozen(j.esign && j.esign.state); }
  function revising(j) { return j.stage !== 'quote' && j.stage !== 'lost' && !!(j.elevations && j.elevations.revision); }
  function editable(j) { return (j.stage === 'quote' && !frozen(j)) || revising(j); }
  /* change orders in force whose cabinet changes the drawings don't show yet */
  function pendingCOs(j) {
    var E = j.elevations || {}, done = (E.revisions || []).map(function (r) { return r.coId; }), open = E.revision ? E.revision.coId : null;
    if (!(E.rooms && E.rooms.length)) return [];
    return coChanges(j).filter(function (co) { return done.indexOf(co.id) < 0 && co.id !== open; });
  }
  function statusText(c, j) {
    if (j.stage === 'quote') return frozen(j) ? 'Locked while the contract is out for signature' : 'Draft · part of the quote';
    if (j.stage === 'lost') return 'Quote was lost · read only';
    var E = j.elevations || {};
    if (!(E.rooms && E.rooms.length)) return 'No elevations on file';
    if (E.revision) return 'Revision ' + E.revision.n + ' in progress · change order ' + E.revision.coNumber;
    var pend = pendingCOs(j), last = (E.revisions || [])[(E.revisions || []).length - 1];
    if (pend.length) return 'Needs a revision · change order ' + pend[0].number + ' changed the cabinets';
    if (last) return 'Revision ' + last.n + ' · change order ' + last.coNumber + ' · current';
    return 'Agreed with the contract' + (j.contractedOn ? ' · ' + c.longDate(j.contractedOn) : '');
  }
  function changeText(co) {
    return (co.removed || []).map(function (r) { return '−' + EL.splitSku(r.sku).code + ' ×' + r.qty; }).concat((co.added || []).map(function (a) { return '+' + EL.splitSku(a.sku).code + ' ×' + a.qty; })).join(', ');
  }
  function revisionHTML(c, j) {
    var esc = c.esc, R = (j.elevations || {}).revision;
    if (R && revising(j)) return '<div class="fmp1-note fmp1-note--info p2-small p2-el-rev" role="status"><div><b>Revision ' + R.n + ' for change order ' + R.coNumber + '</b> (' + esc(R.change) + '). ' +
      (R.pulled && R.pulled.length ? 'Took ' + R.pulled.map(function (p) { return esc(p.code) + ' off ' + esc(p.wall); }).join(', ') + '; the cabinets around it stayed put. ' : '') +
      'Place any added cabinets from the quote list, check the layout, then save. The revision becomes the current drawing set.</div>' +
      '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-elrevsave>Save revision ' + R.n + '</button><button class="fmp1-btn fmp1-btn--quiet" data-elrevcancel>Cancel revision</button></div></div>';
    var pend = pendingCOs(j);
    if (!pend.length || j.stage === 'quote' || j.stage === 'lost') return '';
    var co = pend[0];
    return '<div class="fmp1-note fmp1-note--alert p2-small p2-el-rev" role="status"><div><b>Change order ' + co.number + ' changed the cabinets</b> (' + esc(changeText(co)) + '). The drawings still show them as before.' +
      (pend.length > 1 ? ' ' + (pend.length - 1) + ' more change order' + (pend.length > 2 ? 's' : '') + ' after this one.' : '') + '</div>' +
      '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-elrevstart="' + esc(co.id) + '">Start revision</button></div></div>';
  }

  /* where the person is in the tab: set, room, wall, item */
  function state(c, j, sets, E) {
    var u = c.ui.el;
    if (!u || u.job !== j.jobCode) u = c.ui.el = { job: j.jobCode, set: sets[0].key, room: null, wall: null, view: 'front', yaw: null, pitch: 26, sel: null, size: null, msg: null, versions: false };
    if (!sets.some(function (s) { return s.key === u.set; })) u.set = sets[0].key;
    var rooms = E.rooms.filter(function (r) { return r.set === u.set; });
    var room = rooms.filter(function (r) { return r.id === u.room; })[0] || rooms[0] || null;
    u.room = room ? room.id : null;
    var wall = room ? (room.walls.filter(function (w) { return w.id === u.wall; })[0] || room.walls[0] || null) : null;
    u.wall = wall ? wall.id : null;
    return { u: u, set: sets.filter(function (s) { return s.key === u.set; })[0], rooms: rooms, room: room, wall: wall };
  }
  function roomsOfSet(E, key) { return E.rooms.filter(function (r) { return r.set === key; }); }
  /* sizes in use: the supplier PDF's (when it lists them), then what staff entered, which wins */
  function readE(E, set) {
    var sizes = EL.sizesFromLines(set ? set.lines : []); Object.keys(E.sizes || {}).forEach(function (k) { sizes[k] = E.sizes[k]; });
    return { rooms: E.rooms || [], versions: E.versions || [], sizes: sizes };
  }
  function crownQuoted(set) { return (set.lines || []).some(function (l) { return /^(ACM|LACM|CM|SCM|RCM|BCM|COV)\d*S?(\(.*\))?$/.test(EL.splitSku(l.sku).code); }); }
  function roomLayouts(room, set, E) { return room ? EL.layoutRoom(room, E.sizes, { crownDefault: crownQuoted(set) }) : []; }
  function wallEntry(R, wall) { return wall ? R.filter(function (x) { return x.wall.id === wall.id; })[0] || null : null; }

  /* Undo / redo: a snapshot of the rooms and sizes before each change, per job, for this session (last 50). */
  var hist = {};
  function H(code) { return hist[code] = hist[code] || { past: [], future: [] }; }
  function snap(j) { var E = (j && j.elevations) || blankE(); return { rooms: clone(E.rooms || []), sizes: clone(E.sizes || {}) }; }
  function stepHistory(c, j, back) {
    var h = H(j.jobCode), from = back ? h.past : h.future, to = back ? h.future : h.past;
    if (!from.length) return null;
    var s0 = from.pop(), now = snap(c.store.job(j.jobCode)); now.text = s0.text; to.push(now);
    c.store.update(j.jobCode, function (x) {
      x.elevations = x.elevations || blankE(); x.elevations.rooms = s0.rooms; x.elevations.sizes = s0.sizes;
      x.elevations.updatedAt = new Date().toISOString(); x.elevations.updatedBy = c.me().name; return x;
    }, 'Elevations: ' + (back ? 'undid' : 'redid') + ' "' + s0.text + '"', c.me().name);
    return s0.text;
  }

  /* every change is saved on the job and logged with who made it; noUndo for steps that aren't drawing edits */
  function save(c, j, text, fn, noUndo) {
    if (!noUndo) {
      var h = H(j.jobCode), s0 = snap(c.store.job(j.jobCode)); s0.text = text;
      h.past.push(s0); if (h.past.length > 50) h.past.shift(); h.future = [];
    }
    c.store.update(j.jobCode, function (x) {
      x.elevations = x.elevations || blankE();
      fn(x.elevations, x);
      x.elevations.updatedAt = new Date().toISOString(); x.elevations.updatedBy = c.me().name;
      return x;
    }, 'Elevations: ' + text, c.me().name);
  }
  function findWall(E, u) {
    var r = E.rooms.filter(function (x) { return x.id === u.room; })[0];
    return r ? r.walls.filter(function (w) { return w.id === u.wall; })[0] : null;
  }
  function findItem(wall, id) {
    var a = (wall.base || []).filter(function (x) { return x.id === id; })[0]; if (a) return { run: 'base', it: a };
    var b = (wall.upper || []).filter(function (x) { return x.id === id; })[0]; return b ? { run: 'upper', it: b } : null;
  }
  function itemName(it, sizes) { return it.appliance ? (it.label || EL.APPLIANCES[it.appliance].label) : EL.parseSku(it.sku, sizes).code; }

  /* ---------- render ---------- */
  function tab(c, j) {
    var esc = c.esc, E = j.elevations || blankE(), sets = setsFor(c, j);
    if (!sets.length) return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Elevations</span><p class="p2-empty">No cabinets on this job yet. Cabinets come in from the supplier PDF in New Project; then they can be drawn here.</p></div>';
    var S = state(c, j, sets, E), u = S.u, ed = editable(j);
    E = readE(E, S.set);
    var rec = EL.reconcile(S.set.lines, S.rooms, E.sizes);
    S.trim = EL.trimCheck(S.set.lines, [].concat.apply([], S.rooms.map(function (r) { return roomLayouts(r, S.set, E); })));
    var tone = j.stage === 'quote' && !frozen(j) ? 'fmp1-pill--proposed' : j.stage === 'lost' ? 'fmp1-pill--alert' : E.rooms.length ? 'fmp1-pill--good' : '';

    var head = '<div class="fmp1-card p2-pad"><div class="p2-between"><div class="p2-row"><span class="fmp1-eyebrow">Elevations</span><span class="fmp1-pill ' + tone + '">' + esc(statusText(c, j)) + '</span></div>' +
      '<span class="p2-row">' + (ed ? undoButtons(c, j) : '') + (ed && !revising(j) ? '<button class="fmp1-btn" data-elsavever>Save version</button>' : '') +
      '<button class="fmp1-btn fmp1-btn--quiet" data-elver aria-expanded="' + !!u.versions + '">Versions (' + (E.versions || []).length + ')</button>' +
      '<button class="fmp1-btn fmp1-btn--primary" data-elprint' + (S.rooms.length ? '' : ' disabled') + '>Print / save PDF</button></span></div>' +
      '<p class="p2-small fmp1-muted">Cabinets come from this job\'s quote (the supplier PDF), and each size is read from its SKU code. ' +
        (revising(j) ? 'Revising the signed drawings for a change order.' : ed ? 'Lay them out wall by wall; the drawings go into the contract packet when the contract is sent.' : j.stage === 'quote' ? 'Pricing and drawings are frozen until the contract is signed, declined or canceled.' : 'Changes after signing go through a change order, and the drawings get a numbered revision.') + '</p>' + revisionHTML(c, j) +
      (sets.length > 1 ? '<label class="p2-fld" style="max-width:320px"><span>Model</span><select class="fmp1-input" data-elset>' + sets.map(function (s) {
        var nr = roomsOfSet(E, s.key).length;
        return '<option value="' + esc(s.key) + '"' + (s.key === u.set ? ' selected' : '') + '>' + esc(s.name) + (nr ? ' · ' + nr + ' room' + (nr > 1 ? 's' : '') : '') + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="p2-row" role="tablist" aria-label="Rooms">' + S.rooms.map(function (r) {
        return '<button class="fmp1-btn' + (r.id === u.room ? ' fmp1-btn--primary' : '') + '" role="tab" aria-selected="' + (r.id === u.room) + '" data-elroom="' + esc(r.id) + '">' + esc(r.name) + '</button>'; }).join('') +
        (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-eladdroom>+ Room</button>' : '') + '</div>' + (ed && !revising(j) ? copyHTML(c, j, S) : '') +
      (window.P2Measure && j.stage !== 'lost' ? window.P2Measure.jobPanel(c, j, { rooms: S.rooms, editable: ed }) : '') +
      (u.versions ? versionsHTML(c, j, E, ed) : '') + (u.msg ? '<div class="fmp1-note fmp1-note--info p2-small p2-between" role="status" style="align-items:center"><span>' + esc(u.msg) + '</span>' + (u.msgPdf ? '<button class="fmp1-btn fmp1-btn--primary" data-elprintver="' + u.msgPdf + '">Open PDF</button>' : '') + '</div>' : '') + '</div>';

    if (!S.room) {
      return head + '<div class="fmp1-card p2-pad"><p class="p2-empty">' + (ed ? 'No rooms yet. Add a room (Kitchen, Hall bath…), give each wall its length, then add the cabinets from the quote.' :
        'No elevations were drawn for this job before it was signed.') + '</p>' + (ed ? '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-eladdroom>+ Add a room</button></div>' : '') + '</div>' + quotePanel(c, j, S, rec, ed, E);
    }
    var R = roomLayouts(S.room, S.set, E), wall = S.wall, we = wallEntry(R, wall), lay = we ? we.layout : null;
    var walls = '<div class="p2-row" role="tablist" aria-label="Walls in ' + esc(S.room.name) + '">' + S.room.walls.map(function (w) {
      return '<button class="fmp1-btn' + (w.id === u.wall && u.view === 'front' ? ' fmp1-btn--primary' : '') + '" data-elwall="' + esc(w.id) + '">' + esc(w.name) + ' <span class="p2-small fmp1-faint">' + EL.feetInches(+w.lengthIn || 0) + '</span></button>'; }).join('') +
      (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-eladdwall>+ Wall</button>' : '') +
      '<span class="p2-el-views p2-row"><button class="fmp1-btn' + (u.view === 'plan' ? ' fmp1-btn--primary' : '') + '" data-elview="plan">Floor plan</button><button class="fmp1-btn' + (u.view === '3d' ? ' fmp1-btn--primary' : '') + '" data-elview="3d">3D room</button></span></div>';

    var drawing;
    if (u.view === 'plan') {
      drawing = '<div class="p2-el-canvas">' + (R.length ? EL.svgPlan(R, { color: S.set.color, title: 'Floor plan of ' + S.room.name }) : '<p class="p2-empty">Add a wall to see the plan.</p>') + '</div>' +
        '<p class="p2-small fmp1-faint">Seen from above. Walls go where you set them (back, left, right, front); an island or peninsula goes where you place it from the back and left walls.</p>' +
        R.map(function (x) { return x.layout.issues.length ? '<p class="p2-small"><b>' + c.esc(x.wall.name) + ':</b> ' + x.layout.issues.map(function (i) { return c.esc(i.text); }).join(' · ') + '</p>' : ''; }).join('') +
        checksHTML(c, [].concat.apply([], R.map(function (x) { return x.layout.checks.map(function (k) { return { level: k.level, text: x.wall.name + ': ' + k.text }; }); })), 'for the whole room');
    } else if (u.view === '3d') {
      drawing = '<div class="p2-el-canvas p2-el-3d" data-el3d title="Drag to turn">' + room3D(c, R, S.room, S.set) + '</div>' +
        '<div class="p2-row p2-small"><button class="fmp1-btn fmp1-btn--quiet" data-elturn="-20" aria-label="Turn left">⟲ Turn</button><button class="fmp1-btn fmp1-btn--quiet" data-elturn="20" aria-label="Turn right">Turn ⟳</button>' +
        '<label class="p2-row">Tilt <input type="range" min="8" max="60" value="' + u.pitch + '" data-elpitch aria-label="Tilt"></label><span class="fmp1-faint">Drag the view to turn it. For measurements, use the wall drawings.</span></div>';
    } else if (wall) {
      drawing = '<div class="p2-el-canvas' + (ed ? ' is-edit' : '') + '" data-elcanvas>' + EL.svgElevation(lay, { title: S.room.name + ' · ' + wall.name, color: S.set.color, uid: 'w', interactive: true, selected: u.sel }) + '<div class="p2-el-dragtip" hidden></div></div>' +
        selBar(c, S, wall, lay, ed, E) +
        (ed && !u.sel ? '<p class="p2-small fmp1-faint">Click a cabinet to select it. Drag it along the wall to move it: drop it in open space to put it there, or onto other cabinets to change the order.</p>' : '') + issuesHTML(c, lay, wall, E);
    } else drawing = '<p class="p2-empty">This room has no walls yet.' + (ed ? ' Add one to start.' : '') + '</p>';

    var center = '<div class="fmp1-card p2-pad p2-el-main">' + walls + drawing + '</div>';
    var left = wall && u.view === 'front' ? wallPanel(c, j, S, wall, lay, ed, E) : roomPanel(c, j, S, ed);
    return head + '<div class="p2-el-grid">' + '<div class="p2-el-side">' + left + '</div>' + center + '<div class="p2-el-side">' + quotePanel(c, j, S, rec, ed, E) + '</div></div>';
  }

  function undoButtons(c, j) {
    var h = H(j.jobCode), last = h.past[h.past.length - 1], next = h.future[h.future.length - 1];
    return '<span class="p2-row p2-el-undo"><button class="fmp1-btn fmp1-btn--quiet" data-elundo' + (last ? ' title="Undo: ' + c.esc(last.text) + ' (Ctrl or ⌘ Z)"' : ' disabled') + ' aria-label="Undo">↶ Undo</button>' +
      '<button class="fmp1-btn fmp1-btn--quiet" data-elredo' + (next ? ' title="Redo: ' + c.esc(next.text) + ' (Shift Ctrl or ⌘ Z)"' : ' disabled') + ' aria-label="Redo">Redo ↷</button></span>';
  }
  /* rooms that can be copied here: other models on this job, and every other job with drawings */
  function copySources(c, j, S) {
    var out = [];
    c.store.jobs().forEach(function (oj) {
      var E = oj.elevations; if (!E || !E.rooms || !E.rooms.length) return;
      setsFor(c, oj).forEach(function (st) {
        if (oj.jobCode === j.jobCode && st.key === S.u.set) return;
        var rs = roomsOfSet(E, st.key); if (!rs.length) return;
        out.push({ value: oj.jobCode + '::' + st.key, label: (oj.jobCode === j.jobCode ? 'This job' : oj.customer + ' · ' + (oj.projectName || oj.jobCode)) +
          (setsFor(c, oj).length > 1 || oj.jobCode === j.jobCode ? ' · ' + st.key : '') + ' (' + rs.map(function (r) { return r.name; }).join(', ') + ')' });
      });
    });
    return out;
  }
  function copyHTML(c, j, S) {
    var src = copySources(c, j, S); if (!src.length) return '';
    var u = S.u, sel = u.copySrc && src.some(function (x) { return x.value === u.copySrc; }) ? u.copySrc : src[0].value;
    return '<details class="p2-el-copy"' + (S.rooms.length ? '' : ' open') + '><summary class="p2-small">Copy rooms from another model or job</summary><div class="p2-row">' +
      '<select class="fmp1-input" data-elcopysrc aria-label="Copy rooms from">' + src.map(function (x) { return '<option value="' + c.esc(x.value) + '"' + (x.value === sel ? ' selected' : '') + '>' + c.esc(x.label) + '</option>'; }).join('') + '</select>' +
      '<button class="fmp1-btn" data-elcopy="' + c.esc(sel) + '">Copy here</button></div>' +
      '<p class="p2-small fmp1-faint">Walls, windows and layout come along. Each cabinet is matched to this quote by its code (so a different color carries over); any this quote doesn\'t have are flagged.</p></details>';
  }
  function room3D(c, R, room, set) {
    var u = c.ui.el;
    if (!R.length) return '<p class="p2-empty">Add a wall to see the room.</p>';
    return EL.svg3D(R, { yaw: u.yaw, pitch: u.pitch, color: set.color, title: '3D view of ' + room.name });
  }

  /* The selected cabinet, right under the drawing: what it is, where it sits, and the actions (Delete key removes it). */
  function selBar(c, S, wall, lay, ed, E) {
    var u = c.ui.el, f = u.sel ? findItem(wall, u.sel) : null; if (!f) return '';
    var esc = c.esc, it = f.it, list = wall[f.run] || [], i = list.indexOf(it), p = lay[f.run][i], sp = it.appliance ? null : EL.parseSku(it.sku, E.sizes), id = esc(it.id);
    return '<div class="p2-el-selbar" role="region" aria-label="Selected item"><div class="p2-el-selinfo"><span class="fmp1-eyebrow">Selected</span>' +
      '<b>' + esc(itemName(it, E.sizes)) + '</b><span class="p2-small fmp1-muted">' + (sp ? esc(EL.describe(sp)) : esc((EL.APPLIANCES[it.appliance] || {}).label || '')) +
      (p ? ' · ' + (f.run === 'upper' ? 'upper run' : 'base run') + ', ' + EL.inches(p.x) + ' from left' : '') + '</span></div>' +
      '<div class="p2-row">' + (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-elmove="' + id + ':-1"' + (i === 0 ? ' disabled' : '') + '>← Left</button>' +
        '<button class="fmp1-btn fmp1-btn--quiet" data-elmove="' + id + ':1"' + (i === list.length - 1 ? ' disabled' : '') + '>Right →</button>' +
        (sp ? '<button class="fmp1-btn fmp1-btn--quiet" data-elsize="' + esc(sp.code) + '">Size…</button>' : '') +
        '<button class="fmp1-btn p2-el-rmbtn" data-elrm="' + id + '" title="Or press Delete">Remove</button>' : '') +
        '<button class="fmp1-btn fmp1-btn--quiet" data-elsel="' + id + '" aria-label="Deselect" title="Deselect (Esc)">✕</button></div></div>';
  }
  /* cabinets placed beyond the quote, per SKU: [{ sku, code, extra }] */
  function extrasOf(rec) { return rec.rows.filter(function (r) { return r.placed > r.quoted; }).map(function (r) { return { sku: r.sku, code: EL.splitSku(r.sku).code, extra: r.placed - r.quoted, quoted: r.quoted }; }); }
  function extrasBanner(c, j, S, rec, ed) {
    var ex = extrasOf(rec); if (!ex.length) return '';
    var n = ex.reduce(function (t, x) { return t + x.extra; }, 0), esc = c.esc, signed = j.stage !== 'quote' && j.stage !== 'lost';
    var canAdd = j.stage === 'quote' && ed && ex.every(function (x) { return x.quoted > 0; }) && !(c.W && j.jobCode === c.W.jobCode) && !(c.B && j.jobCode === c.B.jobCode);
    return '<div class="fmp1-note fmp1-note--alert p2-small p2-el-extras" role="status"><span><b>' + n + ' placed beyond the ' + (signed ? 'signed order' : 'quote') + ':</b> ' +
      ex.map(function (x) { return esc(x.code) + ' ×' + x.extra + (x.quoted ? '' : ' (not on it)'); }).join(', ') + '.</span><span class="p2-row">' +
      (signed && j.changeOrders && window.P2Flows && window.P2Flows.startCO ? '<button class="fmp1-btn fmp1-btn--primary" data-elco>Start a change order for them</button>' : '') +
      (canAdd ? '<button class="fmp1-btn fmp1-btn--primary" data-eladdquote>Add them to the quote</button>' : '') +
      (ed ? '<button class="fmp1-btn" data-elrmextra>Remove the extras</button>' : '') + '</span>' +
      (j.stage === 'quote' && !canAdd && ed ? '<span class="fmp1-faint">To keep a cabinet that isn\'t on the quote, add its supplier PDF to the quote first.</span>' : '') + '</div>';
  }
  function issuesHTML(c, lay, wall, E) {
    var esc = c.esc, sum = '<span>Base run ' + EL.inches(lay.used.base) + ' · ' + (lay.open.base >= 0 ? EL.inches(lay.open.base) + ' open' : EL.inches(-lay.open.base) + ' over') +
      '</span><span>Upper run ' + EL.inches(lay.used.upper) + ' · ' + (lay.open.upper >= 0 ? EL.inches(lay.open.upper) + ' open' : EL.inches(-lay.open.upper) + ' over') + '</span>';
    var list = lay.issues.length ? issueList(c, lay.issues) : '<p class="p2-ok p2-small">✓ Everything fits on this wall.</p>';
    return '<div class="p2-row p2-small fmp1-muted p2-el-sum">' + sum + '</div>' + list + checksHTML(c, lay.checks);
  }
  function issueList(c, list) {
    return '<ul class="p2-list p2-small">' + list.map(function (i) {
      return '<li style="justify-content:flex-start"><span class="p2-dot' + (i.level === 'error' ? ' alert' : i.level === 'tip' ? ' tip' : '') + '" aria-hidden="true"></span><span>' + c.esc(i.text) + '</span>' +
        (i.item ? '<button class="p2-linkbtn" data-elsel="' + c.esc(i.item) + '">Show</button>' : '') + '</li>'; }).join('') + '</ul>';
  }
  /* planning advice (landing space, clearances, fillers, walkways): worth a look, never blocks anything */
  function checksHTML(c, checks, title) {
    if (!checks || !checks.length) return '<p class="p2-ok p2-small">✓ Layout checks: landing space, clearances and fillers look right.</p>';
    return '<div class="p2-el-checks"><b class="p2-small">Layout checks · ' + checks.length + '</b>' + (title ? ' <span class="p2-small fmp1-faint">' + c.esc(title) + '</span>' : '') +
      issueList(c, checks) + '<p class="p2-small fmp1-faint">Common kitchen planning guidelines. They don\'t block anything; use your judgment and the customer\'s wishes.</p></div>';
  }

  function num(attr, label, v, extra) {
    return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" inputmode="decimal" ' + attr + ' value="' + (v == null ? '' : v) + '"' + (extra || '') + '></label>';
  }
  function wallPanel(c, j, S, wall, lay, ed, E) {
    var esc = c.esc, u = c.ui.el, dis = ed ? '' : ' disabled', s = lay.specs;
    function runList(run, title) {
      var items = wall[run] || [], placed = lay[run];
      return '<div class="p2-el-run"><div class="p2-between"><b class="p2-small">' + title + ' · ' + items.length + '</b></div>' +
        (items.length ? '<ol class="p2-el-items">' + items.map(function (it, i) {
          var p = placed[i], sp = it.appliance ? null : EL.parseSku(it.sku, E.sizes), sel = u.sel === it.id;
          return '<li class="' + (sel ? 'is-sel' : '') + '"><div class="p2-between"><button class="p2-linkbtn" data-elsel="' + esc(it.id) + '"><b>' + esc(itemName(it, E.sizes)) + '</b></button>' +
            '<span class="p2-small fmp1-faint">' + (p ? 'at ' + EL.inches(p.x) + ' · ' + EL.inches(p.w) : '') + (sp && !sp.sure ? ' · <b style="color:var(--fmp1-alert-ink)">check size</b>' : '') + '</span></div>' +
            (sel ? '<div class="p2-el-edit">' + (sp ? '<span class="p2-small fmp1-muted">' + esc(EL.describe(sp)) + '</span>' : '') +
              '<div class="p2-row">' + num('data-elitemf="' + esc(it.id) + ':x"', 'From left (in)', p ? p.x : '', dis + ' style="width:90px"') + num('data-elitemf="' + esc(it.id) + ':gapBefore"', 'Space before (in)', it.gapBefore || 0, dis + ' style="width:90px"') +
              (it.appliance ? num('data-elitemf="' + esc(it.id) + ':w"', 'Width (in)', p ? p.w : '', dis + ' style="width:80px"') : '') +
              (run === 'upper' ? num('data-elitemf="' + esc(it.id) + ':topOffset"', 'Raise / lower top (in)', it.topOffset || 0, dis + ' style="width:90px" title="Staggered uppers: + raises, − lowers"') : '') + '</div>' +
              (ed ? '<div class="p2-row"><button class="fmp1-btn fmp1-btn--quiet" data-elmove="' + esc(it.id) + ':-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move left">← Left</button>' +
                '<button class="fmp1-btn fmp1-btn--quiet" data-elmove="' + esc(it.id) + ':1"' + (i === items.length - 1 ? ' disabled' : '') + ' aria-label="Move right">Right →</button>' +
                (sp ? '<button class="fmp1-btn fmp1-btn--quiet" data-elsize="' + esc(sp.code) + '">Size…</button>' : '') +
                '<button class="fmp1-btn fmp1-btn--quiet" data-elrm="' + esc(it.id) + '" style="color:var(--fmp1-alert-ink)">Remove</button></div>' : '') + '</div>' : '') + '</li>';
        }).join('') + '</ol>' : '<p class="p2-small fmp1-faint">Nothing yet. Add cabinets from the quote →</p>') +
        (ed ? '<div class="p2-row p2-small">' + (run === 'base' ? [['dishwasher', 'Dishwasher'], ['range', 'Range'], ['fridge', 'Fridge'], ['washer', 'Washer'], ['space', 'Space']] : [['hood', 'Hood'], ['microwave', 'Microwave'], ['upperSpace', 'Space']]).map(function (a) {
          return '<button class="fmp1-btn fmp1-btn--quiet" data-elappl="' + run + ':' + a[0] + '">+ ' + a[1] + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }
    var openings = (wall.openings || []).map(function (o, i) {
      return '<li><div class="p2-row"><b class="p2-small">' + (o.kind === 'door' ? 'Door' : 'Window') + '</b>' + (ed ? '<button class="p2-linkbtn" data-elopenrm="' + i + '" style="margin-left:auto">Remove</button>' : '') + '</div><div class="p2-el-4">' +
        num('data-elopenf="' + i + ':fromLeft"', 'From left', o.fromLeft, dis) + num('data-elopenf="' + i + ':width"', 'Width', o.width, dis) + num('data-elopenf="' + i + ':height"', 'Height', o.height, dis) +
        (o.kind === 'door' ? '' : num('data-elopenf="' + i + ':fromFloor"', 'Off floor', o.fromFloor, dis)) + '</div></li>';
    }).join('');
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">This wall</span>' +
      '<div class="p2-el-2"><label class="p2-fld"><span>Name</span><input class="fmp1-input" data-elwallf="name" value="' + esc(wall.name) + '"' + dis + '></label>' +
      '<label class="p2-fld"><span>Where it is</span><select class="fmp1-input" data-elwallf="position"' + dis + '>' + Object.keys(POS).map(function (k) { return '<option value="' + k + '"' + ((wall.position || 'back') === k ? ' selected' : '') + '>' + POS[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="p2-el-2">' + num('data-elwallf="lengthIn"', (lay.island ? 'Island length' : 'Wall length') + ' (in)', wall.lengthIn, dis) + num('data-elwallf="specs.ceiling"', 'Ceiling (in)', s.ceiling, dis) + '</div>' +
      (lay.island ? '<div class="p2-el-2">' + num('data-elwallf="islandY"', 'From back wall (in)', wall.islandY || 42, dis) + num('data-elwallf="islandX"', 'From left wall (in)', wall.islandX || 36, dis) + '</div>' +
        '<p class="p2-small fmp1-muted">Measured to the island\'s cabinets (the counter overhangs 10″ on the seating side). Set "From left wall" to 0 for a peninsula off the left wall.</p>' : '') +
      (lay.island ? '' : '<label class="p2-fld"><span>Crown molding</span><select class="fmp1-input" data-elwallf="crown"' + dis + '>' +
        [['', 'Automatic' + (crownQuoted(S.set) ? ' (on: crown is quoted)' : ' (off: no crown quoted)')], ['on', 'On'], ['off', 'Off']].map(function (o2) { return '<option value="' + o2[0] + '"' + ((wall.crown || '') === o2[0] ? ' selected' : '') + '>' + o2[1] + '</option>'; }).join('') + '</select></label>') +
      '<details class="p2-el-more"><summary class="p2-small">Heights · toe kick ' + EL.inches(s.toeKick) + ', counter ' + EL.inches(s.baseHeight + s.counter) + ', ' + EL.inches(s.gapToUppers) + ' to uppers</summary><div class="p2-el-2">' +
        HEIGHTS.slice(1).map(function (h) { return num('data-elwallf="specs.' + h[0] + '"', h[1] + ' (in)', s[h[0]], dis); }).join('') + '</div></details>' +
      (lay.island ? '' : '<label class="p2-el-check"><input type="checkbox" data-elwallf="cornerLeft"' + (wall.cornerLeft ? ' checked' : '') + dis + '> Left end is a corner another wall\'s cabinets run into</label>' +
      '<label class="p2-el-check"><input type="checkbox" data-elwallf="cornerRight"' + (wall.cornerRight ? ' checked' : '') + dis + '> Right end is a corner another wall\'s cabinets run into</label>') +
      (lay.reserve.leftLabel || lay.reserve.rightLabel ? '<p class="p2-small fmp1-muted">Corner space set aside for the corner cabinet on ' + c.esc(lay.reserve.leftLabel || lay.reserve.rightLabel) + '.</p>' : '') +
      (wall.measured ? '<div class="p2-el-run"><b class="p2-small">From the field</b>' + (S.room.measured ? '<span class="p2-small fmp1-muted">' + esc(window.P2Measure ? window.P2Measure.measuredNote(S.room) : '') + '</span>' : '') +
        (wall.notes ? '<span class="p2-small">' + esc(wall.notes) + '</span>' : '') +
        ((wall.photos || []).length && window.P2Measure ? '<div class="p2-ms-photos">' + wall.photos.map(function (pid) { var src = window.P2Measure.photoSrc(pid); return src ? '<a class="p2-ms-photo" href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="Field photo of ' + esc(wall.name) + '"></a>' : ''; }).join('') + '</div>' : '') + '</div>' : '') +
      runList('upper', 'Upper run') + runList('base', 'Base run') +
      '<div class="p2-el-run"><b class="p2-small">Windows and doors</b>' + (openings ? '<ul class="p2-list">' + openings + '</ul>' : '') +
        (ed ? '<div class="p2-row p2-small"><button class="fmp1-btn fmp1-btn--quiet" data-elopen="window">+ Window</button><button class="fmp1-btn fmp1-btn--quiet" data-elopen="door">+ Door</button></div>' : '') + '</div>' +
      (ed ? '<button class="p2-linkbtn p2-small" data-elrmwall style="color:var(--fmp1-alert-ink);align-self:flex-start">Remove this wall</button>' : '') + '</div>';
  }
  function roomPanel(c, j, S, ed) {
    var esc = c.esc;
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">This room</span>' +
      '<label class="p2-fld"><span>Room name</span><input class="fmp1-input" data-elroomname value="' + esc(S.room.name) + '"' + (ed ? '' : ' disabled') + '></label>' +
      '<p class="p2-small fmp1-muted">The 3D view puts each wall where you set it (back, left, right or front). Pick a wall above to edit it.</p>' +
      (ed ? '<button class="p2-linkbtn p2-small" data-elrmroom style="color:var(--fmp1-alert-ink);align-self:flex-start">Remove this room</button>' : '') + '</div>';
  }

  function quotePanel(c, j, S, rec, ed, E) {
    var esc = c.esc, u = c.ui.el, canAdd = ed && S.wall && u.view !== '3d';
    var total = rec.rows.reduce(function (t, r) { return t + r.quoted; }, 0), placed = rec.rows.reduce(function (t, r) { return t + Math.min(r.placed, r.quoted); }, 0);
    var rows = rec.rows.map(function (r) {
      var code = EL.splitSku(r.sku).code, sizing = u.size === code;
      var st = r.status === 'ok' ? '<span class="fmp1-pill fmp1-pill--good">' + r.placed + ' / ' + r.quoted + '</span>' : r.status === 'extra' ? '<span class="fmp1-pill fmp1-pill--alert">' + r.placed + ' / ' + r.quoted + ' extra</span>' : '<span class="fmp1-pill">' + r.placed + ' / ' + r.quoted + '</span>';
      return '<li style="flex-direction:column;align-items:stretch;gap:4px"><div class="p2-between"><span><span class="fmp1-code">' + esc(code) + '</span> ' + st + '</span>' +
        (canAdd && r.sized ? '<button class="fmp1-btn" data-eladd="' + esc(r.sku) + '"' + (r.left ? '' : ' title="All quoted ones are placed"') + '>Add</button>' : '') + '</div>' +
        '<span class="p2-small fmp1-muted">' + esc(r.label) + (ed && (!r.sure || !r.sized) ? ' · <button class="p2-linkbtn" data-elsize="' + esc(code) + '" style="color:var(--fmp1-alert-ink)">' + (r.sized ? 'Check size' : 'Enter size') + '</button>' : '') + '</span>' +
        (sizing ? sizeForm(c, code, E) : '') + '</li>';
    }).join('');
    var nd = rec.notDrawn.length ? '<details class="p2-el-more"><summary class="p2-small">Trim and accessories · ' + rec.notDrawn.length + ' lines, listed but not drawn</summary><ul class="p2-list p2-small">' +
      rec.notDrawn.map(function (x) { return '<li><span class="fmp1-code">' + esc(EL.splitSku(x.sku).code) + '</span><span>×' + x.qty + '</span></li>'; }).join('') + '</ul></details>' : '';
    // an extra size form for a SKU that is placed but not on the quote list, opened from the wall panel
    var orphan = u.size && !rec.rows.some(function (r) { return EL.splitSku(r.sku).code === u.size; }) ? sizeForm(c, u.size, E) : '';
    return '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">From the quote</span><b class="p2-small">' + placed + ' of ' + total + ' placed</b></div>' + extrasBanner(c, j, S, rec, ed) +
      (rec.allPlaced ? '<p class="p2-ok p2-small">✓ Every quoted cabinet is on a wall, once.</p>' : rec.missing ? '<p class="p2-small fmp1-muted">' + rec.missing + ' still to place.</p>' : '') +   // extras get their own banner above
      (canAdd && rec.missing ? '<button class="fmp1-btn fmp1-btn--primary" data-elauto>Place the rest on this wall</button>' : '') +
      orphan + '<ul class="p2-list">' + rows + '</ul>' + trimHTML(c, S.trim) + nd + '</div>';
  }
  function trimHTML(c, trim) {
    if (!trim || !trim.length) return '';
    return '<div class="p2-el-run"><b class="p2-small">Trim check</b><ul class="p2-list p2-small">' + trim.map(function (r) {
      return '<li style="flex-direction:column;align-items:stretch;gap:2px"><span class="p2-between"><span>' + c.esc(r.label) + '</span>' +
        (r.quotedFt ? '<span class="fmp1-pill ' + (r.ok ? 'fmp1-pill--good' : 'fmp1-pill--alert') + '">' + r.quotedFt + '′ quoted</span>' : '<span class="fmp1-pill fmp1-pill--alert">none quoted</span>') + '</span>' +
        '<span class="fmp1-faint">About ' + r.neededFt + '′ needed for what\'s drawn (with returns and 10% for cuts)' + (r.skus.length ? ' · ' + c.esc(r.skus.join(', ')) : '') + '</span></li>';
    }).join('') + '</ul></div>';
  }
  function sizeForm(c, code, E) {
    var sp = EL.parseSku(code, E.sizes), esc = c.esc;
    return '<div class="p2-el-edit"><span class="p2-small"><b>' + esc(code) + '</b> · ' + esc(sp.note || 'Size read from the code.') + ' Entered once, used everywhere on this job.</span>' +
      '<label class="p2-fld"><span>What it is</span><select class="fmp1-input" data-elsizef="kind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (sp.kind === k ? ' selected' : '') + '>' + KINDS[k] + '</option>'; }).join('') + '</select></label>' +
      '<div class="p2-el-4">' + num('data-elsizef="w"', 'Width', sp.w) + num('data-elsizef="h"', 'Height', sp.h) + num('data-elsizef="d"', 'Depth', sp.d) + '</div>' +
      '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-elsizesave="' + esc(code) + '">Save size</button><button class="fmp1-btn fmp1-btn--quiet" data-elsizecancel>Cancel</button></div></div>';
  }
  function versionsHTML(c, j, E, ed) {
    var esc = c.esc, v = (E.versions || []).slice().reverse();
    if (!v.length) return '<p class="p2-small fmp1-faint">No saved versions yet. Save one before you send the drawings to the customer; you can go back to it any time while quoting.</p>';
    return '<ul class="p2-list p2-small">' + v.map(function (x) {
      return '<li><span><b>' + esc(x.label || 'Version ' + x.n) + '</b> · ' + esc(String(x.at).slice(0, 16).replace('T', ' ')) + ' · ' + esc(x.by) + ' · ' + x.rooms.length + ' room' + (x.rooms.length === 1 ? '' : 's') + '</span>' +
        '<span class="p2-row"><button class="fmp1-btn" data-elprintver="' + x.n + '">Open PDF</button>' + (ed && !revising(j) ? '<button class="fmp1-btn fmp1-btn--quiet" data-elrestore="' + x.n + '">Go back to this</button>' : '') + '</span></li>'; }).join('') + '</ul>';
  }

  /* ---------- printable pages (viewer and contract packet) ---------- */
  function docPages(c, j, version) {
    var E0 = version ? { rooms: version.rooms, sizes: version.sizes || {} } : (j.elevations || blankE()), pages = [], views = [];
    setsFor(c, j).forEach(function (set) {
      var E = readE(E0, set);
      roomsOfSet(E, set.key).forEach(function (room) {
        var any = false, R = roomLayouts(room, set, E);
        R.forEach(function (we) {
          var w = we.wall, lay = we.layout;
          if (!lay.base.length && !lay.upper.length) return;
          any = true;
          var rows = lay.upper.concat(lay.base).filter(function (p) { return p.w && p.appliance !== 'space' && p.appliance !== 'upperSpace'; }).map(function (p) {
            return { code: p.code, label: p.kind === 'appliance' ? p.label + ' (by others)' : p.label, size: EL.inches(p.w) + ' × ' + EL.inches(p.h) + ' × ' + EL.inches(p.d) };
          });
          var mnote = window.P2Measure ? window.P2Measure.measuredNote(room) : '';
          pages.push({ room: room.name + (setsFor(c, j).length > 1 ? ' · ' + set.key : ''), wall: w.name, rows: rows, note: [mnote, w.notes ? 'Field note: ' + w.notes : ''].filter(Boolean).join(' · '),
            issues: lay.issues.filter(function (i) { return i.level === 'error'; }).map(function (i) { return i.text; }),
            svg: EL.svgElevation(lay, { title: room.name + ' · ' + w.name, color: set.color, uid: 'p' + pages.length }) });
        });
        var rn = room.name + (setsFor(c, j).length > 1 ? ' · ' + set.key : '');
        if (any) {
          views.push({ kind: 'plan', room: rn, svg: EL.svgPlan(R, { color: set.color, title: 'Floor plan of ' + room.name }) });
          views.push({ kind: '3d', room: rn, svg: EL.svg3D(R, { color: set.color, title: room.name }) });
        }
      });
    });
    if (!pages.length) return '';
    return D.renderElevationDocs(j, pages, views, { status: version ? (version.label || 'Version ' + version.n) + ' · saved ' + String(version.at).slice(0, 10) + ' by ' + version.by : statusText(c, j),
      flag: version ? '' : prelimText(completeness(c, j)) });
  }
  function coNote(c, j, co) {
    if (!coChanges(j).some(function (q) { return q.id === co.id; })) return '';
    var E = j.elevations || {}, r = (E.revisions || []).filter(function (q) { return q.coId === co.id; })[0];
    var link = '<a href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations">Elevations tab</a>';
    if (r) return '<span class="p2-small fmp1-faint">Elevations: revision ' + r.n + ' drawn.</span>';
    if (E.revision && E.revision.coId === co.id) return '<span class="p2-small">Elevations: revision ' + E.revision.n + ' in progress on the ' + link + '.</span>';
    if (!(E.rooms && E.rooms.length)) return '';
    return '<span class="p2-small" style="color:var(--fmp1-alert-ink)">Elevations need a revision for this change. Open the ' + link + '.</span>';
  }
  /* How complete the drawings are against the quote: { sets, any (rooms drawn), quoted, missing, complete } */
  function completeness(c, j) {
    var sets = setsFor(c, j), E = j.elevations || blankE(), missing = 0, quoted = 0, any = false;
    sets.forEach(function (s) { var rs = roomsOfSet(E, s.key), r = EL.reconcile(s.lines, rs, readE(E, s).sizes); if (rs.length) any = true; missing += r.missing; r.rows.forEach(function (x) { quoted += x.quoted; }); });
    return { sets: sets.length, any: any, quoted: quoted, missing: missing, complete: !!sets.length && any && missing === 0 };
  }
  /* The flag printed on elevation pages (and the packet summary) when drawings are incomplete; '' when they match the quote. */
  function prelimText(k) {
    if (!k.sets || k.complete) return '';
    if (!k.any) return 'Elevations to follow. No drawings are included yet; final elevations will be provided before ordering.';
    return 'Preliminary drawings: ' + (k.quoted - k.missing) + ' of ' + k.quoted + ' quoted cabinets shown. Final elevations to follow before ordering.';
  }
  /* Ready card: incomplete drawings block the contract until someone ticks "send without complete elevations" (logged). */
  function contractAck(c, j, out) {
    var k = completeness(c, j), esc = c.esc; if (!k.sets || j.stage !== 'quote') return '';
    var link = '<a href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations">Elevations tab</a>';
    if (k.complete) return '<p class="p2-small p2-ok" style="margin:10px 0 0">✓ Elevations match the quote. They go into the contract packet.</p>';
    var ack = j.elevAck, what = !k.any ? 'No elevations are drawn yet.' : k.missing + ' of ' + k.quoted + ' quoted cabinet' + (k.quoted === 1 ? '' : 's') + (k.missing === 1 ? ' isn\'t' : ' aren\'t') + ' on an elevation yet.';
    return '<div class="p2-elack" id="ct-elack" tabindex="-1"><label class="p2-row p2-small"><input type="checkbox" data-elack' + (ack ? ' checked' : '') + (out ? ' disabled' : '') + '> <b>Send without complete elevations</b>' +
      (ack ? '' : ' <span class="fmp1-faint">— ' + esc(what) + ' The packet will mark the drawings as preliminary. Or finish them on the </span>' + link + '<span class="fmp1-faint">.</span>') + '</label>' +
      (ack ? '<p class="p2-small fmp1-faint" style="margin:0">Checked by ' + esc(ack.by) + ' on ' + c.longDate(ack.on) + '. The packet says: "' + esc(prelimText(k)) + '"</p>' : '') + '</div>';
  }
  /* For the readiness list: null when fine, else a blocker */
  function contractBlocker(c, j) {
    var k = completeness(c, j); if (!k.sets || k.complete || j.elevAck) return null;
    return { id: 'elevations', step: 'elevations', message: (!k.any ? 'No elevations are drawn yet.' : k.missing + ' quoted cabinet' + (k.missing === 1 ? ' isn\'t' : 's aren\'t') + ' on an elevation yet.') + ' Finish them, or tick "Send without complete elevations".' };
  }


  /* ---------- events ---------- */
  function cur(c, j) {
    var E = j.elevations || blankE(), sets = setsFor(c, j); if (!sets.length) return null;
    var S = state(c, j, sets, E), E2 = readE(E, S.set), R = roomLayouts(S.room, S.set, E2), we = wallEntry(R, S.wall);
    return { E: E2, S: S, u: S.u, R: R, opts: we ? we.opts : {}, lay: we ? we.layout : null };
  }
  function click(c, t) {
    var r = c.route ? c.route() : null;
    var hash = (location.hash || '').split('/'); if (hash[1] !== 'job' || hash[3] !== 'elevations') return false;
    var j = c.store.job(decodeURIComponent(hash[2] || '')); if (!j) return false;
    var x = cur(c, j); if (!x) return false;
    var u = x.u, ed = editable(j), d = t.dataset;
    function done() { c.render(); return true; }
    if (d.elroom) { u.room = d.elroom; u.wall = null; u.sel = null; u.view = 'front'; u.yaw = null; return done(); }
    if (d.elwall) { u.wall = d.elwall; u.sel = null; u.view = 'front'; return done(); }
    if (d.elview) { u.view = u.view === d.elview ? 'front' : d.elview; return done(); }
    if (d.elturn) { var y0 = u.yaw == null ? EL.autoYaw(x.S.room ? x.S.room.walls : []) : u.yaw; u.yaw = ((y0 + +d.elturn + 540) % 360) - 180; return done(); }
    if (d.elsel) { u.sel = u.sel === d.elsel ? null : d.elsel; u.view = 'front'; return done(); }
    if (t.hasAttribute('data-elver')) { u.versions = !u.versions; return done(); }
    if (d.elprintver) {
      var ver = ((j.elevations || {}).versions || []).filter(function (q) { return q.n === +d.elprintver; })[0];
      if (ver) c.ui.viewer = { title: 'Elevations · ' + (ver.label || 'version ' + ver.n) + ' · ' + j.jobCode + ' · ' + j.customer, html: docPages(c, j, ver), from: '[data-elprintver="' + ver.n + '"]' };
      return done();
    }
    if (t.hasAttribute('data-elprint')) { c.ui.viewer = { title: 'Elevations · ' + j.jobCode + ' · ' + j.customer, html: docPages(c, j), from: '[data-elprint]' }; return done(); }
    if (d.elsize) { u.size = u.size === d.elsize ? null : d.elsize; return done(); }
    if (t.hasAttribute('data-elsizecancel')) { u.size = null; return done(); }
    if (d.elrevstart && j.stage !== 'quote' && j.stage !== 'lost' && !(j.elevations || {}).revision) {
      var co = pendingCOs(j).filter(function (q) { return q.id === d.elrevstart; })[0]; if (!co) return done();
      var who = c.me().name, now = new Date().toISOString();
      hist[j.jobCode] = null;
      save(c, j, 'started revision for change order ' + co.number + '.', function (E) {
        E.versions = E.versions || []; E.revisions = E.revisions || [];
        if (!E.versions.some(function (v) { return v.signed; })) E.versions.push({ n: E.versions.length + 1, label: 'As signed', signed: true, at: now, by: who, rooms: clone(E.rooms), sizes: clone(E.sizes || {}) });
        var res = EL.reviseRooms(E.rooms, co, x.E.sizes);
        E.revision = { n: E.revisions.length + 1, coId: co.id, coNumber: co.number, change: changeText(co), at: now, by: who, before: clone(E.rooms), pulled: res.pulled };
        E.rooms = res.rooms;
      }, true);
      u.sel = null; u.msg = null; u.msgPdf = null; u.versions = false; return done();
    }
    if (t.hasAttribute('data-elrevcancel') && revising(j)) {
      var rn0 = j.elevations.revision.n;
      save(c, j, 'canceled revision ' + rn0 + '.', function (E) { E.rooms = E.revision.before; delete E.revision; }, true); hist[j.jobCode] = null;
      u.sel = null; u.msgPdf = null; u.msg = 'Revision ' + rn0 + ' canceled. The drawings are back to how they were.'; return done();
    }
    if (t.hasAttribute('data-elrevsave') && revising(j)) {
      var rv = j.elevations.revision, nv2 = (j.elevations.versions || []).length + 1, left = 0;
      setsFor(c, j).forEach(function (s2) { left += EL.reconcile(s2.lines, roomsOfSet(j.elevations, s2.key), readE(j.elevations, s2).sizes).missing; });
      save(c, j, 'saved revision ' + rv.n + ' for change order ' + rv.coNumber + '.', function (E) {
        var at = new Date().toISOString();
        E.versions.push({ n: nv2, label: 'Revision ' + rv.n + ' · change order ' + rv.coNumber, revision: rv.n, coId: rv.coId, at: at, by: c.me().name, rooms: clone(E.rooms), sizes: clone(E.sizes || {}) });
        E.revisions.push({ n: rv.n, coId: rv.coId, coNumber: rv.coNumber, version: nv2, at: at, by: c.me().name });
        delete E.revision;
      }, true);
      hist[j.jobCode] = null; u.sel = null; u.msgPdf = nv2;
      u.msg = 'Saved revision ' + rv.n + '. It is now the current drawing set.' + (left ? ' ' + left + ' quoted cabinet' + (left === 1 ? ' is' : 's are') + ' still not on a wall.' : '');
      return done();
    }
    if (t.hasAttribute('data-elco') && window.P2Flows) {   // signed jobs aren't editable here, but extras can still go to a change order
      var exs = extrasOf(EL.reconcile(x.S.set.lines, x.S.rooms, x.E.sizes)); if (!exs.length) return done();
      window.P2Flows.startCO(c, j, u.set, exs); c.go('#/job/' + encodeURIComponent(j.jobCode) + '/changes'); return true;
    }
    if (!ed) return false;
    if (t.hasAttribute('data-elundo') || t.hasAttribute('data-elredo')) {
      var back = t.hasAttribute('data-elundo'), what = stepHistory(c, j, back);
      if (what) { u.sel = null; u.size = null; u.msgPdf = null; u.msg = (back ? 'Undid: ' : 'Redid: ') + what; }
      return done();
    }
    if (d.msuse && window.P2Measure) {
      var mv = window.P2Measure.visit(d.msuse); if (!mv) return done();
      u.msg = window.P2Measure.useVisit(c, j, mv, u.set, save); u.msgPdf = null; u.sel = null; u.view = 'front';
      return done();
    }
    if (d.elcopy) {
      var parts = d.elcopy.split('::'), sj = c.store.job(parts[0]); if (!sj || !sj.elevations) return done();
      var srcRooms = roomsOfSet(sj.elevations, parts.slice(1).join('::')); if (!srcRooms.length) return done();
      var res2 = EL.copyRooms(srcRooms, x.S.set.lines, { set: u.set }), names = x.S.rooms.map(function (r) { return r.name; });
      res2.rooms.forEach(function (r) { while (names.indexOf(r.name) > -1) r.name += ' (copy)'; names.push(r.name); });
      var from = sj.jobCode === j.jobCode ? parts[1] : sj.customer + ' · ' + (sj.projectName || sj.jobCode);
      save(c, j, 'copied ' + res2.rooms.map(function (r) { return r.name; }).join(', ') + ' from ' + from + '.', function (E) {
        E.rooms = E.rooms.concat(res2.rooms);
        E.sizes = E.sizes || {}; Object.keys(sj.elevations.sizes || {}).forEach(function (k) { if (!E.sizes[k]) E.sizes[k] = clone(sj.elevations.sizes[k]); });
      });
      u.room = res2.rooms[0].id; u.wall = null; u.sel = null; u.view = 'front'; u.msgPdf = null;
      u.msg = 'Copied ' + res2.rooms.map(function (r) { return r.name; }).join(', ') + ' from ' + from + ' (' + res2.items + ' cabinets). ' +
        (res2.unmatched.length ? 'Not on this quote: ' + res2.unmatched.map(function (q) { return q.code + ' ×' + q.count; }).join(', ') + '. They show as extra on the quote list; swap or remove them.' : 'Every cabinet matched this quote.');
      return done();
    }
    if (t.hasAttribute('data-eladdroom')) {
      var nr = x.S.rooms.length, name = nr === 0 ? 'Kitchen' : 'Room ' + (nr + 1), room = { id: EL.newId('room'), name: name, set: u.set, walls: [EL.emptyWall('Wall 1', 'back', 120)] };
      save(c, j, 'added room ' + name + '.', function (E) { E.rooms.push(room); });
      u.room = room.id; u.wall = room.walls[0].id; u.view = 'front'; u.msg = null; u.msgPdf = null; return done();
    }
    if (t.hasAttribute('data-eladdwall')) {
      var used = x.S.room.walls.map(function (w) { return w.position; }), pos = ['back', 'left', 'right', 'front'].filter(function (p) { return used.indexOf(p) < 0; })[0] || 'back';
      var w = EL.emptyWall('Wall ' + (x.S.room.walls.length + 1), pos, 120);
      save(c, j, 'added a wall to ' + x.S.room.name + '.', function (E) { E.rooms.forEach(function (rm) { if (rm.id === u.room) rm.walls.push(w); }); });
      u.wall = w.id; u.view = 'front'; return done();
    }
    if (t.hasAttribute('data-elrmwall') && x.S.wall) {
      save(c, j, 'removed ' + x.S.wall.name + ' from ' + x.S.room.name + '.', function (E) { E.rooms.forEach(function (rm) { if (rm.id === u.room) rm.walls = rm.walls.filter(function (w2) { return w2.id !== u.wall; }); }); });
      u.wall = null; u.sel = null; return done();
    }
    if (t.hasAttribute('data-elrmroom') && x.S.room) {
      save(c, j, 'removed room ' + x.S.room.name + '.', function (E) { E.rooms = E.rooms.filter(function (rm) { return rm.id !== u.room; }); });
      u.room = null; u.wall = null; u.view = 'front'; return done();
    }
    var wall = x.S.wall;
    if (d.eladd && wall) {
      var sp = EL.parseSku(d.eladd, x.E.sizes), run = sp.layer === 'upper' ? 'upper' : 'base', id = EL.newId();
      save(c, j, sp.code + ' added to ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2[run] = (w2[run] || []).concat([{ id: id, sku: d.eladd, gapBefore: 0 }]); });
      u.sel = id; return done();
    }
    if (t.hasAttribute('data-elauto') && wall) {
      var res = EL.autoPlace(wall, x.S.set.lines, x.S.rooms, x.E.sizes, x.opts);
      if (res.added.length) save(c, j, res.added.length + ' cabinet' + (res.added.length === 1 ? '' : 's') + ' placed on ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2.base = res.wall.base; w2.upper = res.wall.upper; });
      var noRoom = res.skipped.filter(function (s2) { return s2.why === 'no room'; }).length, noSize = res.skipped.filter(function (s2) { return s2.why === 'size needed'; }).length;
      u.msgPdf = null; u.msg = (res.added.length ? 'Placed ' + res.added.length + ' on ' + wall.name + '.' : 'Nothing more fits on ' + wall.name + '.') +
        (noRoom ? ' ' + noRoom + ' didn\'t fit; add another wall or move them.' : '') + (noSize ? ' ' + noSize + ' need a size first.' : '') +
        (res.skipped.some(function (s2) { return s2.why === 'by hand'; }) ? ' Fillers and panels are left for you to put where a gap needs closing.' : '');
      return done();
    }
    if (d.elappl && wall) {
      var pr = d.elappl.split(':'), aid = EL.newId();
      save(c, j, EL.APPLIANCES[pr[1]].label.toLowerCase() + ' added to ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2[pr[0]] = (w2[pr[0]] || []).concat([{ id: aid, appliance: pr[1], gapBefore: 0 }]); });
      u.sel = aid; return done();
    }
    if (d.elmove && wall) {
      var mv = d.elmove.split(':');
      save(c, j, 'moved an item on ' + wall.name + '.', function (E) {
        var w2 = findWall(E, u), f = findItem(w2, mv[0]); if (!f) return;
        var list = w2[f.run], i = list.indexOf(f.it), k = i + +mv[1]; if (k < 0 || k >= list.length) return;
        list.splice(i, 1); list.splice(k, 0, f.it);
      });
      return done();
    }
    if (t.hasAttribute('data-elrmextra') || t.hasAttribute('data-eladdquote')) {
      var rec2 = EL.reconcile(x.S.set.lines, x.S.rooms, x.E.sizes), ex = extrasOf(rec2);
      if (!ex.length) return done();
      if (t.hasAttribute('data-elrmextra')) {
        var left = {}; ex.forEach(function (q) { left[String(q.sku).toUpperCase()] = q.extra; });
        save(c, j, 'removed ' + ex.map(function (q) { return q.code + ' ×' + q.extra; }).join(', ') + ' (placed beyond the quote).', function (E2) {
          (E2.rooms || []).filter(function (r) { return r.set === u.set; }).slice().reverse().forEach(function (r) {   // the most recently placed go first
            r.walls.slice().reverse().forEach(function (w) { ['upper', 'base'].forEach(function (run) {
              w[run] = (w[run] || []).slice().reverse().filter(function (q) { var k = String(q.sku || '').toUpperCase(); if (left[k] > 0) { left[k]--; return false; } return true; }).reverse();
            }); });
          });
        });
        u.sel = null; u.msgPdf = null; u.msg = 'Removed the extras. Every cabinet on the drawings is on the quote now.'; return done();
      }
      if (t.hasAttribute('data-eladdquote')) {
        var res3 = window.P2Flows.addToQuote(c, j, u.set, ex);
        u.msgPdf = null; u.msg = res3; return done();
      }
    }
    if (d.elrm && wall) {
      var f0 = findItem(wall, d.elrm);
      save(c, j, (f0 ? itemName(f0.it, x.E.sizes) : 'An item') + ' removed from ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2.base = (w2.base || []).filter(function (q) { return q.id !== d.elrm; }); w2.upper = (w2.upper || []).filter(function (q) { return q.id !== d.elrm; }); });
      u.sel = null; return done();
    }
    if (d.elopen && wall) {
      var o = d.elopen === 'door' ? { kind: 'door', fromLeft: 0, width: 32, height: 80 } : { kind: 'window', fromLeft: 0, width: 30, height: 36, fromFloor: 44 };
      save(c, j, d.elopen + ' added to ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2.openings = (w2.openings || []).concat([o]); });
      return done();
    }
    if (d.elopenrm != null && wall) { save(c, j, 'removed an opening from ' + wall.name + '.', function (E) { var w2 = findWall(E, u); w2.openings.splice(+d.elopenrm, 1); }); return done(); }
    if (d.elsizesave) {
      var box = t.closest('.p2-el-edit'), v = {}; [].forEach.call(box.querySelectorAll('[data-elsizef]'), function (el) { v[el.dataset.elsizef] = el.value; });
      var size = { kind: v.kind, w: parseFloat(v.w) || null, h: parseFloat(v.h) || null, d: parseFloat(v.d) || null };
      if (size.kind === 'wall') size.layer = 'upper';
      save(c, j, 'size of ' + d.elsizesave + ' set to ' + [size.w, size.h, size.d].map(function (q) { return q == null ? '?' : EL.inches(q); }).join(' × ') + ' (' + KINDS[size.kind] + ').', function (E) { E.sizes = E.sizes || {}; E.sizes[d.elsizesave] = size; });
      u.size = null; return done();
    }
    if (t.hasAttribute('data-elsavever')) {
      var nv = (x.E.versions || []).length + 1;
      save(c, j, 'saved version ' + nv + '.', function (E) { E.versions = E.versions || []; E.versions.push({ n: nv, at: new Date().toISOString(), by: c.me().name, rooms: clone(E.rooms), sizes: clone(E.sizes || {}) }); }, true);
      u.msg = 'Saved version ' + nv + '. Open it to print, or use Save as PDF in the print window to keep or send a copy.'; u.msgPdf = nv; return done();
    }
    if (d.elrestore) {
      var vn = +d.elrestore;
      save(c, j, 'went back to version ' + vn + '.', function (E) { var v0 = E.versions.filter(function (q) { return q.n === vn; })[0]; if (v0) { E.rooms = clone(v0.rooms); E.sizes = clone(v0.sizes); } });
      u.msgPdf = null; u.msg = 'Back to version ' + vn + '. The newer layout is still in the versions list if you saved it.'; u.room = null; u.wall = null; u.sel = null; return done();
    }
    return false;
  }
  function change(c, e) {
    var el = e.target, hash = (location.hash || '').split('/'); if (hash[1] !== 'job' || hash[3] !== 'elevations') return false;
    var j = c.store.job(decodeURIComponent(hash[2] || '')); if (!j) return false;
    var x = cur(c, j); if (!x) return false;
    var u = x.u, d = el.dataset;
    if (el.hasAttribute('data-elset')) { u.set = el.value; u.room = null; u.wall = null; u.sel = null; c.render(); return true; }
    if (el.hasAttribute('data-elcopysrc')) { u.copySrc = el.value; c.render(); return true; }
    if (!editable(j)) return false;
    var wall = x.S.wall;
    if (d.elwallf && wall) {
      var f = d.elwallf, val = el.type === 'checkbox' ? el.checked : f === 'name' || f === 'position' || f === 'crown' ? el.value : (el.value === '' ? '' : parseFloat(el.value));
      if (typeof val === 'number' && isNaN(val)) { c.render(); return true; }
      var FN = { lengthIn: 'length', position: 'position', name: 'name', crown: 'crown', cornerLeft: 'left corner', cornerRight: 'right corner', islandX: 'distance from left wall', islandY: 'distance from back wall',
        ceiling: 'ceiling', soffit: 'soffit', toeKick: 'toe kick', baseHeight: 'base height', counter: 'countertop', gapToUppers: 'counter to uppers' };
      var fname = FN[f.replace('specs.', '')] || f.replace('specs.', ''), fval = typeof val === 'number' ? EL.inches(val) : typeof val === 'boolean' ? (val ? 'on' : 'off') : val === '' ? 'automatic' : val;
      save(c, j, wall.name + ': ' + fname + ' set to ' + fval + '.', function (E) {
        var w2 = findWall(E, u); if (f.indexOf('specs.') === 0) { w2.specs = w2.specs || {}; w2.specs[f.slice(6)] = val; } else w2[f] = val;
      });
      c.render(); return true;
    }
    if (d.elitemf && wall) {
      var pr = d.elitemf.split(':'), v = parseFloat(el.value);
      if (isNaN(v) || (v < 0 && pr[1] !== 'topOffset')) { c.render(); return true; }
      if (pr[1] === 'x') { moveTo(c, j, x, pr[0], v); c.render(); return true; }
      save(c, j, 'item on ' + wall.name + ': ' + (pr[1] === 'w' ? 'width' : pr[1] === 'topOffset' ? 'top raised/lowered' : 'space before') + ' ' + EL.inches(v) + '.', function (E) { var fi = findItem(findWall(E, u), pr[0]); if (fi) fi.it[pr[1]] = v; });
      c.render(); return true;
    }
    if (d.elopenf && wall) {
      var po = d.elopenf.split(':'), ov = parseFloat(el.value); if (isNaN(ov)) { c.render(); return true; }
      save(c, j, wall.name + ': opening ' + po[1] + ' ' + EL.inches(ov) + '.', function (E) { findWall(E, u).openings[+po[0]][po[1]] = ov; });
      c.render(); return true;
    }
    if (el.hasAttribute('data-elroomname') && x.S.room && el.value.trim()) {
      save(c, j, 'room renamed to ' + el.value.trim() + '.', function (E) { E.rooms.forEach(function (rm) { if (rm.id === u.room) rm.name = el.value.trim(); }); });
      c.render(); return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target; if (!el.hasAttribute('data-elpitch') || !c.ui.el) return false;
    c.ui.el.pitch = +el.value; redraw3D(c); return true;
  }
  function redraw3D(c) {
    var box = document.querySelector('[data-el3d]'); if (!box) return;
    var hash = (location.hash || '').split('/'), j = c.store.job(decodeURIComponent(hash[2] || '')); if (!j) return;
    var x = cur(c, j); if (x && x.S.room) box.innerHTML = room3D(c, x.R, x.S.room, x.S.set);
  }

  function moveTo(c, j, x, id, toX) {
    var wall = x.S.wall, res = EL.moveItem(wall, id, toX, x.E.sizes, x.opts); if (!res.moved) return;
    var f0 = findItem(wall, id), name = f0 ? itemName(f0.it, x.E.sizes) : 'An item';
    save(c, j, name + (res.mode === 'placed' ? ' moved to ' + EL.inches(res.x) + ' from the left' : ' moved in the order') + ' on ' + wall.name + '.', function (E) {
      var w2 = findWall(E, x.u); w2[res.run] = res.wall[res.run];
    });
    x.u.sel = id;
  }
  function jobOnTab(c) {
    var hash = (location.hash || '').split('/'); if (hash[1] !== 'job' || hash[3] !== 'elevations') return null;
    return c.store.job(decodeURIComponent(hash[2] || ''));
  }

  /* clicks and drags on the drawing, and drag-to-turn on the 3D view (the app's own handler only sees buttons) */
  var drag = null, bound = false, slide = null, swallowClick = false;
  function bind(root, getCtx) {
    if (bound) return; bound = true;
    document.addEventListener('keydown', function (e) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      var k = String(e.key).toLowerCase(); if (k !== 'z' && k !== 'y') return;
      var tg = e.target, tag = tg && tg.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable)) return;
      var c = getCtx(), j = jobOnTab(c); if (!j || !editable(j) || !c.ui.el) return;
      var back = k === 'z' && !e.shiftKey, what = stepHistory(c, j, back);
      e.preventDefault();
      if (what) { c.ui.el.sel = null; c.ui.el.msgPdf = null; c.ui.el.msg = (back ? 'Undid: ' : 'Redid: ') + what; c.render(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return;
      var tg = e.target, tag = tg && tg.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable)) return;
      var c = getCtx(), j = jobOnTab(c); if (!j || !c.ui.el || !c.ui.el.sel) return;
      if (e.key === 'Escape') { c.ui.el.sel = null; c.render(); return; }
      if (!editable(j)) return;
      var b = root.querySelector('.p2-el-selbar [data-elrm]'); if (!b) return;
      e.preventDefault(); b.click();
    });
    root.addEventListener('click', function (e) {
      if (swallowClick) { swallowClick = false; return; }
      var g = e.target.closest && e.target.closest('[data-elitem]'); if (!g) return;
      var c = getCtx(); if (!c.ui.el) return;
      c.ui.el.sel = c.ui.el.sel === g.getAttribute('data-elitem') ? null : g.getAttribute('data-elitem'); c.render();
    });
    // slide a cabinet along the wall
    root.addEventListener('pointerdown', function (e) {
      var g = e.target.closest && e.target.closest('.p2-el-canvas.is-edit [data-elitem]'); if (!g || e.button > 0) return;
      var c = getCtx(), j = jobOnTab(c); if (!j || !editable(j)) return;
      var x = cur(c, j); if (!x || !x.S.wall) return;
      var id = g.getAttribute('data-elitem'), lay = x.lay; if (!lay) return;
      var p = lay.base.concat(lay.upper).filter(function (q) { return q.id === id; })[0]; if (!p || !p.w) return;
      var svg = g.ownerSVGElement, m = svg.getScreenCTM(); if (!m) return;
      slide = { id: id, g: g, svg: svg, perPx: 1 / m.a, x0: e.clientX, from: p.x, w: p.w, name: p.code || p.label, moved: false, pid: e.pointerId, c: c, j: j, x: x, tip: svg.parentNode.querySelector('.p2-el-dragtip') };
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    root.addEventListener('pointermove', function (e) {
      if (!slide || e.pointerId !== slide.pid) return;
      var dxPx = e.clientX - slide.x0;
      if (!slide.moved && Math.abs(dxPx) < 4) return;
      slide.moved = true; e.preventDefault();
      var want = slide.from + dxPx * slide.perPx, res = EL.moveItem(slide.x.S.wall, slide.id, want, slide.x.E.sizes, slide.x.opts);
      var shown = res.mode === 'placed' ? res.x : want;
      slide.g.setAttribute('transform', 'translate(' + (shown - slide.from).toFixed(2) + ' 0)');
      slide.g.style.opacity = res.mode === 'placed' ? '1' : '0.65';
      slide.res = res;
      if (slide.tip) {
        slide.tip.hidden = false;
        slide.tip.textContent = slide.name + (res.mode === 'placed' ? ' · ' + EL.inches(res.x) + ' from left' : ' · drop to change the order');
        var r = slide.svg.parentNode.getBoundingClientRect();
        slide.tip.style.left = Math.max(4, Math.min(r.width - 180, e.clientX - r.left + 12)) + 'px';
        slide.tip.style.top = Math.max(4, e.clientY - r.top - 34) + 'px';
      }
    });
    function endSlide(e, cancel) {
      if (!slide || (e && e.pointerId !== slide.pid)) return;
      var s = slide; slide = null;
      if (!s.moved) {   // a plain click: the pointer was captured, so the click event won't reach the cabinet. Select it here.
        if (cancel) return;
        swallowClick = true; setTimeout(function () { swallowClick = false; }, 0);
        s.c.ui.el.sel = s.c.ui.el.sel === s.id ? null : s.id; s.c.render(); return;
      }
      swallowClick = true; setTimeout(function () { swallowClick = false; }, 0);
      if (cancel || !s.res) { s.c.render(); return; }
      moveTo(s.c, s.j, s.x, s.id, s.from + (e.clientX - s.x0) * s.perPx);
      s.c.render();
    }
    root.addEventListener('pointerup', function (e) { endSlide(e, false); });
    root.addEventListener('pointercancel', function (e) { endSlide(e, true); });

    root.addEventListener('pointerdown', function (e) {
      var box = e.target.closest && e.target.closest('[data-el3d]'); if (!box) return;
      var c = getCtx(); if (!c.ui.el) return;
      var hash = (location.hash || '').split('/'), j = c.store.job(decodeURIComponent(hash[2] || '')), x = j && cur(c, j);
      var y0 = c.ui.el.yaw == null ? EL.autoYaw(x && x.S.room ? x.S.room.walls : []) : c.ui.el.yaw;
      drag = { x: e.clientX, y: e.clientY, yaw: y0, pitch: c.ui.el.pitch, id: e.pointerId };
      try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    });
    root.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var c = getCtx(); c.ui.el.yaw = drag.yaw + (e.clientX - drag.x) * 0.4; c.ui.el.pitch = Math.max(8, Math.min(60, drag.pitch - (e.clientY - drag.y) * 0.25));
      redraw3D(c);
    });
    root.addEventListener('pointerup', function () { drag = null; });
    root.addEventListener('pointercancel', function () { drag = null; });
  }

  /* Sidebar page: every project's drawings at a glance. Drawing still happens inside each job (Elevations tab). */
  function index(c) {
    var esc = c.esc;
    var rows = c.store.jobs().filter(function (j) { return !j.parentJobCode; }).map(function (j) {
      var sets = setsFor(c, j), E = j.elevations || blankE(), rooms = E.rooms || [], placed = 0, quoted = 0, flags = 0;
      sets.forEach(function (s) {
        var Es = readE(E, s), rs = roomsOfSet(E, s.key), rec = EL.reconcile(s.lines, rs, Es.sizes);
        rec.rows.forEach(function (r) { quoted += r.quoted; placed += Math.min(r.placed, r.quoted); });
        rs.forEach(function (r) { roomLayouts(r, s, Es).forEach(function (x) { flags += x.layout.issues.length + x.layout.checks.length; }); });
      });
      var walls = rooms.reduce(function (n, r) { return n + (r.walls || []).length; }, 0);
      return { j: j, sets: sets, rooms: rooms.length, walls: walls, placed: placed, quoted: quoted, flags: flags,
        todo: editable(j) || (sets.length && !rooms.length && j.stage !== 'lost') || pendingCOs(j).length > 0 };
    }).sort(function (a, b) { return (b.todo - a.todo) || (a.j.jobCode < b.j.jobCode ? 1 : -1); });
    var drawing = rows.filter(function (x) { return x.todo; }).length;
    var body = rows.map(function (x) {
      var j = x.j, href = '#/job/' + encodeURIComponent(j.jobCode) + '/elevations';
      var sub = x.sets.length > 1 ? x.sets.length + ' models' + (j.houses && j.houses.length ? ' · ' + j.houses.length + ' houses' : '') : (j.projectName || '—');
      var drawn = x.rooms ? x.rooms + ' room' + (x.rooms === 1 ? '' : 's') + ', ' + x.walls + ' wall' + (x.walls === 1 ? '' : 's') : 'Not started';
      var prog = !x.sets.length ? '<span class="fmp1-faint">No cabinets yet</span>' :
        '<span class="p2-collect" aria-hidden="true"><i style="width:' + (x.quoted ? Math.round(100 * x.placed / x.quoted) : 0) + '%"></i></span><b>' + x.placed + '</b> of ' + x.quoted + ' placed<br><span class="fmp1-faint">' + drawn + '</span>';
      return '<tr><td><b>' + esc(j.customer) + '</b><br><span class="fmp1-faint p2-small">' + esc(sub) + ' · <span class="fmp1-code">' + esc(j.jobCode) + '</span></span></td>' +
        '<td>' + c.stagePill(j.stage) + '</td>' +
        '<td class="p2-small p2-nowrap">' + prog + '</td>' +
        '<td class="p2-small">' + (x.flags ? '<b style="color:var(--fmp1-alert-ink)">' + x.flags + ' layout check' + (x.flags === 1 ? '' : 's') + '</b><br>' : '') + '<span class="fmp1-faint">' + esc(statusText(c, j)) + '</span></td>' +
        '<td class="r p2-act"><a class="fmp1-btn' + (x.todo ? ' fmp1-btn--primary' : '') + '" href="' + href + '">' + (x.todo && editable(j) ? (x.rooms ? 'Keep drawing' : 'Start drawing') : 'Open') + '</a></td></tr>';
    }).join('');
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">Elevations</h1><p class="p2-sub">Cabinet drawings for every project. Each one is drawn inside its project from the quote\'s cabinets' +
      (drawing ? '; ' + drawing + ' still being drawn or revised, shown first.' : '.') + '</p></div>' +
      '<a class="fmp1-btn" href="#/measure">Field measure</a></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>Project</th><th>Stage</th><th>Drawings</th><th>Status</th><th></th></tr></thead><tbody>' +
      (body || '<tr><td colspan="5" class="p2-empty">No projects yet.</td></tr>') + '</tbody></table></div>';
  }

  window.P2Elev = { tab: tab, index: index, click: click, change: change, input: input, bind: bind, docPages: docPages, contractAck: contractAck, contractBlocker: contractBlocker, prelim: function (c, j) { return prelimText(completeness(c, j)); }, coNote: coNote, setsFor: setsFor };
  // this file loads after the app: hook up the drawing and redraw the page that's showing
  var appRoot = document.getElementById('p2');
  if (appRoot && window.P2) { bind(appRoot, window.P2.ctx); window.P2.render(); }
})();
