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
  var VERSION = '0.2.0-phase2';
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
        x.costNote = null;
        x.charges = { parts: Object.keys(W.models).map(function (name) {   // each model's signed quote, times its houses
          var c = W.models[name].contract, n = W.houses.filter(function (h) { return h.model === name; }).length, cts = FM.toCents;
          return part(name + ' × ' + n, { cabinetsCents: cts(c.cabinets), discountCents: cts(c.discount), laborCents: cts(c.assembly), gaCents: cts(c.ga), taxCents: cts(c.tax), totalCents: cts(c.total) }, n, cts(c.costTotal));
        }) };
        (W.changeOrders || []).forEach(function (wc) {   // the executed change order, with its lines and its own pricing
          var co = x.changeOrders.filter(function (c) { return c.number === wc.number; })[0]; if (!co) return;
          var pt = wc.printed, cents = FM.toCents;
          co.kind = 'charge'; co.reason = wc.reason; co.due = wc.due;
          co.added = wc.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty }; }); co.removed = [];
          co.pricing = { discountPctOfCost: wc.pricing.discountPctOfCost, gaPct: wc.pricing.gaPct, taxPct: wc.pricing.taxPct, labor: [{ role: 'Assembly', rateCents: cents(wc.pricing.assembly.rate), hours: wc.pricing.assembly.hours }] };
          co.priced = { printed: true, lines: wc.lines.map(function (l) { return { sku: l.sku, desc: l.desc, qty: l.qty, unitCents: cents(l.unit), totalCents: cents(l.total) }; }),
            summary: { cabinetsCents: cents(pt.cabinets), discountCents: -cents(pt.discount), laborCents: cents(pt.assembly), gaCents: cents(pt.ga), taxCents: cents(pt.tax), totalCents: cents(pt.total) } };
          co.taxCents = cents(pt.tax); co.costCents = cents(wc.costTotal); co.costIsEstimate = !!wc.costIsEstimate;
          x.taxCents += co.taxCents; x.costCents += co.costCents;
          x.costNote = wc.costIsEstimate ? 'Change order ' + wc.number + ' cost is worked back from its ' + wc.pricing.discountPctOfCost + '% discount (the PDF has no unit costs).' : null;
          (wc.documents || []).forEach(function (d) { x.documents.push(Object.assign({ jobCode: x.jobCode, changeOrder: wc.number }, d)); });
        });
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
        var cts = FM.toCents, item = cts(k.cabinets) - cts(k.discount) + cts(k.assembly) + cts(k.ga) + cts(k.tax);
        x.charges = { parts: [part(B.project || 'Penrose', { cabinetsCents: cts(k.cabinets), discountCents: cts(k.discount), laborCents: cts(k.assembly), gaCents: cts(k.ga), taxCents: cts(k.tax), totalCents: item }, 1, x.costCents),
          part('Agreed bid price above the itemized quote (grandfathered)', { otherCents: cts(k.total) - item, totalCents: cts(k.total) - item }, 1, 0, 'agreed')] };
      }
      if (B && W && x.jobCode === W.jobCode) x.documents = (B.documents || []).filter(function (d) { return d.jobCode === x.jobCode; }).concat(x.documents);
      return x;
    });
    return { version: VERSION, today: S.today, jobs: jobs, log: [], seq: 0, company: src.company ? clone(src.company) : null };
  }

  /* Data saved before a job had its charge breakdown (or before Willow Creek change order 1 had its lines) picks those up
     from the seed, so the books never show a job as one unexplained number. Only fills what's missing; never overwrites. */
  function upgrade(state, seed) {
    if (!state.company && seed.company) state.company = clone(seed.company);   // saved before the company books came over (2.10.0)
    (state.jobs || []).forEach(function (j) {
      var s = (seed.jobs || []).filter(function (x) { return x.jobCode === j.jobCode; })[0];
      // a supplier credit learned later (Penrose CO 1 refund, Nov 4) replaces what the saved courtesy change order assumed
      if (s) (j.changeOrders || []).forEach(function (co) {
        var sc = (s.changeOrders || []).filter(function (x) { return x.id === co.id && x.kind === 'courtesy'; })[0];
        if (!sc || co.supplierCreditCents === sc.supplierCreditCents) return;
        co.supplierCreditCents = sc.supplierCreditCents; co.absorbedCents = sc.absorbedCents; co.absorbedIsEstimate = sc.absorbedIsEstimate;
        j.absorbedCents = (j.changeOrders || []).filter(function (x) { return x.kind === 'courtesy'; }).reduce(function (t, x) { return t + (x.absorbedCents || 0); }, 0);
      });
      if (s) (j.changeOrders || []).forEach(function (co) {
        // a cost that was worked back (an estimate) is replaced once the real one is known (Willow Creek CO 1, Nov 5)
        var sc = (s.changeOrders || []).filter(function (x) { return x.id === co.id; })[0];
        if (!sc || !co.costIsEstimate || sc.costIsEstimate || sc.costCents == null || co.costCents === sc.costCents) return;
        if (j.costCents != null) j.costCents += sc.costCents - (co.costCents || 0);
        co.costCents = sc.costCents; co.costIsEstimate = false; j.costNote = s.costNote === undefined ? null : s.costNote;
      });
      // payments recorded in the existing tool after this data was saved (Penrose invoice 3, Willow Creek CO 1 invoice)
      if (s) (j.invoices || []).forEach(function (inv) {
        var si = (s.invoices || []).filter(function (x) { return x.id === inv.id; })[0];
        if (!si || (inv.payments || []).length || !(si.payments || []).length || si.amountCents !== inv.amountCents) return;
        inv.payments = clone(si.payments); if (si.status) inv.status = si.status;
      });
      if (!s || j.charges || !s.charges) return;
      j.charges = clone(s.charges);
      (j.changeOrders || []).forEach(function (co) {
        var sc = (s.changeOrders || []).filter(function (x) { return x.id === co.id; })[0]; if (!sc || co.priced || !sc.priced) return;
        ['kind', 'priced', 'pricing', 'added', 'removed', 'due', 'costIsEstimate'].forEach(function (k) { if (sc[k] !== undefined) co[k] = clone(sc[k]); });
        j.taxCents = (j.taxCents || 0) + (sc.taxCents || 0) - (co.taxCents || 0); if (j.costCents != null) j.costCents += (sc.costCents || 0) - (co.costCents || 0);
        co.taxCents = sc.taxCents; co.costCents = sc.costCents;
      });
      if (s.costNote !== undefined) j.costNote = s.costNote;
      var have = {}; (j.documents || []).forEach(function (d) { have[d.file] = true; });
      j.documents = (j.documents || []).concat((s.documents || []).filter(function (d) { return !have[d.file]; }).map(clone));
    });
  }

  function counts(j) { return !j.testVoid; }

  /*
   * Charges on a job, broken out (HANDOFF §30). One part per model / house group, per change order, and for any agreed
   * (bid or grandfathered) difference. Every part: cabinets (at sell), discount (negative), labor (assembly), G&A, other,
   * sales tax, total and cabinet cost. The parts always add up to the contract total; a gap is shown as its own row.
   * Gross profit = revenue (contract − sales tax) − cabinet cost − courtesy absorbed. Assembly labor and G&A count as
   * profit: the tool records no wage cost against them (owner, Nov 4 2026).
   */
  function part(label, s, n, costCents, kind) {
    n = n || 1;
    var known = (s.cabinetsCents || 0) - Math.abs(s.discountCents || 0) + (s.laborCents || 0) + (s.gaCents || 0) + (s.otherCents || 0) + (s.taxCents || 0);
    if (s.totalCents != null && known !== s.totalCents) s = Object.assign({}, s, { otherCents: (s.otherCents || 0) + s.totalCents - known });   // pennies the printed parts don't add to
    return { label: label, kind: kind || 'model', qty: n, cabinetsCents: (s.cabinetsCents || 0) * n, discountCents: -Math.abs(s.discountCents || 0) * n, laborCents: (s.laborCents || 0) * n,
      gaCents: (s.gaCents || 0) * n, otherCents: (s.otherCents || 0) * n, taxCents: (s.taxCents || 0) * n, totalCents: (s.totalCents || 0) * n, costCents: costCents == null ? null : costCents * n };
  }
  var KEYS = ['cabinetsCents', 'discountCents', 'laborCents', 'gaCents', 'otherCents', 'taxCents', 'totalCents'];
  function charges(job) {
    var parts = ((job.charges && job.charges.parts) || []).map(clone);
    (job.changeOrders || []).filter(function (c) { return FM.coCountsTowardContract(c) && c.kind !== 'courtesy' && c.amountCents; }).forEach(function (c) {
      var label = 'Change order ' + c.number;
      if (c.priced && c.priced.summary && c.kind !== 'custom') parts.push(part(label, c.priced.summary, 1, c.costCents == null ? null : c.costCents, 'change_order'));
      else parts.push(part(label + ' (agreed amount)', { otherCents: c.amountCents - (c.taxCents || 0), taxCents: c.taxCents || 0, totalCents: c.amountCents }, 1, c.costCents == null ? null : c.costCents, 'change_order'));
    });
    var contract = FM.contractSummary(job).currentCents, sumOf = function (k) { return parts.reduce(function (t, p) { return t + p[k]; }, 0); };
    var gap = contract - sumOf('totalCents');
    if (gap) {
      var taxGap = (job.taxCents || 0) - sumOf('taxCents'), small = Math.abs(gap) <= 100 && !taxGap;
      parts.push(part(small ? 'Rounding (as printed by the old tool)' : parts.length ? 'Not broken out' : 'Not broken out (no line detail on file)',
        { otherCents: gap - (small ? 0 : taxGap), taxCents: small ? 0 : taxGap, totalCents: gap }, 1, null, 'gap'));
    }
    var totals = {}; KEYS.forEach(function (k) { totals[k] = sumOf(k); });
    var known = parts.filter(function (p) { return p.costCents != null; });
    totals.costCents = known.length ? known.reduce(function (t, p) { return t + p.costCents; }, 0) : null;
    totals.revenueCents = totals.totalCents - totals.taxCents;
    return { parts: parts, totals: totals };
  }

  /* The shape Company Books (FMBooks) reads. */
  function toBooks(job) {
    var s = FM.contractSummary(job);
    return { jobCode: job.jobCode, customer: job.customer, project: job.projectName, stage: job.stage,
      contractedOn: job.contractedOn || null, quoteDate: job.quoteDate || null, deliveryDate: job.deliveryDate || null,
      contractCents: s.currentCents, taxCents: job.taxCents || 0, costCents: job.costCents == null ? null : job.costCents,
      absorbedCents: job.absorbedCents || 0, invoices: job.invoices, testVoid: !!job.testVoid, charges: charges(job) };
  }

  var METHODS = { check: 'Check', ach: 'ACH / bank transfer', card: 'Card', cash: 'Cash' };

  function create(opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var state = (storage && storage.load && storage.load()) || clone(opts.seed);
    if (opts.seed && state !== opts.seed) upgrade(state, opts.seed);
    function save() { if (storage && storage.save) storage.save(state); }
    function job(code) { return state.jobs.filter(function (j) { return j.jobCode === code; })[0] || null; }
    function log(jobCode, text, by, at) {
      state.seq += 1;
      state.log.unshift({ id: state.seq, jobCode: jobCode, text: text, by: by || 'unknown', at: at || new Date().toISOString() });
    }
    return {
      VERSION: VERSION, METHODS: METHODS,
      get state() { return state; },
      /* Jobs that count. Jobs marked Test / Void are left out of every list, total and report; pass { all: true } to include them. */
      jobs: function (o) { return o && o.all ? state.jobs : state.jobs.filter(counts); },
      job: job,
      books: function () { return state.jobs.filter(counts).map(toBooks); },
      /* Test / Void (HANDOFF §29): Full access only, a reason, logged; the stage is kept so Restore puts it back exactly. */
      markTestVoid: function (code, reason, user, at) {
        var j = job(code); if (!j) return { ok: false, error: 'No job ' + code + '.' };
        if (!user || user.access !== 'full') return { ok: false, error: 'Only someone with Full access can mark a project Test / Void.' };
        if (j.testVoid) return { ok: false, error: 'This project is already marked Test / Void.' };
        if (!String(reason || '').trim()) return { ok: false, error: 'Say why, for example "test project" or "entered twice".' };
        var paid = j.invoices.reduce(function (t, i) { return t + FM.invoicePaidCents(i); }, 0);
        return this.update(code, function (x) { x.testVoid = { reason: String(reason).trim(), by: user.name, on: (at || new Date().toISOString()).slice(0, 10), paidCents: paid }; return x; },
          'Marked Test / Void by ' + user.name + ': ' + String(reason).trim() + '. Left out of every total, report and list.' + (paid ? ' Its ' + FM.fmt(paid) + ' of recorded payments no longer count.' : ''), user.name, at);
      },
      restore: function (code, user, at) {
        var j = job(code); if (!j) return { ok: false, error: 'No job ' + code + '.' };
        if (!user || user.access !== 'full') return { ok: false, error: 'Only someone with Full access can restore a project.' };
        if (!j.testVoid) return { ok: false, error: 'This project isn\'t marked Test / Void.' };
        return this.update(code, function (x) { delete x.testVoid; return x; }, 'Restored by ' + user.name + ' (was Test / Void). It counts again, at the stage it had.', user.name, at);
      },
      /* Company P&L and Balance Sheet (FMCompany). Changes are made with FMCompany.setMonth / setStandard / setBalance,
         which check Full access, then saved here and logged under 'COMPANY'. */
      company: function () { return state.company; },
      saveCompany: function (r, by, at) {
        if (!r || !r.ok) return r || { ok: false, error: 'Nothing to save.' };
        state.company = clone(r.company); log('COMPANY', r.text, by, at); save();
        return { ok: true, company: state.company };
      },
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

  return { VERSION: VERSION, seed: seed, upgrade: upgrade, toBooks: toBooks, counts: counts, charges: charges, part: part, create: create, browserStorage: browserStorage, METHODS: METHODS };
}));
