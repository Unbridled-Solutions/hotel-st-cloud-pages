/*
 * Project Builder 2.0 — read-only adapter from live KV ns=fm-quotes.
 * Never writes. Maps real quote records into the Phase 1 legacy shape
 * that fm-phase1-ledger.js already understands.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FMPhase1Adapter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function quoteOf(bundle, id) {
    if (!id || !bundle) return null;
    return bundle['fm-quote-' + id] || null;
  }

  function statusLabel(s) {
    s = String(s || 'proposed').toLowerCase();
    if (s === 'contract' || s === 'contracted') return 'Contracted';
    if (s === 'lost') return 'Lost';
    if (s === 'completed' || s === 'complete') return 'Completed';
    return 'Proposed';
  }

  function money(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isoDay(v) {
    if (!v) return '';
    var s = String(v);
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    var t = Date.parse(s);
    if (!Number.isFinite(t)) return '';
    var d = new Date(t);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + da;
  }

  function indexTotal(index, id) {
    if (!Array.isArray(index)) return 0;
    for (var i = 0; i < index.length; i++) {
      if (index[i] && index[i].id === id) return money(index[i].total);
    }
    return 0;
  }

  function cabinetsToLines(cabs) {
    return (cabs || []).map(function (c) {
      return {
        sku: c.serial || c.sku || '',
        desc: c.desc || c.description || '',
        qty: Number(c.qty) || 0,
        unitCost: money(c.cost),
        markupPct: money(c.markup)
      };
    });
  }

  function laborAssembly(labor) {
    var list = labor || [];
    var row = null;
    for (var i = 0; i < list.length; i++) {
      if (/assembly/i.test(list[i].name || '')) { row = list[i]; break; }
    }
    if (!row) row = list[0];
    if (!row) return { rate: 0, hours: 0 };
    return { rate: money(row.rate), hours: money(row.hours) };
  }

  function colorFrom(q, lines) {
    if (q && q.colorName) return q.colorName;
    var d = (lines && lines[0] && lines[0].desc) || '';
    var m = d.match(/^(.*Shaker)/i);
    return m ? m[1].replace(/\s+$/, '') : '';
  }

  function houseFromChild(ch, index) {
    if (!ch) return null;
    var cabs = ch.cabinets || [];
    var lines = cabinetsToLines(cabs);
    return {
      jobCode: ch.jobCode || '',
      name: ch.project || ch.modelName || ch.jobCode || '',
      model: ch.modelName || ch.project || '',
      color: colorFrom(ch, lines),
      lines: lines.length,
      total: indexTotal(index, ch.id) || money(ch.contractTotal) || money(ch.total),
      address: ch.address || '',
      skuLines: lines,
      assembly: laborAssembly(ch.labor),
      pricing: {
        mfrDiscountPct: money(ch.bulkDiscPct),
        gaPct: money(ch.gnaPct),
        taxPct: money(ch.taxPct)
      },
      quoteId: ch.id || ''
    };
  }

  function invoicesFromAr(q) {
    var ar = q.ar || {};
    var plan = String(q.payPlan || '');
    var out = [];
    function push(n, label) {
      var amt = money(ar['d' + n + 'Amt']);
      if (!amt && n === 3 && (plan === '50-50' || plan === '50/50')) return;
      if (!amt && !ar['d' + n + 'Due'] && n > 1) return;
      var paid = !!ar['d' + n + 'Paid'];
      out.push({
        label: label,
        due: isoDay(ar['d' + n + 'Due']),
        amount: amt,
        status: paid ? 'Paid' : 'Due',
        paidDate: isoDay(ar['d' + n + 'PaidAt']),
        check: ar['d' + n + 'Check'] || ''
      });
    }
    if (plan === '50-50' || plan === '50/50') {
      push(1, 'Invoice 1 · 50% at order');
      push(2, 'Invoice 2 · 50% at delivery');
    } else {
      push(1, 'Invoice 1 · 50%');
      push(2, 'Invoice 2 · 30%');
      push(3, 'Invoice 3 · 20%');
    }
    var cos = q.changeOrders || [];
    cos.forEach(function (co, i) {
      var extra = co && co.extraInvoice;
      if (!extra || !extra.amt) return;
      out.push({
        label: 'Change order ' + (extra.n || (i + 1)) + ' invoice',
        due: isoDay(extra.due),
        amount: money(extra.amt),
        status: extra.paid ? 'Paid' : 'Due',
        paidDate: isoDay(extra.paidAt),
        check: extra.check || ''
      });
    });
    return out.filter(function (inv) { return inv.amount || inv.due; });
  }

  function changeLogFrom(q) {
    return (q.changeOrders || []).map(function (co) {
      var when = co.at ? isoDay(new Date(co.at).toISOString()) : isoDay(co.date);
      return {
        date: when,
        what: 'Change order ' + (co.n || 1),
        amount: money(co.changeAmount || co.billTotal || (co.extraInvoice && co.extraInvoice.amt)),
        reason: co.reason || ''
      };
    }).filter(function (e) { return e.amount; });
  }

  function isChild(q, row) {
    var kind = (q && q.kind) || (row && row.kind) || '';
    if (kind === 'child') return true;
    if (q && q.parentOrderId) return true;
    if (row && row.parentOrderId) return true;
    return false;
  }

  function isChangeOrderRecord(q, row) {
    var blob = ((q && q.customer) || (row && row.customer) || '') + ' ' + ((q && q.project) || (row && row.project) || '');
    return /change\s*order/i.test(blob);
  }

  /**
   * Top-level jobs only (orders + standalone houses + CO records).
   * Child houses are folded onto their parent as `houses[]`.
   */
  function legacyProjectsFromBundle(bundle) {
    bundle = bundle || {};
    var index = bundle['fm-quotes-index'] || [];
    var out = [];
    var seen = {};

    function addFromRow(row) {
      if (!row || !row.id || seen[row.id]) return;
      var q = quoteOf(bundle, row.id) || {};
      if (isChangeOrderRecord(q, row)) return;
      if (isChild(q, row)) return;
      seen[row.id] = true;

      var houses = [];
      var childIds = q.childIds || [];
      childIds.forEach(function (cid) {
        var ch = quoteOf(bundle, cid);
        var h = houseFromChild(ch, index);
        if (h) houses.push(h);
      });
      if (!houses.length && (q.cabinets || []).length) {
        var ownLines = cabinetsToLines(q.cabinets);
        var modelName = q.modelName || q.project || 'House';
        houses.push({
          jobCode: q.jobCode || row.jobCode || '',
          name: q.project || modelName,
          model: modelName,
          color: colorFrom(q, ownLines),
          lines: ownLines.length,
          total: money(q.contractTotal) || money(row.total),
          address: q.address || '',
          skuLines: ownLines,
          assembly: laborAssembly(q.labor),
          pricing: {
            mfrDiscountPct: money(q.bulkDiscPct),
            gaPct: money(q.gnaPct),
            taxPct: money(q.taxPct)
          },
          quoteId: q.id || row.id
        });
      }

      var total = money(q.contractTotal) || money(row.total) || money(q.total);
      var isOrder = q.kind === 'order' || q.isOrder || houses.length > 1;
      out.push({
        id: row.id,
        quoteId: q.id || row.id,
        jobCode: q.jobCode || row.jobCode || '',
        customer: q.customer || row.customer || '',
        projectName: q.project || row.project || '',
        kind: isOrder ? 'builder_order' : 'single',
        quoteDate: isoDay(q.date || row.date),
        deliveryDate: isoDay(q.installDate),
        status: statusLabel(q.status || row.status),
        total: total,
        signerName: q.signerName || '',
        buyerEmail: q.customerEmail || '',
        installAddress: q.address || '',
        houses: houses,
        invoices: invoicesFromAr(q),
        changeLog: changeLogFrom(q),
        parentJobCode: q.parentOrderId || row.parentOrderId || '',
        packetUrl: '/contract?id=' + encodeURIComponent(q.id || row.id),
        invoiceUrl: '/quote?id=' + encodeURIComponent(q.id || row.id),
        builderUrl: '/quote?id=' + encodeURIComponent(q.id || row.id),
        pricing: {
          mfrDiscountPct: money(q.bulkDiscPct),
          gaPct: money(q.gnaPct),
          taxPct: money(q.taxPct)
        }
      });
    }

    index.forEach(addFromRow);
    return out;
  }

  function denverToday() {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function foldChangeOrders(jobs, legacyProjects, FM) {
    if (!FM || !jobs) return jobs;
    var byCode = {};
    (legacyProjects || []).forEach(function (p) { byCode[p.jobCode] = p; });
    return jobs.map(function (j) {
      var p = byCode[j.jobCode];
      if (!p || !(p.changeLog || []).length) return j;
      var next = JSON.parse(JSON.stringify(j));
      (p.changeLog || []).forEach(function (e, i) {
        var amt = money(e.amount);
        if (!amt) return;
        var already = (next.changeOrders || []).some(function (c) { return c.amountCents === Math.round(amt * 100); });
        if (already) return;
        var n = (next.changeOrders || []).length + 1;
        var co = {
          id: next.jobCode + '-co' + n,
          number: n,
          date: e.date || p.quoteDate || null,
          reason: e.reason || e.what || '',
          amountCents: Math.round(amt * 100),
          status: 'invoiced',
          lines: [],
          source: { system: 'legacy-embedded', jobCode: p.jobCode }
        };
        next.changeOrders = (next.changeOrders || []).concat([co]);
        next.invoices = (next.invoices || []).map(function (inv) {
          if (inv.role === 'change_order' && !inv.changeOrderId && inv.amountCents === co.amountCents) {
            var copy = JSON.parse(JSON.stringify(inv));
            copy.changeOrderId = co.id;
            return copy;
          }
          return inv;
        });
      });
      return next;
    });
  }

  function liveOrderFromLegacy(p) {
    if (!p || !(p.houses || []).length) return null;
    var models = {};
    (p.houses || []).forEach(function (h) {
      var key = h.model || h.name || h.jobCode || 'House';
      models[key] = {
        color: h.color || '',
        assembly: h.assembly || { rate: 0, hours: 0 },
        lines: h.skuLines || []
      };
    });
    var pricing = p.pricing || (p.houses[0] && p.houses[0].pricing) || { mfrDiscountPct: 0, gaPct: 0, taxPct: 0 };
    return {
      jobCode: p.jobCode,
      customer: p.customer,
      houses: p.houses.map(function (h) {
        return { jobCode: h.jobCode, name: h.name, model: h.model || h.name };
      }),
      models: models,
      pricing: pricing
    };
  }

  function sampleFromBundle(bundle) {
    return {
      today: denverToday(),
      legacyProjects: legacyProjectsFromBundle(bundle),
      legacyPacketModelTotals: [
        { model: 'San Luis', total: 12171.93 },
        { model: 'Mesa Ridge', total: 14995.50 },
        { model: 'Sangre Vista', total: 15088.33 },
        { model: 'Pinyon Crest', total: 15583.95 },
        { model: 'Cimarron Peak', total: 14307.63 }
      ]
    };
  }

  return {
    quoteOf: quoteOf,
    statusLabel: statusLabel,
    legacyProjectsFromBundle: legacyProjectsFromBundle,
    sampleFromBundle: sampleFromBundle,
    denverToday: denverToday,
    foldChangeOrders: foldChangeOrders,
    liveOrderFromLegacy: liveOrderFromLegacy
  };
}));
