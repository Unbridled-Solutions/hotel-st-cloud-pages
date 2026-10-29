/*
 * Fremont Makers · Project Builder · Phase 2 · data store
 * Version 0.1.0-phase2. One place the Phase 2 screens read and save jobs. UMD: window.FMStore.
 *
 * The store never touches the existing tool's data. It starts from legacy records (read-only, through the
 * Phase 1 adapter), attaches change orders that were filed as separate projects, and adds what Phase 2
 * knows (pricing per job, tax and cost for the books, courtesy change orders, documents, e-sign state).
 *
 * Persistence is pluggable: `create({ storage })` where storage = { load(): state|null, save(state) }.
 * The preview uses browser storage; in production Hermes passes the shared server database (§10, §22).
 * Every change goes through `update()` / `addJob()` / `recordPayment()` and is logged with who did it.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = isNode ? factory(require('./fm-phase1-ledger.js')) : factory(root.FMPhase1);
  if (isNode) module.exports = api; else root.FMStore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';
  var VERSION = '0.1.0-phase2';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /*
   * Build the starting jobs from the sample legacy records plus the full order data.
   * src: { sample (FM_SAMPLE), willow (FM_WILLOW_ORDER), braddy (FM_BRADDY_ORDER) }
   */
  function seed(src) {
    var S = src.sample, W = src.willow, B = src.braddy;
    var jobs = FM.jobsFromLegacy(S.legacyProjects);
    FM.detectLegacyChangeOrders(S.legacyProjects).forEach(function (p) {
      if (p.parentJobCode && p.confidence === 'high') { var r = FM.attachChangeOrder(jobs, p, {}); if (r.ok) jobs = r.jobs; }
    });
    jobs = jobs.map(function (j) {
      var x = clone(j);
      x.taxCents = 0; x.costCents = null; x.absorbedCents = 0; x.pricing = null; x.documents = []; x.fmSigner = null; x.esign = { state: 'none' };
      x.contractedOn = x.stage === 'quote' || x.stage === 'lost' ? null : x.quoteDate;
      if (W && x.jobCode === W.jobCode) {
        var tax = 0, cost = 0;
        W.houses.forEach(function (h) { var m = W.models[h.model].contract; tax += FM.toCents(m.tax); cost += FM.toCents(m.costTotal); });
        x.taxCents = tax; x.costCents = cost;
        x.costNote = 'Change order 1 cost isn\'t recorded yet.';
        x.pricing = { markupPct: null, discountPctOfCost: W.pricing.mfrDiscountPct, gaPct: W.pricing.gaPct, taxPct: W.pricing.taxPct, note: 'Markup set per model (18–72%).' };
        x.contacts.signer = W.signer;
      }
      if (B && x.jobCode === B.jobCode) {
        var k = B.model.contract;
        x.taxCents = FM.toCents(k.tax);
        x.costCents = B.model.screenTotals ? FM.toCents(B.model.screenTotals.costCharged) : null;
        x.pricing = { markupPct: B.pricing.defaultMarkupPct, discountPctOfCost: B.pricing.mfrDiscountPct, gaPct: B.pricing.gaPct, taxPct: B.pricing.taxPct,
                      assemblyCents: Math.round(B.model.assembly.rate * 100 * B.model.assembly.hours) };
        x.color = B.color;
        var so = (B.supplierOrders || [])[0];
        (B.changeOrders || []).forEach(function (c) {
          x.changeOrders.push({ id: x.jobCode + '-co' + c.number, number: c.number, date: c.date, kind: c.kind, status: 'approved', amountCents: 0,
            reason: 'Backordered item substituted', removed: c.removed, added: c.added.map(function (a) { return { sku: a.sku, desc: a.desc, qty: a.qty, unitCostCents: FM.toCents(a.unitCost) }; }),
            supplierOrder: so ? { number: so.orderNumber, paidCents: FM.toCents(so.total) } : null,
            supplierCreditCents: c.supplierCredit == null ? null : FM.toCents(c.supplierCredit),
            absorbedCents: so ? FM.toCents(so.total) - (c.supplierCredit ? FM.toCents(c.supplierCredit) : 0) : 0, absorbedIsEstimate: c.supplierCredit == null,
            inLines: true });   // the job's cabinet lines already show this change
        });
        x.absorbedCents = x.changeOrders.reduce(function (t, c) { return t + (c.absorbedCents || 0); }, 0);
        x.documents = (B.documents || []).filter(function (d) { return d.jobCode === x.jobCode; });
        x.grandfathered = { signedCents: FM.toCents(k.total) };
      }
      if (B && W && x.jobCode === W.jobCode) x.documents = (B.documents || []).filter(function (d) { return d.jobCode === x.jobCode; });
      return x;
    });
    return { version: VERSION, today: S.today, jobs: jobs, log: [], seq: 0 };
  }

  /* The shape Company Books (FMBooks) reads. */
  function toBooks(job) {
    var s = FM.contractSummary(job);
    return { jobCode: job.jobCode, customer: job.customer, project: job.projectName, stage: job.stage,
      contractedOn: job.contractedOn || null, quoteDate: job.quoteDate || null, deliveryDate: job.deliveryDate || null,
      contractCents: s.currentCents, taxCents: job.taxCents || 0, costCents: job.costCents == null ? null : job.costCents,
      absorbedCents: job.absorbedCents || 0, invoices: job.invoices };
  }

  var METHODS = { check: 'Check', ach: 'ACH / bank transfer', card: 'Card', cash: 'Cash' };

  function create(opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var state = (storage && storage.load && storage.load()) || clone(opts.seed);
    function save() { if (storage && storage.save) storage.save(state); }
    function job(code) { return state.jobs.filter(function (j) { return j.jobCode === code; })[0] || null; }
    function log(jobCode, text, by, at) {
      state.seq += 1;
      state.log.unshift({ id: state.seq, jobCode: jobCode, text: text, by: by || 'unknown', at: at || new Date().toISOString() });
    }
    return {
      VERSION: VERSION, METHODS: METHODS,
      get state() { return state; },
      jobs: function () { return state.jobs; },
      job: job,
      books: function () { return state.jobs.map(toBooks); },
      log: function (jobCode) { return state.log.filter(function (e) { return !jobCode || e.jobCode === jobCode; }); },
      reset: function () { state = clone(opts.seed); save(); },
      /* Add a new job (from the New Project flow). Job codes must be unique. */
      addJob: function (j, by, at) {
        if (job(j.jobCode)) return { ok: false, error: 'Job ' + j.jobCode + ' already exists.' };
        state.jobs.unshift(clone(j)); log(j.jobCode, 'Project created by ' + by + '.', by, at); save();
        return { ok: true, job: job(j.jobCode) };
      },
      /* Change a job with fn(copy) → copy; logs `text`. Returns the new job. */
      update: function (code, fn, text, by, at) {
        var i = state.jobs.findIndex(function (j) { return j.jobCode === code; });
        if (i < 0) return { ok: false, error: 'No job ' + code + '.' };
        var next = fn(clone(state.jobs[i]));
        if (!next || next.jobCode !== code) return { ok: false, error: 'The change didn\'t return the job.' };
        state.jobs[i] = next; if (text) log(code, text, by, at); save();
        return { ok: true, job: next };
      },
      /* Record a payment on an invoice. */
      recordPayment: function (code, invId, p, by, at) {
        var j = job(code); if (!j) return { ok: false, errors: ['No job ' + code + '.'] };
        var inv = j.invoices.filter(function (x) { return x.id === invId; })[0]; if (!inv) return { ok: false, errors: ['No invoice ' + invId + '.'] };
        var owed = inv.amountCents - FM.invoicePaidCents(inv), errs = [];
        if (!(p.amountCents > 0)) errs.push('Enter the amount received.');
        else if (p.amountCents > owed) errs.push('That\'s more than the ' + FM.fmt(owed) + ' still owed on this invoice.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) errs.push('Enter the date it was received.');
        else if (p.date > state.today) errs.push('The date can\'t be in the future.');
        if (!METHODS[p.method]) errs.push('Choose how it was paid.');
        if (p.method === 'check' && !String(p.reference || '').trim()) errs.push('Enter the check number.');
        if (errs.length) return { ok: false, errors: errs };
        var r = this.update(code, function (x) {
          x.invoices = x.invoices.map(function (v) { if (v.id !== invId) return v; v.payments = (v.payments || []).concat([{ amountCents: p.amountCents, date: p.date, method: p.method, reference: String(p.reference || '').trim() }]); return v; });
          return x;
        }, 'Payment of ' + FM.fmt(p.amountCents) + ' recorded on ' + inv.label + ' (' + METHODS[p.method] + (p.reference ? ' ' + p.reference : '') + ').', by, at);
        return { ok: true, job: r.job };
      }
    };
  }

  /* Browser storage for the preview only (one viewer, one device). Never used for production data. */
  function browserStorage(key) {
    return {
      load: function () { try { var s = window.localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
      save: function (st) { try { window.localStorage.setItem(key, JSON.stringify(st)); } catch (e) { /* storage unavailable: keep in memory */ } }
    };
  }

  return { VERSION: VERSION, seed: seed, toBooks: toBooks, create: create, browserStorage: browserStorage, METHODS: METHODS };
}));
