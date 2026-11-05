/*
 * Fremont Makers · Project Builder · Phase 2 · reading the existing tool's real data (HANDOFF §31).  window.FMLegacy
 * Pure functions: no DOM, storage or network. Read-only: the input is never changed.
 *
 * The existing tool (tools.fremontmakers.com/quote) keeps everything in one cloud bundle, fetched with
 *   GET /api/planner/bundle?ns=fm-quotes   →   { success, data }
 * `data` holds (values may be JSON strings):
 *   fm-quotes-index        the project list: [{ id, jobCode, customer, project, date, status, total, kind, parentOrderId }]
 *   fm-quote-<id>          one record per project, AND one per house of a builder order (kind 'child')
 *   fm-cpnl-<YYYY-MM>      Company P&L inputs for that month
 *   fm-balance-sheet       the Balance Sheet inputs
 *   (fm-active-quote, fm-sq-archive: screen state and the supplier-quote library; not needed)
 * Records that are stored but not on the list were deleted (or replaced) in the existing tool; they are reported, not imported.
 *
 * read(data) → {
 *   legacyProjects: [...]   the shape FMPhase1.jobsFromLegacy and FMStore.seed read (preview/sample-data.js)
 *   details: { jobCode: { pricing, labor, payPlan, lines, houses: [{ jobCode, name, model, color, lines }], changeOrders } }
 *   company: { months: { 'YYYY-MM': { key: cents } }, balance: { asOf, values: { key: cents } } }   (FMCompany reads this)
 *   skipped: [{ id, jobCode, customer, why }]
 * }
 * Hermes: call read() on a copy of the live bundle, then FMStore.seed({ sample: { today, legacyProjects }, ... }).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMLegacy = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var STATUS = { proposed: 'Proposed', approved: 'Proposed', contract: 'Contracted', completed: 'Completed', lost: 'Lost' };

  function parse(v) { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
  function money(v) { return Math.round(num(v) * 100) / 100; }
  function cents(v) { return Math.round(num(v) * 100); }
  function iso(ms) { var d = new Date(ms); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }

  /* The existing tool's payment plans: Willow Creek (and any '50-50' job) is 50% at order / 50% at delivery; everything else 50 / 30 / 20. */
  function plan(r) {
    if (r.payPlan === '50-50' || r.builderId === 'willow-creek') return { key: '50-50', stages: [{ pct: 50, label: 'Invoice 1 · 50% at order' }, { pct: 50, label: 'Invoice 2 · 50% at delivery' }] };
    return { key: '50-30-20', stages: [{ pct: 50, label: 'Invoice 1 · 50%' }, { pct: 30, label: 'Invoice 2 · 30%' }, { pct: 20, label: 'Invoice 3 · 20%' }] };
  }

  function invoicesOf(r, total) {
    var ar = r.ar || {}, p = plan(r), left = cents(total), out = [];
    p.stages.forEach(function (s, i) {
      var n = i + 1, amt = ar['d' + n + 'Amt'] != null && ar['d' + n + 'Amt'] !== '' ? cents(ar['d' + n + 'Amt']) : (i === p.stages.length - 1 ? left : Math.round(cents(total) * s.pct / 100));
      left -= amt;
      var inv = { label: s.label, due: ar['d' + n + 'Due'] || '', amount: amt / 100, status: ar['d' + n + 'Paid'] ? 'Paid' : 'Due' };
      if (ar['d' + n + 'Paid']) { if (ar['d' + n + 'PaidAt']) inv.paidDate = ar['d' + n + 'PaidAt']; if (ar['d' + n + 'Check']) inv.check = String(ar['d' + n + 'Check']); }
      out.push(inv);
    });
    (r.changeOrders || []).forEach(function (co) {
      var x = co.extraInvoice; if (!x) return;
      var inv = { label: 'Change order ' + co.n + ' invoice', due: x.due || '', amount: money(x.amt), status: x.paid ? 'Paid' : 'Due' };
      if (x.paid) { if (x.paidAt) inv.paidDate = x.paidAt; if (x.check) inv.check = String(x.check); }
      out.push(inv);
    });
    return out;
  }

  function linesOf(cabs) {
    return (cabs || []).map(function (c) { return { sku: c.serial || '', desc: c.desc || '', qty: num(c.qty), unitCost: money(c.cost), markupPct: num(c.markup) }; });
  }

  function changeOrdersOf(r) {
    return (r.changeOrders || []).map(function (co) {
      var diff = co.diff || {};
      return { number: co.n, date: iso(co.at), reason: co.reason || '', kind: co.payChoice === 'keep' ? 'courtesy' : 'charge',
        amount: money(co.changeAmount != null ? co.changeAmount : 0), signatures: co.signatures || '', billed: !!co.extraInvoice,
        added: (diff.added || []).map(function (a) { return { sku: a.serial || a.key, desc: a.desc || '', qty: num(a.newQty != null ? a.newQty - (a.oldQty || 0) : a.qty), unitCost: money(a.cost) }; }),
        removed: (diff.removed || []).map(function (a) { return { sku: a.serial || a.key, desc: a.desc || '', qty: num(a.oldQty != null ? a.oldQty - (a.newQty || 0) : a.qty), unitCost: money(a.cost) }; }),
        costTotal: co.materialsNet != null ? money(co.materialsNet) : null,
        pricing: co.bulkDiscPct != null ? { mfrDiscountPct: num(co.bulkDiscPct), gaPct: num(co.gnaPct), taxPct: num(co.taxPct), labor: (co.labor || []).map(function (l) { return { role: l.name || 'Labor', rate: num(l.rate), hours: num(l.hours) }; }) } : null,
        lines: co.cabinets ? linesOf(co.cabinets) : null };
    });
  }

  /* Company books: the P&L month inputs and the Balance Sheet, in cents with readable keys. */
  var BS_KEYS = { 'bs-cash': 'cash', 'bs-ar': 'receivable', 'bs-inventory': 'inventory', 'bs-prepaid': 'prepaid', 'bs-equipment': 'equipment', 'bs-vehicles': 'vehicles',
    'bs-leasehold': 'leasehold', 'bs-accum-dep': 'accumDepreciation', 'bs-ap': 'payable', 'bs-cc': 'creditCards', 'bs-accrued': 'accrued', 'bs-note-current': 'noteCurrent',
    'bs-note-lt': 'noteLongTerm', 'bs-fca-loan': 'fcaLoan', 'bs-equity-stan': 'equityUnbridled', 'bs-equity-partner': 'equityBigFam', 'bs-retained': 'retained', 'bs-net-income': 'netIncomeYtd' };
  var PNL_KEYS = { 'other-revenue': 'otherRevenue', freight: 'freight', salaries: 'guaranteedPayments', 'owner-draw': 'contractLabor', rent: 'rent', vehicle: 'vehicle', fuel: 'fuel',
    insurance: 'insurance', tools: 'tools', tech: 'tech', marketing: 'marketing', professional: 'professional', office: 'office', misc: 'misc', depreciation: 'depreciation',
    interest: 'interest', principal: 'principal' };

  function companyOf(data) {
    var months = {};
    Object.keys(data).forEach(function (k) {
      var m = /^fm-cpnl-(\d{4}-\d{2})$/.exec(k); if (!m) return;
      var v = parse(data[k]) || {}, out = {};
      Object.keys(PNL_KEYS).forEach(function (f) { if (v[f] != null) out[PNL_KEYS[f]] = cents(v[f]); });
      months[m[1]] = out;
    });
    var b = parse(data['fm-balance-sheet']), balance = null;
    if (b) { balance = { asOf: b.date || '', values: {} }; Object.keys(BS_KEYS).forEach(function (f) { balance.values[BS_KEYS[f]] = cents(b[f]); }); }
    return { months: months, balance: balance };
  }

  function read(data) {
    data = data || {};
    var index = parse(data['fm-quotes-index']) || [], skipped = [], projects = [], details = {}, listed = {}, byId = {};
    index.forEach(function (e) { listed[e.id] = e; });
    Object.keys(data).forEach(function (k) { if (k.indexOf('fm-quote-') === 0 && k !== 'fm-quotes-index') byId[k.slice(9)] = parse(data[k]); });
    Object.keys(byId).forEach(function (id) {
      if (!listed[id]) { var r = byId[id] || {}; skipped.push({ id: id, jobCode: r.jobCode || '', customer: r.customer || '', why: 'Stored but not on the project list (deleted or replaced in the existing tool).' }); }
    });
    index.forEach(function (e) {
      var r = byId[e.id], kind = (r && r.kind) || e.kind || 'job';
      if (kind === 'child') {
        if (!listed[e.parentOrderId] || !byId[e.parentOrderId]) skipped.push({ id: e.id, jobCode: e.jobCode, customer: e.customer, why: 'A house of a builder order that is no longer on the list.' });
        return;
      }
      if (kind === 'template' || (r && r.isTemplate)) { skipped.push({ id: e.id, jobCode: e.jobCode, customer: e.customer, why: 'A model recipe (template), not a project.' }); return; }
      if (!r) { skipped.push({ id: e.id, jobCode: e.jobCode, customer: e.customer, why: 'On the list, but its record is missing.' }); return; }
      var total = r.contractTotal != null ? money(r.contractTotal) : money(e.total), status = STATUS[r.status || e.status] || 'Proposed';
      var p = { jobCode: r.jobCode || e.jobCode, customer: r.customer || e.customer || '', projectName: r.project || e.project || '' };
      if (kind === 'order') p.kind = 'builder_order';
      p.quoteDate = r.date || e.date || '';
      if (r.installDate) p.deliveryDate = r.installDate;
      p.status = status; p.total = total;
      if (r.signerName) p.signerName = r.signerName;
      if (r.customerEmail != null || status !== 'Lost') p.buyerEmail = r.customerEmail || '';
      if (r.address) p.installAddress = r.address;
      var houses = [];
      if (kind === 'order') {
        houses = (r.childIds || []).map(function (cid) {
          var c = byId[cid] || {}, ce = listed[cid] || {};
          return { jobCode: c.jobCode || ce.jobCode, name: c.project || ce.project || '', model: c.modelName || '', color: c.colorName || '', lines: (c.cabinets || []).length, total: money(ce.total != null ? ce.total : c.contractTotal),
                   _lines: linesOf(c.cabinets), _pricing: { mfrDiscountPct: num(c.bulkDiscPct), gaPct: num(c.gnaPct), taxPct: num(c.taxPct) } };
        }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
        p.houses = houses.map(function (h) { return { jobCode: h.jobCode, name: h.name, model: h.model, color: h.color, lines: h.lines, total: h.total }; });
      }
      if (status === 'Contracted' || status === 'Completed') {
        p.invoices = invoicesOf(r, total);
        var log = (r.changeOrders || []).filter(function (co) { return co.extraInvoice; }).map(function (co) { return { date: co.extraInvoice.due || iso(co.at), what: 'Change order ' + co.n, amount: money(co.extraInvoice.amt), reason: co.reason || '' }; });
        if (log.length) p.changeLog = log;
        /* billed change orders become change orders on the job; courtesy ones (no invoice) stay in details for the store */
        var cos = (r.changeOrders || []).filter(function (co) { return co.extraInvoice; }).map(function (co) {
          return { number: co.n, date: co.extraInvoice.due || iso(co.at), reason: co.reason || '', amount: money(co.extraInvoice.amt), status: 'invoiced' };
        });
        if (cos.length) p.changeOrders = cos;
      }
      projects.push(p);
      details[p.jobCode] = {
        id: e.id, payPlan: plan(r).key,
        pricing: { mfrDiscountPct: num(r.bulkDiscPct), gaPct: num(r.gnaPct), taxPct: num(r.taxPct) },
        labor: (r.labor || []).map(function (l) { return { role: l.name || 'Labor', rate: num(l.rate), hours: num(l.hours) }; }),
        lines: linesOf(r.cabinets),
        originalLines: r.originalCabinets ? linesOf(r.originalCabinets) : null,
        houses: houses.map(function (h) { return { jobCode: h.jobCode, name: h.name, model: h.model, color: h.color, lines: h._lines, pricing: h._pricing }; }),
        changeOrders: changeOrdersOf(r),
        signatures: (r.signRequests || []).length
      };
    });
    return { legacyProjects: projects, details: details, company: companyOf(data), skipped: skipped };
  }

  return { VERSION: VERSION, read: read, plan: plan, BS_KEYS: BS_KEYS, PNL_KEYS: PNL_KEYS };
}));
