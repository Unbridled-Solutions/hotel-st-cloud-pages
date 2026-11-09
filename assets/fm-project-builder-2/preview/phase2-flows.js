/*
 * Project Builder · Phase 2 app (preview) · the three flows:
 *   New Project (§15)  ·  Change orders (§17, §19)  ·  Contract and e-sign (§16, §18)
 * Rules live in src/ (FMQuote, FMContract, FMChangeOrder, FMBid). Signing runs in the tool (preview/phase2-sign.js, FMSign); in production the
 * server makes those calls (§16). Supplier PDFs are simulated by the sample orders (Penrose and Willow Creek models).
 */
(function () {
  'use strict';
  var FM = window.FMPhase1, Q = window.FMQuote, D = window.FMDocs, K = window.FMContract, CO = window.FMChangeOrder, A = window.FMAddress;
  var W = window.FM_WILLOW_ORDER, B = window.FM_BRADDY_ORDER;
  /* Company defaults for a new job. Assembly is hours × an hourly rate per home: the rate starts at $20.50, the hours are
     entered on every job (owner, Oct 2026). */
  var DEFAULTS = { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9, assemblyRate: '20.50', assemblyHours: '', plan: [50, 50], planNames: ['Deposit', 'At delivery'], planMode: '0', atCost: true };
  var AT_COST = ['PWB18K', 'TU', 'TUK', 'F342'];
  var PLANS = [{ pct: [50, 50], names: ['Deposit', 'At delivery'] }, { pct: [50, 30, 20], names: ['Deposit', 'Progress', 'Final'] }, { pct: [100], names: ['Paid in full'] }];
  function presetIndex(plan) { for (var i = 0; i < PLANS.length; i++) if (PLANS[i].pct.join() === (plan || []).join()) return String(i); return 'custom'; }
  /* a job's or draft's payment plan as named stages; the invoices and the contract's payment schedule are built from it */
  function planStages(p) {
    var plan = (p && p.plan) || [], ix = presetIndex(plan), names = (p && p.planNames) || (ix !== 'custom' ? PLANS[+ix].names : []);
    return plan.map(function (pct, i) { return { name: String(names[i] || '').trim() || 'Payment ' + (i + 1), pct: pct }; });
  }
  function invoiceLabel(p, i) {
    var st = planStages(p)[i], custom = p && p.planMode === 'custom';
    return 'Invoice ' + (i + 1) + ' · ' + (custom ? st.name + ' · ' : '') + st.pct + '%';
  }
  function copyAssembly(d, p) {
    if (p.assemblyHours != null) { d.pricing.assemblyHours = String(p.assemblyHours); if (p.assemblyRateCents != null) d.pricing.assemblyRate = (p.assemblyRateCents / 100).toFixed(2); return true; }
    return false;   // an older job with a flat assembly amount: the hours start blank
  }
  function copyPlan(d, p, src) {
    var plan = p.plan ? p.plan.slice() : src && src.invoices && src.invoices.length === 3 ? [50, 30, 20] : null;
    if (!plan) return;
    d.pricing.plan = plan; d.pricing.planMode = p.planMode === 'custom' ? 'custom' : presetIndex(plan);
    d.pricing.planNames = planStages({ plan: plan, planNames: p.planNames }).map(function (x) { return x.name; });
  }
  /* Who can sign for Fremont Makers: the users marked "Signs contracts" on the Users page (window.P2Users). */
  function signers() { return window.P2Users ? window.P2Users.signers() : []; }
  var COLORS = { VDH: 'Dark Hickory Shaker', SBW: 'Bayview White Shaker', SWD: 'Bayview Wood Shaker', UMO: 'Moss Green Shaker' };
  var DRAFT_KEY = 'fm_phase2_draft';

  function suffix(sku) { var p = String(sku).split('-'); return p.length > 1 ? p[p.length - 1].toUpperCase() : ''; }
  function base(sku) { return String(sku).replace(/-[A-Z]{3}$/i, '').toUpperCase(); }
  function toCents(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? NaN : Math.round(n * 100); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? NaN : n; }

  /* Sample supplier PDFs (stand-ins for the shared import, §15). */
  function samplePdfs() {
    var out = [];
    if (B) out.push({ id: 'penrose', name: 'Wholesale Cabinets · Penrose · Dark Hickory', lines: B.model.lines.filter(function (l) { return !l.noCharge; }).map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost) }; }) });
    if (B && B.supplierOrders[0]) out.push({ id: 'b1000173203', orderNumber: B.supplierOrders[0].orderNumber, name: 'Wholesale Cabinets order #1000173203 (VDC42RS, DC224)', lines: B.changeOrders[0].added.map(function (a) { return { sku: a.sku, desc: a.desc, qty: a.qty, unitCostCents: FM.toCents(a.unitCost) }; }) });
    if (W) Object.keys(W.models).forEach(function (n) {
      out.push({ id: 'w-' + n, name: 'Wholesale Cabinets · ' + n + ' · ' + W.models[n].color, lines: W.models[n].lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost) }; }) });
    });
    return out;
  }
  function pdfById(id) { return samplePdfs().filter(function (p) { return p.id === id; })[0]; }

  /* ================= New Project ================= */
  function blankDraft(c) {
    return { step: 0, customer: '', newCustomer: '', project: '', signer: '', email: '', kind: 'single', address: '', addr: A.blank(),
      models: [{ id: 'm1', name: '', qty: 1, lines: [], pdf: '' }], pricing: JSON.parse(JSON.stringify(DEFAULTS)), copiedFrom: '',
      bid: false, bidAmount: '', install: '', errors: [] };
  }
  function loadDraft(c) {
    if (c.ui.draft) return c.ui.draft;
    try { var s = window.localStorage.getItem(DRAFT_KEY); if (s) { c.ui.draft = migrate(JSON.parse(s)); return c.ui.draft; } } catch (e) { /* none */ }
    c.ui.draft = blankDraft(c); return c.ui.draft;
  }
  /* drafts saved before addresses had fields and assembly had hours */
  function migrate(d) {
    if (!d.addr) d.addr = A.parse(d.address);
    var p = d.pricing = d.pricing || JSON.parse(JSON.stringify(DEFAULTS));
    if (p.assemblyRate == null) { p.assemblyRate = DEFAULTS.assemblyRate; p.assemblyHours = ''; delete p.assembly; }
    if (!p.plan) p.plan = DEFAULTS.plan.slice();
    if (!p.planMode) p.planMode = presetIndex(p.plan);
    if (!p.planNames) p.planNames = planStages(p).map(function (x) { return x.name; });
    return d;
  }
  function saveDraft(c) { try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(c.ui.draft)); } catch (e) { /* keep in memory */ } }
  function clearDraft(c) { c.ui.draft = null; try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } }

  function draftHasWork(d) { return !!(d && (d.customer || d.project || d.models.some(function (m) { return m.lines.length; }))); }
  /* A new draft from an existing job: customer, contacts, homes, cabinet lines (after change orders), pricing and the drawings.
     It opens on the Cabinets step so more cabinets can be added from another supplier PDF. */
  function duplicateJob(c, j) {
    var EL = window.FMElev, sets = window.P2Elev ? window.P2Elev.setsFor(c, j) : [];
    var builder = j.kind === 'builder_order' || sets.length > 1, d = blankDraft(c);
    d.customer = customers(c).indexOf(j.customer) > -1 ? j.customer : '__new'; if (d.customer === '__new') d.newCustomer = j.customer;
    d.project = (j.projectName || j.customer) + ' (copy)'; d.signer = (j.contacts && j.contacts.signer) || ''; d.email = (j.contacts && j.contacts.buyerEmail) || '';
    d.kind = builder ? 'builder' : 'single';
    var p = j.pricing;
    if (p) { ['markupPct', 'discountPctOfCost', 'gaPct', 'taxPct'].forEach(function (k) { if (p[k] != null) d.pricing[k] = p[k]; });   // per-model markup (Willow) keeps the default here; lines keep their own
      var flatAsm = !copyAssembly(d, p) && p.assemblyCents; copyPlan(d, p, j); }
    d.copiedFrom = j.jobCode; d.duplicatedFrom = j.jobCode;
    var E = j.elevations || {}, rooms = [], nRooms = 0;
    d.models = (sets.length ? sets : [{ key: '', lines: [] }]).map(function (st, i) {
      var qty = 1;
      if (builder) qty = c.W && j.jobCode === c.W.jobCode ? c.W.houses.filter(function (h) { return h.model === st.key; }).length : (((j.models || [])[i] || {}).qty || 1);
      var id = 'm' + (i + 1);
      var src = (E.rooms || []).filter(function (r) { return r.set === st.key; });
      if (src.length && EL) { var cp = EL.copyRooms(src, st.lines, { set: id }); rooms = rooms.concat(cp.rooms); nRooms += cp.rooms.length; }
      return { id: id, name: builder ? st.key : '', qty: qty, pdf: '', lines: (st.lines || []).filter(function (l) { return +l.qty > 0; }).map(function (l) {
        return { sku: l.sku, desc: l.desc || '', qty: +l.qty, unitCostCents: l.unitCostCents != null ? l.unitCostCents : FM.toCents(l.unitCost), markupPct: d.pricing.markupPct, edited: false, srcMarkup: l.markupPct }; }) };
    });
    if (nRooms) d.elevations = { rooms: rooms, sizes: JSON.parse(JSON.stringify(E.sizes || {})) };
    reapply(d);
    // keep each line's own markup from the job; one that differs from the job's rule counts as edited by hand
    d.models.forEach(function (m) { m.lines.forEach(function (l) { if (l.srcMarkup != null && +l.srcMarkup !== l.markupPct) { l.markupPct = +l.srcMarkup; l.edited = true; } delete l.srcMarkup; }); });
    d.step = 2;
    d.note = 'Copied from ' + j.jobCode + ' · ' + j.customer + ': customer, ' + (builder ? d.models.length + ' models, ' : '') + d.models.reduce(function (t, m) { return t + m.lines.length; }, 0) + ' cabinet lines (with change orders), pricing' +
      (nRooms ? ' and ' + nRooms + ' room' + (nRooms === 1 ? '' : 's') + ' of drawings' : '') + '. Add more cabinets from another supplier PDF below, then check every step. The address and install date start blank.' + (flatAsm ? ' The original used a flat assembly amount (' + c.money(p.assemblyCents) + ' per home); enter the assembly hours on the Price step.' : '') +
      (!j.source || j.source.system !== 'phase2' ? ' This job was priced in the old tool, so the new total uses today\'s corrected quote math and can differ from the original.' : '');
    c.ui.draft = d; saveDraft(c);
  }
  /* confirm before replacing an unfinished draft (shown in the job header) */
  function dupConfirm(c, j) {
    if (!c.ui.dupAsk || c.ui.dupAsk !== j.jobCode) return '';
    return '<div class="fmp1-note fmp1-note--alert p2-small p2-between" role="alert" style="align-items:center"><span>There\'s an unfinished New Project draft (' + c.esc(loadDraft(c).project || 'no name yet') + '). Duplicating replaces it.</span>' +
      '<span class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-dupyes>Replace the draft</button><button class="fmp1-btn fmp1-btn--quiet" data-dupno>Keep the draft</button></span></div>';
  }
  function ruleAtCost(d, l) { return d.pricing.atCost && AT_COST.indexOf(base(l.sku)) > -1; }
  function reapply(d) { d.models.forEach(function (m) { m.lines.forEach(function (l) { if (!l.edited) l.markupPct = ruleAtCost(d, l) ? 0 : d.pricing.markupPct; }); }); }
  function asmHours(d) { var h = num(d.pricing.assemblyHours); return h > 0 ? h : 0; }
  function asmRate(d) { var r = toCents(d.pricing.assemblyRate); return r > 0 ? r : 0; }
  function asmCents(d) { return Math.round(asmHours(d) * asmRate(d)); }
  function asmLabor(d) { return asmHours(d) && asmRate(d) ? [{ role: 'Assembly', rateCents: asmRate(d), hours: asmHours(d) }] : []; }
  function priceModel(d, m) {
    if (!m.lines.length) return null;
    return Q.priceHouse({ lines: m.lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct }; }),
      discountPctOfCost: d.pricing.discountPctOfCost, labor: asmLabor(d), gaPct: d.pricing.gaPct, taxPct: d.pricing.taxPct });
  }
  function orderTotals(d) {
    var t = { itemized: 0, tax: 0, cost: 0, homes: 0, ok: true };
    if (d.noSkus) { d.models.forEach(function (m) { t.homes += d.kind === 'single' ? 1 : (m.qty || 0); }); t.total = 0; return t; }   // no SKUs yet: nothing to price
    d.models.forEach(function (m) { var p = priceModel(d, m); if (!p || !p.ok) { t.ok = false; return; } var q = d.kind === 'single' ? 1 : (m.qty || 0);
      t.itemized += p.summary.totalCents * q; t.tax += p.summary.taxCents * q; t.cost += p.internal.costCents * q; t.homes += q; });
    var bid = toCents(d.bidAmount);
    t.total = d.bid && bid > 0 ? bid : t.itemized;
    return t;
  }
  function customers(c) {
    var seen = {}, names = c.store.jobs().map(function (j) { return j.customer; }).concat(window.P2Customers ? window.P2Customers.names(c) : []);
    return names.filter(function (n) { var k = String(n).trim().toLowerCase(); if (!n || seen[k] || /change order/i.test(n)) return false; seen[k] = 1; return true; }).sort(function (a, b) { return a.localeCompare(b); });
  }
  /* New Project from a customer's profile, with or without one of their templates (homes, models and house counts, cabinets, drawings).
     Pricing is not part of a template: the draft starts at the company defaults (owner rule: pricing is set per job). */
  function fromTemplate(c, cust, tpl) {
    var CU = window.FMCustomers, EL = window.FMElev, d = blankDraft(c), sg = CU.signer(cust), site = (cust.addresses || []).filter(function (a) { return a.kind === 'site' && a.line; })[0];
    d.customer = customers(c).indexOf(cust.name) > -1 ? cust.name : '__new'; if (d.customer === '__new') d.newCustomer = cust.name;
    d.signer = sg ? sg.name : ''; d.email = sg ? (sg.email || '') : ''; d.addr = site ? A.from(site) : A.blank(); d.address = A.format(d.addr); d.customerId = cust.id;
    if (tpl) {
      var rooms = [];
      d.kind = tpl.kind; d.project = tpl.name; d.fromTemplate = tpl.id;
      d.models = tpl.models.map(function (m, i) {
        var id = 'm' + (i + 1);
        if (m.rooms && m.rooms.length && EL) rooms = rooms.concat(EL.copyRooms(m.rooms, m.lines, { set: id }).rooms);
        return { id: id, name: tpl.kind === 'builder' ? m.name : '', qty: m.qty, pdf: '', lines: m.lines.map(function (l) { return { sku: l.sku, desc: l.desc || '', qty: l.qty, unitCostCents: l.unitCostCents, markupPct: d.pricing.markupPct, edited: false }; }) };
      });
      if (rooms.length) d.elevations = { rooms: rooms, sizes: {} };
      reapply(d);
      d.note = 'From the template "' + tpl.name + '" for ' + cust.name + ': ' + CU.summary(tpl) + '. Signer, email and site come from their profile. Pricing starts at the company defaults; to use this customer\'s usual numbers, pick one of their jobs in "Copy from a past job" on the Price step.' +
        (tpl.costsAsOf ? ' Supplier costs are as of ' + c.longDate(tpl.costsAsOf) + '; add or replace a supplier PDF on the Cabinets step to refresh them.' : '');
    } else d.note = 'New project for ' + cust.name + ': signer, email and site come from their profile.';
    c.ui.draft = d; saveDraft(c);
  }
  function stepErrors(c, d, i) {
    var e = [];
    if (i === 0) {
      if (!(d.customer === '__new' ? d.newCustomer.trim() : d.customer)) e.push('Choose or add the customer.');
      if (!d.project.trim()) e.push('Add a project name.');
      if (!d.signer.trim()) e.push('Add who will sign.');
      if (!K.isEmail(d.email)) e.push('Add the signer\'s email (the signing link goes there).');
    }
    if (i === 1) {
      e = e.concat(A.check(d.addr, d.kind === 'single' ? 'Install address' : 'Site address'));
      if (d.kind === 'builder') d.models.forEach(function (m, k) { if (!m.name.trim() || !(m.qty >= 1)) e.push('Model ' + (k + 1) + ' needs a name and at least 1 house.'); });
    }
    if (i === 2 && !d.noSkus) d.models.forEach(function (m) { if (!m.lines.length) e.push((m.name || 'The home') + ' has no cabinets yet. Add the supplier PDF, or choose "No, sketch first".'); });
    if (i === 3) {
      ['markupPct', 'discountPctOfCost', 'gaPct', 'taxPct'].forEach(function (k) { if (!(d.pricing[k] >= 0)) e.push('Pricing values must be 0 or more.'); });
      var ah = String(d.pricing.assemblyHours == null ? '' : d.pricing.assemblyHours).trim();
      if (!ah) e.push('Enter the assembly hours per home (0 if there\'s no assembly).'); else if (!(num(ah) >= 0)) e.push('Assembly hours must be a number.');
      if (!(toCents(d.pricing.assemblyRate) >= 0)) e.push('Enter the hourly assembly rate.');
      var pl = d.pricing.plan, sum = Math.round(pl.reduce(function (t, x) { return t + (+x || 0); }, 0) * 100) / 100;
      if (!pl.length) e.push('Add at least one payment to the plan.');
      else if (pl.some(function (x) { return !(+x > 0); })) e.push('Every payment in the plan needs a percentage above 0.');
      else if (sum !== 100) e.push('The payment plan adds up to ' + sum + '%, not 100%.');
      if (d.bid && !(toCents(d.bidAmount) > 0)) e.push('Enter the agreed bid price.');
    }
    if (i === 4) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d.install)) e.push('Set the install / delivery date (an estimate is fine).'); else if (d.install < c.TODAY) e.push('The install date can\'t be in the past.'); }
    return e.filter(function (x, k, a) { return a.indexOf(x) === k; });
  }
  var NP_STEPS = ['Customer', 'Homes', 'Cabinets', 'Price', 'Review'];

  function renderNew(c) {
    var d = loadDraft(c), esc = c.esc, $f = c.money, t = orderTotals(d);
    var rail = '<nav class="p2-tabs" aria-label="New project steps">' + NP_STEPS.map(function (s, i) {
      var done = i < d.step && !stepErrors(c, d, i).length;
      return '<a href="#/new" data-npstep="' + i + '"' + (i === d.step ? ' aria-current="page"' : '') + '>' + (done ? '✓ ' : (i + 1) + '. ') + s + '</a>';
    }).join('') + '</nav>';
    var body = [npCustomer, npHomes, npCabinets, npPrice, npReview][d.step](c, d);
    var errs = d.errors && d.errors.length ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><ul class="p2-errs">' + d.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
    var foot = '<div class="p2-between"><span class="p2-row"><button class="fmp1-btn fmp1-btn--quiet" data-npback' + (d.step ? '' : ' disabled') + '>Back</button><button class="fmp1-btn fmp1-btn--quiet" data-npdiscard>Discard draft</button></span>' +
      (d.step < 4 ? '<button class="fmp1-btn fmp1-btn--primary" data-npnext>Next</button>' : '<button class="fmp1-btn fmp1-btn--primary" data-npcreate>Create project</button>') + '</div>';
    var side = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Live total</span><span class="p2-bignum">' + (t.ok ? $f(t.total) : '—') + '</span>' +
      '<span class="p2-small fmp1-faint">' + (d.kind === 'single' ? 'One home' : t.homes + ' homes') + (d.bid ? ' · agreed bid' : '') + ' · draft saves as you go</span></div>';
    var note = d.note ? '<div class="fmp1-note fmp1-note--info p2-small p2-between" style="align-items:flex-start"><span>' + esc(d.note) + '</span><button class="p2-linkbtn p2-small" data-npnoteclose aria-label="Close this note">✕</button></div>' : '';
    return '<div class="p2-np"><div class="p2-between"><div><h1 class="fmp1-h p2-h1">New project</h1><p class="p2-sub">Five steps on one page. Leave any time; the draft is kept.</p></div>' + side + '</div>' + rail + note + errs +
      '<div class="fmp1-card p2-pad">' + body + '</div>' + foot + '</div>';
  }
  function fld(label, attrs, val, type) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" ' + attrs + (type ? ' type="' + type + '"' : '') + ' value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"></label>'; }
  function npCustomer(c, d) {
    var esc = c.esc;
    return '<h2 class="fmp1-h" style="font-size:20px">Who is this for?</h2><div class="p2-grid">' +
      '<label class="p2-fld"><span>Customer</span><select class="fmp1-input" data-np="customer"><option value="">Choose…</option>' +
      customers(c).map(function (n) { return '<option' + (d.customer === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '<option value="__new"' + (d.customer === '__new' ? ' selected' : '') + '>+ New customer</option></select></label>' +
      (d.customer === '__new' ? fld('New customer name', 'data-np="newCustomer"', d.newCustomer) : '') + tplChips(c, d) +
      fld('Project name', 'data-np="project"', d.project) + fld('Signer', 'data-np="signer"', d.signer) + fld('Signer email (for e-signature)', 'data-np="email"', d.email, 'email') +
      '</div><p class="p2-note">The customer holds contact details only. Pricing is set on this job in the Price step.</p>';
  }
  function tplChips(c, d) {
    var cust = window.P2Customers && d.customer && d.customer !== '__new' ? window.P2Customers.byName(c, d.customer) : null;
    if (!cust || !cust.templates.length) return '';
    return '<div class="p2-fld" style="grid-column:1/-1"><span>Start from one of ' + c.esc(cust.name) + '\'s templates</span><div class="p2-row">' + cust.templates.map(function (t) {
      return '<button class="fmp1-btn' + (d.fromTemplate === t.id ? ' fmp1-btn--primary' : '') + '" data-nptpl="' + c.esc(t.id) + '" title="' + c.esc(window.FMCustomers.summary(t)) + '">' + c.esc(t.name) + '</button>'; }).join('') + '</div></div>';
  }
  function npHomes(c, d) {
    var esc = c.esc;
    var models = d.kind === 'builder' ? '<div class="p2-grid">' + d.models.map(function (m, i) {
      return '<div class="p2-form">' + fld('Model ' + (i + 1), 'data-npm="name" data-i="' + i + '"', m.name) + fld('Houses', 'data-npm="qty" data-i="' + i + '" inputmode="numeric"', m.qty) +
        (d.models.length > 1 ? '<button class="fmp1-btn fmp1-btn--quiet" data-npdelmodel="' + i + '">Remove</button>' : '') + '</div>';
    }).join('') + '</div><button class="fmp1-btn" data-npaddmodel>Add a model</button>' : '';
    return '<h2 class="fmp1-h" style="font-size:20px">How many homes?</h2><div class="p2-chips" role="group" aria-label="Kind">' +
      '<button class="fmp1-btn" data-npkind="single" aria-pressed="' + (d.kind === 'single') + '">One home</button><button class="fmp1-btn" data-npkind="builder" aria-pressed="' + (d.kind === 'builder') + '">Builder order (several models)</button></div>' +
      A.fieldsHTML(function (f) { return 'data-npaddr="' + f + '"'; }, d.addr, { legend: d.kind === 'single' ? 'Install address' : 'Site address' }) + models +
      (d.kind === 'builder' ? '<p class="p2-note">Houses of the same model share one cabinet list, so each model needs one supplier PDF, not one per house.</p>' : '');
  }
  function npCabinets(c, d) {
    var esc = c.esc, $f = c.money, pdfs = samplePdfs();
    function opts(sel) { return pdfs.map(function (p) { return '<option value="' + p.id + '"' + (sel === p.id ? ' selected' : '') + '>' + esc(p.name) + ' · ' + p.lines.length + ' line' + (p.lines.length === 1 ? '' : 's') + '</option>'; }).join(''); }
    var ask = '<div class="p2-np-skus"><b>Do you have SKUs to upload?</b><div class="p2-chips" role="group" aria-label="Do you have SKUs?">' +
      '<button class="fmp1-btn" data-npskus="yes" aria-pressed="' + !d.noSkus + '">Yes, from the supplier PDF</button><button class="fmp1-btn" data-npskus="no" aria-pressed="' + !!d.noSkus + '">No, sketch first</button></div></div>';
    if (d.noSkus) return '<h2 class="fmp1-h" style="font-size:20px">Cabinets</h2>' + ask +
      '<div class="fmp1-note fmp1-note--info p2-small">The project starts without cabinets or a price. Its Elevations tab opens as a sketch with industry-standard sizes, custom sizes and a color to show. Add the supplier PDF there when you have it; the quote is priced then, with the settings on the next step.</div>';
    return '<h2 class="fmp1-h" style="font-size:20px">Cabinets</h2>' + ask +
      (d.elevations && d.elevations.rooms.length ? '<p class="p2-small fmp1-muted">Drawings come along: ' + d.elevations.rooms.length + ' room' + (d.elevations.rooms.length === 1 ? '' : 's') + '. Cabinets you add here show as "to place" on the Elevations tab.</p>' : '') + d.models.map(function (m, i) {
      var colors = {}; m.lines.forEach(function (l) { colors[suffix(l.sku)] = 1; }); var cs = Object.keys(colors);
      var cost = m.lines.reduce(function (t, l) { return t + l.unitCostCents * l.qty; }, 0), units = m.lines.reduce(function (t, l) { return t + (+l.qty || 0); }, 0);
      var preview = m.lines.length ? '<div class="p2-np-preview"><div class="p2-between p2-small"><b>' + m.lines.length + ' line' + (m.lines.length === 1 ? '' : 's') + ' · ' + units + ' item' + (units === 1 ? '' : 's') + ' · cost ' + $f(cost) + '</b>' +
          (m.added ? '<span class="fmp1-faint">' + esc(m.added) + '</span>' : '<span class="fmp1-faint">Check these before you go on</span>') + '</div>' +
        '<div class="p2-np-scroll"><table class="fmp1-table p2-np-lines"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Line cost</th></tr></thead><tbody>' +
        m.lines.map(function (l) { return '<tr><td class="fmp1-code">' + esc(l.sku) + '</td><td>' + esc(l.desc || '') + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.unitCostCents) + '</td><td class="r">' + $f(l.unitCostCents * l.qty) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>' : '<p class="p2-small fmp1-faint">No cabinets yet. Pick the supplier PDF to see its lines here.</p>';
      return '<section class="p2-np-model"><div class="p2-between"><b>' + esc(d.kind === 'single' ? (d.project || 'The home') : (m.name || 'Model ' + (i + 1)) + ' × ' + m.qty) + '</b>' +
        (cs.length ? '<span class="p2-small">' + (cs.length === 1 ? 'Color from the SKUs: <b>' + esc(COLORS[cs[0]] || cs[0]) + '</b>' : '<b style="color:var(--fmp1-alert-ink)">Mixed colors: ' + cs.map(function (x) { return esc(COLORS[x] || x); }).join(', ') + '</b>') + '</span>' : '') + '</div>' +
        '<div class="p2-np-pick"><label class="p2-fld"><span>Supplier PDF</span><select class="fmp1-input" data-nppdf="' + i + '"><option value="">Choose a PDF…</option>' + opts(m.pdf) + '</select></label>' +
        (m.lines.length ? '<label class="p2-fld"><span>Add from another PDF <span class="fmp1-faint">(same SKUs add up)</span></span><select class="fmp1-input" data-npaddpdf="' + i + '"><option value="">Choose a PDF…</option>' + opts('') + '</select></label>' : '') + '</div>' +
        preview + '</section>';
    }).join('') + '<p class="p2-small fmp1-faint">Sample orders stand in for the supplier PDFs in this preview.</p>';
  }
  function npPrice(c, d) {
    var esc = c.esc, $f = c.money, p = d.pricing;
    var past = c.store.jobs().filter(function (j) { return j.pricing && j.pricing.markupPct != null; });
    var homes = d.kind === 'single' ? 1 : d.models.reduce(function (t, m) { return t + (m.qty || 0); }, 0);
    var asm = '<section class="p2-np-box"><b>Assembly <span class="fmp1-faint p2-small">per home</span></b><div class="p2-np-asm">' +
      fld('Hours', 'data-npp="assemblyHours" inputmode="decimal"', p.assemblyHours) + '<span class="p2-np-op" aria-hidden="true">×</span>' +
      fld('Hourly rate ($)', 'data-npp="assemblyRate" inputmode="decimal"', p.assemblyRate) + '<span class="p2-np-op" aria-hidden="true">=</span>' +
      '<div class="p2-fld"><span>Per home</span><b class="p2-np-asmtotal" data-npasm>' + $f(asmCents(d)) + '</b></div></div>' +
      '<span class="p2-small fmp1-faint">' + (homes > 1 ? homes + ' homes · ' + $f(asmCents(d) * homes) + ' in all. ' : '') + 'Both change by project; enter 0 hours if there\'s no assembly.</span></section>';
    var stages = planStages(p), sum = Math.round(p.plan.reduce(function (t, x) { return t + (+x || 0); }, 0) * 100) / 100;
    var plan = '<section class="p2-np-box"><b>Payment plan</b><label class="p2-fld"><span>Plan</span><select class="fmp1-input" data-npplan>' +
      PLANS.map(function (pl, i) { return '<option value="' + i + '"' + (p.planMode === String(i) ? ' selected' : '') + '>' + pl.pct.join(' / ') + ' · ' + pl.names.join(', ') + '</option>'; }).join('') +
      '<option value="custom"' + (p.planMode === 'custom' ? ' selected' : '') + '>+ Custom payment plan…</option></select></label>' +
      (p.planMode === 'custom' ? '<ol class="p2-np-plan">' + stages.map(function (st, i) {
          return '<li><input class="fmp1-input" aria-label="Name of payment ' + (i + 1) + '" data-npplanname="' + i + '" value="' + esc(p.planNames[i] || '') + '" placeholder="Payment ' + (i + 1) + '">' +
            '<span class="p2-np-pct"><input class="fmp1-input" inputmode="decimal" aria-label="Percent for payment ' + (i + 1) + '" data-npplanpct="' + i + '" value="' + st.pct + '">%</span>' +
            (stages.length > 1 ? '<button class="fmp1-btn fmp1-btn--quiet" data-npplandel="' + i + '" aria-label="Remove payment ' + (i + 1) + '">Remove</button>' : '') + '</li>'; }).join('') + '</ol>' +
        '<div class="p2-between p2-small"><button class="fmp1-btn fmp1-btn--quiet" data-npplanadd>+ Add a payment</button><b' + (sum === 100 ? ' class="p2-ok"' : ' style="color:var(--fmp1-alert-ink)"') + '>' + (sum === 100 ? '✓ Adds up to 100%' : 'Adds up to ' + sum + '%; needs 100%') + '</b></div>'
        : '<span class="p2-small fmp1-faint">' + stages.map(function (st) { return esc(st.name) + ' ' + st.pct + '%'; }).join(' · ') + '</span>') +
      '<span class="p2-small fmp1-faint">The invoices and the contract\'s payment schedule follow this plan.</span></section>';
    var settings = '<section class="p2-np-box p2-np-wide"><b>Markup and tax</b><div class="p2-np-set">' +
      fld('Markup %', 'data-npp="markupPct" inputmode="decimal"', p.markupPct) + fld('Mfr. discount % (of cost)', 'data-npp="discountPctOfCost" inputmode="decimal"', p.discountPctOfCost) +
      fld('G&amp;A %', 'data-npp="gaPct" inputmode="decimal"', p.gaPct) + fld('Sales tax %', 'data-npp="taxPct" inputmode="decimal"', p.taxPct) +
      '<label class="p2-fld"><span>Copy from a past job</span><select class="fmp1-input" data-npcopy><option value="">Choose…</option>' + past.map(function (j) { return '<option value="' + esc(j.jobCode) + '"' + (d.copiedFrom === j.jobCode ? ' selected' : '') + '>' + esc(j.customer + ' · ' + (j.projectName || j.jobCode)) + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="p2-row p2-small"><input type="checkbox" data-npatcost' + (p.atCost ? ' checked' : '') + '> Sell ' + AT_COST.join(', ') + ' at cost</label></section>';
    var tables = d.models.map(function (m, mi) {
      var pr = priceModel(d, m);
      return '<div class="p2-np-tablehead"><b>' + esc(d.kind === 'single' ? (d.project || 'The home') : m.name + ' × ' + m.qty) + '</b>' + (pr && pr.ok ? '<span class="p2-small">Per home <b>' + $f(pr.summary.totalCents) + '</b> · margin on product ' + pr.internal.marginPct + '%</span>' : '') + '</div>' +
        '<div class="fmp1-table-wrap"><table class="fmp1-table p2-np-lines p2-np-price"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Markup %</th><th class="r">Sell</th></tr></thead><tbody>' +
        m.lines.map(function (l, li) {
          var sell = pr && pr.ok ? pr.lines[li].totalCents : 0;
          return '<tr><td class="fmp1-code">' + esc(l.sku) + (l.edited ? ' <span class="fmp1-pill">edited</span>' : '') + (ruleAtCost(d, l) && !l.edited ? ' <span class="fmp1-pill fmp1-pill--alert">at cost</span>' : '') + '</td><td class="p2-np-desc">' + esc(l.desc || '') + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.unitCostCents) + '</td>' +
            '<td class="r"><input class="fmp1-input p2-np-mk" inputmode="decimal" aria-label="Markup for ' + esc(l.sku) + '" data-npline="' + mi + ':' + li + '" value="' + l.markupPct + '"></td><td class="r">' + $f(sell) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
    var t = orderTotals(d);
    if (d.noSkus) tables = '<div class="fmp1-note fmp1-note--info p2-small">No SKUs yet, so there\'s nothing to price. These settings are saved on the project and used when the supplier PDF is added.</div>';
    return '<h2 class="fmp1-h" style="font-size:20px">Price</h2><div class="p2-np-boxes">' + asm + plan + settings + '</div>' +
      '<label class="p2-row p2-small"><input type="checkbox" data-npbid' + (d.bid ? ' checked' : '') + '> Priced by bid</label>' +
      (d.bid ? fld('Agreed bid price ($)', 'data-np="bidAmount" inputmode="decimal"', d.bidAmount) + '<p class="p2-note">The customer gets a lump-sum page: cabinets and quantities, no prices, one agreed price. Itemized: ' + c.money(t.itemized) + (toCents(d.bidAmount) > 0 ? ' · bid is ' + c.money(Math.abs(toCents(d.bidAmount) - t.itemized)) + (toCents(d.bidAmount) >= t.itemized ? ' above' : ' below') : '') + '.</p>' : '') + tables +
      '<p class="p2-note">Changing the job\'s markup or the at-cost box updates every line you haven\'t edited by hand. Tab moves line to line; type to replace the markup.</p>';
  }
  function npReview(c, d) {
    var esc = c.esc, $f = c.money, t = orderTotals(d), plan = d.pricing.plan;
    var amts = t.ok ? K.invoiceAmounts(t.total, plan) : [], dues = K.defaultDueDates(c.TODAY, d.install, plan);
    return '<h2 class="fmp1-h" style="font-size:20px">Review and create</h2><div class="p2-grid"><ul class="p2-list">' +
      '<li><span>Customer</span><b>' + esc(d.customer === '__new' ? d.newCustomer : d.customer) + '</b></li><li><span>Project</span><b>' + esc(d.project) + '</b></li>' +
      '<li><span>Signer</span><b>' + esc(d.signer) + ' · ' + esc(d.email) + '</b></li><li><span>Homes</span><b>' + t.homes + '</b></li><li><span>Address</span><b>' + esc(d.address) + '</b></li>' +
      '<li><span>Assembly</span><b>' + (asmHours(d) ? asmHours(d) + ' h × ' + $f(asmRate(d)) + ' = ' + $f(asmCents(d)) + ' per home' : 'None') + '</b></li>' +
      '<li><span>Total</span><b>' + (d.noSkus ? 'Not priced yet (no SKUs; sketch first)' : $f(t.total) + (d.bid ? ' (agreed bid)' : '')) + '</b></li></ul>' +
      '<div class="p2-form" style="flex-direction:column;align-items:stretch">' + fld('Install / delivery date (estimate)', 'data-np="install" min="' + c.TODAY + '"', d.install, 'date') +
      '<table class="fmp1-table"><thead><tr><th>Invoice</th><th>Due</th><th class="r">Amount</th></tr></thead><tbody>' + plan.map(function (p, i) {
        return '<tr><td>' + esc(invoiceLabel(d.pricing, i)) + '</td><td>' + (i === 0 ? 'On signing' : c.longDate(dues[i])) + '</td><td class="r">' + (amts[i] != null ? $f(amts[i]) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<p class="p2-note">Creating saves the project as a Quote, gives it a job code, and logs who created it. The contract is sent from the job\'s Contract tab.</p>';
  }
  function nextCode(c) {
    var yymm = c.TODAY.slice(2, 4) + c.TODAY.slice(5, 7), max = 0;
    c.store.jobs({ all: true }).forEach(function (j) { var m = String(j.jobCode).match(new RegExp('^FM-' + yymm + '-(\\d{3})$')); if (m) max = Math.max(max, +m[1]); });
    return 'FM-' + yymm + '-' + ('00' + (max ? max + 1 : 101)).slice(-3);
  }
  function createJob(c, d) {
    var t = orderTotals(d), code = nextCode(c), plan = d.pricing.plan, amts = K.invoiceAmounts(t.total, plan), dues = K.defaultDueDates(c.TODAY, d.install, plan);
    var cust = d.customer === '__new' ? d.newCustomer.trim() : d.customer;
    var houses = [];
    if (d.kind === 'builder') d.models.forEach(function (m) { var p = priceModel(d, m); for (var k = 1; k <= m.qty; k++) houses.push({ jobCode: code + '-' + (houses.length + 1), name: m.name + ' ' + k, model: m.name, color: COLORS[suffix((m.lines[0] || {}).sku)] || '', lines: m.lines.length, totalCents: p.summary.totalCents, address: A.format(d.addr) }); });
    var job = { id: code, jobCode: code, customer: cust, projectName: d.project.trim(), kind: d.kind === 'builder' ? 'builder_order' : 'single',
      quoteDate: c.TODAY, deliveryDate: d.install, originalContractCents: t.total, houses: houses, history: [], changeOrders: [],
      contacts: { signer: d.signer.trim(), buyerEmail: d.email.trim() }, source: { system: 'phase2' }, stage: 'quote', installAddress: A.format(d.addr), installAddr: JSON.parse(JSON.stringify(d.addr)),
      invoices: plan.map(function (p, i) { return { id: code + '-inv' + (i + 1), label: invoiceLabel(d.pricing, i), role: i === 0 ? 'deposit' : 'progress', changeOrderId: null, dueDate: dues[i], amountCents: amts[i], status: 'open', payments: [] }; }),
      taxCents: t.tax, costCents: t.cost, absorbedCents: 0, documents: [], fmSigner: null, esign: { state: 'none' }, contractedOn: null,
      pricing: { markupPct: d.pricing.markupPct, discountPctOfCost: d.pricing.discountPctOfCost, gaPct: d.pricing.gaPct, taxPct: d.pricing.taxPct, assemblyCents: asmCents(d), assemblyHours: asmHours(d), assemblyRateCents: asmRate(d),
        plan: plan.slice(), planNames: planStages(d.pricing).map(function (x) { return x.name; }), planMode: d.pricing.planMode === 'custom' ? 'custom' : 'preset', copiedFrom: d.copiedFrom || null },
      models: d.models.map(function (m) { return { name: d.kind === 'single' ? d.project.trim() : m.name.trim(), qty: d.kind === 'single' ? 1 : m.qty, lines: JSON.parse(JSON.stringify(m.lines)) }; }),
      bid: d.bid ? { bidCents: toCents(d.bidAmount), itemizedCents: t.itemized } : null };
    job.charges = jobCharges(job);
    if (d.noSkus) { job.models.forEach(function (m) { m.lines = []; }); job.charges = { parts: [] }; job.elevations = { rooms: [], sizes: {}, versions: [], revisions: [], sketch: { color: 'SBW', by: c.me().name, on: c.TODAY } }; }
    if (d.duplicatedFrom) job.duplicatedFrom = d.duplicatedFrom;
    if (d.customerId) job.customerId = d.customerId;
    if (d.fromTemplate) job.fromTemplate = d.fromTemplate;
    if (d.elevations && d.elevations.rooms.length) {
      var keyFor = {}; d.models.forEach(function (m, i) { keyFor[m.id] = job.models[i].name || 'Model ' + (i + 1); });
      var rs = d.elevations.rooms.filter(function (r) { return keyFor[r.set]; }).map(function (r) { r = JSON.parse(JSON.stringify(r)); r.set = keyFor[r.set]; return r; });
      if (rs.length) job.elevations = { rooms: rs, sizes: JSON.parse(JSON.stringify(d.elevations.sizes || {})), versions: [], revisions: [], copiedFrom: d.duplicatedFrom || null };
    }
    return c.store.addJob(job, c.me().name);
  }

  /* a saved job's assembly as quote labor: hours × rate, or (jobs from before Oct 2026) one flat amount per home */
  function jobLabor(pr) {
    if (pr.assemblyHours != null) return pr.assemblyHours && pr.assemblyRateCents ? [{ role: 'Assembly', rateCents: pr.assemblyRateCents, hours: pr.assemblyHours }] : [];
    return pr.assemblyCents ? [{ role: 'Assembly', rateCents: pr.assemblyCents, hours: 1 }] : [];
  }
  function priceJobModel(j, m) {
    var pr = j.pricing;
    return Q.priceHouse({ lines: m.lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct }; }),
      discountPctOfCost: pr.discountPctOfCost, labor: jobLabor(pr), gaPct: pr.gaPct, taxPct: pr.taxPct });
  }
  /* The job's charges, broken out for the books (FMStore.charges): one part per model × homes, plus any agreed bid difference */
  function jobCharges(x) {
    var S = window.FMStore, parts = [], itemized = 0;
    (x.models || []).forEach(function (m, i) {
      if (!m.lines || !m.lines.length) return;
      var p = priceJobModel(x, m); if (!p.ok) return; var n = m.qty || 1; itemized += p.summary.totalCents * n;
      parts.push(S.part((m.name || 'Model ' + (i + 1)) + (n > 1 ? ' × ' + n : ''), p.summary, n, p.internal.costCents));
    });
    if (x.bid && x.bid.bidCents && x.bid.bidCents !== itemized) parts.push(S.part('Agreed bid price ' + (x.bid.bidCents > itemized ? 'above' : 'below') + ' the itemized quote', { otherCents: x.bid.bidCents - itemized, totalCents: x.bid.bidCents - itemized }, 1, 0, 'agreed'));
    return { parts: parts };
  }
  /* Work a quote's totals out again from its lines: total (or the agreed bid), tax, cost, invoices and the charge breakdown */
  function reprice(x) {
    var itemized = 0, tax = 0, cost = 0;
    x.models.forEach(function (mm) { if (!mm.lines.length) return; var p = priceJobModel(x, mm); if (!p.ok) return; var n = mm.qty || 1; itemized += p.summary.totalCents * n; tax += p.summary.taxCents * n; cost += p.internal.costCents * n; });
    var total = x.bid ? x.bid.bidCents : itemized; if (x.bid) x.bid.itemizedCents = itemized;
    var was = x.originalContractCents; x.originalContractCents = total; x.taxCents = tax; x.costCents = cost;
    var amts = K.invoiceAmounts(total, x.pricing.plan || [100]); x.invoices.forEach(function (inv, i) { if (amts[i] != null && !inv.changeOrderId) inv.amountCents = amts[i]; });
    x.charges = jobCharges(x);
    return { total: total, itemized: itemized, was: was };
  }
  /* A quote that had no SKUs (sketched, or started without them) gets its cabinets from a supplier PDF. The sketch's cabinets
     are matched to the new SKUs by code (B30 → B30-SBW); custom sizes and codes the PDF doesn't have stay as drawn and are listed. */
  function addSkus(c, j, pdfId) {
    var pdf = pdfById(pdfId), who = c.me().name, msg = '', EL = window.FMElev; if (!pdf) return '';
    c.store.update(j.jobCode, function (x) {
      x.models = x.models && x.models.length ? x.models : [{ name: x.projectName || 'Project', qty: 1, lines: [] }];
      var m = x.models[0], mk = x.pricing && x.pricing.markupPct != null ? x.pricing.markupPct : DEFAULTS.markupPct, oldKey = m.name || 'Sketch';
      m.lines = pdf.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: mk }; });
      var rp = reprice(x), E = x.elevations, extra = '';
      if (E && E.sketch && EL) {
        var key = m.name || 'Model 1', mine = E.rooms.filter(function (r) { return r.set === oldKey || r.set === 'Sketch'; }), conv = EL.copyRooms(mine, m.lines, { set: key });
        E.rooms = E.rooms.filter(function (r) { return mine.indexOf(r) < 0; }).concat(conv.rooms); delete E.sketch;
        extra = conv.items ? ' The sketch\'s ' + conv.items + ' cabinet' + (conv.items === 1 ? ' was' : 's were') + ' matched by code' + (conv.unmatched.length ? '; not on the PDF, kept as drawn: ' + conv.unmatched.map(function (u) { return u.code + ' ×' + u.count; }).join(', ') : '') + '.' : '';
      }
      msg = pdf.lines.length + ' cabinet lines added from ' + pdf.name + '. Quote total ' + c.money(rp.was || 0) + ' → ' + c.money(rp.total) + '.' + extra;
      return x;
    }, 'SKUs added from ' + pdf.name + ' by ' + who + '.', who);
    return msg;
  }
  /* Elevations → "Add them to the quote": cabinets placed beyond a quote's quantities raise those quantities (same unit cost and
     markup), and the quote total and invoices are worked out again. Only for quotes not yet sent; ex: [{ sku, code, extra }]. */
  function addToQuote(c, j, setKey, ex) {
    var who = c.me().name, msg = '';
    c.store.update(j.jobCode, function (x) {
      var mi = -1; (x.models || []).forEach(function (m, i) { if ((m.name || 'Model ' + (i + 1)) === setKey) mi = i; }); if (mi < 0) mi = 0;
      var m = x.models[mi], added = [];
      ex.forEach(function (q) { var l = m.lines.filter(function (y) { return String(y.sku).toUpperCase() === String(q.sku).toUpperCase(); })[0]; if (l) { l.qty += q.extra; added.push(q.code + ' +' + q.extra); } });
      var rp = reprice(x), total = rp.total, itemized = rp.itemized, was = rp.was;
      msg = 'Added to the quote: ' + added.join(', ') + '. ' + (x.bid ? 'The agreed bid stays ' + c.money(total) + '; itemized is now ' + c.money(itemized) + '.' : 'Quote total ' + c.money(was) + ' → ' + c.money(total) + '; the invoices follow.');
      return x;
    }, 'Quote quantities raised from the elevations by ' + who + '.', who);
    return msg;
  }
  /* Elevations on a signed job → "Start a change order for them": opens a change order with the extra cabinets already added. */
  function startCO(c, j, setKey, ex) {
    var house = c.W && j.jobCode === c.W.jobCode ? ((j.houses || []).filter(function (h) { return h.model === setKey; })[0] || {}).jobCode || null : j.houses && j.houses.length > 1 ? j.houses[0].jobCode : null;
    var bl = baseLines(c, j, house), cur = JSON.parse(JSON.stringify(bl)), unknown = [], pdfLines = [].concat.apply([], samplePdfs().map(function (p) { return p.lines; }));
    ex.forEach(function (q) {
      var k = String(q.sku).toUpperCase(), have = cur.filter(function (l) { return String(l.sku).toUpperCase() === k; })[0];
      if (have) { have.qty += q.extra; return; }
      var src = pdfLines.filter(function (l) { return String(l.sku).toUpperCase() === k; })[0];
      if (src) cur.push({ sku: src.sku, desc: src.desc, qty: q.extra, unitCostCents: src.unitCostCents }); else unknown.push(q.code + ' ×' + q.extra);
    });
    c.ui.co = newCO(c, j, { step: 1, type: 'add', note: 'Cabinets added on the elevations: ' + ex.map(function (q) { return q.code + ' ×' + q.extra; }).join(', ') + '.', house: house, base: bl, current: cur,
      errors: unknown.length ? [unknown.join(', ') + (unknown.length === 1 ? ' isn\'t' : ' aren\'t') + ' on the order or a supplier PDF yet. Use Add a cabinet so it has a cost.'] : [] });
  }

  /* quote pages for the packet (new Phase 2 jobs) */
  function quotesFor(j) {
    if (!j.models) return [];
    var pr = j.pricing, out = [];
    j.models.forEach(function (m) {
      var p = priceJobModel(j, m);
      var meta = { house: m.name + (m.qty > 1 ? ' (× ' + m.qty + ')' : ''), jobCode: j.jobCode, buyer: j.customer, signer: j.contacts.signer, quoteDate: j.quoteDate, deliveryDate: j.deliveryDate, address: j.installAddress, color: COLORS[suffix((m.lines[0] || {}).sku)] || '' };
      out.push(j.bid ? D.renderBidQuoteDoc(p, j.models.length === 1 ? j.bid.bidCents : p.summary.totalCents, meta) : Q.renderHouseQuoteDoc(p, meta));
    });
    return out;
  }

  /* ================= Change orders (reworked in 2.11.0, HANDOFF.md §32) =================
     Start from what happened (add, swap, remove or return, backordered, damaged, our mistake, something else); every tool stays
     available whatever was picked: + / − on a line, Add a cabinet by hand, a supplier PDF, Swap, Replace (damaged, at our cost),
     Backordered (wait for it), other charges or credits, and a new delivery date. */
  function baseLines(c, j, house) {
    if (B && j.jobCode === B.jobCode) return B.model.lines.filter(function (l) { return !l.noCharge; }).map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost), markupPct: l.markupPct }; });
    if (W && j.jobCode === W.jobCode) { var h = j.houses.filter(function (x) { return x.jobCode === house; })[0] || j.houses[0]; return W.models[h.model].lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost), markupPct: l.markupPct }; }); }
    if (j.models && j.models[0]) return JSON.parse(JSON.stringify(j.models[0].lines));
    return [];
  }
  function houseSuffix(c, j, house) { var l = baseLines(c, j, house)[0]; return l ? suffix(l.sku) : ''; }
  function settingsFor(j) {
    var p = j.pricing || {};
    return { markupPct: p.markupPct != null ? p.markupPct : 35, discountPctOfCost: p.discountPctOfCost || 0, gaPct: p.gaPct || 0, taxPct: p.taxPct || 0 };
  }
  /* A change order's own pricing: starts as the job's, and any of it can be changed for this change order alone. */
  function coDefaults(j) {
    var s = settingsFor(j), p = j.pricing || {};
    return { markupPct: String(s.markupPct), discountPctOfCost: String(s.discountPctOfCost), gaPct: String(s.gaPct), taxPct: String(s.taxPct),
      asmHours: '', asmRate: p.assemblyRateCents ? (p.assemblyRateCents / 100).toFixed(2) : DEFAULTS.assemblyRate };
  }
  function coSettings(f) {
    var p = f.pricing, h = num(p.asmHours), r = toCents(p.asmRate);
    return { markupPct: num(p.markupPct), discountPctOfCost: num(p.discountPctOfCost), gaPct: num(p.gaPct), taxPct: num(p.taxPct),
      labor: h > 0 && r > 0 ? [{ role: 'Assembly', rateCents: r, hours: h }] : [] };
  }
  function coDiff(f) { var d = CO.diffLines(f.base, f.current); d.replaced = f.replaced || []; return d; }
  function coExtras(f) { return (f.extras || []).map(function (x) { return { label: x.label, amountCents: toCents(x.amount), taxable: !!x.taxable }; }); }
  function goodExtras(f) { return coExtras(f).filter(function (x) { return String(x.label || '').trim() && x.amountCents && !isNaN(x.amountCents); }); }
  function coPriced(f) { var d = coDiff(f); return CO.priceChange({ added: d.added, removed: d.removed, extras: goodExtras(f) }, coSettings(f)); }
  function sellChanges(f) { var d = coDiff(f); return !!(d.added.length || d.removed.length || goodExtras(f).length); }
  function needsPricing(f) { return sellChanges(f) || num(f.pricing.asmHours) > 0; }
  function coDiffers(j, f) { var a = coDefaults(j), p = f.pricing; return ['markupPct', 'discountPctOfCost', 'gaPct', 'taxPct'].filter(function (k) { return num(a[k]) !== num(p[k]); }); }
  function replacedCost(f) { return (f.replaced || []).reduce(function (t, l) { return t + (l.unitCostCents || 0) * l.qty; }, 0); }
  function reasonLabel(f) { return f.type === 'backorder' && f.boMode === 'wait' ? CO.CHANGE_REASONS.backorder_wait : CO.CHANGE_REASONS[(CO.TYPES[f.type] || {}).reason] || 'Other'; }
  /* SKUs the team might type: what's on the job, then every supplier PDF on file, with their costs. */
  /* Add a list of SKUs to the change order. Known SKUs (from the order or a supplier PDF on file) bring their description and cost;
     ones without a cost wait in a list with "Add" so the team enters it. */
  function addSkuList(c, f, parsed, source) {
    var known = knownSkus(f), ready = [], missing = [];
    parsed.lines.forEach(function (l) {
      var k = known[l.sku] || null, cost = l.unitCostCents || (k && k.unitCostCents) || null;
      if (cost) ready.push({ sku: k ? k.sku : l.sku, desc: l.desc || (k && k.desc) || '', qty: l.qty, unitCostCents: cost });
      else missing.push({ sku: l.sku, qty: l.qty, desc: l.desc || (k && k.desc) || '' });
    });
    if (ready.length) f.current = CO.mergeLines(f.current, ready, 'add').lines;
    f.skuNote = { source: source, added: ready.reduce(function (t, l) { return t + l.qty; }, 0), lines: ready.length, missing: missing, skipped: parsed.skipped };
  }
  function skuNoteHTML(c, f) {
    var N = f.skuNote; if (!N) return '';
    var esc = c.esc, parts = [];
    if (N.pdfOnly) return '<div class="fmp1-note fmp1-note--info p2-small" role="status"><span><b>' + esc(N.source) + '</b> will be attached to this change order. Live, the tool reads every SKU and quantity from the supplier\'s PDF (the same reader as New Project). This preview can\'t read PDFs, so paste the SKUs or upload a spreadsheet of them.</span> <button class="fmp1-btn fmp1-btn--quiet" data-coskuok>OK</button></div>';
    parts.push(N.lines ? 'Added ' + N.added + ' cabinet' + (N.added === 1 ? '' : 's') + ' (' + N.lines + ' SKU' + (N.lines === 1 ? '' : 's') + ') from ' + esc(N.source) + '.' : 'Nothing was added from ' + esc(N.source) + '.');
    var miss = N.missing.length ? '<div class="p2-co-miss"><b>Needs a unit cost</b> (not on the order or a supplier PDF on file):<ul>' + N.missing.map(function (m, i) {
      return '<li><span class="fmp1-code">' + esc(m.sku) + '</span> ×' + m.qty + ' <button class="fmp1-btn fmp1-btn--quiet" data-coaddsku="' + i + '">Add with a cost</button></li>'; }).join('') + '</ul></div>' : '';
    var skip = N.skipped.length ? '<span class="p2-small">Couldn\'t read ' + N.skipped.length + ' line' + (N.skipped.length === 1 ? '' : 's') + ': ' + N.skipped.slice(0, 4).map(function (x) { return '"' + esc(x) + '"'; }).join(', ') + (N.skipped.length > 4 ? '…' : '') + '</span>' : '';
    return '<div class="fmp1-note fmp1-note--' + (N.missing.length || N.skipped.length ? 'alert' : 'good') + ' p2-small p2-co-skunote" role="status"><span>' + parts.join(' ') + '</span>' + miss + skip + ' <button class="fmp1-btn fmp1-btn--quiet" data-coskuok>Done</button></div>';
  }
  /* Uploaded SKU files: CSV / text are read here. PDFs go to the shared supplier PDF reader on the server; in this preview a PDF
     that's already on file (by its order number) is recognized, and any PDF is attached to the change order when it's saved. */
  function readSkuFile(c, el) {
    var f = c.ui.co, file = el.files && el.files[0]; if (!f || !file) return;
    var ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1] || '';
    el.value = '';
    if (/^pdf$/i.test(ext)) {
      return file.arrayBuffer().then(function (buf) {
        f.attach = (f.attach || []).filter(function (a) { return a.name !== file.name; }).concat([{ name: file.name, size: file.size, type: 'application/pdf', blob: new Blob([buf], { type: 'application/pdf' }) }]);
        var reader = window.FMSupplierPdf;
        if (reader && reader.parseBuffer) {
          return reader.parseBuffer(buf).then(function (parsed) {
            if (parsed && parsed.lines && parsed.lines.length) addSkuList(c, f, parsed, file.name);
            else f.skuNote = { source: file.name, pdfOnly: true };
            c.render();
          }).catch(function () {
            f.skuNote = { source: file.name, pdfOnly: true };
            c.render();
          });
        }
        var on = samplePdfs().filter(function (p) { return p.orderNumber && file.name.indexOf(p.orderNumber) >= 0; })[0];
        if (on) addSkuList(c, f, { lines: on.lines.map(function (l) { return { sku: l.sku, qty: l.qty, desc: l.desc, unitCostCents: l.unitCostCents }; }), skipped: [] }, file.name);
        else f.skuNote = { source: file.name, pdfOnly: true };
        c.render();
      });
    }
    file.text().then(function (t) { addSkuList(c, f, CO.parseSkus(t), file.name); c.render(); });
  }
  /* Supplier PDFs uploaded on the Cabinets step are filed under the new change order. */
  function attachCoFiles(c, jobCode, files) {
    if (!files || !files.length || !c.files) return;
    var j = c.store.job(jobCode), co = j.changeOrders[j.changeOrders.length - 1];
    files.forEach(function (a) {
      a.blob.arrayBuffer().then(function (buf) { return window.crypto.subtle.digest('SHA-256', buf); }).then(function (h) {
        var hx = Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        var jj = c.store.job(jobCode), all = jj.documents || [], seq = all.length + 1; while (all.some(function (d) { return d.id === jobCode + '-doc' + seq; })) seq++;
        var r = window.FMFiles.check({ name: a.name, size: a.size, type: a.type, sha256: hx }, { category: 'other', changeOrder: co.number, title: 'Supplier PDF · ' + a.name.replace(/\.pdf$/i, '') }, { jobCode: jobCode, by: c.me().name, today: c.TODAY, existing: all, seq: seq });
        if (!r.ok) return;
        return c.files.put(r.doc.id, a.blob).then(function () { c.store.update(jobCode, function (x) { x.documents = (x.documents || []).concat([r.doc]); return x; }, 'Supplier PDF attached to change order ' + co.number + ': ' + a.name + '.', c.me().name); c.render(); });
      }).catch(function () { /* the change order is saved either way */ });
    });
  }
  function knownSkus(f) {
    var out = {}, cts = function (l) { return l.unitCostCents != null ? l.unitCostCents : l.unitCost != null ? FM.toCents(l.unitCost) : null; };
    function put(l) { var c = cts(l); if (l && l.sku && c > 0) out[String(l.sku).toUpperCase()] = { sku: l.sku, desc: l.desc, unitCostCents: c }; }
    [].concat.apply([], samplePdfs().map(function (p) { return p.lines; })).forEach(put);
    if (W && f.job === W.jobCode) { Object.keys(W.models).forEach(function (m) { W.models[m].lines.forEach(put); }); (W.changeOrders || []).forEach(function (co) { (co.lines || []).forEach(put); }); }
    if (B && f.job === B.jobCode) B.model.lines.forEach(put);
    f.base.forEach(put);
    return out;
  }
  function newCO(c, j, over) {
    var house = j.houses && j.houses.length > 1 ? j.houses[0].jobCode : null, bl = baseLines(c, j, house);
    var f = { job: j.jobCode, step: 0, type: null, boMode: null, note: '', house: house, base: bl, current: JSON.parse(JSON.stringify(bl)), replaced: [], extras: [], waitFor: [], newDate: '',
      choice: null, customAmt: '', customNote: '', colorOk: false, errors: [], pricing: coDefaults(j), addForm: null, rowForm: null };
    for (var k in (over || {})) f[k] = over[k];
    return f;
  }
  var CO_STEPS = ['What happened', 'Cabinets', 'Price', 'Review'];
  var CO_TIPS = {
    add: 'Use + on a line, or Add a cabinet that isn\'t on the order yet. To add many at once, use Upload SKUs (the supplier\'s PDF or a spreadsheet) or Paste SKUs.',
    swap: 'Click Swap on the line that\'s changing and enter the cabinet that takes its place.',
    remove: 'Use − to take cabinets off (down to 0 removes the line). The customer is credited what they paid. A restocking fee goes under Other charges below.',
    backorder: 'Click Swap on the backordered cabinet and enter the one that\'s in stock.',
    backorder_wait: 'Click Backordered on each cabinet that\'s late. The order doesn\'t change; the new date is recorded and the customer can be told.',
    damage: 'Click Replace on the damaged cabinet. It\'s reordered at our cost, and you note who the claim goes to.',
    mistake: 'Swap the wrong cabinet for the right one, or Replace one that has to be reordered.',
    other: 'Change cabinets if you need to, or go straight to Other charges or credits (labor, freight, a fee or a credit).'
  };
  var EXTRA_PRESETS = [['Restocking fee', true], ['Freight', false], ['Extra labor', false], ['Credit', false], ['Other charge', false]];
  var CO_TONE = { 'pending approval': 'fmp1-pill--alert', sent: 'fmp1-pill--proposed', withdrawn: '', recorded: 'fmp1-pill--good', approved: 'fmp1-pill--good', signed: 'fmp1-pill--good', invoiced: 'fmp1-pill--good', paid: 'fmp1-pill--good' };

  function coCard(c, j, co) {
    var esc = c.esc, $f = c.money, ui = c.ui, full = c.me().access === 'full', P = co.pricing;
    var moves = (co.removed || []).map(function (r) { return r.to ? esc(r.sku) + ' ' + r.from + ' → ' + r.to : 'Removed ' + esc(r.sku) + ' ×' + r.qty; }).concat((co.added || []).map(function (a) { return 'Added ' + esc(a.sku) + ' ×' + a.qty; }))
      .concat((co.replaced || []).map(function (r) { return 'Replaced ' + esc(r.sku) + ' ×' + r.qty + (r.why ? ' (' + esc(r.why) + ')' : ''); }))
      .concat((co.waitFor || []).map(function (w) { return 'Backordered ' + esc(w.sku) + ' ×' + w.qty; }))
      .concat((co.extras || []).map(function (x) { return esc(x.label) + ' ' + $f(x.amountCents); })).join(' · ');
    var own = P && co.kind === 'charge' ? num(P.discountPctOfCost) + '% discount · ' + num(P.gaPct) + '% G&amp;A · ' + num(P.taxPct) + '% tax' + (P.labor && P.labor[0] ? ' · assembly ' + P.labor[0].hours + ' h × ' + $f(P.labor[0].rateCents) : '') : '';
    var claims = (co.replaced || []).filter(function (r) { return r.claim && r.claim !== 'none'; }).map(function (r) { return (CO.CLAIMS[r.claim] || r.claim).replace(/ \(.*\)$/, ''); });
    var absorbed = co.status !== 'withdrawn' && (co.absorbedCents || co.absorbedIsEstimate || (co.replaced || []).length || co.kind === 'courtesy') ? '<span class="p2-small fmp1-faint">Internal: shop absorbs ' + $f(co.absorbedCents || 0) +
      (CO.claimPending(co) ? ' until the claim with the ' + esc(claims.join(' / ').toLowerCase()) + ' is paid' : co.absorbedIsEstimate ? (co.kind === 'courtesy' ? ' (before any supplier credit)' : ' (assumes the supplier takes the removed cabinets back in full)') : '') + '</span>' : '';
    var credits = CO.creditsOf(co).filter(function (cr) { return cr.on || cr.by; }).map(function (cr) { return '<span class="p2-small fmp1-faint">' + (cr.from === 'freight' ? 'Freight carrier' : 'Supplier') + (cr.none ? ' won\'t credit the ' : ' credited ' + $f(cr.amountCents) + ' for the ') + (cr.for === 'returned' ? 'returned cabinets' : 'damage claim') + (cr.on ? ', ' + c.longDate(cr.on) : '') + (cr.reference ? ' (' + esc(cr.reference) + ')' : '') + '</span>'; }).join('');
    var acts = [];
    if (co.status === 'pending approval') acts.push(full ? '<button class="fmp1-btn fmp1-btn--primary" data-coapprove="' + esc(co.id) + '">Approve courtesy</button>' : '<span class="p2-small fmp1-faint">Waiting for someone with full access to approve.</span>');
    if (co.status !== 'withdrawn') acts.push('<button class="fmp1-btn' + (acts.length ? ' fmp1-btn--quiet' : '') + '" data-codoc="' + esc(co.id) + '">Open change order</button>');
    if (co.status !== 'withdrawn' && ((co.removed || []).length || (co.replaced || []).length)) acts.push('<button class="fmp1-btn fmp1-btn--quiet" data-cocredit="' + esc(co.id) + '">Record a credit</button>');
    if (co.status !== 'withdrawn') acts.push('<label class="fmp1-btn fmp1-btn--quiet p2-filebtn">Attach a file<input type="file" data-upload data-upco="' + co.number + '" accept="' + window.FMFiles.accept() + '"></label>');
    if (co.status === 'sent' || co.status === 'pending approval') acts.push('<button class="fmp1-btn fmp1-btn--quiet" data-cowd="' + esc(co.id) + '">Withdraw</button>');
    var form = '';
    if (ui.coCredit && ui.coCredit.id === co.id) {
      var F = ui.coCredit, both = (co.removed || []).length && (co.replaced || []).length;
      form = '<div class="p2-form" data-coform>' + (both ? '<label class="p2-fld"><span>For</span><select class="fmp1-input" data-cocr="for"><option value="returned"' + (F.for === 'returned' ? ' selected' : '') + '>Returned cabinets</option><option value="damaged"' + (F.for === 'damaged' ? ' selected' : '') + '>Damage claim</option></select></label>' : '') +
        '<label class="p2-fld"><span>From</span><select class="fmp1-input" data-cocr="from"><option value="supplier">Supplier</option><option value="freight"' + (F.from === 'freight' ? ' selected' : '') + '>Freight carrier</option></select></label>' +
        fld('Amount ($)', 'data-cocr="amount" inputmode="decimal" data-autofocus', F.amount) + fld('Date', 'data-cocr="on" max="' + c.TODAY + '"', F.on, 'date') + fld('Credit memo / reference', 'data-cocr="reference"', F.reference) +
        '<label class="p2-row p2-small"><input type="checkbox" data-cocr="none"' + (F.none ? ' checked' : '') + '> They won\'t credit it</label>' +
        '<button class="fmp1-btn fmp1-btn--primary" data-cocrsave>Save credit</button><button class="fmp1-btn fmp1-btn--quiet" data-cocrcancel>Cancel</button>' +
        (F.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(F.error) + '</span>' : '') + '</div>';
    }
    if (ui.coWd && ui.coWd.id === co.id) form = '<div class="p2-form" data-coform>' + fld('Why it\'s withdrawn', 'data-cowdr data-autofocus', ui.coWd.reason) + '<button class="fmp1-btn fmp1-btn--primary" data-cowdsave>Withdraw</button><button class="fmp1-btn fmp1-btn--quiet" data-cowdcancel>Cancel</button>' +
      (ui.coWd.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(ui.coWd.error) + '</span>' : '') + '</div>';
    var docs = c.docRows(j, { packet: false, changeOrder: co.number });
    return '<li style="flex-direction:column;align-items:stretch"' + (co.status === 'withdrawn' ? ' class="p2-co-wd"' : '') + '><div class="p2-between"><b>Change order ' + co.number + (co.kind === 'courtesy' ? ' · courtesy' : co.kind === 'notice' ? ' · no change to the contract' : co.amountCents < 0 ? ' · credit' : '') + '</b><span class="p2-row"><span class="fmp1-pill ' + (CO_TONE[co.status] || '') + '">' + esc(co.status) + '</span><b>' + $f(co.amountCents || 0) + '</b></span></div>' +
      '<span class="p2-small fmp1-muted">' + c.longDate(co.date) + ' · ' + esc(co.reason || '') + (co.note ? ': ' + esc(co.note) : '') + '</span>' + (moves ? '<span class="p2-small">' + moves + '</span>' : '') +
      (co.newDeliveryDate ? '<span class="p2-small">New delivery date ' + c.longDate(co.newDeliveryDate) + (co.status === 'sent' || co.status === 'pending approval' ? ' (applies once it goes through)' : '') + '</span>' : '') +
      (own ? '<span class="p2-small fmp1-faint">Priced with ' + own + (co.differsFromJob && co.differsFromJob.length || co.source ? ' (its own settings)' : '') + (co.priced && co.priced.printed ? '. Numbers as printed on the executed PDF.' : '') + '</span>' : '') +
      (window.P2Elev && window.P2Elev.coNote ? window.P2Elev.coNote(c, j, co) : '') + absorbed + credits +
      (co.withdrawn ? '<span class="p2-small fmp1-faint">Withdrawn by ' + esc(co.withdrawn.by) + (co.withdrawn.on ? ' on ' + c.longDate(co.withdrawn.on) : '') + ': ' + esc(co.withdrawn.reason) + '</span>' : '') +
      (co.status === 'sent' && window.P2Sign ? window.P2Sign.coBlock(c, j, co) : '') +
      docs + (acts.length ? '<span class="p2-row p2-wrap">' + acts.join('') + '</span>' : '') + form + '</li>';
  }

  function renderChanges(c, j) {
    var f = c.ui.co && c.ui.co.job === j.jobCode ? c.ui.co : null, cos = j.changeOrders || [];
    var canStart = j.stage !== 'quote' && j.stage !== 'lost';
    var head = '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Change orders · ' + cos.length + '</span>' +
      (f ? '' : canStart ? '<button class="fmp1-btn fmp1-btn--primary" data-costart>New change order</button>' : '<span class="p2-small fmp1-faint">Change orders apply to signed jobs. Edit the quote instead.</span>') + '</div>' +
      (c.ui.up && c.ui.up.job === j.jobCode && c.ui.up.co != null && (c.ui.up.msg || c.ui.up.err) ? (c.ui.up.err ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span>' + c.esc(c.ui.up.err.join(' ')) + '</span></div>' : '<div class="fmp1-note fmp1-note--good p2-small" role="status">✓ ' + c.esc(c.ui.up.msg) + '</div>') : '') +
      (cos.length ? '<ul class="p2-list">' + cos.map(function (co) { return coCard(c, j, co); }).join('') + '</ul>' : '<p class="p2-empty">No change orders on this job. Anything that changes after the contract is signed (more cabinets, a swap, a return, a backorder, damage) goes here.</p>') + '</div>';
    return head + (f ? coFlow(c, j, f) : '');
  }

  function coFlow(c, j, f) {
    var esc = c.esc, $f = c.money, d = coDiff(f), sfx = houseSuffix(c, j, f.house), T = CO.TYPES[f.type];
    var tabs = '<nav class="p2-tabs" aria-label="Change order steps">' + CO_STEPS.map(function (s, i) { return '<a href="#" data-costep="' + i + '"' + (i === f.step ? ' aria-current="page"' : '') + '>' + (i + 1) + '. ' + s + '</a>'; }).join('') + '</nav>';
    var body;
    if (f.step === 0) {
      body = '<div class="p2-cotypes" role="group" aria-label="What happened">' + Object.keys(CO.TYPES).map(function (k) {
          return '<button class="p2-cotype" data-cotype="' + k + '" aria-pressed="' + (f.type === k) + '"><b>' + esc(CO.TYPES[k].label) + '</b><span>' + esc(CO.TYPES[k].help) + '</span></button>'; }).join('') + '</div>' +
        (f.type === 'backorder' ? '<div class="p2-chips" role="group" aria-label="Backordered: what are we doing?"><button class="fmp1-btn" data-cobo="swap" aria-pressed="' + (f.boMode === 'swap') + '"><b>Swap in another cabinet</b></button><button class="fmp1-btn" data-cobo="wait" aria-pressed="' + (f.boMode === 'wait') + '"><b>Wait for it</b>&nbsp;and record the new date</button></div>' : '') +
        (j.houses && j.houses.length > 1 ? '<label class="p2-fld"><span>House</span><select class="fmp1-input" data-cof="house">' + j.houses.map(function (h) { return '<option value="' + esc(h.jobCode) + '"' + (f.house === h.jobCode ? ' selected' : '') + '>' + esc(h.name + ' · ' + h.color) + '</option>'; }).join('') + '</select></label><p class="p2-note">A PDF that covers several houses is split by color; each color goes to the houses that use it.</p>' : '') +
        '<label class="p2-fld"><span>What happened, in a sentence (for the paper trail)</span><textarea class="fmp1-input" rows="2" data-cof="note" placeholder="' + esc(T ? { add: 'Buyer added a pantry cabinet', swap: 'Buyer wants a 36" sink base instead of the 30"', remove: 'Buyer is returning two wall cabinets', backorder: 'B30 backordered until Dec 12', damage: 'W3042 arrived with a cracked side panel', mistake: 'We ordered the wrong hinge side', other: 'Second delivery trip' }[f.type] : '') + '">' + esc(f.note) + '</textarea></label>' +
        '<div class="p2-row p2-wrap">' + fld('New delivery date' + (f.type === 'backorder' && f.boMode === 'wait' ? '' : ' (only if it moves)'), 'data-cof="newDate"', f.newDate, 'date') +
        '<span class="p2-small fmp1-faint">Now ' + c.longDate(j.deliveryDate) + '. It changes on the job once this change order goes through.</span></div>';
    } else if (f.step === 1) {
      var bad = CO.colorCheck(f.current.filter(function (l) { return l.qty > 0; }), sfx), before = {}, wait = f.type === 'backorder' && f.boMode === 'wait';
      f.base.forEach(function (l) { before[l.sku] = l.qty; });
      var tip = CO_TIPS[wait ? 'backorder_wait' : f.type] || CO_TIPS.other, known = knownSkus(f), A = f.addForm, R = f.rowForm;
      var addForm = A ? '<div class="p2-form" data-coform><b style="flex-basis:100%">Add a cabinet</b>' + fld('SKU', 'data-coadd="sku" list="p2-co-skus" data-autofocus', A.sku) + fld('Description', 'data-coadd="desc"', A.desc) +
          fld('Qty', 'data-coadd="qty" inputmode="numeric"', A.qty) + fld('Unit cost ($)', 'data-coadd="cost" inputmode="decimal"', A.cost) +
          '<button class="fmp1-btn fmp1-btn--primary" data-coaddsave>Add</button><button class="fmp1-btn fmp1-btn--quiet" data-coaddcancel>Cancel</button>' +
          '<span class="p2-small fmp1-faint" style="flex-basis:100%">A SKU from the order or a supplier PDF fills in its description and cost. Unit cost is the supplier\'s price before the manufacturer discount.</span>' +
          (A.errors ? '<ul class="p2-errs p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + A.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>' : '';
      var list = '<datalist id="p2-co-skus">' + Object.keys(known).map(function (k) { return '<option value="' + esc(known[k].sku) + '">' + esc(known[k].desc || '') + '</option>'; }).join('') + '</datalist>';
      var rows = f.current.map(function (l, i) {
        var b = before[l.sku] || 0, changed = b !== l.qty;
        var row = '<tr' + (changed ? ' class="p2-co-chg"' : '') + '><td class="fmp1-code">' + esc(l.sku) + (l.swapFor ? '<br><span class="p2-small fmp1-faint">swapped for ' + esc(l.swapFor) + '</span>' : '') + '</td><td class="p2-np-desc">' + esc(l.desc || '') + '</td>' +
          '<td><span class="p2-row" style="flex-wrap:nowrap"><button class="fmp1-btn" data-coqty="' + i + '" data-d="-1" aria-label="One fewer ' + esc(l.sku) + '"' + (l.qty ? '' : ' disabled') + '>−</button><b style="min-width:1.5em;text-align:center">' + l.qty + '</b><button class="fmp1-btn" data-coqty="' + i + '" data-d="1" aria-label="One more ' + esc(l.sku) + '">+</button></span></td>' +
          '<td class="r">' + (changed ? b + ' → ' + l.qty : '') + '</td><td class="r">' + $f(l.unitCostCents) + '</td>' +
          '<td class="r p2-act">' + (l.qty > 0 ? (wait ? '<button class="fmp1-btn fmp1-btn--quiet" data-corow="wait:' + i + '">Backordered</button>' : '<button class="fmp1-btn fmp1-btn--quiet" data-corow="swap:' + i + '">Swap</button><button class="fmp1-btn fmp1-btn--quiet" data-corow="repl:' + i + '">Replace</button>') : '') + '</td></tr>';
        if (R && R.idx === i) {
          var inner = R.kind === 'swap' ? '<b style="flex-basis:100%">Swap ' + esc(l.sku) + ' for another cabinet</b>' + fld('How many', 'data-corf="qty" inputmode="numeric"', R.qty) + fld('New SKU', 'data-corf="sku" list="p2-co-skus" data-autofocus', R.sku) + fld('Description', 'data-corf="desc"', R.desc) + fld('Unit cost ($)', 'data-corf="cost" inputmode="decimal"', R.cost) +
              '<button class="fmp1-btn fmp1-btn--primary" data-corfsave>Swap</button>'
            : R.kind === 'repl' ? '<b style="flex-basis:100%">Replace damaged ' + esc(l.sku) + ' (reordered at our cost; the customer\'s order doesn\'t change)</b>' + fld('How many', 'data-corf="qty" inputmode="numeric" data-autofocus', R.qty) + fld('Unit cost ($)', 'data-corf="cost" inputmode="decimal"', R.cost) +
              '<label class="p2-fld"><span>Claim goes to</span><select class="fmp1-input" data-corf="claim"><option value="">Choose…</option>' + Object.keys(CO.CLAIMS).map(function (k) { return '<option value="' + k + '"' + (R.claim === k ? ' selected' : '') + '>' + esc(CO.CLAIMS[k]) + '</option>'; }).join('') + '</select></label>' +
              fld('What\'s wrong with it', 'data-corf="why" placeholder="cracked side panel"', R.why) + '<button class="fmp1-btn fmp1-btn--primary" data-corfsave>Add replacement</button>'
            : '<b style="flex-basis:100%">' + esc(l.sku) + ' is backordered</b>' + fld('How many', 'data-corf="qty" inputmode="numeric" data-autofocus', R.qty) + '<button class="fmp1-btn fmp1-btn--primary" data-corfsave>Mark backordered</button>';
          row += '<tr><td colspan="6"><div class="p2-form" data-coform>' + inner + '<button class="fmp1-btn fmp1-btn--quiet" data-corfcancel>Cancel</button>' + (R.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(R.error) + '</span>' : '') + '</div></td></tr>';
        }
        return row;
      }).join('');
      var repl = f.replaced.length ? '<div class="p2-co-sub"><b>Replacements at our cost</b><span class="p2-small fmp1-faint"> · not billed to the customer · ' + $f(replacedCost(f)) + '</span><ul class="p2-list">' + f.replaced.map(function (r, i) {
          return '<li><span><span class="fmp1-code">' + esc(r.sku) + '</span> ×' + r.qty + ' · ' + $f(r.unitCostCents * r.qty) + (r.why ? ' · ' + esc(r.why) : '') + ' · claim: ' + esc(CO.CLAIMS[r.claim] || '') + '</span><button class="fmp1-btn fmp1-btn--quiet" data-corm="replaced:' + i + '">Remove</button></li>'; }).join('') + '</ul></div>' : '';
      var waits = f.waitFor.length ? '<div class="p2-co-sub"><b>Backordered</b><ul class="p2-list">' + f.waitFor.map(function (w, i) { return '<li><span><span class="fmp1-code">' + esc(w.sku) + '</span> ×' + w.qty + (f.newDate ? ' · now expected ' + c.longDate(f.newDate) : '') + '</span><button class="fmp1-btn fmp1-btn--quiet" data-corm="waitFor:' + i + '">Remove</button></li>'; }).join('') + '</ul></div>' : '';
      var extras = '<div class="p2-co-sub"><b>Other charges or credits</b><span class="p2-small fmp1-faint"> · restocking fee, freight, extra labor, or a credit (enter a credit as a minus amount)</span>' +
        (f.extras.length ? '<div class="fmp1-table-wrap"><table class="fmp1-table p2-co-extras"><tbody>' + f.extras.map(function (x, i) {
          return '<tr><td><input class="fmp1-input" data-coex="' + i + ':label" value="' + esc(x.label) + '" aria-label="What it is"></td><td class="r"><input class="fmp1-input p2-amt" inputmode="decimal" data-coex="' + i + ':amount" value="' + esc(x.amount) + '" aria-label="Amount" placeholder="0.00"></td>' +
            '<td><label class="p2-row p2-small"><input type="checkbox" data-coex="' + i + ':taxable"' + (x.taxable ? ' checked' : '') + '> taxable</label></td><td class="r"><button class="fmp1-btn fmp1-btn--quiet" data-corm="extras:' + i + '">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
        '<div class="p2-row p2-wrap">' + EXTRA_PRESETS.map(function (p, i) { return '<button class="fmp1-btn fmp1-btn--quiet" data-coexadd="' + i + '">+ ' + p[0] + '</button>'; }).join('') + '</div></div>';
      body = '<p class="p2-note">' + esc(tip) + '</p>' +
        '<div class="p2-row p2-wrap p2-co-addrow">' + (A ? '' : '<button class="fmp1-btn" data-coaddopen>+ Add a cabinet</button>') +
          '<label class="fmp1-btn p2-filebtn">Upload SKUs<input type="file" data-coskufile accept=".pdf,.csv,.tsv,.txt"></label>' +
          '<button class="fmp1-btn" data-copaste aria-expanded="' + !!f.paste + '">Paste SKUs</button>' +
          '<label class="p2-fld" style="min-width:240px"><span>Or a supplier PDF already on file</span><select class="fmp1-input" data-copdf><option value="">Choose a PDF…</option>' + samplePdfs().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' +
        (f.paste ? '<div class="p2-form" data-coform><label class="p2-fld" style="flex:1 1 100%"><span>One cabinet per line, with its quantity: "W3042-SBW 2" or "2 x DC224". Copying rows from a spreadsheet works too.</span><textarea class="fmp1-input p2-co-paste" rows="6" data-copastetext data-autofocus>' + esc(f.paste.text || '') + '</textarea></label>' +
          '<button class="fmp1-btn fmp1-btn--primary" data-copasteadd>Add these</button><button class="fmp1-btn fmp1-btn--quiet" data-copaste>Cancel</button></div>' : '') +
        skuNoteHTML(c, f) + addForm + list +
        (bad.length ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert">' + bad.length + ' cabinet line' + (bad.length > 1 ? 's don\'t' : ' doesn\'t') + ' match this house\'s color (' + esc(COLORS[sfx] || sfx) + '): ' + bad.map(function (b) { return esc(b.sku); }).join(', ') + '. <label class="p2-row" style="display:inline-flex"><input type="checkbox" data-cocolor' + (f.colorOk ? ' checked' : '') + '> keep anyway (logged)</label></div>' : '') +
        '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table p2-co-lines"><thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th class="r">Change</th><th class="r">Unit cost</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + repl + waits + extras;
    } else if (f.step === 2) {
      var p = coPriced(f), P = f.pricing, sm = p.ok ? p.summary : null, diff = coDiffers(j, f), sells = sellChanges(f), sg = CO.suggest(f.type, d, goodExtras(f));
      f.priced = p;
      var box = '<div class="p2-np-boxes"><section class="p2-np-box p2-np-wide"><div class="p2-between"><b>Pricing for this change order</b>' +
          (diff.length || P.asmHours ? '<a href="#" class="p2-small" data-coreset>Reset to job settings</a>' : '<span class="p2-small fmp1-faint">Same as the job</span>') + '</div><div class="p2-np-set">' +
          fld('Markup % (new lines)', 'data-cop="markupPct" inputmode="decimal"', P.markupPct) + fld('Mfr. discount % (of cost)', 'data-cop="discountPctOfCost" inputmode="decimal"', P.discountPctOfCost) +
          fld('G&amp;A %', 'data-cop="gaPct" inputmode="decimal"', P.gaPct) + fld('Sales tax %', 'data-cop="taxPct" inputmode="decimal"', P.taxPct) + '</div>' +
          '<span class="p2-small fmp1-faint">Starts from this job\'s settings' + (diff.length ? '; changed here: ' + diff.map(function (k) { return { markupPct: 'markup', discountPctOfCost: 'discount', gaPct: 'G&A', taxPct: 'tax' }[k]; }).join(', ') : '') + '. The job itself doesn\'t change.</span></section>' +
        '<section class="p2-np-box"><b>Assembly labor <span class="fmp1-faint p2-small">for this change</span></b><div class="p2-np-asm">' +
          fld('Hours', 'data-cop="asmHours" inputmode="decimal"', P.asmHours) + '<span class="p2-np-op" aria-hidden="true">×</span>' + fld('Hourly rate ($)', 'data-cop="asmRate" inputmode="decimal"', P.asmRate) +
          '<span class="p2-np-op" aria-hidden="true">=</span><div class="p2-fld"><span>Labor</span><b class="p2-np-asmtotal">' + $f(sm ? sm.laborCents : 0) + '</b></div></div>' +
          '<span class="p2-small fmp1-faint">Leave hours blank if the change needs no assembly.</span></section></div>';
      var rows2 = p.ok ? p.lines.map(function (l) {
        if (l.extra) return '<tr><td class="fmp1-faint">other</td><td class="p2-np-desc">' + esc(l.desc) + '</td><td class="r">1</td><td class="r"></td><td class="r"></td><td class="r">' + $f(l.totalCents) + '</td></tr>';
        var cur = f.current.filter(function (x) { return x.sku === l.sku; })[0], idx = f.current.indexOf(cur);
        return '<tr' + (l.removed ? ' class="p2-co-rm"' : '') + '><td class="fmp1-code">' + esc(l.sku) + (cur && cur.mkEdited && !l.removed ? ' <span class="fmp1-pill">edited</span>' : '') + '</td><td class="p2-np-desc">' + esc(l.desc || '') + '</td><td class="r">' + (l.qty > 0 ? '+' : '−') + Math.abs(l.qty) + '</td><td class="r">' + $f(l.unitCostCents) + '</td>' +
          '<td class="r">' + (l.removed ? '<span class="fmp1-faint" title="Credited at the markup it was sold at">' + l.markupPct + '</span>' : '<input class="fmp1-input p2-np-mk" inputmode="decimal" aria-label="Markup for ' + esc(l.sku) + '" data-coline="' + idx + '" value="' + l.markupPct + '">') + '</td><td class="r">' + $f(l.totalCents) + '</td></tr>';
      }).join('') : '';
      var sum = sm ? '<table class="fmp1-table p2-co-sum"><tbody>' + [['Cabinets', sm.cabinetsCents], sm.discountCents ? ['Mfr. bulk discount (' + num(P.discountPctOfCost) + '% of cost)', sm.discountCents] : null, sm.laborCents ? ['Assembly labor', sm.laborCents] : null,
          sm.otherCents ? ['Other charges and credits', sm.otherCents] : null, sm.gaCents ? ['G&amp;A (' + num(P.gaPct) + '%)', sm.gaCents] : null, sm.taxCents ? ['Tax (' + num(P.taxPct) + '% on product)', sm.taxCents] : null].filter(Boolean).map(function (r) { return '<tr><td>' + r[0] + '</td><td class="r">' + $f(r[1]) + '</td></tr>'; }).join('') +
          '<tr class="p2-co-total"><td>This change' + (sm.totalCents < 0 ? ' (a credit to the customer)' : '') + '</td><td class="r">' + $f(sm.totalCents) + '</td></tr></tbody></table>' : '<div class="fmp1-note fmp1-note--alert p2-small" role="alert">' + esc(p.error) + '</div>';
      var rc = replacedCost(f);
      body = (sells || num(P.asmHours) > 0 ? box + '<div class="fmp1-table-wrap"><table class="fmp1-table p2-np-lines p2-np-price"><thead><tr><th>SKU</th><th>Description</th><th class="r">Change</th><th class="r">Unit cost</th><th class="r">Markup %</th><th class="r">Sell</th></tr></thead><tbody>' + rows2 + '</tbody></table></div>' + sum
          : '<p class="p2-note">Nothing on the customer\'s order changes price' + (f.waitFor.length ? ': the backordered cabinets are still coming' : '') + '.</p>') +
        (rc ? '<div class="fmp1-note fmp1-note--info p2-small"><span>Replacements at our cost: <b>' + $f(rc) + '</b>. Not billed to the customer. ' + (f.replaced.some(function (r) { return r.claim && r.claim !== 'none'; }) ? 'Record the claim payment on the change order when it comes in, and the shop\'s cost drops by that much.' : 'The shop covers it.') + '</span></div>' : '') +
        (sg ? '<p class="p2-note">' + esc(sg.text) + '</p>' : '') +
        '<div class="p2-chips" role="group" aria-label="How it\'s billed">' + [['charge', 'Charge it', p.ok ? $f(p.deltaCents) : '—', !sells], ['courtesy', 'Courtesy', '$0.00', !sells && !rc], ['custom', 'Agreed amount', 'You enter it', false], ['nochange', 'No change to the contract', '$0.00', sells]].map(function (o) {
          return '<button class="fmp1-btn" data-cochoice="' + o[0] + '" aria-pressed="' + (f.choice === o[0]) + '"' + (o[3] ? ' disabled title="' + (o[0] === 'nochange' ? 'Cabinets or charges change: charge it, courtesy, or an agreed amount' : 'Nothing on the order changes price') + '"' : '') + '><b>' + o[1] + '</b>&nbsp;' + o[2] + '</button>'; }).join('') + '</div>' +
        '<p class="p2-note">Nothing is chosen until you pick.' + (sells ? ' Tab moves line to line; type to replace a markup.' : '') + '</p>' +
        (f.choice === 'custom' ? '<div class="p2-form">' + fld('Agreed amount ($)', 'data-cof="customAmt" inputmode="decimal"', f.customAmt) + fld('Why it differs', 'data-cof="customNote"', f.customNote) + '</div>' : '') +
        (f.choice === 'courtesy' ? '<p class="p2-note">No charge to the customer. Someone with full access approves it, and the cost the shop absorbs is recorded.</p>' : '') +
        (f.choice === 'nochange' ? '<p class="p2-note">Recorded as soon as you save. Nothing to approve or sign; open the change order to send the customer a notice.</p>' : '');
    } else {
      f.priced = coPriced(f);
      var amt = f.choice === 'courtesy' || f.choice === 'nochange' ? 0 : f.choice === 'charge' ? (f.priced && f.priced.ok ? f.priced.deltaCents : 0) : toCents(f.customAmt);
      body = '<ul class="p2-list"><li><span>What happened</span><b>' + esc(reasonLabel(f)) + (f.note ? ': ' + esc(f.note) : '') + '</b></li>' +
        '<li><span>Cabinets</span><b>' + (d.added.length + d.removed.length ? d.removed.map(function (r) { return '−' + esc(r.sku) + ' ×' + r.qty; }).concat(d.added.map(function (a) { return '+' + esc(a.sku) + ' ×' + a.qty; })).join(', ') : 'No change to the order') + '</b></li>' +
        (f.replaced.length ? '<li><span>Replaced at our cost</span><b>' + f.replaced.map(function (r) { return esc(r.sku) + ' ×' + r.qty; }).join(', ') + ' · ' + $f(replacedCost(f)) + '</b></li>' : '') +
        (f.waitFor.length ? '<li><span>Backordered</span><b>' + f.waitFor.map(function (w) { return esc(w.sku) + ' ×' + w.qty; }).join(', ') + '</b></li>' : '') +
        (goodExtras(f).length ? '<li><span>Other charges or credits</span><b>' + goodExtras(f).map(function (x) { return esc(x.label) + ' ' + $f(x.amountCents); }).join(', ') + '</b></li>' : '') +
        (f.newDate ? '<li><span>Delivery date</span><b>' + c.longDate(j.deliveryDate) + ' → ' + c.longDate(f.newDate) + '</b></li>' : '') +
        (f.choice === 'charge' && f.priced && f.priced.ok && needsPricing(f) ? '<li><span>Priced with</span><b>' + num(f.pricing.markupPct) + '% markup on new lines · ' + num(f.pricing.discountPctOfCost) + '% discount · ' + num(f.pricing.gaPct) + '% G&amp;A · ' + num(f.pricing.taxPct) + '% tax' +
          (f.priced.summary.laborCents ? ' · assembly ' + num(f.pricing.asmHours) + ' h × ' + $f(toCents(f.pricing.asmRate)) : '') + '</b></li>' : '') +
        '<li><span>This change</span><b>' + $f(isNaN(amt) ? 0 : amt) + (f.choice === 'courtesy' ? ' (courtesy)' : f.choice === 'nochange' ? ' (no change to the contract)' : '') + '</b></li>' +
        '<li><span>Billing</span><b>' + (amt > 0 ? 'Its own invoice, due on signing' : amt < 0 ? 'A credit on the next invoice' : 'No invoice') + '</b></li></ul>' +
        '<p class="p2-note">' + (f.choice === 'courtesy' ? 'Saves as a courtesy change order for someone with full access to approve, then goes to the buyer to acknowledge.' : f.choice === 'nochange' ? 'Recorded now. The delivery date and the shop\'s cost update on the job right away.' : 'Sends to the buyer for signature. The contract total, the invoice and any new date switch on when it\'s signed.') + '</p>';
    }
    var errs = f.errors && f.errors.length ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><ul class="p2-errs">' + f.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
    return '<div class="fmp1-card p2-pad" data-coflow><div class="p2-between"><b>New change order ' + ((j.changeOrders || []).length + 1) + (T ? ' · ' + esc(T.label) : '') + '</b><button class="fmp1-btn fmp1-btn--quiet" data-cocancel>Cancel</button></div>' + tabs + errs + body +
      '<div class="p2-between"><button class="fmp1-btn fmp1-btn--quiet" data-coback' + (f.step ? '' : ' disabled') + '>Back</button>' + (f.step < 3 ? '<button class="fmp1-btn fmp1-btn--primary" data-conext>Next</button>' : '<button class="fmp1-btn fmp1-btn--primary" data-cosave>' + (f.choice === 'courtesy' ? 'Save for approval' : f.choice === 'nochange' ? 'Record it' : 'Send for signature') + '</button>') + '</div></div>';
  }
  function coStepErrors(c, j, f) {
    var e = [], d = coDiff(f), iso = /^\d{4}-\d{2}-\d{2}$/;
    if (f.step === 0) {
      if (!f.type) e.push('Choose what happened.');
      if (f.type === 'backorder' && !f.boMode) e.push('Backordered: swap in another cabinet, or wait for it?');
      if (!String(f.note).trim()) e.push('Add a sentence for the paper trail.');
      if (f.type === 'backorder' && f.boMode === 'wait' && !iso.test(f.newDate || '')) e.push('Enter when the backordered cabinets are now expected (the new delivery date).');
      if (f.newDate && !iso.test(f.newDate)) e.push('Enter the new delivery date as a date.');
    }
    if (f.step === 1) {
      if (f.addForm || f.rowForm) e.push('Finish or cancel the open form first.');
      var bad = coExtras(f).filter(function (x) { return !String(x.label || '').trim() || !x.amountCents || isNaN(x.amountCents); });
      if (bad.length) e.push('Each other charge or credit needs a name and an amount (or remove it).');
      if (!d.added.length && !d.removed.length && !f.replaced.length && !goodExtras(f).length && !f.waitFor.length && !f.newDate)
        e.push(f.type === 'backorder' && f.boMode === 'wait' ? 'Click Backordered on at least one cabinet.' : 'Change at least one cabinet (add, remove, swap or replace), or add a charge or credit.');
      if (CO.colorCheck(f.current.filter(function (l) { return l.qty > 0; }), houseSuffix(c, j, f.house)).length && !f.colorOk) e.push('Fix the wrong-color cabinets, or tick "keep anyway".');
    }
    if (f.step === 2) {
      var P = f.pricing, names = { markupPct: 'Markup', discountPctOfCost: 'Discount', gaPct: 'G&A', taxPct: 'Sales tax' };
      if (needsPricing(f)) {
        Object.keys(names).forEach(function (k) { if (!(num(P[k]) >= 0)) e.push(names[k] + ' must be a number, 0 or more.'); });
        if (String(P.asmHours).trim() && !(num(P.asmHours) >= 0)) e.push('Assembly hours must be a number, 0 or more.');
        if (num(P.asmHours) > 0 && !(toCents(P.asmRate) > 0)) e.push('Enter the hourly rate for the assembly.');
        f.current.forEach(function (l) { if (l.mkEdited && !(num(l.markupPct) >= 0)) e.push(l.sku + ': markup must be 0% or more.'); });
      }
      f.priced = coPriced(f);
      var ch = CO.choosePrice(f.choice, f.priced, { amountCents: toCents(f.customAmt), note: f.customNote }, { sellChanges: sellChanges(f) }); if (!ch.ok) e.push(ch.error);
    }
    return e;
  }
  /* What goes through when a change order is approved, signed or recorded: the delivery date and the shop's absorbed total. */
  function goThrough(x, co) {
    x.absorbedCents = CO.absorbedOnJob(x.changeOrders);
    if (co.newDeliveryDate) x.deliveryDate = co.newDeliveryDate;
  }
  function saveCO(c, j, f) {
    var d = coDiff(f), n = (j.changeOrders || []).length + 1, id = j.jobCode + '-co' + n, who = c.me().name, nd = f.newDate || null;
    var extra = { type: f.type, newDeliveryDate: nd, waitFor: JSON.parse(JSON.stringify(f.waitFor)), house: f.house || null };
    if (f.choice === 'nochange') {
      var nr = CO.notice({ number: n, date: c.TODAY, type: f.type, note: f.note, requestedBy: who, replaced: f.replaced, newDeliveryDate: nd, waitFor: f.waitFor }, { today: c.TODAY });
      if (!nr.ok) return nr.problems;
      var nco = Object.assign(nr.co, { id: id, house: f.house || null });
      c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.concat([nco]); goThrough(x, nco); return x; }, nr.log + ' By ' + who + '.', who);
      return null;
    }
    if (f.choice === 'courtesy') {
      var rr = { backorder: 'backorder', mistake: 'shop_error', damage: 'other', other: 'other' }[f.type] || 'goodwill';
      var r = CO.courtesy({ number: n, date: c.TODAY, reason: rr, note: f.note, requestedBy: who, removed: d.removed, added: d.added, replaced: f.replaced, supplierOrder: null, supplierCreditCents: null }, { today: c.TODAY });
      if (!r.ok) return r.problems;
      var co = Object.assign(r.co, extra, { id: id, reason: reasonLabel(f), status: 'pending approval', credits: [] });
      c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.concat([co]); return x; }, 'Courtesy change order ' + n + ' saved for approval by ' + who + '. Shop would absorb ' + c.money(co.absorbedCents) + '.', who);
      return null;
    }
    var pz = coPriced(f); if (!pz.ok) return [pz.error];
    var amt = f.choice === 'charge' ? pz.deltaCents : toCents(f.customAmt);
    var taxC = f.choice === 'charge' ? pz.taxCents : Math.round(amt * (j.taxCents || 0) / Math.max(1, FM.contractSummary(j).currentCents));
    var rec = Object.assign({ id: id, number: n, date: c.TODAY, kind: f.choice, status: 'sent', amountCents: amt, taxCents: taxC, costCents: pz.costCents, reason: reasonLabel(f), note: f.note + (f.choice === 'custom' && f.customNote ? ' (agreed amount: ' + f.customNote + ')' : ''), removed: d.removed, added: d.added, lines: f.current,
      replaced: JSON.parse(JSON.stringify(f.replaced)), replacedCostCents: replacedCost(f), removedCostCents: pz.removedCostCents, extras: pz.extras, credits: [],
      pricing: pz.settings, differsFromJob: coDiffers(j, f), priced: { lines: pz.lines, summary: pz.summary } }, extra);
    var ab = CO.absorbedFor(rec); rec.absorbedCents = ab.cents; rec.absorbedIsEstimate = ab.estimate;
    c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.concat([rec]); return x; }, 'Change order ' + n + ' (' + c.money(amt) + ') saved by ' + who + '; sending it for signature.', who);
    if (window.P2Sign) window.P2Sign.sendCO(c, j.jobCode, id);
    return null;
  }

  /* ================= Contract ================= */
  function readinessJob(j) {
    var s = FM.contractSummary(j);
    return { status: 'proposed', customer: j.customer, signer: j.contacts && j.contacts.signer, buyerEmail: j.contacts && j.contacts.buyerEmail, project: j.projectName,
      installAddress: j.installAddress, installDate: j.deliveryDate, totalCents: s.currentCents, lineCount: (j.models || []).reduce(function (t, m) { return t + m.lines.length; }, 0),
      paymentPlan: (j.pricing && j.pricing.plan) || [],
      dueDates: j.invoices.filter(function (i) { return !i.changeOrderId; }).map(function (i) { return i.dueDate; }), quoteProblems: 0, fmSigner: j.fmSigner };
  }
  /* The contract rules (FMContract) plus the elevations check, which lives in the preview's elevations module */
  function readyCheck(c, j) {
    var r = K.readiness(readinessJob(j), { today: c.TODAY, authorizedSigners: signers().filter(function (p) { return p.email; }) });
    var eb = window.P2Elev && window.P2Elev.contractBlocker ? window.P2Elev.contractBlocker(c, j) : null;
    if (eb) { r.blockers.push(eb); r.ready = false; }
    return r;
  }
  /* Where each readiness problem is fixed: a field on the Ready card, or another tab. */
  var FIX = { customer: 'ct-customer', signer: 'ct-signer', buyerEmail: 'ct-email', project: 'ct-project', installAddress: 'ct-addr', installDate: 'ct-install',
    dueDates: 'ct-sched', duePast: 'ct-sched', dueOrder: 'ct-sched', fmSigner: 'ct-fmsigner', elevations: 'ct-elack' };
  function fixLink(c, j, b) {
    if (FIX[b.id]) return '<a href="#" class="p2-fix" data-ctfix="' + FIX[b.id] + '">Fix</a>';
    if (b.id === 'lines' || b.id === 'total' || b.id === 'quoteMath') return '<a class="p2-fix" href="#/job/' + encodeURIComponent(j.jobCode) + '/cabinets">Cabinets tab</a>';
    return '';
  }
  /* Contract details and the payment schedule, editable until the contract goes out. The deposit is due on signing. */
  function contractDetails(c, j, r, out) {
    var esc = c.esc, $f = c.money, dis = out ? ' disabled' : '', k = j.contacts || {}, addr = j.installAddr || A.parse(j.installAddress || '');
    var stages = j.pricing && j.pricing.plan ? planStages(j.pricing) : j.invoices.map(function (v) { return { name: v.label, pct: null }; });
    var bad = {}; r.blockers.forEach(function (b) { bad[b.id] = true; });
    var sched = '<div id="ct-sched" tabindex="-1"><span class="p2-fld"><span>Payment schedule</span></span><table class="fmp1-table p2-sched"><thead><tr><th>Invoice</th><th class="r">Amount</th><th>Due</th></tr></thead><tbody>' +
      j.invoices.filter(function (v) { return !v.changeOrderId; }).map(function (v, i) {
        var st = stages[i] || {};
        return '<tr><td>' + esc(v.label || st.name) + '</td><td class="r">' + $f(v.amountCents) + '</td><td>' + (i === 0 ? '<b>On signing</b>' :
          '<input class="fmp1-input" type="date" data-ctdue="' + i + '" min="' + c.TODAY + '" value="' + esc(v.dueDate || '') + '" aria-label="Due date for ' + esc(v.label) + '"' + dis + '>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var f = function (id, label, attr, val, type) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" id="' + id + '" ' + attr + (type ? ' type="' + type + '"' : '') + ' value="' + esc(val || '') + '"' + dis + '></label>'; };
    var openIt = Object.keys(bad).some(function (x) { return FIX[x] && x !== 'fmSigner'; }) || c.ui.ctOpen === j.jobCode;
    return '<details class="p2-ctdet"' + (openIt ? ' open' : '') + '><summary><b>Contract details and payment schedule</b> <span class="p2-small fmp1-faint">' + (out ? 'locked while it\'s out for signature' : 'edit anything that\'s wrong here') + '</span></summary>' +
      '<div class="p2-ctgrid">' + f('ct-customer', 'Customer', 'data-ctf="customer"', j.customer) + f('ct-project', 'Project name', 'data-ctf="projectName"', j.projectName) +
      f('ct-signer', 'Who signs for the buyer', 'data-ctf="signer"', k.signer) + f('ct-email', 'Their email (the signing link goes here)', 'data-ctf="buyerEmail" autocomplete="off"', k.buyerEmail, 'email') + '</div>' +
      '<div id="ct-addr" tabindex="-1">' + A.fieldsHTML(function (x) { return 'data-ctaddr="' + x + '"' + dis; }, addr, { legend: 'Install address' }) + '</div>' +
      '<div class="p2-ctgrid">' + f('ct-install', 'Install / delivery date (estimate)', 'data-ctinstall min="' + c.TODAY + '"', j.deliveryDate, 'date') + '</div>' + sched +
      '<p class="p2-note">The deposit is always due on signing. Changes here are logged with your name.</p></details>';
  }
  function renderContract(c, j) {
    var esc = c.esc, $f = c.money;
    if (j.stage !== 'quote' && (!j.esign || j.esign.state === 'none')) {
      var docs = (j.documents || []).filter(function (d) { return d.kind === 'contract'; });
      return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Contract</span><p>' + (j.stage === 'lost' ? 'This quote was lost.' : 'Signed in the existing tool' + (j.contractedOn ? ' (' + c.longDate(j.contractedOn) + ')' : '') + '.') + '</p>' +
        c.docRows(j, { kind: 'contract' }) +
        (j.grandfathered ? '<p class="p2-note">Brought over at its signed total of ' + $f(j.grandfathered.signedCents) + '. The difference from the itemized price is kept as agreed (grandfathered) pricing.</p>' : '') + '</div>';
    }
    var es = j.esign || { state: 'none' };
    if (j.stage !== 'quote') {
      return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Contract</span><p class="p2-ok">✓ ' + (window.P2Sign ? window.P2Sign.signedHow(es) : 'Signed') + ' · Contracted ' + c.longDate(j.contractedOn) + '</p>' +
        '<p class="p2-small">Signed for Fremont Makers by ' + esc(j.fmSigner ? j.fmSigner.name : '—') + '.</p>' + c.docRows(j, { kind: 'contract' }) + '</div>';
    }
    var r = readyCheck(c, j);
    var out = es.state === 'out_for_signature' || es.state === 'buyer_signed' || es.state === 'sending'   // in the tool or outside it
    var checks = r.blockers.map(function (b) { return '<li class="p2-block"><span>' + esc(b.message) + '</span>' + fixLink(c, j, b) + '</li>'; })
      .concat(r.warnings.map(function (w) { return '<li class="p2-warn"><span>' + esc(w.message) + '</span></li>'; })).join('');
    var signer = '<label class="p2-fld" style="max-width:340px"><span>Signs for Fremont Makers on this job</span><select class="fmp1-input" id="ct-fmsigner" data-fmsigner' + (out ? ' disabled' : '') + '><option value="">Choose…</option>' +
      signers().map(function (p, i) { return '<option value="' + i + '"' + (p.email ? '' : ' disabled') + (j.fmSigner && p.email && j.fmSigner.email === p.email ? ' selected' : '') + '>' + esc(p.name) + (p.email ? '' : ' (add an email on the Users page)') + '</option>'; }).join('') + '</select></label>';
    var send = window.P2Sign ? window.P2Sign.contractCard(c, j, r) : '';
    var errs = c.ui.esErr ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert">' + esc(c.ui.esErr) + '</div>' : '';
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Ready to contract?</span>' + (checks ? '<ul class="p2-list p2-checks">' + checks + '</ul>' : '<p class="p2-ok">✓ Everything checks out.</p>') +
      (window.P2Elev && window.P2Elev.contractAck ? window.P2Elev.contractAck(c, j, out) : '') + signer + contractDetails(c, j, r, out) + '</div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Send for signature</span>' + c.docRows(j, { kind: '__none', packetTitle: 'Contract packet (draft)', packetSub: 'What the buyer will sign: summary, schedule, invoices, quote' + (j.elevations && j.elevations.rooms && j.elevations.rooms.length ? ' and elevations' : '') }) + errs + send + '</div>';
  }
  function contractEdit(c, j, el) {
    var who = c.me().name, v = el.value.trim(), text = '';
    c.ui.ctOpen = j.jobCode;
    c.store.update(j.jobCode, function (x) {
      x.contacts = x.contacts || {};
      if (el.dataset.ctf) {
        var key = el.dataset.ctf, label = { customer: 'Customer', projectName: 'Project name', signer: 'Buyer signer', buyerEmail: 'Buyer email' }[key];
        var was = key === 'signer' || key === 'buyerEmail' ? x.contacts[key] : x[key];
        if (key === 'signer' || key === 'buyerEmail') x.contacts[key] = v; else x[key] = v;
        text = label + ' changed' + (was ? ' from "' + was + '"' : '') + ' to "' + v + '" by ' + who + '.';
      } else if (el.dataset.ctaddr) {
        var a = x.installAddr || A.parse(x.installAddress || ''); a[el.dataset.ctaddr] = v; x.installAddr = a; x.installAddress = A.format(a);
        text = 'Install address set to ' + x.installAddress + ' by ' + who + '.';
      } else if (el.hasAttribute('data-ctinstall')) {
        var old = x.deliveryDate, last = x.invoices.filter(function (i) { return !i.changeOrderId; }).slice(-1)[0];
        x.deliveryDate = v;
        if (last && x.invoices.length > 1 && (!last.dueDate || last.dueDate === old)) last.dueDate = v;   // the last payment stays at install
        text = 'Install date changed' + (old ? ' from ' + c.longDate(old) : '') + ' to ' + c.longDate(v) + ' by ' + who + (last && last.dueDate === v ? '; ' + last.label + ' follows it.' : '.');
      } else {
        var inv = x.invoices.filter(function (i) { return !i.changeOrderId; })[+el.dataset.ctdue], prev = inv.dueDate; inv.dueDate = v;
        text = inv.label + ' due date changed' + (prev ? ' from ' + c.longDate(prev) : '') + ' to ' + c.longDate(v) + ' by ' + who + '.';
      }
      return x;
    }, null, who);
    c.store.update(j.jobCode, function (x) { return x; }, text, who);
    c.render();
  }
  function coDocHTML(c, j, dco) {
    var prev = FM.contractSummary(j).originalCents;
    j.changeOrders.forEach(function (x) { if (x.number < dco.number && FM.coCountsTowardContract(x)) prev += x.amountCents || 0; });
    return D.renderChangeOrderDoc(j, dco, { previousCents: prev, printedNote: dco.priced && dco.priced.printed ? 'Reprinted from the executed change order. Sell prices as printed there.' : '' });
  }
  /* A change order the buyer signed (in the tool, or a signed copy uploaded) goes through: contract total, invoice, lines, delivery date. */
  function coSigned(c, jobCode, coId, how) {
    var j = c.store.job(jobCode), sc = j.changeOrders.filter(function (x) { return x.id === coId; })[0]; if (!sc || sc.status !== 'sent') return;
    var inv = CO.invoiceFor(sc, { today: c.TODAY });
    c.store.update(j.jobCode, function (x) {
      x.changeOrders = x.changeOrders.map(function (y) { if (y.id === sc.id) { y.status = 'signed'; y.signedOn = c.TODAY; } return y; });
      x.taxCents = (x.taxCents || 0) + (sc.taxCents || 0); if (x.costCents != null) x.costCents += (sc.costCents || 0);
      if (inv) x.invoices = x.invoices.concat([{ id: x.jobCode + '-inv' + (x.invoices.length + 1), label: inv.amountCents < 0 ? inv.label : inv.label + ' invoice', role: 'change_order', changeOrderId: sc.id, dueDate: c.TODAY, amountCents: inv.amountCents, status: 'open', payments: [] }]);
      if (x.models && x.models[0] && sc.lines && !sc.house) { x.models[0].lines = sc.lines.filter(function (l) { return l.qty > 0; }).map(function (l) { var z = JSON.parse(JSON.stringify(l)); delete z.swapFor; delete z.mkEdited; return z; }); x.changeOrders.forEach(function (y) { if (y.id === sc.id) y.inLines = true; }); }
      goThrough(x, sc);
      return x;
    }, 'Change order ' + sc.number + ' signed (' + how + '). Contract total ' + (sc.amountCents < 0 ? '−' + c.money(-sc.amountCents) : '+' + c.money(sc.amountCents)) + (inv ? (sc.amountCents < 0 ? '; the credit goes on the next invoice.' : '; its own invoice is due today.') : '.') + (sc.newDeliveryDate ? ' Delivery date now ' + c.longDate(sc.newDeliveryDate) + '.' : ''), c.me().name);
  }
  function contracted(c, j, how) {
    var who = c.me().name;
    c.store.update(j.jobCode, function (x) {
      x.stage = 'contract_signed'; x.contractedOn = c.TODAY;
      x.history = (x.history || []).concat([{ from: 'quote', to: 'contract_signed', date: c.TODAY, reason: how, by: who }]);
      if (x.invoices[0]) x.invoices[0].dueDate = c.TODAY;   // deposit due on signing
      var E = x.elevations;   // keep the drawings as signed; change orders add numbered revisions after this
      if (E && E.rooms && E.rooms.length) { E.versions = E.versions || []; E.versions.push({ n: E.versions.length + 1, label: x.elevAck ? 'As signed · preliminary' : 'As signed', signed: true, at: new Date().toISOString(), by: who, rooms: JSON.parse(JSON.stringify(E.rooms)), sizes: JSON.parse(JSON.stringify(E.sizes || {})) }); }
      return x;
    }, 'Contract signed (' + how + '). Job is now Contracted; the deposit is due today.', who);
  }

  /* ================= events ================= */
  function click(c, t) {
    var r = location.hash.replace(/^#\/?/, '').split('/'), j = r[0] === 'job' ? c.store.job(decodeURIComponent(r[1])) : null, d;
    // Duplicate this project into a new draft
    if (j && (t.hasAttribute('data-dup') || t.hasAttribute('data-dupyes'))) {
      if (t.hasAttribute('data-dup') && draftHasWork(loadDraft(c))) { c.ui.dupAsk = j.jobCode; c.render(); return true; }
      c.ui.dupAsk = null; duplicateJob(c, j); c.go('#/new'); return true;
    }
    if (j && t.hasAttribute('data-dupno')) { c.ui.dupAsk = null; c.render(); return true; }
    // New project
    if (r[0] === 'new') {
      d = loadDraft(c);
      if (t.dataset.npstep) { d.step = +t.dataset.npstep; d.errors = []; saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npnext')) { var e = stepErrors(c, d, d.step); d.errors = e; if (!e.length) d.step++; saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npback')) { d.step = Math.max(0, d.step - 1); d.errors = []; saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npdiscard')) { clearDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npnoteclose')) { d.note = ''; saveDraft(c); c.render(); return true; }
      if (t.dataset.nptpl && window.P2Customers) {
        var tc = window.P2Customers.byName(c, d.customer), tp = tc && tc.templates.filter(function (x) { return x.id === t.dataset.nptpl; })[0];
        if (tp) { var keep = { project: d.project, signer: d.signer, email: d.email }, keepAddr = A.isBlank(d.addr) ? null : d.addr; fromTemplate(c, tc, tp); var nd = c.ui.draft;
          Object.keys(keep).forEach(function (k) { if (keep[k]) nd[k] = keep[k]; }); if (keepAddr) { nd.addr = keepAddr; nd.address = A.format(keepAddr); } saveDraft(c); }
        c.render(); return true;
      }
      if (t.dataset.npskus) { d.noSkus = t.dataset.npskus === 'no'; d.errors = []; saveDraft(c); c.render(); return true; }
      if (t.dataset.npkind) { d.kind = t.dataset.npkind; if (d.kind === 'single') d.models = d.models.slice(0, 1); saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npplanadd')) { d.pricing.plan.push(0); d.pricing.planNames.push(''); d.errors = []; saveDraft(c); c.render(); var ni = document.querySelector('[data-npplanname="' + (d.pricing.plan.length - 1) + '"]'); if (ni) ni.focus(); return true; }
      if (t.dataset.npplandel) { var di = +t.dataset.npplandel; d.pricing.plan.splice(di, 1); d.pricing.planNames.splice(di, 1); saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npaddmodel')) { d.models.push({ id: 'm' + (d.models.length + 1), name: '', qty: 1, lines: [], pdf: '' }); saveDraft(c); c.render(); return true; }
      if (t.dataset.npdelmodel) { d.models.splice(+t.dataset.npdelmodel, 1); saveDraft(c); c.render(); return true; }
      if (t.hasAttribute('data-npcreate')) {
        var all = [0, 1, 2, 3, 4].reduce(function (a, i) { return a.concat(stepErrors(c, d, i)); }, []);
        if (all.length) { d.errors = all; c.render(); return true; }
        var res = createJob(c, d); if (!res.ok) { d.errors = [res.error]; c.render(); return true; }
        if (d.fromVisit && window.P2Measure) {
          var fv = window.P2Measure.visit(d.fromVisit);
          if (fv) { fv.jobCode = res.job.jobCode; fv.broughtInto = (fv.broughtInto || []).concat([{ jobCode: res.job.jobCode, on: c.TODAY, by: c.me().name }]); try { var all = JSON.parse(window.localStorage.getItem('fm_phase2_visits') || '[]').map(function (z) { return z.id === fv.id ? fv : z; }); window.localStorage.setItem('fm_phase2_visits', JSON.stringify(all)); } catch (e) { /* in memory */ } }
          c.store.update(res.job.jobCode, function (x) { return x; }, 'Started from the site visit on ' + (fv ? c.longDate(fv.measuredOn) : 'file') + ' (field measurements).', c.me().name);
        }
        if (d.fromTemplate) c.store.update(res.job.jobCode, function (x) { return x; }, 'Started from a customer template' + (d.project ? ' ("' + d.project + '")' : '') + '.', c.me().name);
        if (window.P2Customers) window.P2Customers.refresh(c);
        if (d.duplicatedFrom) c.store.update(res.job.jobCode, function (x) { return x; }, 'Duplicated from ' + d.duplicatedFrom + ' (customer, cabinets, pricing' + (res.job.elevations ? ', drawings' : '') + ').', c.me().name);
        clearDraft(c); c.go('#/job/' + encodeURIComponent(res.job.jobCode) + '/overview'); return true;
      }
    }
    if (!j) return false;
    // Change orders
    if (t.hasAttribute('data-costart')) { c.ui.co = newCO(c, j); c.ui.coCredit = c.ui.coWd = null; c.render(); return true; }
    var f = c.ui.co;
    if (f && f.job === j.jobCode) {
      if (t.hasAttribute('data-cocancel')) { c.ui.co = null; c.render(); return true; }
      if (t.dataset.costep) { var to = +t.dataset.costep; if (to > f.step) { for (var st = f.step; st < to; st++) { var se = coStepErrors(c, j, Object.assign({}, f, { step: st })); if (se.length) { f.step = st; f.errors = se; c.render(); return true; } } } f.step = to; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-conext')) { f.errors = coStepErrors(c, j, f); if (!f.errors.length) f.step++; c.render(); return true; }
      if (t.hasAttribute('data-coback')) { f.step = Math.max(0, f.step - 1); f.errors = []; c.render(); return true; }
      if (t.dataset.cotype) { f.type = t.dataset.cotype; if (f.type !== 'backorder') f.boMode = null; f.choice = null; f.errors = []; c.render(); return true; }
      if (t.dataset.cobo) { f.boMode = t.dataset.cobo; if (f.boMode === 'swap') f.waitFor = []; f.errors = []; c.render(); return true; }
      if (t.dataset.coqty) { var l = f.current[+t.dataset.coqty]; l.qty = Math.max(0, l.qty + (+t.dataset.d)); c.render(); return true; }
      if (t.hasAttribute('data-coaddopen')) { f.addForm = { sku: '', desc: '', qty: '1', cost: '' }; f.rowForm = null; c.render(); return true; }
      if (t.hasAttribute('data-copaste')) { f.paste = f.paste ? null : { text: '' }; c.render(); return true; }
      if (t.hasAttribute('data-copasteadd') && f.paste) { var pr = CO.parseSkus(f.paste.text); if (!pr.lines.length && !pr.skipped.length) return true; addSkuList(c, f, pr, 'the pasted list'); f.paste = null; c.render(); return true; }
      if (t.hasAttribute('data-coskuok')) { f.skuNote = null; c.render(); return true; }
      if (t.dataset.coaddsku != null && f.skuNote) { var mi = f.skuNote.missing.splice(+t.dataset.coaddsku, 1)[0]; f.addForm = { sku: mi.sku, desc: mi.desc || '', qty: String(mi.qty), cost: '' }; f.rowForm = null; if (!f.skuNote.missing.length && !f.skuNote.skipped.length) f.skuNote = null; c.render(); return true; }
      if (t.hasAttribute('data-coaddcancel')) { f.addForm = null; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-coaddsave')) {
        var A = f.addForm, ar = CO.addLine(f.current, { sku: A.sku, desc: A.desc, qty: parseInt(A.qty, 10), unitCostCents: toCents(A.cost) });
        if (!ar.ok) { A.errors = ar.problems; c.render(); return true; }
        f.current = ar.lines; f.addForm = null; f.errors = []; c.render(); return true;
      }
      if (t.dataset.corow) {
        var pr = t.dataset.corow.split(':'), ln = f.current[+pr[1]];
        f.rowForm = { kind: pr[0], idx: +pr[1], qty: String(pr[0] === 'repl' ? 1 : ln.qty), sku: '', desc: '', cost: pr[0] === 'repl' ? (ln.unitCostCents / 100).toFixed(2) : '', claim: '', why: '' }; f.addForm = null; c.render(); return true;
      }
      if (t.hasAttribute('data-corfcancel')) { f.rowForm = null; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-corfsave')) {
        var R = f.rowForm, rl = f.current[R.idx], q = parseInt(R.qty, 10);
        if (R.kind === 'swap') {
          var sw = CO.swapLine(f.current, rl.sku, { sku: String(R.sku).trim().toUpperCase(), desc: R.desc, unitCostCents: toCents(R.cost) }, q);
          if (!sw.ok) { R.error = sw.error; c.render(); return true; }
          f.current = sw.lines;
        } else {
          if (!(q > 0) || q > rl.qty) { R.error = 'Between 1 and ' + rl.qty + '.'; c.render(); return true; }
          if (R.kind === 'repl') {
            if (!(toCents(R.cost) > 0)) { R.error = 'Enter what the replacement costs us.'; c.render(); return true; }
            if (!R.claim) { R.error = 'Say who the claim goes to, or that we cover it.'; c.render(); return true; }
            f.replaced.push({ sku: rl.sku, desc: rl.desc, qty: q, unitCostCents: toCents(R.cost), claim: R.claim, why: String(R.why || '').trim() });
          } else f.waitFor.push({ sku: rl.sku, desc: rl.desc, qty: q });
        }
        f.rowForm = null; f.errors = []; c.render(); return true;
      }
      if (t.dataset.corm) { var rm = t.dataset.corm.split(':'); f[rm[0]].splice(+rm[1], 1); c.render(); return true; }
      if (t.dataset.coexadd) { var ps = EXTRA_PRESETS[+t.dataset.coexadd]; f.extras.push({ label: ps[0] === 'Other charge' ? '' : ps[0], amount: ps[0] === 'Credit' ? '-' : '', taxable: ps[1] }); c.render();
        var ins = document.querySelectorAll('[data-coex$=":' + (ps[0] === 'Other charge' ? 'label' : 'amount') + '"]'); if (ins.length) ins[ins.length - 1].focus(); return true; }
      if (t.hasAttribute('data-coreset')) { f.pricing = coDefaults(j); f.current.forEach(function (x) { if (x.mkEdited) { delete x.mkEdited; var b = f.base.filter(function (y) { return y.sku === x.sku; })[0]; if (b) x.markupPct = b.markupPct; else delete x.markupPct; } }); c.render(); return true; }
      if (t.dataset.cochoice) { f.choice = t.dataset.cochoice; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-cosave')) { var pe = saveCO(c, j, f); if (pe) { f.errors = pe; c.render(); return true; } attachCoFiles(c, j.jobCode, f.attach); c.ui.co = null; c.render(); return true; }
    }
    if (t.dataset.codoc) {
      var dco = j.changeOrders.filter(function (x) { return x.id === t.dataset.codoc; })[0], prev = FM.contractSummary(j).originalCents;
      j.changeOrders.forEach(function (x) { if (x.number < dco.number && FM.coCountsTowardContract(x)) prev += x.amountCents || 0; });
      c.ui.viewer = { title: 'Change order ' + dco.number + ' · ' + j.jobCode + ' · ' + j.customer, html: coDocHTML(c, j, dco), from: '[data-codoc="' + dco.id + '"]' };
      c.render(); return true;
    }
    if (t.dataset.coapprove) {
      var co = j.changeOrders.filter(function (x) { return x.id === t.dataset.coapprove; })[0], ap = CO.approve(Object.assign({}, co, { status: 'draft' }), c.me().name, { owners: window.P2Users ? window.P2Users.approvers() : [], at: c.TODAY });
      if (ap.ok) c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.map(function (y) { if (y.id !== co.id) return y; var z = ap.co; z.status = 'approved'; return z; }); goThrough(x, co); return x; }, ap.log + (co.newDeliveryDate ? ' Delivery date now ' + c.longDate(co.newDeliveryDate) + '.' : ''), c.me().name);
      c.render(); return true;
    }
    if (t.dataset.cosigned) { coSigned(c, j.jobCode, t.dataset.cosigned, 'the buyer'); c.render(); return true; }
    if (t.dataset.cocredit) { var cc = j.changeOrders.filter(function (x) { return x.id === t.dataset.cocredit; })[0]; c.ui.coCredit = { id: cc.id, for: (cc.removed || []).length ? 'returned' : 'damaged', from: 'supplier', amount: '', on: c.TODAY, reference: '', none: false }; c.ui.coWd = null; c.render(); return true; }
    if (t.hasAttribute('data-cocrcancel')) { c.ui.coCredit = null; c.render(); return true; }
    if (t.hasAttribute('data-cocrsave') && c.ui.coCredit) {
      var F = c.ui.coCredit, cr0 = j.changeOrders.filter(function (x) { return x.id === F.id; })[0];
      var rc = CO.recordCredit(cr0, { amountCents: toCents(F.amount), on: F.on, reference: F.reference, from: F.from, for: F.for, none: F.none }, { by: c.me().name, today: c.TODAY });
      if (!rc.ok) { F.error = rc.error; c.render(); return true; }
      c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.map(function (y) { return y.id === F.id ? rc.co : y; }); x.absorbedCents = CO.absorbedOnJob(x.changeOrders); return x; }, rc.log + ' By ' + c.me().name + '.', c.me().name);
      c.ui.coCredit = null; c.render(); return true;
    }
    if (t.dataset.cowd) { c.ui.coWd = { id: t.dataset.cowd, reason: '' }; c.ui.coCredit = null; c.render(); return true; }
    if (t.hasAttribute('data-cowdcancel')) { c.ui.coWd = null; c.render(); return true; }
    if (t.hasAttribute('data-cowdsave') && c.ui.coWd) {
      var wd = c.ui.coWd, w0 = j.changeOrders.filter(function (x) { return x.id === wd.id; })[0], wr = CO.withdraw(w0, c.me().name, wd.reason, c.TODAY);
      if (!wr.ok) { wd.error = wr.error; c.render(); return true; }
      c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.map(function (y) { return y.id === wd.id ? wr.co : y; }); return x; }, wr.log, c.me().name);
      c.ui.coWd = null; c.render(); return true;
    }
    // Contract
    if (t.dataset.ctfix) {
      var tg = document.getElementById(t.dataset.ctfix), dt = tg && tg.closest('details'); if (dt) dt.open = true; c.ui.ctOpen = j.jobCode;
      if (tg) { var fi = tg.matches('input,select') ? tg : tg.querySelector('input:not([disabled]),select:not([disabled])') || tg; tg.scrollIntoView({ block: 'center' }); fi.focus(); }
      return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d;
    if (el.dataset.np) { d = loadDraft(c); d[el.dataset.np] = el.value; saveDraft(c); if (el.dataset.np === 'bidAmount') refreshLater(c); return; }
    if (el.dataset.npm) { d = loadDraft(c); var m = d.models[+el.dataset.i]; m[el.dataset.npm] = el.dataset.npm === 'qty' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value; saveDraft(c); return; }
    if (el.dataset.npaddr) { d = loadDraft(c); d.addr[el.dataset.npaddr] = el.value; d.address = A.format(d.addr); saveDraft(c); return; }
    if (el.dataset.npplanname) { d = loadDraft(c); d.pricing.planNames[+el.dataset.npplanname] = el.value; saveDraft(c); return; }
    if (el.dataset.npplanpct) { d = loadDraft(c); d.pricing.plan[+el.dataset.npplanpct] = num(el.value) || 0; saveDraft(c); return; }
    if (el.dataset.npp) { d = loadDraft(c); d.pricing[el.dataset.npp] = /^assembly/.test(el.dataset.npp) ? el.value : num(el.value); if (el.dataset.npp === 'markupPct') reapply(d); saveDraft(c); refreshLater(c); return; }
    if (el.dataset.npline) { d = loadDraft(c); var ix = el.dataset.npline.split(':'), ln = d.models[+ix[0]].lines[+ix[1]]; ln.markupPct = num(el.value); ln.edited = true; saveDraft(c); refreshLater(c); return; }
    if (el.hasAttribute('data-copastetext') && c.ui.co && c.ui.co.paste) { c.ui.co.paste.text = el.value; return; }
    if (el.dataset.cof && c.ui.co) { c.ui.co[el.dataset.cof] = el.value; return; }
    if (el.dataset.coadd && c.ui.co && c.ui.co.addForm) { var A = c.ui.co.addForm; A[el.dataset.coadd] = el.value; if (el.dataset.coadd === 'sku') fillFromSku(c, A, el.value); return; }
    if (el.dataset.corf && c.ui.co && c.ui.co.rowForm) { var R = c.ui.co.rowForm; R[el.dataset.corf] = el.value; if (el.dataset.corf === 'sku') fillFromSku(c, R, el.value); return; }
    if (el.dataset.coex && c.ui.co) { var ex = el.dataset.coex.split(':'), xr = c.ui.co.extras[+ex[0]]; if (xr) xr[ex[1]] = ex[1] === 'taxable' ? el.checked : el.value; return; }
    if (el.dataset.cocr && c.ui.coCredit) { c.ui.coCredit[el.dataset.cocr] = el.type === 'checkbox' ? el.checked : el.value; return; }
    if (el.hasAttribute('data-cowdr') && c.ui.coWd) { c.ui.coWd.reason = el.value; return; }
    if (el.dataset.cop && c.ui.co) { c.ui.co.pricing[el.dataset.cop] = el.value; refreshLater(c); return; }
    if (el.dataset.coline && c.ui.co) { var cl = c.ui.co.current[+el.dataset.coline]; cl.markupPct = num(el.value); cl.mkEdited = true; refreshLater(c); return; }
  }
  /* Typing a SKU that's on the order or a supplier PDF fills in its description and cost (only boxes still empty). */
  function fillFromSku(c, form, v) {
    var k = knownSkus(c.ui.co)[String(v).trim().toUpperCase()]; if (!k) return;
    var changed = false;
    if (!form.desc) { form.desc = k.desc || ''; changed = true; }
    if (!form.cost && k.unitCostCents) { form.cost = (k.unitCostCents / 100).toFixed(2); changed = true; }
    if (changed) { var root = document.querySelector('[data-coform]'); if (root) { [].forEach.call(root.querySelectorAll('[data-coadd="desc"],[data-corf="desc"]'), function (n) { n.value = form.desc; }); [].forEach.call(root.querySelectorAll('[data-coadd="cost"],[data-corf="cost"]'), function (n) { n.value = form.cost; }); } }
  }
  var timer = null;
  function refreshLater(c) { clearTimeout(timer); timer = setTimeout(function () { var a = document.activeElement, key = a && (a.dataset.npp || a.dataset.npline || a.dataset.np || a.dataset.cop || a.dataset.coline), sel = a && a.selectionStart, selEnd = a && a.selectionEnd; c.render(); if (key) { var n = document.querySelector('[data-npp="' + key + '"],[data-npline="' + key + '"],[data-np="' + key + '"],[data-cop="' + key + '"],[data-coline="' + key + '"]'); if (n) { n.focus(); try { n.setSelectionRange(sel, selEnd); } catch (x) { /* number inputs */ } } } }, 450); }
  function change(c, e) {
    var el = e.target, d;
    if (el.dataset.np === 'customer') {
      d = loadDraft(c); d.customer = el.value;
      var pc = window.P2Customers && el.value !== '__new' ? window.P2Customers.byName(c, el.value) : null;
      if (pc) { var sg = window.FMCustomers.signer(pc), site = pc.addresses.filter(function (a) { return a.kind === 'site' && a.line; })[0];
        if (sg && !d.signer) d.signer = sg.name; if (sg && sg.email && !d.email) d.email = sg.email; if (site && A.isBlank(d.addr)) { d.addr = A.from(site); d.address = A.format(d.addr); } d.customerId = pc.id; }
      saveDraft(c); c.render(); return;
    }
    if (el.dataset.nppdf !== undefined) { d = loadDraft(c); var m = d.models[+el.dataset.nppdf], pdf = pdfById(el.value); m.pdf = el.value; m.lines = pdf ? pdf.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: d.pricing.markupPct, edited: false }; }) : []; reapply(d); saveDraft(c); c.render(); return; }
    if (el.dataset.npaddpdf !== undefined) {
      d = loadDraft(c); var m2 = d.models[+el.dataset.npaddpdf], pdf2 = pdfById(el.value); if (!m2 || !pdf2) return;
      var newL = 0, upL = 0;
      pdf2.lines.forEach(function (l) {
        var have = m2.lines.filter(function (x) { return x.sku.toUpperCase() === l.sku.toUpperCase(); })[0];
        if (have) { have.qty += l.qty; upL++; } else { m2.lines.push({ sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: d.pricing.markupPct, edited: false }); newL++; }
      });
      m2.added = 'added from ' + pdf2.name + ': ' + newL + ' new line' + (newL === 1 ? '' : 's') + (upL ? ', ' + upL + ' quantit' + (upL === 1 ? 'y' : 'ies') + ' raised' : '');
      reapply(d); saveDraft(c); c.render(); return;
    }
    if (el.dataset.npaddr) { d = loadDraft(c); d.addr[el.dataset.npaddr] = el.value; d.address = A.format(d.addr); saveDraft(c); return; }
    if (el.dataset.npplanpct !== undefined || el.dataset.npplanname !== undefined) { saveDraft(c); c.render(); return; }   // show the new sum once the box is left
    if (el.hasAttribute('data-npplan')) {
      d = loadDraft(c);
      if (el.value === 'custom') { d.pricing.planNames = planStages(d.pricing).map(function (x) { return x.name; }); d.pricing.planMode = 'custom'; }
      else { var pp = PLANS[+el.value]; d.pricing.plan = pp.pct.slice(); d.pricing.planNames = pp.names.slice(); d.pricing.planMode = el.value; }
      saveDraft(c); c.render(); return;
    }
    if (el.hasAttribute('data-npatcost')) { d = loadDraft(c); d.pricing.atCost = el.checked; reapply(d); saveDraft(c); c.render(); return; }
    if (el.hasAttribute('data-npbid')) { d = loadDraft(c); d.bid = el.checked; saveDraft(c); c.render(); return; }
    if (el.hasAttribute('data-npcopy')) {
      d = loadDraft(c); var src = c.store.job(el.value);
      if (src && src.pricing) { var p = src.pricing; d.pricing.markupPct = p.markupPct; d.pricing.discountPctOfCost = p.discountPctOfCost; d.pricing.gaPct = p.gaPct; d.pricing.taxPct = p.taxPct;
        copyAssembly(d, p); copyPlan(d, p, src); d.copiedFrom = src.jobCode; reapply(d); }
      saveDraft(c); c.render(); return;
    }
    var r = location.hash.replace(/^#\/?/, '').split('/'), j = r[0] === 'job' ? c.store.job(decodeURIComponent(r[1])) : null;
    if (!j) return;
    if (el.dataset.cof === 'house' && c.ui.co) { var f = c.ui.co; f.house = el.value; f.base = baseLines(c, j, f.house); f.current = JSON.parse(JSON.stringify(f.base)); f.replaced = []; f.waitFor = []; c.render(); return; }
    if (el.dataset.coex && c.ui.co) { c.render(); return; }   // show the new total once the box is left
    if (el.dataset.cof === 'reason' && c.ui.co) { c.ui.co.reason = el.value; return; }
    if (el.hasAttribute('data-coskufile') && c.ui.co) { readSkuFile(c, el); return; }
    if (el.hasAttribute('data-copdf') && c.ui.co) { var pd = pdfById(el.value); if (pd) { c.ui.co.current = CO.mergeLines(c.ui.co.current, pd.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: l.unitCostCents }; }), 'add').lines; } c.render(); return; }
    if (el.hasAttribute('data-cocolor') && c.ui.co) { c.ui.co.colorOk = el.checked; c.render(); return; }
    if (el.hasAttribute('data-elack') && j.stage === 'quote') {
      var who0 = c.me().name;
      c.store.update(j.jobCode, function (x) { if (el.checked) x.elevAck = { by: who0, on: c.TODAY }; else delete x.elevAck; return x; },
        el.checked ? 'Contract may go out without complete elevations (checked by ' + who0 + '). The packet marks the drawings as preliminary.' : 'Unchecked "send without complete elevations" (' + who0 + ').', who0);
      c.render(); return;
    }
    // Contract details (Ready card): each change is saved and logged
    if (j.stage === 'quote' && (el.dataset.ctf || el.dataset.ctaddr || el.hasAttribute('data-ctinstall') || el.dataset.ctdue)) { contractEdit(c, j, el); return; }
    if (el.hasAttribute('data-fmsigner')) { var s = signers()[+el.value]; if (s && !s.email) s = null; c.store.update(j.jobCode, function (x) { x.fmSigner = s ? { name: s.name, email: s.email } : null; return x; }, s ? s.name + ' will sign for Fremont Makers.' : null, c.me().name); c.render(); return; }
  }

  window.P2NewProject = { render: renderNew, blankDraft: blankDraft, migrate: migrate };
  window.P2Flows = { contracted: contracted, coSigned: coSigned, readyCheck: readyCheck, readinessJob: readinessJob, coDocHTML: coDocHTML, planStages: planStages, addToQuote: addToQuote, addSkus: addSkus, samplePdfs: samplePdfs, startCO: startCO, changes: renderChanges, contract: renderContract, click: click, input: input, change: change, quotesFor: quotesFor, signers: signers, dupConfirm: dupConfirm, fromTemplate: fromTemplate };
  /* Projects made in this preview before charges were broken out get their breakdown worked out from their lines */
  if (window.P2 && window.P2.ctx) (function () {
    var c0 = window.P2.ctx();
    c0.store.jobs({ all: true }).forEach(function (j) {
      if (!j.charges && j.pricing && (j.models || []).some(function (m) { return m.lines && m.lines.length; })) c0.store.update(j.jobCode, function (x) { x.charges = jobCharges(x); return x; }, null, 'system');
    });
  })();
  if (window.P2) window.P2.render();
})();
