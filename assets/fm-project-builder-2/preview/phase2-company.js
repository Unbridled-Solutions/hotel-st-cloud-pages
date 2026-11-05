/*
 * Phase 2 preview · Company books → Company P&L and Balance sheet (HANDOFF §31). Uses FMCompany (src/fm-phase2-company.js).
 * Carried over from the existing tool's P&L and Balance Sheet pages, with the owner's numbers brought across.
 * Routes: #/books/company (Company P&L), #/books/balance (Balance sheet). Editing needs Full access; every change is logged.
 */
(function () {
  'use strict';
  var CO = window.FMCompany;
  var MODES = { rolling3: 'Next 3 months', month: 'One month', quarter: 'Quarter', year: 'Year' };

  function where() { var h = (location.hash || '').replace(/^#\/?/, '').split('/'); return h[0] === 'books' ? h[1] : null; }
  function st(c) { return (c.ui.co = c.ui.co || { mode: 'rolling3', month: c.TODAY.slice(0, 7), quarter: c.TODAY.slice(0, 4) + '-Q' + Math.ceil(+c.TODAY.slice(5, 7) / 3), year: c.TODAY.slice(0, 4), edit: false, bsEdit: false }); }
  function full(c) { return c.me().access === 'full'; }
  function parse(v) {
    var s = String(v == null ? '' : v).trim(), neg = /^\(.*\)$/.test(s) || /^[-−]/.test(s);
    var n = parseFloat(s.replace(/[()$,\s−-]/g, ''));
    return isNaN(n) ? (s === '' ? 0 : NaN) : Math.round(n * 100) * (neg ? -1 : 1);
  }
  function plain(c) { return ((c || 0) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(v) { return '<span class="' + (v < 0 ? 'p2-neg' : '') + '">' + v.toFixed(1) + '%</span>'; }
  function cell(c, v, neg) { return '<span class="' + (v < 0 ? 'p2-neg' : '') + '">' + (neg && v ? '(' + c.money(Math.abs(v)) + ')' : c.money(v)) + '</span>'; }
  function company(c) { return c.store.company() || CO.fromLegacy({}); }

  function picker(c, u) {
    var esc = c.esc;
    if (u.mode === 'month') return '<label class="p2-fld"><span>Month</span><input class="fmp1-input" type="month" data-copick="month" value="' + esc(u.month) + '"></label>';
    if (u.mode === 'quarter') {
      var y = +c.TODAY.slice(0, 4), opts = [];
      [y - 1, y, y + 1].forEach(function (yy) { [1, 2, 3, 4].forEach(function (q) { opts.push(yy + '-Q' + q); }); });
      return '<label class="p2-fld"><span>Quarter</span><select class="fmp1-input" data-copick="quarter">' + opts.map(function (o) { return '<option' + (o === u.quarter ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>';
    }
    if (u.mode === 'year') { var yr = +c.TODAY.slice(0, 4); return '<label class="p2-fld"><span>Year</span><select class="fmp1-input" data-copick="year">' + [yr - 1, yr, yr + 1].map(function (o) { return '<option' + (String(o) === u.year ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>'; }
    return '';
  }

  /* ---------- Company P&L ---------- */
  function pnl(c) {
    var esc = c.esc, u = st(c), co = company(c), books = c.store.books();
    var months = CO.columns(u.mode, u[u.mode], c.TODAY), s = CO.statement(co, books, months), cols = s.months, multi = cols.length > 1, edit = u.edit && full(c);
    var head = '<tr><th>Line</th>' + cols.map(function (m) { return '<th class="r">' + esc(m.label) + (m.estimated ? '<br><span class="fmp1-pill p2-pill-est" title="Nobody has entered this month yet; it uses the standard monthly amounts">estimate</span>' : m.beforeRecords ? '<br><span class="fmp1-pill p2-pill-est" title="Before the first month in the books">before records</span>' : '') + '</th>'; }).join('') + (multi ? '<th class="r">Total</th>' : '') + '</tr>';
    function sec(t) { return '<tr class="p2-cb-sec"><td colspan="' + (cols.length + (multi ? 2 : 1)) + '">' + t + '</td></tr>'; }
    function auto(label, key, note, neg) {
      return '<tr><td>' + label + ' <span class="fmp1-faint p2-small">(from jobs)</span>' + (note ? '<br><span class="fmp1-faint p2-small">' + note + '</span>' : '') + '</td>' +
        cols.map(function (m) { return '<td class="r">' + cell(c, m[key], neg) + '</td>'; }).join('') + (multi ? '<td class="r">' + cell(c, s.total[key], neg) + '</td>' : '') + '</tr>';
    }
    function total(label, key, neg, big) {
      return '<tr class="is-total' + (big ? ' p2-cb-big' : '') + '"><td>' + label + '</td>' + cols.map(function (m) { return '<td class="r">' + cell(c, m[key], neg) + '</td>'; }).join('') + (multi ? '<td class="r">' + cell(c, s.total[key], neg) + '</td>' : '') + '</tr>';
    }
    function margin(label, key) { return '<tr class="p2-cb-pct"><td>' + label + '</td>' + cols.map(function (m) { return '<td class="r">' + pct(m[key]) + '</td>'; }).join('') + (multi ? '<td class="r">' + pct(s.total[key]) + '</td>' : '') + '</tr>'; }
    function input(l) {
      return '<tr><td>' + esc(l.label) + (l.note ? ' <span class="fmp1-faint p2-small">' + esc(l.note) + '</span>' : '') + '</td>' + cols.map(function (m) {
        var v = m.input[l.key];
        return '<td class="r">' + (edit ? '<input class="fmp1-input p2-cb-in" inputmode="decimal" aria-label="' + esc(l.label + ', ' + m.label) + '" data-com="' + m.month + '" data-cok="' + l.key + '" value="' + plain(v) + '">'
          : '<span class="' + (m.estimated ? 'fmp1-faint' : '') + '">' + c.money(v) + '</span>') + '</td>';
      }).join('') + (multi ? '<td class="r">' + c.money(s.total.input[l.key]) + '</td>' : '') + '</tr>';
    }
    var L = function (sec) { return CO.LINES.filter(function (l) { return l.section === sec; }).map(input).join(''); };
    var body = sec('Revenue') + auto('Job revenue', 'jobRevenue', 'Contracts signed that month, less sales tax') + L('revenue') + total('Total revenue', 'totalRevenue', false, true) +
      sec('Cost of goods sold') + auto('Net cabinet cost', 'cabinetCost', 'Supplier cost less the manufacturer\'s discount', true) + auto('Courtesy absorbed', 'absorbed', 'No-charge change orders', true) + L('cogs') + total('Total cost of goods sold', 'totalCogs', true) +
      total('Gross profit', 'grossProfit', false, true) + margin('Gross margin', 'grossMarginPct') +
      sec('Operating expenses') + L('opex') + '<tr><td class="fmp1-faint p2-small">Payroll taxes</td>' + cols.map(function () { return '<td class="r fmp1-faint p2-small">$0.00 (K-1)</td>'; }).join('') + (multi ? '<td></td>' : '') + '</tr>' +
      total('Total operating expenses', 'totalOpex', true) + total('EBITDA', 'ebitda', false, true) +
      sec('Below the line') + L('below') + total('Net income (before tax)', 'netIncome', false, true) + margin('Net margin', 'netMarginPct');
    var first = cols[0];
    var kpis = '<div class="p2-kpis">' + [['Revenue', c.money(first.totalRevenue)], ['Gross margin', first.grossMarginPct.toFixed(1) + '%'], ['Net income', cell(c, first.netIncome)], ['Operating expenses', c.money(first.totalOpex)]].map(function (k) {
      return '<div class="fmp1-card p2-kpi"><span class="k">' + k[0] + '</span><span class="v">' + k[1] + '</span><span class="p2-small fmp1-faint">' + esc(first.label) + (first.estimated ? ' · estimate' : '') + '</span></div>'; }).join('') + '</div>';
    var std = u.std ? '<div class="fmp1-card fmp1-table-wrap"><div class="p2-pad" style="padding-bottom:0"><span class="fmp1-eyebrow">Standard monthly amounts</span><p class="p2-small fmp1-muted">Used for any month nobody has entered. Changing one doesn\'t touch months already entered.</p></div><table class="fmp1-table p2-table"><tbody>' +
      CO.LINES.map(function (l) { var v = (co.standard || CO.STANDARD)[l.key] || 0; return '<tr><td>' + esc(l.label) + (l.note ? ' <span class="fmp1-faint p2-small">' + esc(l.note) + '</span>' : '') + '</td><td class="r">' + (edit ? '<input class="fmp1-input p2-cb-in" inputmode="decimal" aria-label="Standard ' + esc(l.label) + '" data-costd="' + l.key + '" value="' + plain(v) + '">' : c.money(v)) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '';
    var log = (co.log || []).slice(0, 6);
    return '<div class="p2-between"><div class="p2-head"><h1 class="fmp1-h p2-h1">Company P&amp;L</h1><p class="p2-sub">The whole business by month: job revenue and cabinet cost come from the projects; expenses are what you enter. Carried over from the existing tool with your numbers.</p></div>' +
        (full(c) ? '<button class="fmp1-btn' + (edit ? ' fmp1-btn--primary' : '') + '" data-coedit aria-pressed="' + edit + '">' + (edit ? 'Done editing' : 'Edit numbers') + '</button>' : '<span class="p2-small fmp1-faint">Editing needs Full access</span>') + '</div>' +
      '<div class="p2-row"><div class="p2-chips" role="group" aria-label="Period">' + Object.keys(MODES).map(function (k) { return '<button class="fmp1-btn" data-comode="' + k + '" aria-pressed="' + (u.mode === k) + '">' + MODES[k] + '</button>'; }).join('') + '</div>' + picker(c, u) + '</div>' +
      (u.err ? '<div class="fmp1-note fmp1-note--alert" role="alert">' + esc(u.err) + '</div>' : '') +
      kpis +
      (s.estimated.length ? '<p class="p2-small fmp1-muted">' + s.estimated.length + ' of these months ' + (s.estimated.length === 1 ? 'hasn\'t' : 'haven\'t') + ' been entered, so ' + (s.estimated.length === 1 ? 'it uses' : 'they use') + ' the standard monthly amounts (grey). ' + (full(c) ? 'Edit any amount to enter the month.' : '') + '</p>' : '') +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-table p2-cb"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p><button class="p2-tog" data-costdtog aria-expanded="' + !!u.std + '">' + (u.std ? '▾ Hide standard monthly amounts' : '▸ Standard monthly amounts') + '</button></p>' + std +
      (log.length ? '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Recent changes</span><ul class="p2-cb-log">' + log.map(function (e) { return '<li><span class="p2-small fmp1-faint">' + esc(e.at.slice(0, 10)) + ' · ' + esc(e.by) + '</span><br>' + esc(e.text) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<p class="p2-note">Job revenue is the contract less sales tax (sales tax goes to the state). Cabinet cost is the supplier\'s quoted cost less the manufacturer\'s discount, as on the job <a href="#/books/pnl">P&amp;L</a>. Assembly billed to customers counts as gross profit; what you pay for the work is in Contract labor and Guaranteed payments, so there is no separate assembly expense line. Principal is shown below the line as the existing tool did; ask your accountant whether to keep it there.</p>';
  }

  /* ---------- Balance sheet ---------- */
  function ytdNet(c, co) {
    var y = c.TODAY.slice(0, 4), months = CO.columns('year', y, c.TODAY).filter(function (m) { return m <= c.TODAY.slice(0, 7); });
    return CO.statement(co, c.store.books(), months).total.netIncome;
  }
  function balance(c) {
    var esc = c.esc, u = st(c), co = company(c), edit = u.bsEdit && full(c);
    var jobs = window.FMBooks.balanceSheet(c.store.books(), c.TODAY), recv = jobs.assets[0].cents;
    var b = CO.balance(co, { receivableCents: recv, netIncomeYtdCents: ytdNet(c, co) }), hint = {};
    b.hints.forEach(function (h) { hint[h.key] = h.text; });
    function group(g) {
      return '<tr class="p2-cb-sec"><td colspan="2">' + esc(g.title) + '</td></tr>' + g.lines.map(function (l) {
        var v = b.values[l[0]] || 0;
        return '<tr><td>' + esc(l[1]) + (hint[l[0]] ? '<br><span class="fmp1-faint p2-small">' + esc(hint[l[0]]) + '</span>' : '') + '</td><td class="r">' +
          (edit ? '<input class="fmp1-input p2-cb-in" inputmode="decimal" aria-label="' + esc(l[1]) + '" data-cobs="' + l[0] + '" value="' + plain(v) + '">' : (l[2] && v ? '(' + c.money(v) + ')' : c.money(v))) + '</td></tr>';
      }).join('') + '<tr class="is-total"><td>Total ' + esc(g.title.toLowerCase()) + '</td><td class="r">' + cell(c, b.groups[g.group]) + '</td></tr>';
    }
    var G = {}; CO.BALANCE.forEach(function (g) { G[g.group] = g; });
    var check = b.balanced ? '<div class="fmp1-note" role="status">✓ Balanced: assets equal liabilities plus equity.</div>' :
      '<div class="fmp1-note fmp1-note--alert" role="status"><b>Off by ' + c.money(Math.abs(b.differenceCents)) + '.</b> Total assets are ' + c.money(b.totalAssets) + '; liabilities plus equity are ' + c.money(b.totalLiabEquity) + '. ' +
        'These are the numbers brought over from the existing tool, unchanged. Check them with your accountant' + (full(c) ? ', then correct them here.' : '.') + '</div>';
    return '<div class="p2-between"><div class="p2-head"><h1 class="fmp1-h p2-h1">Balance sheet</h1><p class="p2-sub">Fremont Makers Cabinet Co. · ' + (b.asOf ? 'as of ' + esc(c.longDate(b.asOf)) : '<span class="fmp1-faint">no date set</span>') + '. Carried over from the existing tool with your numbers.</p></div>' +
        '<div class="p2-row">' + (full(c) ? '<button class="fmp1-btn' + (edit ? ' fmp1-btn--primary' : '') + '" data-cobsedit aria-pressed="' + edit + '">' + (edit ? 'Done editing' : 'Edit numbers') + '</button>' : '<span class="p2-small fmp1-faint">Editing needs Full access</span>') +
        '<button class="fmp1-btn" data-cobscsv>Download CSV</button></div></div>' +
      (edit ? '<label class="p2-fld"><span>As of</span><input class="fmp1-input" type="date" data-cobsdate value="' + esc(b.asOf) + '"></label>' : '') +
      (u.err ? '<div class="fmp1-note fmp1-note--alert" role="alert">' + esc(u.err) + '</div>' : '') + (u.msg ? '<div class="fmp1-note" role="status">' + esc(u.msg) + '</div>' : '') +
      check +
      '<div class="p2-grid p2-cb-bs"><div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-bs"><thead><tr><th>Assets</th><th class="r">Amount</th></tr></thead><tbody>' +
        group(G.currentAssets) + group(G.fixedAssets) + '<tr class="is-total p2-cb-big"><td>Total assets</td><td class="r">' + cell(c, b.totalAssets) + '</td></tr></tbody></table></div>' +
      '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table p2-bs"><thead><tr><th>Liabilities and equity</th><th class="r">Amount</th></tr></thead><tbody>' +
        group(G.currentLiabilities) + group(G.longTermLiabilities) + group(G.equity) + '<tr class="is-total p2-cb-big"><td>Total liabilities + equity</td><td class="r">' + cell(c, b.totalLiabEquity) + '</td></tr></tbody></table></div></div>' +
      '<p class="p2-note">Grey notes compare a line with what the Project Builder knows (customer invoices not yet paid, this year\'s net income on the Company P&amp;L). Job-by-job balances are on <a href="#/books/jobbalances">Job balances</a>.</p>';
  }

  function saveFile(name, text) {
    var use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
    return Promise.resolve(use).then(function (dl) {
      if (dl) return dl.save({ filename: name, data: text });
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  function render(c, key) { return key === 'company' ? pnl(c) : balance(c); }

  function click(c, t) {
    var w = where(); if (w !== 'company' && w !== 'balance') return false;
    var u = st(c), d = t.dataset;
    if (d.comode) { u.mode = d.comode; u.err = null; c.render(); return true; }
    if (t.hasAttribute('data-coedit')) { u.edit = !u.edit; u.err = null; c.render(); return true; }
    if (t.hasAttribute('data-costdtog')) { u.std = !u.std; c.render(); return true; }
    if (t.hasAttribute('data-cobsedit')) { u.bsEdit = !u.bsEdit; u.err = u.msg = null; c.render(); return true; }
    if (t.hasAttribute('data-cobscsv')) {
      var co = company(c), name = 'fremont-makers-balance-sheet-' + ((co.balance && co.balance.asOf) || c.TODAY) + '.csv';
      Promise.resolve(saveFile(name, CO.balanceCSV(co))).then(function () { u.msg = 'Downloaded ' + name + '.'; c.render(); }, function (er) { u.msg = er && er.code === 'declined' ? 'Download canceled.' : 'The download didn\'t go through.'; c.render(); });
      return true;
    }
    return false;
  }
  function change(c, e) {
    var w = where(); if (w !== 'company' && w !== 'balance') return false;
    var el = e.target, u = st(c), d = el.dataset, me = c.me(), r = null;
    if (d.copick) { u[d.copick] = el.value; c.render(); return true; }
    var at = c.TODAY + new Date().toISOString().slice(10);
    if (d.com || d.costd || d.cobs) {
      var cents = parse(el.value);
      if (isNaN(cents)) { u.err = 'Enter an amount like 2,255.00.'; c.render(); return true; }
      r = d.com ? CO.setMonth(company(c), d.com, d.cok, cents, me, at) : d.costd ? CO.setStandard(company(c), d.costd, cents, me, at) : CO.setBalance(company(c), d.cobs, cents, me, at);
    } else if (el.hasAttribute('data-cobsdate')) r = CO.setBalance(company(c), 'asOf', el.value, me, at);
    else return false;
    if (!r.ok) { u.err = r.error; c.render(); return true; }
    if (r.text && !/: (\S+) → \1/.test(r.text)) c.store.saveCompany(r, me.name, at);   // unchanged values aren't logged
    u.err = null; c.render(); return true;
  }

  window.P2Company = { render: render, click: click, change: change };
  if (window.P2 && window.P2.render) window.P2.render();   // this file loads after the app's first draw
})();
