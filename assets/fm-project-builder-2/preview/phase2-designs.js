/*
 * Phase 2 preview · Designs library and design approval (window.P2Designs). Uses FMDesigns and FMEstimate.
 *   #/designs: every saved elevation design, "New design", "Save a project's elevations as a design", "Start a project".
 *   A design opens like a project, with only Elevations and Activity. A project started from one is design-first:
 *   the Elevations tab asks for the customer's approval (in person, by email, or signed with the e-sign tool) before pricing.
 *   HANDOFF §37.
 */
(function () {
  'use strict';
  var DS = window.FMDesigns, ES = window.FMEstimate, EL = window.FMElev;

  function thumb(d) {
    try {
      var room = d.elevations.rooms[0], wall = room && room.walls && room.walls[0]; if (!wall) return '<div class="ds-thumb ds-thumb--empty">Not drawn yet</div>';
      var lay = EL.layoutRoom(room, d.elevations.sizes || {}, {})[0].layout;
      return '<div class="ds-thumb">' + EL.svgElevation(lay, { title: d.customer, color: (d.elevations.sketch && d.elevations.sketch.color) || 'SBW', uid: 'ds' + d.jobCode }) + '</div>';
    } catch (e) { return '<div class="ds-thumb ds-thumb--empty">Drawing</div>'; }
  }

  /* ---------- the library ---------- */
  function page(c) {
    var esc = c.esc, all = c.store.jobs({ all: true }), lib = DS.library(all), u = c.ui.ds || (c.ui.ds = {}), kind = u.kind || 'all';
    var shown = lib.filter(function (x) { return kind === 'all' || x.kind === kind; });
    var form = '';
    if (u.form === 'new') form = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">New design</span><div class="p2-form">' +
      fld('Name', 'data-dsf="name" data-autofocus placeholder="L-shaped kitchen with island"', u.name) +
      '<label class="p2-fld"><span>Room</span><select class="fmp1-input" data-dsf="kind">' + Object.keys(DS.KINDS).map(function (k) { return '<option value="' + k + '"' + ((u.kindNew || 'kitchen') === k ? ' selected' : '') + '>' + esc(DS.KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
      (window.P2Colors ? '<div class="p2-fld" style="flex-basis:100%"><span>Color</span>' + window.P2Colors.picker(c, u.color || 'SBW', 'dscolor') + '</div>' : '<label class="p2-fld"><span>Color</span><select class="fmp1-input" data-dsf="color">' + Object.keys(DS.COLORS).map(function (k) { return '<option value="' + k + '"' + ((u.color || 'SBW') === k ? ' selected' : '') + '>' + esc(DS.COLORS[k]) + '</option>'; }).join('') + '</select></label>') +
      fld('Notes (optional)', 'data-dsf="notes"', u.notes) + '<button class="fmp1-btn fmp1-btn--primary" data-dscreate>Create and start drawing</button><button class="fmp1-btn fmp1-btn--quiet" data-dsform="">Cancel</button>' + errs(c, u) + '</div></div>';
    if (u.form === 'copy') {
      var withElev = c.store.jobs().filter(function (j) { return j.elevations && (j.elevations.rooms || []).length; });
      form = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Save a project\'s elevations as a design</span><div class="p2-form"><label class="p2-fld"><span>Project</span><select class="fmp1-input" data-dsf="from"><option value="">Choose…</option>' +
        withElev.map(function (j) { return '<option value="' + esc(j.jobCode) + '"' + (u.from === j.jobCode ? ' selected' : '') + '>' + esc(j.customer + ' · ' + (j.projectName || j.jobCode)) + '</option>'; }).join('') + '</select></label>' +
        fld('Design name', 'data-dsf="name"', u.name) + '<label class="p2-fld"><span>Room</span><select class="fmp1-input" data-dsf="kind">' + Object.keys(DS.KINDS).map(function (k) { return '<option value="' + k + '"' + ((u.kindNew || 'kitchen') === k ? ' selected' : '') + '>' + esc(DS.KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
        '<button class="fmp1-btn fmp1-btn--primary" data-dscopy>Save as a design</button><button class="fmp1-btn fmp1-btn--quiet" data-dsform="">Cancel</button><span class="p2-small fmp1-faint" style="flex-basis:100%">The project isn\'t changed; the design is a copy of its drawings, with no prices.</span>' + errs(c, u) + '</div></div>';
    }
    var cards = shown.map(function (x) {
      var d = c.store.job(x.code), starting = u.start === x.code;
      return '<li class="fmp1-card ds-card">' + thumb(d) + '<div class="ds-meta"><b>' + esc(x.name) + '</b><span class="p2-small fmp1-faint">' + esc(x.kindLabel) + ' · ' + x.rooms + ' room' + (x.rooms === 1 ? '' : 's') + ', ' + x.walls + ' wall' + (x.walls === 1 ? '' : 's') + (x.projects.length ? ' · used on ' + x.projects.length + ' project' + (x.projects.length > 1 ? 's' : '') : '') + '</span>' +
        (x.notes ? '<span class="p2-small">' + esc(x.notes) + '</span>' : '') +
        '<span class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary" data-dsstart="' + esc(x.code) + '">Start a project from this design</button><a class="fmp1-btn fmp1-btn--quiet" href="#/job/' + encodeURIComponent(x.code) + '/elevations">Open the drawing</a></span>' +
        (starting ? startForm(c, u, x) : '') + '</div></li>';
    }).join('');
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">Designs</h1><p class="p2-sub">Cabinet layouts to start projects from. Draw a design, show it to the customer, get their approval, then add the SKUs and price it.</p></div>' +
      '<span class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-dsform="new">New design</button><button class="fmp1-btn" data-dsform="copy">Save a project as a design</button></span></div>' + form +
      '<div class="p2-chips" role="group" aria-label="Room">' + [['all', 'All (' + lib.length + ')']].concat(Object.keys(DS.KINDS).filter(function (k) { return lib.some(function (x) { return x.kind === k; }); }).map(function (k) { return [k, DS.KINDS[k]]; })).map(function (f) { return '<button class="fmp1-btn" data-dskind="' + f[0] + '" aria-pressed="' + (kind === f[0]) + '">' + esc(f[1]) + '</button>'; }).join('') + '</div>' +
      (cards ? '<ul class="ds-grid">' + cards + '</ul>' : '<div class="fmp1-card p2-pad"><p>No designs yet. Press <b>New design</b> to draw one, or save a project\'s elevations as a design.</p></div>');
  }
  function startForm(c, u, x) {
    return '<div class="p2-form ds-start"><b style="flex-basis:100%">Start a project from "' + c.esc(x.name) + '"</b>' + fld('Customer', 'data-dsf="customer" data-autofocus', u.customer) + fld('Project name', 'data-dsf="project" placeholder="' + c.esc(x.name) + '"', u.project) +
      fld('Who signs', 'data-dsf="signer"', u.signer) + fld('Their email', 'data-dsf="email" type="email"', u.email) +
      '<button class="fmp1-btn fmp1-btn--primary" data-dsgo="' + c.esc(x.code) + '">Start the project</button><button class="fmp1-btn fmp1-btn--quiet" data-dsstart="">Cancel</button>' +
      '<span class="p2-small fmp1-faint" style="flex-basis:100%">It opens on the drawing. Next: the customer approves the design, then you add the SKUs and price it.</span>' + errs(c, u) + '</div>';
  }
  function fld(label, attrs, val) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" ' + attrs + ' value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"></label>'; }
  function errs(c, u) { return u.errors && u.errors.length ? '<ul class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%;margin:0">' + u.errors.map(function (e) { return '<li>' + c.esc(e) + '</li>'; }).join('') + '</ul>' : ''; }

  /* ---------- a design opens like a project, with only Elevations and Activity ---------- */
  function jobView(c, j, tab) {
    var esc = c.esc, d = j.designTemplate, lib = DS.library(c.store.jobs({ all: true })).filter(function (x) { return x.code === j.jobCode; })[0] || { projects: [] }, u = c.ui.ds || (c.ui.ds = {});
    var head = '<div class="fmp1-card p2-jobhead"><div class="p2-between"><div><span class="fmp1-code">' + esc(j.jobCode) + ' · design</span><h1 class="fmp1-h p2-h1">' + esc(j.customer) + '</h1>' +
      '<span class="fmp1-muted">' + esc(DS.KINDS[d.kind] || 'Design') + (d.by ? ' · by ' + esc(d.by) : '') + (d.on ? ' · ' + c.longDate(d.on) : '') + (lib.projects.length ? ' · used on ' + lib.projects.map(function (p) { return esc(p.customer); }).join(', ') : '') + '</span></div>' +
      '<a class="fmp1-btn fmp1-btn--quiet" href="#/designs">All designs</a></div>' + (d.notes ? '<p class="p2-small">' + esc(d.notes) + '</p>' : '') +
      '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-dsstart="' + esc(j.jobCode) + '">Start a project from this design</button></div>' +
      (u.start === j.jobCode ? startForm(c, u, { name: j.customer, code: j.jobCode }) : '') + '</div>';
    var tabs = '<nav class="p2-tabs" aria-label="Design sections"><a href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations"' + (tab !== 'activity' ? ' aria-current="page"' : '') + '>Elevations</a><a href="#/job/' + encodeURIComponent(j.jobCode) + '/activity"' + (tab === 'activity' ? ' aria-current="page"' : '') + '>Activity</a></nav>';
    var body = tab === 'activity' ? '<div class="fmp1-card p2-pad"><ul class="p2-list">' + c.store.log(j.jobCode).map(function (e) { return '<li><span>' + esc(e.text) + '</span><span class="fmp1-faint p2-small">' + esc(e.by) + '</span></li>'; }).join('') + '</ul></div>'
      : (window.P2Elev ? window.P2Elev.tab(c, j) : '');
    return head + tabs + body;
  }

  /* ---------- design approval on a design-first project's Elevations tab ---------- */
  function approvalCard(c, j) {
    if (j.designTemplate || j.stage !== 'quote' || (!j.designFirst && !(j.elevations && (j.elevations.rooms || []).length))) return '';   // design-first: required; any quote with drawings: recommended (HANDOFF §41)
    var esc = c.esc, a = j.designApproval, E = j.elevations || {}, vers = E.versions || [], u = c.ui.da && c.ui.da.job === j.jobCode ? c.ui.da : (c.ui.da = { job: j.jobCode, how: 'inPerson', version: vers.length ? vers[vers.length - 1].n : 0 });
    if (a) return '<div class="fmp1-card p2-pad da-card is-done"><span class="fmp1-eyebrow">Design approval</span><p class="p2-ok">✓ The customer approved version ' + a.version + ' (' + esc(ES.APPROVAL_HOW[a.how]).toLowerCase() + (a.note ? ': ' + esc(a.note) : '') + '). Recorded by ' + esc(a.by) + '.</p>' +
      (j.stage === 'quote' ? '<div class="p2-row"><a class="fmp1-btn fmp1-btn--primary" href="#/job/' + encodeURIComponent(j.jobCode) + '/estimate">Next: add the SKUs and price it</a></div>' : '') + '</div>';
    var req = j.designSign && j.designSign.request, out = req && req.status === 'out';
    var steps = '<ol class="da-steps"><li class="' + ((E.rooms || []).length ? 'done' : 'now') + '">Draw the design</li><li class="' + (vers.length ? 'done' : (E.rooms || []).length ? 'now' : '') + '">Save it as a version</li><li class="' + (vers.length ? 'now' : '') + '">The customer approves it</li><li>Add the SKUs and price it</li></ol>';
    var body = '';
    if (out && window.P2Sign) body = '<p class="p2-small">Sent to ' + esc(req.signers[0].name) + ' to approve version ' + (j.designSign.version || '') + '.</p>' + window.P2Sign.panel(c, j, req, 'ds');
    else if (!vers.length) body = '<p class="p2-small">Save the drawing as a version (<b>Save version</b> above the drawing), so everyone knows exactly which design the customer approved.</p>';
    else body = '<div class="p2-form"><label class="p2-fld"><span>Version</span><select class="fmp1-input" data-daf="version">' + vers.map(function (v) { return '<option value="' + v.n + '"' + (+u.version === v.n ? ' selected' : '') + '>Version ' + v.n + (v.label ? ' · ' + esc(v.label) : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-fld"><span>How did they approve it?</span><select class="fmp1-input" data-daf="how">' + Object.keys(ES.APPROVAL_HOW).map(function (k) { return '<option value="' + k + '"' + (u.how === k ? ' selected' : '') + '>' + esc(k === 'signed' ? 'Send it to them to approve (e-sign)' : ES.APPROVAL_HOW[k]) + '</option>'; }).join('') + '</select></label>' +
      (u.how === 'signed' ? '<button class="fmp1-btn fmp1-btn--primary" data-dasend' + (j.contacts && j.contacts.buyerEmail ? '' : ' disabled') + '>Send for approval</button>' + (j.contacts && j.contacts.buyerEmail ? '' : '<span class="p2-small" style="color:var(--fmp1-alert-ink)">Add the customer\'s email on the Contract tab first.</span>')
        : '<label class="p2-fld" style="flex:1 1 240px"><span>Who approved it, and when</span><input class="fmp1-input" data-daf="note" value="' + esc(u.note || '') + '" placeholder="Dana, at the showroom, Nov 19"></label><button class="fmp1-btn fmp1-btn--primary" data-dasave>Customer approved</button>') +
      (u.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(u.error) + '</span>' : '') + '</div>';
    return '<div class="fmp1-card p2-pad da-card' + (j.designFirst ? '' : ' is-optional') + '"><span class="fmp1-eyebrow">' + (j.designFirst ? 'Design approval · before pricing' : 'Customer approval of the drawings · recommended before the contract') + '</span>' + (j.designFirst ? steps : '') + body + '</div>';
  }
  function approve(c, j, input) {
    var r = ES.approveDesign(j, input, c.me(), new Date().toISOString());
    if (!r.ok) return r;
    c.store.update(j.jobCode, function (x) { x.designApproval = r.approval; return x; }, r.log, c.me().name);
    return r;
  }

  /* ---------- events ---------- */
  function click(c, t) {
    var u = c.ui.ds || (c.ui.ds = {}), d = t.dataset;
    if (d.dsform != null) { u.form = d.dsform || null; u.errors = null; c.render(); return true; }
    if (d.dskind) { u.kind = d.dskind; c.render(); return true; }
    if (d.dscolor) { u.color = d.dscolor; c.render(); return true; }
    if (d.dsstart != null) { u.start = d.dsstart || null; u.errors = null; c.render(); return true; }
    if (t.hasAttribute('data-dscreate')) {
      var r = DS.create({ name: u.name, kind: u.kindNew || 'kitchen', color: u.color || 'SBW', notes: u.notes }, { by: c.me().name, today: c.TODAY, existing: c.store.jobs({ all: true }) });
      if (!r.ok) { u.errors = r.problems; c.render(); return true; }
      c.store.addJob(r.design, c.me().name); c.ui.ds = {}; c.go('#/job/' + r.design.jobCode + '/elevations'); return true;
    }
    if (t.hasAttribute('data-dscopy')) {
      var src = c.store.job(u.from || ''); if (!src) { u.errors = ['Choose the project.']; c.render(); return true; }
      var r2 = DS.fromProject(src, { name: u.name, kind: u.kindNew || 'kitchen' }, { by: c.me().name, today: c.TODAY, existing: c.store.jobs({ all: true }) });
      if (!r2.ok) { u.errors = r2.problems; c.render(); return true; }
      c.store.addJob(r2.design, c.me().name); c.ui.ds = {}; c.render(); return true;
    }
    if (d.dsgo) {
      var des = c.store.job(d.dsgo), F = window.P2Flows, P = F.DEFAULTS;
      var r3 = DS.startProject(des, { customer: u.customer, project: u.project, signer: u.signer, email: u.email }, { code: F.nextCode(c), by: c.me().name, today: c.TODAY,
        pricing: { markupPct: P.markupPct, discountPctOfCost: P.discountPctOfCost, gaPct: P.gaPct, taxPct: P.taxPct, assemblyRateCents: Math.round(parseFloat(P.assemblyRate) * 100) } });
      if (!r3.ok) { u.errors = r3.problems; c.render(); return true; }
      c.store.addJob(r3.job, c.me().name); c.store.update(r3.job.jobCode, function (x) { return x; }, r3.log, c.me().name);
      c.ui.ds = {}; c.go('#/job/' + r3.job.jobCode + '/elevations'); return true;
    }
    // design approval
    var h = location.hash.replace(/^#\/?/, '').split('/'), j = h[0] === 'job' ? c.store.job(decodeURIComponent(h[1] || '')) : null;
    if (!j || !c.ui.da || c.ui.da.job !== j.jobCode) return false;
    var A = c.ui.da;
    if (t.hasAttribute('data-dasave')) { var ra = approve(c, j, { version: +A.version, how: A.how, note: A.note }); if (!ra.ok) { A.error = ra.error; c.render(); return true; } c.ui.da = null; c.render(); return true; }
    if (t.hasAttribute('data-dasend') && window.P2Sign) { window.P2Sign.sendDesign(c, j, +A.version); return true; }
    return false;
  }
  function input(c, e) {
    var el = e.target, d = el.dataset;
    if (d.dsf) { var u = c.ui.ds || (c.ui.ds = {}); u[d.dsf === 'kind' ? 'kindNew' : d.dsf] = el.value; return true; }
    if (d.daf && c.ui.da) { c.ui.da[d.daf] = el.value; if (d.daf === 'how') c.render(); return true; }
    return false;
  }

  window.P2Designs = { page: page, jobView: jobView, approvalCard: approvalCard, approve: approve, click: click, input: input };
  if (window.P2) window.P2.render();
})();
