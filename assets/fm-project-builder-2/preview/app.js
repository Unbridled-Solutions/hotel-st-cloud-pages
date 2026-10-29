/*
 * Phase 1 preview app. Renders into #fmp1-root using FMPhase1 + FM_SAMPLE.
 * Everything stays in memory: no storage, no network, nothing written back.
 */
(function () {
  'use strict';
  var FM = window.FMPhase1, ACT = window.FMActivity, S = window.FM_SAMPLE, TODAY = S.today;
  var root = document.getElementById('fmp1-root');
  var state;

  /* Sample sign-ins. In production the actor comes from the server session. */
  var ACTORS = {
    linds: { id: 'u-linds', name: 'Linds', role: 'owner' },
    shop: { id: 'u-shop', name: 'Shop lead', role: 'staff' }
  };
  var IMPORT = { id: 'import', name: 'Imported from current tool', role: 'system' };

  function seedLog(jobs) {
    var log = [];
    jobs.forEach(function (j) {
      j.invoices.forEach(function (inv) {
        inv.payments.forEach(function (p) {
          var r = ACT.logPayment(log, j, inv, p, IMPORT, (p.date || TODAY) + 'T17:00:00Z');
          if (r.ok) log = r.log;
        });
      });
    });
    return log;
  }

  function reset() {
    var jobs = FM.jobsFromLegacy(S.legacyProjects);
    state = {
      log: seedLog(jobs),
      actorKey: 'linds',
      panel: null,           // 'note' | 'delay' | 'shipped' | 'schedule' | 'reject:<id>'
      actError: null,
      suggestions: [],
      showCsv: false,
      jobs: jobs,
      proposals: FM.detectLegacyChangeOrders(S.legacyProjects),
      handled: {},           // legacyJobCode -> 'attached' | 'dismissed'
      coDate: {},            // legacyJobCode -> chosen date
      selected: 'FM-2609-276',
      form: null,            // { jobCode, actionId, error }
      flash: null
    };
  }

  /* ---------- helpers ---------- */
  function me() { return ACTORS[state.actorKey]; }
  function nowAt() { return TODAY + 'T' + new Date().toISOString().slice(11, 23) + 'Z'; }
  function whenLabel(at) {
    var d = new Date(at);
    return longDate(at.slice(0, 10)).replace(/, \d{4}$/, '') + ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function replaceJob(next) { state.jobs = state.jobs.map(function (j) { return j.jobCode === next.jobCode ? next : j; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $f(c) { return FM.fmt(c); }
  function job(code) { return state.jobs.filter(function (j) { return j.jobCode === code; })[0]; }
  function openProposals() { return state.proposals.filter(function (p) { return !state.handled[p.legacyJobCode]; }); }
  function isPendingCO(code) { return openProposals().some(function (p) { return p.legacyJobCode === code; }); }
  function longDate(iso) {
    if (!iso) return '—';
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], p = iso.split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }
  function stagePill(j) {
    if (isPendingCO(j.jobCode)) return '<span class="fmp1-pill fmp1-pill--alert">Change order?</span>';
    var b = FM.stageBucket(j.stage);
    var cls = b === 'contracted' ? 'contracted' : b === 'proposed' ? 'proposed' : b === 'completed' ? 'good' : '';
    return '<span class="fmp1-pill' + (cls ? ' fmp1-pill--' + cls : '') + '">' + esc(FM.stageLabel(j.stage)) + '</span>' +
      (ACT.isDelayed(j) ? ' <span class="fmp1-pill fmp1-pill--alert">Delayed</span>' : '');
  }
  function invPill(st) {
    var cls = st.key === 'paid' ? 'good' : st.key === 'overdue' ? 'alert' : st.key === 'void' ? '' : 'proposed';
    return '<span class="fmp1-pill' + (cls ? ' fmp1-pill--' + cls : '') + '">' + esc(st.label) + '</span>';
  }
  function nextStep(j) {
    if (isPendingCO(j.jobCode)) return 'Attach to its job';
    if (j.stage === 'lost') return '<span class="fmp1-faint">—</span>';
    var open = j.invoices.map(function (i) { return { i: i, s: FM.invoiceState(i, TODAY) }; })
      .filter(function (x) { return x.s.key !== 'paid' && x.s.key !== 'void'; })
      .sort(function (a, b) { return (a.s.days == null ? 1e9 : a.s.days) - (b.s.days == null ? 1e9 : b.s.days); });
    if (open.length) {
      var x = open[0], name = x.i.label.split('·')[0].trim();
      return (x.s.key === 'overdue' ? '<span class="fmp1-pill fmp1-pill--alert">Overdue</span> ' : '') + esc(name) + (x.s.key === 'overdue' ? '' : ' · ' + esc(longDate(x.i.dueDate)));
    }
    var a = FM.availableActions(j)[0];
    return a ? esc(a.label) : 'Nothing due';
  }

  /* ---------- sections ---------- */
  function renderProposal(p) {
    var parent = p.parentJobCode ? job(p.parentJobCode) : null;
    var chosen = state.coDate[p.legacyJobCode] || p.suggested && p.suggested.date;
    var dateChoice = p.dateConflict ? (
      '<fieldset class="pv-dates"><legend class="fmp1-eyebrow">Which date is right?</legend>' +
      '<label><input type="radio" name="d-' + esc(p.legacyJobCode) + '" data-codate="' + esc(p.legacyJobCode) + '" value="' + p.dateConflict.document + '"' + (chosen === p.dateConflict.document ? ' checked' : '') + '> ' + longDate(p.dateConflict.document) + ' <span class="fmp1-faint">(on the change order document)</span></label>' +
      '<label><input type="radio" name="d-' + esc(p.legacyJobCode) + '" data-codate="' + esc(p.legacyJobCode) + '" value="' + p.dateConflict.listed + '"' + (chosen === p.dateConflict.listed ? ' checked' : '') + '> ' + longDate(p.dateConflict.listed) + ' <span class="fmp1-faint">(in All Projects)</span></label></fieldset>'
    ) : '';
    return '<div class="fmp1-card pv-proposal">' +
      '<div class="pv-proposal-head"><span class="fmp1-pill fmp1-pill--alert">Needs a decision</span>' +
      '<h3 class="fmp1-h pv-h3">“' + esc(p.legacyName) + '” is saved as its own project</h3>' +
      '<p class="fmp1-muted">It looks like a ' + $f(p.amountCents) + ' change order on <b>' + esc(parent ? parent.customer : 'an unknown job') + '</b> ' + (p.parentJobCode ? '<span class="fmp1-code">' + esc(p.parentJobCode) + '</span>' : '') + '. As its own project it counts as Proposed, and it never reaches the contract total.</p></div>' +
      '<ul class="pv-reasons">' + p.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '<li>Match confidence: <b>' + esc(p.confidence) + '</b></li></ul>' +
      dateChoice +
      '<div class="pv-row">' + (p.parentJobCode ? '<button class="fmp1-btn fmp1-btn--primary" data-attach="' + esc(p.legacyJobCode) + '">Attach to ' + esc(p.parentJobCode) + '</button>' : '') +
      '<button class="fmp1-btn fmp1-btn--quiet" data-dismiss="' + esc(p.legacyJobCode) + '">Not a change order</button>' +
      '<span class="fmp1-faint pv-small">The original record stays in the current tool. Phase 1 only links it.</span></div></div>';
  }

  function renderKpis() {
    var visible = state.jobs.filter(function (j) { return !isPendingCO(j.jobCode); });
    var t = FM.pipelineTotals(state.jobs, TODAY);
    var legacy = FM.legacyPipelineTotals(S.legacyProjects);
    function k(label, v, sub, tone) {
      return '<div class="fmp1-card pv-kpi"><span class="fmp1-eyebrow">' + label + '</span><span class="pv-kpi-v fmp1-num"' + (tone ? ' style="color:var(--fmp1-' + tone + ')"' : '') + '>' + v + '</span><span class="fmp1-faint pv-small">' + sub + '</span></div>';
    }
    var contractedSub = t.counts.contracted + ' jobs · incl. change orders';
    if (t.contractedCents !== legacy.Contracted) contractedSub = 'Current tool shows ' + $f(legacy.Contracted);
    var proposedSub = t.counts.proposed + ' open quote' + (t.counts.proposed === 1 ? '' : 's');
    if (t.proposedCents !== legacy.Proposed) proposedSub = 'Current tool shows ' + $f(legacy.Proposed);
    void visible;
    return '<div class="pv-kpis">' +
      k('Contracted', $f(t.contractedCents), contractedSub) +
      k('Outstanding balance', $f(t.outstandingCents), 'Owed on contracted jobs') +
      k('Overdue', $f(t.overdueCents), t.overdueCents ? 'Past due as of ' + longDate(TODAY) : 'Nothing past due', t.overdueCents ? 'alert-ink' : '') +
      k('Proposed', $f(t.proposedCents), proposedSub) +
      k('Lost', $f(t.lostCents), t.counts.lost + ' job' + (t.counts.lost === 1 ? '' : 's'), 'ink-3') +
      '</div>';
  }

  function renderList() {
    var rows = state.jobs.map(function (j) {
      var s = FM.contractSummary(j), lost = j.stage === 'lost', sel = j.jobCode === state.selected;
      var sub = j.kind === 'builder_order' ? 'Builder order · ' + j.houses.length + ' houses' : (j.projectName || '—');
      return '<tr class="' + (sel ? 'is-sel' : '') + (lost ? ' is-lost' : '') + '">' +
        '<td><span class="fmp1-code">' + esc(j.jobCode) + '</span></td>' +
        '<td><b>' + esc(j.customer) + '</b><br><span class="fmp1-faint pv-small">' + esc(sub) + '</span></td>' +
        '<td>' + stagePill(j) + '</td>' +
        '<td class="r"><b>' + $f(s.currentCents) + '</b></td>' +
        '<td class="r">' + (lost || isPendingCO(j.jobCode) || j.stage === 'quote' ? '<span class="fmp1-faint">—</span>' : $f(s.balanceCents)) + '</td>' +
        '<td class="pv-small">' + nextStep(j) + '</td>' +
        '<td class="r"><button class="fmp1-btn" data-open="' + esc(j.jobCode) + '"' + (sel ? ' aria-current="true"' : '') + '>' + (sel ? 'Open ✓' : 'Open') + '</button></td></tr>';
    }).join('');
    return '<div class="fmp1-card fmp1-table-wrap"><table class="fmp1-table pv-list"><thead><tr><th>Job</th><th>Customer · project</th><th>Stage</th><th class="r">Total</th><th class="r">Balance</th><th>Next step</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderStageArea(j) {
    var bar;
    if (j.stage === 'lost') {
      bar = '<div class="fmp1-note fmp1-note--alert">This job is marked lost.</div>';
    } else {
      var idx = FM.STAGES.map(function (s) { return s.key; }).indexOf(j.stage);
      bar = '<div class="fmp1-stages" aria-label="Job stage">' + FM.STAGES.map(function (s, i) {
        var label = s.label;
        if (s.key === 'delivered' && j.deliveryDate) label += ' · ' + longDate(j.deliveryDate).replace(/, \d{4}$/, '');
        return '<div class="fmp1-stage' + (i <= idx ? ' is-done' : i === idx + 1 ? ' is-now' : '') + '"><i></i><span>' + esc(label) + '</span></div>';
      }).join('') + '</div>';
    }
    var acts = FM.availableActions(j);
    var f = state.form && state.form.jobCode === j.jobCode ? state.form : null;
    var actsHtml;
    if (f) {
      var a = acts.filter(function (x) { return x.id === f.actionId; })[0];
      actsHtml = '<form class="pv-actform" data-actform="' + esc(a.id) + '">' +
        '<b>' + esc(a.label.replace('…', '')) + '</b>' +
        a.fields.map(function (fl) {
          return fl === 'date'
            ? '<label class="pv-fl"><span class="fmp1-eyebrow">Date</span><input class="fmp1-input" type="date" id="pv-date" name="date" value="' + TODAY + '"></label>'
            : '<label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Reason</span><input class="fmp1-input" type="text" id="pv-reason" name="reason" placeholder="Why?"></label>';
        }).join('') +
        '<button class="fmp1-btn fmp1-btn--primary" type="submit">Confirm</button><button class="fmp1-btn fmp1-btn--quiet" type="button" data-cancel>Cancel</button>' +
        (f.error ? '<span class="pv-err" role="alert">' + esc(f.error) + '</span>' : '') + '</form>';
    } else {
      actsHtml = acts.length ? acts.map(function (a) {
        return '<span class="pv-act"><button class="fmp1-btn ' + (a.tone === 'quiet' ? 'fmp1-btn--quiet' : 'fmp1-btn--primary') + '" data-act="' + esc(a.id) + '"' + (a.blockedReason ? ' disabled aria-describedby="why-' + a.id + '"' : '') + '>' + esc(a.label) + '</button>' +
          (a.blockedReason ? '<span class="fmp1-faint pv-small" id="why-' + a.id + '">' + esc(a.blockedReason) + '</span>' : '') + '</span>';
      }).join('') : '<span class="fmp1-faint pv-small">No further steps.</span>';
    }
    return bar + '<div class="pv-acts">' + actsHtml + '</div>';
  }

  function renderJob(j) {
    if (!j) return '';
    if (isPendingCO(j.jobCode)) {
      return '<div class="fmp1-card pv-pad"><p class="fmp1-muted">This record is waiting to be attached to its job. Use the panel above.</p></div>';
    }
    var s = FM.contractSummary(j), warns = FM.jobWarnings(j), lockInfo = FM.canEditLineItems(j);
    var sub = (j.kind === 'builder_order' ? j.houses.length + ' houses · ' + FM.modelTotals(j.houses).rows.length + ' models' : esc(j.projectName)) +
      (j.quoteDate ? ' · Quote ' + longDate(j.quoteDate) : '');

    var head = '<div class="fmp1-card pv-jobhead">' +
      '<div class="pv-jh-top"><div><span class="fmp1-code">' + esc(j.jobCode) + (j.kind === 'builder_order' ? ' · Builder order' : '') + '</span>' +
      '<h2 class="fmp1-h pv-h2">' + esc(j.customer) + '</h2><span class="fmp1-muted pv-small">' + sub + '</span></div>' + stagePill(j) + '</div>' +
      renderStageArea(j) +
      '<div class="fmp1-money">' +
      '<div><span class="k">Original contract</span><span class="v">' + $f(s.originalCents) + '</span></div>' +
      '<div><span class="k">Change orders (' + s.changeOrderCount + ')</span><span class="v" style="color:var(--fmp1-accent-ink)">' + FM.fmt(s.changeOrderCents, { sign: true }) + '</span></div>' +
      '<div><span class="k">Current total</span><span class="v">' + $f(s.currentCents) + '</span></div>' +
      '<div><span class="k">Paid</span><span class="v" style="color:var(--fmp1-good-ink)">' + $f(s.paidCents) + '</span></div>' +
      '<div><span class="k">Balance</span><span class="v">' + $f(s.balanceCents) + '</span></div></div>' +
      '<div class="fmp1-bar" title="' + s.paidPct + '% paid"><i style="width:' + Math.min(100, s.paidPct) + '%"></i></div>' +
      '</div>';

    var notes = '';
    if (!lockInfo.ok) notes += '<div class="fmp1-note fmp1-note--info"><span aria-hidden="true">🔒</span><span><b>Line items are locked.</b> ' + esc(lockInfo.reason) + '</span></div>';
    if (warns.length) notes += '<div class="fmp1-card pv-pad"><span class="fmp1-eyebrow">Needs attention · ' + warns.length + '</span><ul class="pv-warn">' + warns.map(function (w) { return '<li>' + esc(w.text) + '</li>'; }).join('') + '</ul></div>';

    var coRows = '<tr><td>Original contract' + (j.quoteDate ? ' <span class="fmp1-faint">· ' + longDate(j.quoteDate) + '</span>' : '') + '</td><td></td><td class="r">' + $f(s.originalCents) + '</td></tr>' +
      j.changeOrders.map(function (c) {
        var counts = FM.coCountsTowardContract(c);
        return '<tr><td>Change Order ' + c.number + ' <span class="fmp1-faint">· ' + longDate(c.date) + (c.reason ? ' · ' + esc(c.reason) : '') + '</span></td><td><span class="fmp1-pill ' + (counts ? 'fmp1-pill--good' : '') + '">' + esc(c.status) + '</span></td><td class="r" style="color:var(--fmp1-accent-ink)">' + (counts ? FM.fmt(c.amountCents, { sign: true }) : '<s>' + FM.fmt(c.amountCents, { sign: true }) + '</s>') + '</td></tr>';
      }).join('') +
      '<tr class="is-total"><td>Current contract total</td><td></td><td class="r">' + $f(s.currentCents) + '</td></tr>';
    var coPanel = '<div class="fmp1-card pv-pad"><span class="fmp1-eyebrow">Contract and change orders</span>' +
      (j.changeOrders.length ? '' : '<p class="fmp1-faint pv-small">No change orders on this job.</p>') +
      '<div class="fmp1-table-wrap"><table class="fmp1-table">' + coRows + '</table></div></div>';

    var invRows = j.invoices.map(function (inv) {
      var st = FM.invoiceState(inv, TODAY), p = FM.invoicePercent(inv, j);
      var pay = inv.payments[0];
      return '<tr><td><button class="pv-linkbtn" data-open-inv="' + esc(inv.id) + '" aria-label="Open ' + esc(inv.label) + '">' + esc(inv.label) + '</button><br><span class="fmp1-faint pv-small">Due ' + longDate(inv.dueDate) + (pay ? ' · paid ' + longDate(pay.date) + (pay.reference ? ' · check ' + esc(pay.reference) : ' · <span style="color:var(--fmp1-alert-ink)">no check #</span>') : '') + '</span></td>' +
        '<td>' + invPill(st) + '</td>' +
        '<td class="r">' + p.actual.toFixed(2) + '%<br><span class="fmp1-faint pv-small">of ' + p.basisLabel + '</span>' + (p.mismatch ? '<br><span class="pv-small" style="color:var(--fmp1-alert-ink)">label says ' + p.stated + '%</span>' : '') + '</td>' +
        '<td class="r"><b>' + $f(inv.amountCents) + '</b></td></tr>';
    }).join('');
    var shareSum = j.invoices.reduce(function (t, i) { return t + FM.invoicePercent(i, j).actual; }, 0);
    shareSum = Math.round(shareSum * 100) / 100;
    var invFoot = s.invoicesMatchContract
      ? '<div class="fmp1-note fmp1-note--good pv-small">✓ Invoices add up to the current total of ' + $f(s.currentCents) + ' (shares total ' + shareSum.toFixed(2) + '%).</div>'
      : '<div class="fmp1-note fmp1-note--alert pv-small">Invoices total ' + $f(s.invoicedCents) + ' but the current total is ' + $f(s.currentCents) + ' (shares total ' + shareSum.toFixed(2) + '%).</div>';
    var invPanel = j.invoices.length ? '<div class="fmp1-card pv-pad"><div class="pv-jh-top"><span class="fmp1-eyebrow">Invoices</span><button class="fmp1-btn" data-open-packet>Open contract packet</button></div><div class="fmp1-table-wrap"><table class="fmp1-table"><thead><tr><th>Invoice</th><th>Status</th><th class="r">Share</th><th class="r">Amount</th></tr></thead><tbody>' + invRows + '</tbody></table></div>' + invFoot + '</div>' : '';

    var modelPanel = '';
    if (j.houses.length) {
      var mt = FM.modelTotals(j.houses);
      var packet = j.jobCode === 'FM-2609-276' ? S.legacyPacketModelTotals.map(function (r) { return { model: r.model, totalCents: FM.toCents(r.total) }; }) : [];
      var diffs = {}; FM.compareModelTotals(mt.rows, packet).forEach(function (d) { diffs[d.model] = d; });
      var pmap = {}; packet.forEach(function (r) { pmap[r.model] = r.totalCents; });
      modelPanel = '<div class="fmp1-card pv-pad"><span class="fmp1-eyebrow">Model totals · one source for the app and the packet</span><div class="fmp1-table-wrap"><table class="fmp1-table"><thead><tr><th>Model</th><th class="r">Houses</th><th class="r">Total</th>' + (packet.length ? '<th class="r">Old packet</th>' : '') + '</tr></thead><tbody>' +
        mt.rows.map(function (r) {
          var d = diffs[r.model];
          return '<tr><td>' + esc(r.model) + '</td><td class="r">' + r.count + '</td><td class="r">' + $f(r.totalCents) + '</td>' +
            (packet.length ? '<td class="r">' + (pmap[r.model] !== undefined ? (d ? '<span style="color:var(--fmp1-alert-ink)">' + $f(pmap[r.model]) + ' (' + (d.diffCents > 0 ? '+' : '−') + '1¢)</span>' : '<span class="fmp1-faint">' + $f(pmap[r.model]) + '</span>') : '') + '</td>' : '') + '</tr>';
        }).join('') +
        '<tr class="is-total"><td>Order total</td><td class="r">' + j.houses.length + '</td><td class="r">' + $f(mt.orderTotalCents) + '</td>' + (packet.length ? '<td></td>' : '') + '</tr></tbody></table></div>' +
        (packet.length ? '<p class="fmp1-faint pv-small">Each model total is the sum of its houses. The packet will print these same numbers, so there are no more penny differences.</p>' : '') + '</div>';
    }

    var hist = j.history.length ? '<div class="fmp1-card pv-pad"><span class="fmp1-eyebrow">Stage history</span><ul class="pv-warn">' + j.history.map(function (h) {
      return '<li>' + esc(FM.stageLabel(h.from)) + ' → <b>' + esc(FM.stageLabel(h.to)) + '</b>' + (h.date ? ' · ' + longDate(h.date) : '') + (h.reason ? ' · “' + esc(h.reason) + '”' : '') + '</li>';
    }).join('') + '</ul></div>' : '';

    return head + notes + '<div class="pv-grid">' + '<div class="pv-col">' + coPanel + invPanel + '</div><div class="pv-col">' + modelPanel + hist + '</div></div>' + renderDocuments(j) + renderJobSkus(j) + renderHouses(j) + renderActivity(j);
  }

  /* ---------- source documents attached to the job ---------- */
  function docFindings(j) {
    var Q = window.FMQuote, B = window.FM_BRADDY_ORDER, W = window.FM_WILLOW_ORDER, out = {};
    if (!Q) return out;
    if (B && j.jobCode === B.jobCode) {
      var bp = Q.verifyPrinted(Q.printedFromOrderModel(B.model, B.pricing));
      var gap = FM.toCents(B.model.contract.total) - (FM.toCents(B.model.contract.cabinets) - FM.toCents(B.model.contract.discount) + FM.toCents(B.model.contract.assembly) + FM.toCents(B.model.contract.ga) + FM.toCents(B.model.contract.tax));
      var dep = FM.toCents(B.invoices[0].amount) * 2;
      out.contract = [
        { tone: 'alert', text: 'Final Job Quote rows add up to ' + $f(FM.toCents(B.model.contract.total) - gap) + ', but the printed total is ' + $f(FM.toCents(B.model.contract.total)) + ' (' + $f(gap) + ' not explained on the page).' },
        { tone: 'alert', text: bp.filter(function (x) { return x.kind === 'line'; }).length + ' lines where unit × qty ≠ line total; the discount reads “5%” but is 3.88% of Cabinets.' },
        { tone: 'alert', text: 'Deposit was 50% of ' + $f(dep) + '. The total later became ' + $f(FM.toCents(B.model.contract.total)) + ' (+' + $f(FM.toCents(B.model.contract.total) - dep) + ') with no change order; the rest was split 60/40.' },
        { tone: 'alert', text: 'Invoice 1 was paid Sep 16 with no check number recorded.' }
      ];
      var so = B.supplierOrders[0];
      out['supplier-order'] = [
        { tone: 'alert', text: 'Ordered ' + longDate(so.date) + ', after the ' + longDate(B.quoteDate) + ' contract. Both items print on the quote at $0.00: ' + $f(FM.toCents(so.subtotal)) + ' of cabinets at cost (' + $f(FM.toCents(so.total)) + ' paid by card) with no change order.' }
      ];
    }
    if (W && j.jobCode === W.jobCode) {
      var n = 0; Object.keys(W.models).forEach(function (m) {
        n += Q.verifyPrinted(Q.printedFromOrderModel(W.models[m], W.pricing)).filter(function (x) { return x.kind !== 'discount-label'; }).length;
      });
      out.contract = [
        { tone: 'good', text: 'Every SKU and house total transcribed (10 houses, 154 lines); signed totals reproduced to the cent.' },
        { tone: 'alert', text: n + ' arithmetic problems across the 5 house quotes (per model, so each appears on 2 houses), plus a discount label that reads “12%”.' },
        { tone: 'alert', text: 'Model totals in the Builder Order differ by 1¢ from the house totals on 4 models.' }
      ];
    }
    return out;
  }

  function renderDocuments(j) {
    var B = window.FM_BRADDY_ORDER;
    var docs = B && B.documents ? B.documents.filter(function (d) { return d.jobCode === j.jobCode; }) : [];
    if (!docs.length) return '';
    var f = docFindings(j);
    var items = docs.map(function (d) {
      var notes = (f[d.kind] || []).map(function (n) {
        return '<li class="' + (n.tone === 'good' ? 'pv-doc-good' : 'pv-doc-alert') + '">' + esc(n.text) + '</li>';
      }).join('');
      return '<li class="pv-doc"><div class="pv-doc-head"><span class="pv-doc-icon" aria-hidden="true">PDF</span><div class="pv-grow"><b>' + esc(d.title) + '</b><br>' +
        '<span class="fmp1-faint pv-small">' + esc(d.file) + ' · ' + d.pages + ' page' + (d.pages === 1 ? '' : 's') + ' · ' + (d.bytes / 1e6).toFixed(1) + ' MB</span><br>' +
        '<span class="pv-small fmp1-muted">' + esc(d.contains) + '</span></div><button class="fmp1-btn" data-open-file="' + esc(d.file) + '" aria-label="Open ' + esc(d.title) + '">Open</button></div>' +
        (notes ? '<ul class="pv-doc-notes">' + notes + '</ul>' : '') + '</li>';
    }).join('');
    return '<div class="fmp1-card pv-pad"><div class="pv-jh-top"><div><span class="fmp1-eyebrow">Documents · ' + docs.length + '</span>' +
      '<span class="fmp1-faint pv-small">Signed originals attached to this job, with what checking them found. Files stay as they were signed.</span></div></div>' +
      '<ul class="pv-docs">' + items + '</ul></div>';
  }

  /* ---------- houses & SKUs (full order pricing) ---------- */
  /* Single-house job SKUs (Braddy · Penrose): every line on the quote screen, plus cabinets removed by change orders. */
  function renderJobSkus(j) {
    var B = window.FM_BRADDY_ORDER;
    if (!B || j.jobCode !== B.jobCode) return '';
    var m = B.model, cost = 0, sell = 0;
    var rows = m.lines.map(function (l) {
      var uc = FM.toCents(l.unitCost), lc = uc * l.qty, s = FM.toCents(l.sellTotal);
      if (!l.noCharge) cost += lc;
      sell += s;
      var tag = l.noCharge ? ' <span class="fmp1-pill fmp1-pill--good">No charge · CO 1</span>' : (l.markupPct === 0 ? ' <span class="fmp1-pill fmp1-pill--alert">at cost</span>' : '');
      return '<tr' + (l.markupPct === 0 && !l.noCharge ? ' class="pv-atcost"' : '') + '><td class="fmp1-code">' + esc(l.sku) + '</td><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(uc) + '</td><td class="r">' + $f(lc) + '</td>' +
        '<td class="r">' + (l.noCharge ? '—' : l.markupPct + '%') + tag + '</td><td class="r"><b>' + (l.noCharge ? 'No charge' : $f(s)) + '</b></td></tr>';
    }).join('');
    var removed = (B.changeOrders || []).map(function (co) {
      return (co.removed || []).map(function (r) {
        return '<tr class="pv-removed"><td class="fmp1-code">' + esc(r.sku) + '</td><td>' + esc(r.desc) + '</td><td class="r">' + r.qty + ' → 0</td><td class="r fmp1-faint" colspan="3">Removed by Change Order ' + co.number + ' (' + esc(co.date) + '). Cost not recorded.</td><td></td></tr>';
      }).join('');
    }).join('');
    var a = m.assembly, asm = Math.round(a.rate * 100 * a.hours);
    var match = cost === FM.toCents(m.screenTotals.costCharged), penny = FM.toCents(m.screenTotals.cabinets) - sell;
    return '<div class="fmp1-card pv-pad"><div class="pv-jh-top"><div><span class="fmp1-eyebrow">Cabinets &amp; SKUs · ' + m.lines.length + ' lines · ' + esc(m.color) + '</span>' +
      '<span class="fmp1-faint pv-small">Markup ' + B.pricing.defaultMarkupPct + '% · mfr. discount ' + B.pricing.mfrDiscountPct + '% off cost · G&amp;A ' + B.pricing.gaPct + '% · tax ' + B.pricing.taxPct + '% on product · assembly $' + a.rate.toFixed(2) + ' × ' + a.hours + ' h = ' + $f(asm) + '</span></div>' +
      '<span class="fmp1-pill ' + (match ? 'fmp1-pill--good' : 'fmp1-pill--alert') + '">' + (match ? '✓ Matches the quote screen' : 'Differs from the quote screen') + '</span></div>' +
      '<div class="fmp1-table-wrap"><table class="fmp1-table pv-list"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Cost</th><th class="r">Markup</th><th class="r">Sell</th></tr></thead><tbody>' + rows +
      '<tr class="is-total"><td colspan="4">Cabinets (charged lines)</td><td class="r">' + $f(cost) + '</td><td></td><td class="r">' + $f(sell) + '</td></tr>' + removed + '</tbody></table></div>' +
      '<p class="fmp1-faint pv-small" style="margin:0">Same 18 lines, costs and markups as the quote screen (cost ' + $f(FM.toCents(m.screenTotals.costCharged)) + ').' + (penny ? ' The printed line totals add to ' + $f(sell) + ', but the screen\'s total says ' + $f(FM.toCents(m.screenTotals.cabinets)) + ': the ' + $f(Math.abs(penny)) + ' rounding issue that the corrected quote math fixes.' : '') + ' The two no-charge cabinets came from Wholesale Cabinets order #1000173203 ($1,652.70 paid); their cost isn\'t in the charged total.</p></div>';
  }

  function renderHouses(j) {
    var O = window.FM_WILLOW_ORDER, PR = window.FMPricing;
    if (!O || !PR || j.jobCode !== O.jobCode) return '';
    var p = PR.priceOrder(O), diffs = PR.reconcileWithContract(O), pct = function (x) { return x.toFixed(1) + '%'; };
    var rows = p.houses.map(function (h) {
      var open = state.openHouse === h.jobCode;
      var head = '<tr class="pv-hrow' + (open ? ' is-open' : '') + '"><td><button class="fmp1-btn fmp1-btn--quiet pv-tog" data-house="' + esc(h.jobCode) + '" aria-expanded="' + open + '">' + (open ? '▾' : '▸') + ' ' + esc(h.name) + '</button><br><span class="fmp1-code">' + esc(h.jobCode) + '</span></td>' +
        '<td class="pv-small">' + esc(h.color) + '<br><span class="fmp1-faint">' + h.lineCount + ' lines</span></td>' +
        '<td class="r">' + $f(h.costCents) + '</td><td class="r">' + $f(h.cabinetsCents) + '<br><span class="fmp1-faint pv-small">' + pct(h.blendedMarkupPct) + ' markup</span></td>' +
        '<td class="r">−' + $f(h.discountCents) + '</td>' +
        '<td class="r">' + $f(h.assemblyCents) + '<br><span class="fmp1-faint pv-small">$' + h.assembly.rate.toFixed(2) + ' × ' + h.assembly.hours + ' h</span></td>' +
        '<td class="r">' + $f(h.gaCents) + '</td><td class="r">' + $f(h.taxCents) + '</td>' +
        '<td class="r"><b>' + $f(h.totalCents) + '</b>' + (h.roundingGapCents ? '<br><span class="pv-small" style="color:var(--fmp1-alert-ink)">lines add to ' + $f(h.printedSumCents) + '</span>' : '') + '</td>' +
        '<td class="r">' + pct(h.cabinetMarginPct) + '</td></tr>';
      if (!open) return head;
      var lines = h.lines.map(function (l) {
        return '<tr' + (l.atCost ? ' class="pv-atcost"' : '') + '><td class="fmp1-code">' + esc(l.sku) + '</td><td>' + esc(l.desc) + '</td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.unitCostCents) + '</td><td class="r">' + $f(l.costCents) + '</td>' +
          '<td class="r">' + l.markupPct + '%' + (l.atCost ? ' <span class="fmp1-pill fmp1-pill--alert">at cost</span>' : '') + '</td><td class="r"><b>' + $f(l.sellCents) + '</b></td></tr>';
      }).join('');
      return head + '<tr class="pv-skus"><td colspan="10"><table class="fmp1-table"><thead><tr><th>SKU</th><th>Description</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Cost</th><th class="r">Markup</th><th class="r">Sell</th></tr></thead><tbody>' + lines +
        '<tr class="is-total"><td colspan="4">Cabinets</td><td class="r">' + $f(h.costCents) + '</td><td></td><td class="r">' + $f(h.cabinetsCents) + '</td></tr></tbody></table></td></tr>';
    }).join('');
    var ok = !diffs.length;
    return '<div class="fmp1-card pv-pad"><div class="pv-jh-top"><div><span class="fmp1-eyebrow">Houses &amp; SKUs · ' + p.houses.length + ' houses · ' + p.skuLineCount + ' lines</span>' +
      '<span class="fmp1-faint pv-small">Mfr. discount ' + O.pricing.mfrDiscountPct + '% off cost · G&amp;A ' + O.pricing.gaPct + '% on product + assembly · tax ' + O.pricing.taxPct + '% on product only</span></div>' +
      '<span class="fmp1-pill ' + (ok ? 'fmp1-pill--good' : 'fmp1-pill--alert') + '">' + (ok ? '✓ Matches signed contract to the cent' : diffs.length + ' differences from contract') + '</span></div>' +
      '<div class="fmp1-table-wrap"><table class="fmp1-table pv-htable"><thead><tr><th>House</th><th>Color</th><th class="r">Cost</th><th class="r">Cabinets</th><th class="r">Mfr. disc.</th><th class="r">Assembly</th><th class="r">G&amp;A</th><th class="r">Tax</th><th class="r">Total</th><th class="r">Margin</th></tr></thead><tbody>' + rows +
      '<tr class="is-total"><td colspan="8">Order total</td><td class="r">' + $f(p.orderTotalCents) + '</td><td></td></tr></tbody></table></div>' +
      '<p class="fmp1-faint pv-small" style="margin:0">Margin = cabinet sell minus manufacturer cost, as a share of cabinet sell. Lines at 0% markup are flagged "at cost".</p></div>';
  }

  /* ---------- activity (Phase 1.1) ---------- */
  var KIND_PILL = { system: '', update: 'fmp1-pill--proposed', note: 'fmp1-pill--good', schedule: 'fmp1-pill--contracted', correction: 'fmp1-pill--alert' };

  function activityForm(j) {
    var p = state.panel, err = state.actError ? '<span class="pv-err" role="alert">' + esc(state.actError) + '</span>' : '';
    var btns = '<button class="fmp1-btn fmp1-btn--primary" type="submit">Save</button><button class="fmp1-btn fmp1-btn--quiet" type="button" data-actcancel>Cancel</button>' + err;
    if (p === 'note') {
      return '<form class="pv-actform" data-actform-kind="note"><label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Note</span><input class="fmp1-input" id="pv-note" name="text" placeholder="What should the team know?"></label>' +
        '<label class="pv-chk"><input type="checkbox" id="pv-pin" name="pinned"> Pin to top</label>' + btns + '</form>';
    }
    if (p === 'delay') {
      return '<form class="pv-actform" data-actform-kind="delay">' +
        '<label class="pv-fl"><span class="fmp1-eyebrow">Vendor</span><input class="fmp1-input" id="pv-vendor" name="vendor" value="Wholesale Cabinets"></label>' +
        '<label class="pv-fl"><span class="fmp1-eyebrow">Was shipping</span><input class="fmp1-input" type="date" id="pv-ship0" name="originalShipDate" value="2026-11-14"></label>' +
        '<label class="pv-fl"><span class="fmp1-eyebrow">Now shipping</span><input class="fmp1-input" type="date" id="pv-ship1" name="newShipDate" value="2026-12-02"></label>' +
        '<label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Reason</span><input class="fmp1-input" id="pv-why" name="reason" value="Moss Green backordered"></label>' +
        '<label class="pv-chk"><input type="checkbox" id="pv-told" name="customerNotified" checked> Customer told</label>' + btns + '</form>';
    }
    if (p === 'shipped') {
      return '<form class="pv-actform" data-actform-kind="shipped">' +
        '<label class="pv-fl"><span class="fmp1-eyebrow">Ship date</span><input class="fmp1-input" type="date" id="pv-shipd" name="shipDate" value="2026-12-02"></label>' +
        '<label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Tracking / PRO #</span><input class="fmp1-input" id="pv-track" name="tracking"></label>' + btns + '</form>';
    }
    if (p === 'schedule') {
      var rows = j.invoices.map(function (inv) {
        var locked = FM.invoicePaidCents(inv) > 0;
        return '<div class="pv-sched-row"><span>' + esc(inv.label) + (locked ? ' <span class="fmp1-pill fmp1-pill--good">Paid · locked</span>' : '') + '</span>' +
          '<input class="fmp1-input" type="date" aria-label="Due date for ' + esc(inv.label) + '" name="due:' + esc(inv.id) + '" value="' + esc(inv.dueDate) + '"' + (locked ? ' disabled' : '') + '>' +
          '<input class="fmp1-input fmp1-num" inputmode="decimal" aria-label="Amount for ' + esc(inv.label) + '" name="amt:' + esc(inv.id) + '" value="' + (inv.amountCents / 100).toFixed(2) + '"' + (locked ? ' disabled' : '') + '></div>';
      }).join('');
      return '<form class="pv-actform pv-col-form" data-actform-kind="schedule"><b>Revise payment schedule</b>' +
        '<p class="fmp1-faint pv-small" style="margin:0">Invoices must add up to ' + $f(FM.contractSummary(j).currentCents) + '. Date-only changes apply right away. Moving money between invoices needs an owner.</p>' + rows +
        '<div class="pv-row"><label class="pv-fl"><span class="fmp1-eyebrow">Asked by</span><select class="fmp1-input" id="pv-rk" name="kind"><option value="customer">Customer</option><option value="employee">Employee</option></select></label>' +
        '<label class="pv-fl"><span class="fmp1-eyebrow">Name</span><input class="fmp1-input" id="pv-rn" name="who" value="' + esc(j.customer) + '"></label>' +
        '<label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Reason</span><input class="fmp1-input" id="pv-rr" name="reason" placeholder="Why the change?"></label></div>' +
        '<div class="pv-row">' + btns + '</div></form>';
    }
    if (p && p.indexOf('reject:') === 0) {
      return '<form class="pv-actform" data-actform-kind="reject" data-req="' + esc(p.slice(7)) + '"><label class="pv-fl pv-grow"><span class="fmp1-eyebrow">Why reject?</span><input class="fmp1-input" id="pv-rej" name="note"></label>' + btns + '</form>';
    }
    return '';
  }

  function renderActivity(j) {
    var t = ACT.timeline(state.log, j.jobCode), chain = ACT.verify(state.log);
    var pending = ACT.pendingScheduleRequests(state.log, j.jobCode);
    var sugg = state.suggestions.filter(function (s) { return s.jobCode === j.jobCode; });
    var tools = '<div class="pv-row">' +
      '<button class="fmp1-btn" data-panel="note">Add note</button>' +
      '<button class="fmp1-btn" data-panel="delay">Log factory delay</button>' +
      (ACT.isDelayed(j) ? '<button class="fmp1-btn" data-panel="shipped">Mark shipped</button>' : '') +
      '<button class="fmp1-btn" data-panel="schedule"' + (j.invoices.length ? '' : ' disabled') + '>Revise payment schedule</button></div>';

    var suggHtml = sugg.map(function (s, i) {
      return '<div class="fmp1-note fmp1-note--info pv-small"><span>Delivery moved. Also move <b>' + esc(s.label) + '</b> due ' + longDate(s.from) + ' → ' + longDate(s.to) + '?</span>' +
        '<span class="pv-row" style="margin-left:auto"><button class="fmp1-btn" data-sugg="' + i + '">Move due date</button><button class="fmp1-btn fmp1-btn--quiet" data-suggno="' + i + '">Leave it</button></span></div>';
    }).join('');

    var pendHtml = pending.map(function (r) {
      var canDecide = !r.data.needsApproval || me().role === 'owner';
      return '<div class="fmp1-note fmp1-note--alert pv-small"><span><b>Waiting for owner approval:</b> ' + esc(r.summary) + '<br>Reason: ' + esc(r.data.reason) + ' · logged by ' + esc(r.actor.name) + '</span>' +
        '<span class="pv-row" style="margin-left:auto">' + (canDecide
          ? '<button class="fmp1-btn fmp1-btn--primary" data-approve="' + esc(r.id) + '">Approve</button><button class="fmp1-btn" data-panel="reject:' + esc(r.id) + '">Reject…</button>'
          : '<span class="fmp1-faint">Sign in as an owner to decide.</span>') + '</span></div>';
    }).join('');

    function item(i) {
      var corr = i.corrections.length ? '<br><span class="fmp1-faint pv-small">Corrected · originally “' + esc(i.original) + '”</span>' : '';
      return '<li class="pv-tl"><span class="pv-tl-when fmp1-faint">' + esc(whenLabel(i.at)) + '</span>' +
        '<span class="pv-tl-body"><span class="fmp1-pill ' + (KIND_PILL[i.kind] || '') + '">' + esc(i.label) + '</span> ' + esc(i.summary) + corr +
        '<br><span class="fmp1-faint pv-small">' + esc(i.actor.name) + (i.actor.role !== 'system' ? ' · ' + esc(i.actor.role) : '') + ' · ' + esc(i.id) + '</span></span></li>';
    }
    var pinned = t.pinned.length ? '<div class="pv-pinned"><span class="fmp1-eyebrow">Pinned</span><ul class="pv-tlist">' + t.pinned.map(item).join('') + '</ul></div>' : '';
    var list = t.items.length ? '<ul class="pv-tlist">' + t.items.map(item).join('') + '</ul>' : '<p class="fmp1-faint pv-small">No activity yet.</p>';
    var csv = state.showCsv ? '<pre class="pv-csv">' + esc(ACT.exportCSV(state.log, j.jobCode)) + '</pre>' : '';

    return '<div class="fmp1-card pv-pad"><div class="pv-jh-top"><div><span class="fmp1-eyebrow">Activity · ' + t.items.length + '</span>' +
      '<span class="fmp1-faint pv-small">Every change, update and note, with who and when. Entries can’t be edited or deleted.</span></div>' +
      '<span class="fmp1-pill ' + (chain.ok ? 'fmp1-pill--good' : 'fmp1-pill--alert') + '">' + (chain.ok ? 'Audit chain intact · ' + chain.count : 'Chain broken at ' + esc(chain.brokenId)) + '</span></div>' +
      tools + activityForm(j) + (!state.panel && state.actError ? '<div class="fmp1-note fmp1-note--alert pv-small" role="alert">' + esc(state.actError) + '</div>' : '') + suggHtml + pendHtml + pinned + list +
      '<div class="pv-row"><button class="fmp1-btn fmp1-btn--quiet" data-csv>' + (state.showCsv ? 'Hide' : 'Show') + ' audit export (CSV)</button></div>' + csv + '</div>';
  }

  /* ---------- documents you can open (src/fm-phase1-docs.js) ---------- */
  function quotesFor(j) {
    var Q = window.FMQuote, D = window.FMDocs, B = window.FM_BRADDY_ORDER, W = window.FM_WILLOW_ORDER, out = [];
    if (W && j.jobCode === W.jobCode) {
      W.houses.forEach(function (h, i) {
        var m = W.models[h.model], p = Q.priceHouse(Q.inputFromOrderModel(m, W.pricing)), r = Q.reconcileToSigned(p, FM.toCents(m.contract.total));
        out.push(Q.renderHouseQuoteDoc(r.ok ? r : p, { house: h.name, jobCode: h.jobCode, buyer: W.customer, signer: W.signer, quoteDate: W.houseQuoteDate,
          deliveryDate: W.deliveryDate, color: m.color, pageLabel: 'House ' + (i + 1) + ' of ' + W.houses.length }));
      });
    }
    if (B && j.jobCode === B.jobCode) {
      var p = Q.priceHouse(Q.inputFromOrderModel(B.model, B.pricing)), signed = FM.toCents(B.model.contract.total), r = Q.reconcileToSigned(p, signed);
      var meta = { house: B.project, jobCode: B.jobCode, buyer: B.customer, signer: B.signer, quoteDate: B.quoteDate, deliveryDate: B.deliveryDate, color: B.color, address: '' };
      // Priced by bid: the lines don't reach the signed total, so it prints as a lump-sum bid page (owner decision, §18).
      out.push(r.ok ? Q.renderHouseQuoteDoc(r, meta) : D.renderBidQuoteDoc(p, signed, meta));
    }
    return out;
  }
  function attachedDocs(j) {
    var B = window.FM_BRADDY_ORDER;
    return B && B.documents ? B.documents.filter(function (d) { return d.jobCode === j.jobCode; }) : [];
  }
  function openDoc(kind, key) {
    var D = window.FMDocs, j = job(state.selected);
    if (kind === 'inv') {
      var live = j.invoices.filter(function (i) { return i.status !== 'void'; }), inv = live.filter(function (i) { return i.id === key; })[0];
      state.viewer = { title: inv.label + ' · ' + j.jobCode, html: D.renderInvoiceDoc(j, inv, { today: TODAY, index: live.indexOf(inv), count: live.length }), from: '[data-open-inv="' + key + '"]' };
    } else if (kind === 'packet') {
      var onFile = attachedDocs(j).some(function (d) { return d.kind === 'contract'; });
      state.viewer = { title: 'Contract packet · ' + j.jobCode + ' · ' + j.customer, html: D.renderPacket(j, { today: TODAY, quotes: quotesFor(j), agreementOnFile: onFile }), from: '[data-open-packet]' };
    } else if (kind === 'file') {
      var d = attachedDocs(j).filter(function (x) { return x.file === key; })[0];
      state.viewer = { title: d.title + ' · ' + j.jobCode, from: '[data-open-file="' + key + '"]',
        html: '<div class="fmp1-card pv-pad pv-filenote"><span class="fmp1-eyebrow">Signed original · ' + esc(d.kind) + '</span><b>' + esc(d.file) + '</b>' +
          '<span class="pv-small fmp1-muted">' + d.pages + ' page' + (d.pages === 1 ? '' : 's') + ' · ' + (d.bytes / 1e6).toFixed(1) + ' MB · ' + esc(d.contains) + '</span>' +
          '<span class="pv-small">SHA-256 <span class="fmp1-code">' + esc(d.sha256) + '</span></span>' +
          '<div class="fmp1-note fmp1-note--info pv-small">In the live tool, Open shows this stored PDF here, exactly as signed. The preview doesn\'t include the file: the owner sends the originals to Hermes separately, and the checksum above confirms it\'s the same file.</div></div>' };
    }
  }
  function viewerHTML() {
    var v = state.viewer; if (!v) return '';
    return '<div class="pv-viewer" role="dialog" aria-modal="true" aria-labelledby="pv-viewer-title">' +
      '<div class="pv-viewer-bar"><b id="pv-viewer-title">' + esc(v.title) + '</b><span class="pv-row"><button class="fmp1-btn" data-print>Print</button>' +
      '<button class="fmp1-btn fmp1-btn--primary" data-close-viewer>Close</button></span></div>' +
      '<div class="pv-viewer-body">' + v.html + '</div></div>';
  }
  /* Letter pages are 8.5in wide; on narrow screens scale them to fit (print is unaffected). */
  function fitViewer() {
    var body = root.querySelector('.pv-viewer-body'); if (!body) return;
    var scale = Math.min(1, (body.clientWidth - 32) / 816);
    [].forEach.call(body.querySelectorAll('.fm-p1-doc'), function (d) { d.style.zoom = scale < 1 ? String(scale) : ''; });
  }
  window.addEventListener('resize', fitViewer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state && state.viewer) { var c = root.querySelector('[data-close-viewer]'); if (c) c.click(); }
  });

  function render() {
    var props = openProposals();
    root.innerHTML =
      '<header class="pv-top"><div class="pv-brand"><div><span class="fmp1-logo fmp1-logo--tagline" role="img" aria-label="Fremont Makers, making freedom"></span><span class="fmp1-faint pv-small">Project Builder · Phase 1 preview · v' + esc(FM.VERSION) + '</span></div></div>' +
      '<div class="pv-row">' + (window.FMTheme ? window.FMTheme.toggleHTML(window.FMTheme.get(root)) : '') + '<label class="pv-row pv-small"><span class="fmp1-faint">Signed in as</span><select class="fmp1-input" id="pv-actor" data-actor>' +
      Object.keys(ACTORS).map(function (k) { return '<option value="' + k + '"' + (k === state.actorKey ? ' selected' : '') + '>' + esc(ACTORS[k].name) + ' · ' + esc(ACTORS[k].role) + '</option>'; }).join('') +
      '</select></label><span class="fmp1-pill fmp1-pill--proposed">Preview · not the live tool</span><button class="fmp1-btn" data-reset>Reset sample</button></div></header>' +
      '<p class="fmp1-muted pv-intro">Sample data from the Oct 27 recording, run through the Phase 1 rules. Nothing here reads or writes tools.fremontmakers.com. Try attaching the change order, then move Willow Creek through its stages.</p>' +
      (state.flash ? '<div class="fmp1-note fmp1-note--good" role="status">' + esc(state.flash) + '</div>' : '') +
      props.map(renderProposal).join('') +
      '<section class="pv-sec"><h2 class="fmp1-h pv-h2">All projects</h2>' + renderKpis() + renderList() + '</section>' +
      '<section class="pv-sec">' + renderJob(job(state.selected)) + '</section>' + viewerHTML();
    var vc = root.querySelector('[data-close-viewer]'); if (vc) { vc.focus(); fitViewer(); }
  }

  /* ---------- events ---------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-reset')) { reset(); return render(); }
    if (t.dataset.openInv) { openDoc('inv', t.dataset.openInv); return render(); }
    if (t.hasAttribute('data-open-packet')) { openDoc('packet'); return render(); }
    if (t.dataset.openFile) { openDoc('file', t.dataset.openFile); return render(); }
    if (t.hasAttribute('data-close-viewer')) { var back = state.viewer && state.viewer.from; state.viewer = null; render(); var bk = back && root.querySelector(back); if (bk) bk.focus(); return; }
    if (t.hasAttribute('data-print')) { window.print(); return; }
    if (t.dataset.open) { state.selected = t.dataset.open; state.form = null; state.flash = null; return render(); }
    if (t.dataset.attach) {
      var p = state.proposals.filter(function (x) { return x.legacyJobCode === t.dataset.attach; })[0];
      var r = FM.attachChangeOrder(state.jobs, p, { date: state.coDate[p.legacyJobCode] || p.suggested.date });
      if (r.ok) {
        state.jobs = r.jobs; state.handled[p.legacyJobCode] = 'attached'; state.selected = p.parentJobCode;
        var parent = job(p.parentJobCode), co = parent.changeOrders[parent.changeOrders.length - 1];
        var lg = ACT.logChangeOrderAttached(state.log, parent, co, me(), nowAt()); if (lg.ok) state.log = lg.log;
        state.flash = 'Attached as Change Order ' + p.suggested.number + ' on ' + p.parentJobCode + '. The contract total now includes ' + $f(p.amountCents) + '.';
      }
      return render();
    }
    if (t.dataset.panel) { state.panel = state.panel === t.dataset.panel ? null : t.dataset.panel; state.actError = null; render(); var inp = root.querySelector('[data-actform-kind] input:not([disabled])'); if (inp) inp.focus(); return; }
    if (t.hasAttribute('data-actcancel')) { state.panel = null; state.actError = null; return render(); }
    if (t.dataset.house) { state.openHouse = state.openHouse === t.dataset.house ? null : t.dataset.house; return render(); }
    if (t.hasAttribute('data-csv')) { state.showCsv = !state.showCsv; return render(); }
    if (t.hasAttribute('data-sugg') || t.hasAttribute('data-suggno')) {
      var idx = +(t.dataset.sugg || t.dataset.suggno), sg = state.suggestions.filter(function (s) { return s.jobCode === state.selected; })[idx];
      if (t.hasAttribute('data-sugg')) {
        var rs = ACT.proposeScheduleChange(job(state.selected), state.log, {
          changes: [{ invoiceId: sg.invoiceId, dueDate: sg.to }],
          requestedBy: { kind: 'employee', name: me().name }, reason: 'Delivery moved after factory delay'
        }, me(), nowAt());
        if (!rs.ok) { state.actError = rs.error; return render(); }
        state.log = rs.log; replaceJob(rs.job); state.flash = sg.label.split('·')[0].trim() + ' now due ' + longDate(sg.to) + '.';
      }
      state.suggestions = state.suggestions.filter(function (s) { return s !== sg; });
      return render();
    }
    if (t.dataset.approve) {
      var ra = ACT.decideScheduleChange(job(state.selected), state.log, t.dataset.approve, 'approve', '', me(), nowAt());
      if (!ra.ok) { state.actError = ra.error; state.flash = null; render(); return; }
      state.log = ra.log; replaceJob(ra.job); state.flash = 'Payment schedule updated.'; state.actError = null;
      return render();
    }
    if (t.dataset.dismiss) { state.handled[t.dataset.dismiss] = 'dismissed'; state.flash = 'Left as its own project.'; return render(); }
    if (t.dataset.act) { state.form = { jobCode: state.selected, actionId: t.dataset.act, error: null }; state.flash = null; render(); var first = root.querySelector('.pv-actform input'); if (first) first.focus(); return; }
    if (t.hasAttribute('data-cancel')) { state.form = null; return render(); }
  });
  root.addEventListener('change', function (e) {
    var t = e.target; if (t.dataset && t.dataset.codate) { state.coDate[t.dataset.codate] = t.value; }
    if (t.hasAttribute && t.hasAttribute('data-actor')) { state.actorKey = t.value; state.actError = null; render(); }
  });
  root.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.dataset.actformKind) return submitActivity(f);
    if (!f.dataset.actform) return;
    var input = {}; Array.prototype.forEach.call(f.querySelectorAll('input'), function (i) { input[i.name] = i.value; });
    var before = job(state.selected);
    var r = FM.applyAction(before, f.dataset.actform, input, me().name);
    if (!r.ok) { state.form.error = r.error; return render(); }
    replaceJob(r.job);
    var lg = ACT.logStageChange(state.log, before, r.job, me(), nowAt()); if (lg.ok) state.log = lg.log;
    state.form = null; state.flash = 'Moved to ' + FM.stageLabel(r.job.stage) + '.';
    render();
  });

  function submitActivity(f) {
    var kind = f.dataset.actformKind, j = job(state.selected), at = nowAt(), r;
    var v = {}; Array.prototype.forEach.call(f.querySelectorAll('input, select'), function (i) { v[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
    if (kind === 'note') r = ACT.addNote(state.log, j.jobCode, { text: v.text, pinned: v.pinned }, me(), at);
    if (kind === 'delay') r = ACT.recordFactoryDelay(j, state.log, v, me(), at);
    if (kind === 'shipped') r = ACT.recordShipped(j, state.log, { vendor: (j.delays && j.delays.length ? j.delays[j.delays.length - 1].vendor : ''), shipDate: v.shipDate, tracking: v.tracking }, me(), at);
    if (kind === 'reject') r = ACT.decideScheduleChange(j, state.log, f.dataset.req, 'reject', v.note, me(), at);
    if (kind === 'schedule') {
      var changes = [], bad = null;
      j.invoices.forEach(function (inv) {
        var due = v['due:' + inv.id], amt = v['amt:' + inv.id];
        if (due === undefined) return;               // locked (disabled) rows aren't submitted
        var cents; try { cents = FM.toCents(amt); } catch (err) { bad = 'Enter a dollar amount for ' + inv.label + '.'; return; }
        if (due !== inv.dueDate || cents !== inv.amountCents) changes.push({ invoiceId: inv.id, dueDate: due, amountCents: cents });
      });
      r = bad ? { ok: false, error: bad } : ACT.proposeScheduleChange(j, state.log, { changes: changes, requestedBy: { kind: v.kind, name: v.who }, reason: v.reason }, me(), at);
    }
    if (!r || !r.ok) { state.actError = r ? r.error : 'Something went wrong.'; return render(); }
    state.log = r.log;
    if (r.job) replaceJob(r.job);
    if (kind === 'delay') {
      state.suggestions = state.suggestions.concat((r.suggestions || []).map(function (s) { s.jobCode = j.jobCode; return s; }));
      state.flash = 'Delay logged. Delivery is now ' + longDate(r.job.deliveryDate) + '.';
    } else if (kind === 'schedule') {
      state.flash = r.status === 'pending' ? 'Sent for owner approval. Nothing changes until it’s approved.' : 'Payment schedule updated.';
    } else if (kind === 'reject') {
      state.flash = 'Request rejected. Schedule unchanged.';
    } else {
      state.flash = 'Saved to the activity log.';
    }
    state.panel = null; state.actError = null;
    render();
  }

  if (window.FMTheme) { window.FMTheme.init(root); window.FMTheme.bind(root, root); }
  reset(); render();
})();
