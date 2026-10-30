/*
 * Phase 2 preview · Customers and templates (HANDOFF §25). Uses FMCustomers (src/fm-phase2-customers.js).
 *
 *   #/customers         every customer: kind, who signs, projects, open balance, templates; + Add customer
 *   #/customers/<id>    profile: contacts (who signs, who gets invoices, who's on site), addresses, notes,
 *                       their projects, and templates (one home, or a builder's models with house counts, cabinets and drawings)
 *
 * Profiles are kept in their own storage (fm_phase2_customers) and filled in from the jobs on first load; the server
 * keeps them in production and links jobs by customer id (§25). Pricing is never stored on a customer or a template.
 */
(function () {
  'use strict';
  var CU = window.FMCustomers, FM = window.FMPhase1;
  var KEY = 'fm_phase2_customers';

  /* ---------- storage ---------- */
  var list = null;
  function load(c) {
    if (list) return list;
    var saved = null; try { saved = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (e) { /* none */ }
    var first = !saved;
    list = CU.fromJobs(c.store.jobs(), saved || []);
    if (first) seedTemplates(c);
    save(); return list;
  }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(list || [])); } catch (e) { /* memory only */ } }
  function refresh(c) { list = CU.fromJobs(c.store.jobs(), load(c)); save(); return list; }   // new jobs bring their customers in
  function byId(c, id) { return load(c).filter(function (x) { return x.id === id; })[0] || null; }
  function byName(c, name) { return load(c).filter(function (x) { return CU.key(x.name) === CU.key(name); })[0] || null; }
  function edit(cust, fn) { fn(cust); cust.updatedAt = new Date().toISOString(); save(); }

  /* the sample builder order becomes a starting template, so the feature has something to show */
  function seedTemplates(c) {
    if (!c.W) return;
    var j = c.store.job(c.W.jobCode), cust = j && list.filter(function (x) { return CU.key(x.name) === CU.key(j.customer); })[0];
    if (!cust || cust.templates.length) return;
    cust.kind = 'builder';
    var ss = setsOf(c, j);
    cust.templates.push(CU.templateFromSets(cust.name + ' · ' + ss.length + ' models', ss, (j.elevations && j.elevations.rooms) || [], { fromJob: j.jobCode, today: c.TODAY, by: 'Sample data' }));
  }
  /* a job's homes with their house counts and cabinets after change orders */
  function setsOf(c, j) {
    var sets = window.P2Elev ? window.P2Elev.setsFor(c, j) : [];
    return sets.map(function (s, i) {
      var qty = c.W && j.jobCode === c.W.jobCode ? c.W.houses.filter(function (h) { return h.model === s.key; }).length : (((j.models || [])[i] || {}).qty || 1);
      return { key: s.key, qty: qty, lines: s.lines };
    });
  }
  function names(c) { return load(c).map(function (x) { return x.name; }); }

  /* ---------- list ---------- */
  function money(c, cents) { return c.money(cents || 0); }
  function stats(c, cust) {
    var js = CU.jobsFor(cust, c.store.jobs()), open = 0, total = 0, active = 0;
    js.forEach(function (j) { var s = FM.contractSummary(j); if (j.stage !== 'quote' && j.stage !== 'lost') { open += s.balanceCents; total += s.currentCents; } if (['quote', 'lost', 'complete'].indexOf(j.stage) < 0) active++; });
    return { jobs: js, open: open, total: total, active: active };
  }
  function listView(c) {
    refresh(c);
    var esc = c.esc, u = c.ui.cu = c.ui.cu || {}, q = String(u.q || '').toLowerCase();
    var rows = load(c).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).filter(function (x) {
      return !q || x.name.toLowerCase().indexOf(q) > -1 || x.contacts.some(function (k) { return (k.name + ' ' + k.email).toLowerCase().indexOf(q) > -1; });
    }).map(function (x) {
      var st = stats(c, x), sg = CU.signer(x);
      return '<tr><td><a href="#/customers/' + encodeURIComponent(x.id) + '"><b>' + esc(x.name) + '</b></a><br><span class="p2-small fmp1-faint">' + esc(CU.KINDS[x.kind] || x.kind) + '</span></td>' +
        '<td>' + (sg ? esc(sg.name) + (sg.email ? '<br><span class="p2-small fmp1-faint">' + esc(sg.email) + '</span>' : '<br><span class="p2-small" style="color:var(--fmp1-alert-ink)">no email</span>') : '<span class="fmp1-faint">—</span>') + '</td>' +
        '<td class="r">' + st.jobs.length + (st.active ? '<br><span class="p2-small fmp1-faint">' + st.active + ' active</span>' : '') + '</td><td class="r">' + (st.open ? money(c, st.open) : '—') + '</td><td class="r">' + x.templates.length + '</td></tr>';
    }).join('');
    return '<div class="p2-between"><div class="p2-head"><h1 class="fmp1-h p2-h1">Customers</h1><p class="p2-sub">Who they are, who signs, where they build, their projects, and templates for the homes they order again.</p></div></div>' +
      '<div class="fmp1-card p2-pad"><div class="p2-row"><input class="fmp1-input" type="search" placeholder="Search customers or contacts" aria-label="Search customers" data-cuq value="' + esc(u.q || '') + '" style="flex:1 1 240px">' +
      '<input class="fmp1-input" placeholder="New customer\'s name" aria-label="New customer\'s name" data-cunew value="' + esc(u.newName || '') + '" style="flex:1 1 200px"><button class="fmp1-btn fmp1-btn--primary" data-cuadd>+ Add customer</button></div>' +
      (u.err ? '<p class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(u.err) + '</p>' : '') +
      '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table p2-cu-list"><thead><tr><th>Customer</th><th>Signs contracts</th><th class="r">Projects</th><th class="r">Open</th><th class="r">Templates</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="p2-empty">No customers match.</td></tr>') + '</tbody></table></div></div>';
  }

  /* ---------- profile ---------- */
  function profile(c, id) {
    var cust = byId(c, id), esc = c.esc;
    if (!cust) return '<h1 class="fmp1-h p2-h1">Customer not found</h1><a class="fmp1-btn" href="#/customers">Back to customers</a>';
    var u = c.ui.cu = c.ui.cu || {}, st = stats(c, cust), probs = CU.check(cust, load(c));
    var head = '<div class="fmp1-card p2-pad"><a class="p2-small" href="#/customers">← Customers</a><div class="p2-between" style="align-items:flex-end"><div class="p2-el-2" style="flex:1 1 420px">' +
      '<label class="p2-fld"><span>Name</span><input class="fmp1-input" data-cuf="name" value="' + esc(cust.name) + '"' + (st.jobs.length ? ' title="Projects are linked by this name in the preview"' : '') + '></label>' +
      '<label class="p2-fld"><span>Kind</span><select class="fmp1-input" data-cuf="kind">' + Object.keys(CU.KINDS).map(function (k) { return '<option value="' + k + '"' + (cust.kind === k ? ' selected' : '') + '>' + CU.KINDS[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<button class="fmp1-btn fmp1-btn--primary" data-cunewproj>New project for ' + esc(cust.name) + '</button></div>' +
      '<div class="fmp1-money"><div><span class="k">Projects</span><span class="v">' + st.jobs.length + '</span></div><div><span class="k">Contracted</span><span class="v">' + money(c, st.total) + '</span></div><div><span class="k">Open balance</span><span class="v">' + money(c, st.open) + '</span></div></div>' +
      (probs.length ? '<div class="fmp1-note fmp1-note--alert p2-small"><ul class="p2-errs">' + probs.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '') +
      (u.msg ? '<div class="fmp1-note fmp1-note--info p2-small" role="status">' + esc(u.msg) + '</div>' : '') + '</div>';

    var contacts = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Contacts</span>' + (cust.contacts.length ? cust.contacts.map(function (k) {
      var kid = esc(k.id);
      return '<div class="p2-cu-row"><label class="p2-fld"><span>Name</span><input class="fmp1-input" data-cuc="' + kid + ':name" value="' + esc(k.name) + '"></label>' +
        '<label class="p2-fld"><span>Role</span><select class="fmp1-input" data-cuc="' + kid + ':role">' + Object.keys(CU.ROLES).map(function (r) { return '<option value="' + r + '"' + (k.role === r ? ' selected' : '') + '>' + CU.ROLES[r] + '</option>'; }).join('') + '</select></label>' +
        '<label class="p2-fld"><span>Email</span><input class="fmp1-input" type="email" data-cuc="' + kid + ':email" value="' + esc(k.email || '') + '"></label>' +
        '<label class="p2-fld"><span>Phone</span><input class="fmp1-input" type="tel" data-cuc="' + kid + ':phone" value="' + esc(k.phone || '') + '"></label>' +
        '<label class="p2-el-check"><input type="checkbox" data-cuc="' + kid + ':signs"' + (k.signs ? ' checked' : '') + '> Signs contracts</label>' +
        '<button class="p2-linkbtn p2-small" data-curmc="' + kid + '" style="color:var(--fmp1-alert-ink)">Remove</button></div>';
    }).join('') : '<p class="p2-small fmp1-faint">No contacts yet.</p>') + '<button class="fmp1-btn fmp1-btn--quiet" data-cuaddc>+ Contact</button>' +
      '<p class="p2-small fmp1-faint">New projects for this customer start with the first contact who signs as the signer, and their email for Dropbox Sign.</p></div>';

    var addresses = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Addresses</span>' + (cust.addresses.length ? cust.addresses.map(function (a) {
      var aid = esc(a.id);
      return '<div class="p2-cu-row"><label class="p2-fld"><span>Label</span><input class="fmp1-input" data-cua="' + aid + ':label" value="' + esc(a.label || '') + '" placeholder="Willow Creek, phase 2"></label>' +
        '<label class="p2-fld"><span>Kind</span><select class="fmp1-input" data-cua="' + aid + ':kind"><option value="site"' + (a.kind === 'site' ? ' selected' : '') + '>Job site</option><option value="billing"' + (a.kind === 'billing' ? ' selected' : '') + '>Billing</option></select></label>' +
        '<button class="p2-linkbtn p2-small" data-curma="' + aid + '" style="color:var(--fmp1-alert-ink)">Remove</button>' +
        '<div class="p2-cu-wide">' + window.FMAddress.fieldsHTML(function (f) { return 'data-cua="' + aid + ':' + f + '"'; }, window.FMAddress.from(a)) + '</div></div>';
    }).join('') : '<p class="p2-small fmp1-faint">No addresses yet.</p>') + '<button class="fmp1-btn fmp1-btn--quiet" data-cuadda>+ Address</button>' +
      '<label class="p2-fld"><span>Notes</span><textarea class="fmp1-input" rows="2" data-cuf="notes">' + esc(cust.notes || '') + '</textarea></label></div>';

    // Projects: one row per job (name and code, stage, total, balance); the whole row opens the job
    var STAGE = {}; (FM.STAGES || []).forEach(function (x) { STAGE[x.key] = x.label; }); STAGE.lost = 'Lost';
    var TONE = { quote: 'fmp1-pill--proposed', lost: 'fmp1-pill--alert', complete: 'fmp1-pill--good' };
    var projects = '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Projects · ' + st.jobs.length + '</span></div>' + (st.jobs.length ? '<ul class="p2-cu-jobs">' +
      st.jobs.map(function (j) {
        var s = FM.contractSummary(j), open = j.stage === 'quote' || j.stage === 'lost';
        return '<li><a class="p2-cu-job" href="#/job/' + encodeURIComponent(j.jobCode) + '/overview"><span class="p2-cu-job-main"><b>' + esc(j.projectName || j.jobCode) + '</b><span class="p2-small fmp1-faint">' + esc(j.jobCode) + '</span></span>' +
          '<span class="fmp1-pill ' + (TONE[j.stage] || '') + '">' + esc(STAGE[j.stage] || j.stage) + '</span>' +
          '<span class="p2-cu-num"><span class="k">' + (open ? 'Quoted' : 'Total') + '</span>' + money(c, s.currentCents) + '</span>' +
          '<span class="p2-cu-num"><span class="k">Balance</span>' + (open ? '—' : money(c, s.balanceCents)) + '</span><span class="p2-cu-chev" aria-hidden="true">›</span></a></li>';
      }).join('') + '</ul>' : '<p class="p2-empty">No projects yet.</p>') + '</div>';

    // Templates: a tile per template with one main action; saving a new one opens a small picker only when asked
    var tpls = cust.templates.map(function (t) {
      var tid = esc(t.id), renaming = u.rename === t.id, houses = t.models.reduce(function (n, m) { return n + m.qty; }, 0), lines = t.models.reduce(function (n, m) { return n + m.lines.length; }, 0),
        rooms = t.models.reduce(function (n, m) { return n + m.rooms.length; }, 0);
      var facts = (t.kind === 'builder' ? t.models.length + ' models · ' + houses + ' houses' : 'One home') + ' · ' + lines + ' cabinet lines' + (rooms ? ' · ' + rooms + ' room' + (rooms === 1 ? '' : 's') + ' drawn' : '');
      return '<li class="p2-cu-tpl">' +
        '<div class="p2-cu-tpl-main">' + (renaming ? '<span class="p2-row"><input class="fmp1-input" data-cutplname="' + tid + '" value="' + esc(t.name) + '" aria-label="Template name" data-autofocus><button class="fmp1-btn" data-cutplren="' + tid + '">Save</button><button class="fmp1-btn fmp1-btn--quiet" data-cutplrenx>Cancel</button></span>' : '<b class="p2-cu-tpl-name">' + esc(t.name) + '</b>') +
          '<span class="p2-small">' + esc(facts) + '</span>' +
          (t.kind === 'builder' ? '<span class="p2-cu-chips">' + t.models.map(function (m) { return '<span class="p2-cu-chip">' + esc(m.name) + ' × ' + m.qty + '</span>'; }).join('') + '</span>' : '') +
          '<span class="p2-small fmp1-faint">' + (t.fromJob ? 'Saved from ' + esc(t.fromJob) : 'Saved') + (t.costsAsOf ? ' · supplier costs as of ' + esc(c.longDate(t.costsAsOf)) : '') + '</span></div>' +
        '<div class="p2-cu-tpl-acts"><button class="fmp1-btn fmp1-btn--primary" data-cutpluse="' + tid + '">Start a project</button>' +
          (renaming ? '' : '<span class="p2-row p2-small"><button class="p2-cu-quiet" data-cutplrename="' + tid + '">Rename</button><button class="p2-cu-quiet is-danger" data-cutpldel="' + tid + '">' + (u.confirmDel === t.id ? 'Tap again to delete' : 'Delete') + '</button></span>') + '</div></li>';
    }).join('');
    var fromJob = st.jobs.filter(function (j) { return window.P2Elev && window.P2Elev.setsFor(c, j).length; });
    var picker = u.tplPick && fromJob.length ? '<div class="p2-cu-pick"><label class="p2-fld" style="flex:1 1 280px"><span>Which project?</span><select class="fmp1-input" data-cutplsrc>' +
        fromJob.map(function (j) { return '<option value="' + esc(j.jobCode) + '"' + (u.tplSrc === j.jobCode ? ' selected' : '') + '>' + esc((j.projectName || j.jobCode) + ' · ' + j.jobCode) + '</option>'; }).join('') + '</select></label>' +
        '<button class="fmp1-btn fmp1-btn--primary" data-cutplsave>Save as template</button><button class="fmp1-btn fmp1-btn--quiet" data-cutplpick>Cancel</button>' +
        '<p class="p2-small fmp1-faint" style="flex-basis:100%;margin:0">Saves its homes (or models and house counts), cabinets after change orders, and drawings.</p></div>' : '';
    var templates = '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Templates · ' + cust.templates.length + '</span>' +
      (fromJob.length && !u.tplPick ? '<button class="fmp1-btn" data-cutplpick>+ Save a project as a template</button>' : '') + '</div>' + picker +
      (tpls ? '<ul class="p2-cu-tpls">' + tpls + '</ul>' : '<p class="p2-empty">No templates yet. Save one from a project to reuse its homes, cabinets and drawings.</p>') +
      '<p class="p2-small fmp1-faint" style="margin:0">Templates never include pricing; it\'s set on each new project.</p></div>';
    var del = st.jobs.length ? '' : '<button class="p2-cu-quiet is-danger p2-small" data-cudel style="align-self:flex-start">' + (u.confirmCust === cust.id ? 'Tap again to delete this customer' : 'Delete this customer') + '</button>';
    return '<div class="p2-cu">' + head + '<div class="p2-grid">' + contacts + addresses + '</div>' + templates + projects + del + '</div>';
  }

  /* ---------- templates ---------- */
  function saveTemplate(c, cust, j, name) {
    var base = j.projectName && !/^\d/.test(j.projectName) ? j.projectName : j.customer;   // Willow's project name is a list of house counts
    var t = CU.templateFromSets(name || (base + ' template'), setsOf(c, j), (j.elevations && j.elevations.rooms) || [], { fromJob: j.jobCode, today: c.TODAY, by: c.me().name });
    edit(cust, function (x) { x.templates.push(t); });
    return t;
  }

  /* ---------- events ---------- */
  function where() { var h = (location.hash || '').replace(/^#\/?/, '').split('/'); return { area: h[0], id: decodeURIComponent(h[1] || ''), sub: h[2] || '' }; }
  function click(c, t, j) {
    var r = where(), u = c.ui.cu = c.ui.cu || {}, d = t.dataset;
    // from a job's header: save it as a template on its customer
    if (j && t.hasAttribute('data-cutpljob')) {
      var owner = byName(c, j.customer) || (refresh(c), byName(c, j.customer));
      if (!owner) return true;
      var tt = saveTemplate(c, owner, j);
      u.msg = 'Saved "' + tt.name + '" (' + CU.summary(tt) + ') to ' + owner.name + '. Use it from here or from New Project.';
      c.go('#/customers/' + encodeURIComponent(owner.id)); return true;
    }
    if (r.area !== 'customers') return false;
    if (t.hasAttribute('data-cuadd')) {
      var nm = String(u.newName || '').trim(); if (!nm) { u.err = 'Type the new customer\'s name first.'; c.render(); return true; }
      if (byName(c, nm)) { u.err = 'There\'s already a customer called ' + nm + '.'; c.render(); return true; }
      var nc = CU.blank(nm); load(c).push(nc); save(); u.newName = ''; u.err = null; u.msg = null; c.go('#/customers/' + encodeURIComponent(nc.id)); return true;
    }
    var cust = byId(c, r.id); if (!cust) return false;
    if (t.hasAttribute('data-cuaddc')) { edit(cust, function (x) { x.contacts.push({ id: CU.newId('ct'), name: '', role: x.contacts.length ? 'other' : 'signer', email: '', phone: '', signs: !x.contacts.length }); }); c.render(); return true; }
    if (d.curmc) { edit(cust, function (x) { x.contacts = x.contacts.filter(function (k) { return k.id !== d.curmc; }); }); c.render(); return true; }
    if (t.hasAttribute('data-cuadda')) { edit(cust, function (x) { x.addresses.push({ id: CU.newId('ad'), label: '', kind: 'site', line: '', street: '', city: '', state: window.FMAddress.DEFAULT_STATE, zip: '' }); }); c.render(); return true; }
    if (d.curma) { edit(cust, function (x) { x.addresses = x.addresses.filter(function (a) { return a.id !== d.curma; }); }); c.render(); return true; }
    if (t.hasAttribute('data-cutplpick')) { u.tplPick = !u.tplPick; c.render(); return true; }
    if (t.hasAttribute('data-cutplrenx')) { u.rename = null; c.render(); return true; }
    if (t.hasAttribute('data-cutplsave')) { u.tplPick = false;
      var src = c.store.job(u.tplSrc || '') || CU.jobsFor(cust, c.store.jobs()).filter(function (x) { return window.P2Elev.setsFor(c, x).length; })[0];
      if (!src) return true;
      var t2 = saveTemplate(c, cust, src); u.msg = 'Saved "' + t2.name + '" (' + CU.summary(t2) + ').'; c.render(); return true;
    }
    if (d.cutplrename) { u.rename = d.cutplrename; c.render(); return true; }
    if (d.cutplren) {
      var inp = document.querySelector('[data-cutplname="' + d.cutplren + '"]'), v = inp ? inp.value.trim() : '';
      if (v) edit(cust, function (x) { x.templates.forEach(function (q) { if (q.id === d.cutplren) q.name = v; }); });
      u.rename = null; c.render(); return true;
    }
    if (d.cutpldel) {
      if (u.confirmDel !== d.cutpldel) { u.confirmDel = d.cutpldel; c.render(); return true; }
      edit(cust, function (x) { x.templates = x.templates.filter(function (q) { return q.id !== d.cutpldel; }); }); u.confirmDel = null; u.msg = 'Template deleted.'; c.render(); return true;
    }
    if (d.cutpluse) {
      var tpl = cust.templates.filter(function (q) { return q.id === d.cutpluse; })[0];
      if (tpl && window.P2Flows && window.P2Flows.fromTemplate) { window.P2Flows.fromTemplate(c, cust, tpl); c.go('#/new'); }
      return true;
    }
    if (t.hasAttribute('data-cunewproj')) { if (window.P2Flows && window.P2Flows.fromTemplate) { window.P2Flows.fromTemplate(c, cust, null); c.go('#/new'); } return true; }
    if (t.hasAttribute('data-cudel')) {
      if (u.confirmCust !== cust.id) { u.confirmCust = cust.id; c.render(); return true; }
      list = load(c).filter(function (x) { return x.id !== cust.id; }); save(); u.confirmCust = null; c.go('#/customers'); return true;
    }
    return false;
  }
  function change(c, e) {
    var r = where(); if (r.area !== 'customers') return false;
    var el = e.target, d = el.dataset, u = c.ui.cu = c.ui.cu || {};
    if (el.hasAttribute('data-cunew')) { u.newName = el.value; u.err = null; return true; }
    if (el.hasAttribute('data-cutplsrc')) { u.tplSrc = el.value; return true; }
    var cust = byId(c, r.id); if (!cust) return false;
    if (d.cuf) {
      var v = el.value;
      if (d.cuf === 'name') {
        v = v.trim(); if (!v) { c.render(); return true; }
        var js = CU.jobsFor(cust, c.store.jobs());
        if (js.length) { u.msg = 'In the preview, projects are linked to a customer by name, so a customer with projects keeps their name. On the server they\'re linked by id and can be renamed.'; c.render(); return true; }
      }
      edit(cust, function (x) { x[d.cuf] = v; }); if (d.cuf !== 'notes') c.render(); return true;
    }
    if (d.cuc) {
      var p = d.cuc.split(':'); edit(cust, function (x) { x.contacts.forEach(function (k) { if (k.id === p[0]) k[p[1]] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); });
      c.render(); return true;
    }
    if (d.cua) { var q = d.cua.split(':'), AD = window.FMAddress; edit(cust, function (x) { x.addresses.forEach(function (a) {
      if (a.id !== q[0]) return;
      if (/^(street|city|state|zip)$/.test(q[1])) { var f = AD.from(a); f[q[1]] = el.value.trim(); a.street = f.street; a.city = f.city; a.state = f.state; a.zip = f.zip; a.line = AD.format(f); }
      else a[q[1]] = el.value.trim(); }); }); c.render(); return true; }
    return false;
  }
  function input(c, e) {
    if (!e.target.hasAttribute('data-cuq')) return false;
    var u = c.ui.cu = c.ui.cu || {}, pos = e.target.selectionStart; u.q = e.target.value; c.render();
    var s = document.querySelector('[data-cuq]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); }
    return true;
  }

  window.P2Customers = { list: listView, profile: profile, click: click, change: change, input: input, names: names, byName: byName, load: load, refresh: refresh };
  var appRoot = document.getElementById('p2');
  if (appRoot && window.P2) window.P2.render();
})();
