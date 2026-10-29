/*
 * Quote check preview: signed house quotes vs Phase 1 quote math, rendered as
 * letter-size customer documents. In-memory only; reads the sample order.
 */
(function () {
  'use strict';
  var FM = window.FMPhase1, Q = window.FMQuote, O = window.FM_WILLOW_ORDER;
  var root = document.getElementById('qp-root');
  var PAGE_PX = 11 * 96;   // one US-letter sheet at CSS 96 dpi
  var state = { house: O.houses[O.houses.length - 1].jobCode, mode: 'signed', fit: {} };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function house(code) { return O.houses.filter(function (h) { return h.jobCode === code; })[0]; }
  function priceFor(h, mode) {
    var m = O.models[h.model], p = Q.priceHouse(Q.inputFromOrderModel(m, O.pricing));
    return mode === 'signed' ? Q.reconcileToSigned(p, Math.round(m.contract.total * 100)) : p;
  }
  function metaFor(h, i) {
    return {
      house: h.name, jobCode: h.jobCode, buyer: O.customer, signer: O.signer,
      quoteDate: O.houseQuoteDate, deliveryDate: O.deliveryDate, address: '', color: O.models[h.model].color,
      pageLabel: 'House ' + (i + 1) + ' of ' + O.houses.length
    };
  }

  function render() {
    var h = house(state.house), idx = O.houses.indexOf(h), m = O.models[h.model];
    var probs = Q.verifyPrinted(Q.printedFromOrderModel(m, O.pricing));
    var p = priceFor(h, state.mode);
    var raw = Q.priceHouse(Q.inputFromOrderModel(m, O.pricing));
    var signed = Math.round(m.contract.total * 100);

    var picker = O.houses.map(function (x) {
      var on = x.jobCode === state.house, f = state.fit[x.jobCode];
      return '<button class="fmp1-btn' + (on ? ' fmp1-btn--primary' : '') + '" data-h="' + esc(x.jobCode) + '" aria-pressed="' + on + '">' + esc(x.name) +
        (f === undefined ? '' : f ? ' <span aria-label="fits one page">✓</span>' : ' <span aria-label="spills to page 2">⚠</span>') + '</button>';
    }).join('');

    var probList = probs.map(function (x) { return '<li>' + esc(x.text) + '</li>'; }).join('');

    var internal = '<dl class="qp-dl">' +
      '<div><dt>Your cost</dt><dd>' + FM.fmt(raw.internal.costCents) + '</dd></div>' +
      '<div><dt>Mfr. discount</dt><dd>' + FM.fmt(raw.summary.discountCents) + '<span>' + esc(raw.internal.discountNote) + '</span></dd></div>' +
      '<div><dt>Gross profit on product</dt><dd>' + FM.fmt(raw.internal.grossProfitCents) + ' <span>' + raw.internal.marginPct + '% of product</span></dd></div>' +
      '<div><dt>Sold at cost</dt><dd>' + (raw.internal.atCostLines.length ? esc(raw.internal.atCostLines.join(', ')) : 'None') + '</dd></div></dl>';

    var adj = state.mode === 'signed' ? (p.ok ? (p.reconciled.adjustmentCents
      ? 'Corrected math comes to ' + FM.fmt(raw.summary.totalCents) + '. The signed total of ' + FM.fmt(signed) + ' stands, with a ' + FM.fmt(p.reconciled.adjustmentCents, { sign: true }) + ' rounding line.'
      : 'Corrected math matches the signed total exactly.') : p.error)
      : 'New-quote math, not tied to a signed total. Use this for new quotes and change orders.';

    root.innerHTML =
      '<header class="qp-top"><div class="qp-brand"><span class="fmp1-logo fmp1-logo--tagline" role="img" aria-label="Fremont Makers, making freedom"></span><div><span class="fmp1-eyebrow">Phase 1 · house quotes · ' + esc(O.jobCode) + '</span><h1 class="fmp1-h qp-h1">Willow Creek quote check</h1>' +
      '<p class="fmp1-muted qp-intro">Signed Final Job Quotes compared with the Phase 1 quote math, using every SKU from the contract packet. Preview only; nothing here touches the live tool.</p></div></div>' +
      '<div class="qp-picker">' + (window.FMTheme ? window.FMTheme.toggleHTML(window.FMTheme.get(root)) : '') + '<span class="fmp1-pill fmp1-pill--proposed">Preview · not the live tool</span></div></header>' +
      '<div class="qp-picker" role="group" aria-label="House">' + picker + '</div>' +
      '<div class="qp-grid"><div class="qp-side">' +
        '<div class="fmp1-card qp-pad"><span class="fmp1-eyebrow">Signed quote today · ' + esc(h.name) + '</span>' +
          '<p class="qp-big fmp1-num">' + FM.fmt(signed) + '</p>' +
          '<div class="fmp1-note fmp1-note--alert qp-small"><span><b>' + probs.length + ' things a customer could catch with a calculator:</b><ul class="qp-list">' + probList + '</ul></span></div></div>' +
        '<div class="fmp1-card qp-pad"><span class="fmp1-eyebrow">Phase 1 quote</span>' +
          '<div class="qp-seg" role="group" aria-label="Which version"><button class="fmp1-btn' + (state.mode === 'signed' ? ' fmp1-btn--primary' : '') + '" data-mode="signed">Signed contract</button><button class="fmp1-btn' + (state.mode === 'new' ? ' fmp1-btn--primary' : '') + '" data-mode="new">New-quote math</button></div>' +
          '<p class="fmp1-muted qp-small">' + esc(adj) + '</p>' +
          '<div class="fmp1-note fmp1-note--good qp-small">✓ Every printed number adds up: unit × qty, lines to Cabinets, and every row to the total.</div></div>' +
        '<div class="fmp1-card qp-pad"><span class="fmp1-eyebrow">Internal only · never printed</span>' + internal + '</div>' +
        '<div class="fmp1-card qp-pad"><span class="fmp1-eyebrow">Print fit</span><p class="fmp1-muted qp-small" id="qp-fit">Measuring…</p></div>' +
      '</div><div class="qp-paper" aria-label="Customer document preview">' + (p.ok ? Q.renderHouseQuoteDoc(p, metaFor(h, idx)) : '') + '</div></div>' +
      '<div id="qp-measure" aria-hidden="true"></div>';

    measureAll();
  }

  /* Render every house off-screen at true letter width and check it fits one sheet. */
  function measureAll() {
    var box = document.getElementById('qp-measure'), results = {}, worst = 0;
    O.houses.forEach(function (h, i) {
      box.innerHTML = Q.renderHouseQuoteDoc(priceFor(h, state.mode), metaFor(h, i));
      box.firstChild.style.minHeight = '0';           // measure the content, not the 11in sheet
      var hgt = box.firstChild.scrollHeight;
      results[h.jobCode] = hgt <= PAGE_PX;
      worst = Math.max(worst, hgt);
    });
    box.innerHTML = '';
    var changed = JSON.stringify(results) !== JSON.stringify(state.fit);
    state.fit = results;
    var n = O.houses.filter(function (h) { return results[h.jobCode]; }).length;
    var el = document.getElementById('qp-fit');
    if (el) el.innerHTML = '<b>' + n + ' of ' + O.houses.length + ' houses fit on one letter sheet.</b> Tallest is ' + (worst / 96).toFixed(2) + 'in of 11in. Today each house quote spills onto a second sheet, so the packet prints 27 sheets for 15 pages.';
    if (changed) render();
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.h) { state.house = b.dataset.h; render(); }
    if (b.dataset.mode) { state.mode = b.dataset.mode; render(); }
  });

  if (window.FMTheme) { window.FMTheme.init(root); window.FMTheme.bind(root, root); }
  render();
})();
