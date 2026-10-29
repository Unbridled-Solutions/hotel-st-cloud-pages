/*
 * Fremont Makers · Project Builder · Phase 1 ledger
 * -------------------------------------------------
 * Pure functions only. No DOM, no storage, no network, no globals besides
 * the single `FMPhase1` export in a browser. It never mutates its inputs.
 *
 * Phase 1 fixes:
 *   1. Change orders live inside their job; signed ones add to the contract total.
 *   2. Change orders filed as separate "projects" are detected and can be attached.
 *   3. Model totals have one source (sum of house totals), so app and packet match.
 *   4. Invoices show their real share of the current total and flag labels that don't match.
 *   5. Status moves through stage actions; contracted jobs are locked.
 *
 * All money is integer cents.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FMPhase1 = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.1-phase1';

  /* ---------- money ---------- */

  function toCents(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Math.round(v * 100);
    var s = String(v).replace(/[$,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('Not a money value: ' + v);
    return Math.round(parseFloat(s) * 100);
  }

  function fmt(cents, opts) {
    var neg = cents < 0, c = Math.abs(cents);
    var dollars = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var r = c % 100;
    var sign = neg ? '-' : (opts && opts.sign && c > 0 ? '+' : '');
    return sign + '$' + dollars + '.' + (r < 10 ? '0' : '') + r;
  }

  function sum(arr) { var t = 0; for (var i = 0; i < arr.length; i++) t += arr[i]; return t; }

  function pct(part, whole) { return whole ? Math.round((part / whole) * 10000) / 100 : 0; }

  /* ---------- dates (ISO yyyy-mm-dd) ---------- */

  function toISO(d) {
    if (!d) return null;
    var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = String(d).match(/^(\d{1,2})[\/:](\d{1,2})[\/:](\d{2,4})$/);
    if (m) {
      var y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + (m[1].length < 2 ? '0' : '') + m[1] + '-' + (m[2].length < 2 ? '0' : '') + m[2];
    }
    return null;
  }

  function dayNum(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function daysBetween(fromISO, toISO_) { return dayNum(toISO_) - dayNum(fromISO); }

  /* ---------- change orders ---------- */

  var CO_STATUSES = ['draft', 'sent', 'signed', 'invoiced', 'paid', 'void'];
  var CO_COUNTS = { signed: 1, invoiced: 1, paid: 1 };

  function coCountsTowardContract(co) { return !!CO_COUNTS[co.status]; }

  /* ---------- invoices ---------- */

  function invoicePaidCents(inv) { return sum((inv.payments || []).map(function (p) { return p.amountCents; })); }

  function invoiceState(inv, todayISO) {
    if (inv.status === 'void') return { key: 'void', label: 'Void', days: 0 };
    var paid = invoicePaidCents(inv);
    if (paid >= inv.amountCents) return { key: 'paid', label: 'Paid', days: 0 };
    var days = inv.dueDate ? daysBetween(todayISO, inv.dueDate) : null;
    if (days !== null && days < 0) return { key: 'overdue', label: (-days) + ' day' + (days === -1 ? '' : 's') + ' overdue', days: days };
    var base = paid > 0 ? 'Partly paid · ' : '';
    if (days === 0) return { key: 'due', label: base + 'Due today', days: 0 };
    return { key: paid > 0 ? 'partial' : 'due', label: base + (days === null ? 'No due date' : 'Due in ' + days + ' day' + (days === 1 ? '' : 's')), days: days };
  }

  function labelPercent(label) {
    var m = String(label || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? parseFloat(m[1]) : null;
  }

  /** Real share of an invoice, measured against the CURRENT contract total
   *  (original + counted change orders). Owner decision, 2026-10-27.
   *  Every invoice, change-order invoices included, uses the same basis,
   *  so a job's invoice shares add up to 100% when billing matches the contract. */
  function invoicePercent(inv, job) {
    var basis = contractSummary(job).currentCents, basisLabel = 'current total';
    var actual = pct(inv.amountCents, basis);
    var stated = labelPercent(inv.label);
    return {
      actual: actual,
      basisLabel: basisLabel,
      stated: stated,
      mismatch: stated !== null && Math.abs(actual - stated) > 0.25
    };
  }

  /* ---------- contract summary ---------- */

  function contractSummary(job) {
    var original = job.originalContractCents;
    var cos = (job.changeOrders || []).filter(coCountsTowardContract);
    var coTotal = sum(cos.map(function (c) { return c.amountCents; }));
    var current = original + coTotal;
    var live = (job.invoices || []).filter(function (i) { return i.status !== 'void'; });
    var invoiced = sum(live.map(function (i) { return i.amountCents; }));
    var paid = sum(live.map(invoicePaidCents));
    return {
      originalCents: original,
      changeOrderCents: coTotal,
      changeOrderCount: cos.length,
      currentCents: current,
      invoicedCents: invoiced,
      paidCents: paid,
      balanceCents: current - paid,
      unbilledCents: current - invoiced,
      invoicesMatchContract: current === invoiced,
      paidPct: pct(paid, current)
    };
  }

  /* ---------- model totals: the single source ---------- */

  /** Model total = sum of that model's house totals. The contract packet must
   *  print these exact values; never re-derive them from the order total. */
  function modelTotals(houses) {
    var order = [], by = {};
    (houses || []).forEach(function (h) {
      if (!by[h.model]) { by[h.model] = { model: h.model, count: 0, totalCents: 0 }; order.push(h.model); }
      by[h.model].count += 1;
      by[h.model].totalCents += h.totalCents;
    });
    var rows = order.map(function (m) { return by[m]; });
    return { rows: rows, orderTotalCents: sum(rows.map(function (r) { return r.totalCents; })) };
  }

  /** Compare two model-total lists (e.g. app vs. printed packet). */
  function compareModelTotals(a, b) {
    var map = {}; b.forEach(function (r) { map[r.model] = r.totalCents; });
    return a.filter(function (r) { return map[r.model] !== undefined && map[r.model] !== r.totalCents; })
      .map(function (r) { return { model: r.model, expectedCents: r.totalCents, foundCents: map[r.model], diffCents: map[r.model] - r.totalCents }; });
  }

  /* ---------- stages (replaces the status radio buttons) ---------- */

  var STAGES = [
    { key: 'quote', label: 'Quote' },
    { key: 'contract_signed', label: 'Contract signed' },
    { key: 'deposit_paid', label: 'Deposit paid' },
    { key: 'factory_ordered', label: 'Factory order placed' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'final_paid', label: 'Final payment' },
    { key: 'complete', label: 'Complete' }
  ];
  var STAGE_INDEX = {}; STAGES.forEach(function (s, i) { STAGE_INDEX[s.key] = i; });
  STAGE_INDEX.lost = -1;

  function stageLabel(key) { return key === 'lost' ? 'Lost' : STAGES[STAGE_INDEX[key]].label; }

  /** Which bucket the job counts toward in pipeline totals. */
  function stageBucket(key) {
    if (key === 'lost') return 'lost';
    if (key === 'quote') return 'proposed';
    if (key === 'complete') return 'completed';
    return 'contracted';
  }

  function depositPaid(job) {
    var dep = (job.invoices || []).filter(function (i) { return i.role === 'deposit'; })[0];
    return !!dep && invoicePaidCents(dep) >= dep.amountCents;
  }

  /** Forward actions available from each stage. `fields` are what the person must enter. */
  var ACTIONS = {
    quote: [
      { id: 'sign', to: 'contract_signed', label: 'Record signed contract', fields: ['date'] },
      { id: 'lose', to: 'lost', label: 'Mark lost', fields: ['reason'], tone: 'quiet' }
    ],
    contract_signed: [
      { id: 'deposit', to: 'deposit_paid', label: 'Confirm deposit received', fields: ['date'], guard: function (j) { return depositPaid(j) ? null : 'Record the deposit payment on Invoice 1 first.'; } },
      { id: 'void', to: 'quote', label: 'Void contract…', fields: ['reason'], tone: 'quiet', guard: function (j) { return contractSummary(j).paidCents > 0 ? 'Payments are recorded on this job. Refund them before voiding.' : null; } }
    ],
    deposit_paid: [{ id: 'order', to: 'factory_ordered', label: 'Record factory order', fields: ['date'] }],
    factory_ordered: [{ id: 'deliver', to: 'delivered', label: 'Record delivery', fields: ['date'] }],
    delivered: [{ id: 'final', to: 'final_paid', label: 'Confirm final payment', fields: ['date'], guard: function (j) { var b = contractSummary(j).balanceCents; return b > 0 ? 'Balance of ' + fmt(b) + ' is still open.' : null; } }],
    final_paid: [{ id: 'close', to: 'complete', label: 'Close job', fields: ['date'] }],
    complete: [],
    lost: [{ id: 'reopen', to: 'quote', label: 'Reopen quote…', fields: ['reason'], tone: 'quiet' }]
  };

  function availableActions(job) {
    return (ACTIONS[job.stage] || []).map(function (a) {
      return { id: a.id, to: a.to, label: a.label, fields: a.fields.slice(), tone: a.tone || 'primary', blockedReason: a.guard ? a.guard(job) : null };
    });
  }

  /** Returns { ok, job, error }. Never mutates `job`. */
  function applyAction(job, actionId, input, who) {
    var def = (ACTIONS[job.stage] || []).filter(function (a) { return a.id === actionId; })[0];
    if (!def) return { ok: false, error: 'That step isn’t available from ' + stageLabel(job.stage) + '.' };
    input = input || {};
    for (var i = 0; i < def.fields.length; i++) {
      var f = def.fields[i];
      if (!input[f] || !String(input[f]).trim()) return { ok: false, error: (f === 'date' ? 'Enter a date.' : 'Enter a reason.') };
    }
    var blocked = def.guard ? def.guard(job) : null;
    if (blocked) return { ok: false, error: blocked };
    var next = clone(job);
    next.history = (next.history || []).concat([{ from: job.stage, to: def.to, date: input.date || null, reason: input.reason || null, by: who || null }]);
    next.stage = def.to;
    return { ok: true, job: next };
  }

  /** Contracted jobs can't have line items edited directly. */
  function isLocked(job) { return job.stage !== 'quote'; }

  function canEditLineItems(job) {
    if (job.stage === 'lost') return { ok: false, reason: 'This job is marked lost. Reopen the quote to edit it.' };
    if (isLocked(job)) return { ok: false, reason: 'This job is contracted. Start a change order to change line items.' };
    return { ok: true };
  }

  /* ---------- pipeline (All Projects totals) ---------- */

  function pipelineTotals(jobs, todayISO) {
    var t = { proposedCents: 0, contractedCents: 0, completedCents: 0, lostCents: 0, outstandingCents: 0, overdueCents: 0, counts: { proposed: 0, contracted: 0, completed: 0, lost: 0 } };
    jobs.forEach(function (j) {
      var s = contractSummary(j), b = stageBucket(j.stage);
      t[b + 'Cents'] += s.currentCents;
      t.counts[b] += 1;
      if (b === 'contracted' || b === 'completed') {
        t.outstandingCents += s.balanceCents;
        (j.invoices || []).forEach(function (inv) {
          if (invoiceState(inv, todayISO).key === 'overdue') t.overdueCents += inv.amountCents - invoicePaidCents(inv);
        });
      }
    });
    return t;
  }

  /** What the current tool shows: a plain sum of the legacy `total` by legacy status. */
  function legacyPipelineTotals(legacyProjects) {
    var t = { Proposed: 0, Contracted: 0, Completed: 0, Lost: 0 };
    legacyProjects.forEach(function (p) { if (t[p.status] !== undefined) t[p.status] += toCents(p.total); });
    return t;
  }

  /* ---------- legacy adapter (read-only) ---------- */

  function legacyStatusToStage(p, job) {
    if (p.status === 'Lost') return 'lost';
    if (p.status === 'Completed') return 'complete';
    if (p.status === 'Proposed') return 'quote';
    return depositPaid(job) ? 'deposit_paid' : 'contract_signed';
  }

  function invoiceRole(label, idx) {
    if (/change\s*order/i.test(label)) return 'change_order';
    return idx === 0 ? 'deposit' : 'progress';
  }

  /** Turn one legacy project record into a Phase 1 job. Does not touch the input. */
  function normalizeLegacyProject(p) {
    var job = {
      id: p.jobCode,
      jobCode: p.jobCode,
      customer: p.customer,
      projectName: p.projectName || '',
      kind: p.kind || (p.houses && p.houses.length ? 'builder_order' : 'single'),
      quoteDate: toISO(p.quoteDate),
      deliveryDate: toISO(p.deliveryDate),
      originalContractCents: toCents(p.total),
      houses: (p.houses || []).map(function (h) {
        return { jobCode: h.jobCode, name: h.name, model: h.model, color: h.color || '', lines: h.lines || 0, totalCents: toCents(h.total), address: h.address || '' };
      }),
      invoices: [],
      changeOrders: [],
      history: [],
      contacts: { signer: p.signerName || '', buyerEmail: p.buyerEmail || '' },
      source: { system: 'legacy', jobCode: p.jobCode }
    };
    var contractIdx = 0;
    job.invoices = (p.invoices || []).map(function (inv, i) {
      var role = invoiceRole(inv.label, contractIdx);
      if (role !== 'change_order') contractIdx++;
      var amt = toCents(inv.amount);
      var paid = inv.status === 'Paid';
      return {
        id: p.jobCode + '-inv' + (i + 1),
        label: inv.label,
        role: role,
        changeOrderId: null,
        dueDate: toISO(inv.due),
        amountCents: amt,
        status: 'open',
        payments: paid ? [{ amountCents: amt, date: toISO(inv.paidDate), method: inv.check ? 'check' : 'unknown', reference: inv.check || '' }] : []
      };
    });
    job.stage = legacyStatusToStage(p, job);
    return job;
  }

  /** Data gaps worth showing on the job header. */
  function jobWarnings(job) {
    var w = [];
    var noAddr = job.houses.filter(function (h) { return !h.address; }).length;
    if (job.houses.length && noAddr) w.push({ key: 'address', text: 'No install address on ' + noAddr + ' of ' + job.houses.length + ' houses.' });
    var email = job.contacts && job.contacts.buyerEmail;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) w.push({ key: 'email', text: 'Buyer email is missing or not an email address' + (email ? ' ("' + email + '")' : '') + '.' });
    job.invoices.forEach(function (inv) {
      inv.payments.forEach(function (p) { if (!p.reference) w.push({ key: 'ref-' + inv.id, text: inv.label + ' was paid with no check # or reference.' }); });
    });
    var s = contractSummary(job);
    if (!s.invoicesMatchContract) {
      w.push({ key: 'billing', text: s.unbilledCents < 0
        ? 'Invoices total ' + fmt(-s.unbilledCents) + ' more than the contract.'
        : fmt(s.unbilledCents) + ' of the contract isn’t on any invoice yet.' });
    }
    return w;
  }

  /** Find change orders that were saved as their own project.
   *  Returns proposals only; nothing is changed. */
  function detectLegacyChangeOrders(legacyProjects) {
    var parents = legacyProjects.filter(function (p) { return p.status !== 'Lost' && !/change\s*order/i.test(p.customer + ' ' + (p.projectName || '')); });
    return legacyProjects.filter(function (p) {
      return p.kind === 'change_order' || /change\s*order/i.test(p.customer + ' ' + (p.projectName || ''));
    }).map(function (co) {
      var amount = toCents(co.total), reasons = [], parent = null, confidence = 'none', logEntry = null;
      if (co.parentJobCode) {
        parent = parents.filter(function (p) { return p.jobCode === co.parentJobCode; })[0] || null;
        if (parent) { confidence = 'high'; reasons.push('Linked to ' + parent.jobCode + ' in the record.'); }
      }
      if (!parent) {
        var head = co.customer.replace(/change\s*order.*$/i, '').trim().toLowerCase();
        var named = parents.filter(function (p) { return head && p.customer.toLowerCase().indexOf(head) === 0; });
        if (named.length === 1) { parent = named[0]; confidence = 'medium'; reasons.push('Name starts with "' + parent.customer.slice(0, head.length) + '".'); }
      }
      if (parent) {
        logEntry = (parent.changeLog || []).filter(function (e) { return toCents(e.amount) === amount; })[0] || null;
        var coInv = (parent.invoices || []).filter(function (i) { return /change\s*order/i.test(i.label) && toCents(i.amount) === amount; })[0];
        if (logEntry) { confidence = 'high'; reasons.push('Amount matches "' + logEntry.what + '" on ' + parent.jobCode + '.'); }
        if (coInv) reasons.push('A ' + fmt(amount) + ' change order invoice already exists on ' + parent.jobCode + '.');
      }
      var legacyDate = toISO(co.quoteDate), docDate = logEntry ? toISO(logEntry.date) : null;
      return {
        legacyJobCode: co.jobCode,
        legacyName: co.customer,
        parentJobCode: parent ? parent.jobCode : null,
        amountCents: amount,
        confidence: confidence,
        reasons: reasons,
        dateConflict: legacyDate && docDate && legacyDate !== docDate ? { listed: legacyDate, document: docDate } : null,
        suggested: parent ? {
          number: 1 + (parent.changeLog || []).filter(function (e) { return toCents(e.amount) !== amount && /change order/i.test(e.what); }).length,
          date: docDate || legacyDate,
          reason: logEntry && logEntry.reason ? logEntry.reason : '',
          status: (parent.invoices || []).some(function (i) { return /change\s*order/i.test(i.label) && toCents(i.amount) === amount; }) ? 'invoiced' : 'signed'
        } : null
      };
    });
  }

  /** Attach a detected change order to its parent job. Returns new jobs; inputs untouched.
   *  The legacy CO record is hidden from Phase 1 views, never deleted. */
  function attachChangeOrder(jobs, proposal, overrides) {
    if (!proposal.parentJobCode) return { ok: false, error: 'No parent job found. Pick one by hand.' };
    var o = overrides || {};
    var out = jobs.map(function (j) {
      if (j.jobCode !== proposal.parentJobCode) return j;
      var next = clone(j);
      var co = {
        id: next.jobCode + '-co' + ((o.number || proposal.suggested.number)),
        number: o.number || proposal.suggested.number,
        date: o.date || proposal.suggested.date,
        reason: o.reason !== undefined ? o.reason : proposal.suggested.reason,
        amountCents: proposal.amountCents,
        status: o.status || proposal.suggested.status,
        lines: o.lines || [],
        source: { system: 'legacy', jobCode: proposal.legacyJobCode }
      };
      next.changeOrders = next.changeOrders.concat([co]);
      next.invoices = next.invoices.map(function (inv) {
        return inv.role === 'change_order' && !inv.changeOrderId && inv.amountCents === co.amountCents ? merge(inv, { changeOrderId: co.id }) : inv;
      });
      return next;
    }).filter(function (j) { return j.jobCode !== proposal.legacyJobCode; });
    return { ok: true, jobs: out };
  }

  /** Build Phase 1 jobs from legacy records. Detected change orders stay as
   *  separate records until `attachChangeOrder` is called for each. */
  function jobsFromLegacy(legacyProjects) {
    return legacyProjects.map(normalizeLegacyProject);
  }

  /* ---------- helpers ---------- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  return {
    VERSION: VERSION,
    toCents: toCents, fmt: fmt, pct: pct, toISO: toISO, daysBetween: daysBetween,
    CO_STATUSES: CO_STATUSES, coCountsTowardContract: coCountsTowardContract,
    invoicePaidCents: invoicePaidCents, invoiceState: invoiceState, invoicePercent: invoicePercent,
    contractSummary: contractSummary,
    modelTotals: modelTotals, compareModelTotals: compareModelTotals,
    STAGES: STAGES, stageLabel: stageLabel, stageBucket: stageBucket,
    availableActions: availableActions, applyAction: applyAction, isLocked: isLocked, canEditLineItems: canEditLineItems,
    pipelineTotals: pipelineTotals, legacyPipelineTotals: legacyPipelineTotals,
    normalizeLegacyProject: normalizeLegacyProject, jobsFromLegacy: jobsFromLegacy, jobWarnings: jobWarnings,
    detectLegacyChangeOrders: detectLegacyChangeOrders, attachChangeOrder: attachChangeOrder
  };
}));
