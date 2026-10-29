/*
 * Fremont Makers · Project Builder · Phase 1 house pricing
 * --------------------------------------------------------
 * Prices one house (or a whole builder order) from its SKU lines, the same
 * way the current Project Builder does:
 *
 *   line sell     = unit cost × qty × (1 + markup%)
 *   cabinets      = Σ line sell
 *   mfr discount  = discount% × Σ (unit cost × qty)        ← off COST, passed to the customer
 *   product       = cabinets − mfr discount
 *   assembly      = hourly rate × hours
 *   G&A           = G&A% × (product + assembly)
 *   tax           = tax% × product                        ← product only
 *   total         = product + assembly + G&A + tax
 *
 * Two rounding modes:
 *   'legacy' (default) — what the current tool does: carry full precision and
 *     round only what is shown. Reproduces every signed Willow Creek figure to
 *     the cent. Use this for anything already contracted.
 *   'cents' — round each line and each subtotal to the cent first, so a printed
 *     page always adds up. Recommended for NEW quotes only; it can move a total
 *     by ±1¢ versus legacy, so never re-price a signed contract with it.
 *
 * Pure functions, no DOM or storage. Money out is integer cents.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FMPricing = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.2.0-phase1';

  function c(dollars) { return Math.round(dollars * 100); }
  function r(x) { return Math.round(x); }

  /** Price one house. `model` = { lines, assembly:{rate,hours} }, `pricing` = { mfrDiscountPct, gaPct, taxPct }. */
  function priceHouse(model, pricing, opts) {
    var mode = (opts && opts.mode) || 'legacy';
    var d = pricing.mfrDiscountPct / 100, g = pricing.gaPct / 100, t = pricing.taxPct / 100;

    var lines = model.lines.map(function (l) {
      var costX = c(l.unitCost) * l.qty;                        // cents, exact
      var sellX = costX * (100 + l.markupPct) / 100;            // cents, may be fractional
      return {
        sku: l.sku, desc: l.desc, qty: l.qty,
        unitCostCents: c(l.unitCost), markupPct: l.markupPct,
        costCents: costX, sellCents: r(sellX), _sellX: sellX,
        unitSellCents: r(sellX / l.qty),
        atCost: l.markupPct === 0
      };
    });

    var costTotal = lines.reduce(function (s, l) { return s + l.costCents; }, 0);
    var assemblyX = model.assembly.rate * model.assembly.hours * 100;
    var out;

    if (mode === 'cents') {
      var cab = lines.reduce(function (s, l) { return s + l.sellCents; }, 0);
      var disc = r(costTotal * d), asm = r(assemblyX), prod = cab - disc;
      var ga = r((prod + asm) * g), tax = r(prod * t);
      out = { cabinetsCents: cab, discountCents: disc, assemblyCents: asm, productCents: prod, gaCents: ga, taxCents: tax, totalCents: prod + asm + ga + tax };
    } else {
      var cabX = lines.reduce(function (s, l) { return s + l._sellX; }, 0);
      var discX = costTotal * d, prodX = cabX - discX;
      var gaX = (prodX + assemblyX) * g, taxX = prodX * t;
      out = {
        cabinetsCents: r(cabX), discountCents: r(discX), assemblyCents: r(assemblyX),
        productCents: r(cabX) - r(discX),            // shown value; G&A and tax still use the exact product
        gaCents: r(gaX), taxCents: r(taxX),
        totalCents: r(prodX + assemblyX + gaX + taxX)
      };
    }

    lines.forEach(function (l) { delete l._sellX; });
    var printed = out.cabinetsCents - out.discountCents + out.assemblyCents + out.gaCents + out.taxCents;
    var lineSum = lines.reduce(function (s, l) { return s + l.sellCents; }, 0);
    var profit = out.cabinetsCents - costTotal;                 // discount is off both cost and price, so it cancels

    out.mode = mode;
    out.lines = lines;
    out.lineCount = lines.length;
    out.costCents = costTotal;
    out.assembly = { rate: model.assembly.rate, hours: model.assembly.hours };
    out.printedSumCents = printed;
    out.roundingGapCents = printed - out.totalCents;            // ≠ 0 means the page doesn't add up
    out.lineSumGapCents = lineSum - out.cabinetsCents;          // ≠ 0 means line totals don't add to "Cabinets"
    out.cabinetProfitCents = profit;
    out.cabinetMarginPct = out.cabinetsCents ? Math.round(profit / out.cabinetsCents * 1000) / 10 : 0;
    out.blendedMarkupPct = costTotal ? Math.round(profit / costTotal * 1000) / 10 : 0;
    out.atCostSkus = lines.filter(function (l) { return l.atCost; }).map(function (l) { return l.sku; });
    return out;
  }

  /** Price a whole builder order. Returns houses (in order), model totals and the order total. */
  function priceOrder(order, opts) {
    var houses = order.houses.map(function (h) {
      var m = order.models[h.model];
      var p = priceHouse(m, order.pricing, opts);
      p.jobCode = h.jobCode; p.name = h.name; p.model = h.model; p.color = m.color;
      return p;
    });
    var byModel = {}, models = [];
    houses.forEach(function (h) {
      if (!byModel[h.model]) { byModel[h.model] = { model: h.model, houses: 0, totalCents: 0 }; models.push(byModel[h.model]); }
      byModel[h.model].houses += 1;
      byModel[h.model].totalCents += h.totalCents;
    });
    return {
      houses: houses,
      models: models,
      orderTotalCents: houses.reduce(function (s, h) { return s + h.totalCents; }, 0),
      skuLineCount: houses.reduce(function (s, h) { return s + h.lineCount; }, 0)
    };
  }

  /** Compare legacy pricing with the figures printed on the contract.
   *  Returns a list of differences; an empty list means everything matches. */
  function reconcileWithContract(order) {
    var diffs = [];
    Object.keys(order.models).forEach(function (name) {
      var m = order.models[name], k = m.contract, p = priceHouse(m, order.pricing, { mode: 'legacy' });
      p.lines.forEach(function (l, i) {
        var want = c(m.lines[i].sellTotal);
        if (l.sellCents !== want) diffs.push({ model: name, field: 'line ' + l.sku, expectedCents: want, foundCents: l.sellCents });
      });
      [['costTotal', 'costCents'], ['cabinets', 'cabinetsCents'], ['discount', 'discountCents'], ['assembly', 'assemblyCents'],
       ['ga', 'gaCents'], ['tax', 'taxCents'], ['total', 'totalCents']].forEach(function (pair) {
        if (k[pair[0]] === undefined) return;
        var want = c(k[pair[0]]);
        if (p[pair[1]] !== want) diffs.push({ model: name, field: pair[0], expectedCents: want, foundCents: p[pair[1]] });
      });
    });
    return diffs;
  }

  return { VERSION: VERSION, priceHouse: priceHouse, priceOrder: priceOrder, reconcileWithContract: reconcileWithContract };
}));
