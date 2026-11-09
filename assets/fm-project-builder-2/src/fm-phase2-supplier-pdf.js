/*
 * Shared Wholesale Cabinets PDF reader for New Project and change-order Upload SKUs.
 * Copied from the live /quote harvest (read-only). Does not edit that tool.
 * Returns { lines: [{ sku, qty, desc, unitCostCents }], skipped: [] }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMSupplierPdf = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SUFFIXES = ['SBW', 'VDH', 'UMO', 'SWD', 'WWT', 'LGR', 'CGY', 'TSP'];
  var COLORS = {
    SBW: 'Bayview White Shaker', VDH: 'Dark Hickory Shaker', UMO: 'Moss Green Shaker',
    SWD: 'Bayview Wood Shaker', WWT: 'White', LGR: 'Light Gray', CGY: 'Charcoal Gray', TSP: 'Sample'
  };

  function skuBase(serial) {
    var i = String(serial || '').lastIndexOf('-');
    return i > 0 ? serial.slice(0, i) : serial;
  }
  function looksLikeSerial(s) {
    s = String(s || '').toUpperCase();
    return /^[A-Z]{1,8}\d[A-Z0-9.()]{0,16}-[A-Z]{2,4}$/.test(s);
  }
  function harvestQty(after) {
    var blob = String(after || '');
    var m = blob.match(/(?:RTA\s*Cabinets?|Cabinets?)\s*\n?\s*([1-9]\d{0,2})\b/i)
      || blob.match(/\bQty(?:uity)?\s*[:\s]*([1-9]\d{0,2})\b/i);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 1 && n <= 200) return n;
    }
    var cleaned = blob.replace(/\$\s*[\d,]+(?:\.\d{2})?/g, ' ');
    var qtyM = cleaned.match(/\b([1-9]\d{0,2})\b/);
    if (qtyM) {
      var q = parseInt(qtyM[1], 10);
      if (q >= 1 && q <= 200) return q;
    }
    return 1;
  }
  function pickUnitCost(qty, prices) {
    if (!prices || !prices.length) return 0;
    if (qty > 1) {
      for (var i = 0; i < prices.length; i++) {
        var unit = Math.round((prices[i] / qty) * 100) / 100;
        if (unit > 5 && unit < 2500) return unit;
      }
    }
    return prices[0];
  }
  function harvest(text) {
    var blob = String(text || '').split(/\n\s*(?:Order\s*Total|Invoice\s*Total|Quote\s*Total|Grand\s*Total)\b/i)[0];
    var re = /\b([A-Z]{1,8}\d[A-Z0-9.()]{0,16}-[A-Z]{2,4})\b/g;
    var items = [];
    var seen = {};
    var m;
    while ((m = re.exec(blob))) {
      var serial = m[1].toUpperCase();
      var suf = serial.split('-').pop();
      if (SUFFIXES.indexOf(suf) < 0) continue;
      if (!looksLikeSerial(serial) || seen[serial]) continue;
      seen[serial] = 1;
      var after = blob.slice(m.index + m[0].length, m.index + m[0].length + 320);
      var qty = harvestQty(after);
      var prices = [];
      var pr = /\$?\s*([\d,]+\.\d{2})/g;
      var p;
      while ((p = pr.exec(after))) {
        var n = parseFloat(p[1].replace(/,/g, ''));
        if (n > 5 && n < 2500) prices.push(n);
      }
      var cost = pickUnitCost(qty, prices);
      items.push({
        sku: serial,
        qty: qty,
        desc: (COLORS[suf] || suf) + ' ' + skuBase(serial),
        unitCostCents: cost > 5 ? Math.round(cost * 100) : 0
      });
    }
    return { lines: items, skipped: [] };
  }
  function itemsToText(items) {
    var rows = [];
    (items || []).forEach(function (it) {
      var str = String(it.str || '').trim();
      if (!str) return;
      var x = (it.transform && it.transform[4]) || 0;
      var y = Math.round(((it.transform && it.transform[5]) || 0) / 3) * 3;
      var row = null;
      for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - y) < 4) { row = rows[i]; break; }
      if (!row) { row = { y: y, cells: [] }; rows.push(row); }
      row.cells.push({ x: x, str: str });
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    return rows.map(function (r) {
      r.cells.sort(function (a, b) { return a.x - b.x; });
      return r.cells.map(function (c) { return c.str; }).join(' ');
    }).filter(Boolean).join('\n');
  }
  function loadPdfJs() {
    if (typeof window === 'undefined') return Promise.reject(new Error('PDF reader needs a browser.'));
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('Could not load the PDF reader.')); };
      document.head.appendChild(s);
    });
  }
  function parseBuffer(arrayBuffer) {
    return loadPdfJs().then(function (pdfjs) {
      return pdfjs.getDocument({ data: arrayBuffer }).promise;
    }).then(function (pdf) {
      var pages = [];
      var i = 1;
      function next() {
        if (i > pdf.numPages) return Promise.resolve(pages.join('\n'));
        return pdf.getPage(i++).then(function (page) {
          return page.getTextContent().then(function (content) {
            pages.push(itemsToText(content.items));
            return next();
          });
        });
      }
      return next();
    }).then(harvest);
  }

  return { harvest: harvest, parseBuffer: parseBuffer, VERSION: '2.11.1' };
}));
