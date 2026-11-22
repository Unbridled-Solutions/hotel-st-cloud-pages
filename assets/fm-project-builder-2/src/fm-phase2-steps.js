/*
 * Fremont Makers · Project Builder · Phase 2 · One clear next step (FMSteps)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMSteps in a browser.
 *
 * Owner, Nov 19 (group 2, from TJ's): every project shows five numbered steps with ✓ for what's done and the step it's on,
 * and one "Next up" that says what to do and where:
 *   1 Start · 2 Design · 3 Estimate & contract · 4 Order & deliver · 5 Close out
 * Also the dashboard's Today list: what the team should do now across all projects. HANDOFF §41.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMSteps = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var STEPS = [{ key: 'start', label: 'Start' }, { key: 'design', label: 'Design' }, { key: 'estimate', label: 'Estimate & contract' }, { key: 'order', label: 'Order & deliver' }, { key: 'close', label: 'Close out' }];
  var ORDER = ['quote', 'contract_signed', 'deposit_paid', 'factory_ordered', 'delivered', 'final_paid', 'complete'];

  function blank(s) { return s == null || String(s).trim() === ''; }
  function hasLines(j) { return (j.models || []).some(function (m) { return (m.lines || []).length; }) || !!(j.houses && j.houses.length) || j.stage !== 'quote' || j.source && j.source.system === 'legacy'; }
  function drawn(j) { return !!(j.elevations && (j.elevations.rooms || []).length); }
  function out(r) { return r && r.status === 'out'; }

  /*
   * Where a project is. opts.estimateStatus: FMEstimate.status(job).key ('approved' | 'changed' | 'none'), when known.
   * Returns { steps: [{ key, label, state: 'done' | 'now' | 'later' }], current, next: { text, tab, action? } | null }.
   */
  function of(job, opts) {
    opts = opts || {};
    if (job.stage === 'lost') return { steps: STEPS.map(function (s) { return { key: s.key, label: s.label, state: 'later' }; }), current: null, next: { text: 'This quote was lost. Reopen it from the Overview if it comes back.', tab: 'overview' } };
    var at = ORDER.indexOf(job.stage), c = job.contacts || {}, nxt = null, cur = null;
    var done = {
      start: at >= 1 || (!blank(job.customer) && !blank(c.signer) && !blank(c.buyerEmail)),   // a signed contract has started, whatever's on file
      design: at > 0 || !!job.designApproval || !!job.designApprovalSkipped || (!job.designFirst && hasLines(job)),
      estimate: at >= 1, order: at >= ORDER.indexOf('delivered'), close: at >= ORDER.indexOf('complete')
    };
    if (!done.start) { cur = 'start'; nxt = { text: 'Add who signs and their email', tab: 'contract' }; }
    else if (!done.design) {
      cur = 'design';
      var dr = job.designSign && job.designSign.request;
      nxt = out(dr) ? { text: 'Waiting on ' + (dr.signers[0] && dr.signers[0].name || 'the customer') + ' to approve the design', tab: 'elevations' }
        : drawn(job) ? { text: 'Get the customer\'s approval on the design', tab: 'elevations' } : { text: 'Draw the elevations', tab: 'elevations' };
    } else if (!done.estimate) {
      cur = 'estimate';
      var es = opts.estimateStatus, r = job.esign && job.esign.request;
      if (!hasLines(job)) nxt = { text: 'Add the SKUs and price it', tab: 'estimate' };
      else if (es && es.key !== 'approved') nxt = { text: es.key === 'changed' ? 'Approve the estimate again (it changed)' : 'Review and approve the estimate', tab: 'estimate' };
      else if (out(r) || (job.esign && (job.esign.state === 'out_for_signature' || job.esign.state === 'buyer_signed'))) nxt = { text: job.esign.state === 'buyer_signed' ? 'Countersign the contract' : 'Waiting on the buyer to sign the contract', tab: 'contract' };
      else nxt = { text: 'Build and send the contract', tab: 'contract' };
    } else if (!done.order) {
      cur = 'order';
      nxt = job.stage === 'contract_signed' ? { text: 'Collect the deposit', tab: 'invoices' } : job.stage === 'deposit_paid' ? { text: 'Place the factory order', tab: 'overview', action: 'factory' } : { text: 'Record the delivery or pickup', tab: 'overview', action: 'deliver' };
      // shipping (HANDOFF §45): the next step is the Wholesale Cabinets order, the shipment, receiving or a claim
      if (job.stage !== 'contract_signed' && opts.shipping && opts.shipping.next) nxt = opts.shipping.next;
    } else if (!done.close) {
      cur = 'close';
      if (opts.shipping && opts.shipping.next && opts.shipping.tone !== 'info') { nxt = opts.shipping.next; }
      else
      nxt = job.stage === 'delivered' ? { text: 'Collect the final payment', tab: 'invoices' } : { text: 'Close out the project', tab: 'overview' };
    }
    var reached = false;
    var steps = STEPS.map(function (s) { var st = s.key === cur ? 'now' : done[s.key] && !reached ? 'done' : 'later'; if (s.key === cur) reached = true; return { key: s.key, label: s.label, state: st }; });
    return { steps: steps, current: cur, next: nxt };
  }

  /*
   * The Today list. sign: FMSign; jobs: the counted jobs; today: 'YYYY-MM-DD'; opts.estimateStatus(job).
   * Returns [{ jobCode, kind, status, text, tab }] in this order: countersign, signing reminders due, designs and estimates to
   * approve, change orders waiting on the buyer.
   */
  function today(jobs, sign, day, opts) {
    opts = opts || {}; var list = [];
    (jobs || []).forEach(function (j) {
      var reqs = [{ r: j.esign && j.esign.request, tab: 'contract', what: 'the contract' }, { r: j.designSign && j.designSign.request, tab: 'elevations', what: 'the design' }]
        .concat((j.changeOrders || []).map(function (co) { return { r: co.esign && co.esign.request, tab: 'changes', what: 'change order ' + co.number }; }));
      reqs.forEach(function (x) {
        if (!x.r || x.r.status !== 'out' || !sign) return;
        var n = sign.nextSigner(x.r);
        if (n && n.role === 'fremont') list.push({ jobCode: j.jobCode, kind: 'countersign', status: 'Countersign', text: 'Countersign ' + x.what + ' for ' + j.customer + (j.salesperson ? ' (' + j.salesperson + ')' : '') , tab: x.tab });
        var due = sign.reminderDue(x.r, day);
        if (due) list.push({ jobCode: j.jobCode, kind: 'remind', status: 'Remind', text: 'Day ' + due.day + ' reminder: ' + due.signer.name + ' hasn\'t signed ' + x.what + ' yet', tab: x.tab });
      });
      if (j.stage === 'quote' && !j.testVoid) {
        var es = opts.estimateStatus ? opts.estimateStatus(j) : null, lines = (j.models || []).some(function (m) { return (m.lines || []).length; });
        if (j.designFirst && !j.designApproval && !j.designApprovalSkipped && drawn(j) && !(j.designSign && out(j.designSign.request))) list.push({ jobCode: j.jobCode, kind: 'design', status: 'Approve', text: 'Get ' + j.customer + '\'s approval on the design', tab: 'elevations' });
        else if (lines && es && es.key === 'changed') list.push({ jobCode: j.jobCode, kind: 'estimate', status: 'Approve', text: j.customer + '\'s estimate changed since it was approved', tab: 'estimate' });
      }
      if (opts.shipping) opts.shipping(j).forEach(function (a) { list.push({ jobCode: j.jobCode, kind: 'ship', status: a.kind === 'claim' ? 'Claim' : a.kind === 'inspect' ? 'Inspect' : a.kind === 'blocked' ? 'Blocked' : 'Check', text: a.text + ' · ' + j.customer, tab: a.tab, tone: a.tone }); });
      (j.changeOrders || []).forEach(function (co) { if (co.status === 'pending approval') list.push({ jobCode: j.jobCode, kind: 'courtesy', status: 'Approve', text: 'Approve courtesy change order ' + co.number + ' for ' + j.customer, tab: 'changes' }); });
    });
    var rank = { countersign: 0, ship: 1, remind: 2, design: 3, estimate: 4, courtesy: 5 };
    return list.sort(function (a, b) { return rank[a.kind] - rank[b.kind]; });
  }

  return { VERSION: VERSION, STEPS: STEPS, of: of, today: today };
}));
