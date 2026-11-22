/*
 * Phase 2 preview · search from any page (window.P2Search). HANDOFF §41.
 *   A search box at the top of the menu. Type part of a name, job code, phone, email or address. Results are grouped
 *   (Projects, Customers, Designs) with a line saying where each stands, and what matched when it isn't the name.
 *   ↑ ↓ and Enter to open; "/" or Ctrl/Cmd+K from anywhere jumps to the box; Esc clears it.
 */
(function () {
  'use strict';
  var STAGE = { quote: 'Quote', contract_signed: 'Contract signed', deposit_paid: 'Deposit paid', factory_ordered: 'Factory ordered', delivered: 'Delivered', final_paid: 'Final payment', complete: 'Complete', lost: 'Lost' };
  var state = { q: '', sel: 0 };

  function norm(s) { return String(s || '').toLowerCase(); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  /* every searchable record: { group, title, sub, href, fields: [[label, value]] } */
  function records(c) {
    var out = [];
    c.store.jobs({ all: true }).forEach(function (j) {
      if (j.designTemplate) { out.push({ group: 'Designs', title: j.customer, sub: 'Design · ' + j.jobCode, href: '#/job/' + encodeURIComponent(j.jobCode) + '/elevations', fields: [['Name', j.customer], ['Code', j.jobCode]] }); return; }
      var k = j.contacts || {};
      out.push({ group: 'Projects', title: j.customer + (j.projectName ? ' · ' + j.projectName : ''), sub: (STAGE[j.stage] || j.stage) + (j.testVoid ? ' · test / void' : '') + ' · ' + j.jobCode + (j.salesperson ? ' · ' + j.salesperson : ''), href: '#/job/' + encodeURIComponent(j.jobCode) + '/overview',
        fields: [['Name', j.customer], ['Project', j.projectName], ['Job', j.jobCode], ['Signer', k.signer], ['Email', k.buyerEmail], ['Phone', k.phone], ['Address', j.installAddress]].concat((j.houses || []).map(function (h) { return ['House', h.jobCode + ' ' + h.name]; })) });
    });
    var custs = window.P2Customers && window.P2Customers.load ? window.P2Customers.load(c) : [];
    (custs || []).forEach(function (cu) {
      var f = [['Name', cu.name]];
      (cu.contacts || []).forEach(function (p) { f.push(['Contact', p.name]); f.push(['Email', p.email]); f.push(['Phone', p.phone]); });
      (cu.addresses || []).forEach(function (a) { f.push(['Address', a.line]); });
      out.push({ group: 'Customers', title: cu.name, sub: (cu.jobs ? cu.jobs.length + ' project' + (cu.jobs.length === 1 ? '' : 's') : 'Customer'), href: '#/customers/' + encodeURIComponent(cu.id || cu.name), fields: f });
    });
    return out;
  }
  function find(c, q) {
    var t = norm(q).trim(), d = digits(q); if (t.length < 2) return [];
    var hits = [];
    records(c).forEach(function (r) {
      var m = null;
      r.fields.some(function (f) { var v = f[1]; if (!v) return false;
        if (norm(v).indexOf(t) >= 0 || (d.length >= 4 && (f[0] === 'Phone') && digits(v).indexOf(d) >= 0)) { m = f; return true; } return false; });
      if (m) hits.push({ r: r, why: m[0] === 'Name' ? '' : m[0] + ': ' + m[1], score: norm(r.title).indexOf(t) === 0 ? 0 : m[0] === 'Name' ? 1 : 2 });
    });
    hits.sort(function (a, b) { return a.score - b.score; });
    return hits.slice(0, 12);
  }

  function box(c) {
    var esc = c.esc, hits = state.q ? find(c, state.q) : [], groups = {};
    hits.forEach(function (h, i) { h.i = i; (groups[h.r.group] = groups[h.r.group] || []).push(h); });
    var list = state.q.trim().length >= 2 ? (hits.length ? Object.keys(groups).map(function (g) {
      return '<li class="sr-group">' + esc(g) + '</li>' + groups[g].map(function (h) {
        return '<li><a class="sr-hit' + (h.i === state.sel ? ' is-sel' : '') + '" href="' + esc(h.r.href) + '" data-srhit><b>' + esc(h.r.title) + '</b><span>' + esc(h.r.sub) + '</span>' + (h.why ? '<span class="sr-why">' + esc(h.why) + '</span>' : '') + '</a></li>'; }).join('');
    }).join('') : '<li class="sr-none">Nothing matches "' + esc(state.q) + '".</li>') : '';
    return '<div class="sr-wrap" role="search"><input class="fmp1-input sr-input" type="search" data-srq value="' + esc(state.q) + '" placeholder="Search" aria-label="Search projects, customers and designs" autocomplete="off">' +
      (list ? '<ul class="sr-list" role="listbox">' + list + '</ul>' : '') + '</div>';
  }
  function refresh(c) {
    var el = document.querySelector('.sr-wrap'); if (!el) return;
    var had = document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-srq'), pos = had ? document.activeElement.selectionStart : null;
    el.outerHTML = box(c);
    if (had) { var i = document.querySelector('[data-srq]'); i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }
  function input(c, e) {
    if (!e.target.hasAttribute('data-srq')) return false;
    state.q = e.target.value; state.sel = 0; refresh(c); return true;
  }
  function click(c, t) {
    if (t.hasAttribute && t.hasAttribute('data-srhit')) { state.q = ''; state.sel = 0; return false; }   // let the link open; the box clears
    return false;
  }
  document.addEventListener('keydown', function (e) {
    var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
    if (((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k')) && document.querySelector('[data-srq]')) { e.preventDefault(); document.querySelector('[data-srq]').focus(); return; }
    if (!tg || !tg.hasAttribute || !tg.hasAttribute('data-srq') || !window.P2) return;
    var c = window.P2.ctx(), hits = find(c, state.q);
    if (e.key === 'Escape') { state.q = ''; refresh(c); return; }
    if (e.key === 'ArrowDown') { state.sel = Math.min(hits.length - 1, state.sel + 1); refresh(c); e.preventDefault(); }
    if (e.key === 'ArrowUp') { state.sel = Math.max(0, state.sel - 1); refresh(c); e.preventDefault(); }
    if (e.key === 'Enter' && hits[state.sel]) { var h = hits[state.sel].r.href; state.q = ''; state.sel = 0; location.hash = h; e.preventDefault(); }
  });
  document.addEventListener('click', function (e) { if (state.q && !(e.target.closest && e.target.closest('.sr-wrap')) && window.P2) { state.q = ''; refresh(window.P2.ctx()); } });

  window.P2Search = { box: box, input: input, click: click, find: function (q) { return find(window.P2.ctx(), q); } };
  if (window.P2) window.P2.render();
})();
