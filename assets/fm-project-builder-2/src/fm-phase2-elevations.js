/*
 * FMElev: cabinet elevations for the Project Builder (Phase 2). Pure functions, no DOM.
 *
 *   parseSku(sku, sizes)            what a supplier SKU is and its size, read from the code (W3042 = wall cabinet 30″ wide, 42″ tall)
 *   layoutWall(wall, sizes, opts)   lines cabinets up left to right, base and upper runs, and lists any problems
 *   layoutRoom(room, sizes)         every wall of a room, with corners worked out between neighboring walls
 *   svgPlan(room layouts, opts)     top-down floor plan with measurements (SVG string)
 *   reconcile(lines, rooms, sizes)  quoted SKUs vs SKUs placed on the walls
 *   autoPlace(wall, lines, rooms, sizes)  adds the cabinets not placed yet to a wall, as many as fit
 *   moveItem(wall, id, x, sizes)    drag and drop: into open space it lands at x (snapped); onto other cabinets it reorders and they close up
 *   svgElevation(layout, opts)      front elevation drawing with measurements (SVG string)
 *   svg3D(room layouts, opts)       3D view of a room (SVG string), turned with opts.yaw / opts.pitch
 *   trimCheck(lines, layouts)       crown molding and toe kick: feet quoted vs about how much the drawings need
 *   sizesFromLines(lines)           sizes the supplier PDF listed (line.width / height / depth), used before the code is read
 *   inches(n), feetInches(n)        34.5 → 34 1/2″ · 99 → 8′ 3″
 *
 * Sizes are in inches. Sizes the code can't confirm come back with sure: false so staff check them once;
 * what they enter is kept on the job (job.elevations.sizes) and used from then on.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMElev = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.3.0';

  var STD = { ceiling: 96, soffit: 0, toeKick: 4.5, baseHeight: 34.5, counter: 1.5, gapToUppers: 18 };
  var DEPTH = { base: 24, wall: 12, vanity: 21, tall: 24 };
  var CORNER = { base: 24, upper: 12 };   // what a wall's cabinets take out of the corner they run into

  var APPLIANCES = {
    range:      { label: 'Range',        w: 30, h: 36,   d: 26, layer: 'base',  counter: false },
    dishwasher: { label: 'Dishwasher',   w: 24, h: 34.5, d: 24, layer: 'base',  counter: true },
    fridge:     { label: 'Refrigerator', w: 36, h: 70,   d: 30, layer: 'base',  counter: false },
    washer:     { label: 'Washer / dryer', w: 27, h: 39, d: 30, layer: 'base',  counter: false },
    hood:       { label: 'Range hood',   w: 30, h: 18,   d: 20, layer: 'upper' },
    microwave:  { label: 'Microwave',    w: 30, h: 18,   d: 15, layer: 'upper' },
    space:      { label: 'Open space',   w: 24, h: 0,    d: 0,  layer: 'base',  counter: false },
    upperSpace: { label: 'Open space',   w: 24, h: 0,    d: 0,  layer: 'upper' }
  };

  function n(s) { return +s; }
  function splitSku(sku) {
    var s = String(sku || '').trim().toUpperCase();
    // Buy Wholesale Cabinets puts the 2-letter colorway first: SW-U188424 is White Shaker, utility 18″ × 84″ × 24″ (SW-TKC is toe kick).
    var pre = s.match(/^([A-Z]{2})-([A-Z0-9][A-Z0-9.()\-]*)$/);
    if (pre && RULES.some(function (r) { return r[0].test(pre[2]); })) return { code: pre[2], color: pre[1], brand: 'bwc' };
    var m = s.match(/^(.*?)-([A-Z]{3})$/);
    return m ? { code: m[1], color: m[2] } : { code: s, color: '' };
  }

  /* Each rule: [pattern, function (match) → spec]. First match wins. */
  var RULES = [
    [/^BBC(\d{2})[LR]?$/, function (m) { return { kind: 'base', w: n(m[1]), label: 'Blind corner base', style: 'combo', corner: 'blind', foot: DEPTH.base }; }],
    [/^WBC(\d{2})(\d{2})[LR]?$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: DEPTH.wall, label: 'Blind corner wall', style: 'doors', corner: 'blind', foot: DEPTH.wall }; }],
    [/^(LS|BLS|LSB)(\d{2})$/, function (m) { var s = n(m[2]); return { kind: 'base', w: s, d: s, label: 'Lazy Susan corner base', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^ERB(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'base', w: s, d: s, label: 'Easy reach corner base', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^CSB(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'base', w: s, d: s, label: 'Corner sink base', style: 'sink', corner: 'diagonal', foot: s }; }],
    [/^DCSF(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'base', w: s, d: s, label: 'Corner sink base front', style: 'sink', corner: 'diagonal', foot: s, sure: false, note: 'A corner sink front; goes with the SBF floor. Read as ' + s + '″ each way.' }; }],
    [/^DCW(\d{2})(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'wall', w: s, h: n(m[2]), d: s, label: 'Diagonal corner wall', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^WER(\d{2})(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'wall', w: s, h: n(m[2]), d: s, label: 'Easy reach corner wall', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^AW(\d{2})(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: DEPTH.wall, label: 'Angle wall cabinet (end of run)', style: 'doors' }; }],
    [/^MO(\d{2})(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: DEPTH.wall, label: 'Microwave wall cabinet', style: 'doors' }; }],
    [/^WSD(\d)(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[2]), h: n(m[1]), d: DEPTH.wall, label: 'Wall spice drawers', style: 'drawers', drawers: 1 }; }],
    [/^WD(\d{2})(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: DEPTH.wall, label: 'Wall tower cabinet', style: 'doors' }; }],
    [/^(PR|WRC)(\d{2})(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[2]), h: n(m[3]), d: DEPTH.wall, label: m[1] === 'PR' ? 'Plate rack' : 'Wine rack', style: 'doors' }; }],
    [/^OE(\d)(\d{2})$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: DEPTH.wall, label: 'Open end shelf', style: 'panel' }; }],
    [/^(DCB|BDC|CB)(\d{2})$/, function (m) { var s = n(m[2]); return { kind: 'base', w: s, d: s, label: 'Diagonal corner base', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^WDC(\d{2})(\d{2})$/, function (m) { var s = n(m[1]); return { kind: 'wall', w: s, h: n(m[2]), d: s, label: 'Diagonal corner wall', style: 'corner', corner: 'diagonal', foot: s }; }],
    [/^WC?(\d{2})(\d{2})(\d{2})?(GD)?$/, function (m) { return { kind: 'wall', w: n(m[1]), h: n(m[2]), d: m[3] ? n(m[3]) : DEPTH.wall, label: m[4] ? 'Wall cabinet, glass doors' : 'Wall cabinet', style: 'doors' }; }],
    [/^WF(\d)(\d{2})$/, function (m) { return { kind: 'filler', layer: 'upper', w: n(m[1]), h: n(m[2]), d: 0.75, label: 'Wall filler', style: 'filler' }; }],
    [/^F(\d)(\d{2})$/, function (m) { var h = n(m[2]); if (h >= 84) return { kind: 'filler', layer: 'base', w: n(m[1]), h: h, d: 0.75, label: 'Tall filler', style: 'filler' };
      return { kind: 'filler', layer: h >= 24 ? 'upper' : 'base', w: n(m[1]), h: h >= 24 ? h : STD.baseHeight, d: 0.75, label: 'Filler', style: 'filler' }; }],
    [/^DWR(\d)$/, function (m) { return { kind: 'filler', layer: 'base', w: n(m[1]), h: STD.baseHeight, d: 0.75, label: 'Dishwasher return panel', style: 'filler' }; }],
    [/^REPV(\d{2})(\d{2})$/, function (m) { return { kind: 'panel', layer: 'base', w: 1.5, h: n(m[2]), d: n(m[1]), label: 'Refrigerator end panel', style: 'panel' }; }],
    [/^BF(\d)$/, function (m) { return { kind: 'filler', layer: 'base', w: n(m[1]), h: STD.baseHeight, d: 0.75, label: 'Base filler', style: 'filler' }; }],
    [/^SB(\d{2})$/, function (m) { return { kind: 'base', w: n(m[1]), label: 'Sink base', style: 'sink' }; }],
    [/^FSB(\d{2})$/, function (m) { return { kind: 'base', w: n(m[1]), label: 'Farmhouse sink base', style: 'sink' }; }],
    [/^BFH(\d{2})$/, function (m) { return { kind: 'base', w: n(m[1]), label: 'Base, full-height door' + (n(m[1]) >= 24 ? 's' : ''), style: 'doors' }; }],
    [/^(BWB|MB|BT|SPB|BES|BEC|DFB)(\d{1,2})$/, function (m) {
      var L = { BWB: 'Waste basket base', MB: 'Microwave base', BT: 'Base tray', SPB: 'Spice pull base', BES: 'Base end shelf', BEC: 'Angled base end', DFB: 'File drawer base' }[m[1]];
      return { kind: 'base', w: n(m[2]), d: m[1] === 'DFB' ? 21 : DEPTH.base, label: L, style: m[1] === 'BWB' || m[1] === 'DFB' || m[1] === 'SPB' ? 'drawers' : 'doors', drawers: m[1] === 'BWB' || m[1] === 'DFB' ? 2 : 1 }; }],
    [/^BSDC(\d)$/, function () { return { kind: 'base', w: 12, label: 'Base spice drawers', style: 'drawers', drawers: 5 }; }],
    [/^BC?(\d{2})$/, function (m) { var w = n(m[1]); return { kind: 'base', w: w, label: 'Base cabinet', style: 'combo' }; }],
    [/^(\d)DB(\d{2})$/, function (m) { return { kind: 'base', w: n(m[2]), label: m[1] + '-drawer base', style: 'drawers', drawers: n(m[1]) }; }],
    [/^DC(\d)(\d{2})$/, function (m) { return { kind: 'base', w: n(m[2]), label: m[1] + '-drawer base', style: 'drawers', drawers: n(m[1]), sure: false, note: 'Read as a ' + m[1] + '-drawer base ' + m[2] + '″ wide.' }; }],
    [/^PWB(\d{2})K?$/, function (m) { return { kind: 'base', w: n(m[1]), label: 'Pull-out waste base', style: 'drawers', drawers: 1, sure: false, note: 'Read as a base ' + m[1] + '″ wide.' }; }],
    [/^VSB?(\d{2})S?$/, function (m) { return { kind: 'vanity', w: n(m[1]), label: 'Vanity sink base', style: 'sink' }; }],
    [/^(\d)VDB(\d{2})$/, function (m) { return { kind: 'vanity', w: n(m[2]), label: m[1] + '-drawer vanity base', style: 'drawers', drawers: n(m[1]) }; }],
    [/^VSD(\d{2})$/, function (m) { return { kind: 'vanity', w: n(m[1]), label: 'Vanity sink base with drawers', style: 'sink' }; }],
    [/^V(\d{2})(\d{2})D([LR])$/, function (m) { return { kind: 'vanity', w: n(m[1]), d: n(m[2]), label: 'Vanity combo, drawers ' + (m[3] === 'L' ? 'left' : 'right'), style: 'sink' }; }],
    [/^VDC(\d{2})$/, function (m) { return { kind: 'vanity', w: n(m[1]), label: 'Vanity drawer base', style: 'drawers', drawers: 3 }; }],
    [/^VDC(\d{2})(RS|LS)$/, function (m) { return { kind: 'vanity', w: n(m[1]), label: 'Vanity, sink ' + (m[2] === 'RS' ? 'right' : 'left'), style: 'sink', sure: false, note: 'Read as a vanity ' + m[1] + '″ wide.' }; }],
    [/^(U|P|PC|OV|O)(\d{2})(\d{2})(\d{2})?$/, function (m) { return { kind: 'tall', w: n(m[2]), h: n(m[3]), d: m[4] ? n(m[4]) : DEPTH.tall, label: m[1] === 'OV' || m[1] === 'O' ? 'Oven pantry' : m[1] === 'U' ? 'Utility pantry' : 'Pantry', style: 'tall' }; }],
    [/^FPV(\d{2})(\d{2})$/, function (m) { return { kind: 'trim', label: 'Finish plywood panel ' + n(m[1]) + '″ × ' + n(m[2]) + '″, 1/4″ (applied to an end)' }; }],
    [/^FP(\d{2})(\d{2})(?:-([\d.]+))?$/, function (m) { return { kind: 'panel', layer: 'base', w: m[3] ? n(m[3]) : 0.75, h: n(m[1]), d: n(m[2]), label: 'Finished end panel', style: 'panel', sure: false, note: 'Read as a panel ' + m[1] + '″ tall, ' + m[2] + '″ deep.' }; }],
    [/^(TK|TKC|TUK|TU|SM|ACM|LACM|OCM|SCR|CM|BM|QR|OSM|LR|DWP|WSV|BSV|USV|RCM|BCM|COV|FBM|ALRM|LRM|SHM|BAM|ROPE|DMTIS|TDEP|WDEP|BDEP|VDEP|SBF|VA|RS|FS|SD)\d*S?(\(.*\))?$/, function () { return { kind: 'trim', label: 'Trim or accessory' }; }],
    [/^S(\d{2})(\d{2})$/, function () { return { kind: 'trim', label: 'Skin panel' }; }]
  ];

  /* Buy Wholesale Cabinets 2026 catalog: the blind corner base box is 3″ narrower than its code (BBC42 is 39″ wide) and
     installs in the code's width with a filler; the angled base end is 24″ on each angled side. */
  var BWC = {
    BBC36: { w: 33, note: 'Box 33″ wide; installs in 36–39″ with a filler (catalog).' },
    BBC39: { w: 36, note: 'Box 36″ wide; installs in 39–42″ with a filler (catalog).' },
    BBC42: { w: 39, note: 'Box 39″ wide; installs in 42–45″ with a filler (catalog).' }
  };
  function parseSku(sku, sizes) {
    var p = splitSku(sku), spec = null;
    for (var i = 0; i < RULES.length && !spec; i++) { var m = p.code.match(RULES[i][0]); if (m) spec = RULES[i][1](m); }
    if (spec && p.brand === 'bwc' && BWC[p.code]) { Object.keys(BWC[p.code]).forEach(function (k) { spec[k] = BWC[p.code][k]; }); }
    spec = spec || { kind: 'unknown', label: 'Unknown item', sure: false, note: 'Size not in the code. Enter it once.' };
    spec.sku = String(sku); spec.code = p.code; spec.color = p.color;
    if (spec.sure === undefined) spec.sure = true;
    var o = sizes && sizes[p.code];
    if (o) {
      ['kind', 'w', 'h', 'd', 'label', 'style', 'drawers'].forEach(function (k) { if (o[k] != null && o[k] !== '') spec[k] = o[k]; });
      spec.sure = true; spec.note = o.source === 'pdf' ? 'Size from the supplier PDF.' : 'Size entered by staff.';
    }
    if (spec.kind === 'base') { spec.h = spec.h || STD.baseHeight; spec.d = spec.d || DEPTH.base; }
    if (spec.kind === 'vanity') { spec.h = spec.h || STD.baseHeight; spec.d = spec.d || DEPTH.vanity; }
    if (!spec.layer) spec.layer = spec.kind === 'wall' ? 'upper' : spec.kind === 'trim' ? 'none' : spec.kind === 'unknown' ? (spec.w ? 'base' : 'none') : 'base';
    spec.counter = spec.kind === 'base' || spec.kind === 'vanity' || (spec.kind === 'filler' && spec.layer === 'base');
    spec.drawn = spec.layer !== 'none' && !!spec.w;
    return spec;
  }
  function describe(spec) {
    if (!spec.w) return spec.label;
    return spec.label + ' ' + inches(spec.w) + ' wide' + (spec.h && spec.kind !== 'base' && spec.kind !== 'vanity' ? ', ' + inches(spec.h) + ' tall' : '');
  }

  /* ---------- formatting ---------- */
  function inches(x) {
    if (x == null || isNaN(x)) return '—';
    var neg = x < 0; x = Math.abs(x);
    var whole = Math.floor(x + 1e-9), frac = Math.round((x - whole) * 16);
    if (frac === 16) { whole++; frac = 0; }
    var den = 16; while (frac && frac % 2 === 0) { frac /= 2; den /= 2; }
    return (neg ? '−' : '') + (whole || !frac ? whole : '') + (frac ? (whole ? ' ' : '') + frac + '/' + den : '') + '″';
  }
  function feetInches(x) {
    var ft = Math.floor((x + 1e-9) / 12), rest = x - ft * 12;
    return ft ? ft + '′ ' + inches(rest) : inches(rest);
  }

  /* ---------- layout ---------- */
  function specsOf(wall) {
    var s = {}; Object.keys(STD).forEach(function (k) { s[k] = wall && wall.specs && wall.specs[k] != null && wall.specs[k] !== '' ? +wall.specs[k] : STD[k]; });
    return s;
  }
  function itemSpec(it, sizes) {
    if (it.appliance) {
      var a = APPLIANCES[it.appliance] || APPLIANCES.space;
      return { kind: 'appliance', appliance: it.appliance, layer: a.layer, label: it.label || a.label, w: +it.w || a.w, h: it.h != null && it.h !== '' ? +it.h : a.h, d: a.d, counter: !!a.counter,
        style: it.appliance, drawn: true, sure: true, code: '', sku: '' };
    }
    return parseSku(it.sku, sizes);
  }
  function overlaps(a0, a1, b0, b1) { return a0 < b1 - 1e-6 && b0 < a1 - 1e-6; }

  function layoutWall(wall, sizes, opts) {
    opts = opts || {};
    var s = specsOf(wall), L = +wall.lengthIn || 0, ceil = s.ceiling, issues = [];
    var resL = opts.reserveLeft || { base: wall.cornerLeft ? CORNER.base : 0, upper: wall.cornerLeft ? CORNER.upper : 0 };
    var resR = opts.reserveRight || { base: wall.cornerRight ? CORNER.base : 0, upper: wall.cornerRight ? CORNER.upper : 0 };
    var upperItems = (wall.upper || []).map(function (it) { return itemSpec(it, sizes); });
    var island = (wall.position || 'back') === 'island';
    var upperBottomStd = s.baseHeight + s.counter + s.gapToUppers;
    // Uppers hang from one top line: the tallest full-height upper (30″ or more) on the wall, or 42″ when the ceiling allows it,
    // so a short cabinet over a fridge or range lines up with the rest.
    var tallest = upperItems.reduce(function (m, sp) { return sp.kind === 'wall' && sp.h >= 30 ? Math.max(m, sp.h) : m; }, 0) ||
      (ceil - s.soffit - upperBottomStd >= 42 ? 42 : 30);
    var upperTop = Math.min(ceil - s.soffit, upperBottomStd + tallest);

    var base = [], cur = resL.base;
    (wall.base || []).forEach(function (it, i) {
      var sp = itemSpec(it, sizes), w = sp.w || 0;
      var x = cur + (+it.gapBefore || 0);
      var h = sp.kind === 'appliance' ? sp.h : sp.h || s.baseHeight;
      if (sp.kind === 'base' || sp.kind === 'vanity' || (sp.kind === 'filler')) h = sp.kind === 'filler' ? (sp.h || s.baseHeight) : s.baseHeight;
      var p = place(it, sp, i, 'base', x, w, 0, h);
      if (!sp.w) issues.push({ level: 'error', item: it.id, text: 'Enter the size for ' + (sp.code || sp.label) + ' before it can be drawn.' });
      else if (sp.layer === 'upper') issues.push({ level: 'error', item: it.id, text: (sp.code || sp.label) + ' is an upper; move it to the upper run.' });
      if (h > ceil - s.soffit + 1e-6) issues.push({ level: 'error', item: it.id, text: (sp.code || sp.label) + ' is ' + inches(h) + ' tall; only ' + inches(ceil - s.soffit) + ' fits under the ' + (s.soffit ? 'soffit' : 'ceiling') + '.' });
      base.push(p); cur = x + w;
    });
    var upper = [], ucur = resL.upper;
    (wall.upper || []).forEach(function (it, i) {
      var sp = upperItems[i], w = sp.w || 0, h = sp.h || 0, lift = +it.topOffset || 0;
      var y0 = upperTop + lift - h;   // staggered uppers: raise or lower one cabinet's top
      if (lift && upperTop + lift > ceil - s.soffit + 1e-6) issues.push({ level: 'error', item: it.id, text: (sp.code || sp.label) + ' would go ' + inches(upperTop + lift - (ceil - s.soffit)) + ' past the ' + (s.soffit ? 'soffit' : 'ceiling') + '.' });
      var x = ucur + (+it.gapBefore || 0), moved = true, guard = 0;
      while (moved && guard++ < 50) {   // step past anything below that reaches up into this cabinet (a pantry, a tall fridge)
        moved = false;
        for (var b = 0; b < base.length; b++) {
          var q = base[b];
          if (q.y + q.h > y0 + 1e-6 && overlaps(x, x + w, q.x, q.x + q.w)) { x = q.x + q.w; moved = true; }
        }
      }
      if (!sp.w) issues.push({ level: 'error', item: it.id, text: 'Enter the size for ' + (sp.code || sp.label) + ' before it can be drawn.' });
      else if (sp.layer !== 'upper') issues.push({ level: 'error', item: it.id, text: (sp.code || sp.label) + ' sits on the floor; move it to the base run.' });
      if (h && y0 < s.baseHeight + s.counter + 12 - 1e-6) issues.push({ level: 'warn', item: it.id, text: (sp.code || sp.label) + ' hangs ' + inches(y0 - s.baseHeight - s.counter) + ' over the counter; 15″ or more is usual.' });
      var pu = place(it, sp, i, 'upper', x, w, y0, h); pu.lift = lift; upper.push(pu); ucur = x + w;
    });
    if (island && upper.length) issues.push({ level: 'warn', text: 'An island has no wall for uppers; remove them or move them to a wall.' });

    function runCheck(list, name, limit, start) {
      var drawn = list.filter(function (p) { return p.w > 0; });
      if (!drawn.length) return { used: 0, open: limit - start };
      var end = Math.max.apply(null, drawn.map(function (p) { return p.x + p.w; }));
      var open = limit - end;
      if (open < -1e-6) issues.push({ level: 'error', text: 'The ' + name + ' run is ' + inches(-open) + ' too long for this wall.' });
      else if (open > 1e-6 && open <= 6) issues.push({ level: 'warn', text: inches(open) + ' left at the right end of the ' + name + ' run. Add a filler or a space.' });
      return { used: end - start, open: open };
    }
    var rb = runCheck(base, 'base', L - resR.base, resL.base), ru = runCheck(upper, 'upper', L - resR.upper, resL.upper);
    base.concat(upper).forEach(function (p) {
      if (!p.corner || !p.w) return;
      var r = p.run, atL = p.x <= (r === 'base' ? resL.base : resL.upper) + 0.01, atR = p.x + p.w >= L - (r === 'base' ? resR.base : resR.upper) - 0.01;
      p.cornerEnd = atL ? 'left' : atR ? 'right' : null;
      if (!p.cornerEnd) issues.push({ level: 'warn', item: p.id, text: (p.code || p.label) + ' is a corner cabinet; move it to the end of the run that meets the corner.' });
    });

    (wall.openings || []).forEach(function (o) {
      var ox0 = +o.fromLeft || 0, ox1 = ox0 + (+o.width || 0), oy0 = o.kind === 'door' ? 0 : (+o.fromFloor || 0), oy1 = oy0 + (+o.height || 0);
      if (ox1 > L + 1e-6) issues.push({ level: 'error', text: (o.kind === 'door' ? 'Door' : 'Window') + ' runs past the end of the wall.' });
      base.concat(upper).forEach(function (p) {
        if (p.w && p.h && overlaps(p.x, p.x + p.w, ox0, ox1) && overlaps(p.y, p.y + p.h, oy0, oy1))
          issues.push({ level: 'error', item: p.id, text: (p.code || p.label) + ' covers the ' + (o.kind === 'door' ? 'door' : 'window') + '.' });
      });
    });
    base.forEach(function (p) {
      if (p.w && p.kind !== 'appliance') {
        var dup = base.filter(function (q) { return q !== p && q.w && overlaps(p.x, p.x + p.w, q.x, q.x + q.w); });
        if (dup.length && p.index < dup[0].index) issues.push({ level: 'error', item: p.id, text: (p.code || p.label) + ' overlaps ' + (dup[0].code || dup[0].label) + '.' });
      }
    });
    var crown = wall.crown === 'on' ? true : wall.crown === 'off' ? false : !!opts.crownDefault;
    return { island: island, crown: crown && !island, crownH: 3.5, lengthIn: L, specs: s, ceiling: ceil, upperTop: upperTop, upperBottomStd: upperBottomStd, base: base, upper: upper,
      reserve: { left: resL, right: resR, leftLabel: opts.leftLabel || '', rightLabel: opts.rightLabel || '' }, used: { base: rb.used, upper: ru.used }, open: { base: rb.open, upper: ru.open }, issues: issues,
      openings: (wall.openings || []).map(function (o) { return { kind: o.kind === 'door' ? 'door' : 'window', x: +o.fromLeft || 0, w: +o.width || 0, y: o.kind === 'door' ? 0 : (+o.fromFloor || 0), h: +o.height || 0 }; }),
      // outlets and plumbing from a field measure: drawn on top of the cabinets so they can be checked against them
      marks: (wall.marks || []).map(function (k) { return { kind: k.kind, x: +k.fromLeft || 0, y: +k.fromFloor || 0 }; }), measured: !!wall.measured };
  }
  function place(it, sp, i, run, x, w, y, h) {
    return { id: it.id, index: i, run: run, sku: sp.sku, code: sp.code, label: sp.label, kind: sp.kind, appliance: sp.appliance || null, style: sp.style, drawers: sp.drawers || 0,
      counter: !!sp.counter, x: x, w: w, y: y, h: h, d: sp.d || (run === 'upper' ? DEPTH.wall : DEPTH.base), sure: sp.sure, corner: sp.corner || null, foot: sp.foot || 0 };
  }

  /* ---------- rooms: corners between neighboring walls ---------- */
  // Which end of which wall meets each end of a wall (looking at each wall from inside the room).
  var MEETS = {
    back:  { left: ['left', 'right'],  right: ['right', 'left'] },
    left:  { right: ['back', 'left'],  left: ['front', 'right'] },
    right: { left: ['back', 'right'],  right: ['front', 'left'] },
    front: { right: ['left', 'left'],  left: ['right', 'right'] }
  };
  function layoutRoom(room, sizes, common) {
    common = common || {};
    function withCommon(o) { var r = {}; Object.keys(common).forEach(function (k) { r[k] = common[k]; }); Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; }); return r; }
    var walls = (room && room.walls) || [], byPos = {};
    var first = walls.map(function (w) { var p = w.position || 'back'; if (!byPos[p] && p !== 'island') byPos[p] = w; return { wall: w, position: p, layout: layoutWall(w, sizes, common) }; });
    var res = {};   // wallId → { left: {base, upper, label}, right: {...} }
    first.forEach(function (x) {
      x.layout.base.concat(x.layout.upper).forEach(function (p) {
        if (!p.corner || !p.cornerEnd) return;
        var m = MEETS[x.position] && MEETS[x.position][p.cornerEnd], nb = m && byPos[m[0]]; if (!nb || nb === x.wall) return;
        var r = res[nb.id] = res[nb.id] || {}, e = r[m[1]] = r[m[1]] || { base: 0, upper: 0, label: x.wall.name };
        e[p.run] = Math.max(e[p.run], p.foot || (p.run === 'base' ? CORNER.base : CORNER.upper));
      });
    });
    var out = first.map(function (x) {
      var r = res[x.wall.id], opts = {};
      ['left', 'right'].forEach(function (end) {
        var flag = end === 'left' ? x.wall.cornerLeft : x.wall.cornerRight, auto = r && r[end];
        if (auto) {
          opts['reserve' + (end === 'left' ? 'Left' : 'Right')] = { base: Math.max(auto.base, flag ? CORNER.base : 0), upper: Math.max(auto.upper, flag ? CORNER.upper : 0) };
          opts[end + 'Label'] = auto.label;
        }
      });
      opts = withCommon(opts);
      return { wall: x.wall, position: x.position, opts: opts, layout: layoutWall(x.wall, sizes, opts) };
    });
    // two walls whose base cabinets both run into the same corner
    out.forEach(function (x) {
      ['left', 'right'].forEach(function (end) {
        var m = MEETS[x.position] && MEETS[x.position][end]; if (!m) return;
        var nb = out.filter(function (o) { return o.position === m[0] && o.wall !== x.wall; })[0]; if (!nb) return;
        if (x.position > nb.position) return;   // report each corner once
        function touches(o, e2) {
          var L = o.layout, r = L.reserve[e2].base; if (r) return false;
          return L.base.some(function (p) { return p.w && p.kind !== 'appliance' && (e2 === 'left' ? p.x <= 0.01 : p.x + p.w >= L.lengthIn - 0.01); });
        }
        if (touches(x, end) && touches(nb, m[1])) {
          var txt = 'Cabinets on ' + x.wall.name + ' and ' + nb.wall.name + ' both run into the same corner. Use a corner cabinet, or mark one end as a corner.';
          x.layout.issues.push({ level: 'error', text: txt }); nb.layout.issues.push({ level: 'error', text: txt });
        }
      });
    });
    roomChecks(out);
    return out;
  }

  /* ---------- layout checks: advice from common kitchen planning rules, kept apart from the hard errors ---------- */
  var RULE = { rangeLanding: [12, 15], fridgeLanding: 15, sinkLanding: [18, 24], dwToSink: 36, hoodClear: 30, walkway: 42, walkwayTight: 36 };
  function isSink(p) { return p.style === 'sink' && (p.kind === 'base' || p.kind === 'vanity'); }
  /* Counter on each side of an item: the cabinets touching it that carry a countertop, plus a corner cabinet at the wall end. */
  function landing(lay, p) {
    function segs() {
      var a = lay.base.filter(function (q) { return q !== p && q.w && q.counter; }).map(function (q) { return [q.x, q.x + q.w]; });
      if (lay.reserve.left.base) a.push([0, lay.reserve.left.base]);
      if (lay.reserve.right.base) a.push([lay.lengthIn - lay.reserve.right.base, lay.lengthIn]);
      return a;
    }
    function walk(edge, dir) {
      var list = segs(), total = 0, found = true;
      while (found) {
        found = false;
        for (var i = 0; i < list.length; i++) {
          var g = list[i];
          if (Math.abs((dir < 0 ? g[1] : g[0]) - edge) < 0.5) { total += g[1] - g[0]; edge = dir < 0 ? g[0] : g[1]; list.splice(i, 1); found = true; break; }
        }
      }
      return total;
    }
    return { left: walk(p.x, -1), right: walk(p.x + p.w, 1) };
  }
  function nm(p) { return p.kind === 'appliance' ? p.label : (p.code || p.label); }
  function roomChecks(R) {
    var sinks = [];
    R.forEach(function (x) { x.layout.checks = []; x.layout.base.forEach(function (p) { if (p.w && isSink(p)) sinks.push({ x: x, p: p }); }); });
    R.forEach(function (x) {
      var lay = x.layout, out = lay.checks, s = lay.specs, top = s.baseHeight + s.counter;
      function add(level, p, rule, text) { out.push({ level: level, item: p ? p.id : null, rule: rule, text: text }); }
      lay.base.forEach(function (p) {
        if (!p.w) return;
        var g = landing(lay, p), lo = Math.min(g.left, g.right), hi = Math.max(g.left, g.right);
        var sides = inches(g.left) + ' of counter on the left, ' + inches(g.right) + ' on the right';
        if (p.appliance === 'range') {
          if (lo < RULE.rangeLanding[0] || hi < RULE.rangeLanding[1]) add('warn', p, 'range-landing', 'Range: ' + sides + '. Plan at least 12″ on one side and 15″ on the other.');
          lay.openings.forEach(function (o) { if (o.kind === 'window' && overlaps(p.x, p.x + p.w, o.x, o.x + o.w)) add('warn', p, 'range-window', 'Range sits under the window. Curtains and drafts near a burner are a fire risk; move it or confirm with the customer.'); });
          var hooded = lay.upper.some(function (u) { return (u.appliance === 'hood' || u.appliance === 'microwave') && overlaps(p.x, p.x + p.w, u.x, u.x + u.w); });
          if (!hooded) lay.upper.forEach(function (u) {
            if (u.kind === 'wall' && u.h && overlaps(p.x, p.x + p.w, u.x, u.x + u.w) && u.y - top < RULE.hoodClear - 1e-6)
              add('warn', u, 'range-clearance', nm(u) + ' is ' + inches(u.y - top) + ' over the range; 30″ is usual. Add a hood or raise the cabinet.');
          });
        }
        if (p.appliance === 'fridge' && !lay.island) {
          if (hi < RULE.fridgeLanding) add('tip', p, 'fridge-landing', 'Refrigerator: ' + sides + '. Plan 15″ of counter beside it (handle side) to set things down.');
          if (p.x <= 0.01) add('tip', p, 'fridge-wall', 'Refrigerator is tight to the wall on the left. Leave a filler (1–3″) so the door opens past 90° and the drawers come out.');
          if (p.x + p.w >= lay.lengthIn - 0.01) add('tip', p, 'fridge-wall', 'Refrigerator is tight to the wall on the right. Leave a filler (1–3″) so the door opens past 90° and the drawers come out.');
        }
        if (isSink(p) && p.kind === 'base' && (lo < RULE.sinkLanding[0] || hi < RULE.sinkLanding[1])) add('tip', p, 'sink-landing', nm(p) + ' (sink): ' + sides + '. Plan at least 18″ on one side and 24″ on the other.');
        if (p.appliance === 'dishwasher') {
          var same = sinks.filter(function (k) { return k.x === x; });
          if (!same.length && sinks.length) add('tip', p, 'dw-sink', 'Dishwasher is on a different run from the sink. Next to the sink is usual for plumbing and loading.');
          else if (same.length) {
            var dist = Math.min.apply(null, same.map(function (k) { return Math.max(0, k.p.x - (p.x + p.w), p.x - (k.p.x + k.p.w)); }));
            if (dist > RULE.dwToSink) add('tip', p, 'dw-sink', 'Dishwasher is ' + inches(dist) + ' from the sink; within 36″ is usual.');
          }
        }
        // doors and drawers right against a corner hit the handles on the other wall
        var opens = p.style === 'drawers' || p.appliance === 'dishwasher' || p.appliance === 'range';
        var atL = lay.reserve.left.base > 0 && p.x <= lay.reserve.left.base + 0.01, atR = lay.reserve.right.base > 0 && p.x + p.w >= lay.lengthIn - lay.reserve.right.base - 0.01;
        var blind = lay.base.filter(function (q) { return q !== p && q.corner === 'blind' && q.w && (Math.abs(q.x + q.w - p.x) < 0.5 || Math.abs(p.x + p.w - q.x) < 0.5); })[0];
        if (p.kind !== 'filler' && p.appliance !== 'space' && ((opens && (atL || atR)) || blind))
          add('warn', p, 'corner-filler', nm(p) + ' sits right against ' + (blind ? 'the blind corner ' + nm(blind) : 'the corner') + '. Add a filler (about 3″) so its ' + (p.style === 'drawers' ? 'drawers clear' : 'door clears') + ' the cabinets on the other wall.');
      });
      if (lay.island) islandChecks(R, x, add);
    });
    return R;
  }
  /* Walkways around an island: from the island's cabinets to the cabinets across from them. */
  function islandChecks(R, x, add) {
    var w = x.wall, L = x.layout.lengthIn, ix = w.islandX != null && w.islandX !== '' ? +w.islandX : 36, iy = w.islandY != null && w.islandY !== '' ? +w.islandY : 42, room = roomSize(R);
    function depthOn(pos, lo, hi, span) {
      var o = R.filter(function (r) { return r.position === pos; })[0]; if (!o) return null;
      var d = 0; o.layout.base.forEach(function (p) { if (!p.w || p.appliance === 'space') return; var sp = span(o.layout.lengthIn, p); if (overlaps(sp[0], sp[1], lo, hi)) d = Math.max(d, p.d); });
      return d ? { name: o.wall.name, d: d } : null;
    }
    [
      [depthOn('back', ix, ix + L, function (len, p) { return [p.x, p.x + p.w]; }), function (d) { return iy - d; }],
      [ix > 0 ? depthOn('left', iy, iy + DEPTH.base, function (len, p) { return [len - p.x - p.w, len - p.x]; }) : null, function (d) { return ix - d; }],
      [depthOn('right', iy, iy + DEPTH.base, function (len, p) { return [p.x, p.x + p.w]; }), function (d) { return room.width - d - (ix + L); }],
      [depthOn('front', ix, ix + L, function (len, p) { return [room.width - p.x - p.w, room.width - p.x]; }), function (d) { return room.depth - d - (iy + DEPTH.base); }]
    ].forEach(function (sd) {
      var o = sd[0]; if (!o) return;
      var gap = sd[1](o.d);
      if (gap < RULE.walkwayTight - 1e-6) add('warn', null, 'walkway', 'Walkway between the island and ' + o.name + ' is ' + inches(Math.max(0, gap)) + '. Under 36″ is too tight to pass or open doors.');
      else if (gap < RULE.walkway - 1e-6) add('tip', null, 'walkway', 'Walkway between the island and ' + o.name + ' is ' + inches(gap) + '; 42″ is usual (48″ with two cooks).');
    });
  }

  /* ---------- change orders: the drawings follow the cabinets ---------- */
  function applyLineChanges(lines, change) {
    var out = (lines || []).map(function (l) { var c = {}; Object.keys(l).forEach(function (k) { c[k] = l[k]; }); return c; });
    function find(sku) { var k = String(sku).toUpperCase(); return out.filter(function (l) { return String(l.sku).toUpperCase() === k; })[0]; }
    ((change && change.removed) || []).forEach(function (r) { var l = find(r.sku); if (l) l.qty = Math.max(0, (+l.qty || 0) - (+r.qty || 0)); });
    ((change && change.added) || []).forEach(function (a) { var l = find(a.sku); if (l) l.qty = (+l.qty || 0) + (+a.qty || 0); else out.push({ sku: a.sku, desc: a.desc || '', qty: +a.qty || 0 }); });
    return out.filter(function (l) { return (+l.qty || 0) > 0; });
  }
  /* Takes the cabinets a change order removed off the walls. The cabinets around them stay put (the space is left open);
     added cabinets show on the quote list as still to place. */
  function reviseRooms(rooms, change, sizes) {
    var rs = JSON.parse(JSON.stringify(rooms || [])), pulled = [];
    ((change && change.removed) || []).forEach(function (r) {
      var want = +r.qty || 0, key = String(r.sku).toUpperCase(), code = splitSku(r.sku).code;
      for (var ri = rs.length - 1; ri >= 0 && want > 0; ri--) {
        var room = rs[ri];
        for (var wi = (room.walls || []).length - 1; wi >= 0 && want > 0; wi--) {
          var wall = room.walls[wi];
          ['upper', 'base'].forEach(function (run) {
            var list = wall[run] || [];
            for (var k = list.length - 1; k >= 0 && want > 0; k--) {
              var it = list[k]; if (!it.sku) continue;
              if (String(it.sku).toUpperCase() !== key && splitSku(it.sku).code !== code) continue;
              var sp = parseSku(it.sku, sizes), freed = (+it.gapBefore || 0) + (sp.w || 0);
              if (list[k + 1]) list[k + 1].gapBefore = (+list[k + 1].gapBefore || 0) + freed;
              list.splice(k, 1); want--;
              pulled.push({ sku: it.sku, code: sp.code, room: room.name, wall: wall.name, run: run });
            }
          });
        }
      }
    });
    return { rooms: rs, pulled: pulled };
  }

  /* ---------- room templates: copy rooms to another model or job ---------- */
  /* New ids throughout; each cabinet is matched to the target quote by its code, so a color change carries over
     (B33-SBW becomes B33-UMO). Codes the target quote doesn't have keep their SKU and are listed in unmatched. */
  function copyRooms(rooms, lines, opts) {
    opts = opts || {};
    var byCode = {}, unmatched = {}, order = [], items = 0;
    (lines || []).forEach(function (l) { var k = splitSku(l.sku).code; if (!byCode[k]) byCode[k] = l.sku; });
    var out = JSON.parse(JSON.stringify(rooms || [])).map(function (r) {
      r.id = newId('room'); if (opts.set != null) r.set = opts.set;
      (r.walls || []).forEach(function (w) {
        w.id = newId('wall');
        ['base', 'upper'].forEach(function (run) { (w[run] || []).forEach(function (it) {
          it.id = newId(); if (!it.sku) return; items++;
          var k = splitSku(it.sku).code;
          if (byCode[k]) it.sku = byCode[k]; else { if (!unmatched[k]) order.push(k); unmatched[k] = (unmatched[k] || 0) + 1; }
        }); });
      });
      return r;
    });
    return { rooms: out, items: items, unmatched: order.map(function (k) { return { code: k, count: unmatched[k] }; }) };
  }

  /* ---------- quoted vs placed ---------- */
  function placedCounts(rooms) {
    var c = {};
    (rooms || []).forEach(function (r) { (r.walls || []).forEach(function (w) {
      (w.base || []).concat(w.upper || []).forEach(function (it) { if (it.sku) { var k = String(it.sku).toUpperCase(); c[k] = (c[k] || 0) + 1; } });
    }); });
    return c;
  }
  function reconcile(lines, rooms, sizes) {
    var placed = placedCounts(rooms), quoted = {}, order = [], notDrawn = [];
    (lines || []).forEach(function (l) {
      var k = String(l.sku).toUpperCase(), sp = parseSku(l.sku, sizes);
      if (sp.kind === 'trim') { notDrawn.push({ sku: l.sku, qty: l.qty, label: sp.label }); return; }
      if (!quoted[k]) { quoted[k] = { sku: l.sku, qty: 0, spec: sp }; order.push(k); }
      quoted[k].qty += +l.qty || 0;
    });
    var rows = order.map(function (k) {
      var q = quoted[k], p = placed[k] || 0;
      return { sku: q.sku, label: describe(q.spec), kind: q.spec.kind, sure: q.spec.sure, sized: !!q.spec.w, layer: q.spec.layer, quoted: q.qty, placed: p, left: Math.max(0, q.qty - p),
        status: p === q.qty ? 'ok' : p < q.qty ? 'missing' : 'extra' };
    });
    Object.keys(placed).forEach(function (k) {
      if (!quoted[k]) { var sp = parseSku(k, sizes); rows.push({ sku: k, label: describe(sp), kind: sp.kind, sure: sp.sure, sized: !!sp.w, layer: sp.layer, quoted: 0, placed: placed[k], left: 0, status: 'extra' }); }
    });
    var missing = rows.reduce(function (t, r) { return t + r.left; }, 0), extra = rows.reduce(function (t, r) { return t + Math.max(0, r.placed - r.quoted); }, 0);
    return { rows: rows, notDrawn: notDrawn, missing: missing, extra: extra, allPlaced: missing === 0 && extra === 0 && rows.length > 0 };
  }

  var seq = 0;
  function newId(prefix) { seq++; return (prefix || 'it') + '-' + Date.now().toString(36) + '-' + seq; }

  /* Adds the cabinets not placed yet (from the quote) to one wall, in quote order, as many as fit. */
  function autoPlace(wall, lines, rooms, sizes, opts) {
    var w = JSON.parse(JSON.stringify(wall)); w.base = w.base || []; w.upper = w.upper || [];
    var rec = reconcile(lines, rooms, sizes), added = [], skipped = [];
    rec.rows.forEach(function (r) {
      for (var k = 0; k < r.left; k++) {
        if (!r.sized) { skipped.push({ sku: r.sku, why: 'size needed' }); continue; }
        if (r.kind === 'filler' || r.kind === 'panel') { skipped.push({ sku: r.sku, why: 'by hand' }); continue; }   // fillers and panels go where a gap needs them
        var run = r.layer === 'upper' ? 'upper' : 'base';
        w[run].push({ id: newId(), sku: r.sku, gapBefore: 0 });
        var lay = layoutWall(w, sizes, opts);
        if (lay.open[run] < -1e-6) { w[run].pop(); skipped.push({ sku: r.sku, why: 'no room' }); }
        else added.push(r.sku);
      }
    });
    return { wall: w, added: added, skipped: skipped };
  }

  /* ---------- drag and drop ---------- */
  function q4(x) { return Math.round(x * 4) / 4; }
  /* Snap targets for an item of width w on one run: wall ends, neighbors' edges, window and door edges. */
  function snapX(x, w, lay, run, id, start, limit) {
    var edges = [start, limit];
    lay[run].forEach(function (p) { if (p.id !== id && p.w) { edges.push(p.x, p.x + p.w); } });
    lay.openings.forEach(function (o) { edges.push(o.x, o.x + o.w); });
    var best = q4(x), dist = 2.0001;
    edges.forEach(function (e) {
      if (Math.abs(x - e) < dist) { dist = Math.abs(x - e); best = e; }            // left side to an edge
      if (Math.abs(x + w - e) < dist) { dist = Math.abs(x + w - e); best = e - w; } // right side to an edge
    });
    return Math.max(start, best);
  }
  function moveItem(wall, id, x, sizes, opts) {
    var w = JSON.parse(JSON.stringify(wall)), lay = layoutWall(w, sizes, opts);
    var run = (w.base || []).some(function (i) { return i.id === id; }) ? 'base' : (w.upper || []).some(function (i) { return i.id === id; }) ? 'upper' : null;
    if (!run) return { wall: w, moved: false };
    var start = lay.reserve.left[run], limit = lay.lengthIn - lay.reserve.right[run];
    var placed = lay[run], idx = -1;
    w[run].forEach(function (it, i) { if (it.id === id) idx = i; });
    var me = placed[idx], nx = snapX(x, me.w, lay, run, id, start, limit);
    var others = placed.filter(function (p) { return p.id !== id && p.w; });
    var free = !others.some(function (p) { return overlaps(nx, nx + me.w, p.x, p.x + p.w); });
    var mode;
    if (free) {
      mode = 'placed';
      var pos = w[run].map(function (it, i) { return { it: it, x: it.id === id ? nx : placed[i].x, w: placed[i].w }; });
      pos.sort(function (a, b) { return a.x - b.x; });
      var cur = start;
      pos.forEach(function (o) { o.it.gapBefore = q4(Math.max(0, o.x - cur)); cur += o.it.gapBefore + o.w; });
      w[run] = pos.map(function (o) { return o.it; });
    } else {
      mode = 'reordered';   // dropped onto other cabinets: slot it in by its center; the rest close up and keep their own spacing
      var item = w[run].splice(idx, 1)[0], center = nx + me.w / 2, rest = placed.filter(function (p) { return p.id !== id; }), at = rest.length;
      for (var k = 0; k < rest.length; k++) if (center < rest[k].x + rest[k].w / 2) { at = k; break; }
      item.gapBefore = 0;
      w[run].splice(at, 0, item);
    }
    var la = layoutWall(w, sizes, opts), after = la.base.concat(la.upper).filter(function (p) { return p.id === id; })[0];
    return { wall: w, moved: true, mode: mode, run: run, x: after ? after.x : null };
  }

  /* ---------- drawing helpers ---------- */
  function r2(x) { return Math.round(x * 100) / 100; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var INK = '#243A32', LINE = '#5b6b62', FAINT = '#9aa59e', PAPER = '#FBF8F1';
  var FINISH = { SBW: '#F4F1EA', SWD: '#C89F72', UMO: '#7C8F6E', VDH: '#5A4332', '': '#E7DCC6' };
  function finishFor(color) { return FINISH[color] || FINISH['']; }

  /* Door and drawer faces in the item's own box (x right, y up from its bottom). */
  function fronts(p, s) {
    var out = [], w = p.w, h = p.h, tk = (p.run === 'base' && (p.kind === 'base' || p.kind === 'vanity')) ? s.toeKick : 0, g = 0.25;
    var body0 = tk, bodyH = h - tk;
    function doors(y0, hh) {
      if (w >= 24) { out.push({ x: g, y: y0 + g, w: w / 2 - g * 1.5, h: hh - 2 * g, t: 'door' }, { x: w / 2 + g / 2, y: y0 + g, w: w / 2 - g * 1.5, h: hh - 2 * g, t: 'door' }); }
      else out.push({ x: g, y: y0 + g, w: w - 2 * g, h: hh - 2 * g, t: 'door' });
    }
    if (p.kind === 'appliance' || p.kind === 'filler' || p.kind === 'panel' || !w || !h) return out;
    if (p.style === 'drawers') {
      var nD = p.drawers || 3, top = Math.min(6, bodyH / nD), rest = (bodyH - top) / Math.max(1, nD - 1);
      var y = body0 + bodyH;
      for (var i = 0; i < nD; i++) { var hh = i === 0 ? (nD === 1 ? bodyH : top) : rest; y -= hh; out.push({ x: g, y: y + g, w: w - 2 * g, h: hh - 2 * g, t: 'drawer' }); }
    } else if (p.style === 'sink') {
      out.push({ x: g, y: body0 + bodyH - 6 + g, w: w - 2 * g, h: 6 - 2 * g, t: 'false' }); doors(body0, bodyH - 6);
    } else if (p.style === 'combo' && w >= 12) {
      out.push({ x: g, y: body0 + bodyH - 6 + g, w: w - 2 * g, h: 6 - 2 * g, t: 'drawer' }); doors(body0, bodyH - 6);
    } else if (p.style === 'corner') {
      var inset = Math.min(6, w / 6);
      if (w - 2 * inset >= 24) { out.push({ x: inset + g, y: body0 + g, w: (w - 2 * inset) / 2 - g * 1.5, h: bodyH - 2 * g, t: 'door' }, { x: w / 2 + g / 2, y: body0 + g, w: (w - 2 * inset) / 2 - g * 1.5, h: bodyH - 2 * g, t: 'door' }); }
      else out.push({ x: inset + g, y: body0 + g, w: w - 2 * inset - 2 * g, h: bodyH - 2 * g, t: 'door' });
    } else if (p.style === 'tall') {
      var split = Math.min(bodyH - 12, 50); doors(body0, split); doors(body0 + split, bodyH - split);
    } else doors(body0, bodyH);
    return out;
  }

  /* ---------- 2D elevation ---------- */
  var MARK_LABEL = { drain: 'Drain', water: 'Water', gas: 'Gas', outlet: 'Outlet', switch: 'Switch', vent: 'Vent', light: 'Light' };
  function svgElevation(lay, opts) {
    opts = opts || {};
    var s = lay.specs, L = lay.lengthIn || 1, C = lay.ceiling, fin = finishFor(opts.color || '');
    var fs = Math.max(3.4, Math.min(6, L / 30)), pad = { l: fs * 9, r: fs * 13, t: fs * 7.5, b: fs * 8 };
    var vbW = L + pad.l + pad.r, vbH = C + pad.t + pad.b;
    function X(x) { return r2(pad.l + x); }
    function Y(y) { return r2(pad.t + C - y); }
    var o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + r2(vbW) + ' ' + r2(vbH) + '" role="img" aria-label="' + esc(opts.title || 'Elevation') + '" class="fm-elev-svg" font-family="Inter, Helvetica, Arial, sans-serif">');
    o.push('<rect x="0" y="0" width="' + r2(vbW) + '" height="' + r2(vbH) + '" fill="' + PAPER + '"/>');
    o.push('<defs><pattern id="h' + (opts.uid || '') + '" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="' + FAINT + '" stroke-width="0.35"/></pattern></defs>');
    var hatch = 'url(#h' + (opts.uid || '') + ')';
    // wall, soffit, floor
    if (lay.island) o.push('<text x="' + X(L / 2) + '" y="' + Y(C * 0.75) + '" font-size="' + r2(fs * 0.9) + '" text-anchor="middle" fill="' + FAINT + '">Island · no wall behind</text>');
    else o.push('<rect x="' + X(0) + '" y="' + Y(C) + '" width="' + r2(L) + '" height="' + r2(C) + '" fill="#fff" stroke="' + LINE + '" stroke-width="0.3"/>');
    if (s.soffit > 0 && !lay.island) o.push('<rect x="' + X(0) + '" y="' + Y(C) + '" width="' + r2(L) + '" height="' + r2(s.soffit) + '" fill="' + hatch + '" stroke="' + LINE + '" stroke-width="0.25"/>');
    ['left', 'right'].forEach(function (side) {
      var r = lay.reserve[side]; if (!r.base) return;
      var x0 = side === 'left' ? 0 : L - r.base;
      o.push('<rect x="' + X(x0) + '" y="' + Y(s.baseHeight + s.counter) + '" width="' + r.base + '" height="' + r2(s.baseHeight + s.counter) + '" fill="' + hatch + '" stroke="' + FAINT + '" stroke-width="0.25" stroke-dasharray="1 1"/>');
      var lbl = lay.reserve[side + 'Label'];
      o.push('<text x="' + X(x0 + r.base / 2) + '" y="' + Y(s.baseHeight / 2) + '" font-size="' + r2(fs * 0.7) + '" text-anchor="middle" fill="' + LINE + '">corner</text>');
      if (lbl && r.base >= 18) o.push('<text x="' + X(x0 + r.base / 2) + '" y="' + Y(s.baseHeight / 2) + '" dy="' + r2(fs * 0.9) + '" font-size="' + r2(fs * 0.55) + '" text-anchor="middle" fill="' + FAINT + '">' + esc(lbl) + '</text>');
    });
    lay.openings.forEach(function (op) {
      o.push('<rect x="' + X(op.x) + '" y="' + Y(op.y + op.h) + '" width="' + r2(op.w) + '" height="' + r2(op.h) + '" fill="#EAF0EE" stroke="' + LINE + '" stroke-width="0.35" stroke-dasharray="1.5 1"/>');
      if (op.kind === 'window') o.push('<line x1="' + X(op.x + op.w / 2) + '" y1="' + Y(op.y + op.h) + '" x2="' + X(op.x + op.w / 2) + '" y2="' + Y(op.y) + '" stroke="' + FAINT + '" stroke-width="0.25"/>');
      o.push('<text x="' + X(op.x + op.w / 2) + '" y="' + Y(op.y + op.h) + '" dy="' + r2(fs * 1.2) + '" font-size="' + r2(fs * 0.8) + '" text-anchor="middle" fill="' + LINE + '">' + (op.kind === 'door' ? 'Door' : 'Window') + ' ' + esc(inches(op.w)) + '</text>');
    });
    // countertop
    lay.base.forEach(function (p) {
      if (!p.counter || !p.w) return;
      o.push('<rect x="' + X(p.x - 0) + '" y="' + Y(s.baseHeight + s.counter) + '" width="' + r2(p.w) + '" height="' + r2(s.counter) + '" fill="#D9D6CF" stroke="' + LINE + '" stroke-width="0.25"/>');
    });
    function drawItem(p) {
      if (!p.w || (!p.h && p.kind !== 'appliance')) return;
      var isSpace = p.appliance === 'space' || p.appliance === 'upperSpace';
      if (isSpace) {
        o.push('<text x="' + X(p.x + p.w / 2) + '" y="' + Y(p.run === 'base' ? 12 : lay.upperTop - 8) + '" font-size="' + r2(fs * 0.75) + '" text-anchor="middle" fill="' + FAINT + '">open ' + esc(inches(p.w)) + '</text>');
        return;
      }
      var fill = p.kind === 'appliance' ? '#E9ECEB' : p.kind === 'filler' || p.kind === 'panel' ? fin : fin;
      var tk = p.run === 'base' && (p.kind === 'base' || p.kind === 'vanity') ? s.toeKick : 0;
      if (tk) o.push('<rect x="' + X(p.x + 0.4) + '" y="' + Y(tk) + '" width="' + r2(p.w - 0.8) + '" height="' + r2(tk) + '" fill="#3a463f"/>');
      o.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + p.h) + '" width="' + r2(p.w) + '" height="' + r2(p.h - tk) + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="0.35"/>');
      if (p.kind === 'filler' || p.kind === 'panel') o.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + p.h) + '" width="' + r2(p.w) + '" height="' + r2(p.h - tk) + '" fill="' + hatch + '"/>');
      fronts(p, s).forEach(function (f) {
        var fx = p.x + f.x, fy = p.y + f.y, inset = Math.min(2.25, f.w / 5, f.h / 4);
        o.push('<rect x="' + X(fx) + '" y="' + Y(fy + f.h) + '" width="' + r2(f.w) + '" height="' + r2(f.h) + '" fill="none" stroke="' + INK + '" stroke-width="0.22"/>');
        if (f.h > 4 && f.w > 4) o.push('<rect x="' + X(fx + inset) + '" y="' + Y(fy + f.h - inset) + '" width="' + r2(f.w - 2 * inset) + '" height="' + r2(f.h - 2 * inset) + '" fill="none" stroke="' + LINE + '" stroke-width="0.15"/>');
      });
      if (p.appliance === 'range') {
        o.push('<rect x="' + X(p.x + 3) + '" y="' + Y(p.h - 9) + '" width="' + r2(p.w - 6) + '" height="16" fill="none" stroke="' + LINE + '" stroke-width="0.25"/>');
        for (var k = 0; k < 4; k++) o.push('<circle cx="' + X(p.x + 4 + (k + 0.5) * (p.w - 8) / 4) + '" cy="' + Y(p.h - 3) + '" r="0.9" fill="' + LINE + '"/>');
      } else if (p.appliance === 'fridge') {
        o.push('<line x1="' + X(p.x + p.w / 2) + '" y1="' + Y(p.h) + '" x2="' + X(p.x + p.w / 2) + '" y2="' + Y(p.h * 0.32) + '" stroke="' + LINE + '" stroke-width="0.25"/><line x1="' + X(p.x) + '" y1="' + Y(p.h * 0.32) + '" x2="' + X(p.x + p.w) + '" y2="' + Y(p.h * 0.32) + '" stroke="' + LINE + '" stroke-width="0.25"/>');
      } else if (p.appliance === 'dishwasher') {
        o.push('<line x1="' + X(p.x) + '" y1="' + Y(p.h - 4) + '" x2="' + X(p.x + p.w) + '" y2="' + Y(p.h - 4) + '" stroke="' + LINE + '" stroke-width="0.25"/>');
      }
      var label = p.code || p.label, lx = X(p.x + p.w / 2), ly = Y(p.y + p.h / 2 + (tk / 2));
      if (p.w >= 9) o.push('<text x="' + lx + '" y="' + ly + '" font-size="' + r2(Math.min(fs * 0.85, p.w / Math.max(4, label.length) * 1.6)) + '" text-anchor="middle" dominant-baseline="middle" font-weight="600" fill="' + INK + '" paint-order="stroke" stroke="' + PAPER + '" stroke-width="' + r2(fs * 0.3) + '">' + esc(label) + '</text>');
      else o.push('<text x="' + lx + '" y="' + ly + '" font-size="' + r2(fs * 0.62) + '" text-anchor="middle" dominant-baseline="middle" fill="' + INK + '" transform="rotate(-90 ' + lx + ' ' + ly + ')">' + esc(label) + '</text>');
      if (!p.sure) o.push('<text x="' + X(p.x + p.w - 1) + '" y="' + Y(p.y + p.h - 1) + '" dy="' + r2(fs * 0.8) + '" font-size="' + r2(fs * 0.8) + '" text-anchor="end" fill="#A4452C" font-weight="700">?</text>');
    }
    function wrapItem(p) {
      if (!opts.interactive) return drawItem(p);
      o.push('<g data-elitem="' + esc(p.id) + '" style="cursor:pointer">');
      if (p.w) o.push('<rect x="' + X(p.x) + '" y="' + Y(p.y + (p.h || 12)) + '" width="' + r2(p.w) + '" height="' + r2(p.h || 12) + '" fill="transparent"/>');
      drawItem(p);
      if (opts.selected === p.id && p.w) o.push('<rect x="' + X(p.x - 0.6) + '" y="' + Y(p.y + (p.h || 12) + 0.6) + '" width="' + r2(p.w + 1.2) + '" height="' + r2((p.h || 12) + 1.2) + '" fill="none" stroke="#C2703D" stroke-width="0.9"/>');
      o.push('</g>');
    }
    lay.base.forEach(wrapItem); lay.upper.forEach(wrapItem);
    (lay.marks || []).forEach(function (k) {
      var lab = MARK_LABEL[k.kind] || k.kind, rr = Math.max(1.4, fs * 0.42), col = k.kind === 'gas' ? '#A4452C' : k.kind === 'drain' || k.kind === 'water' ? '#2F6F8F' : '#7A5C1E';
      o.push('<g class="mark"><circle cx="' + X(k.x) + '" cy="' + Y(k.y) + '" r="' + r2(rr) + '" fill="' + PAPER + '" fill-opacity="0.85" stroke="' + col + '" stroke-width="0.45"/>' +
        '<circle cx="' + X(k.x) + '" cy="' + Y(k.y) + '" r="' + r2(rr * 0.3) + '" fill="' + col + '"/>' +
        '<text x="' + X(k.x) + '" y="' + Y(k.y) + '" dy="' + r2(-rr - fs * 0.25) + '" font-size="' + r2(fs * 0.6) + '" text-anchor="middle" fill="' + col + '" paint-order="stroke" stroke="' + PAPER + '" stroke-width="' + r2(fs * 0.25) + '">' + esc(lab) + ' ' + esc(inches(k.x)) + '</text></g>');
    });
    if (lay.crown) lay.upper.concat(lay.base.filter(function (p) { return p.kind === 'tall'; })).forEach(function (p) {
      if (!p.w || !p.h || p.kind === 'appliance' || p.kind === 'filler') return;
      // crown sits on top of the cabinet; when the cabinet reaches the ceiling it's applied to the top of the face instead
      var top = p.y + p.h, room2 = C - s.soffit - top, ch = lay.crownH, y0 = room2 >= ch ? top : top + room2 - ch;
      o.push('<g class="crown"><rect x="' + X(p.x - 0.75) + '" y="' + Y(y0 + ch) + '" width="' + r2(p.w + 1.5) + '" height="' + r2(ch) + '" fill="' + fin + '" stroke="' + INK + '" stroke-width="0.25"/>' +
        '<line x1="' + X(p.x - 0.75) + '" y1="' + Y(y0 + ch * 0.45) + '" x2="' + X(p.x + p.w + 0.75) + '" y2="' + Y(y0 + ch * 0.45) + '" stroke="' + LINE + '" stroke-width="0.15"/></g>');
    });
    o.push('<line x1="' + X(-pad.l * 0.3) + '" y1="' + Y(0) + '" x2="' + X(L + pad.r * 0.3) + '" y2="' + Y(0) + '" stroke="' + INK + '" stroke-width="0.6"/>');

    // dimension chains
    function dimH(x0, x1, y, txt, small) {
      var t = r2(fs * 0.55);
      o.push('<g stroke="' + LINE + '" stroke-width="0.2"><line x1="' + X(x0) + '" y1="' + y + '" x2="' + X(x1) + '" y2="' + y + '"/>' +
        '<line x1="' + X(x0) + '" y1="' + r2(y - t) + '" x2="' + X(x0) + '" y2="' + r2(y + t) + '"/><line x1="' + X(x1) + '" y1="' + r2(y - t) + '" x2="' + X(x1) + '" y2="' + r2(y + t) + '"/></g>');
      if (x1 - x0 >= fs * 1.6) o.push('<text x="' + X((x0 + x1) / 2) + '" y="' + r2(y - fs * 0.35) + '" font-size="' + r2(small ? fs * 0.72 : fs * 0.9) + '" text-anchor="middle" fill="' + INK + '"' + (small ? '' : ' font-weight="600"') + '>' + esc(txt) + '</text>');
    }
    function dimV(y0, y1, x, txt) {
      var t = r2(fs * 0.55), xx = X(x);
      o.push('<g stroke="' + LINE + '" stroke-width="0.2"><line x1="' + xx + '" y1="' + Y(y0) + '" x2="' + xx + '" y2="' + Y(y1) + '"/>' +
        '<line x1="' + r2(xx - t) + '" y1="' + Y(y0) + '" x2="' + r2(xx + t) + '" y2="' + Y(y0) + '"/><line x1="' + r2(xx - t) + '" y1="' + Y(y1) + '" x2="' + r2(xx + t) + '" y2="' + Y(y1) + '"/></g>');
      if (y1 - y0 >= Math.min(fs * 1.1, 3)) o.push('<text x="' + r2(xx + fs * 0.6) + '" y="' + Y((y0 + y1) / 2) + '" font-size="' + r2(fs * 0.72) + '" dominant-baseline="middle" fill="' + INK + '">' + esc(txt) + '</text>');
    }
    var topY = pad.t - fs * 4.6, upY = pad.t - fs * 1.6, botY = pad.t + C + fs * 2.6, botAll = pad.t + C + fs * 5.6;
    dimH(0, L, topY, (lay.island ? 'Island ' : 'Wall ') + feetInches(L) + (L >= 12 ? ' (' + inches(L) + ')' : ''));
    var ups = lay.upper.filter(function (p) { return p.w > 0; });
    ups.forEach(function (p) { dimH(p.x, p.x + p.w, upY, inches(p.w), true); });
    var bs = lay.base.filter(function (p) { return p.w > 0; });
    bs.forEach(function (p) { dimH(p.x, p.x + p.w, botY, inches(p.w), true); });
    if (bs.length) {
      var b0 = Math.min.apply(null, bs.map(function (p) { return p.x; })), b1 = Math.max.apply(null, bs.map(function (p) { return p.x + p.w; }));
      dimH(b0, b1, botAll, 'Base run ' + inches(b1 - b0));
    }
    // heights on the right
    var hx = L + fs * 1.6, stops = [0, s.toeKick, s.baseHeight, s.baseHeight + s.counter];
    if (ups.length) { stops.push(Math.min.apply(null, ups.map(function (p) { return p.y; }))); stops.push(lay.upperTop); }
    if (s.soffit && !lay.island) stops.push(C - s.soffit);
    if (!lay.island) stops.push(C);
    stops = stops.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    for (var i = 1; i < stops.length; i++) dimV(stops[i - 1], stops[i], hx, inches(stops[i] - stops[i - 1]));
    if (!lay.island) dimV(0, C, L + fs * 7.4, 'Ceiling ' + inches(C));
    var cx = L + fs * 4.4; dimV(0, s.baseHeight + s.counter, cx, inches(s.baseHeight + s.counter) + ' counter');
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- 3D ---------- */
  function wallFrame(pos, len, room, wall) {
    var W = room.width, D = room.depth;
    if (pos === 'island') { var ix = +(wall && wall.islandX) || 36, iy = +(wall && wall.islandY) || 42; return { o: [ix + len, iy + DEPTH.base], a: [-1, 0], n: [0, -1] }; }
    if (pos === 'left') return { o: [0, len], a: [0, -1], n: [1, 0] };
    if (pos === 'right') return { o: [W, 0], a: [0, 1], n: [-1, 0] };
    if (pos === 'front') return { o: [W, D], a: [-1, 0], n: [0, -1] };
    return { o: [0, 0], a: [1, 0], n: [0, 1] };
  }
  function roomSize(walls) {
    var w = 0, d = 0;
    var iw = 0, id = 0;
    walls.forEach(function (x) {
      var L = x.layout.lengthIn;
      if (x.position === 'island') { iw = Math.max(iw, (+(x.wall && x.wall.islandX) || 36) + L + 36); id = Math.max(id, (+(x.wall && x.wall.islandY) || 42) + DEPTH.base + 36); }
      else if (x.position === 'left' || x.position === 'right') d = Math.max(d, L); else w = Math.max(w, L);
    });
    return { width: Math.max(w || 120, iw), depth: Math.max(d, 96, id) };
  }
  /* A starting angle that looks at the walls with cabinets, not through them. */
  function autoYaw(walls) {
    var has = {}; walls.forEach(function (w) { if (w.position !== 'island') has[w.position || 'back'] = true; });
    if (has.left && !has.right) return 32;
    if (has.right && !has.left) return -32;
    return has.front ? 90 : -14;
  }
  function svg3D(walls, opts) {
    opts = opts || {};
    var yaw = (opts.yaw == null ? autoYaw(walls) : opts.yaw) * Math.PI / 180, pitch = (opts.pitch == null ? 26 : opts.pitch) * Math.PI / 180;
    var room = roomSize(walls), cx = room.width / 2, cy = room.depth / 2;
    var sy = Math.sin(yaw), cyw = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    var V = [sy * cp, cyw * cp, sp], R = [cyw, -sy, 0], U = [-sy * sp, -cyw * sp, cp];
    function proj(p) { var x = p[0] - cx, y = p[1] - cy, z = p[2]; return [x * R[0] + y * R[1], -(x * U[0] + y * U[1] + z * U[2]), x * V[0] + y * V[1] + z * V[2]]; }
    var fin = finishFor(opts.color || ''), faces = [], back = [];
    function shade(hex, k) {
      var c = parseInt(hex.slice(1), 16), r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      function f(v) { return Math.max(0, Math.min(255, Math.round(v * k))); }
      return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
    }
    function quad(pts, fill, extra) { faces.push({ pts: pts.map(proj), fill: fill, extra: extra || null, stroke: opts.stroke || '#243A32' }); }
    function box(fr, x, w, dep0, dep1, z0, z1, color, front) {
      function P(t, d, z) { return [fr.o[0] + fr.a[0] * t + fr.n[0] * d, fr.o[1] + fr.a[1] * t + fr.n[1] * d, z]; }
      var A = P(x, dep1, z0), B = P(x + w, dep1, z0), Cc = P(x + w, dep1, z1), Dd = P(x, dep1, z1);
      var A2 = P(x, dep0, z0), B2 = P(x + w, dep0, z0), C2 = P(x + w, dep0, z1), D2 = P(x, dep0, z1);
      var nf = [fr.n[0], fr.n[1], 0], ns = [-fr.a[0], -fr.a[1], 0], ne = [fr.a[0], fr.a[1], 0];
      function vis(nv) { return nv[0] * V[0] + nv[1] * V[1] + nv[2] * V[2] > 1e-6; }
      if (vis(nf)) quad([A, B, Cc, Dd], shade(color, 0.93), front ? { fr: fr, x: x, dep: dep1, z0: z0, front: front } : null);
      quad([Dd, Cc, C2, D2], shade(color, 1.06));
      if (vis(ns)) quad([A2, A, Dd, D2], shade(color, 0.78));
      if (vis(ne)) quad([B, B2, C2, Cc], shade(color, 0.78));
    }
    // floor and the walls behind
    var floor = [[0, 0, 0], [room.width, 0, 0], [room.width, room.depth, 0], [0, room.depth, 0]].map(proj);
    back.push({ pts: floor, fill: '#E6DCC8' });
    walls.forEach(function (wl) {
      if (wl.position === 'island') return;
      var fr = wallFrame(wl.position, wl.layout.lengthIn, room, wl.wall), L = wl.layout.lengthIn, H = wl.layout.ceiling;
      var nv = fr.n[0] * V[0] + fr.n[1] * V[1];
      if (nv <= 0) return;   // the camera is behind this wall; leave it out so it doesn't hide the cabinets
      function P(t, z) { return [fr.o[0] + fr.a[0] * t, fr.o[1] + fr.a[1] * t, z]; }
      back.push({ pts: [P(0, 0), P(L, 0), P(L, H), P(0, H)].map(proj), fill: '#F4EFE4' });
      wl.layout.openings.forEach(function (op) { back.push({ pts: [P(op.x, op.y), P(op.x + op.w, op.y), P(op.x + op.w, op.y + op.h), P(op.x, op.y + op.h)].map(proj), fill: op.kind === 'door' ? '#D8CDB8' : '#CFE0E6' }); });
    });
    walls.forEach(function (wl) {
      var lay = wl.layout, s = lay.specs, fr = wallFrame(wl.position, lay.lengthIn, room, wl.wall);
      lay.base.concat(lay.upper).forEach(function (p) {
        if (!p.w || !p.h || p.appliance === 'space' || p.appliance === 'upperSpace') return;
        var col = p.kind === 'appliance' ? '#C9CDCB' : fin, tk = p.run === 'base' && (p.kind === 'base' || p.kind === 'vanity') ? s.toeKick : 0;
        if (tk) box(fr, p.x, p.w, 0, p.d - 3, 0, tk, '#3a463f');
        box(fr, p.x, p.w, 0, p.d, tk, p.y + p.h, col, p.kind === 'appliance' ? null : p);
      });
      lay.base.forEach(function (p) { if (p.counter && p.w) box(fr, p.x, p.w, lay.island ? -10 : 0, p.d + 1, s.baseHeight, s.baseHeight + s.counter, '#CFCBC3'); });
      if (lay.crown) lay.upper.forEach(function (p) {
        if (!p.w || !p.h || p.kind !== 'wall') return;
        var top = p.y + p.h, z1 = Math.min(top + lay.crownH, lay.ceiling - s.soffit);
        box(fr, p.x - 0.75, p.w + 1.5, 0, p.d + 1.5, z1 - lay.crownH, z1, fin);
      });
    });
    faces.forEach(function (f) { f.z = f.pts.reduce(function (t, q) { return t + q[2]; }, 0) / f.pts.length; });
    faces.sort(function (a, b) { return a.z - b.z; });
    var all = back.concat(faces), minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    all.forEach(function (f) { f.pts.forEach(function (q) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }); });
    var pad = 8, o = [];
    function pts(arr) { return arr.map(function (q) { return r2(q[0]) + ',' + r2(q[1]); }).join(' '); }
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r2(minX - pad) + ' ' + r2(minY - pad) + ' ' + r2(maxX - minX + 2 * pad) + ' ' + r2(maxY - minY + 2 * pad) + '" role="img" aria-label="' + esc(opts.title || '3D view') + '" class="fm-elev-svg">');
    o.push('<rect x="' + r2(minX - pad) + '" y="' + r2(minY - pad) + '" width="' + r2(maxX - minX + 2 * pad) + '" height="' + r2(maxY - minY + 2 * pad) + '" fill="' + PAPER + '"/>');
    back.forEach(function (f) { o.push('<polygon points="' + pts(f.pts) + '" fill="' + f.fill + '" stroke="#C9BFA9" stroke-width="0.4"/>'); });
    faces.forEach(function (f) {
      o.push('<polygon points="' + pts(f.pts) + '" fill="' + f.fill + '" stroke="' + f.stroke + '" stroke-width="0.35" stroke-linejoin="round"/>');
      if (f.extra) {
        var e = f.extra, p = e.front;
        fronts(p, walls[0].layout.specs).forEach(function (q) {
          function P(t, z) { return proj([e.fr.o[0] + e.fr.a[0] * (e.x + t) + e.fr.n[0] * (e.dep + 0.05), e.fr.o[1] + e.fr.a[1] * (e.x + t) + e.fr.n[1] * (e.dep + 0.05), p.y + z]); }
          o.push('<polygon points="' + pts([P(q.x, q.y), P(q.x + q.w, q.y), P(q.x + q.w, q.y + q.h), P(q.x, q.y + q.h)]) + '" fill="none" stroke="' + f.stroke + '" stroke-width="0.22" opacity="0.8"/>');
        });
      }
    });
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- floor plan (top-down) ---------- */
  function svgPlan(walls, opts) {
    opts = opts || {};
    var room = roomSize(walls), W = room.width, D = room.depth, fin = finishFor(opts.color || ''), o = [];
    var fs = Math.max(4, Math.min(7, Math.max(W, D) / 26)), pad = fs * 9, T = 4.5;   // walls drawn 4 1/2″ thick
    var vbX = -pad, vbY = -pad, vbW = W + 2 * pad, vbH = D + 2 * pad;
    function P(fr, t2, d) { return [fr.o[0] + fr.a[0] * t2 + fr.n[0] * d, fr.o[1] + fr.a[1] * t2 + fr.n[1] * d]; }
    function poly(pts, attrs) { return '<polygon points="' + pts.map(function (q) { return r2(q[0]) + ',' + r2(q[1]); }).join(' ') + '" ' + attrs + '/>'; }
    function angleOf(fr) { var a = Math.atan2(fr.a[1], fr.a[0]) * 180 / Math.PI; if (a > 90) a -= 180; if (a <= -90) a += 180; return a; }
    function label(x, y, ang, txt, size, color, weight) {
      return '<text x="' + r2(x) + '" y="' + r2(y) + '" font-size="' + r2(size) + '" text-anchor="middle" dominant-baseline="middle" fill="' + (color || INK) + '"' + (weight ? ' font-weight="' + weight + '"' : '') +
        (ang ? ' transform="rotate(' + r2(ang) + ' ' + r2(x) + ' ' + r2(y) + ')"' : '') + '>' + esc(txt) + '</text>';
    }
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r2(vbX) + ' ' + r2(vbY) + ' ' + r2(vbW) + ' ' + r2(vbH) + '" role="img" aria-label="' + esc(opts.title || 'Floor plan') + '" class="fm-elev-svg" font-family="Inter, Helvetica, Arial, sans-serif">');
    o.push('<rect x="' + r2(vbX) + '" y="' + r2(vbY) + '" width="' + r2(vbW) + '" height="' + r2(vbH) + '" fill="' + PAPER + '"/>');
    o.push('<rect x="0" y="0" width="' + r2(W) + '" height="' + r2(D) + '" fill="#fff" stroke="' + FAINT + '" stroke-width="0.4" stroke-dasharray="3 2"/>');
    walls.forEach(function (wl) {
      if (wl.position === 'island') return;
      var fr = wallFrame(wl.position, wl.layout.lengthIn, room, wl.wall), L = wl.layout.lengthIn;
      o.push(poly([P(fr, 0, 0), P(fr, L, 0), P(fr, L, -T), P(fr, 0, -T)], 'fill="' + INK + '"'));
      wl.layout.openings.forEach(function (op) {
        if (op.kind === 'door') {
          o.push(poly([P(fr, op.x, 0.2), P(fr, op.x + op.w, 0.2), P(fr, op.x + op.w, -T - 0.2), P(fr, op.x, -T - 0.2)], 'fill="#fff"'));
          var hinge = P(fr, op.x, 0), tip = P(fr, op.x, op.w), end = P(fr, op.x + op.w, 0), sweep = (fr.a[0] * fr.n[1] - fr.a[1] * fr.n[0]) > 0 ? 1 : 0;
          o.push('<path d="M' + r2(hinge[0]) + ',' + r2(hinge[1]) + ' L' + r2(tip[0]) + ',' + r2(tip[1]) + ' A' + r2(op.w) + ',' + r2(op.w) + ' 0 0 ' + sweep + ' ' + r2(end[0]) + ',' + r2(end[1]) + '" fill="none" stroke="' + LINE + '" stroke-width="0.3"/>');
        } else o.push(poly([P(fr, op.x, 0), P(fr, op.x + op.w, 0), P(fr, op.x + op.w, -T), P(fr, op.x, -T)], 'fill="#CFE0E6" stroke="' + INK + '" stroke-width="0.3"'));
      });
    });
    walls.forEach(function (wl) {
      var lay = wl.layout, fr = wallFrame(wl.position, lay.lengthIn, room, wl.wall), ang = angleOf(fr);
      function foot(p) {
        if (p.corner === 'diagonal' && p.cornerEnd) {
          var bd = p.run === 'base' ? DEPTH.base : DEPTH.wall;
          return p.cornerEnd === 'right' ? [P(fr, p.x, 0), P(fr, p.x + p.w, 0), P(fr, p.x + p.w, p.d), P(fr, p.x + p.w - bd, p.d), P(fr, p.x, bd)]
                                         : [P(fr, p.x, 0), P(fr, p.x + p.w, 0), P(fr, p.x + p.w, bd), P(fr, p.x + bd, p.d), P(fr, p.x, p.d)];
        }
        return [P(fr, p.x, 0), P(fr, p.x + p.w, 0), P(fr, p.x + p.w, p.d), P(fr, p.x, p.d)];
      }
      if (wl.position === 'island') o.push(poly([P(fr, 0, -10), P(fr, lay.lengthIn, -10), P(fr, lay.lengthIn, DEPTH.base + 1), P(fr, 0, DEPTH.base + 1)], 'fill="#ECE9E2" stroke="' + INK + '" stroke-width="0.35"'));
      lay.base.forEach(function (p) {
        if (!p.w || p.appliance === 'space') return;
        o.push(poly(foot(p), 'fill="' + (p.kind === 'appliance' ? '#E9ECEB' : fin) + '" stroke="' + INK + '" stroke-width="0.4"'));
        if (p.corner === 'blind' && p.cornerEnd) {
          var b0 = p.cornerEnd === 'left' ? p.x : p.x + p.w - DEPTH.base, b1 = b0 + DEPTH.base;
          o.push(poly([P(fr, b0, 0.6), P(fr, b1, 0.6), P(fr, b1, p.d - 0.6), P(fr, b0, p.d - 0.6)], 'fill="none" stroke="' + LINE + '" stroke-width="0.25" stroke-dasharray="1.5 1"'));
        }
        var c = P(fr, p.x + p.w / 2, p.d / 2), txt = p.code || p.label;
        if (p.w >= 9) o.push(label(c[0], c[1], ang, txt, Math.min(fs * 0.8, p.w / Math.max(4, txt.length) * 1.7), INK, 600));
      });
      lay.upper.forEach(function (p) { if (p.w && p.appliance !== 'upperSpace') o.push(poly(foot(p), 'fill="none" stroke="' + LINE + '" stroke-width="0.3" stroke-dasharray="2 1.2"')); });
      function dimAlong(t0, t1, off, txt, small) {
        var a0 = P(fr, t0, off), a1 = P(fr, t1, off), tk = fs * 0.45, nx = fr.n[0] * tk, ny = fr.n[1] * tk;
        o.push('<g stroke="' + LINE + '" stroke-width="0.25"><line x1="' + r2(a0[0]) + '" y1="' + r2(a0[1]) + '" x2="' + r2(a1[0]) + '" y2="' + r2(a1[1]) + '"/>' +
          '<line x1="' + r2(a0[0] - nx) + '" y1="' + r2(a0[1] - ny) + '" x2="' + r2(a0[0] + nx) + '" y2="' + r2(a0[1] + ny) + '"/><line x1="' + r2(a1[0] - nx) + '" y1="' + r2(a1[1] - ny) + '" x2="' + r2(a1[0] + nx) + '" y2="' + r2(a1[1] + ny) + '"/></g>');
        if (Math.abs(t1 - t0) >= fs * 1.6) { var m = P(fr, (t0 + t1) / 2, off + (off < 0 ? -fs * 0.8 : fs * 0.8)); o.push(label(m[0], m[1], ang, txt, small ? fs * 0.62 : fs * 0.78, INK, small ? null : 600)); }
      }
      var outer = wl.position === 'island' ? -10 - fs * 1.6 : -T - fs * 2.2;
      dimAlong(0, lay.lengthIn, outer, wl.wall.name + ' · ' + feetInches(lay.lengthIn));
      lay.base.filter(function (p) { return p.w; }).forEach(function (p) { dimAlong(p.x, p.x + p.w, Math.max(DEPTH.base, p.corner === 'diagonal' ? 0 : p.d) + fs * 1.2, inches(p.w), true); });
      if (wl.position === 'island') {
        var fromBack = +(wl.wall && wl.wall.islandY) || 42, fromLeft = +(wl.wall && wl.wall.islandX) || 36, mid = fromLeft + lay.lengthIn / 2;
        o.push('<g stroke="' + LINE + '" stroke-width="0.25" stroke-dasharray="1.5 1"><line x1="' + r2(mid) + '" y1="0" x2="' + r2(mid) + '" y2="' + r2(fromBack) + '"/><line x1="0" y1="' + r2(fromBack + 12) + '" x2="' + r2(fromLeft) + '" y2="' + r2(fromBack + 12) + '"/></g>');
        o.push(label(mid + fs * 0.9, fromBack / 2, -90, inches(fromBack) + ' from back wall', fs * 0.6, INK));
        o.push(label(fromLeft / 2, fromBack + 12 - fs * 0.8, 0, inches(fromLeft), fs * 0.6, INK));
      }
    });
    o.push(label(W / 2, D + pad * 0.55, 0, 'Solid: base cabinets and appliances · dashed: uppers above · inches', fs * 0.62, LINE));
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- trim: crown molding and toe kick, feet quoted vs about how much is needed ---------- */
  var TRIM = [
    { key: 'crown', label: 'Crown molding', re: /^(ACM|LACM|CM|SCM|RCM|BCM|COV)(\d*)(S?)(\(.*\))?$/ },
    { key: 'toe', label: 'Toe kick', re: /^(TK|TKC)(\d*)$/ }
  ];
  function runsOf(list, pick) {
    var groups = [], cur = null;
    list.filter(function (p) { return p.w && pick(p); }).sort(function (a, b) { return a.x - b.x; }).forEach(function (p) {
      if (cur && p.x <= cur.end + 0.5) { cur.end = Math.max(cur.end, p.x + p.w); cur.depth = Math.max(cur.depth, p.d); }
      else groups.push(cur = { start: p.x, end: p.x + p.w, depth: p.d });
    });
    return groups;
  }
  function trimCheck(lines, layouts) {
    var need = { crown: 0, toe: 0 }, crownOn = false;
    (layouts || []).forEach(function (x) {
      var L = x.layout || x, len = L.lengthIn, rl = L.reserve.left, rr = L.reserve.right;
      if (L.crown) {
        crownOn = true;
        runsOf(L.upper, function (p) { return p.kind === 'wall'; }).forEach(function (g) {
          need.crown += g.end - g.start;
          if (g.start > rl.upper + 0.5) need.crown += g.depth;   // an open end: the molding returns to the wall
          if (g.end < len - rr.upper - 0.5) need.crown += g.depth;
        });
      }
      runsOf(L.base, function (p) { return p.kind === 'base' || p.kind === 'vanity'; }).forEach(function (g) {
        need.toe += g.end - g.start;
        if (L.island || g.start > rl.base + 0.5) need.toe += g.depth - 3;
        if (L.island || g.end < len - rr.base - 0.5) need.toe += g.depth - 3;
      });
    });
    return TRIM.map(function (k) {
      var skus = [], ft = 0;
      (lines || []).forEach(function (l) {
        var m = splitSku(l.sku).code.match(k.re); if (!m) return;
        skus.push(splitSku(l.sku).code + ' ×' + l.qty); ft += (m[3] ? 8 : (+m[2] || 8)) * (+l.qty || 0);   // RCM4S is a profile number, not 4′
      });
      var needFt = Math.ceil(need[k.key] / 12 * 1.1);   // plus 10% for cuts
      return { key: k.key, label: k.label, skus: skus, quotedFt: ft, neededFt: needFt, ok: ft >= needFt, show: skus.length > 0 || (needFt > 0 && (k.key !== 'crown' || crownOn)) };
    }).filter(function (r) { return r.show; });
  }
  function sizesFromLines(lines) {
    var out = {};
    (lines || []).forEach(function (l) {
      var w = +(l.width || l.w), h = +(l.height || l.h), d = +(l.depth || l.d);
      if (w || h || d) out[splitSku(l.sku).code] = { w: w || null, h: h || null, d: d || null, source: 'pdf' };
    });
    return out;
  }

  function emptyWall(name, position, lengthIn) {
    return { id: newId('wall'), name: name || 'Wall', position: position || 'back', lengthIn: lengthIn || 120, specs: {}, cornerLeft: false, cornerRight: false, base: [], upper: [], openings: [] };
  }

  return { VERSION: VERSION, STD: STD, APPLIANCES: APPLIANCES, splitSku: splitSku, parseSku: parseSku, describe: describe, inches: inches, feetInches: feetInches,
    layoutWall: layoutWall, layoutRoom: layoutRoom, roomChecks: roomChecks, landing: landing, RULE: RULE, applyLineChanges: applyLineChanges, reviseRooms: reviseRooms, copyRooms: copyRooms, svgPlan: svgPlan, trimCheck: trimCheck, sizesFromLines: sizesFromLines, reconcile: reconcile, placedCounts: placedCounts, autoPlace: autoPlace, svgElevation: svgElevation, svg3D: svg3D, autoYaw: autoYaw, moveItem: moveItem, fronts: fronts,
    emptyWall: emptyWall, newId: newId, finishFor: finishFor };
}));
