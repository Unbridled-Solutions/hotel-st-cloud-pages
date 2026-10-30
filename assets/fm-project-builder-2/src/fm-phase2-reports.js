/*
 * Fremont Makers Project Builder · Phase 2 · Reports and exports for finance (HANDOFF §25).  window.FMReports
 *
 * Each report is a table: { key, title, about, columns: [{ key, label, money? }], rows: [ {...} ], totals: {...} }.
 * toCSV() turns one into a CSV file that Excel, Numbers, Google Sheets and QuickBooks open. Money columns are dollars
 * with two decimals and no "$" or commas, so spreadsheets read them as numbers. Pure: no DOM, no storage.
 *
 * Input: the full jobs (as FMStore holds them). Uses FMPhase1.contractSummary for contract totals so every number
 * matches the screens.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fm-phase1-ledger.js'));
  else root.FMReports = factory(root.FMPhase1);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';
  var VERSION = '0.1.0';
  var STAGE = { quote: 'Quote', lost: 'Lost', contract_signed: 'Contract signed', deposit_paid: 'Deposit paid', factory_ordered: 'Factory order placed',
    delivered: 'Delivered', final_paid: 'Final payment', complete: 'Complete' };
  var METHOD = { check: 'Check', ach: 'ACH / bank transfer', card: 'Card', cash: 'Cash', unknown: 'Not recorded' };

  function sum(a) { return a.reduce(function (t, x) { return t + (x || 0); }, 0); }
  function paidOf(inv) { return sum((inv.payments || []).map(function (p) { return p.amountCents; })); }
  function live(j) { return (j.invoices || []).filter(function (i) { return i.status !== 'void'; }); }
  function inRange(d, from, to) { return !!d && (!from || d >= from) && (!to || d <= to); }
  function contracted(j) { return j.stage !== 'quote' && j.stage !== 'lost'; }
  /* the share of a payment that is sales tax: the job's tax over its contract total (tax is collected as the job is paid) */
  function taxPart(j, cents, contractCents) { return contractCents ? Math.round(cents * (j.taxCents || 0) / contractCents) : 0; }
  function realJobs(jobs) { return (jobs || []).filter(function (j) { return !j.parentJobCode && !/change order/i.test(j.customer || ''); }); }

  function table(key, title, about, columns, rows, totalKeys) {
    var totals = {};
    (totalKeys || columns.filter(function (c) { return c.money; }).map(function (c) { return c.key; })).forEach(function (k) { totals[k] = sum(rows.map(function (r) { return r[k]; })); });
    return { key: key, title: title, about: about, columns: columns, rows: rows, totals: totals };
  }

  /* 1. Jobs: one row per job, contract to cash. */
  function jobs(all, opts) {
    opts = opts || {};
    var rows = realJobs(all).filter(function (j) { return opts.includeQuotes || contracted(j); }).map(function (j) {
      var s = FM.contractSummary(j), cost = j.costCents == null ? null : j.costCents, absorbed = j.absorbedCents || 0, rev = s.currentCents - (j.taxCents || 0);
      return { jobCode: j.jobCode, customer: j.customer, project: j.projectName || '', stage: STAGE[j.stage] || j.stage, quoteDate: j.quoteDate || '', contractedOn: j.contractedOn || '',
        deliveryDate: j.deliveryDate || '', originalCents: s.originalCents, changeOrderCents: s.changeOrderCents, contractCents: s.currentCents, taxCents: j.taxCents || 0,
        revenueCents: rev, invoicedCents: s.invoicedCents, paidCents: s.paidCents, balanceCents: s.balanceCents, costCents: cost, absorbedCents: absorbed,
        grossProfitCents: cost == null ? null : rev - cost - absorbed, marginPct: cost == null || !rev ? '' : Math.round((rev - cost - absorbed) / rev * 1000) / 10 };
    });
    return table('jobs', 'Jobs', 'One row per job: contract, change orders, sales tax, invoiced, paid, balance, cost and gross profit.', [
      { key: 'jobCode', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'project', label: 'Project' }, { key: 'stage', label: 'Stage' },
      { key: 'quoteDate', label: 'Quote date' }, { key: 'contractedOn', label: 'Contracted on' }, { key: 'deliveryDate', label: 'Delivery (estimate)' },
      { key: 'originalCents', label: 'Original contract', money: true }, { key: 'changeOrderCents', label: 'Change orders', money: true }, { key: 'contractCents', label: 'Current contract', money: true },
      { key: 'taxCents', label: 'Sales tax', money: true }, { key: 'revenueCents', label: 'Revenue before tax', money: true }, { key: 'invoicedCents', label: 'Invoiced', money: true },
      { key: 'paidCents', label: 'Paid', money: true }, { key: 'balanceCents', label: 'Balance', money: true }, { key: 'costCents', label: 'Cabinet cost', money: true },
      { key: 'absorbedCents', label: 'Courtesy absorbed', money: true }, { key: 'grossProfitCents', label: 'Gross profit', money: true }, { key: 'marginPct', label: 'Margin %' }], rows);
  }

  /* 2. Invoices: one row per invoice (accounts receivable). */
  function invoices(all, opts) {
    opts = opts || {}; var today = opts.today || '';
    var rows = [];
    realJobs(all).filter(contracted).forEach(function (j) {
      (j.invoices || []).forEach(function (i) {
        var paid = paidOf(i), open = i.status === 'void' ? 0 : Math.max(0, i.amountCents - paid);
        rows.push({ jobCode: j.jobCode, customer: j.customer, invoice: i.id, label: i.label, kind: i.role === 'change_order' ? 'Change order' : i.role === 'deposit' ? 'Deposit' : 'Progress / final',
          dueDate: i.dueDate || '', amountCents: i.status === 'void' ? 0 : i.amountCents, paidCents: paid, openCents: open,
          status: i.status === 'void' ? 'Void' : open === 0 ? 'Paid' : today && i.dueDate && i.dueDate < today ? 'Overdue' : 'Open',
          daysOverdue: open && today && i.dueDate && i.dueDate < today ? Math.round((Date.parse(today) - Date.parse(i.dueDate)) / 864e5) : '' });
      });
    });
    return table('invoices', 'Invoices', 'One row per invoice: amount, paid, still open, and how many days overdue.', [
      { key: 'jobCode', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'invoice', label: 'Invoice' }, { key: 'label', label: 'Description' }, { key: 'kind', label: 'Kind' },
      { key: 'dueDate', label: 'Due' }, { key: 'amountCents', label: 'Amount', money: true }, { key: 'paidCents', label: 'Paid', money: true }, { key: 'openCents', label: 'Open', money: true },
      { key: 'status', label: 'Status' }, { key: 'daysOverdue', label: 'Days overdue' }], rows);
  }

  /* 3. Payments received in the period: one row per payment, split into sales tax and the rest. */
  function payments(all, opts) {
    opts = opts || {}; var rows = [];
    realJobs(all).forEach(function (j) {
      var contract = FM.contractSummary(j).currentCents;
      live(j).forEach(function (i) {
        (i.payments || []).forEach(function (p) {
          if (!inRange(p.date, opts.from, opts.to)) return;
          var tax = taxPart(j, p.amountCents, contract);
          rows.push({ date: p.date, jobCode: j.jobCode, customer: j.customer, invoice: i.id, label: i.label, method: METHOD[p.method] || p.method || '', reference: p.reference || '',
            amountCents: p.amountCents, taxCents: tax, netCents: p.amountCents - tax });
        });
      });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.jobCode < b.jobCode ? -1 : 1; });
    return table('payments', 'Payments received', 'Every payment in the period, with the sales tax share of it (the job\'s tax over its contract total).', [
      { key: 'date', label: 'Date' }, { key: 'jobCode', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'invoice', label: 'Invoice' }, { key: 'label', label: 'Description' },
      { key: 'method', label: 'Method' }, { key: 'reference', label: 'Check # / reference' }, { key: 'amountCents', label: 'Amount', money: true },
      { key: 'taxCents', label: 'Sales tax in it', money: true }, { key: 'netCents', label: 'Before tax', money: true }], rows);
  }

  /* 4. Sales tax: by job, for the period. Two views side by side: billed (contracts signed in the period) and collected (payments in the period). */
  function salesTax(all, opts) {
    opts = opts || {}; var rows = [];
    realJobs(all).filter(contracted).forEach(function (j) {
      var s = FM.contractSummary(j), signed = inRange(j.contractedOn, opts.from, opts.to);
      var got = sum(live(j).map(function (i) { return sum((i.payments || []).filter(function (p) { return inRange(p.date, opts.from, opts.to); }).map(function (p) { return p.amountCents; })); }));
      if (!signed && !got) return;
      rows.push({ jobCode: j.jobCode, customer: j.customer, project: j.projectName || '', contractedOn: j.contractedOn || '', taxRatePct: j.pricing && j.pricing.taxPct != null ? j.pricing.taxPct : '',
        contractCents: s.currentCents, taxCents: j.taxCents || 0, billedTaxCents: signed ? (j.taxCents || 0) : 0, collectedCents: got, collectedTaxCents: taxPart(j, got, s.currentCents) });
    });
    return table('salestax', 'Sales tax', 'By job: tax on contracts signed in the period, and tax inside payments received in the period. Your accountant decides which basis you file on.', [
      { key: 'jobCode', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'project', label: 'Project' }, { key: 'contractedOn', label: 'Contracted on' }, { key: 'taxRatePct', label: 'Tax rate %' },
      { key: 'contractCents', label: 'Current contract', money: true }, { key: 'taxCents', label: 'Tax on the job', money: true }, { key: 'billedTaxCents', label: 'Tax billed (signed in period)', money: true },
      { key: 'collectedCents', label: 'Payments in period', money: true }, { key: 'collectedTaxCents', label: 'Tax collected in period', money: true }], rows,
      ['contractCents', 'taxCents', 'billedTaxCents', 'collectedCents', 'collectedTaxCents']);
  }

  /* 5. Change orders, including courtesy ones (what the shop absorbed). */
  function changeOrders(all, opts) {
    opts = opts || {}; var rows = [];
    realJobs(all).forEach(function (j) {
      (j.changeOrders || []).forEach(function (co) {
        if (opts.from && !inRange(co.date, opts.from, opts.to)) return;
        rows.push({ jobCode: j.jobCode, customer: j.customer, number: co.number || '', date: co.date || '', kind: co.kind === 'courtesy' ? 'Courtesy' : co.kind === 'custom' ? 'Agreed amount' : 'Charged',
          status: co.status || '', reason: co.reason || '', removed: (co.removed || []).map(function (r) { return r.sku + ' x' + r.qty; }).join('; '), added: (co.added || []).map(function (a) { return a.sku + ' x' + a.qty; }).join('; '),
          amountCents: co.amountCents || 0, absorbedCents: co.absorbedCents || 0, absorbedFinal: co.kind === 'courtesy' ? (co.absorbedIsEstimate ? 'Estimate' : 'Final') : '' });
      });
    });
    return table('changeorders', 'Change orders', 'Every change order: what changed, what it charged, and for courtesy ones what the shop absorbed.', [
      { key: 'jobCode', label: 'Job' }, { key: 'customer', label: 'Customer' }, { key: 'number', label: 'CO #' }, { key: 'date', label: 'Date' }, { key: 'kind', label: 'Kind' }, { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Reason' }, { key: 'removed', label: 'Removed' }, { key: 'added', label: 'Added' }, { key: 'amountCents', label: 'Charged to customer', money: true },
      { key: 'absorbedCents', label: 'Absorbed by the shop', money: true }, { key: 'absorbedFinal', label: 'Absorbed is' }], rows);
  }

  var LIST = [
    { key: 'jobs', fn: jobs, usesPeriod: false }, { key: 'invoices', fn: invoices, usesPeriod: false }, { key: 'payments', fn: payments, usesPeriod: true },
    { key: 'salestax', fn: salesTax, usesPeriod: true }, { key: 'changeorders', fn: changeOrders, usesPeriod: true }
  ];
  function all(jobsIn, opts) { return LIST.map(function (r) { var t = r.fn(jobsIn, opts); t.usesPeriod = r.usesPeriod; return t; }); }

  /* ---------- CSV ---------- */
  function cell(v, money) {
    if (v == null || v === '') return '';
    if (money) return (v < 0 ? '-' : '') + (Math.abs(v) / 100).toFixed(2);
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // keep spreadsheets from running a cell as a formula
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(t, opts) {
    opts = opts || {};
    var lines = [t.columns.map(function (c) { return cell(c.label); }).join(',')];
    t.rows.forEach(function (r) { lines.push(t.columns.map(function (c) { return cell(r[c.key], c.money); }).join(',')); });
    if (opts.totals !== false && t.rows.length && Object.keys(t.totals).length) {
      lines.push(t.columns.map(function (c, i) { return i === 0 ? 'Total' : c.key in t.totals ? cell(t.totals[c.key], true) : ''; }).join(','));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';   // BOM so Excel reads accents (Cañon City) correctly
  }
  function fileName(t, opts) {
    opts = opts || {};
    return 'fremont-makers-' + t.key + (t.usesPeriod && opts.from ? '-' + opts.from + '-to-' + opts.to : '') + (opts.today && !t.usesPeriod ? '-' + opts.today : '') + '.csv';
  }

  /* periods for the picker, from today's date */
  function periods(today) {
    var y = +today.slice(0, 4), m = +today.slice(5, 7);
    function d(yy, mm, dd) { return yy + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2); }
    function last(yy, mm) { return new Date(Date.UTC(yy, mm, 0)).getUTCDate(); }
    var pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y, q = Math.floor((m - 1) / 3), pq = q === 0 ? 3 : q - 1, pqy = q === 0 ? y - 1 : y;
    return [
      { key: 'month', label: 'This month', from: d(y, m, 1), to: d(y, m, last(y, m)) },
      { key: 'lastmonth', label: 'Last month', from: d(py, pm, 1), to: d(py, pm, last(py, pm)) },
      { key: 'quarter', label: 'This quarter', from: d(y, q * 3 + 1, 1), to: d(y, q * 3 + 3, last(y, q * 3 + 3)) },
      { key: 'lastquarter', label: 'Last quarter', from: d(pqy, pq * 3 + 1, 1), to: d(pqy, pq * 3 + 3, last(pqy, pq * 3 + 3)) },
      { key: 'ytd', label: 'Year to date', from: d(y, 1, 1), to: today },
      { key: 'lastyear', label: 'Last year', from: d(y - 1, 1, 1), to: d(y - 1, 12, 31) }
    ];
  }

  /* Jobs marked Test / Void never go into a report or export (HANDOFF §29). */
  function counted(fn) { return function (jobsIn) { var a = [].slice.call(arguments); a[0] = (jobsIn || []).filter(function (j) { return !j.testVoid; }); return fn.apply(null, a); }; }
  return { VERSION: VERSION, jobs: counted(jobs), invoices: counted(invoices), payments: counted(payments), salesTax: counted(salesTax), changeOrders: counted(changeOrders), all: counted(all), toCSV: toCSV, fileName: fileName, periods: periods };
}));
