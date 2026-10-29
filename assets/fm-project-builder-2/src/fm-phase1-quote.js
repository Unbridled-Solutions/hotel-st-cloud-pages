/*
 * Fremont Makers · Project Builder · Phase 1 house-quote math + quote document
 * ---------------------------------------------------------------------------
 * Fixes three problems on the customer-facing Final Job Quote:
 *
 *   1. Printed math must add up. The current tool multiplies on unrounded
 *      numbers and rounds only what it prints, so unit × qty ≠ line total,
 *      lines ≠ "Cabinets", and the summary can be a penny off the total.
 *      Here every printed number is computed from the printed numbers above it:
 *        unit price  = round(unit cost × (1 + markup))
 *        line total  = unit price × qty
 *        cabinets    = Σ line totals
 *        product     = cabinets − discount
 *        G&A         = round((product + labor) × G&A %)
 *        tax         = round(product × tax %)
 *        total       = product + labor + G&A + tax
 *   2. The manufacturer discount is a % of YOUR cost, so the customer copy
 *      shows it without a % (the internal view still explains it).
 *   3. One house per letter page (layout in fm-phase1-print.css).
 *
 * Signed quotes are never repriced. `reconcileToSigned` keeps the signed total
 * and shows any rounding difference as its own line.
 *
 * Pure functions; never mutates inputs. Money is integer cents.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./fm-phase1-ledger.js') : root.FMPhase1);
  if (isNode) module.exports = api; else root.FMQuote = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';

  var VERSION = '1.4.3-phase1';

  /** Round half up to whole cents (inputs are cents, possibly fractional). */
  function rhu(x) { return Math.floor(x + 0.5 + 1e-9); }

  function pctLabel(p) { return (Math.round(p * 1000) / 1000) + '%'; }

  /**
   * Price one house.
   * input = {
   *   lines: [{ description, sku, qty, unitCostCents, markupPct }],
   *   discountPctOfCost, labor: [{ role, rateCents, hours }], gaPct, taxPct
   * }
   * Returns { ok, error } or { ok:true, lines, summary, rows, internal }.
   */
  function priceHouse(input) {
    input = input || {};
    var lines = input.lines || [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!(l.qty > 0) || Math.floor(l.qty) !== l.qty) return { ok: false, error: 'Line ' + (i + 1) + ' needs a whole-number quantity.' };
      if (!(l.unitCostCents >= 0)) return { ok: false, error: 'Line ' + (i + 1) + ' needs a unit cost.' };
      if (!(l.markupPct >= 0)) return { ok: false, error: 'Line ' + (i + 1) + ' needs a markup of 0% or more.' };
    }
    var outLines = lines.map(function (l) {
      var unit = l.noCharge ? 0 : rhu(l.unitCostCents * (100 + l.markupPct) / 100);
      return {
        description: l.description, sku: l.sku, qty: l.qty,
        unitCents: unit, totalCents: unit * l.qty,
        unitCostCents: l.unitCostCents, costCents: l.unitCostCents * l.qty, markupPct: l.noCharge ? null : l.markupPct,
        atCost: !l.noCharge && l.markupPct === 0,
        noCharge: !!l.noCharge
      };
    });
    var cabinets = outLines.reduce(function (t, l) { return t + l.totalCents; }, 0);
    // Discount is a % of the cost of CHARGED lines (no-charge lines are excluded, as in the current tool).
    var cost = outLines.filter(function (l) { return !l.noCharge; }).reduce(function (t, l) { return t + l.costCents; }, 0);
    var noChargeCost = outLines.filter(function (l) { return l.noCharge; }).reduce(function (t, l) { return t + l.costCents; }, 0);
    var discPct = input.discountPctOfCost || 0;
    var discount = rhu(cost * discPct / 100);
    var labor = (input.labor || []).map(function (w) { return { role: w.role, rateCents: w.rateCents, hours: w.hours, totalCents: rhu(w.rateCents * w.hours) }; });
    var laborTotal = labor.reduce(function (t, w) { return t + w.totalCents; }, 0);
    var product = cabinets - discount;
    var gaPct = input.gaPct || 0, taxPct = input.taxPct || 0;
    var ga = rhu((product + laborTotal) * gaPct / 100);
    var tax = rhu(product * taxPct / 100);
    var total = product + laborTotal + ga + tax;

    var rows = [
      { key: 'cabinets', label: 'Cabinets', cents: cabinets },
      discount ? { key: 'discount', label: 'Mfr. bulk discount', cents: -discount } : null,
      { key: 'product', label: 'Product subtotal', cents: product, subtotal: true },
      laborTotal ? { key: 'labor', label: 'Assembly labor', cents: laborTotal } : null,
      ga ? { key: 'ga', label: 'G&A (' + pctLabel(gaPct) + ' of product + labor)', cents: ga } : null,
      tax ? { key: 'tax', label: 'Tax (' + pctLabel(taxPct) + ' of product)', cents: tax } : null,
      { key: 'total', label: 'Contracted total', cents: total, total: true }
    ].filter(Boolean);

    return {
      ok: true,
      lines: outLines,
      labor: labor,
      summary: { cabinetsCents: cabinets, discountCents: discount, productCents: product, laborCents: laborTotal, gaCents: ga, taxCents: tax, totalCents: total },
      rows: rows,
      internal: {
        costCents: cost,
        discountNote: discount ? pctLabel(discPct) + ' of your cost ' + FM.fmt(cost) + ' (not of the customer price)' : '',
        atCostLines: outLines.filter(function (l) { return l.atCost; }).map(function (l) { return l.sku; }),
        noChargeLines: outLines.filter(function (l) { return l.noCharge; }).map(function (l) { return l.sku; }),
        noChargeCostCents: noChargeCost,
        grossProfitCents: product - cost - noChargeCost,
        marginPct: product ? Math.round((product - cost - noChargeCost) / product * 1000) / 10 : 0,
        rates: { discountPctOfCost: discPct, gaPct: gaPct, taxPct: taxPct }
      }
    };
  }

  /**
   * Check the arithmetic of a printed quote (e.g. one from the current tool).
   * printed = { lines:[{ sku, qty, unitCents, totalCents }], cabinetsCents, discountCents,
   *             laborCents, gaCents, taxCents, totalCents, gaPct, taxPct }
   * Returns a list of problems a reader could find with a calculator.
   */
  function verifyPrinted(p) {
    var probs = [];
    (p.lines || []).forEach(function (l) {
      if (l.unitCents * l.qty !== l.totalCents) {
        probs.push({ kind: 'line', sku: l.sku, text: l.sku + ': ' + l.qty + ' × ' + FM.fmt(l.unitCents) + ' = ' + FM.fmt(l.unitCents * l.qty) + ', printed ' + FM.fmt(l.totalCents) });
      }
    });
    var lineSum = (p.lines || []).reduce(function (t, l) { return t + l.totalCents; }, 0);
    if (lineSum !== p.cabinetsCents) probs.push({ kind: 'cabinets', text: 'Lines add up to ' + FM.fmt(lineSum) + ', printed Cabinets ' + FM.fmt(p.cabinetsCents) });
    var product = p.cabinetsCents - (p.discountCents || 0);
    if (p.gaPct !== undefined && rhu((product + (p.laborCents || 0)) * p.gaPct / 100) !== p.gaCents) {
      probs.push({ kind: 'ga', text: 'G&A ' + pctLabel(p.gaPct) + ' of ' + FM.fmt(product + (p.laborCents || 0)) + ' is ' + FM.fmt(rhu((product + (p.laborCents || 0)) * p.gaPct / 100)) + ', printed ' + FM.fmt(p.gaCents) });
    }
    if (p.taxPct !== undefined && rhu(product * p.taxPct / 100) !== p.taxCents) {
      probs.push({ kind: 'tax', text: 'Tax ' + pctLabel(p.taxPct) + ' of ' + FM.fmt(product) + ' is ' + FM.fmt(rhu(product * p.taxPct / 100)) + ', printed ' + FM.fmt(p.taxCents) });
    }
    var sum = product + (p.laborCents || 0) + (p.gaCents || 0) + (p.taxCents || 0);
    if (sum !== p.totalCents) probs.push({ kind: 'total', text: 'Summary adds up to ' + FM.fmt(sum) + ', printed total ' + FM.fmt(p.totalCents) });
    if (p.discountLabelPct !== undefined && p.discountCents) {
      var apparent = Math.round(p.discountCents / p.cabinetsCents * 10000) / 100;
      if (Math.abs(apparent - p.discountLabelPct) > 0.25) {
        probs.push({ kind: 'discount-label', text: 'Discount says ' + pctLabel(p.discountLabelPct) + ' but is ' + apparent + '% of the Cabinets line above it' });
      }
    }
    return probs;
  }

  /**
   * Keep a signed total while showing corrected math. Adds a "Rounding
   * adjustment" row for the difference. Differences over `maxCents`
   * (default $1.00) are refused: that's a pricing change, not rounding,
   * and needs a change order.
   */
  function reconcileToSigned(priced, signedTotalCents, maxCents) {
    var max = maxCents === undefined ? 100 : maxCents;
    var diff = signedTotalCents - priced.summary.totalCents;
    if (Math.abs(diff) > max) return { ok: false, error: 'Corrected math differs from the signed total by ' + FM.fmt(Math.abs(diff)) + '. That needs a change order, not a rounding adjustment.' };
    var out = JSON.parse(JSON.stringify(priced));
    if (diff !== 0) {
      var totalRow = out.rows.pop();
      out.rows.push({ key: 'rounding', label: 'Rounding adjustment (to signed total)', cents: diff });
      totalRow.cents = signedTotalCents;
      out.rows.push(totalRow);
      out.summary.roundingCents = diff;
      out.summary.totalCents = signedTotalCents;
    }
    out.ok = true;
    out.reconciled = { signedTotalCents: signedTotalCents, adjustmentCents: diff };
    return out;
  }

  /* ---------- customer document (HTML string, styled by fm-phase1-print.css) ---------- */

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function longDate(iso) {
    if (!iso) return '—';
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], p = iso.split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }

  /**
   * meta = { house, jobCode, buyer, signer, quoteDate, deliveryDate, address, color,
   *          pageLabel ('Page 6 of 15'), houseNumber }
   * Returns one letter-size sheet. No internal numbers (cost, markup, margin) are printed.
   */
  /* Fremont Makers logo for the top left of every customer document: the official
     "FREMONT MAKERS / making freedom" logo only (owner, Oct 28: no separate F/M mark), in Juniper Shadow
     (assets/brand/, owner-supplied, recolored).
     meta.logoBase: where assets/brand/ is served from (default "assets/brand/", relative to the page). */
  var LOGO_BASE = 'assets/brand/';
  function logoHTML(meta) {
    meta = meta || {};
    var base = meta.logoBase || LOGO_BASE;
    return '<div class="doc-logo" role="img" aria-label="Fremont Makers, making freedom">' +
      '<img class="doc-lockup" src="' + esc(base) + 'fm-tagline-juniper.png" alt=""></div>';
  }

  function renderHouseQuoteDoc(priced, meta) {
    meta = meta || {};
    var lineRows = priced.lines.map(function (l) {
      if (l.noCharge) return '<tr><td>' + esc(l.description) + '</td><td class="sku">' + esc(l.sku) + '</td><td class="r">' + l.qty + '</td><td class="r" colspan="2">No charge</td></tr>';
      return '<tr><td>' + esc(l.description) + '</td><td class="sku">' + esc(l.sku) + '</td><td class="r">' + l.qty + '</td><td class="r">' + FM.fmt(l.unitCents) + '</td><td class="r">' + FM.fmt(l.totalCents) + '</td></tr>';
    }).join('');
    var sumRows = priced.rows.map(function (r) {
      return '<tr class="' + (r.total ? 'is-total' : r.subtotal ? 'is-sub' : '') + '"><td>' + esc(r.label) + '</td><td class="r">' + FM.fmt(r.cents) + '</td></tr>';
    }).join('');
    function field(k, v) { return '<div><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
    return '<article class="fm-p1-doc doc-sheet" aria-label="Final Job Quote ' + esc(meta.house) + '">' +
      '<header class="doc-head">' + logoHTML(meta) +
      '<div class="doc-title"><div class="doc-kicker">Final Job Quote</div><h1>' + esc(meta.house) + '</h1></div></header>' +
      '<section class="doc-fields">' +
        field('Buyer', esc(meta.buyer) + (meta.signer && meta.signer !== meta.buyer ? '<span class="sub">Signer: ' + esc(meta.signer) + '</span>' : '')) +
        field('Job', esc(meta.jobCode)) +
        field('Quote date', longDate(meta.quoteDate)) +
        field('Install / delivery', longDate(meta.deliveryDate)) +
        field('Site address', meta.address ? esc(meta.address) : '<span class="missing">Not set</span>') +
        field('Color', esc(meta.color)) +
      '</section>' +
      '<table class="doc-lines"><thead><tr><th>Description</th><th>SKU</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead><tbody>' + lineRows + '</tbody></table>' +
      '<div class="doc-bottom"><table class="doc-sum"><tbody>' + sumRows + '</tbody></table>' +
      '<p class="doc-note">Every amount above is calculated from the amounts printed before it. Assembly is included; installation into the building is not.</p>' +
      '<footer class="doc-foot"><span>Buyer initials <i></i></span><span>Date <i class="wide"></i></span><span class="pg">' + esc(meta.pageLabel || '') + '</span></footer></div>' +
      '</article>';
  }

  /* ---------- adapters for the full-order data (preview/willow-creek-full-order.js) ---------- */

  /** Build priceHouse() input from an order model + order pricing. */
  function inputFromOrderModel(model, pricing) {
    return {
      lines: model.lines.map(function (l) {
        return { description: l.desc, sku: l.sku, qty: l.qty, unitCostCents: Math.round(l.unitCost * 100), markupPct: l.markupPct, noCharge: !!l.noCharge };
      }),
      discountPctOfCost: pricing.mfrDiscountPct,
      // Assembly is either rate × hours, or a fixed amount when only the total is known.
      labor: [model.assembly.total !== undefined
        ? { role: 'Assembly', rateCents: Math.round(model.assembly.total * 100), hours: 1 }
        : { role: 'Assembly', rateCents: Math.round(model.assembly.rate * 100), hours: model.assembly.hours }],
      gaPct: pricing.gaPct, taxPct: pricing.taxPct
    };
  }

  /** Rebuild the quote as the current tool printed it, for verifyPrinted().
   *  The current tool prints unit = round(unrounded line ÷ qty) next to the
   *  rounded line total (e.g. ACM8: $124.61 and $249.23). */
  function printedFromOrderModel(model, pricing) {
    var k = model.contract;
    return {
      lines: model.lines.map(function (l) {
        var exactLine = Math.round(l.unitCost * 100) * l.qty * (100 + l.markupPct) / 100;
        var unit = l.unitSell !== undefined ? Math.round(l.unitSell * 100) : (l.noCharge ? 0 : rhu(exactLine / l.qty));
        return { sku: l.sku, qty: l.qty, unitCents: unit, totalCents: Math.round(l.sellTotal * 100) };
      }),
      cabinetsCents: Math.round(k.cabinets * 100), discountCents: Math.round(k.discount * 100),
      laborCents: Math.round(k.assembly * 100), gaCents: Math.round(k.ga * 100), taxCents: Math.round(k.tax * 100),
      totalCents: Math.round(k.total * 100), gaPct: pricing.gaPct, taxPct: pricing.taxPct,
      discountLabelPct: pricing.mfrDiscountPct
    };
  }

  return {
    VERSION: VERSION, rhu: rhu,
    priceHouse: priceHouse, verifyPrinted: verifyPrinted, reconcileToSigned: reconcileToSigned,
    renderHouseQuoteDoc: renderHouseQuoteDoc, logoHTML: logoHTML,
    inputFromOrderModel: inputFromOrderModel, printedFromOrderModel: printedFromOrderModel
  };
}));
