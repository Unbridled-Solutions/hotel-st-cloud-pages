/*
 * Phase 2 preview · Cabinet color picker (window.P2Colors). Uses FMColors. HANDOFF §44.
 *   A row of color chips (the shop's four plus the team's list) and "+ Add a color": search the Fremont Makers catalog
 *   (88 colors with chips) or make your own (name + color). Added colors go on the company list (settings.cabinetColors)
 *   and show up everywhere colors are picked: New design and the Elevations sketch.
 */
(function () {
  'use strict';
  var C = window.FMColors;
  function list(c) { return (c.store.settings ? c.store.settings() : {}).cabinetColors || []; }
  function U(c) { return c.ui.col || (c.ui.col = {}); }

  /* attr: the data attribute the chips carry (without data-), handled by the page that shows the picker. */
  function picker(c, current, attr, opts) {
    opts = opts || {}; var esc = c.esc, u = U(c), dis = opts.disabled ? ' disabled' : '', open = u.open === attr;
    var chips = C.choices(list(c)), have = chips.some(function (x) { return x.key === current; });
    if (current && !have && C.get(current)) chips.push({ key: current, name: C.short(current), hex: C.hex(current) });
    var html = '<div class="cl-chips" role="group" aria-label="Cabinet color">' + chips.map(function (x) {
      return '<button type="button" class="cl-chip" data-' + attr + '="' + esc(x.key) + '" aria-pressed="' + (x.key === current) + '"' + dis + '><i style="background:' + esc(x.hex) + '"></i>' + esc(x.name) + '</button>'; }).join('') +
      (opts.disabled ? '' : '<button type="button" class="cl-chip cl-add" data-coladd="' + esc(attr) + '" aria-expanded="' + open + '">+ Add a color</button>') + '</div>';
    if (open && !opts.disabled) html += panel(c, attr);
    return html;
  }
  function grid(c) {
    var esc = c.esc, u = U(c), found = C.search(u.q, list(c));
    return found.length ? found.slice(0, 60).map(function (x) {
      return '<button type="button" class="cl-cat" data-colpick="' + esc(x.key) + '" title="Add ' + esc(x.name) + '"><i style="background:' + esc(x.hex) + '"></i><b>' + esc(x.name) + '</b><span>' + esc(x.collection) + ' collection</span></button>'; }).join('') +
      (found.length > 60 ? '<p class="p2-small fmp1-faint">' + (found.length - 60) + ' more. Type to narrow it down.</p>' : '')
      : '<p class="p2-small fmp1-muted">No catalog colors match. Make your own below.</p>';
  }
  function panel(c, attr) {
    var esc = c.esc, u = U(c), can = c.me().access === 'full';
    if (!can) return '<div class="cl-panel"><p class="p2-small">Only someone with Full access can add colors. Ask the owner.</p></div>';
    return '<div class="cl-panel" role="region" aria-label="Add a cabinet color"><div class="p2-between"><b>Add a color from the Fremont Makers catalog</b><button type="button" class="fmp1-btn fmp1-btn--quiet" data-coladd="' + esc(attr) + '">Done</button></div>' +
      '<input class="fmp1-input" type="search" data-colq placeholder="Search colors: white, sage, hickory, Lancaster…" value="' + esc(u.q || '') + '" aria-label="Search catalog colors">' +
      '<div class="cl-grid" data-colgrid>' + grid(c) + '</div>' +
      '<details class="cl-own"' + (u.ownOpen ? ' open' : '') + '><summary class="p2-small"><b>Not in the catalog? Make your own</b></summary><div class="p2-form">' +
        '<label class="p2-fld"><span>Name</span><input class="fmp1-input" data-colname value="' + esc(u.name || '') + '" placeholder="Sherwin-Williams Urbane Bronze"></label>' +
        '<label class="p2-fld"><span>Color</span><input type="color" class="cl-picker" data-colhex value="' + esc(u.hex || '#9a8f80') + '"></label>' +
        '<button type="button" class="fmp1-btn fmp1-btn--primary" data-colown>Add it</button></div></details>' +
      (u.err ? '<p class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(u.err) + '</p>' : '') +
      '<p class="p2-small fmp1-faint">Chips are matched from the door photos on fremontmakers.com/catalog. Added colors are on everyone\'s list.</p></div>';
  }
  function save(c, attr, r) {
    var u = U(c);
    if (!r.ok) { u.err = r.error; c.render(); return true; }
    var s = c.store.saveSetting('cabinetColors', r.list, c.me(), new Date().toISOString());
    if (!s.ok) { u.err = s.error; c.render(); return true; }
    C.use(r.list); c.ui.col = { open: null }; c.render();
    var chip = document.querySelector('[data-' + attr + '="' + r.key + '"]'); if (chip) chip.click();   // and pick it
    return true;
  }
  function click(c, t) {
    var d = t.dataset, u = U(c);
    if (d.coladd != null && t.hasAttribute('data-coladd')) { c.ui.col = u.open === d.coladd ? { open: null } : { open: d.coladd }; c.render(); var q = document.querySelector('[data-colq]'); if (q) q.focus(); return true; }
    if (d.colpick) return save(c, u.open, C.add(list(c), d.colpick));
    if (t.hasAttribute('data-colown')) { u.ownOpen = true; return save(c, u.open, C.add(list(c), { name: u.name, hex: u.hex || '#9a8f80' })); }
    return false;
  }
  function input(c, e) {
    var el = e.target, u = U(c);
    if (el.hasAttribute('data-colq')) { u.q = el.value; var g = document.querySelector('[data-colgrid]'); if (g) g.innerHTML = grid(c); return true; }
    if (el.hasAttribute('data-colname')) { u.name = el.value; u.err = null; return true; }
    if (el.hasAttribute('data-colhex')) { u.hex = el.value; return true; }
    return false;
  }

  window.P2Colors = { picker: picker, click: click, input: input };
  if (window.P2) window.P2.render();
})();
