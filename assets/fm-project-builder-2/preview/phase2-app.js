/*
 * Project Builder · Phase 2 app (preview). Screens only: every rule lives in src/ (FMPhase1, FMQuote, FMDocs,
 * FMBooks, FMStore, FMContract, FMChangeOrder, FMBid). Data is the sample jobs, saved in this browser only.
 * Routes (hash): #/books/<dashboard|pipeline|deposits|reconcile|pnl|balance>, #/projects, #/new,
 *                #/job/<code>/<overview|cabinets|elevations|changes|contract|invoices|documents|activity>, #/users, #/measure[/<visit>]
 */
(function () {
  'use strict';
  var FM = window.FMPhase1, Q = window.FMQuote, D = window.FMDocs, BK = window.FMBooks, ST = window.FMStore;
  var W = window.FM_WILLOW_ORDER, B = window.FM_BRADDY_ORDER, SAMPLE = window.FM_SAMPLE, TODAY = SAMPLE.today;
  var root = document.getElementById('p2');
  var SEED = ST.seed({ sample: SAMPLE, willow: W, braddy: B });
  var DEMO = demoQuote(); SEED.jobs.push(DEMO);
  var store = ST.create({ seed: SEED, storage: ST.browserStorage('fm_phase2_preview') });
  if (!store.job(DEMO.jobCode)) store.addJob(DEMO, 'Sample data');

  /* ---------- users (HANDOFF §23): everyone has full access for now; a Coordinator level can be added later ---------- */
  var ACCESS = { full: 'Full access', coordinator: 'Coordinator' };
  var DEFAULT_USERS = [
    { id: 'kristy', name: 'Kristy Slaughenhaupt', email: 'kslaugh@unbridled.com', access: 'full', canSign: true },
    { id: 'tayler', name: 'Tayler Slaughenhaupt', email: '', access: 'full', canSign: true },
    { id: 'lindsay', name: 'Lindsay Wyss', email: 'lwyss@unbridled.com', access: 'full', canSign: true },
    { id: 'tim', name: 'Tim Slaughenhaupt', email: 'tslaugh@unbridled.com', access: 'full', canSign: true }
  ];
  var USERS_KEY = 'fm_phase2_users', users;
  try { users = JSON.parse(window.localStorage.getItem(USERS_KEY) || 'null'); } catch (e) { users = null; }
  if (!Array.isArray(users) || !users.length) users = JSON.parse(JSON.stringify(DEFAULT_USERS));
  // emails the owner has since given fill in blanks on a list saved earlier in this browser
  users.forEach(function (u) { var d = DEFAULT_USERS.filter(function (x) { return x.id === u.id; })[0]; if (d && !u.email && d.email) u.email = d.email; });
  function saveUsers() { try { window.localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) { /* preview only */ } }
  var ui = { actor: 'lindsay', filter: 'all', q: '', open: {}, viewer: null, pay: null, act: null, period: 'ytd' };
  try { ui.actor = window.localStorage.getItem('fm_phase2_actor') || 'lindsay'; } catch (e) { /* default */ }
  function me() {
    var x = users.filter(function (u) { return u.id === ui.actor; })[0] || users[0];
    return { id: x.id, name: x.name, role: ACCESS[x.access] || x.access, access: x.access };
  }
  window.P2Users = {
    list: function () { return users; },
    signers: function () { return users.filter(function (u) { return u.canSign; }).map(function (u) { return { name: u.name, email: u.email }; }); },
    approvers: function () { return users.filter(function (u) { return u.access === 'full'; }).map(function (u) { return u.name; }); }
  };

  /* A sample quote so the Elevations tab has something to work on (preview only; never migrated).
     Cabinets are the San Luis model from the Willow Creek order, priced on the company defaults. */
  function demoQuote() {
    var K = window.FMContract, m = W.models['San Luis'], code = 'FM-2610-101';
    var lines = m.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost), markupPct: 35 }; });
    var pr = Q.priceHouse({ lines: lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct }; }),
      discountPctOfCost: 12, labor: [{ role: 'Assembly', rateCents: 64000, hours: 1 }], gaPct: 2, taxPct: 7.9 });
    var total = pr.summary.totalCents, plan = [50, 50], amts = K.invoiceAmounts(total, plan), dues = K.defaultDueDates(TODAY, '2026-12-14', plan);
    function I(x) { x.id = code + '-' + Math.random().toString(36).slice(2, 8); return x; }
    var kitchen = { id: 'room-k', name: 'Kitchen', set: 'Sample kitchen and baths', walls: [
      { id: 'wall-sink', name: 'Sink wall', position: 'back', lengthIn: 126, specs: {}, cornerLeft: false, cornerRight: false,
        base: [I({ sku: 'B33-SBW' }), I({ appliance: 'dishwasher' }), I({ sku: 'SB36-SBW' }), I({ sku: 'B33-SBW' })],
        upper: [I({ sku: 'W3342-SBW' }), I({ sku: 'W3342-SBW', gapBefore: 60 })],
        openings: [{ kind: 'window', fromLeft: 60, width: 30, height: 36, fromFloor: 44 }] },
      { id: 'wall-range', name: 'Range wall', position: 'left', lengthIn: 132, specs: {}, cornerLeft: false, cornerRight: true,
        base: [I({ appliance: 'fridge' }), I({ sku: 'B18-SBW' }), I({ appliance: 'range' }), I({ sku: 'B18-SBW' })],
        upper: [I({ sku: 'W362424-SBW' }), I({ sku: 'W3018-SBW', gapBefore: 18 })], openings: [] }] };
    var baths = { id: 'room-b', name: 'Bathrooms', set: 'Sample kitchen and baths', walls: [
      { id: 'wall-hall', name: 'Hall bath', position: 'back', lengthIn: 60, specs: {}, base: [], upper: [], openings: [] }] };
    return { id: code, jobCode: code, customer: 'Sample quote (preview)', projectName: 'Kitchen and baths', kind: 'single', quoteDate: TODAY, deliveryDate: '2026-12-14',
      originalContractCents: total, houses: [], history: [], changeOrders: [], contacts: { signer: 'Sample customer', buyerEmail: '' }, source: { system: 'phase2', sample: true },
      stage: 'quote', installAddress: '', taxCents: pr.summary.taxCents, costCents: pr.internal.costCents, absorbedCents: 0, documents: [], fmSigner: null, esign: { state: 'none' }, contractedOn: null,
      invoices: plan.map(function (pc, i) { return { id: code + '-inv' + (i + 1), label: 'Invoice ' + (i + 1) + ' · ' + pc + '%', role: i === 0 ? 'deposit' : 'progress', changeOrderId: null, dueDate: dues[i], amountCents: amts[i], status: 'open', payments: [] }; }),
      pricing: { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9, assemblyCents: 64000, plan: plan },
      models: [{ name: 'Sample kitchen and baths', qty: 1, lines: lines }],
      elevations: { rooms: [kitchen, baths], sizes: {}, versions: [] } };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $f = FM.fmt;
  function longDate(iso) { if (!iso) return '—'; var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function shortDate(iso) { if (!iso) return '—'; var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function stagePill(s) {
    var cls = s === 'quote' ? 'fmp1-pill--proposed' : s === 'lost' ? 'fmp1-pill--alert' : s === 'complete' ? 'fmp1-pill--good' : 'fmp1-pill--contracted';
    return '<span class="fmp1-pill ' + cls + '">' + esc(BK.STAGE_LABEL[s] || s) + '</span>';
  }
  function route() {
    var h = (location.hash || '#/books/dashboard').replace(/^#\/?/, '').split('/');
    return { area: h[0] || 'books', a: decodeURIComponent(h[1] || ''), b: h[2] || '' };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  /* ---------- helpers on jobs ---------- */
  function balance(j) { var s = FM.contractSummary(j); return s.currentCents - s.paidCents; }
  function nextDue(j) {
    var open = j.invoices.filter(function (i) { return i.status !== 'void' && FM.invoicePaidCents(i) < i.amountCents; })
      .sort(function (a, b) { return (a.dueDate || '9') < (b.dueDate || '9') ? -1 : 1; });
    return open[0] || null;
  }
  function nextStep(j) {
    var dep = j.invoices.filter(function (i) { return i.role === 'deposit'; })[0];
    if (j.stage === 'lost') return '—';
    if (j.stage === 'quote') return 'Send the contract';
    if (j.stage === 'contract_signed') return dep && FM.invoicePaidCents(dep) < dep.amountCents ? 'Collect the deposit' : 'Confirm the deposit';
    if (j.stage === 'deposit_paid') return 'Place the factory order';
    if (j.stage === 'factory_ordered') return 'Record delivery';
    if (j.stage === 'delivered') return balance(j) > 0 ? 'Collect the final payment' : 'Confirm final payment';
    if (j.stage === 'final_paid') return 'Close the job';
    return 'Done';
  }

  /* ---------- shell ---------- */
  function nav(r) {
    var due = BK.depositsDue(store.books(), TODAY), overdue = due.groups[0].items.length, issues = BK.reconcile(store.books()).issueCount;
    function link(hash, label, on, count) {
      return '<a href="' + hash + '"' + (on ? ' aria-current="page"' : '') + '><span>' + label + '</span>' + (count ? '<span class="count" aria-label="' + count + ' need attention">' + count + '</span>' : '') + '</a>';
    }
    return '<aside class="p2-side" aria-label="Project Builder">' +
      '<div class="p2-brand"><span class="fmp1-logo fmp1-logo--tagline" role="img" aria-label="Fremont Makers, making freedom"></span><span class="fmp1-faint p2-small">Project Builder</span></div>' +
      '<a class="p2-newbtn" href="#/new"' + (r.area === 'new' ? ' aria-current="page"' : '') + '><span aria-hidden="true">+</span> New project</a>' +
      '<nav class="p2-nav" aria-label="Projects"><h2>Projects</h2>' +
        link('#/projects', 'All projects', r.area === 'projects' || (r.area === 'job' && r.b !== 'elevations')) + link('#/elevations', 'Elevations', r.area === 'elevations' || (r.area === 'job' && r.b === 'elevations')) + link('#/customers', 'Customers', r.area === 'customers') + link('#/measure', 'Field measure', r.area === 'measure') + '</nav>' +
      '<nav class="p2-nav" aria-label="Company books"><h2>Company books</h2>' +
        link('#/books/dashboard', 'Dashboard', r.area === 'books' && r.a === 'dashboard') +
        link('#/books/pipeline', 'Pipeline', r.a === 'pipeline') +
        link('#/books/deposits', 'Deposits due', r.a === 'deposits', overdue) +
        link('#/books/reconcile', 'Reconcile', r.a === 'reconcile', issues) +
        link('#/books/pnl', 'P&amp;L', r.a === 'pnl') +
        link('#/books/balance', 'Balance sheet', r.a === 'balance') + link('#/books/exports', 'Reports &amp; exports', r.a === 'exports') + '</nav>' +
      '<nav class="p2-nav" aria-label="Company"><h2>Company</h2>' + link('#/users', 'Users', r.area === 'users') + '</nav>' +
      '<div class="p2-side-foot">' + FMTheme.toggleHTML(FMTheme.get(root)) +
        '<label class="p2-fld"><span>Signed in as</span><select class="fmp1-input" data-actor>' +
        users.map(function (u) { return '<option value="' + esc(u.id) + '"' + (u.id === me().id ? ' selected' : '') + '>' + esc(u.name) + ' · ' + esc(ACCESS[u.access] || u.access) + '</option>'; }).join('') +
        '</select></label><button class="fmp1-btn fmp1-btn--quiet" data-reset>Reset sample data</button>' +
        '<span class="fmp1-faint">Preview · sample data · nothing here touches the live tool</span></div></aside>';
  }

  function render() {
    var r = route(), body;
    if (r.area === 'projects') body = viewProjects();
    else if (r.area === 'job') body = viewJob(store.job(r.a), r.b || 'overview');
    else if (r.area === 'users') body = viewUsers();
    else if (r.area === 'elevations') body = window.P2Elev ? window.P2Elev.index(ctx()) : '<p>Elevations are loading…</p>';
    else if (r.area === 'customers') body = window.P2Customers ? (r.a ? window.P2Customers.profile(ctx(), r.a) : window.P2Customers.list(ctx())) : '<p>Customers are loading…</p>';
    else if (r.area === 'measure') body = window.P2Measure ? (r.a ? window.P2Measure.page(ctx(), r.a) : window.P2Measure.list(ctx())) : '<p>Field measure is loading…</p>';
    else if (r.area === 'new') body = window.P2NewProject ? window.P2NewProject.render(ctx()) : '<p>New project is loading…</p>';
    else body = viewBooks(r.a || 'dashboard');
    var notLive = window.FM_CONFIG && window.FM_CONFIG.live ? '' : '<div class="p2-previewbar" role="note"><b>Preview, not the live tool.</b> Sample data, saved only in this browser: nothing here is shared with anyone, backed up, or sent. Don\'t enter real jobs until the server is connected.</div>';
    root.innerHTML = nav(r) + '<main class="p2-main" id="p2-main">' + notLive + body + viewerHTML() + '</main>';
    root.classList.toggle('is-measure', r.area === 'measure');   // on a phone, field measure keeps the menu short
    var vc = root.querySelector('[data-close-viewer]'); if (vc) { vc.focus(); fitViewer(); }
    var f = root.querySelector('[data-autofocus]'); if (f && !vc) f.focus({ preventScroll: true });
    var pf = !vc && (root.querySelector('[data-payform]') || root.querySelector('[data-paidnote]'));
    if (pf && pf.scrollIntoView) pf.scrollIntoView({ block: 'center' });
  }

  /* ---------- All projects ---------- */
  var FILTERS = { all: 'All', quote: 'Open quotes', active: 'In progress', complete: 'Complete', lost: 'Lost' };
  function viewProjects() {
    var q = ui.q.toLowerCase();
    var rows = store.jobs().filter(function (j) {
      var f = ui.filter, ok = f === 'all' || (f === 'quote' && j.stage === 'quote') || (f === 'lost' && j.stage === 'lost') ||
        (f === 'complete' && j.stage === 'complete') || (f === 'active' && ['quote', 'lost', 'complete'].indexOf(j.stage) < 0);
      return ok && (!q || (j.jobCode + ' ' + j.customer + ' ' + j.projectName).toLowerCase().indexOf(q) >= 0);
    }).map(function (j) {
      var s = FM.contractSummary(j), houses = j.houses && j.houses.length > 1, open = ui.open[j.jobCode];
      var row = '<tr><td><span class="fmp1-code">' + esc(j.jobCode) + '</span></td><td><b>' + esc(j.customer) + '</b><br><span class="fmp1-faint p2-small">' + esc(houses ? j.houses.length + ' houses · builder order' : (j.projectName || '—')) + '</span>' +
        (houses ? '<br><button class="p2-tog" data-houses="' + esc(j.jobCode) + '" aria-expanded="' + !!open + '">' + (open ? '▾ Hide houses' : '▸ Show houses') + '</button>' : '') + '</td>' +
        '<td>' + stagePill(j.stage) + '</td><td class="r">' + $f(s.currentCents) + '</td><td class="r">' + (j.stage === 'quote' || j.stage === 'lost' ? '—' : $f(balance(j))) + '</td>' +
        '<td class="p2-small">' + esc(nextStep(j)) + '</td><td class="r p2-act"><a class="fmp1-btn" href="#/job/' + encodeURIComponent(j.jobCode) + '/overview">Open</a></td></tr>';
      if (houses && open) row += j.houses.map(function (h) { return '<tr class="p2-houses"><td class="fmp1-code">' + esc(h.jobCode) + '</td><td colspan="2">' + esc(h.name) + ' · ' + esc(h.color) + '</td><td class="r">' + $f(h.totalCents) + '</td><td colspan="3"></td></tr>'; }).join('');
      return row;
    }).join('');
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">All projects</h1><p class="p2-sub">Every job, its stage, what\'s owed and the next step. Builder orders keep their houses folded inside the job.</p></div>' +
      '<a class="fmp1-btn fmp1-btn--primary" href="#/new">New project</a></div>' +
      '<div class="p2-row"><input class="fmp1-input p2-search" type="search" placeholder="Search customer, project or job code" aria-label="Search projects" data-q value="' + esc(ui.q) + '">' +
      '<div class="p2-chips" role="group" aria-label="Filter">' + Object.keys(FILTERS).map(function (k) { return '<button class="fmp1-btn" data-filter="' + k + '" aria-pressed="' + (ui.filter === k) + '">' + FILTERS[k] + '</button>'; }).join('') + '</div></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>Job</th><th>Customer</th><th>Stage</th><th class="r">Contract</th><th class="r">Balance</th><th>Next step</th><th><span class="fmp1-faint">Open</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="p2-empty">No projects match.</td></tr>') + '</tbody></table></div>';
  }

  /* ---------- job page ---------- */
  var TABS = { overview: 'Overview', cabinets: 'Cabinets', elevations: 'Elevations', changes: 'Change orders', contract: 'Contract', invoices: 'Invoices', documents: 'Documents', activity: 'Activity' };
  function viewJob(j, tab) {
    if (!j) return '<h1 class="fmp1-h p2-h1">Project not found</h1><a class="fmp1-btn" href="#/projects">Back to all projects</a>';
    var s = FM.contractSummary(j), nd = nextDue(j), idx = FM.STAGES.map(function (x) { return x.key; }).indexOf(j.stage);
    var stages = '<div class="fmp1-stages" role="list" aria-label="Stage">' + FM.STAGES.map(function (x, i) {
      return '<div role="listitem" class="fmp1-stage' + (j.stage === 'lost' ? '' : i < idx || (i === idx && j.stage === 'complete') ? ' is-done' : i === idx ? ' is-now' : '') + '"><i></i><span>' + esc(x.label) + '</span></div>';
    }).join('') + '</div>';
    var acts = (j.stage === 'quote' ? '<a class="fmp1-btn fmp1-btn--primary" href="#/job/' + encodeURIComponent(j.jobCode) + '/contract">Send the contract</a>' : '') + FM.availableActions(j).filter(function (a) { return a.id !== 'sign'; }).map(function (a) {
      return '<button class="fmp1-btn' + (a.tone === 'primary' ? ' fmp1-btn--primary' : ' fmp1-btn--quiet') + '" data-act="' + a.id + '"' + (a.blockedReason ? ' aria-describedby="blk-' + a.id + '"' : '') + '>' + esc(a.label) + '</button>' +
        (a.blockedReason ? '<span class="p2-small fmp1-faint" id="blk-' + a.id + '">' + esc(a.blockedReason) + '</span>' : '');
    }).join('');
    var form = '';
    if (ui.act && ui.act.job === j.jobCode) {
      var def = FM.availableActions(j).filter(function (a) { return a.id === ui.act.id; })[0];
      if (def) form = '<div class="p2-form"><b>' + esc(def.label) + '</b>' + def.fields.map(function (f) {
        return '<label class="p2-fld"><span>' + (f === 'date' ? 'Date' : 'Reason') + '</span><input class="fmp1-input" data-actfield="' + f + '" ' + (f === 'date' ? 'type="date" value="' + TODAY + '" max="' + TODAY + '"' : 'type="text"') + (f !== 'date' ? ' data-autofocus' : '') + '></label>';
      }).join('') + '<button class="fmp1-btn fmp1-btn--primary" data-actsave>Save</button><button class="fmp1-btn fmp1-btn--quiet" data-actcancel>Cancel</button>' +
        (ui.act.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(ui.act.error) + '</span>' : '') + '</div>';
    }
    var head = '<div class="fmp1-card p2-jobhead"><div class="p2-between"><div><span class="fmp1-code">' + esc(j.jobCode) + '</span><h1 class="fmp1-h p2-h1">' + esc(j.customer) + '</h1>' +
      '<span class="fmp1-muted">' + esc(j.projectName || '') + (j.quoteDate ? ' · quoted ' + longDate(j.quoteDate) : '') + (j.deliveryDate ? ' · delivery ' + longDate(j.deliveryDate) + ' (estimate)' : '') + '</span></div>' + stagePill(j.stage) + '</div>' +
      (j.stage !== 'lost' ? stages : '') +
      (j.stage === 'quote' || j.stage === 'lost' ? '<div class="fmp1-money"><div><span class="k">' + (j.stage === 'lost' ? 'Quoted (lost)' : 'Quote total') + '</span><span class="v">' + $f(s.currentCents) + '</span></div></div>' :
      '<div class="fmp1-money"><div><span class="k">Contract</span><span class="v">' + $f(s.currentCents) + '</span>' + (s.changeOrderCount ? '<span class="p2-small fmp1-faint">incl. ' + s.changeOrderCount + ' change order' + (s.changeOrderCount > 1 ? 's' : '') + '</span>' : '') + '</div>' +
        '<div><span class="k">Paid</span><span class="v">' + $f(s.paidCents) + '</span></div><div><span class="k">Balance</span><span class="v">' + $f(s.balanceCents) + '</span></div>' +
        '<div><span class="k">Next due</span><span class="v">' + (nd ? $f(nd.amountCents - FM.invoicePaidCents(nd)) : '—') + '</span>' + (nd ? '<span class="p2-small fmp1-faint">' + esc(nd.label) + ' · ' + longDate(nd.dueDate) + '</span>' : '') + '</div></div>') +
      '<div class="p2-row">' + acts + '<button class="fmp1-btn fmp1-btn--quiet" data-cutpljob title="Save the homes, cabinets and drawings of this project as a template on its customer">Save as template</button><button class="fmp1-btn fmp1-btn--quiet" data-dup title="Start a new project from this one: customer, cabinets, pricing and drawings">Duplicate project</button></div>' +
      (window.P2Flows && window.P2Flows.dupConfirm ? window.P2Flows.dupConfirm(ctx(), j) : '') + form + '</div>';
    var tabs = '<nav class="p2-tabs" aria-label="Project sections">' + Object.keys(TABS).map(function (k) {
      return '<a href="#/job/' + encodeURIComponent(j.jobCode) + '/' + k + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + TABS[k] + '</a>';
    }).join('') + '</nav>';
    var bodyFn = { overview: tabOverview, cabinets: tabCabinets, elevations: tabElevations, changes: tabChanges, contract: tabContract, invoices: tabInvoices, documents: tabDocuments, activity: tabActivity }[tab] || tabOverview;
    return head + tabs + bodyFn(j);
  }

  function tabOverview(j) {
    var warn = FM.jobWarnings(j).filter(function (w) { return !((j.stage === 'quote' || j.stage === 'lost') && w.key === 'billing'); }).map(function (w) { return '<li><span>' + esc(w.text) + '</span></li>'; }).join('');
    var p = j.pricing;
    var pricing = p ? '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">This job\'s pricing</span><ul class="p2-list">' +
      (p.markupPct != null ? '<li><span>Markup</span><b>' + p.markupPct + '%</b></li>' : '<li><span>Markup</span><b>' + esc(p.note || 'Per line') + '</b></li>') +
      '<li><span>Mfr. discount (of cost)</span><b>' + p.discountPctOfCost + '%</b></li><li><span>G&amp;A</span><b>' + p.gaPct + '%</b></li><li><span>Sales tax (product)</span><b>' + p.taxPct + '%</b></li>' +
      (p.assemblyHours != null ? '<li><span>Assembly (per home)</span><b>' + (p.assemblyHours ? p.assemblyHours + ' h × ' + $f(p.assemblyRateCents) + ' = ' + $f(p.assemblyCents) : 'None') + '</b></li>' :
        p.assemblyCents != null ? '<li><span>Assembly (per home)</span><b>' + $f(p.assemblyCents) + ' flat</b></li>' : '') +
      (p.plan && window.P2Flows ? '<li><span>Payment plan</span><b>' + window.P2Flows.planStages(p).map(function (st) { return esc(st.name) + ' ' + st.pct + '%'; }).join(' · ') + '</b></li>' : '') + '</ul><p class="p2-note">Set on this job, never per customer.</p></div>' : '';
    var log = store.log(j.jobCode).slice(0, 5).map(function (e) { return '<li><span>' + esc(e.text) + '</span><span class="fmp1-faint p2-small">' + esc(e.by) + '</span></li>'; }).join('');
    return '<div class="p2-grid"><div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Needs attention</span>' + (warn ? '<ul class="p2-list">' + warn + '</ul>' : '<p class="p2-ok">Nothing on this job needs attention.</p>') + '</div>' +
      pricing + '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Recent activity</span>' + (log ? '<ul class="p2-list">' + log + '</ul>' : '<p class="p2-empty">No activity recorded in this preview yet.</p>') + '</div></div>';
  }

  function tabCabinets(j) {
    if (W && j.jobCode === W.jobCode) {
      return '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>House</th><th>Model · color</th><th class="r">Lines</th><th class="r">Signed total</th><th></th></tr></thead><tbody>' +
        j.houses.map(function (h) {
          var open = ui.open['h:' + h.jobCode], m = W.models[h.model];
          var row = '<tr><td><span class="fmp1-code">' + esc(h.jobCode) + '</span><br>' + esc(h.name) + '</td><td>' + esc(h.model) + '<br><span class="fmp1-faint p2-small">' + esc(h.color) + '</span></td><td class="r">' + m.lines.length + '</td><td class="r">' + $f(h.totalCents) + '</td>' +
            '<td class="r p2-act"><button class="p2-tog" data-houses="h:' + esc(h.jobCode) + '" aria-expanded="' + !!open + '">' + (open ? '▾ Hide SKUs' : '▸ Show SKUs') + '</button></td></tr>';
          if (open) row += '<tr class="p2-houses"><td colspan="5">' + skuTable(m.lines, null) + '</td></tr>';
          return row;
        }).join('') + '</tbody></table></div><p class="p2-note">The change order from Oct 23 adds cabinets across several houses; its SKUs come in through the change order flow.</p>';
    }
    if (B && j.jobCode === B.jobCode) {
      var a = B.model.assembly;
      return '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">' + B.model.lines.length + ' lines · ' + esc(B.color) + '</span><span class="p2-small fmp1-faint">Assembly $' + a.rate.toFixed(2) + ' × ' + a.hours + ' h = ' + $f(Math.round(a.rate * 100 * a.hours)) + '</span></div>' +
        skuTable(B.model.lines, j.changeOrders) + '</div>';
    }
    if (j.models && j.models.length) return j.models.map(function (m) { return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">' + esc(m.name) + (m.qty > 1 ? ' × ' + m.qty + ' houses' : '') + ' · ' + m.lines.length + ' lines</span>' + skuTable(m.lines, j.changeOrders) + '</div>'; }).join('');
    return '<div class="fmp1-card p2-pad"><p class="p2-empty">No cabinets on this job yet.</p></div>';
  }
  function skuTable(lines, cos) {
    var cost = 0, sell = 0;
    var rows = lines.map(function (l) {
      var uc = l.unitCostCents != null ? l.unitCostCents : FM.toCents(l.unitCost), lc = uc * l.qty, s = l.sellTotal != null ? FM.toCents(l.sellTotal) : Math.round(uc * (100 + l.markupPct) / 100) * l.qty;
      if (!l.noCharge) cost += lc; sell += l.noCharge ? 0 : s;
      return '<tr' + (l.markupPct === 0 && !l.noCharge ? ' class="pv-atcost"' : '') + '><td class="fmp1-code">' + esc(l.sku) + '</td><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(uc) + '</td><td class="r">' + $f(lc) + '</td>' +
        '<td class="r">' + (l.noCharge ? '<span class="fmp1-pill fmp1-pill--good">No charge</span>' : l.markupPct + '%' + (l.markupPct === 0 ? ' <span class="fmp1-pill fmp1-pill--alert">at cost</span>' : '')) + '</td><td class="r"><b>' + (l.noCharge ? '—' : $f(s)) + '</b></td></tr>';
    }).join('');
    var removed = (cos || []).map(function (c) { return (c.removed || []).map(function (r) {
      return '<tr class="pv-removed"><td class="fmp1-code">' + esc(r.sku) + '</td><td>' + esc(r.desc) + '</td><td class="r">' + r.qty + ' → 0</td><td colspan="4" class="fmp1-faint">Removed by change order ' + c.number + ' (' + longDate(c.date) + ')</td></tr>'; }).join(''); }).join('');
    return '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Cost</th><th class="r">Markup</th><th class="r">Sell</th></tr></thead><tbody>' + rows +
      '<tr class="is-total"><td colspan="4">Charged lines</td><td class="r">' + $f(cost) + '</td><td></td><td class="r">' + $f(sell) + '</td></tr>' + removed + '</tbody></table></div>';
  }

  function tabChanges(j) {
    if (window.P2Flows && window.P2Flows.changes) return window.P2Flows.changes(ctx(), j);
    return '<div class="fmp1-card p2-pad"><p class="p2-empty">Change orders are loading…</p></div>';
  }
  function tabElevations(j) { return window.P2Elev ? window.P2Elev.tab(ctx(), j) : '<div class="fmp1-card p2-pad"><p class="p2-empty">Elevations are loading…</p></div>'; }
  function tabContract(j) {
    if (window.P2Flows && window.P2Flows.contract) return (window.P2Elev ? window.P2Elev.contractNote(ctx(), j) : '') + window.P2Flows.contract(ctx(), j);
    return '<div class="fmp1-card p2-pad"><p class="p2-empty">Contract is loading…</p></div>';
  }

  function tabInvoices(j) {
    var live = j.invoices.filter(function (i) { return i.status !== 'void'; });
    var rows = live.map(function (inv) {
      var st = FM.invoiceState(inv, TODAY), paidC = FM.invoicePaidCents(inv), share = FM.invoicePercent(inv, j), pays = (inv.payments || []).map(function (p) {
        return longDate(p.date) + ' · ' + $f(p.amountCents) + (p.reference ? ' · ' + esc(p.reference) : ' · <span style="color:var(--fmp1-alert-ink)">no check #</span>');
      }).join('<br>');
      var tone = st.key === 'paid' ? 'fmp1-pill--good' : st.key === 'overdue' ? 'fmp1-pill--alert' : 'fmp1-pill--proposed';
      var row = '<tr><td><button class="p2-linkbtn" data-open-inv="' + esc(inv.id) + '">' + esc(inv.label) + '</button><br><span class="fmp1-faint p2-small">Due ' + longDate(inv.dueDate) + '</span></td>' +
        '<td><span class="fmp1-pill ' + tone + '">' + esc(st.label) + '</span></td><td class="r">' + (inv.role === 'change_order' ? '<span class="fmp1-faint p2-small">change order</span>' : share.actual.toFixed(2) + '%') + '</td>' +
        '<td class="r"><b>' + $f(inv.amountCents) + '</b></td><td class="p2-small">' + (pays || '<span class="fmp1-faint">None yet</span>') +
        (paidC < inv.amountCents && !(ui.pay && ui.pay.inv === inv.id) ? '<div style="margin-top:6px"><button class="fmp1-btn" data-pay="' + esc(inv.id) + '">Record payment</button></div>' : '') + '</td></tr>';
      if (ui.pay && ui.pay.inv === inv.id) row += '<tr><td colspan="5">' + payForm(inv) + '</td></tr>';
      return row;
    }).join('');
    var s = FM.contractSummary(j);
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Invoices · ' + live.length + ' <span class="p2-small fmp1-faint" style="letter-spacing:0;text-transform:none;font-weight:400">· click an invoice to open it</span></span>' +
      (ui.paidNote ? '<div class="fmp1-note fmp1-note--good p2-small" role="status" data-paidnote>✓ ' + esc(ui.paidNote) + '</div>' : '') +
      '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table p2-invtable"><thead><tr><th>Invoice</th><th>Status</th><th class="r">Share</th><th class="r">Amount</th><th>Payments</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (s.invoicesMatchContract ? '<div class="fmp1-note fmp1-note--good p2-small">✓ Invoices add up to the contract total of ' + $f(s.currentCents) + '.</div>'
        : '<div class="fmp1-note fmp1-note--alert p2-small">Invoices total ' + $f(s.invoicedCents) + '; the contract is ' + $f(s.currentCents) + '.</div>') +
      docRows(j, { kind: '__none', packetSub: 'All invoices together, with the payment schedule and quote' }) + '</div>';
  }
  function payForm(inv) {
    var owed = inv.amountCents - FM.invoicePaidCents(inv), v = ui.pay.values || {};
    return '<div data-payform class="p2-form" role="group" aria-label="Record a payment on ' + esc(inv.label) + '">' +
      '<label class="p2-fld"><span>Amount</span><input class="fmp1-input" inputmode="decimal" data-payf="amount" value="' + esc(v.amount != null ? v.amount : (owed / 100).toFixed(2)) + '" data-autofocus></label>' +
      '<label class="p2-fld"><span>Received</span><input class="fmp1-input" type="date" max="' + TODAY + '" data-payf="date" value="' + esc(v.date || TODAY) + '"></label>' +
      '<label class="p2-fld"><span>Method</span><select class="fmp1-input" data-payf="method">' + Object.keys(ST.METHODS).map(function (k) { return '<option value="' + k + '"' + ((v.method || 'check') === k ? ' selected' : '') + '>' + ST.METHODS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-fld"><span>Check # / reference</span><input class="fmp1-input" data-payf="reference" value="' + esc(v.reference || '') + '"></label>' +
      '<button class="fmp1-btn fmp1-btn--primary" data-paysave>Save payment</button><button class="fmp1-btn fmp1-btn--quiet" data-paycancel>Cancel</button>' +
      (ui.pay.errors ? '<ul class="p2-errs p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + ui.pay.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
  }

  function tabDocuments(j) {
    var docs = j.documents || [];
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Documents · ' + (docs.length + (j.stage !== 'lost' ? 1 : 0)) + '</span>' + docRows(j) +
      (docs.length ? '' : '<p class="p2-small fmp1-faint">No signed files attached yet. Signed contracts and wet-signed uploads appear here.</p>') + '</div>';
  }
  function tabActivity(j) {
    var log = store.log(j.jobCode);
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Activity · who did what</span>' + (log.length ? '<ul class="p2-list">' + log.map(function (e) {
      return '<li><span>' + esc(e.text) + '</span><span class="fmp1-faint p2-small">' + esc(e.by) + ' · ' + esc(String(e.at).slice(0, 16).replace('T', ' ')) + '</span></li>'; }).join('') + '</ul>'
      : '<p class="p2-empty">Nothing recorded in this preview yet. Payments, stage changes, change orders and contracts all land here.</p>') + '</div>';
  }

  /* ---------- Users ---------- */
  function viewUsers() {
    var mine = me().id, fulls = users.filter(function (u) { return u.access === 'full'; }).length;
    var rows = users.map(function (u) {
      var lastFull = u.access === 'full' && fulls === 1;
      return '<tr><td><b>' + esc(u.name) + '</b>' + (u.id === mine ? ' <span class="fmp1-pill">you</span>' : '') + '</td>' +
        '<td><input class="fmp1-input" type="email" style="width:100%;min-width:170px" placeholder="name@fremontmakers.com" aria-label="Email for ' + esc(u.name) + '" data-userf="' + esc(u.id) + ':email" value="' + esc(u.email) + '"></td>' +
        '<td><select class="fmp1-input" aria-label="Access for ' + esc(u.name) + '" data-userf="' + esc(u.id) + ':access"><option value="full"' + (u.access === 'full' ? ' selected' : '') + '>Full access</option><option value="coordinator" disabled>Coordinator (not set up yet)</option></select></td>' +
        '<td><label class="p2-row p2-small"><input type="checkbox" data-userf="' + esc(u.id) + ':canSign"' + (u.canSign ? ' checked' : '') + '> Signs for Fremont Makers</label>' +
          (u.canSign && !u.email ? '<span class="p2-small" style="color:var(--fmp1-alert-ink)">Needs an email to sign</span>' : '') + '</td>' +
        '<td class="r p2-act">' + (u.id === mine || lastFull ? '' : '<button class="fmp1-btn fmp1-btn--quiet" data-userrm="' + esc(u.id) + '">Remove</button>') + '</td></tr>';
    }).join('');
    return head('Users', 'Who can sign in to the Project Builder and what they can do. Every change anyone makes is logged with their name.') +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table p2-users"><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Contracts</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Add a user</span><div class="p2-form">' +
        '<label class="p2-fld"><span>Name</span><input class="fmp1-input" data-newuser="name"></label><label class="p2-fld"><span>Email</span><input class="fmp1-input" type="email" data-newuser="email"></label>' +
        '<label class="p2-fld"><span>Access</span><select class="fmp1-input" data-newuser="access"><option value="full">Full access</option><option value="coordinator" disabled>Coordinator (not set up yet)</option></select></label>' +
        '<button class="fmp1-btn fmp1-btn--primary" data-useradd>Add user</button></div>' + (ui.userErr ? '<p class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(ui.userErr) + '</p>' : '') + '</div>' +
      '<div class="p2-grid"><div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Full access</span><p class="p2-small">Everything: create and price projects, draw elevations, send, void or override a contract, reopen a lost project, approve courtesy change orders, record payments, and manage users.</p></div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Coordinator · later</span><p class="p2-small fmp1-muted">Not set up yet. When it\'s needed, it can be added here with its own limits (for example: quotes, elevations and payments, but no voiding contracts or managing users).</p></div></div>';
  }
  function usersClick(t) {
    if (t.dataset.useradd != null) {
      var v = {}; [].forEach.call(root.querySelectorAll('[data-newuser]'), function (el) { v[el.dataset.newuser] = el.value.trim(); });
      if (!v.name) { ui.userErr = 'Enter a name.'; return render(); }
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { ui.userErr = 'That email doesn\'t look right.'; return render(); }
      if (users.some(function (u) { return u.name.toLowerCase() === v.name.toLowerCase(); })) { ui.userErr = v.name + ' is already a user.'; return render(); }
      users.push({ id: 'u' + Date.now().toString(36), name: v.name, email: v.email, access: v.access || 'full', canSign: false }); ui.userErr = null; saveUsers(); return render();
    }
    if (t.dataset.userrm) { users = users.filter(function (u) { return u.id !== t.dataset.userrm; }); saveUsers(); return render(); }
  }
  function usersChange(el) {
    var p = el.dataset.userf.split(':'), u = users.filter(function (x) { return x.id === p[0]; })[0]; if (!u) return;
    if (p[1] === 'email') {
      var em = el.value.trim();
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { ui.userErr = 'That email for ' + u.name + ' doesn\'t look right.'; return render(); }
      u.email = em; ui.userErr = null;
    } else if (p[1] === 'canSign') u.canSign = el.checked;
    else if (p[1] === 'access') u.access = el.value;
    saveUsers(); render();
  }

  /* ---------- Company books ---------- */
  function viewBooks(key) {
    var jobs = store.books();
    if (key === 'pipeline') return booksPipeline(jobs);
    if (key === 'deposits') return booksDeposits(jobs);
    if (key === 'reconcile') return booksReconcile(jobs);
    if (key === 'pnl') return booksPnl(jobs);
    if (key === 'balance') return booksBalance(jobs);
    if (key === 'exports') return window.P2Reports ? window.P2Reports.render(ctx()) : '<p>Reports are loading…</p>';
    return booksDashboard(jobs);
  }
  function jobLink(code, text) { return '<a href="#/job/' + encodeURIComponent(code) + '/overview">' + esc(text) + '</a>'; }
  function head(title, sub) { return '<div class="p2-head"><h1 class="fmp1-h p2-h1">' + title + '</h1><p class="p2-sub">' + sub + '</p></div>'; }

  function booksDashboard(jobs) {
    var d = BK.dashboard(jobs, TODAY);
    var kpis = '<div class="p2-kpis">' + d.kpis.map(function (k) {
      return '<div class="fmp1-card p2-kpi"><span class="k">' + esc(k.label) + '</span><span class="v">' + (k.pct !== undefined ? k.pct + '%' : $f(k.cents)) + '</span>' + (k.note ? '<span class="p2-small fmp1-faint">' + esc(k.note) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
    // a task list: status label, what and who, the amount, and one button that goes where it gets fixed (no sentences as links)
    var att = d.attention.length ? '<ul class="p2-tasks">' + d.attention.map(function (a) {
      var href = '#/job/' + encodeURIComponent(a.jobCode) + '/' + (a.tab || 'overview');
      return '<li class="p2-task is-' + (a.tone === 'alert' ? 'alert' : 'check') + '"><span class="p2-task-status">' + esc(a.status || (a.tone === 'alert' ? 'Overdue' : 'Check')) + '</span>' +
        '<span class="p2-task-main"><b>' + esc(a.title || a.text) + '</b><span class="p2-task-who">' + esc(a.customer || '') + (a.jobCode ? ' · ' + esc(a.jobCode) : '') + '</span>' + (a.detail ? '<span class="p2-task-detail">' + esc(a.detail) + '</span>' : '') + '</span>' +
        (a.amountCents ? '<span class="p2-task-amt">' + $f(a.amountCents) + '</span>' : '<span></span>') +
        '<a class="fmp1-btn fmp1-btn--primary p2-task-btn" href="' + href + '">' + esc(a.action || 'Open') + '</a></li>'; }).join('') + '</ul>' : '<p class="p2-ok">Nothing needs attention.</p>';
    var del = d.deliveries.length ? '<ul class="p2-list">' + d.deliveries.map(function (x) {
      return '<li><span>' + jobLink(x.jobCode, x.customer) + '<br><span class="fmp1-faint p2-small">' + esc(x.project || '') + '</span></span><span class="r">' + longDate(x.deliveryDate) + '<br><span class="p2-small fmp1-faint">' + $f(x.balanceCents) + ' still owed</span></span></li>'; }).join('') + '</ul>' : '<p class="p2-empty">No deliveries in the next 30 days.</p>';
    return head('Dashboard', 'Money in, money owed, and what needs doing. Sample data as of ' + longDate(TODAY) + '.') + kpis +
      '<div class="p2-grid"><div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Needs attention · ' + d.attention.length + '</span>' + att + '</div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Deliveries in the next 30 days (estimates)</span>' + del + '</div></div>';
  }

  function booksPipeline(jobs) {
    var p = BK.pipelineGroups(jobs, TODAY), g = {}; p.groups.forEach(function (x) { g[x.key] = x; });
    var active = [g.quotes, g.production, g.finishing], totalActive = active.reduce(function (t, x) { return t + x.cents; }, 0);
    var tone = { quotes: 'p2-seg-quotes', production: 'p2-seg-prod', finishing: 'p2-seg-finish' };
    function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    var summary = '<div class="p2-kpis">' +
      '<div class="fmp1-card p2-kpi"><span class="k"><i class="p2-key p2-seg-quotes" aria-hidden="true"></i>Quotes out</span><span class="v">' + $f(g.quotes.cents) + '</span><span class="p2-small fmp1-faint">' + plural(g.quotes.count, 'quote') + (p.staleQuotes ? ' · <b style="color:var(--fmp1-alert-ink)">' + p.staleQuotes + ' need a follow-up</b>' : '') + '</span></div>' +
      '<div class="fmp1-card p2-kpi"><span class="k"><i class="p2-key p2-seg-prod" aria-hidden="true"></i>In production</span><span class="v">' + $f(g.production.cents) + '</span><span class="p2-small fmp1-faint">' + plural(g.production.count, 'job') + ' · ' + $f(g.production.owedCents) + ' still owed</span></div>' +
      '<div class="fmp1-card p2-kpi"><span class="k"><i class="p2-key p2-seg-finish" aria-hidden="true"></i>Finishing up</span><span class="v">' + $f(g.finishing.cents) + '</span><span class="p2-small fmp1-faint">' + plural(g.finishing.count, 'job') + ' · ' + $f(g.finishing.owedCents) + ' still owed</span></div>' +
      '<div class="fmp1-card p2-kpi"><span class="k">Win rate · 6 months</span><span class="v">' + p.winRatePct + '%</span><span class="p2-small fmp1-faint">' + plural(p.decidedCount, 'quote') + ' decided · ' + g.complete.count + ' complete · ' + g.lost.count + ' lost</span></div></div>';
    var bar = totalActive ? '<div class="p2-flowbar" role="img" aria-label="Open work by value: quotes ' + $f(g.quotes.cents) + ', in production ' + $f(g.production.cents) + ', finishing up ' + $f(g.finishing.cents) + '">' +
      active.filter(function (x) { return x.cents > 0; }).map(function (x) { return '<span class="' + tone[x.key] + '" style="flex:' + x.cents + '"></span>'; }).join('') + '</div>' : '';
    function meter(step) {
      if (step < 0) return '';
      var dots = ''; for (var i = 0; i < 7; i++) dots += '<i class="' + (i < step ? 'done' : i === step ? 'now' : '') + '"></i>';
      return '<span class="p2-meter" aria-hidden="true">' + dots + '</span>';
    }
    function table(x) {
      var quotes = x.key === 'quotes', closed = x.key === 'complete' || x.key === 'lost';
      if (!x.rows.length) return '<p class="p2-empty">' + (quotes ? 'No quotes out. <a href="#/new">Start a new project</a>.' : 'Nothing here right now.') + '</p>';
      return '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table p2-pipe"><thead><tr><th>Job</th><th>Stage</th><th class="r">Value</th>' +
        (quotes || closed ? '' : '<th>Collected · still owed</th>') + '<th>' + (quotes ? 'Quoted' : closed ? 'Date' : 'Delivery') + '</th>' + (closed ? '' : '<th>Next step</th>') + '</tr></thead><tbody>' +
        x.rows.map(function (r) {
          var job = store.job(r.jobCode), when;
          if (quotes) when = r.since ? (r.ageDays === 0 ? 'Today' : r.ageDays + ' day' + (r.ageDays === 1 ? '' : 's') + ' ago') + (r.staleQuote ? ' <span class="fmp1-pill fmp1-pill--alert">follow up</span>' : '') : '—';
          else if (closed) when = longDate(r.since);
          else when = r.deliveryDate ? shortDate(r.deliveryDate) + ' <span class="p2-small fmp1-faint">(est.)</span>' : '<span class="fmp1-faint">Not set</span>';
          var proj = job && job.houses && job.houses.length > 1 ? job.houses.length + ' houses' : (r.project || '');
          return '<tr><td><a href="#/job/' + encodeURIComponent(r.jobCode) + '/overview"><b>' + esc(r.customer) + '</b></a><br><span class="p2-small fmp1-faint">' + esc(proj) + ' · ' + esc(r.jobCode) + '</span></td>' +
            '<td>' + esc(r.stageLabel) + '<br>' + meter(r.stage === 'lost' ? -1 : r.stageStep) + '</td><td class="r"><b>' + $f(r.cents) + '</b></td>' +
            (quotes || closed ? '' : '<td><span class="p2-collect" aria-hidden="true"><i style="width:' + Math.min(100, r.collectedPct) + '%"></i></span><span class="p2-small">' + r.collectedPct + '%</span><br><span class="p2-small fmp1-faint">' + $f(r.owedCents) + ' owed</span></td>') +
            '<td>' + when + '</td>' + (closed ? '' : '<td class="p2-small">' + esc(job ? nextStep(job) : '') + '</td>') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    function section(x, open) {
      var headTxt = '<span class="p2-row"><i class="p2-key ' + (tone[x.key] || '') + '" aria-hidden="true"></i><b>' + esc(x.label) + '</b><span class="fmp1-faint">' + x.count + '</span></span><span class="p2-row"><b>' + $f(x.cents) + '</b>' + (x.owedCents ? '<span class="p2-small fmp1-faint">' + $f(x.owedCents) + ' owed</span>' : '') + '</span>';
      if (open) return '<section class="fmp1-card p2-pad" aria-label="' + esc(x.label) + '"><div class="p2-between">' + headTxt + '</div>' + table(x) + '</section>';
      return '<details class="fmp1-card p2-pad p2-closed"><summary class="p2-between">' + headTxt + '</summary>' + table(x) + '</details>';
    }
    return '<div class="p2-between">' + head('Pipeline', 'Where every job stands and what it\'s worth: quotes waiting on a yes, jobs in production, and jobs being finished.') + '<a class="fmp1-btn fmp1-btn--primary" href="#/new">New project</a></div>' +
      summary + bar + section(g.quotes, true) + section(g.production, true) + section(g.finishing, true) + section(g.complete, false) + section(g.lost, false);
  }
  function booksDeposits(jobs) {
    var d = BK.depositsDue(jobs, TODAY);
    var groups = d.groups.filter(function (g) { return g.items.length; }).map(function (g) {
      return '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">' + esc(g.name) + ' · ' + g.items.length + '</span><b>' + $f(g.cents) + '</b></div><ul class="p2-list">' + g.items.map(function (x) {
        return '<li><span>' + jobLink(x.jobCode, x.customer) + ' · ' + esc(x.label) + '<br><span class="fmp1-faint p2-small">' + (x.dueDate ? 'Due ' + longDate(x.dueDate) + (x.daysUntil < 0 ? ' · ' + (-x.daysUntil) + (x.daysUntil === -1 ? ' day late' : ' days late') : ' · ' + (x.daysUntil === 0 ? 'today' : 'in ' + x.daysUntil + (x.daysUntil === 1 ? ' day' : ' days'))) : 'No due date') +
          (x.holdsFactoryOrder ? ' · <b style="color:var(--fmp1-alert-ink)">factory order waits on this</b>' : '') + (x.partial ? ' · partly paid' : '') + '</span></span>' +
          '<span class="p2-row"><b>' + $f(x.outstandingCents) + '</b><button class="fmp1-btn" data-gopay="' + esc(x.jobCode) + '" data-inv="' + esc(x.invoiceId) + '">Record payment</button></span></li>';
      }).join('') + '</ul></div>';
    }).join('');
    return head('Deposits due', 'Every unpaid invoice, soonest first: ' + d.count + ' invoices, ' + $f(d.totalCents) + ' in all. Deposits come first because the factory order waits on them.') +
      (groups || '<div class="fmp1-card p2-pad"><p class="p2-ok">Every invoice is paid.</p></div>');
  }

  function booksReconcile(jobs) {
    var r = BK.reconcile(jobs);
    var rows = r.rows.map(function (x) {
      return '<tr><td>' + jobLink(x.jobCode, x.customer) + '<br><span class="fmp1-faint p2-small">' + esc(x.jobCode) + '</span></td><td class="r">' + $f(x.contractCents) + '</td><td class="r">' + $f(x.invoicedCents) + '</td><td class="r">' + $f(x.paidCents) + '</td>' +
        '<td>' + (x.clean ? '<span class="p2-ok">✓ Checks out</span>' : '<ul class="p2-errs p2-small">' + x.issues.map(function (i) { return '<li>' + esc(i.text) + '</li>'; }).join('') + '</ul>') + '</td></tr>';
    }).join('');
    return head('Reconcile', 'For each signed job: do the invoices add up to the contract, are payments recorded with a check number, and is the supplier cost on file? ' + r.cleanCount + ' of ' + r.rows.length + ' jobs check out.') +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>Job</th><th class="r">Contract</th><th class="r">Invoiced</th><th class="r">Paid</th><th>Checks</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="p2-note">Bank deposits aren\'t in the Project Builder. Match the payments listed on each job against the bank statement in your accounting system.</p>';
  }

  var PERIODS = { month: 'This month', lastmonth: 'Last month', quarter: 'This quarter', ytd: 'Year to date', last12: 'Last 12 months' };
  function periodRange(k) {
    var y = +TODAY.slice(0, 4), m = +TODAY.slice(5, 7);
    function iso(yy, mm, dd) { return yy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2); }
    if (k === 'month') return [iso(y, m, 1), TODAY];
    if (k === 'lastmonth') { var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return [iso(py, pm, 1), iso(py, pm, new Date(Date.UTC(py, pm, 0)).getUTCDate())]; }
    if (k === 'quarter') return [iso(y, Math.floor((m - 1) / 3) * 3 + 1, 1), TODAY];
    if (k === 'last12') return [iso(y - 1, m, +TODAY.slice(8, 10)), TODAY];
    return [iso(y, 1, 1), TODAY];
  }
  function booksPnl(jobs) {
    var r = periodRange(ui.period), pl = BK.profitAndLoss(jobs, r[0], r[1]), t = pl.totals;
    var rows = pl.jobs.map(function (x) {
      return '<tr><td>' + jobLink(x.jobCode, x.customer) + '<br><span class="fmp1-faint p2-small">' + esc(x.project || x.jobCode) + '</span></td><td class="r">' + $f(x.revenueCents) + '</td><td class="r">' + (x.costKnown ? $f(x.costCents) : '<span class="fmp1-faint">not on file</span>') + '</td>' +
        '<td class="r">' + (x.absorbedCents ? $f(x.absorbedCents) : '—') + '</td><td class="r"><b>' + $f(x.grossProfitCents) + '</b></td><td class="r">' + x.marginPct + '%</td></tr>';
    }).join('');
    return head('P&amp;L', 'Job profit for work contracted in the period, and cash collected. Sales tax is passed through to the state, so it isn\'t counted as revenue.') +
      '<div class="p2-chips" role="group" aria-label="Period">' + Object.keys(PERIODS).map(function (k) { return '<button class="fmp1-btn" data-period="' + k + '" aria-pressed="' + (ui.period === k) + '">' + PERIODS[k] + '</button>'; }).join('') + '</div>' +
      '<p class="p2-small fmp1-faint">' + longDate(r[0]) + ' – ' + longDate(r[1]) + '</p>' +
      '<div class="p2-kpis"><div class="fmp1-card p2-kpi"><span class="k">Contracted</span><span class="v">' + $f(t.contractCents) + '</span><span class="p2-small fmp1-faint">' + pl.jobs.length + ' jobs</span></div>' +
        '<div class="fmp1-card p2-kpi"><span class="k">Revenue (less sales tax)</span><span class="v">' + $f(t.revenueCents) + '</span></div>' +
        '<div class="fmp1-card p2-kpi"><span class="k">Gross profit</span><span class="v">' + $f(t.grossProfitCents) + '</span><span class="p2-small fmp1-faint">' + t.marginPct + '% margin</span></div>' +
        '<div class="fmp1-card p2-kpi"><span class="k">Cash collected</span><span class="v">' + $f(pl.cash.collectedCents) + '</span><span class="p2-small fmp1-faint">' + $f(pl.cash.salesTaxCents) + ' of it sales tax</span></div></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>Job</th><th class="r">Revenue</th><th class="r">Cabinet cost</th><th class="r">Courtesy</th><th class="r">Gross profit</th><th class="r">Margin</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="p2-empty">No jobs contracted in this period.</td></tr>') +
        (rows ? '<tr class="is-total"><td>Total</td><td class="r">' + $f(t.revenueCents) + '</td><td class="r">' + $f(t.costCents) + '</td><td class="r">' + $f(t.absorbedCents) + '</td><td class="r">' + $f(t.grossProfitCents) + '</td><td class="r">' + t.marginPct + '%</td></tr>' : '') + '</tbody></table></div>' +
      '<p class="p2-note">Cabinet cost is the supplier price on each quote' + (pl.missingCost ? '; ' + pl.missingCost + ' job(s) have no cost on file, so their profit is overstated' : '') + '. "Courtesy" is what the shop absorbed on no-charge change orders. Overhead and payroll live in your accounting system, so this is job profit, not net profit.</p>';
  }

  function booksBalance(jobs) {
    var b = BK.balanceSheet(jobs, TODAY);
    function rows(list) { return list.map(function (x) { return '<tr><td>' + esc(x.label) + (x.note ? '<br><span class="fmp1-faint p2-small">' + esc(x.note) + '</span>' : '') + '</td><td class="r"><b>' + $f(x.cents) + '</b></td></tr>'; }).join(''); }
    return head('Balance sheet', 'What customers owe you and what you\'re holding for them, as of ' + longDate(TODAY) + ', from the jobs in the Project Builder.') +
      '<div class="p2-grid"><div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-bs"><thead><tr><th>Owed to you</th><th class="r">Amount</th></tr></thead><tbody>' + rows(b.assets) + '</tbody></table></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-bs"><thead><tr><th>Held for others</th><th class="r">Amount</th></tr></thead><tbody>' + rows(b.liabilities) + '</tbody></table></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-bs"><thead><tr><th>For reference</th><th class="r">Amount</th></tr></thead><tbody>' + rows(b.memo) + '</tbody></table></div></div>' +
      '<p class="p2-note">This covers job balances only. Cash in the bank, equipment, loans and owner\'s equity are in your accounting system; use these numbers to check it.</p>';
  }

  /* ---------- document viewer ---------- */
  function quotesFor(j) {
    var out = [];
    if (W && j.jobCode === W.jobCode) W.houses.forEach(function (h, i) {
      var m = W.models[h.model], p = Q.priceHouse(Q.inputFromOrderModel(m, W.pricing)), r = Q.reconcileToSigned(p, FM.toCents(m.contract.total));
      out.push(Q.renderHouseQuoteDoc(r.ok ? r : p, { house: h.name, jobCode: h.jobCode, buyer: W.customer, signer: W.signer, quoteDate: W.houseQuoteDate, deliveryDate: W.deliveryDate, color: m.color, pageLabel: 'House ' + (i + 1) + ' of ' + W.houses.length }));
    });
    if (B && j.jobCode === B.jobCode) {
      var p = Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing)), signed = FM.toCents(B.model.contract.total), r = Q.reconcileToSigned(p, signed);
      var meta = { house: B.project, jobCode: B.jobCode, buyer: B.customer, signer: B.signer, quoteDate: B.quoteDate, deliveryDate: B.deliveryDate, color: B.color };
      out.push(r.ok ? Q.renderHouseQuoteDoc(r, meta) : D.renderBidQuoteDoc(p, signed, meta));
    }
    if (j.models && window.P2Flows) out = out.concat(window.P2Flows.quotesFor(j));
    return out;
  }
  function openDoc(kind, key, j) {
    if (kind === 'inv') {
      var live = j.invoices.filter(function (i) { return i.status !== 'void'; }), inv = live.filter(function (i) { return i.id === key; })[0];
      ui.viewer = { title: inv.label + ' · ' + j.jobCode, html: D.renderInvoiceDoc(j, inv, { today: TODAY, index: live.indexOf(inv), count: live.length }), from: '[data-open-inv="' + key + '"]' };
    } else if (kind === 'packet') {
      ui.viewer = { title: 'Contract packet · ' + j.jobCode + ' · ' + j.customer, html: D.renderPacket(j, { today: TODAY, quotes: quotesFor(j), elevations: window.P2Elev ? window.P2Elev.docPages(ctx(), j) : '', agreementOnFile: (j.documents || []).some(function (d) { return d.kind === 'contract'; }) }), from: '[data-open-packet]' };
    } else if (kind === 'file') {
      var d = (j.documents || []).filter(function (x) { return x.file === key; })[0];
      ui.viewer = { title: d.title + ' · ' + j.jobCode, from: '[data-open-file="' + key + '"]', stored: d.file, html: fileCard(d, '<div class="fmp1-note fmp1-note--info p2-small" role="status">Looking for the stored file…</div>') };
      loadStored(d);
    }
  }

  /* ---------- stored originals (signed contracts, supplier orders) ----------
     Until the server's file storage is in place (HANDOFF §22, item 4), Open looks for the PDF in a "files" folder next to this page
     (FM_CONFIG.filesBase), under its exact name or a plain version of it, and shows it only if its SHA-256 matches the one recorded
     when it was signed. Nothing is uploaded anywhere; the browser reads the file and checks it. */
  var FILES = (window.FM_CONFIG && window.FM_CONFIG.filesBase) || 'files/';
  function plainName(n) { return String(n).normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-(?=\.pdf$)/gi, ''); }
  function fileCard(d, note) {
    return '<div class="fmp1-card p2-pad pv-filenote"><span class="fmp1-eyebrow">Signed original · ' + esc(d.kind) + '</span><b>' + esc(d.file) + '</b><span class="p2-small fmp1-muted">' + d.pages + ' pages · ' + (d.bytes / 1e6).toFixed(1) + ' MB · ' + esc(d.contains) + '</span>' +
      '<span class="p2-small">SHA-256 <span class="fmp1-code">' + esc(d.sha256) + '</span></span>' + note + '</div>';
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function loadStored(d) {
    var tries = [d.file, plainName(d.file)].filter(function (n, i, a) { return a.indexOf(n) === i; });
    function still() { return ui.viewer && ui.viewer.stored === d.file; }
    function show(html, url) { if (!still()) { if (url) URL.revokeObjectURL(url); return; } ui.viewer.html = html; ui.viewer.pdfUrl = url || null; render(); }
    function missing() {
      show(fileCard(d, '<div class="fmp1-note fmp1-note--info p2-small"><span>The stored file isn\'t here yet. Put it in the <b>' + esc(FILES) + '</b> folder next to this page, named <span class="fmp1-code">' + esc(d.file) + '</span>' +
        (tries[1] ? ' or <span class="fmp1-code">' + esc(tries[1]) + '</span>' : '') + ', and Open shows it after checking it\'s the signed copy. In the live tool it comes from the server\'s file storage.</span></div>'));
    }
    (function next(i) {
      if (i >= tries.length) return missing();
      fetch(FILES + encodeURIComponent(tries[i]), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) return next(i + 1);
        return r.arrayBuffer().then(function (buf) {
          var url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
          var frame = '<iframe class="pv-pdf" src="' + url + '" title="' + esc(d.title) + '"></iframe><p class="p2-small fmp1-faint" style="margin:6px 0 0">PDF not showing? Use <b>Open in a new tab</b> or <b>Download</b> above.</p>';
          if (!(window.crypto && window.crypto.subtle)) return show('<div class="fmp1-note fmp1-note--alert p2-small"><span>This page isn\'t on https, so the browser can\'t check the file\'s fingerprint. Showing it unchecked.</span></div>' + frame, url);
          return window.crypto.subtle.digest('SHA-256', buf).then(function (h) {
            if (hex(h) === String(d.sha256).toLowerCase()) return show('<div class="fmp1-card p2-pad pv-pdfwrap"><p class="p2-small pv-pdfok">✓ Same file as the signed original (SHA-256 matches). ' + esc(tries[i]) + ' · ' + (buf.byteLength / 1e6).toFixed(1) + ' MB</p>' + frame + '</div>', url);
            URL.revokeObjectURL(url);
            show(fileCard(d, '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span><b>This isn\'t the signed copy.</b> A file named ' + esc(tries[i]) + ' is in the files folder, but its fingerprint is ' + esc(hex(h).slice(0, 16)) + '…, not the one recorded at signing. It isn\'t shown. Replace it with the original.</span></div>'));
          });
        });
      }).catch(function () { next(i + 1); });
    })(0);
  }
  function viewerHTML() {
    var v = ui.viewer; if (!v) return '';
    var tools = v.stored ? (v.pdfUrl ? '<a class="fmp1-btn" href="' + v.pdfUrl + '" target="_blank" rel="noopener">Open in a new tab</a><a class="fmp1-btn" href="' + v.pdfUrl + '" download="' + esc(v.stored) + '">Download</a>' : '') : '<button class="fmp1-btn" data-print>Print or save PDF</button>';
    return '<div class="pv-viewer" role="dialog" aria-modal="true" aria-labelledby="pv-viewer-title"><div class="pv-viewer-bar"><b id="pv-viewer-title">' + esc(v.title) + '</b><span class="p2-row">' + tools + (v.printBlocked ? '<button class="fmp1-btn fmp1-btn--primary" data-printdl>Download to print</button>' : '') + '<button class="fmp1-btn' + (v.printBlocked ? '' : ' fmp1-btn--primary') + '" data-close-viewer>Close</button></span>' +
      (v.printBlocked ? '<p class="p2-small" role="status" style="flex-basis:100%;margin:0">' + esc(v.printBlocked) + '</p>' : '') + '</div><div class="pv-viewer-body">' + v.html + '</div></div>';
  }
  /* Print the open document. Some hosts (the claude.ai preview frame) block the print window; then offer the pages as one file
     that opens its own print window, so they can still be printed or saved as PDF. */
  function printViewer() {
    var fired = false; function on() { fired = true; }
    window.addEventListener('beforeprint', on);
    try { window.print(); } catch (e) { /* blocked */ }
    setTimeout(function () {
      window.removeEventListener('beforeprint', on);
      if (!fired && ui.viewer) { ui.viewer.printBlocked = 'This preview can\'t open the print window. Download the pages: the file opens your print window, where you can print or choose Save as PDF.'; render(); }
    }, 800);
  }
  function inlineImages(html) {
    var srcs = {}; html.replace(/src="([^"]+\.png)"/g, function (m, u) { srcs[u] = true; });
    return Promise.all(Object.keys(srcs).map(function (u) {
      return fetch(u).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res([u, fr.result]); }; fr.onerror = function () { res([u, u]); }; fr.readAsDataURL(b); });
      }).catch(function () { return [u, u]; });
    })).then(function (pairs) { pairs.forEach(function (p) { html = html.split('src="' + p[0] + '"').join('src="' + p[1] + '"'); }); return html; });
  }
  function downloadViewer() {
    var v = ui.viewer; if (!v) return;
    var name = v.title.replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + '.html';
    Promise.all([fetch('src/fm-phase1-print.css').then(function (r) { return r.text(); }).catch(function () { return ''; }), inlineImages(v.html)]).then(function (got) {
      var doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(v.title) + '</title>' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">' +
        '<style>' + got[0] + '\nbody{margin:0;background:#E6E0D2}@media screen{.fm-p1-doc{margin:24px auto;box-shadow:0 2px 12px rgba(0,0,0,.18)}}@media print{body{background:#fff}.fm-p1-doc{margin:0;box-shadow:none}}</style></head><body>' +
        got[1].replace(/ style="zoom:[^"]*"/g, '') + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});<\/script></body></html>';
      var c = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
      return c.then(function (dl) {
        if (dl) return dl.save({ filename: name, data: doc }).then(function () { if (ui.viewer) { ui.viewer.printBlocked = 'Saved. Open the file to print or save as PDF.'; render(); } }, function (er) {
          if (ui.viewer) { ui.viewer.printBlocked = er && er.code === 'declined' ? 'Download canceled.' : 'The download didn\'t go through (' + ((er && er.code) || 'error') + ').'; render(); }
        });
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      });
    });
  }
  function fitViewer() {
    var body = root.querySelector('.pv-viewer-body'); if (!body) return;
    var scale = Math.min(1, (body.clientWidth - 32) / 816);
    [].forEach.call(body.querySelectorAll('.fm-p1-doc'), function (d) { d.style.zoom = scale < 1 ? String(scale) : ''; });
  }

  /* ---------- shared context for the flows (preview/phase2-flows.js) ---------- */
  /* One list of documents for a job: the contract packet first, then the signed files. The whole row opens it. */
  function docRows(j, opts) {
    opts = opts || {};
    var rows = [];
    if (j.stage !== 'lost' && opts.packet !== false) rows.push('<li><button class="p2-docrow" data-open-packet><span class="p2-docicon" aria-hidden="true"></span><span class="p2-doctext"><b>' + (opts.packetTitle || 'Contract packet') + '</b><span class="p2-small fmp1-faint">' + (opts.packetSub || 'Summary, payment schedule, invoices, quote' + (j.elevations && j.elevations.rooms && j.elevations.rooms.length ? ' and elevations' : '')) + '</span></span><span class="p2-docopen">Open</span></button></li>');
    (j.documents || []).filter(function (d) { return !opts.kind || d.kind === opts.kind; }).forEach(function (d) {
      rows.push('<li><button class="p2-docrow" data-open-file="' + esc(d.file) + '"><span class="p2-docicon" aria-hidden="true"></span><span class="p2-doctext"><b>' + esc(d.title) + '</b><span class="p2-small fmp1-faint">' + esc(d.file) + (d.pages ? ' · ' + d.pages + ' page' + (d.pages === 1 ? '' : 's') : '') + (d.bytes ? ' · ' + (d.bytes / 1e6).toFixed(1) + ' MB' : '') + '</span></span><span class="p2-docopen">Open</span></button></li>');
    });
    return rows.length ? '<ul class="p2-docs">' + rows.join('') + '</ul>' : '';
  }
  function ctx() { return { store: store, ui: ui, me: me, TODAY: TODAY, esc: esc, money: $f, longDate: longDate, render: render, go: go, W: W, B: B, openDoc: openDoc, docRows: docRows, stagePill: stagePill }; }
  window.P2 = { ctx: ctx, render: render };

  /* ---------- events ---------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button, a[data-npstep], a[data-costep]'); if (!t) return;
    if (t.tagName === 'A') e.preventDefault();   // the step tabs of New Project and change orders are links: switch steps, don't navigate
    var r = route(), j = r.area === 'job' ? store.job(r.a) : null;
    if (t.hasAttribute('data-reset')) { store.reset(); ui.pay = ui.act = ui.viewer = ui.el = null; return render(); }
    if (t.dataset.filter) { ui.filter = t.dataset.filter; return render(); }
    if (t.dataset.period) { ui.period = t.dataset.period; return render(); }
    if (t.dataset.houses) { ui.open[t.dataset.houses] = !ui.open[t.dataset.houses]; return render(); }
    if (t.dataset.openInv && j) { openDoc('inv', t.dataset.openInv, j); return render(); }
    if (t.hasAttribute('data-open-packet') && j) { openDoc('packet', null, j); return render(); }
    if (t.dataset.openFile && j) { openDoc('file', t.dataset.openFile, j); return render(); }
    if (t.hasAttribute('data-close-viewer')) { var back = ui.viewer && ui.viewer.from; if (ui.viewer && ui.viewer.pdfUrl) URL.revokeObjectURL(ui.viewer.pdfUrl); ui.viewer = null; render(); var bk = back && root.querySelector(back); if (bk) bk.focus(); return; }
    if (t.hasAttribute('data-print')) { printViewer(); return; }
    if (t.hasAttribute('data-printdl')) { downloadViewer(); return; }
    if (t.dataset.gopay) { ui.pendingPay = { inv: t.dataset.inv }; ui.paidNote = null; return go('#/job/' + encodeURIComponent(t.dataset.gopay) + '/invoices'); }
    if (t.dataset.pay) { ui.pay = { inv: t.dataset.pay }; ui.paidNote = null; return render(); }
    if (t.hasAttribute('data-paycancel')) { ui.pay = null; return render(); }
    if (t.hasAttribute('data-paysave') && j) {
      var v = {}; [].forEach.call(root.querySelectorAll('[data-payf]'), function (el) { v[el.dataset.payf] = el.value; });
      var amt = Math.round(parseFloat(String(v.amount).replace(/[$,]/g, '')) * 100);
      var res = store.recordPayment(j.jobCode, ui.pay.inv, { amountCents: isNaN(amt) ? 0 : amt, date: v.date, method: v.method, reference: v.reference }, me().name);
      if (!res.ok) { ui.pay.errors = res.errors; ui.pay.values = v; return render(); }
      var paidInv = j.invoices.filter(function (i) { return i.id === ui.pay.inv; })[0];
      ui.paidNote = 'Payment of ' + $f(amt) + ' recorded on ' + (paidInv ? paidInv.label : 'the invoice') + '. It now shows in Payments, the job balance and Company books.';
      ui.pay = null; return render();
    }
    if (t.dataset.act && j) { ui.act = { job: j.jobCode, id: t.dataset.act }; return render(); }
    if (t.hasAttribute('data-actcancel')) { ui.act = null; return render(); }
    if (t.hasAttribute('data-actsave') && j) {
      var input = {}; [].forEach.call(root.querySelectorAll('[data-actfield]'), function (el) { input[el.dataset.actfield] = el.value; });
      var a = FM.applyAction(j, ui.act.id, input, me().name);
      if (!a.ok) { ui.act.error = a.error; return render(); }
      var def = FM.availableActions(j).filter(function (x) { return x.id === ui.act.id; })[0];
      store.update(j.jobCode, function () { return a.job; }, def.label + (input.date ? ' (' + input.date + ')' : '') + (input.reason ? ': ' + input.reason : '') + '.', me().name);
      ui.act = null; return render();
    }
    if (t.dataset.useradd != null || t.dataset.userrm) return usersClick(t);
    if (window.P2Reports && window.P2Reports.click(ctx(), t)) return;
    if (window.P2Customers && window.P2Customers.click(ctx(), t, j)) return;
    if (window.P2Measure && window.P2Measure.click(ctx(), t, e)) return;
    if (window.P2Measure && j && window.P2Measure.jobClick(ctx(), t, j)) return;
    if (window.P2Elev && window.P2Elev.click(ctx(), t, e)) return;
    if (window.P2Flows && window.P2Flows.click && window.P2Flows.click(ctx(), t, e) !== false) return;
  });
  root.addEventListener('input', function (e) {
    if (e.target.hasAttribute('data-q')) { ui.q = e.target.value; var pos = e.target.selectionStart; render(); var s = root.querySelector('[data-q]'); s.focus(); s.setSelectionRange(pos, pos); }
    if (window.P2Customers && window.P2Customers.input(ctx(), e)) return;
    if (window.P2Elev && window.P2Elev.input(ctx(), e)) return;
    if (window.P2Flows && window.P2Flows.input) window.P2Flows.input(ctx(), e);
  });
  root.addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-actor')) { ui.actor = e.target.value; try { window.localStorage.setItem('fm_phase2_actor', ui.actor); } catch (x) { /* ignore */ } return render(); }
    if (e.target.dataset.userf) return usersChange(e.target);
    if (window.P2Reports && window.P2Reports.change(ctx(), e)) return;
    if (window.P2Customers && window.P2Customers.change(ctx(), e)) return;
    if (window.P2Measure && window.P2Measure.change(ctx(), e)) return;
    if (window.P2Elev && window.P2Elev.change(ctx(), e)) return;
    if (window.P2Flows && window.P2Flows.change) window.P2Flows.change(ctx(), e);
  });
  /* Tabbing or clicking into a number box selects what's there, so typing replaces it (markup, hours, percentages…).
     Only for the person's own Tab or click: a box refocused after a redraw keeps the cursor where it was. */
  var lastNav = 0;
  root.addEventListener('keydown', function (e) { if (e.key === 'Tab') lastNav = Date.now(); }, true);
  root.addEventListener('pointerdown', function (e) { if (e.target.matches && e.target.matches('input')) lastNav = Date.now(); }, true);
  root.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el.matches || !el.matches('input[inputmode="decimal"], input[inputmode="numeric"], input[type="number"]') || Date.now() - lastNav > 400) return;
    setTimeout(function () { try { if (document.activeElement === el) el.select(); } catch (x) { /* not selectable */ } }, 0);
  });
  root.addEventListener('mouseup', function (e) { if (e.target.matches && e.target.matches('input[inputmode="decimal"], input[inputmode="numeric"]') && Date.now() - lastNav < 400) e.preventDefault(); });   // keep the selection the click just made
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ui.viewer) { var c = root.querySelector('[data-close-viewer]'); if (c) c.click(); } });
  window.addEventListener('hashchange', function () { ui.pay = ui.pendingPay || null; ui.pendingPay = null; ui.act = null; ui.paidNote = null; ui.viewer = null; ui.esErr = null; window.scrollTo(0, 0); render(); });
  window.addEventListener('resize', fitViewer);
  FMTheme.init(root); FMTheme.bind(root, root);
  if (window.P2Elev) window.P2Elev.bind(root, ctx);
  render();
})();
