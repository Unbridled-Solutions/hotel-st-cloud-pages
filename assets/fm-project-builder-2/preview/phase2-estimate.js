/*
 * Phase 2 preview · the Estimate tab, step by step (window.P2Estimate). Uses FMEstimate (src/fm-phase2-estimate.js).
 *   1 Cabinets → 2 Assembly and delivery → 3 Extras and discounts → 4 Review and approve, with the running total on top.
 *   Editing is open while the job is a quote that isn't out for signature. HANDOFF §37.
 */
(function () {
  'use strict';
  var ES = window.FMEstimate, CO = window.FMChangeOrder, K = window.FMContract, EL = window.FMElev;
  var PRESETS = [['Hardware (pulls and knobs)', 'product'], ['Crown molding', 'product'], ['Freight', 'other'], ['Install', 'labor'], ['Sale or discount', 'discount']];

  function editable(j) { return j.stage === 'quote' && !(j.esign && K.isQuoteFrozen(j.esign.state)) && !j.testVoid; }
  function U(c, j) { var u = c.ui.est; if (!u || u.job !== j.jobCode) u = c.ui.est = { job: j.jobCode, step: 0, model: 0 }; return u; }
  function toCents(v) { var n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isNaN(n) ? NaN : Math.round(n * 100); }
  function save(c, j, log, fn) {
    c.store.update(j.jobCode, function (x) { fn(x); window.P2Flows.reprice(x); return x; }, log, c.me().name);
  }
  /* elevations against the estimate, for Review (model by model) */
  function recFor(j) {
    var E = j.elevations; if (!E || !EL || !(E.rooms || []).length) return null;
    var rows = [], single = (j.models || []).length === 1;
    (j.models || []).forEach(function (m) {
      var rooms = E.rooms.filter(function (r) { return single || r.set === m.name; }); if (!rooms.length) return;
      var sizes = EL.sizesFromLines(m.lines || []); Object.keys(E.sizes || {}).forEach(function (k) { sizes[k] = E.sizes[k]; });
      EL.reconcile(m.lines || [], rooms, sizes).rows.forEach(function (r) { rows.push(r); });
    });
    return { rows: rows, drawn: rows.some(function (r) { return r.placed > 0; }) };
  }
  function known(j) {
    var out = {};
    function put(l) { var c = l.unitCostCents; if (l.sku && c > 0) out[String(l.sku).toUpperCase()] = { sku: l.sku, desc: l.desc, unitCostCents: c }; }
    (window.P2Flows.samplePdfs ? window.P2Flows.samplePdfs() : []).forEach(function (p) { p.lines.forEach(put); });
    (j.models || []).forEach(function (m) { (m.lines || []).forEach(put); });
    return out;
  }

  /* ---------- the tab ---------- */
  function render(c, j) {
    var esc = c.esc, $f = c.money, u = U(c, j), ed = editable(j), t = ES.totals(j), st = ES.status(j);
    var tone = st.key === 'approved' ? 'fmp1-pill--good' : st.key === 'changed' ? 'fmp1-pill--alert' : 'fmp1-pill--proposed';
    var bar = '<div class="fmp1-card p2-pad es-bar"><div class="es-total"><span class="fmp1-eyebrow">Estimate total</span><b>' + $f(t.totalCents) + '</b>' +
      '<span class="p2-small fmp1-faint">' + t.lineCount + ' cabinet line' + (t.lineCount === 1 ? '' : 's') + (t.models.length > 1 ? ' · ' + t.models.length + ' models' : '') + (t.extras.rows.length ? ' · ' + t.extras.rows.length + ' extra' + (t.extras.rows.length > 1 ? 's' : '') : '') + ' · tax ' + $f(t.taxCents) + (t.bid ? ' · priced by bid' : '') + '</span></div>' +
      '<span class="fmp1-pill ' + tone + '">' + esc(st.label) + '</span></div>' +
      '<nav class="es-steps" aria-label="Estimate steps">' + ES.STEPS.map(function (s, i) { return '<a href="#" data-esstep="' + i + '"' + (u.step === i ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '</span> ' + esc(s) + '</a>'; }).join('') + '</nav>';
    if (!ed && j.stage !== 'quote') bar += '<div class="fmp1-note fmp1-note--info p2-small"><span>This is the estimate as contracted. Changes after signing go through a change order.</span></div>';
    else if (!ed) bar += '<div class="fmp1-note fmp1-note--info p2-small"><span>The contract is out for signature, so the estimate is locked. Cancel the request on the Contract tab to change it.</span></div>';
    var gate = '';
    if (ES.needsDesignApproval(j) && u.step < 3) {
      gate = '<div class="fmp1-note fmp1-note--alert es-gate" role="status"><span><b>Design approval comes first.</b> This project started from a design. Get the customer\'s OK on the Elevations tab (Customer approved), then price it.</span>' +
        '<span class="p2-row"><a class="fmp1-btn fmp1-btn--primary" href="#/job/' + encodeURIComponent(j.jobCode) + '/elevations">Go to Elevations</a>' + (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-esskip>Price it anyway…</button>' : '') + '</span>' +
        (u.skip ? '<div class="p2-form" style="flex-basis:100%"><label class="p2-fld" style="flex:1"><span>Why price before approval? (logged)</span><input class="fmp1-input" data-esf="skipWhy" value="' + esc(u.skipWhy || '') + '" data-autofocus></label><button class="fmp1-btn" data-esskipgo>Price it anyway</button></div>' : '') + '</div>';
      if (!j.models || !t.lineCount) return bar + gate;
    }
    var body = [step1, step2, step3, step4][u.step](c, j, u, ed, t);
    var nav = '<div class="p2-between es-nav"><button class="fmp1-btn fmp1-btn--quiet" data-esstep="' + Math.max(0, u.step - 1) + '"' + (u.step ? '' : ' disabled') + '>Back</button>' +
      (u.step < 3 ? '<button class="fmp1-btn fmp1-btn--primary" data-esstep="' + (u.step + 1) + '">Next: ' + esc(ES.STEPS[u.step + 1]) + '</button>' : (st.key === 'approved' && j.stage === 'quote' ? '<a class="fmp1-btn fmp1-btn--primary" href="#/job/' + encodeURIComponent(j.jobCode) + '/contract">Next: build the contract</a>' : '<span></span>')) + '</div>';
    return bar + gate + '<div class="fmp1-card p2-pad es-body">' + body + nav + '</div>';
  }

  function step1(c, j, u, ed, t) {
    var esc = c.esc, $f = c.money, models = j.models && j.models.length ? j.models : [{ name: j.projectName || 'Project', qty: 1, lines: [] }];
    var mi = Math.min(u.model, models.length - 1), m = models[mi], pm = t.models[mi];
    var tabs = models.length > 1 ? '<div class="p2-chips" role="group" aria-label="Model">' + models.map(function (x, i) { return '<button class="fmp1-btn" data-esmodel="' + i + '" aria-pressed="' + (i === mi) + '">' + esc(x.name) + (x.qty > 1 ? ' × ' + x.qty : '') + '</button>'; }).join('') + '</div>' : '';
    var rows = (m.lines || []).map(function (l, li) {
      var pl = pm && pm.priced ? pm.priced.lines[li] : null;
      return '<tr><td class="fmp1-code">' + esc(l.sku) + '</td><td>' + esc(l.desc || '') + '</td>' +
        '<td class="r">' + (ed ? '<span class="es-qty"><button class="fmp1-btn fmp1-btn--quiet" data-esq="' + mi + ':' + li + ':-1" aria-label="One fewer">−</button><b>' + l.qty + '</b><button class="fmp1-btn fmp1-btn--quiet" data-esq="' + mi + ':' + li + ':1" aria-label="One more">+</button></span>' : l.qty) + '</td>' +
        '<td class="r">' + $f(l.unitCostCents || 0) + '</td>' +
        '<td class="r">' + (ed && !l.noCharge ? '<input class="fmp1-input es-mk" inputmode="decimal" data-esmk="' + mi + ':' + li + '" value="' + l.markupPct + '" aria-label="Markup % for ' + esc(l.sku) + '">%' : (l.noCharge ? 'no charge' : l.markupPct + '%')) + '</td>' +
        '<td class="r"><b>' + (pl ? $f(pl.noCharge ? 0 : pl.totalCents) : '—') + '</b></td>' +
        '<td class="r">' + (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-esrm="' + mi + ':' + li + '" aria-label="Remove ' + esc(l.sku) + '">Remove</button>' : '') + '</td></tr>';
    }).join('');
    var add = ed ? '<div class="p2-row p2-wrap es-add"><button class="fmp1-btn" data-esaddopen>+ Add a cabinet</button>' +
      '<label class="fmp1-btn p2-filebtn">Upload SKUs<input type="file" data-esfile accept=".csv,.tsv,.txt,.pdf"></label><button class="fmp1-btn" data-espaste>Paste SKUs</button>' +
      '<label class="p2-fld" style="min-width:230px"><span>Or a supplier PDF on file</span><select class="fmp1-input" data-espdf><option value="">Choose a PDF…</option>' + (window.P2Flows.samplePdfs ? window.P2Flows.samplePdfs() : []).map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select></label></div>' : '';
    var A = u.addForm, form = A ? '<div class="p2-form"><b style="flex-basis:100%">Add a cabinet</b>' + fld('SKU', 'data-esa="sku" data-autofocus', A.sku) + fld('Description', 'data-esa="desc"', A.desc) + fld('Qty', 'data-esa="qty" inputmode="numeric"', A.qty) + fld('Unit cost ($)', 'data-esa="cost" inputmode="decimal"', A.cost) +
      '<button class="fmp1-btn fmp1-btn--primary" data-esaddsave>Add</button><button class="fmp1-btn fmp1-btn--quiet" data-esaddcancel>Cancel</button>' + (A.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(A.error) + '</span>' : '') + '</div>' : '';
    var paste = u.paste ? '<div class="p2-form"><label class="p2-fld" style="flex:1 1 100%"><span>One cabinet per line with its quantity: "W3042-SBW 2" or "2 x DC224". Rows copied from a spreadsheet work too.</span><textarea class="fmp1-input p2-co-paste" rows="5" data-esf="pasteText" data-autofocus>' + esc(u.pasteText || '') + '</textarea></label><button class="fmp1-btn fmp1-btn--primary" data-espasteadd>Add these</button><button class="fmp1-btn fmp1-btn--quiet" data-espaste>Cancel</button></div>' : '';
    var note = u.note ? '<div class="fmp1-note fmp1-note--' + (u.note.missing && u.note.missing.length ? 'alert' : 'good') + ' p2-small" role="status"><span>' + esc(u.note.text) + '</span>' +
      (u.note.missing && u.note.missing.length ? '<ul class="p2-small" style="flex-basis:100%;margin:4px 0 0">' + u.note.missing.map(function (x, i) { return '<li><span class="fmp1-code">' + esc(x.sku) + '</span> ×' + x.qty + ' needs a unit cost <button class="p2-linkbtn" data-esaddsku="' + i + '">Add with a cost</button></li>'; }).join('') + '</ul>' : '') +
      ' <button class="fmp1-btn fmp1-btn--quiet" data-esnoteok>OK</button></div>' : '';
    return '<h2 class="fmp1-h es-h">1. Cabinets</h2><p class="p2-small fmp1-muted">The SKUs from the supplier, with this job\'s markup. Change a quantity or a line\'s markup here; costs come from the supplier PDF.</p>' + tabs + add + paste + form + note +
      (rows ? '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table es-lines"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Markup</th><th class="r">Price</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<p class="p2-empty">No cabinets yet. Upload the supplier\'s PDF or a spreadsheet of SKUs, paste them, or add one at a time.</p>') +
      (pm && pm.priced ? '<p class="p2-small" style="text-align:right">Cabinets ' + $f(pm.priced.summary.cabinetsCents) + (m.qty > 1 ? ' per home × ' + m.qty : '') + '</p>' : '');
  }
  function step2(c, j, u, ed) {
    var esc = c.esc, p = j.pricing || {}, dis = ed ? '' : ' disabled';
    function f(label, key, val, hint) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" inputmode="decimal" data-esp="' + key + '" value="' + esc(val == null ? '' : val) + '"' + dis + '>' + (hint ? '<span class="p2-small fmp1-faint">' + hint + '</span>' : '') + '</label>'; }
    return '<h2 class="fmp1-h es-h">2. Assembly and delivery</h2><p class="p2-small fmp1-muted">Set on this job, never per customer.</p>' +
      '<div class="es-grid">' + f('Assembly hours (per home)', 'assemblyHours', p.assemblyHours, 'Leave 0 when the buyer assembles') + f('Assembly rate ($/hour)', 'assemblyRate', p.assemblyRateCents != null ? (p.assemblyRateCents / 100).toFixed(2) : '') +
      '<label class="p2-fld"><span>Delivery / install date (estimate)</span><input class="fmp1-input" type="date" data-esdate value="' + esc(j.deliveryDate || '') + '"' + dis + '></label></div>' +
      '<details class="es-more"' + (u.more ? ' open' : '') + '><summary class="p2-small"><b>This job\'s pricing settings</b> (markup, manufacturer discount, G&amp;A, tax)</summary><div class="es-grid">' +
      f('Markup % (new lines)', 'markupPct', p.markupPct) + f('Mfr. discount % of cost', 'discountPctOfCost', p.discountPctOfCost) + f('G&amp;A %', 'gaPct', p.gaPct) + f('Sales tax %', 'taxPct', p.taxPct, 'On product only') + '</div></details>' + (window.P2Group3 ? window.P2Group3.taxPanel(c, j) : '');
  }
  function step3(c, j, u, ed) {
    var esc = c.esc, list = j.extras || [], dis = ed ? '' : ' disabled';
    var rows = list.map(function (x, i) {
      return '<tr><td><input class="fmp1-input" data-esx="' + i + ':label" value="' + esc(x.label) + '" aria-label="What it is"' + dis + '></td>' +
        '<td><select class="fmp1-input" data-esx="' + i + ':kind"' + dis + '>' + Object.keys(ES.EXTRA_KINDS).map(function (k) { return '<option value="' + k + '"' + ((x.kind || 'product') === k ? ' selected' : '') + '>' + esc(ES.EXTRA_KINDS[k]) + '</option>'; }).join('') + '</select></td>' +
        '<td class="r"><input class="fmp1-input p2-amt" inputmode="decimal" data-esx="' + i + ':amount" value="' + (x.amountCents ? (Math.abs(x.amountCents) / 100).toFixed(2) : '') + '" placeholder="0.00" aria-label="Amount"' + dis + '></td>' +
        '<td class="r">' + (ed ? '<button class="fmp1-btn fmp1-btn--quiet" data-esxrm="' + i + '">Remove</button>' : '') + '</td></tr>';
    }).join('');
    return '<h2 class="fmp1-h es-h">3. Extras and discounts</h2><p class="p2-small fmp1-muted">Anything not on the supplier\'s SKU list: hardware, crown, freight, install, or a sale. Product extras carry sales tax; labor and freight don\'t. A discount comes off the total.</p>' +
      (rows ? '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>What</th><th>Kind</th><th class="r">Amount ($)</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="p2-empty">No extras. Most jobs don\'t need any.</p>') +
      (ed ? '<div class="p2-row p2-wrap">' + PRESETS.map(function (p, i) { return '<button class="fmp1-btn fmp1-btn--quiet" data-esxadd="' + i + '">+ ' + esc(p[0]) + '</button>'; }).join('') + '<button class="fmp1-btn fmp1-btn--quiet" data-esxadd="-1">+ Something else</button></div>' : '');
  }
  function step4(c, j, u, ed, t) {
    var esc = c.esc, $f = c.money, r = ES.review(j, recFor(j)), st = ES.status(j);
    var sums = t.models.map(function (m) { return m.priced ? '<tr><td>' + esc(m.name) + (m.homes > 1 ? ' × ' + m.homes + ' homes' : '') + '</td><td class="r">' + $f(m.priced.summary.cabinetsCents * m.homes) + '</td><td class="r">' + (m.priced.summary.discountCents ? '−' + $f(m.priced.summary.discountCents * m.homes) : '—') + '</td><td class="r">' + $f(m.priced.summary.laborCents * m.homes) + '</td><td class="r">' + $f(m.priced.summary.gaCents * m.homes) + '</td><td class="r">' + $f(m.taxCents) + '</td><td class="r"><b>' + $f(m.totalCents) + '</b></td></tr>' : ''; }).join('') +
      t.extras.rows.map(function (x) { return '<tr><td>' + esc(x.label) + ' <span class="p2-small fmp1-faint">' + esc(ES.EXTRA_KINDS[x.kind]) + '</span></td><td class="r" colspan="4">' + $f(x.amountCents) + '</td><td class="r">' + $f(x.taxCents) + '</td><td class="r"><b>' + $f(x.amountCents + x.taxCents) + '</b></td></tr>'; }).join('');
    var lines = r.lines.map(function (l) {
      var low = l.marginPct != null && l.marginPct < ES.SETTINGS.minMarginPct;
      return '<tr' + (low || !l.costCents ? ' class="es-low"' : '') + '><td class="fmp1-code">' + esc(l.sku) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.costCents) + '</td><td class="r">' + $f(l.netCostCents) + '</td><td class="r">' + (l.noCharge ? '—' : l.markupPct + '%') + '</td><td class="r">' + $f(l.priceCents) + '</td><td class="r">' + (l.marginPct == null ? '—' : l.marginPct.toFixed(1) + '%') + '</td></tr>';
    }).join('');
    var flags = r.flags.length ? '<ul class="p2-list p2-small es-flags">' + r.flags.map(function (f) { return '<li class="' + (f.level === 'error' ? 'p2-block' : 'p2-warn') + '"><span>' + esc(f.text) + '</span>' + (f.kind === 'elev' && f.fix && ed ? '<button class="p2-linkbtn" data-esfixelev="' + esc(f.sku) + ':' + f.fix.add + '">Add ' + f.fix.add + ' to the estimate</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="p2-ok">✓ Every line has a cost, every line is over ' + ES.SETTINGS.minMarginPct + '%, and the lines add up.</p>';
    var a = st.approval;
    return '<h2 class="fmp1-h es-h">4. Review and approve <span class="p2-small fmp1-faint">(team only; the customer never sees this page)</span></h2>' +
      '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th></th><th class="r">Cabinets</th><th class="r">Mfr. discount</th><th class="r">Assembly</th><th class="r">G&amp;A</th><th class="r">Tax</th><th class="r">Total</th></tr></thead><tbody>' + sums +
      '<tr class="is-total"><td>Estimate total' + (t.bid ? ' (bid price)' : '') + '</td><td colspan="5"></td><td class="r">' + $f(t.totalCents) + '</td></tr></tbody></table></div>' +
      '<p class="p2-small">Our cost after the manufacturer discount ' + $f(t.costCents) + ' · gross margin <b>' + (r.marginPct == null ? '—' : r.marginPct.toFixed(1) + '%') + '</b> (before tax)</p>' + flags +
      (lines ? '<details class="es-more"><summary class="p2-small"><b>Every line: cost, markup, price and margin</b></summary><div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>SKU</th><th class="r">Qty</th><th class="r">Cost</th><th class="r">Net of discount</th><th class="r">Markup</th><th class="r">Price</th><th class="r">Margin</th></tr></thead><tbody>' + lines + '</tbody></table></div></details>' : '') +
      '<div class="es-approve">' + (st.key === 'approved' ? '<p class="p2-ok">✓ Approved by ' + esc(a.by) + (a.at ? ' on ' + c.longDate(String(a.at).slice(0, 10)) : '') + ' at ' + $f(a.totalCents) + '. The contract uses this estimate.</p>' :
        st.key === 'changed' ? '<div class="fmp1-note fmp1-note--alert p2-small"><span>The estimate changed after ' + esc(a.by) + ' approved it at ' + $f(a.totalCents) + '. Approve it again before the contract goes out.</span></div>' : '') +
        '<div class="p2-row">' + (ed && st.key !== 'approved' ? '<button class="fmp1-btn fmp1-btn--primary" data-esapprove' + (r.ok ? '' : ' disabled') + '>Approve this estimate</button>' : '') + '<button class="fmp1-btn" data-essheet>Print or save PDF</button>' +
        (u.err ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(u.err) + '</span>' : '') + '</div></div>';
  }
  function fld(label, attrs, val) { return '<label class="p2-fld"><span>' + label + '</span><input class="fmp1-input" ' + attrs + ' value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"></label>'; }

  /* the internal approval sheet, printable */
  function sheet(c, j) {
    var esc = c.esc, $f = c.money, r = ES.review(j, recFor(j)), t = r.totals, st = ES.status(j);
    var rows = r.lines.map(function (l) { return '<tr><td>' + esc(l.model) + '</td><td>' + esc(l.sku) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.netCostCents) + '</td><td class="r">' + (l.noCharge ? '—' : l.markupPct + '%') + '</td><td class="r">' + $f(l.priceCents) + '</td><td class="r">' + (l.marginPct == null ? '—' : l.marginPct.toFixed(1) + '%') + '</td></tr>'; }).join('');
    return '<article class="fm-p1-doc doc-sheet" aria-label="Estimate approval"><header class="doc-head">' + (window.FMQuote ? window.FMQuote.logoHTML({}) : '') + '<div class="doc-title"><div class="doc-kicker">Internal · not for the customer</div><h1>Estimate approval</h1></div></header>' +
      '<section class="doc-fields"><div><span class="k">Job</span><span class="v">' + esc(j.jobCode) + '</span></div><div><span class="k">Customer</span><span class="v">' + esc(j.customer) + '</span></div><div><span class="k">Total</span><span class="v">' + $f(t.totalCents) + '</span></div><div><span class="k">Margin</span><span class="v">' + (r.marginPct == null ? '—' : r.marginPct.toFixed(1) + '%') + '</span></div></section>' +
      '<section class="doc-sec"><table class="cert-table"><thead><tr><th>Model</th><th>SKU</th><th>Qty</th><th>Net cost</th><th>Markup</th><th>Price</th><th>Margin</th></tr></thead><tbody>' + rows + '</tbody></table></section>' +
      (r.flags.length ? '<section class="doc-sec"><h2>Checks</h2>' + r.flags.map(function (f) { return '<p>' + esc(f.text) + '</p>'; }).join('') + '</section>' : '') +
      '<section class="doc-sign"><div><span>Approved by' + (st.approval ? ' · ' + esc(st.approval.by) : '') + '</span><span>Date' + (st.approval && st.approval.at ? ' · ' + esc(String(st.approval.at).slice(0, 10)) : '') + '</span></div><div><span>Reviewed by</span><span>Date</span></div></section>' +
      '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · internal</span><span class="pg">Estimate approval</span></footer></article>';
  }

  /* ---------- events ---------- */
  function addLines(c, j, mi, list, source) {
    var k = known(j), ready = [], missing = [], mk = j.pricing && j.pricing.markupPct != null ? j.pricing.markupPct : window.P2Flows.DEFAULTS.markupPct;
    list.forEach(function (l) { var hit = k[String(l.sku).toUpperCase()], cost = l.unitCostCents || (hit && hit.unitCostCents);
      if (cost) ready.push({ sku: hit ? hit.sku : l.sku, desc: l.desc || (hit && hit.desc) || '', qty: l.qty, unitCostCents: cost, markupPct: mk }); else missing.push({ sku: l.sku, qty: l.qty, desc: l.desc || '' }); });
    if (ready.length) save(c, j, ready.length + ' cabinet line' + (ready.length > 1 ? 's' : '') + ' added to the estimate from ' + source + ' by ' + c.me().name + '.', function (x) {
      x.models = x.models && x.models.length ? x.models : [{ name: x.projectName || 'Project', qty: 1, lines: [] }];
      var m = x.models[Math.min(mi, x.models.length - 1)]; m.lines = CO.mergeLines(m.lines || [], ready, 'add').lines;
    });
    return { text: (ready.length ? 'Added ' + ready.reduce(function (t, l) { return t + l.qty; }, 0) + ' cabinets from ' + source + '.' : 'Nothing was added from ' + source + '.') + (missing.length ? ' ' + missing.length + ' SKU' + (missing.length > 1 ? 's need' : ' needs') + ' a cost.' : ''), missing: missing };
  }
  function click(c, t) {
    var h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'estimate') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j) return false;
    var u = U(c, j), d = t.dataset, ed = editable(j), mi = u.model;
    if (d.esstep != null) { u.step = +d.esstep; u.err = null; c.render(); window.scrollTo(0, 0); return true; }
    if (d.esmodel != null) { u.model = +d.esmodel; c.render(); return true; }
    if (t.hasAttribute('data-essheet')) { c.ui.viewer = { title: 'Estimate approval · ' + j.jobCode, html: sheet(c, j), from: '[data-essheet]' }; c.render(); return true; }
    if (t.hasAttribute('data-esskip')) { u.skip = !u.skip; c.render(); return true; }
    if (t.hasAttribute('data-esskipgo')) {
      if (!String(u.skipWhy || '').trim()) return true;
      c.store.update(j.jobCode, function (x) { x.designApprovalSkipped = { by: c.me().name, on: c.TODAY, reason: String(u.skipWhy).trim() }; return x; }, 'Priced before the customer approved the design (' + String(u.skipWhy).trim() + '). By ' + c.me().name + '.', c.me().name);
      u.skip = false; c.render(); return true;
    }
    if (!ed) return false;
    var p;
    if (d.esq) { p = d.esq.split(':').map(Number); save(c, j, null, function (x) { var l = x.models[p[0]].lines[p[1]]; l.qty = Math.max(1, l.qty + p[2]); }); c.render(); return true; }
    if (d.esrm) { p = d.esrm.split(':').map(Number); var rl = j.models[p[0]].lines[p[1]]; save(c, j, rl.sku + ' removed from the estimate by ' + c.me().name + '.', function (x) { x.models[p[0]].lines.splice(p[1], 1); }); c.render(); return true; }
    if (t.hasAttribute('data-esaddopen')) { u.addForm = { sku: '', desc: '', qty: '1', cost: '' }; c.render(); return true; }
    if (t.hasAttribute('data-esaddcancel')) { u.addForm = null; c.render(); return true; }
    if (t.hasAttribute('data-esaddsave')) {
      var A = u.addForm, q = parseInt(A.qty, 10), cost = toCents(A.cost), sku = String(A.sku || '').trim().toUpperCase();
      if (!sku) { A.error = 'Enter the SKU.'; c.render(); return true; }
      if (!(q > 0)) { A.error = 'Enter a quantity of 1 or more.'; c.render(); return true; }
      if (!(cost > 0)) { A.error = 'Enter the supplier\'s unit cost.'; c.render(); return true; }
      u.note = addLines(c, j, mi, [{ sku: sku, desc: A.desc, qty: q, unitCostCents: cost }], 'a cabinet added by hand'); u.addForm = null; c.render(); return true;
    }
    if (t.hasAttribute('data-espaste')) { u.paste = !u.paste; c.render(); return true; }
    if (t.hasAttribute('data-espasteadd')) { var pr = CO.parseSkus(u.pasteText || ''); u.note = addLines(c, j, mi, pr.lines, 'the pasted list'); if (pr.skipped.length) u.note.text += ' Couldn\'t read: ' + pr.skipped.slice(0, 3).join(', ') + '.'; u.paste = false; u.pasteText = ''; c.render(); return true; }
    if (t.hasAttribute('data-esnoteok')) { u.note = null; c.render(); return true; }
    if (d.esaddsku != null && u.note) { var ms = u.note.missing.splice(+d.esaddsku, 1)[0]; u.addForm = { sku: ms.sku, desc: ms.desc, qty: String(ms.qty), cost: '' }; c.render(); return true; }
    if (d.esxadd != null) { var ps = PRESETS[+d.esxadd] || ['', 'product']; save(c, j, null, function (x) { x.extras = (x.extras || []).concat([{ label: ps[0], kind: ps[1], amountCents: 0 }]); }); c.render(); return true; }
    if (d.esxrm != null) { save(c, j, 'Extra removed from the estimate by ' + c.me().name + '.', function (x) { x.extras.splice(+d.esxrm, 1); }); c.render(); return true; }
    if (d.esfixelev && !(j.models || []).some(function (m) { return (m.lines || []).some(function (l) { return String(l.sku).toUpperCase() === d.esfixelev.split(':')[0].toUpperCase(); }); })) {
      var fz = d.esfixelev.split(':'), kn = known(j)[fz[0].toUpperCase()]; u.step = 0; u.addForm = { sku: fz[0], desc: kn ? kn.desc : '', qty: fz[1], cost: kn ? (kn.unitCostCents / 100).toFixed(2) : '' }; c.render(); return true;
    }
    if (d.esfixelev) { var fx = d.esfixelev.split(':'); save(c, j, fx[0] + ' raised by ' + fx[1] + ' to match the elevations, by ' + c.me().name + '.', function (x) { x.models.forEach(function (m) { (m.lines || []).forEach(function (l) { if (String(l.sku).toUpperCase() === fx[0].toUpperCase() && fx[1] > 0) { l.qty += +fx[1]; fx[1] = 0; } }); }); }); c.render(); return true; }
    if (t.hasAttribute('data-esapprove')) {
      var ap = ES.approve(j, c.me(), new Date().toISOString(), recFor(j));
      if (!ap.ok) { u.err = ap.error; c.render(); return true; }
      c.store.update(j.jobCode, function (x) { x.estimateApproval = ap.approval; return x; }, ap.log, c.me().name); u.err = null; c.render(); return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d = el.dataset, h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'estimate') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j) return false; var u = U(c, j);
    if (d.esf) { u[d.esf] = el.value; return true; }
    if (d.esa && u.addForm) { u.addForm[d.esa] = el.value; if (d.esa === 'sku') { var k = known(j)[String(el.value).trim().toUpperCase()]; if (k) { if (!u.addForm.desc) u.addForm.desc = k.desc || ''; if (!u.addForm.cost) u.addForm.cost = (k.unitCostCents / 100).toFixed(2); var r = document.querySelector('[data-esa="cost"]'); if (r && !r.value) r.value = u.addForm.cost; var dd = document.querySelector('[data-esa="desc"]'); if (dd && !dd.value) dd.value = u.addForm.desc; } } return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target, d = el.dataset, h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'estimate') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j || !editable(j)) return input(c, e);
    var u = U(c, j), v;
    if (d.esmk) { var p = d.esmk.split(':').map(Number); v = parseFloat(el.value); if (isNaN(v) || v < 0) { c.render(); return true; }
      save(c, j, j.models[p[0]].lines[p[1]].sku + ' markup set to ' + v + '% by ' + c.me().name + '.', function (x) { var l = x.models[p[0]].lines[p[1]]; l.markupPct = v; l.edited = true; }); c.render(); return true; }
    if (d.esp) { v = parseFloat(String(el.value).replace(/[$,]/g, '')); if (isNaN(v) || v < 0) { c.render(); return true; }
      save(c, j, 'Estimate: ' + d.esp.replace(/([A-Z])/g, ' $1').toLowerCase() + ' set to ' + v + ' by ' + c.me().name + '.', function (x) {
        if (d.esp === 'assemblyRate') x.pricing.assemblyRateCents = Math.round(v * 100); else x.pricing[d.esp] = v;
        if (d.esp === 'assemblyHours' || d.esp === 'assemblyRate') x.pricing.assemblyCents = Math.round((x.pricing.assemblyHours || 0) * (x.pricing.assemblyRateCents || 0));
        if (d.esp === 'markupPct') x.models.forEach(function (m) { (m.lines || []).forEach(function (l) { if (!l.edited && !l.noCharge) l.markupPct = v; }); });
      }); c.render(); return true; }
    if (el.hasAttribute('data-esdate')) { c.store.update(j.jobCode, function (x) { x.deliveryDate = el.value || null; return x; }, 'Delivery / install estimate set to ' + (el.value || 'none') + '.', c.me().name); c.render(); return true; }
    if (d.esx) { var q = d.esx.split(':'), i = +q[0];
      save(c, j, null, function (x) { var xr = x.extras[i]; if (q[1] === 'amount') { var cc = Math.round(parseFloat(String(el.value).replace(/[$,\s−-]/g, '')) * 100); xr.amountCents = isNaN(cc) ? 0 : (xr.kind === 'discount' ? -cc : cc); } else { xr[q[1]] = el.value; if (q[1] === 'kind') xr.amountCents = el.value === 'discount' ? -Math.abs(xr.amountCents || 0) : Math.abs(xr.amountCents || 0); } });
      c.render(); return true; }
    if (el.hasAttribute('data-espdf') && el.value) {
      var hasLines = (j.models || []).some(function (m) { return (m.lines || []).length; }), pdf = window.P2Flows.samplePdfs().filter(function (x) { return x.id === el.value; })[0];
      if (!hasLines) { var msg = window.P2Flows.addSkus(c, j, el.value); u.note = { text: msg || 'Added.', missing: [] }; }
      else if (pdf) u.note = addLines(c, j, u.model, pdf.lines, pdf.name);
      c.render(); return true; }
    if (el.hasAttribute('data-esfile')) {
      var file = el.files && el.files[0]; if (!file) return true;
      if (/\.pdf$/i.test(file.name)) {   // read the supplier PDF (text, or OCR for a scanned page) and add its items; fees become extras (HANDOFF §40)
        el.value = ''; u.note = { text: 'Reading ' + file.name + '… a scanned PDF takes a few seconds.', missing: [] }; c.render();
        window.P2Pdf.read(file, function (msg) { u.note = { text: msg, missing: [] }; c.render(); }).then(function (res) {
          var n = addLines(c, j, u.model, window.FMSupplierPdf.toLines(res), file.name + (res.orderNumber ? ' (order ' + res.orderNumber + ')' : ''));
          if (res.fees.length) save(c, j, res.fees.length + ' fee(s) from ' + file.name + ' added as extras.', function (x) { x.extras = (x.extras || []).concat(res.fees.map(function (fe) { return { label: fe.label, kind: 'other', amountCents: fe.amountCents }; })); });
          if (res.problems.length) n.text += ' Check: ' + res.problems.join(' ');
          if (res.fees.length) n.text += ' ' + res.fees.length + ' fee(s) went under Extras.';
          u.note = n; c.render();
        }, function (e) { u.note = { text: file.name + ': ' + e.message + ' Paste the SKUs or upload a spreadsheet instead.', missing: [] }; c.render(); });
        return true;
      }
      file.text().then(function (txt) { var pr = CO.parseSkus(txt); u.note = addLines(c, j, u.model, pr.lines, file.name); c.render(); }); el.value = ''; return true; }
    return input(c, e);
  }

  window.P2Estimate = { render: render, click: click, input: input, change: change, recFor: recFor, sheet: sheet, editable: editable };
  if (window.P2) window.P2.render();
})();
