/*
 * Phase 2 preview · Company Books → Reports & exports (HANDOFF §25). Uses FMReports (src/fm-phase2-reports.js).
 * Pick a period, look at each report, download it as a CSV for Excel, Google Sheets or QuickBooks.
 * Downloads go through the page's download permission when it has one (claude.ai preview), else a normal browser download.
 */
(function () {
  'use strict';
  var R = window.FMReports;

  function period(c) {
    var u = c.ui.rp = c.ui.rp || { key: 'month' }, ps = R.periods(c.TODAY);
    if (u.key === 'custom') return { key: 'custom', label: 'Custom', from: u.from || ps[0].from, to: u.to || c.TODAY };
    return ps.filter(function (p) { return p.key === u.key; })[0] || ps[0];
  }
  function tables(c) { var p = period(c); return R.all(c.store.jobs(), { from: p.from, to: p.to, today: c.TODAY, includeQuotes: !!c.ui.rp.quotes }); }
  function fmtCell(c, v, col) { if (v == null || v === '') return '<span class="fmp1-faint">—</span>'; return col.money ? c.money(v) : c.esc(String(v)); }

  function render(c) {
    var esc = c.esc, u = c.ui.rp = c.ui.rp || { key: 'month' }, p = period(c), ts = tables(c);
    var chips = '<div class="p2-chips" role="group" aria-label="Period">' + R.periods(c.TODAY).concat([{ key: 'custom', label: 'Custom' }]).map(function (x) {
      return '<button class="fmp1-btn" data-rpperiod="' + x.key + '" aria-pressed="' + (u.key === x.key) + '">' + esc(x.label) + '</button>'; }).join('') + '</div>' +
      (u.key === 'custom' ? '<div class="p2-row"><label class="p2-fld"><span>From</span><input class="fmp1-input" type="date" data-rpfrom value="' + esc(p.from) + '"></label><label class="p2-fld"><span>To</span><input class="fmp1-input" type="date" data-rpto value="' + esc(p.to) + '"></label></div>' : '') +
      '<p class="p2-small fmp1-muted">' + esc(c.longDate(p.from)) + ' to ' + esc(c.longDate(p.to)) + '. The period applies to payments, sales tax and change orders; Jobs and Invoices show everything as of today.</p>';
    var cards = ts.map(function (t) {
      var open = u.open === t.key, money = t.columns.filter(function (col) { return col.money && t.totals[col.key] != null; }).slice(0, 3);
      var preview = open ? '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table p2-rp-table"><thead><tr>' + t.columns.map(function (col) { return '<th' + (col.money ? ' class="r"' : '') + '>' + esc(col.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        t.rows.slice(0, 50).map(function (r) { return '<tr>' + t.columns.map(function (col) { return '<td' + (col.money ? ' class="r"' : '') + '>' + fmtCell(c, r[col.key], col) + '</td>'; }).join('') + '</tr>'; }).join('') +
        (t.rows.length ? '<tr class="is-total">' + t.columns.map(function (col, i) { return '<td' + (col.money ? ' class="r"' : '') + '>' + (i === 0 ? 'Total' : col.key in t.totals ? c.money(t.totals[col.key]) : '') + '</td>'; }).join('') + '</tr>' : '') +
        '</tbody></table></div>' + (t.rows.length > 50 ? '<p class="p2-small fmp1-faint">Showing 50 of ' + t.rows.length + ' rows; the download has all of them.</p>' : '') : '';
      return '<div class="fmp1-card p2-pad"><div class="p2-between"><div><span class="fmp1-eyebrow">' + esc(t.title) + (t.usesPeriod ? ' · ' + esc(p.label) : '') + '</span><p class="p2-small fmp1-muted" style="margin:4px 0 0">' + esc(t.about) + '</p></div>' +
        '<span class="p2-row"><button class="fmp1-btn fmp1-btn--quiet" data-rpopen="' + t.key + '" aria-expanded="' + open + '">' + (open ? 'Hide' : 'Look at it') + '</button><button class="fmp1-btn fmp1-btn--primary" data-rpdl="' + t.key + '"' + (t.rows.length ? '' : ' disabled') + '>Download CSV</button></span></div>' +
        '<div class="p2-row p2-small"><b>' + t.rows.length + ' row' + (t.rows.length === 1 ? '' : 's') + '</b>' + money.map(function (col) { return '<span>' + esc(col.label) + ': <b>' + c.money(t.totals[col.key]) + '</b></span>'; }).join('') + '</div>' +
        (t.key === 'jobs' ? '<label class="p2-row p2-small"><input type="checkbox" data-rpquotes' + (u.quotes ? ' checked' : '') + '> Include open and lost quotes</label>' : '') + preview + '</div>';
    }).join('');
    return '<div class="p2-head"><h1 class="fmp1-h p2-h1">Reports &amp; exports</h1><p class="p2-sub">For finance: jobs, invoices, payments, sales tax and change orders, as CSV files that open in Excel, Google Sheets or QuickBooks.</p></div>' +
      '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Period</span><button class="fmp1-btn" data-rpall>Download all ' + ts.filter(function (t) { return t.rows.length; }).length + '</button></div>' + chips +
      (u.msg ? '<div class="fmp1-note fmp1-note--info p2-small" role="status">' + esc(u.msg) + '</div>' : '') + '</div>' + cards +
      '<p class="p2-note">Money columns are plain numbers (10500.00) so spreadsheets can add them up; each file ends with a Total row. Sales tax inside a payment is the job\'s tax over its contract total. Overhead, payroll and bank balances stay in your accounting system.</p>';
  }

  /* one file: the page's download permission if it has one, else a normal browser download */
  function saveFile(name, text) {
    var use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
    return Promise.resolve(use).then(function (dl) {
      if (dl) return dl.save({ filename: name, data: text }).then(function () { return 'saved'; });
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return 'saved';
    });
  }
  function download(c, list) {
    var u = c.ui.rp, p = period(c), done = [], i = 0;
    function next() {
      if (i >= list.length) { u.msg = 'Downloaded ' + done.join(', ') + '.'; c.render(); return; }
      var t = list[i++], name = R.fileName(t, { from: p.from, to: p.to, today: c.TODAY });
      saveFile(name, R.toCSV(t)).then(function () { done.push(name); next(); }, function (er) {
        u.msg = er && er.code === 'declined' ? 'Download canceled' + (done.length ? ' after ' + done.join(', ') : '') + '.' : 'The download didn\'t go through (' + ((er && er.code) || 'error') + ').'; c.render();
      });
    }
    next();
  }

  function click(c, t) {
    var h = (location.hash || '').replace(/^#\/?/, '').split('/'); if (h[0] !== 'books' || h[1] !== 'exports') return false;
    var u = c.ui.rp = c.ui.rp || { key: 'month' }, d = t.dataset;
    if (d.rpperiod) { u.key = d.rpperiod; u.msg = null; c.render(); return true; }
    if (d.rpopen) { u.open = u.open === d.rpopen ? null : d.rpopen; c.render(); return true; }
    if (d.rpdl) { download(c, tables(c).filter(function (x) { return x.key === d.rpdl; })); return true; }
    if (t.hasAttribute('data-rpall')) { download(c, tables(c).filter(function (x) { return x.rows.length; })); return true; }
    return false;
  }
  function change(c, e) {
    var h = (location.hash || '').replace(/^#\/?/, '').split('/'); if (h[0] !== 'books' || h[1] !== 'exports') return false;
    var el = e.target, u = c.ui.rp = c.ui.rp || { key: 'month' };
    if (el.hasAttribute('data-rpfrom')) { u.from = el.value; c.render(); return true; }
    if (el.hasAttribute('data-rpto')) { u.to = el.value; c.render(); return true; }
    if (el.hasAttribute('data-rpquotes')) { u.quotes = el.checked; c.render(); return true; }
    return false;
  }

  window.P2Reports = { render: render, click: click, change: change };
  var appRoot = document.getElementById('p2');
  if (appRoot && window.P2) window.P2.render();
})();
