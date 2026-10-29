/*
 * Fremont Makers · Project Builder · Phase 2 · Company Books
 * Version 0.1.0-phase2. Pure functions over jobs; no DOM, storage or network. Money is integer cents.
 * UMD: require() in Node, window.FMBooks in a browser. Designed fresh (owner, Oct 28): the current
 * tool's books pages aren't copied. See HANDOFF.md §22.
 *
 *   dashboard(jobs, today)            the numbers and to-dos that matter this week
 *   pipeline(jobs, today)             jobs by stage, with value and win rate
 *   pipelineGroups(jobs, today)       the Pipeline page: quotes out, in production, finishing up, complete, lost
 *   depositsDue(jobs, today)          every unpaid invoice, by when it's due; flags factory orders waiting on a deposit
 *   reconcile(jobs)                   per-job checks: invoices = contract, payments recorded properly, costs on file
 *   profitAndLoss(jobs, from, to)     job gross profit for jobs contracted in the period, plus cash collected
 *   balanceSheet(jobs, today)         what customers owe, what we hold for them, sales tax collected
 *
 * Book job shape (built by the Phase 2 store from real jobs):
 *   { jobCode, customer, project, stage, contractedOn, deliveryDate, quoteDate,
 *     contractCents, taxCents, costCents (supplier cost, null if unknown), absorbedCents (courtesy change orders),
 *     invoices: [{ id, label, role, amountCents, dueDate, status, payments: [{ amountCents, date, method, reference }] }] }
 * Stages: quote, contract_signed, deposit_paid, factory_ordered, delivered, final_paid, complete, lost.
 *
 * What these books are not: the company's full accounting. Overhead, payroll and bank balances live in the
 * accounting system; these pages cover what the Project Builder knows (jobs, invoices, payments, job costs).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMBooks = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.1.0-phase2';
  var STAGE_ORDER = ['quote', 'contract_signed', 'deposit_paid', 'factory_ordered', 'delivered', 'final_paid', 'complete'];
  var STAGE_LABEL = { quote: 'Quote', contract_signed: 'Contract signed', deposit_paid: 'Deposit paid', factory_ordered: 'Factory ordered',
    delivered: 'Delivered', final_paid: 'Final payment', complete: 'Complete', lost: 'Lost' };

  function sum(a) { return a.reduce(function (t, x) { return t + x; }, 0); }
  function day(iso) { var p = String(iso).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; }
  function days(from, to) { return day(to) - day(from); }
  function paid(inv) { return sum((inv.payments || []).map(function (p) { return p.amountCents; })); }
  function open(inv) { return inv.status === 'void' ? 0 : Math.max(0, inv.amountCents - paid(inv)); }
  function live(job) { return (job.invoices || []).filter(function (i) { return i.status !== 'void'; }); }
  function isContracted(job) { return job.stage !== 'quote' && job.stage !== 'lost'; }
  function stageIdx(s) { return STAGE_ORDER.indexOf(s); }
  function pct(n, d) { return d ? Math.round(n / d * 1000) / 10 : 0; }
  function taxShare(job, cents) { return job.contractCents ? Math.round(cents * job.taxCents / job.contractCents) : 0; }
  function inRange(iso, from, to) { return !!iso && iso >= from && iso <= to; }

  /* ---------- pipeline ---------- */
  function pipeline(jobs, today) {
    var cols = STAGE_ORDER.concat(['lost']).map(function (s) {
      var js = jobs.filter(function (j) { return j.stage === s; });
      return { stage: s, label: STAGE_LABEL[s], count: js.length,
        cents: sum(js.map(function (j) { return j.contractCents; })),
        jobs: js.map(function (j) { return { jobCode: j.jobCode, customer: j.customer, project: j.project, cents: j.contractCents,
          balanceCents: sum(live(j).map(open)), deliveryDate: j.deliveryDate || null }; }) };
    });
    // Win rate over the last 180 days of decided quotes (contracted or lost).
    var decided = jobs.filter(function (j) { var d = j.contractedOn || j.quoteDate; return d && days(d, today) <= 180 && (isContracted(j) || j.stage === 'lost'); });
    var won = decided.filter(isContracted);
    var openWork = cols.filter(function (c) { return stageIdx(c.stage) >= 1 && stageIdx(c.stage) <= 4; });
    return {
      columns: cols,
      quotedCents: cols[0].cents,
      inProgressCents: sum(openWork.map(function (c) { return c.cents; })),
      winRatePct: pct(won.length, decided.length), decidedCount: decided.length
    };
  }

  /*
   * Pipeline grouped the way the shop works (owner, Oct 28: the stage-column board was hard to read):
   *   Quotes out → In production (signed, deposit, factory order) → Finishing up (delivered, final payment)
   *   → Complete, and Lost. Each row has value, collected %, what's still owed, and age.
   * Quotes older than `staleDays` (default 30) are flagged so they get a follow-up.
   */
  var GROUPS = [
    { key: 'quotes', label: 'Quotes out', stages: ['quote'] },
    { key: 'production', label: 'In production', stages: ['contract_signed', 'deposit_paid', 'factory_ordered'] },
    { key: 'finishing', label: 'Delivered, finishing up', stages: ['delivered', 'final_paid'] },
    { key: 'complete', label: 'Complete', stages: ['complete'] },
    { key: 'lost', label: 'Lost', stages: ['lost'] }
  ];
  function pipelineGroups(jobs, today, opts) {
    var stale = (opts && opts.staleDays) || 30;
    var groups = GROUPS.map(function (g) {
      var rows = jobs.filter(function (j) { return g.stages.indexOf(j.stage) >= 0; }).map(function (j) {
        var got = sum(live(j).map(paid)), owed = sum(live(j).map(open));
        var since = g.key === 'quotes' || g.key === 'lost' ? j.quoteDate : (j.contractedOn || j.quoteDate);
        var age = since ? days(since, today) : null;
        return { jobCode: j.jobCode, customer: j.customer, project: j.project, stage: j.stage, stageLabel: STAGE_LABEL[j.stage],
          stageStep: stageIdx(j.stage), cents: j.contractCents, paidCents: got, owedCents: g.key === 'quotes' || g.key === 'lost' ? 0 : owed,
          collectedPct: g.key === 'quotes' || g.key === 'lost' ? null : pct(got, j.contractCents), ageDays: age, since: since || null,
          deliveryDate: j.deliveryDate || null, staleQuote: g.key === 'quotes' && age !== null && age > stale };
      });
      rows.sort(function (a, b) {
        if (g.key === 'quotes') return (b.ageDays || 0) - (a.ageDays || 0);                    // oldest quote first: follow up
        if (g.key === 'production' || g.key === 'finishing') return (a.deliveryDate || '9') < (b.deliveryDate || '9') ? -1 : 1;  // soonest delivery first
        return (b.since || '') < (a.since || '') ? -1 : 1;                                   // newest first
      });
      return { key: g.key, label: g.label, count: rows.length, cents: sum(rows.map(function (r) { return r.cents; })),
               owedCents: sum(rows.map(function (r) { return r.owedCents; })), rows: rows };
    });
    var p = pipeline(jobs, today);
    return { groups: groups, winRatePct: p.winRatePct, decidedCount: p.decidedCount,
             staleQuotes: groups[0].rows.filter(function (r) { return r.staleQuote; }).length };
  }

  /* ---------- deposits & invoices due ---------- */
  function depositsDue(jobs, today) {
    var items = [];
    jobs.filter(function (j) { return j.stage !== 'lost'; }).forEach(function (j) {
      live(j).forEach(function (inv) {
        var owed = open(inv); if (!owed) return;
        var d = inv.dueDate ? days(today, inv.dueDate) : null;
        items.push({ jobCode: j.jobCode, customer: j.customer, project: j.project, invoiceId: inv.id, label: inv.label, role: inv.role,
          dueDate: inv.dueDate || null, daysUntil: d, outstandingCents: owed, partial: paid(inv) > 0,
          holdsFactoryOrder: inv.role === 'deposit' && stageIdx(j.stage) < stageIdx('factory_ordered') });
      });
    });
    items.sort(function (a, b) { return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : 0; });
    function bucket(name, test) { var xs = items.filter(test); return { name: name, items: xs, cents: sum(xs.map(function (x) { return x.outstandingCents; })) }; }
    var groups = [
      bucket('Overdue', function (x) { return x.daysUntil !== null && x.daysUntil < 0; }),
      bucket('Due in the next 7 days', function (x) { return x.daysUntil !== null && x.daysUntil >= 0 && x.daysUntil <= 7; }),
      bucket('Due in 8–30 days', function (x) { return x.daysUntil !== null && x.daysUntil > 7 && x.daysUntil <= 30; }),
      bucket('Later', function (x) { return x.daysUntil !== null && x.daysUntil > 30; }),
      bucket('No due date', function (x) { return x.daysUntil === null; })
    ];
    return { groups: groups, totalCents: sum(items.map(function (x) { return x.outstandingCents; })), count: items.length,
             factoryHolds: items.filter(function (x) { return x.holdsFactoryOrder; }) };
  }

  /* ---------- reconcile ---------- */
  function longDay(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : (iso || ''); }
  function reconcile(jobs) {
    var rows = jobs.filter(isContracted).map(function (j) {
      var inv = live(j), invoiced = sum(inv.map(function (i) { return i.amountCents; })), got = sum(inv.map(paid)), issues = [];
      if (invoiced !== j.contractCents) issues.push({ kind: 'invoices', cents: j.contractCents - invoiced,
        text: 'Invoices total ' + money(invoiced) + '; the contract is ' + money(j.contractCents) + '.' });
      inv.forEach(function (i) {
        if (paid(i) > i.amountCents) issues.push({ kind: 'overpaid', cents: paid(i) - i.amountCents, text: i.label + ' was overpaid by ' + money(paid(i) - i.amountCents) + '.' });
        (i.payments || []).forEach(function (p) {
          if ((p.method === 'check' || p.method === 'unknown') && !p.reference) issues.push({ kind: 'reference', cents: p.amountCents, text: i.label + ': payment of ' + money(p.amountCents) + ' on ' + longDay(p.date) + ' has no check number.' });
        });
      });
      if (j.costCents == null) issues.push({ kind: 'cost', cents: 0, text: 'No supplier cost on file, so profit can\'t be checked.' });
      if (stageIdx(j.stage) >= stageIdx('final_paid') && got < j.contractCents) issues.push({ kind: 'balance', cents: j.contractCents - got, text: 'Marked ' + STAGE_LABEL[j.stage] + ' with ' + money(j.contractCents - got) + ' still unpaid.' });
      return { jobCode: j.jobCode, customer: j.customer, project: j.project, contractCents: j.contractCents, invoicedCents: invoiced, paidCents: got, issues: issues, clean: !issues.length };
    });
    return { rows: rows, issueCount: sum(rows.map(function (r) { return r.issues.length; })), cleanCount: rows.filter(function (r) { return r.clean; }).length };
  }

  /* ---------- P&L (job gross profit) ---------- */
  function profitAndLoss(jobs, from, to) {
    var booked = jobs.filter(function (j) { return isContracted(j) && inRange(j.contractedOn, from, to); }).map(function (j) {
      var revenue = j.contractCents - j.taxCents, cost = j.costCents || 0, absorbed = j.absorbedCents || 0, gp = revenue - cost - absorbed;
      return { jobCode: j.jobCode, customer: j.customer, project: j.project, contractCents: j.contractCents, taxCents: j.taxCents,
               revenueCents: revenue, costCents: cost, costKnown: j.costCents != null, absorbedCents: absorbed, grossProfitCents: gp, marginPct: pct(gp, revenue) };
    });
    var t = { contractCents: 0, taxCents: 0, revenueCents: 0, costCents: 0, absorbedCents: 0, grossProfitCents: 0 };
    booked.forEach(function (r) { Object.keys(t).forEach(function (k) { t[k] += r[k]; }); });
    t.marginPct = pct(t.grossProfitCents, t.revenueCents);
    var cash = [];
    jobs.forEach(function (j) { live(j).forEach(function (i) { (i.payments || []).forEach(function (p) {
      if (inRange(p.date, from, to)) cash.push({ jobCode: j.jobCode, customer: j.customer, label: i.label, date: p.date, cents: p.amountCents, taxCents: taxShare(j, p.amountCents) });
    }); }); });
    var collected = sum(cash.map(function (c) { return c.cents; })), collectedTax = sum(cash.map(function (c) { return c.taxCents; }));
    return { from: from, to: to, jobs: booked, totals: t, missingCost: booked.filter(function (r) { return !r.costKnown; }).length,
             cash: { payments: cash, collectedCents: collected, salesTaxCents: collectedTax, netOfTaxCents: collected - collectedTax } };
  }

  /* ---------- balance sheet (job balances) ---------- */
  function balanceSheet(jobs, today) {
    var receivable = 0, overdue = 0, deposits = 0, taxCollected = 0, backlog = 0;
    jobs.filter(isContracted).forEach(function (j) {
      var inv = live(j), got = sum(inv.map(paid)), invoiced = sum(inv.map(function (i) { return i.amountCents; }));
      inv.forEach(function (i) { var o = open(i); receivable += o; if (o && i.dueDate && i.dueDate < today) overdue += o; });
      if (stageIdx(j.stage) < stageIdx('delivered')) deposits += got;      // cash held for work not yet delivered
      taxCollected += taxShare(j, got);
      backlog += Math.max(0, j.contractCents - invoiced);
    });
    return {
      assets: [{ key: 'receivable', label: 'Customer invoices not yet paid', cents: receivable, note: money(overdue) + ' of it overdue' }],
      liabilities: [
        { key: 'deposits', label: 'Customer deposits for work not yet delivered', cents: deposits, note: 'Earned when the job is delivered' },
        { key: 'salesTax', label: 'Sales tax collected (owed to the state)', cents: taxCollected, note: 'Tax share of payments received; check against filings' }
      ],
      memo: [{ key: 'backlog', label: 'Signed work not yet invoiced', cents: backlog }],
      overdueCents: overdue
    };
  }

  /* ---------- dashboard ---------- */
  function dashboard(jobs, today) {
    var yearStart = today.slice(0, 4) + '-01-01';
    var monthAgo = isoMinus(today, 30);
    var pl = profitAndLoss(jobs, yearStart, today), cash30 = profitAndLoss(jobs, monthAgo, today).cash;
    var due = depositsDue(jobs, today), bs = balanceSheet(jobs, today), pipe = pipeline(jobs, today), rec = reconcile(jobs);
    var next14 = sum(due.groups[1].items.concat(due.groups[2].items).filter(function (x) { return x.daysUntil <= 14; }).map(function (x) { return x.outstandingCents; }));
    var attention = [];
    /* Each item is a task: a status label, a short title, what it's about, the amount, and one action that goes where it's fixed.
       `text` keeps the one-line sentence for anything that still reads it. */
    var ACT = {
      overdue:   { status: 'Overdue', title: 'Invoice overdue', action: 'Record payment', tab: 'invoices' },
      deposit:   { status: 'Waiting', title: 'Deposit needed before the factory order', action: 'Collect deposit', tab: 'invoices' },
      invoices:  { status: 'Check', title: 'Invoices don\'t match the contract', action: 'Review invoices', tab: 'invoices' },
      overpaid:  { status: 'Check', title: 'Invoice overpaid', action: 'Review payments', tab: 'invoices' },
      reference: { status: 'Check', title: 'Check number missing', action: 'Add check number', tab: 'invoices' },
      balance:   { status: 'Check', title: 'Finished job still owes money', action: 'Review payments', tab: 'invoices' }
    };
    function task(kind, tone, x, detail, cents, text) {
      var a = ACT[kind]; attention.push({ kind: kind, tone: tone, jobCode: x.jobCode, customer: x.customer, project: x.project || '', status: a.status, title: a.title, detail: detail, amountCents: cents, action: a.action, tab: a.tab, text: text });
    }
    due.groups[0].items.forEach(function (x) { var late = -x.daysUntil + (x.daysUntil === -1 ? ' day' : ' days');
      task('overdue', 'alert', x, x.label + ' · ' + late + ' late', x.outstandingCents, x.customer + ': ' + x.label + ' is ' + late + ' overdue (' + money(x.outstandingCents) + ').'); });
    due.factoryHolds.forEach(function (x) { task('deposit', 'alert', x, 'The factory order can\'t be placed until the deposit is in.', x.outstandingCents, x.customer + ': factory order waits on the deposit (' + money(x.outstandingCents) + ').'); });
    rec.rows.forEach(function (r) { r.issues.forEach(function (i) { if (i.kind !== 'cost' && ACT[i.kind]) task(i.kind, 'info', r, i.text, i.cents, r.customer + ': ' + i.text); }); });
    var deliveries = jobs.filter(function (j) { return isContracted(j) && j.deliveryDate && days(today, j.deliveryDate) >= 0 && days(today, j.deliveryDate) <= 30; })
      .map(function (j) { return { jobCode: j.jobCode, customer: j.customer, project: j.project, deliveryDate: j.deliveryDate, balanceCents: sum(live(j).map(open)) }; })
      .sort(function (a, b) { return a.deliveryDate < b.deliveryDate ? -1 : 1; });
    return {
      kpis: [
        { key: 'contractedYtd', label: 'Contracted this year', cents: pl.totals.contractCents, note: pl.jobs.length + ' job' + (pl.jobs.length === 1 ? '' : 's') },
        { key: 'collected30', label: 'Collected, last 30 days', cents: cash30.collectedCents },
        { key: 'receivable', label: 'Customers owe', cents: bs.assets[0].cents, note: money(bs.overdueCents) + ' overdue' },
        { key: 'due14', label: 'Coming due in 14 days', cents: next14 },
        { key: 'quoted', label: 'Open quotes', cents: pipe.quotedCents, note: 'Win rate ' + pipe.winRatePct + '%' },
        { key: 'margin', label: 'Gross margin this year', pct: pl.totals.marginPct, note: money(pl.totals.grossProfitCents) + ' gross profit' }
      ],
      attention: attention, deliveries: deliveries
    };
  }

  function isoMinus(iso, n) { return new Date((day(iso) - n) * 864e5).toISOString().slice(0, 10); }
  function money(c) {
    var n = Math.abs(c), s = '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2);
    return c < 0 ? '−' + s : s;
  }

  return { VERSION: VERSION, STAGE_ORDER: STAGE_ORDER, STAGE_LABEL: STAGE_LABEL, money: money,
           dashboard: dashboard, pipeline: pipeline, pipelineGroups: pipelineGroups, depositsDue: depositsDue, reconcile: reconcile,
           profitAndLoss: profitAndLoss, balanceSheet: balanceSheet };
}));
