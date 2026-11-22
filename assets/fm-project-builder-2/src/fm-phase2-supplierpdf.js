/*
 * Fremont Makers · Project Builder · Phase 2 · Reading a supplier PDF (FMSupplierPdf)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMSupplierPdf in a browser.
 *
 * Owner, Nov 19: "The attached PDF is uploaded … but it won't add the SKUs in." The Wholesale Cabinets order PDFs the team
 * gets are often pictures of the page (no text inside), so the page reads the text first (pdf.js) and, when there's none,
 * recognizes it (OCR, tesseract.js) in the browser. Either way the text comes here as lines, and this turns it into items:
 *
 *   VDC42RS-VDH Quantity Price Subtotal          ← an item: its SKU (or its name, for moldings and other products)
 *   Dark Hickory Shaker 1 $707.92 $707.92        ← color, quantity, unit price, subtotal
 *   Type : RTA Cabinets / Size : 96"W|3/4"H…     ← optional details
 *   SHIPPING FEE Quantity Price Subtotal / 185 $1.00 $185.00   ← a fee, not a product
 *   Subtotal $1,600.44 · Discount $80.02 · Tax $132.28 · Shipping $0.00 · Total $1,652.70
 *
 * Returns the items, any fees, the order number and the order totals, and checks the items add up to the subtotal.
 * HANDOFF §40.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMSupplierPdf = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var SKU = /^[A-Z]{1,6}\d{1,5}[A-Z0-9.\/]*(?:-[A-Z0-9.]+)*$/;   // B24-SBW, VDC42RS-VDH, FP9624-1.5-VDH, WC362424-VDH
  var FEES = /\b(shipping|freight|delivery|fuel|handling|lift ?gate)\b.*\b(fee|charge)?/i;
  var MONEY = /\$\s?([\d,]+\.\d{2})/g;

  function cents(s) { return Math.round(parseFloat(String(s).replace(/[$,\s]/g, '')) * 100); }
  function clean(s) { return String(s || '').replace(/[|~_=]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* OCR leaves bits in front of an item's name ("=)", "es", "wu"): drop short lowercase or symbol tokens at the start. */
  function stripLead(s) {
    var t = clean(s).split(' ');
    while (t.length > 1 && (t[0].length <= 3 && (/^[^A-Za-z0-9]+$/.test(t[0]) || /^[a-z]+\)?$/.test(t[0]) || /[^A-Za-z0-9-]/.test(t[0])))) t.shift();
    return t.join(' ');
  }
  function moneys(s) { var out = [], m; MONEY.lastIndex = 0; while ((m = MONEY.exec(s))) out.push(cents(m[1])); return out; }

  /*
   * text: the PDF's text (one string, lines separated by \n) or an array of lines.
   * Returns { items: [{ sku, name, desc, qty, unitCostCents, subtotalCents, isSku }], fees: [{ label, qty, amountCents }],
   *           orderNumber, orderDate, totals: { subtotal, discount, tax, shipping, total }, check: { itemsCents, matches }, problems[] }
   */
  function parse(text) {
    var lines = (Array.isArray(text) ? text : String(text || '').split(/\r?\n/)).map(clean).filter(Boolean);
    var items = [], fees = [], totals = {}, order = null, date = null, problems = [];
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (/order\s*#/i.test(L) && lines[i + 1]) { var on = /\b(\d{6,})\b/.exec(lines[i + 1]); if (on) order = on[1]; var od = /([A-Z][a-z]{2} \d{1,2}, \d{4})/.exec(lines[i + 1]); if (od) date = od[1]; }
      var tm = /^(subtotal|discount|tax|shipping|total)\b[^$]*\$\s?([\d,]+\.\d{2})/i.exec(L);
      if (tm && !/quantity/i.test(L)) { totals[tm[1].toLowerCase()] = cents(tm[2]); continue; }
      var head = /^(.*?)\bquantity\b.*\bprice\b/i.exec(L);
      if (!head) continue;
      var title = stripLead(head[1]), next = lines[i + 1] || '', m = moneys(next);
      var qm = /(?:^|\s)(\d{1,4})\s+\$/.exec(next), qty = qm ? +qm[1] : null;
      if (!title || qty == null || !m.length) { problems.push('Couldn\'t read the line for "' + (title || L) + '".'); continue; }
      var desc = clean(next.slice(0, qm.index)), details = [];
      for (var k = i + 2; k < lines.length && k < i + 5; k++) { if (/^(type|size|color|finish)\s*:/i.test(lines[k])) details.push(clean(lines[k]).replace(/\s*:\s*/, ': ')); else break; }
      var unit = m[0], sub = m[1] != null ? m[1] : unit * qty;
      if (Math.abs(unit * qty - sub) > 2) problems.push(title + ': ' + qty + ' × $' + (unit / 100).toFixed(2) + ' doesn\'t match the subtotal $' + (sub / 100).toFixed(2) + '. Check the quantity.');
      var code = title.split(' ')[0].toUpperCase(), isSku = SKU.test(code) && /\d/.test(code);
      if (!isSku && FEES.test(title)) { fees.push({ label: title.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); }).replace(/\B\w+/g, function (w) { return w.toLowerCase(); }), qty: qty, amountCents: sub }); continue; }
      items.push({ sku: isSku ? code : (desc ? title + ' (' + desc + ')' : title), name: title,   // same molding in two colors stays two lines
                   desc: [desc].concat(details).filter(Boolean).join(' · '), qty: qty, unitCostCents: unit, subtotalCents: sub, isSku: isSku });
    }
    var itemsCents = items.reduce(function (t, x) { return t + x.subtotalCents; }, 0) + fees.reduce(function (t, x) { return t + x.amountCents; }, 0);
    var matches = totals.subtotal == null ? null : Math.abs(itemsCents - totals.subtotal) <= 2;
    if (matches === false) problems.push('The lines read add up to $' + (itemsCents / 100).toFixed(2) + ' but the PDF\'s subtotal is $' + (totals.subtotal / 100).toFixed(2) + '. Check the lines against the PDF.');
    if (!items.length && !fees.length) problems.push('No items were found in this PDF.');
    return { items: items, fees: fees, orderNumber: order, orderDate: date, totals: totals, check: { itemsCents: itemsCents, matches: matches }, problems: problems };
  }

  /* As lines for a quote or change order: { sku, desc, qty, unitCostCents }. Products without a SKU keep their name as the code. */
  function toLines(res) { return res.items.map(function (x) { return { sku: x.sku, desc: x.isSku ? x.desc : x.desc ? x.name + ' · ' + x.desc : x.name, qty: x.qty, unitCostCents: x.unitCostCents }; }); }

  return { VERSION: VERSION, parse: parse, toLines: toLines };
}));
