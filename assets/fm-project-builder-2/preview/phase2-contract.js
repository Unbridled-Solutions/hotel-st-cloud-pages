/*
 * Phase 2 preview · the contract builder (window.P2Contract). Steps on the left, the agreement on the right, updating as you go.
 *   1 Buyer, site and schedule → 2 Price and scope → 3 Exhibit A → 4 Special conditions → 5 Review and send.
 *   Anything missing is listed in red on the step it belongs to and above the preview. The contract uses the approved
 *   estimate. HANDOFF §38.
 */
(function () {
  'use strict';
  var ES = window.FMEstimate, FF = window.FMFiles;
  var STEPS = ['Buyer, site and schedule', 'Price and scope', 'Exhibit A', 'Special conditions', 'Review and send'];
  /* which step fixes each ready-check problem */
  var STEP_OF = { customer: 0, signer: 0, buyerEmail: 0, project: 0, installAddress: 0, installDate: 0, dueDates: 0, duePast: 0, dueOrder: 0, plan: 0, schedule: 0,
    lines: 1, total: 1, quoteMath: 1, estimate: 1, design: 1, elevations: 1, fmSigner: 4 };
  function stepOf(b) { return STEP_OF[b.id] != null ? STEP_OF[b.id] : (b.step === 'customer' ? 0 : b.step === 'quote' ? 1 : 4); }

  function U(c, j) { var u = c.ui.cb; if (!u || u.job !== j.jobCode) u = c.ui.cb = { job: j.jobCode, step: 0 }; return u; }

  function render(c, j, P) {
    var esc = c.esc, $f = c.money, u = U(c, j), r = P.r, out = P.out;
    var byStep = STEPS.map(function () { return []; }); r.blockers.forEach(function (b) { byStep[stepOf(b)].push(b); });
    var nav = '<nav class="cb-steps" aria-label="Contract steps">' + STEPS.map(function (s, i) {
      var cls = byStep[i].length ? 'is-missing' : i < 4 ? 'is-done' : '';
      return '<a href="#" data-cbstep="' + i + '" class="' + cls + '"' + (u.step === i ? ' aria-current="step"' : '') + '><span>' + (byStep[i].length ? '!' : i < 4 ? '✓' : i + 1) + '</span> ' + esc(s) + '</a>'; }).join('') + '</nav>';
    var missing = byStep[u.step].length ? '<ul class="p2-list p2-checks cb-missing">' + byStep[u.step].map(function (b) { return '<li class="p2-block"><span>' + esc(b.message) + '</span>' + P.fixLink(b) + '</li>'; }).join('') + '</ul>' : '';
    var left = [s1, s2, s3, s4, s5][u.step](c, j, P, u);
    var stepNav = '<div class="p2-between cb-nav"><button class="fmp1-btn fmp1-btn--quiet" data-cbstep="' + Math.max(0, u.step - 1) + '"' + (u.step ? '' : ' disabled') + '>Back</button>' +
      (u.step < 4 ? '<button class="fmp1-btn fmp1-btn--primary" data-cbstep="' + (u.step + 1) + '">Next: ' + esc(STEPS[u.step + 1]) + '</button>' : '<span></span>') + '</div>';
    var allMissing = r.blockers.length ? '<div class="cb-redlist" role="status"><b>Still missing (' + r.blockers.length + '):</b><ul>' + r.blockers.map(function (b) { return '<li><a href="#" data-cbstep="' + stepOf(b) + '">' + esc(b.message) + '</a></li>'; }).join('') + '</ul></div>' : '<div class="cb-ready">✓ Nothing missing. Ready to send.</div>';
    var preview = '<div class="cb-preview"><div class="p2-between cb-prevhead"><b>The agreement, as the buyer will see it</b><button class="fmp1-btn fmp1-btn--quiet" data-open-packet>Preview the agreement</button></div>' + allMissing +
      '<div class="cb-doc" data-cbdoc>' + c.packetHTML(j) + '</div></div>';
    return '<div class="fmp1-card p2-pad cb-head"><span class="fmp1-eyebrow">Contract builder</span>' + nav + '</div>' +
      '<div class="cb-wrap"><div class="fmp1-card p2-pad cb-left">' + (out ? '<div class="fmp1-note fmp1-note--info p2-small"><span>Out for signature: the agreement is frozen as sent. Cancel the request on step 5 to change anything.</span></div>' : '') + missing + left + stepNav + '</div>' + preview + '</div>';
  }

  function s1(c, j, P) {
    return '<h2 class="fmp1-h cb-h">1. Buyer, site and schedule</h2><p class="p2-small fmp1-muted">Who signs, where the cabinets go, and when each payment is due. The deposit is always due on signing.</p>' +
      P.details.replace('<details class="p2-ctdet"', '<details class="p2-ctdet" open');
  }
  function s2(c, j, P) {
    var esc = c.esc, $f = c.money, t = ES.totals(j), st = ES.status(j), a = st.approval;
    var rows = t.models.map(function (m) { return '<li><span>' + esc(m.name) + (m.homes > 1 ? ' × ' + m.homes + ' homes' : '') + ' · ' + m.lines + ' cabinet line' + (m.lines === 1 ? '' : 's') + '</span><b>' + $f(m.totalCents) + '</b></li>'; }).join('') +
      t.extras.rows.map(function (x) { return '<li><span>' + esc(x.label) + '</span><b>' + $f(x.amountCents + x.taxCents) + '</b></li>'; }).join('');
    var p = j.pricing || {};
    return '<h2 class="fmp1-h cb-h">2. Price and scope</h2><p class="p2-small fmp1-muted">The contract uses the approved estimate. To change a price or a cabinet, change the estimate and approve it again.</p>' +
      '<div class="cb-estimate ' + (st.key === 'approved' ? 'is-ok' : 'is-bad') + '"><div class="p2-between"><b>' + (st.key === 'approved' ? '✓ Approved estimate' : st.key === 'changed' ? 'The estimate changed since it was approved' : 'The estimate isn\'t approved yet') + '</b><b class="cb-total">' + $f(t.totalCents) + '</b></div>' +
      (a ? '<span class="p2-small fmp1-faint">Approved by ' + esc(a.by) + (a.at ? ' on ' + c.longDate(String(a.at).slice(0, 10)) : '') + ' at ' + $f(a.totalCents) + '</span>' : '') +
      '<ul class="p2-list p2-small">' + rows + '<li><span>Sales tax (in the total)</span><b>' + $f(t.taxCents) + '</b></li></ul>' +
      '<p class="p2-small">' + (p.assemblyHours ? 'Assembly included: ' + p.assemblyHours + ' h per home.' : 'Assembly not included; the buyer assembles.') + (j.deliveryDate ? ' Delivery / install estimate ' + c.longDate(j.deliveryDate) + '.' : '') + '</p>' +
      '<a class="fmp1-btn' + (st.key === 'approved' ? ' fmp1-btn--quiet' : ' fmp1-btn--primary') + '" href="#/job/' + encodeURIComponent(j.jobCode) + '/estimate">' + (st.key === 'approved' ? 'Open the estimate' : 'Go to the estimate and approve it') + '</a></div>' +
      (j.designFirst ? '<p class="p2-small">' + (j.designApproval ? '✓ Design version ' + j.designApproval.version + ' approved by the customer.' : j.designApprovalSkipped ? 'Priced before design approval: ' + esc(j.designApprovalSkipped.reason) : '<b style="color:var(--fmp1-alert-ink)">The customer hasn\'t approved the design yet.</b>') + '</p>' : '') + P.ack;
  }
  function s3(c, j, P, u) {
    var esc = c.esc, T = j.contractTerms || {}, on = !T.exhibitOff, elev = j.elevations && (j.elevations.rooms || []).length;
    var docs = (j.documents || []).filter(function (d) { return !d.removed && (d.kind === 'supporting' || (d.uploadedBy && d.kind !== 'contract' && d.changeOrder == null)); });
    var picks = docs.map(function (d) { var k = FF ? FF.key(d) : d.file, ck = T.exhibitDocs && T.exhibitDocs[k];
      return '<label class="cb-doc-pick"><input type="checkbox" data-cbexdoc="' + esc(k) + '"' + (ck ? ' checked' : '') + (on && !P.out ? '' : ' disabled') + '> <span><b>' + esc(d.title || d.file) + '</b><span class="p2-small fmp1-faint">' + esc((FF && FF.CATEGORIES[d.category] ? FF.CATEGORIES[d.category].label : d.kind) || '') + ' · ' + esc(d.file) + '</span></span></label>'; }).join('');
    return '<h2 class="fmp1-h cb-h">3. Exhibit A</h2><p class="p2-small fmp1-muted">What\'s attached to the agreement and part of it. The Final Job Quote always is; the elevation sheets are when the project has them.</p>' +
      '<label class="p2-row p2-small"><input type="checkbox" data-cbexon' + (on ? ' checked' : '') + (P.out ? ' disabled' : '') + '> List Exhibit A in the agreement</label>' +
      '<ul class="p2-list p2-small"><li><span>Final Job Quote' + ((j.models || []).length > 1 ? 's' : '') + '</span><b>✓ always attached</b></li><li><span>Elevation sheets</span><b>' + (elev ? (j.elevAck ? '✓ attached, marked preliminary' : '✓ attached') : 'none drawn') + '</b></li></ul>' +
      '<b class="p2-small">Supporting documents (plans, photos, specs from the Documents tab)</b>' + (picks ? '<div class="cb-picks">' + picks + '</div>' : '<p class="p2-small fmp1-faint">None uploaded. Add architectural plans or photos on the Documents tab to attach them here.</p>') +
      '<p class="p2-small fmp1-faint">Each ticked document follows the agreement as an addendum (A-1, A-2…) and is covered by the document\'s fingerprint when it\'s sent.</p>';
  }
  function s4(c, j, P, u) {
    var esc = c.esc, T = j.contractTerms || {}, list = T.special || [], dis = P.out ? ' disabled' : '';
    return '<h2 class="fmp1-h cb-h">4. Special conditions</h2><p class="p2-small fmp1-muted">Anything specific to this job, in plain words. Each one appears in its own "Special conditions" section of the agreement. Most jobs need none.</p>' +
      (list.length ? '<ol class="cb-special">' + list.map(function (t, i) { return '<li><textarea class="fmp1-input" rows="2" data-cbspecial="' + i + '"' + dis + '>' + esc(t) + '</textarea>' + (P.out ? '' : '<button class="fmp1-btn fmp1-btn--quiet" data-cbspecialrm="' + i + '">Remove</button>') + '</li>'; }).join('') + '</ol>' : '<p class="p2-empty">No special conditions.</p>') +
      (P.out ? '' : '<div class="p2-row p2-wrap"><button class="fmp1-btn" data-cbspecialadd="">+ Add a special condition</button>' +
        ['Buyer supplies the countertops; Fremont Makers isn\'t responsible for countertop fit.', 'Cabinets are held at the shop up to 30 days after they arrive; storage after that is $50 a week.', 'Delivery is curbside; the buyer arranges carrying cabinets inside.'].map(function (t) { return '<button class="fmp1-btn fmp1-btn--quiet" data-cbspecialadd="' + esc(t) + '">+ ' + esc(t.split(';')[0].split(' up to')[0]) + '</button>'; }).join('') + '</div>');
  }
  function s5(c, j, P) {
    var esc = c.esc, users = window.P2Users ? window.P2Users.list() : [], sp = j.salesperson || (j.fmSigner && j.fmSigner.name) || '';
    return '<h2 class="fmp1-h cb-h">5. Review and send</h2>' +
      (P.checks ? '<ul class="p2-list p2-checks">' + P.checks + '</ul>' : '<p class="p2-ok">✓ Everything checks out.</p>') +
      '<div class="cb-people">' + P.signer + '<label class="p2-fld" style="max-width:300px"><span>Salesperson on this job</span><select class="fmp1-input" data-cbsales' + (P.out ? '' : '') + '><option value="">Choose…</option>' + users.map(function (x) { return '<option' + (x.name === sp ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select><span class="p2-small fmp1-faint">Gets an email when the buyer signs. Countersigns by default.</span></label></div>' +
      '<p class="p2-small">Look over the agreement on the right, or open <b>Preview the agreement</b> to see it full size and print it.</p>' + P.errs + P.send;
  }

  /* fit the agreement into the preview column after each render */
  function fit() {
    var box = document.querySelector('[data-cbdoc]'); if (!box) return;
    var scale = Math.min(1, (box.clientWidth - 12) / 816);
    [].forEach.call(box.querySelectorAll('.fm-p1-doc'), function (d) { d.style.zoom = scale < 1 ? String(scale) : ''; });
  }
  var obs = new MutationObserver(function () { fit(); });
  function watch() { var root = document.getElementById('p2'); if (root) obs.observe(root, { childList: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.addEventListener('resize', fit);

  function terms(c, j, fn, log) { c.store.update(j.jobCode, function (x) { x.contractTerms = x.contractTerms || { special: [], exhibitDocs: {} }; fn(x.contractTerms, x); return x; }, log || null, c.me().name); }
  function click(c, t) {
    var h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'contract') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j || j.stage !== 'quote') return false;
    var u = U(c, j), d = t.dataset;
    if (d.cbstep != null) { u.step = +d.cbstep; c.render(); var l = document.querySelector('.cb-left'); if (l && l.scrollIntoView) l.scrollIntoView({ block: 'start' }); return true; }
    if (d.ctfix) {   // a Fix link: open the step that has the field, then let the Contract tab focus it
      var map = { 'ct-fmsigner': 4, 'ct-elack': 1 }; u.step = map[d.ctfix] != null ? map[d.ctfix] : 0; c.render(); return false;
    }
    var frozen = j.esign && window.FMContract.isQuoteFrozen(j.esign.state); if (frozen) return false;
    if (d.cbspecialadd != null) { terms(c, j, function (T) { T.special = (T.special || []).concat([d.cbspecialadd]); }, d.cbspecialadd ? 'Special condition added: ' + d.cbspecialadd : null); c.render(); return true; }
    if (d.cbspecialrm != null) { terms(c, j, function (T) { T.special.splice(+d.cbspecialrm, 1); }, 'Special condition removed.'); c.render(); return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target, d = el.dataset, h = location.hash.replace(/^#\/?/, '').split('/'); if (h[0] !== 'job' || h[2] !== 'contract') return false;
    var j = c.store.job(decodeURIComponent(h[1] || '')); if (!j || j.stage !== 'quote') return false;
    if (d.cbspecial != null) { terms(c, j, function (T) { T.special[+d.cbspecial] = el.value; }, 'Special condition ' + (+d.cbspecial + 1) + ' edited.'); c.render(); return true; }
    if (el.hasAttribute('data-cbexon')) { terms(c, j, function (T) { T.exhibitOff = !el.checked; }, 'Exhibit A ' + (el.checked ? 'listed' : 'left out') + '.'); c.render(); return true; }
    if (d.cbexdoc) { terms(c, j, function (T) { T.exhibitDocs = T.exhibitDocs || {}; if (el.checked) T.exhibitDocs[d.cbexdoc] = true; else delete T.exhibitDocs[d.cbexdoc]; }, 'Exhibit A: ' + d.cbexdoc + (el.checked ? ' attached.' : ' removed.')); c.render(); return true; }
    if (el.hasAttribute('data-cbsales')) { c.store.update(j.jobCode, function (x) { x.salesperson = el.value || null; return x; }, 'Salesperson set to ' + (el.value || 'none') + '.', c.me().name); c.render(); return true; }
    return false;
  }

  window.P2Contract = { render: render, click: click, change: change, STEPS: STEPS, fit: fit };
  if (window.P2) window.P2.render();
})();
