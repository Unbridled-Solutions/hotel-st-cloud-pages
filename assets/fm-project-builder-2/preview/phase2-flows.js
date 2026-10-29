/*
 * Project Builder · Phase 2 app (preview) · the three flows:
 *   New Project (§15)  ·  Change orders (§17, §19)  ·  Contract and e-sign (§16, §18)
 * Rules live in src/ (FMQuote, FMContract, FMChangeOrder, FMBid). Dropbox Sign is simulated here; in production the
 * server makes those calls (§16). Supplier PDFs are simulated by the sample orders (Penrose and Willow Creek models).
 */
(function () {
  'use strict';
  var FM = window.FMPhase1, Q = window.FMQuote, D = window.FMDocs, K = window.FMContract, CO = window.FMChangeOrder;
  var W = window.FM_WILLOW_ORDER, B = window.FM_BRADDY_ORDER;
  var DEFAULTS = { markupPct: 35, discountPctOfCost: 12, gaPct: 2, taxPct: 7.9, assembly: '640.00', plan: [50, 50], atCost: true };
  var AT_COST = ['PWB18K', 'TU', 'TUK', 'F342'];
  var PLANS = [[50, 50], [50, 30, 20], [100]];
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
    if (B && B.supplierOrders[0]) out.push({ id: 'b1000173203', name: 'Wholesale Cabinets order #1000173203 (VDC42RS, DC224)', lines: B.changeOrders[0].added.map(function (a) { return { sku: a.sku, desc: a.desc, qty: a.qty, unitCostCents: FM.toCents(a.unitCost) }; }) });
    if (W) Object.keys(W.models).forEach(function (n) {
      out.push({ id: 'w-' + n, name: 'Wholesale Cabinets · ' + n + ' · ' + W.models[n].color, lines: W.models[n].lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: FM.toCents(l.unitCost) }; }) });
    });
    return out;
  }
  function pdfById(id) { return samplePdfs().filter(function (p) { return p.id === id; })[0]; }

  /* ================= New Project ================= */
  function blankDraft(c) {
    return { step: 0, customer: '', newCustomer: '', project: '', signer: '', email: '', kind: 'single', address: '',
      models: [{ id: 'm1', name: '', qty: 1, lines: [], pdf: '' }], pricing: JSON.parse(JSON.stringify(DEFAULTS)), copiedFrom: '',
      bid: false, bidAmount: '', install: '', errors: [] };
  }
  function loadDraft(c) {
    if (c.ui.draft) return c.ui.draft;
    try { var s = window.localStorage.getItem(DRAFT_KEY); if (s) { c.ui.draft = JSON.parse(s); return c.ui.draft; } } catch (e) { /* none */ }
    c.ui.draft = blankDraft(c); return c.ui.draft;
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
      if (p.assemblyCents != null) d.pricing.assembly = (p.assemblyCents / 100).toFixed(2); if (p.plan) d.pricing.plan = p.plan.slice(); else if (j.invoices && j.invoices.length === 3) d.pricing.plan = [50, 30, 20]; }
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
      (nRooms ? ' and ' + nRooms + ' room' + (nRooms === 1 ? '' : 's') + ' of drawings' : '') + '. Add more cabinets from another supplier PDF below, then check every step. The address and install date start blank.' +
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
  function asmCents(d) { var a = toCents(d.pricing.assembly); return isNaN(a) ? 0 : a; }
  function priceModel(d, m) {
    if (!m.lines.length) return null;
    var a = asmCents(d);
    return Q.priceHouse({ lines: m.lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct }; }),
      discountPctOfCost: d.pricing.discountPctOfCost, labor: a ? [{ role: 'Assembly', rateCents: a, hours: 1 }] : [], gaPct: d.pricing.gaPct, taxPct: d.pricing.taxPct });
  }
  function orderTotals(d) {
    var t = { itemized: 0, tax: 0, cost: 0, homes: 0, ok: true };
    d.models.forEach(function (m) { var p = priceModel(d, m); if (!p || !p.ok) { t.ok = false; return; } var q = d.kind === 'single' ? 1 : (m.qty || 0);
      t.itemized += p.summary.totalCents * q; t.tax += p.summary.taxCents * q; t.cost += p.internal.costCents * q; t.homes += q; });
    var bid = toCents(d.bidAmount);
    t.total = d.bid && bid > 0 ? bid : t.itemized;
    return t;
  }
  function customers(c) {
    var seen = {}; return c.store.jobs().map(function (j) { return j.customer; }).filter(function (n) { if (seen[n] || /change order/i.test(n)) return false; seen[n] = 1; return true; });
  }
  function stepErrors(c, d, i) {
    var e = [];
    if (i === 0) {
      if (!(d.customer === '__new' ? d.newCustomer.trim() : d.customer)) e.push('Choose or add the customer.');
      if (!d.project.trim()) e.push('Add a project name.');
      if (!d.signer.trim()) e.push('Add who will sign.');
      if (!K.isEmail(d.email)) e.push('Add the signer\'s email (Dropbox Sign sends the contract there).');
    }
    if (i === 1) {
      if (!d.address.trim()) e.push(d.kind === 'single' ? 'Add the install address.' : 'Add the site address.');
      if (d.kind === 'builder') d.models.forEach(function (m, k) { if (!m.name.trim() || !(m.qty >= 1)) e.push('Model ' + (k + 1) + ' needs a name and at least 1 house.'); });
    }
    if (i === 2) d.models.forEach(function (m) { if (!m.lines.length) e.push((m.name || 'The home') + ' has no cabinets yet. Add the supplier PDF.'); });
    if (i === 3) {
      ['markupPct', 'discountPctOfCost', 'gaPct', 'taxPct'].forEach(function (k) { if (!(d.pricing[k] >= 0)) e.push('Pricing values must be 0 or more.'); });
      if (isNaN(toCents(d.pricing.assembly)) || toCents(d.pricing.assembly) < 0) e.push('Assembly must be a dollar amount.');
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
    var side = '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Live total</span><span class="fmp1-h" style="font-size:24px">' + (t.ok ? $f(t.total) : '—') + '</span>' +
      '<span class="p2-small fmp1-faint">' + (d.kind === 'single' ? 'One home' : t.homes + ' homes') + (d.bid ? ' · agreed bid' : '') + ' · draft saves as you go</span></div>';
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">New project</h1><p class="p2-sub">Five steps on one page. Leave any time; the draft is kept.</p></div>' + side + '</div>' + rail + errs +
      '<div class="fmp1-card p2-pad">' + body + '</div>' + foot;
  }
  function fld(label, attrs, val, type) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" ' + attrs + (type ? ' type="' + type + '"' : '') + ' value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"></label>'; }
  function npCustomer(c, d) {
    var esc = c.esc;
    return '<h2 class="fmp1-h" style="font-size:20px">Who is this for?</h2><div class="p2-grid">' +
      '<label class="p2-fld"><span>Customer</span><select class="fmp1-input" data-np="customer"><option value="">Choose…</option>' +
      customers(c).map(function (n) { return '<option' + (d.customer === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '<option value="__new"' + (d.customer === '__new' ? ' selected' : '') + '>+ New customer</option></select></label>' +
      (d.customer === '__new' ? fld('New customer name', 'data-np="newCustomer"', d.newCustomer) : '') +
      fld('Project name', 'data-np="project"', d.project) + fld('Signer', 'data-np="signer"', d.signer) + fld('Signer email (for e-signature)', 'data-np="email"', d.email, 'email') +
      '</div><p class="p2-note">The customer holds contact details only. Pricing is set on this job in the Price step.</p>';
  }
  function npHomes(c, d) {
    var esc = c.esc;
    var models = d.kind === 'builder' ? '<div class="p2-grid">' + d.models.map(function (m, i) {
      return '<div class="p2-form">' + fld('Model ' + (i + 1), 'data-npm="name" data-i="' + i + '"', m.name) + fld('Houses', 'data-npm="qty" data-i="' + i + '" inputmode="numeric"', m.qty) +
        (d.models.length > 1 ? '<button class="fmp1-btn fmp1-btn--quiet" data-npdelmodel="' + i + '">Remove</button>' : '') + '</div>';
    }).join('') + '</div><button class="fmp1-btn" data-npaddmodel>Add a model</button>' : '';
    return '<h2 class="fmp1-h" style="font-size:20px">How many homes?</h2><div class="p2-chips" role="group" aria-label="Kind">' +
      '<button class="fmp1-btn" data-npkind="single" aria-pressed="' + (d.kind === 'single') + '">One home</button><button class="fmp1-btn" data-npkind="builder" aria-pressed="' + (d.kind === 'builder') + '">Builder order (several models)</button></div>' +
      fld(d.kind === 'single' ? 'Install address' : 'Site address', 'data-np="address"', d.address) + models +
      (d.kind === 'builder' ? '<p class="p2-note">Houses of the same model share one cabinet list, so each model needs one supplier PDF, not one per house.</p>' : '');
  }
  function npCabinets(c, d) {
    var esc = c.esc, $f = c.money, pdfs = samplePdfs();
    return '<h2 class="fmp1-h" style="font-size:20px">Cabinets</h2>' + (d.note ? '<div class="fmp1-note fmp1-note--info p2-small">' + esc(d.note) + '</div>' : '') +
      (d.elevations && d.elevations.rooms.length ? '<p class="p2-small fmp1-muted">Drawings come along: ' + d.elevations.rooms.length + ' room' + (d.elevations.rooms.length === 1 ? '' : 's') + '. Cabinets you add here show as "to place" on the Elevations tab.</p>' : '') + d.models.map(function (m, i) {
      var colors = {}; m.lines.forEach(function (l) { colors[suffix(l.sku)] = 1; }); var cs = Object.keys(colors);
      return '<div class="p2-form" style="flex-direction:column;align-items:stretch"><div class="p2-between"><b>' + esc(d.kind === 'single' ? (d.project || 'The home') : (m.name || 'Model ' + (i + 1)) + ' × ' + m.qty) + '</b>' +
        (cs.length ? '<span class="p2-small">' + (cs.length === 1 ? 'Color from the SKUs: <b>' + esc(COLORS[cs[0]] || cs[0]) + '</b>' : '<b style="color:var(--fmp1-alert-ink)">Mixed colors: ' + cs.map(function (x) { return esc(COLORS[x] || x); }).join(', ') + '</b>') + '</span>' : '') + '</div>' +
        '<label class="p2-fld"><span>Supplier PDF (sample orders in this preview)</span><select class="fmp1-input" data-nppdf="' + i + '"><option value="">Choose a PDF…</option>' +
        pdfs.map(function (p) { return '<option value="' + p.id + '"' + (m.pdf === p.id ? ' selected' : '') + '>' + esc(p.name) + ' (' + p.lines.length + ' lines)</option>'; }).join('') + '</select></label>' +
        (m.lines.length ? '<span class="p2-small">' + m.lines.length + ' lines · cost ' + $f(m.lines.reduce(function (t, l) { return t + l.unitCostCents * l.qty; }, 0)) + (m.added ? ' · ' + esc(m.added) : '') + '</span>' +
          '<label class="p2-fld"><span>Add cabinets from another supplier PDF (adds to the list; same SKUs add up)</span><select class="fmp1-input" data-npaddpdf="' + i + '"><option value="">Choose a PDF…</option>' +
          pdfs.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + ' (' + p.lines.length + ' lines)</option>'; }).join('') + '</select></label>' : '<span class="p2-small fmp1-faint">No cabinets yet.</span>') + '</div>';
    }).join('');
  }
  function npPrice(c, d) {
    var esc = c.esc, $f = c.money, p = d.pricing;
    var past = c.store.jobs().filter(function (j) { return j.pricing && j.pricing.markupPct != null; });
    var settings = '<div class="p2-form"><b>This job\'s pricing</b>' +
      fld('Markup %', 'data-npp="markupPct" inputmode="decimal"', p.markupPct) + fld('Mfr. discount % (of cost)', 'data-npp="discountPctOfCost" inputmode="decimal"', p.discountPctOfCost) +
      fld('G&amp;A %', 'data-npp="gaPct" inputmode="decimal"', p.gaPct) + fld('Sales tax %', 'data-npp="taxPct" inputmode="decimal"', p.taxPct) + fld('Assembly ($ per home)', 'data-npp="assembly" inputmode="decimal"', p.assembly) +
      '<label class="p2-fld"><span>Payment plan</span><select class="fmp1-input" data-npplan>' + PLANS.map(function (pl, i) { return '<option value="' + i + '"' + (pl.join() === p.plan.join() ? ' selected' : '') + '>' + pl.join(' / ') + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-fld"><span>Copy from a past job</span><select class="fmp1-input" data-npcopy><option value="">Choose…</option>' + past.map(function (j) { return '<option value="' + esc(j.jobCode) + '"' + (d.copiedFrom === j.jobCode ? ' selected' : '') + '>' + esc(j.customer + ' · ' + (j.projectName || j.jobCode)) + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-row p2-small"><input type="checkbox" data-npatcost' + (p.atCost ? ' checked' : '') + '> Sell ' + AT_COST.join(', ') + ' at cost</label></div>';
    var tables = d.models.map(function (m, mi) {
      var pr = priceModel(d, m);
      return '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><caption class="p2-small" style="text-align:left;padding:6px 0">' + esc(d.kind === 'single' ? (d.project || 'The home') : m.name + ' × ' + m.qty) + (pr && pr.ok ? ' · per home ' + $f(pr.summary.totalCents) + ' · margin on product ' + pr.internal.marginPct + '%' : '') + '</caption>' +
        '<thead><tr><th>SKU</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Markup %</th><th class="r">Sell</th></tr></thead><tbody>' +
        m.lines.map(function (l, li) {
          var sell = pr && pr.ok ? pr.lines[li].totalCents : 0;
          return '<tr><td class="fmp1-code">' + esc(l.sku) + (l.edited ? ' <span class="fmp1-pill">edited</span>' : '') + (ruleAtCost(d, l) && !l.edited ? ' <span class="fmp1-pill fmp1-pill--alert">at cost</span>' : '') + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.unitCostCents) + '</td>' +
            '<td class="r"><input class="fmp1-input" style="width:72px;text-align:right" inputmode="decimal" aria-label="Markup for ' + esc(l.sku) + '" data-npline="' + mi + ':' + li + '" value="' + l.markupPct + '"></td><td class="r">' + $f(sell) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
    var t = orderTotals(d);
    return '<h2 class="fmp1-h" style="font-size:20px">Price</h2>' + settings +
      '<label class="p2-row p2-small"><input type="checkbox" data-npbid' + (d.bid ? ' checked' : '') + '> Priced by bid</label>' +
      (d.bid ? fld('Agreed bid price ($)', 'data-np="bidAmount" inputmode="decimal"', d.bidAmount) + '<p class="p2-note">The customer gets a lump-sum page: cabinets and quantities, no prices, one agreed price. Itemized: ' + c.money(t.itemized) + (toCents(d.bidAmount) > 0 ? ' · bid is ' + c.money(Math.abs(toCents(d.bidAmount) - t.itemized)) + (toCents(d.bidAmount) >= t.itemized ? ' above' : ' below') : '') + '.</p>' : '') + tables +
      '<p class="p2-note">Changing the job\'s markup or the at-cost box updates every line you haven\'t edited by hand.</p>';
  }
  function npReview(c, d) {
    var esc = c.esc, $f = c.money, t = orderTotals(d), plan = d.pricing.plan;
    var amts = t.ok ? K.invoiceAmounts(t.total, plan) : [], dues = K.defaultDueDates(c.TODAY, d.install, plan);
    return '<h2 class="fmp1-h" style="font-size:20px">Review and create</h2><div class="p2-grid"><ul class="p2-list">' +
      '<li><span>Customer</span><b>' + esc(d.customer === '__new' ? d.newCustomer : d.customer) + '</b></li><li><span>Project</span><b>' + esc(d.project) + '</b></li>' +
      '<li><span>Signer</span><b>' + esc(d.signer) + ' · ' + esc(d.email) + '</b></li><li><span>Homes</span><b>' + t.homes + '</b></li><li><span>Address</span><b>' + esc(d.address) + '</b></li>' +
      '<li><span>Total</span><b>' + $f(t.total) + (d.bid ? ' (agreed bid)' : '') + '</b></li></ul>' +
      '<div class="p2-form" style="flex-direction:column;align-items:stretch">' + fld('Install / delivery date (estimate)', 'data-np="install" min="' + c.TODAY + '"', d.install, 'date') +
      '<table class="fmp1-table"><thead><tr><th>Invoice</th><th>Due</th><th class="r">Amount</th></tr></thead><tbody>' + plan.map(function (p, i) {
        return '<tr><td>Invoice ' + (i + 1) + ' · ' + p + '%</td><td>' + (i === 0 ? 'On signing' : c.longDate(dues[i])) + '</td><td class="r">' + (amts[i] != null ? $f(amts[i]) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<p class="p2-note">Creating saves the project as a Quote, gives it a job code, and logs who created it. The contract is sent from the job\'s Contract tab.</p>';
  }
  function nextCode(c) {
    var yymm = c.TODAY.slice(2, 4) + c.TODAY.slice(5, 7), max = 0;
    c.store.jobs().forEach(function (j) { var m = String(j.jobCode).match(new RegExp('^FM-' + yymm + '-(\\d{3})$')); if (m) max = Math.max(max, +m[1]); });
    return 'FM-' + yymm + '-' + ('00' + (max ? max + 1 : 101)).slice(-3);
  }
  function createJob(c, d) {
    var t = orderTotals(d), code = nextCode(c), plan = d.pricing.plan, amts = K.invoiceAmounts(t.total, plan), dues = K.defaultDueDates(c.TODAY, d.install, plan);
    var cust = d.customer === '__new' ? d.newCustomer.trim() : d.customer;
    var houses = [];
    if (d.kind === 'builder') d.models.forEach(function (m) { var p = priceModel(d, m); for (var k = 1; k <= m.qty; k++) houses.push({ jobCode: code + '-' + (houses.length + 1), name: m.name + ' ' + k, model: m.name, color: COLORS[suffix((m.lines[0] || {}).sku)] || '', lines: m.lines.length, totalCents: p.summary.totalCents, address: d.address }); });
    var job = { id: code, jobCode: code, customer: cust, projectName: d.project.trim(), kind: d.kind === 'builder' ? 'builder_order' : 'single',
      quoteDate: c.TODAY, deliveryDate: d.install, originalContractCents: t.total, houses: houses, history: [], changeOrders: [],
      contacts: { signer: d.signer.trim(), buyerEmail: d.email.trim() }, source: { system: 'phase2' }, stage: 'quote', installAddress: d.address.trim(),
      invoices: plan.map(function (p, i) { return { id: code + '-inv' + (i + 1), label: 'Invoice ' + (i + 1) + ' · ' + p + '%', role: i === 0 ? 'deposit' : 'progress', changeOrderId: null, dueDate: dues[i], amountCents: amts[i], status: 'open', payments: [] }; }),
      taxCents: t.tax, costCents: t.cost, absorbedCents: 0, documents: [], fmSigner: null, esign: { state: 'none' }, contractedOn: null,
      pricing: { markupPct: d.pricing.markupPct, discountPctOfCost: d.pricing.discountPctOfCost, gaPct: d.pricing.gaPct, taxPct: d.pricing.taxPct, assemblyCents: asmCents(d), plan: plan.slice(), copiedFrom: d.copiedFrom || null },
      models: d.models.map(function (m) { return { name: d.kind === 'single' ? d.project.trim() : m.name.trim(), qty: d.kind === 'single' ? 1 : m.qty, lines: JSON.parse(JSON.stringify(m.lines)) }; }),
      bid: d.bid ? { bidCents: toCents(d.bidAmount), itemizedCents: t.itemized } : null };
    if (d.duplicatedFrom) job.duplicatedFrom = d.duplicatedFrom;
    if (d.elevations && d.elevations.rooms.length) {
      var keyFor = {}; d.models.forEach(function (m, i) { keyFor[m.id] = job.models[i].name || 'Model ' + (i + 1); });
      var rs = d.elevations.rooms.filter(function (r) { return keyFor[r.set]; }).map(function (r) { r = JSON.parse(JSON.stringify(r)); r.set = keyFor[r.set]; return r; });
      if (rs.length) job.elevations = { rooms: rs, sizes: JSON.parse(JSON.stringify(d.elevations.sizes || {})), versions: [], revisions: [], copiedFrom: d.duplicatedFrom || null };
    }
    return c.store.addJob(job, c.me().name);
  }

  /* quote pages for the packet (new Phase 2 jobs) */
  function quotesFor(j) {
    if (!j.models) return [];
    var pr = j.pricing, out = [];
    j.models.forEach(function (m) {
      var p = Q.priceHouse({ lines: m.lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct }; }),
        discountPctOfCost: pr.discountPctOfCost, labor: pr.assemblyCents ? [{ role: 'Assembly', rateCents: pr.assemblyCents, hours: 1 }] : [], gaPct: pr.gaPct, taxPct: pr.taxPct });
      var meta = { house: m.name + (m.qty > 1 ? ' (× ' + m.qty + ')' : ''), jobCode: j.jobCode, buyer: j.customer, signer: j.contacts.signer, quoteDate: j.quoteDate, deliveryDate: j.deliveryDate, address: j.installAddress, color: COLORS[suffix((m.lines[0] || {}).sku)] || '' };
      out.push(j.bid ? D.renderBidQuoteDoc(p, j.models.length === 1 ? j.bid.bidCents : p.summary.totalCents, meta) : Q.renderHouseQuoteDoc(p, meta));
    });
    return out;
  }

  /* ================= Change orders ================= */
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
  function coDiff(f) {
    var before = {}; f.base.forEach(function (l) { before[l.sku] = l; });
    var added = [], removed = [];
    f.current.forEach(function (l) {
      var b = before[l.sku];
      if (!b && l.qty > 0) added.push(JSON.parse(JSON.stringify(l)));
      else if (b && l.qty !== b.qty) (l.qty > b.qty ? added : removed).push({ sku: l.sku, desc: l.desc, qty: Math.abs(l.qty - b.qty), unitCostCents: l.unitCostCents, markupPct: l.markupPct, from: b.qty, to: l.qty });
    });
    return { added: added, removed: removed };
  }
  /* Sales tax and cabinet cost carried by a change order, so the books stay right once it's signed. */
  function parts(lines, set) {
    if (!lines.length) return { tax: 0, cost: 0, total: 0 };
    var p = Q.priceHouse({ lines: lines.map(function (l) { return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: l.unitCostCents, markupPct: l.markupPct != null ? l.markupPct : set.markupPct }; }), discountPctOfCost: set.discountPctOfCost, labor: [], gaPct: set.gaPct, taxPct: set.taxPct });
    return p.ok ? { tax: p.summary.taxCents, cost: p.internal.costCents, total: p.summary.totalCents } : { tax: 0, cost: 0, total: 0 };
  }
  var CO_STEPS = ['What and why', 'Cabinets', 'Price', 'Review'];
  function renderChanges(c, j) {
    var esc = c.esc, $f = c.money, f = c.ui.co && c.ui.co.job === j.jobCode ? c.ui.co : null;
    var list = (j.changeOrders || []).map(function (co) {
      var tone = co.status === 'pending approval' ? 'fmp1-pill--alert' : co.status === 'sent' ? 'fmp1-pill--proposed' : 'fmp1-pill--good';
      var lines = (co.removed || []).map(function (r) { return 'Removed ' + esc(r.sku) + ' ×' + r.qty; }).concat((co.added || []).map(function (a) { return 'Added ' + esc(a.sku) + ' ×' + a.qty; })).join(' · ');
      var actions = '';
      if (co.status === 'pending approval') actions = c.me().access === 'full' ? '<button class="fmp1-btn fmp1-btn--primary" data-coapprove="' + esc(co.id) + '">Approve courtesy</button>' : '<span class="p2-small fmp1-faint">Waiting for someone with full access to approve.</span>';
      if (co.status === 'sent') actions = '<button class="fmp1-btn fmp1-btn--primary" data-cosigned="' + esc(co.id) + '">Buyer signed (simulate)</button>';
      return '<li style="flex-direction:column;align-items:stretch"><div class="p2-between"><b>Change order ' + co.number + (co.kind === 'courtesy' ? ' · courtesy' : '') + '</b><span class="p2-row"><span class="fmp1-pill ' + tone + '">' + esc(co.status) + '</span><b>' + $f(co.amountCents || 0) + '</b></span></div>' +
        '<span class="p2-small fmp1-muted">' + c.longDate(co.date) + ' · ' + esc(co.reason || '') + (co.note ? ': ' + esc(co.note) : '') + '</span>' + (lines ? '<span class="p2-small">' + lines + '</span>' : '') +
        (window.P2Elev && window.P2Elev.coNote ? window.P2Elev.coNote(c, j, co) : '') + (co.kind === 'courtesy' ? '<span class="p2-small fmp1-faint">Internal: shop absorbed ' + $f(co.absorbedCents || 0) + (co.absorbedIsEstimate ? ' (before any supplier credit)' : '') + '</span>' : '') + (actions ? '<span class="p2-row">' + actions + '</span>' : '') + '</li>';
    }).join('');
    var canStart = j.stage !== 'quote' && j.stage !== 'lost';
    var head = '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Change orders · ' + (j.changeOrders || []).length + '</span>' +
      (f ? '' : canStart ? '<button class="fmp1-btn fmp1-btn--primary" data-costart>New change order</button>' : '<span class="p2-small fmp1-faint">Change orders apply to signed jobs. Edit the quote instead.</span>') + '</div>' +
      (list ? '<ul class="p2-list">' + list + '</ul>' : '<p class="p2-empty">No change orders on this job.</p>') + '</div>';
    return head + (f ? coFlow(c, j, f) : '');
  }
  function coFlow(c, j, f) {
    var esc = c.esc, $f = c.money, d = coDiff(f), set = settingsFor(j), sfx = houseSuffix(c, j, f.house);
    var tabs = '<nav class="p2-tabs" aria-label="Change order steps">' + CO_STEPS.map(function (s, i) { return '<a href="#" data-costep="' + i + '"' + (i === f.step ? ' aria-current="page"' : '') + '>' + (i + 1) + '. ' + s + '</a>'; }).join('') + '</nav>';
    var body;
    if (f.step === 0) {
      body = (j.houses && j.houses.length > 1 ? '<label class="p2-fld"><span>House</span><select class="fmp1-input" data-cof="house">' + j.houses.map(function (h) { return '<option value="' + esc(h.jobCode) + '"' + (f.house === h.jobCode ? ' selected' : '') + '>' + esc(h.name + ' · ' + h.color) + '</option>'; }).join('') + '</select></label><p class="p2-note">A PDF that covers several houses is split by color; each color goes to the houses that use it.</p>' : '') +
        '<label class="p2-fld"><span>Reason</span><select class="fmp1-input" data-cof="reason">' + Object.keys(CO.CHANGE_REASONS).map(function (k) { return '<option value="' + k + '"' + (f.reason === k ? ' selected' : '') + '>' + CO.CHANGE_REASONS[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="p2-fld"><span>Note for the paper trail</span><textarea class="fmp1-input" rows="2" data-cof="note">' + esc(f.note) + '</textarea></label>';
    } else if (f.step === 1) {
      var bad = CO.colorCheck(f.current.filter(function (l) { return l.qty > 0; }), sfx);
      var before = {}; f.base.forEach(function (l) { before[l.sku] = l.qty; });
      body = '<label class="p2-fld"><span>Add from a supplier PDF (adds to the list; never lowers a quantity)</span><select class="fmp1-input" data-copdf><option value="">Choose a PDF…</option>' + samplePdfs().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select></label>' +
        (bad.length ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert">' + bad.length + ' cabinet line' + (bad.length > 1 ? 's don\'t' : ' doesn\'t') + ' match this house\'s color (' + esc(COLORS[sfx] || sfx) + '): ' + bad.map(function (b) { return esc(b.sku); }).join(', ') + '. <label class="p2-row" style="display:inline-flex"><input type="checkbox" data-cocolor' + (f.colorOk ? ' checked' : '') + '> keep anyway (logged)</label></div>' : '') +
        '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>SKU</th><th>Qty</th><th class="r">Change</th><th class="r">Unit cost</th></tr></thead><tbody>' + f.current.map(function (l, i) {
          var b = before[l.sku] || 0, changed = b !== l.qty;
          return '<tr' + (changed ? ' style="background:var(--fmp1-info-soft)"' : '') + '><td class="fmp1-code">' + esc(l.sku) + '</td><td><span class="p2-row"><button class="fmp1-btn" data-coqty="' + i + '" data-d="-1" aria-label="One fewer ' + esc(l.sku) + '">−</button>' + l.qty + '<button class="fmp1-btn" data-coqty="' + i + '" data-d="1" aria-label="One more ' + esc(l.sku) + '">+</button></span></td><td class="r">' + (changed ? b + ' → ' + l.qty : '') + '</td><td class="r">' + $f(l.unitCostCents) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else if (f.step === 2) {
      var p = CO.priceChange({ added: d.added.map(function (a) { a.markupPct = a.markupPct != null ? a.markupPct : set.markupPct; return a; }), removed: d.removed }, set);
      f.priced = p;
      body = '<div class="p2-chips" role="group" aria-label="Price">' + [['charge', 'Charge it', p.ok ? $f(p.deltaCents) : '—'], ['courtesy', 'Courtesy', '$0.00'], ['custom', 'Agreed amount', 'You enter it']].map(function (o) {
        return '<button class="fmp1-btn" data-cochoice="' + o[0] + '" aria-pressed="' + (f.choice === o[0]) + '"><b>' + o[1] + '</b>&nbsp;' + o[2] + '</button>'; }).join('') + '</div>' +
        '<p class="p2-note">Priced with this job\'s settings: ' + set.markupPct + '% markup on new lines, ' + set.discountPctOfCost + '% discount, ' + set.gaPct + '% G&amp;A, ' + set.taxPct + '% tax. Nothing is chosen until you pick.</p>' +
        (f.choice === 'custom' ? '<div class="p2-form">' + fld('Agreed amount ($)', 'data-cof="customAmt" inputmode="decimal"', f.customAmt) + fld('Why it differs', 'data-cof="customNote"', f.customNote) + '</div>' : '') +
        (f.choice === 'courtesy' ? '<p class="p2-note">No charge to the customer. Someone with full access approves it, and the cost the shop absorbs is recorded.</p>' : '');
    } else {
      var amt = f.choice === 'courtesy' ? 0 : f.choice === 'charge' ? (f.priced && f.priced.ok ? f.priced.deltaCents : 0) : toCents(f.customAmt);
      body = '<ul class="p2-list"><li><span>Reason</span><b>' + esc(CO.CHANGE_REASONS[f.reason]) + (f.note ? ': ' + esc(f.note) : '') + '</b></li>' +
        '<li><span>Cabinets</span><b>' + (d.added.length + d.removed.length ? d.removed.map(function (r) { return '−' + esc(r.sku) + ' ×' + r.qty; }).concat(d.added.map(function (a) { return '+' + esc(a.sku) + ' ×' + a.qty; })).join(', ') : 'No cabinet changes') + '</b></li>' +
        '<li><span>This change</span><b>' + $f(isNaN(amt) ? 0 : amt) + (f.choice === 'courtesy' ? ' (courtesy)' : '') + '</b></li>' +
        '<li><span>Billing</span><b>' + (amt > 0 ? 'Its own invoice, due on signing' : amt < 0 ? 'A credit on the next invoice' : 'No invoice') + '</b></li></ul>' +
        '<p class="p2-note">' + (f.choice === 'courtesy' ? 'Saves as a courtesy change order for someone with full access to approve, then goes to the buyer to acknowledge.' : 'Sends to the buyer for signature. The contract total and the invoice switch on when it\'s signed.') + '</p>';
    }
    var errs = f.errors && f.errors.length ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><ul class="p2-errs">' + f.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '';
    return '<div class="fmp1-card p2-pad"><div class="p2-between"><b>New change order ' + ((j.changeOrders || []).length + 1) + '</b><button class="fmp1-btn fmp1-btn--quiet" data-cocancel>Cancel</button></div>' + tabs + errs + body +
      '<div class="p2-between"><button class="fmp1-btn fmp1-btn--quiet" data-coback' + (f.step ? '' : ' disabled') + '>Back</button>' + (f.step < 3 ? '<button class="fmp1-btn fmp1-btn--primary" data-conext>Next</button>' : '<button class="fmp1-btn fmp1-btn--primary" data-cosave>' + (f.choice === 'courtesy' ? 'Save for approval' : 'Send for signature') + '</button>') + '</div></div>';
  }
  function coStepErrors(c, j, f) {
    var e = [], d = coDiff(f);
    if (f.step === 0 && !String(f.note).trim()) e.push('Add a note for the paper trail.');
    if (f.step === 1) {
      if (!d.added.length && !d.removed.length) e.push('Add or remove at least one cabinet.');
      if (CO.colorCheck(f.current.filter(function (l) { return l.qty > 0; }), houseSuffix(c, j, f.house)).length && !f.colorOk) e.push('Fix the wrong-color cabinets, or tick "keep anyway".');
    }
    if (f.step === 2) { var ch = CO.choosePrice(f.choice, f.priced, { amountCents: toCents(f.customAmt), note: f.customNote }); if (!ch.ok) e.push(ch.error); }
    return e;
  }
  function saveCO(c, j, f) {
    var d = coDiff(f), n = (j.changeOrders || []).length + 1, id = j.jobCode + '-co' + n, who = c.me().name;
    if (f.choice === 'courtesy') {
      var rr = { backorder: 'backorder', our_mistake: 'shop_error', other: 'other' }[f.reason] || 'goodwill';
      var r = CO.courtesy({ number: n, date: c.TODAY, reason: rr, note: f.note, requestedBy: who, removed: d.removed, added: d.added, supplierOrder: null, supplierCreditCents: null }, { today: c.TODAY });
      if (!r.ok) return r.problems;
      var co = r.co; co.id = id; co.reason = CO.CHANGE_REASONS[f.reason]; co.status = 'pending approval';
      c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.concat([co]); return x; }, 'Courtesy change order ' + n + ' saved for approval by ' + who + '. Shop would absorb ' + c.money(co.absorbedCents) + '.', who);
      return null;
    }
    var amt = f.choice === 'charge' ? f.priced.deltaCents : toCents(f.customAmt);
    var set = settingsFor(j), pa = parts(d.added, set), pr = parts(d.removed, set);
    var taxC = f.choice === 'charge' ? pa.tax - pr.tax : Math.round(amt * (j.taxCents || 0) / Math.max(1, FM.contractSummary(j).currentCents));
    var rec = { id: id, number: n, date: c.TODAY, kind: f.choice, status: 'sent', amountCents: amt, taxCents: taxC, costCents: pa.cost - pr.cost, reason: CO.CHANGE_REASONS[f.reason], note: f.note + (f.choice === 'custom' && f.customNote ? ' (agreed amount: ' + f.customNote + ')' : ''), removed: d.removed, added: d.added, house: f.house || null, lines: f.current };
    c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.concat([rec]); return x; }, 'Change order ' + n + ' (' + c.money(amt) + ') sent for signature by ' + who + '.', who);
    return null;
  }

  /* ================= Contract ================= */
  function readinessJob(j) {
    var s = FM.contractSummary(j);
    return { status: 'proposed', customer: j.customer, signer: j.contacts && j.contacts.signer, buyerEmail: j.contacts && j.contacts.buyerEmail, project: j.projectName,
      installAddress: j.installAddress, installDate: j.deliveryDate, totalCents: s.currentCents, lineCount: (j.models || []).reduce(function (t, m) { return t + m.lines.length; }, 0),
      paymentPlan: (j.pricing && j.pricing.plan) || [],
      dueDates: j.invoices.map(function (i) { return i.dueDate; }), quoteProblems: 0, fmSigner: j.fmSigner };
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
      return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Contract</span><p class="p2-ok">✓ ' + (es.state === 'signed_on_paper' ? 'Signed on paper' : 'Signed by everyone in Dropbox Sign') + ' · Contracted ' + c.longDate(j.contractedOn) + '</p>' +
        '<p class="p2-small">Signed for Fremont Makers by ' + esc(j.fmSigner ? j.fmSigner.name : '—') + '.</p>' + c.docRows(j, { kind: 'contract' }) + '</div>';
    }
    var r = K.readiness(readinessJob(j), { today: c.TODAY, authorizedSigners: signers().filter(function (p) { return p.email; }) });
    var checks = r.blockers.map(function (b) { return '<li><span style="color:var(--fmp1-alert-ink)">! ' + esc(b.message) + '</span></li>'; }).concat(r.warnings.map(function (w) { return '<li><span>i ' + esc(w.message) + '</span></li>'; })).join('');
    var out = es.state === 'out_for_signature' || es.state === 'buyer_signed' || es.state === 'sending';
    var signer = '<label class="p2-fld" style="max-width:340px"><span>Signs for Fremont Makers on this job</span><select class="fmp1-input" data-fmsigner' + (out ? ' disabled' : '') + '><option value="">Choose…</option>' +
      signers().map(function (p, i) { return '<option value="' + i + '"' + (p.email ? '' : ' disabled') + (j.fmSigner && p.email && j.fmSigner.email === p.email ? ' selected' : '') + '>' + esc(p.name) + (p.email ? '' : ' (add an email on the Users page)') + '</option>'; }).join('') + '</select></label>';
    var send = out ? '<div class="fmp1-note fmp1-note--info p2-small">' + (es.state === 'buyer_signed' ? 'The buyer signed. Waiting on ' + esc(j.fmSigner.name) + ' to countersign.' : 'Out for signature. Pricing is frozen until it\'s signed, declined or canceled.') + '</div>' +
        '<div class="p2-row">' + (es.state === 'out_for_signature' ? '<button class="fmp1-btn" data-esim="signed">Buyer signs (simulate)</button><button class="fmp1-btn fmp1-btn--quiet" data-esim="declined">Buyer declines (simulate)</button>' : '') +
        (es.state === 'buyer_signed' ? '<button class="fmp1-btn fmp1-btn--primary" data-esim="fm">Countersign as ' + esc(j.fmSigner.name) + ' (frame)</button>' : '') + '</div>'
      : '<div class="p2-chips" role="group" aria-label="How it\'s signed">' + [['email', 'Email for signature'], ['review', 'Check, then send'], ['in_person', 'Sign here now']].map(function (m) {
          return '<button class="fmp1-btn" data-esmode="' + m[0] + '" aria-pressed="' + ((c.ui.esMode || 'email') === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
        '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-essend' + (r.ready ? '' : ' disabled') + '>Send for signature</button><span class="p2-small fmp1-faint">' + (r.ready ? 'Goes to ' + esc(j.contacts.buyerEmail) + ' (simulated in the preview)' : 'Fix the items above first.') + '</span></div>' +
        '<details><summary class="p2-small"><b>Signed on paper instead?</b> Upload the wet-signed copy</summary><div class="p2-form" style="margin-top:8px"><span class="p2-small">Sample scan: ' + esc(j.jobCode) + ' signed contract.pdf</span>' +
        '<label class="p2-row p2-small"><input type="checkbox" data-paperbuyer> Buyer signed every line</label><label class="p2-row p2-small"><input type="checkbox" data-paperfm> Fremont Makers countersigned</label>' +
        '<button class="fmp1-btn" data-paper' + (r.ready ? '' : ' disabled') + '>Record signed copy</button></div></details>';
    var errs = c.ui.esErr ? '<div class="fmp1-note fmp1-note--alert p2-small" role="alert">' + esc(c.ui.esErr) + '</div>' : '';
    return '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Ready to contract?</span>' + (checks ? '<ul class="p2-list">' + checks + '</ul>' : '<p class="p2-ok">✓ Everything checks out.</p>') + signer + '</div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Send for signature</span>' + c.docRows(j, { kind: '__none', packetTitle: 'Contract packet (draft)', packetSub: 'What the buyer will sign: summary, schedule, invoices, quote' + (j.elevations && j.elevations.rooms && j.elevations.rooms.length ? ' and elevations' : '') }) + errs + send + '</div>';
  }
  function contracted(c, j, how) {
    var who = c.me().name;
    c.store.update(j.jobCode, function (x) {
      x.stage = 'contract_signed'; x.contractedOn = c.TODAY;
      x.history = (x.history || []).concat([{ from: 'quote', to: 'contract_signed', date: c.TODAY, reason: how, by: who }]);
      if (x.invoices[0]) x.invoices[0].dueDate = c.TODAY;   // deposit due on signing
      var E = x.elevations;   // keep the drawings as signed; change orders add numbered revisions after this
      if (E && E.rooms && E.rooms.length) { E.versions = E.versions || []; E.versions.push({ n: E.versions.length + 1, label: 'As signed', signed: true, at: new Date().toISOString(), by: who, rooms: JSON.parse(JSON.stringify(E.rooms)), sizes: JSON.parse(JSON.stringify(E.sizes || {})) }); }
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
      if (t.dataset.npkind) { d.kind = t.dataset.npkind; if (d.kind === 'single') d.models = d.models.slice(0, 1); saveDraft(c); c.render(); return true; }
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
        if (d.duplicatedFrom) c.store.update(res.job.jobCode, function (x) { return x; }, 'Duplicated from ' + d.duplicatedFrom + ' (customer, cabinets, pricing' + (res.job.elevations ? ', drawings' : '') + ').', c.me().name);
        clearDraft(c); c.go('#/job/' + encodeURIComponent(res.job.jobCode) + '/overview'); return true;
      }
    }
    if (!j) return false;
    // Change orders
    if (t.hasAttribute('data-costart')) { var house = j.houses && j.houses.length > 1 ? j.houses[0].jobCode : null, bl = baseLines(c, j, house);
      c.ui.co = { job: j.jobCode, step: 0, reason: 'customer_request', note: '', house: house, base: bl, current: JSON.parse(JSON.stringify(bl)), choice: null, customAmt: '', customNote: '', colorOk: false, errors: [] }; c.render(); return true; }
    var f = c.ui.co;
    if (f && f.job === j.jobCode) {
      if (t.hasAttribute('data-cocancel')) { c.ui.co = null; c.render(); return true; }
      if (t.dataset.costep) { f.step = +t.dataset.costep; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-conext')) { f.errors = coStepErrors(c, j, f); if (!f.errors.length) f.step++; c.render(); return true; }
      if (t.hasAttribute('data-coback')) { f.step = Math.max(0, f.step - 1); f.errors = []; c.render(); return true; }
      if (t.dataset.coqty) { var l = f.current[+t.dataset.coqty]; l.qty = Math.max(0, l.qty + (+t.dataset.d)); c.render(); return true; }
      if (t.dataset.cochoice) { f.choice = t.dataset.cochoice; f.errors = []; c.render(); return true; }
      if (t.hasAttribute('data-cosave')) { var pe = saveCO(c, j, f); if (pe) { f.errors = pe; c.render(); return true; } c.ui.co = null; c.render(); return true; }
    }
    if (t.dataset.coapprove) {
      var co = j.changeOrders.filter(function (x) { return x.id === t.dataset.coapprove; })[0], ap = CO.approve(Object.assign({}, co, { status: 'draft' }), c.me().name, { owners: window.P2Users ? window.P2Users.approvers() : [], at: c.TODAY });
      if (ap.ok) c.store.update(j.jobCode, function (x) { x.changeOrders = x.changeOrders.map(function (y) { if (y.id !== co.id) return y; var z = ap.co; z.status = 'approved'; return z; }); x.absorbedCents = (x.absorbedCents || 0) + (co.absorbedCents || 0); return x; }, ap.log, c.me().name);
      c.render(); return true;
    }
    if (t.dataset.cosigned) {
      var sc = j.changeOrders.filter(function (x) { return x.id === t.dataset.cosigned; })[0], inv = CO.invoiceFor(sc, { today: c.TODAY });
      c.store.update(j.jobCode, function (x) {
        x.changeOrders = x.changeOrders.map(function (y) { if (y.id === sc.id) { y.status = 'signed'; y.signedOn = c.TODAY; } return y; });
        x.taxCents = (x.taxCents || 0) + (sc.taxCents || 0); if (x.costCents != null) x.costCents += (sc.costCents || 0);
        if (inv) x.invoices = x.invoices.concat([{ id: x.jobCode + '-inv' + (x.invoices.length + 1), label: inv.label + ' invoice', role: 'change_order', changeOrderId: sc.id, dueDate: c.TODAY, amountCents: inv.amountCents, status: 'open', payments: [] }]);
        if (x.models && x.models[0] && sc.lines && !sc.house) { x.models[0].lines = sc.lines.filter(function (l) { return l.qty > 0; }); x.changeOrders.forEach(function (y) { if (y.id === sc.id) y.inLines = true; }); }
        return x;
      }, 'Change order ' + sc.number + ' signed by the buyer. Contract total +' + c.money(sc.amountCents) + (inv ? '; its own invoice is due today.' : '.'), c.me().name);
      c.render(); return true;
    }
    // Contract
    if (t.dataset.esmode) { c.ui.esMode = t.dataset.esmode; c.render(); return true; }
    if (t.hasAttribute('data-essend')) {
      if (!K.readiness(readinessJob(j), { today: c.TODAY, authorizedSigners: signers().filter(function (p) { return p.email; }) }).ready) { c.render(); return true; }   // the button is disabled too; this is the real check
      var req = K.signatureRequest(readinessJob(j), { mode: c.ui.esMode || 'email', clientId: 'demo-client-id', requesterEmail: 'office@example.com', testMode: true });
      var st = K.applyEvent({ requestId: 'sr_' + j.jobCode, state: 'sending', jobStatus: 'proposed', seen: [] }, { event: { event_type: 'signature_request_sent', event_time: '1' }, signature_request: { signature_request_id: 'sr_' + j.jobCode } });
      c.store.update(j.jobCode, function (x) { x.esign = st.state; return x; }, 'Contract sent for signature (' + req.url.split('/v3/')[1] + ') by ' + c.me().name + '. Signed for Fremont Makers by ' + j.fmSigner.name + '.', c.me().name);
      c.render(); return true;
    }
    if (t.dataset.esim) {
      var ev = { signed: 'signature_request_signed', declined: 'signature_request_declined', fm: 'signature_request_all_signed' }[t.dataset.esim];
      var es = K.applyEvent(j.esign, { event: { event_type: ev, event_time: String(Date.now()) }, signature_request: { signature_request_id: j.esign.requestId, signatures: [{ signer_email_address: j.contacts.buyerEmail, status_code: 'signed' }] } });
      c.store.update(j.jobCode, function (x) { x.esign = es.state; return x; }, es.log, c.me().name);
      if (es.state.state === 'signed') contracted(c, c.store.job(j.jobCode), 'Dropbox Sign, countersigned by ' + j.fmSigner.name);
      c.render(); return true;
    }
    if (t.hasAttribute('data-paper')) {
      var root = t.closest('details');
      var pr = K.recordPaperSigned(j.esign || {}, { fileName: j.jobCode + ' signed contract.pdf', bytes: 1843200, sha256: '9c4e1f0a7b2d3c5e6f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6', signedDate: c.TODAY, uploadedBy: c.me().name,
        buyerSignedAll: root.querySelector('[data-paperbuyer]').checked, fmSigned: root.querySelector('[data-paperfm]').checked, fmSignerName: j.fmSigner ? j.fmSigner.name : '' }, { today: c.TODAY, ready: true });
      if (!pr.ok) { c.ui.esErr = pr.errors.join(' '); c.render(); return true; }
      c.ui.esErr = null;
      c.store.update(j.jobCode, function (x) { x.esign = pr.state; x.documents = (x.documents || []).concat([{ jobCode: x.jobCode, title: 'Signed contract (paper)', file: pr.document.fileName, pages: 6, bytes: pr.document.bytes, sha256: pr.document.sha256, kind: 'contract', contains: 'Wet-signed contract packet' }]); return x; }, pr.log, c.me().name);
      contracted(c, c.store.job(j.jobCode), 'signed on paper'); c.render(); return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d;
    if (el.dataset.np) { d = loadDraft(c); d[el.dataset.np] = el.value; saveDraft(c); if (el.dataset.np === 'bidAmount') refreshLater(c); return; }
    if (el.dataset.npm) { d = loadDraft(c); var m = d.models[+el.dataset.i]; m[el.dataset.npm] = el.dataset.npm === 'qty' ? Math.max(0, parseInt(el.value, 10) || 0) : el.value; saveDraft(c); return; }
    if (el.dataset.npp) { d = loadDraft(c); d.pricing[el.dataset.npp] = el.dataset.npp === 'assembly' ? el.value : num(el.value); if (el.dataset.npp === 'markupPct') reapply(d); saveDraft(c); refreshLater(c); return; }
    if (el.dataset.npline) { d = loadDraft(c); var ix = el.dataset.npline.split(':'), ln = d.models[+ix[0]].lines[+ix[1]]; ln.markupPct = num(el.value); ln.edited = true; saveDraft(c); refreshLater(c); return; }
    if (el.dataset.cof && c.ui.co) { c.ui.co[el.dataset.cof] = el.value; return; }
  }
  var timer = null;
  function refreshLater(c) { clearTimeout(timer); timer = setTimeout(function () { var a = document.activeElement, key = a && (a.dataset.npp || a.dataset.npline || a.dataset.np), sel = a && a.selectionStart; c.render(); if (key) { var n = document.querySelector('[data-npp="' + key + '"],[data-npline="' + key + '"],[data-np="' + key + '"]'); if (n) { n.focus(); try { n.setSelectionRange(sel, sel); } catch (x) { /* number inputs */ } } } }, 450); }
  function change(c, e) {
    var el = e.target, d;
    if (el.dataset.np === 'customer') { d = loadDraft(c); d.customer = el.value; saveDraft(c); c.render(); return; }
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
    if (el.hasAttribute('data-npplan')) { d = loadDraft(c); d.pricing.plan = PLANS[+el.value].slice(); saveDraft(c); c.render(); return; }
    if (el.hasAttribute('data-npatcost')) { d = loadDraft(c); d.pricing.atCost = el.checked; reapply(d); saveDraft(c); c.render(); return; }
    if (el.hasAttribute('data-npbid')) { d = loadDraft(c); d.bid = el.checked; saveDraft(c); c.render(); return; }
    if (el.hasAttribute('data-npcopy')) {
      d = loadDraft(c); var src = c.store.job(el.value);
      if (src && src.pricing) { var p = src.pricing; d.pricing.markupPct = p.markupPct; d.pricing.discountPctOfCost = p.discountPctOfCost; d.pricing.gaPct = p.gaPct; d.pricing.taxPct = p.taxPct;
        if (p.assemblyCents != null) d.pricing.assembly = (p.assemblyCents / 100).toFixed(2); if (p.plan) d.pricing.plan = p.plan.slice(); else if (src.invoices.length === 3) d.pricing.plan = [50, 30, 20]; d.copiedFrom = src.jobCode; reapply(d); }
      saveDraft(c); c.render(); return;
    }
    var r = location.hash.replace(/^#\/?/, '').split('/'), j = r[0] === 'job' ? c.store.job(decodeURIComponent(r[1])) : null;
    if (!j) return;
    if (el.dataset.cof === 'house' && c.ui.co) { var f = c.ui.co; f.house = el.value; f.base = baseLines(c, j, f.house); f.current = JSON.parse(JSON.stringify(f.base)); c.render(); return; }
    if (el.dataset.cof === 'reason' && c.ui.co) { c.ui.co.reason = el.value; return; }
    if (el.hasAttribute('data-copdf') && c.ui.co) { var pd = pdfById(el.value); if (pd) { c.ui.co.current = CO.mergeLines(c.ui.co.current, pd.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCostCents: l.unitCostCents }; }), 'add').lines; } c.render(); return; }
    if (el.hasAttribute('data-cocolor') && c.ui.co) { c.ui.co.colorOk = el.checked; c.render(); return; }
    if (el.hasAttribute('data-fmsigner')) { var s = signers()[+el.value]; if (s && !s.email) s = null; c.store.update(j.jobCode, function (x) { x.fmSigner = s ? { name: s.name, email: s.email } : null; return x; }, s ? s.name + ' will sign for Fremont Makers.' : null, c.me().name); c.render(); return; }
  }

  window.P2NewProject = { render: renderNew };
  window.P2Flows = { changes: renderChanges, contract: renderContract, click: click, input: input, change: change, quotesFor: quotesFor, signers: signers, dupConfirm: dupConfirm };
  if (window.P2) window.P2.render();
})();
