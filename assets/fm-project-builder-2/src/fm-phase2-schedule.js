/*
 * Fremont Makers · Project Builder · Phase 2 · Changing the payment schedule after signing (HANDOFF §29).  window.FMSchedule
 * Pure functions: no DOM, storage or network. Money is integer cents.
 *
 * Things change after a contract is signed, so the schedule can be adjusted on the Invoices tab:
 *   - move a due date, move money between invoices, split one invoice into two, or remove an unpaid one;
 *   - paid or partly paid invoices are locked; change-order invoices are never touched (each has its own);
 *   - the invoices must still add up to the same amount, and the dates stay in order;
 *   - every change records who asked and why. Date-only changes apply at once. Changes that move money need
 *     someone with Full access (owner decision Oct 30 2026); a Full-access user's own change applies at once, logged.
 *
 * draft rows: [{ id (null for a new invoice), label, dueDate, amountCents }] for the contract invoices, in order.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = isNode ? factory(require('./fm-phase1-ledger.js')) : factory(root.FMPhase1);
  if (isNode) module.exports = api; else root.FMSchedule = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';
  var VERSION = '0.1.0';
  function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nice(s) { var p = String(s).split('-'); return p.length === 3 ? MON[+p[1] - 1] + ' ' + (+p[2]) : String(s); }

  /* the invoices the schedule covers: everything but change-order invoices and voided ones */
  function contractInvoices(job) { return (job.invoices || []).filter(function (i) { return !i.changeOrderId && i.role !== 'change_order' && i.status !== 'void'; }); }

  /* A draft to edit, from the job as it is */
  function draftFrom(job) {
    return contractInvoices(job).map(function (i) { return { id: i.id, label: i.label, dueDate: i.dueDate, amountCents: i.amountCents, paidCents: FM.invoicePaidCents(i) }; });
  }

  /*
   * Check a draft. opts: { today }
   * Returns { ok, errors[], moved (money moved, added or removed), changes[] (plain sentences), after }.
   */
  function check(job, draft, opts) {
    opts = opts || {};
    var before = contractInvoices(job), byId = {}, errors = [], changes = [], moved = false;
    before.forEach(function (i) { byId[i.id] = i; });
    var seen = {};
    (draft || []).forEach(function (r, n) {
      var name = r.label && String(r.label).trim() ? String(r.label).trim() : 'Invoice ' + (n + 1);
      if (!(r.amountCents > 0)) errors.push(name + ': the amount must be more than $0.00.');
      if (!isISO(r.dueDate)) errors.push(name + ': enter a due date.');
      if (!r.id && !String(r.label || '').trim()) errors.push('Name the new invoice ' + (n + 1) + '.');
      if (r.id) {
        var b = byId[r.id]; if (!b) { errors.push(name + ' isn\'t on this job.'); return; }
        seen[r.id] = true;
        var paid = FM.invoicePaidCents(b);
        if (paid > 0 && (r.dueDate !== b.dueDate || r.amountCents !== b.amountCents)) errors.push(b.label + ' has a payment recorded, so it can\'t change.');
        if (r.amountCents !== b.amountCents) { moved = true; changes.push(b.label + ' ' + FM.fmt(b.amountCents) + ' → ' + FM.fmt(r.amountCents)); }
        if (r.dueDate !== b.dueDate) {
          changes.push(b.label + ' due ' + nice(b.dueDate) + ' → ' + nice(r.dueDate));
          if (opts.today && isISO(r.dueDate) && r.dueDate < opts.today) errors.push(b.label + ': the new due date is already past.');
        }
      } else {
        moved = true; changes.push('New: ' + String(r.label || '').trim() + ' ' + FM.fmt(r.amountCents || 0) + ' due ' + nice(r.dueDate));
        if (opts.today && isISO(r.dueDate) && r.dueDate < opts.today) errors.push(String(r.label || 'The new invoice').trim() + ': the due date is already past.');
      }
    });
    before.forEach(function (b) {
      if (seen[b.id]) return;
      if (FM.invoicePaidCents(b) > 0) errors.push(b.label + ' has a payment recorded, so it can\'t be removed.');
      moved = true; changes.push('Removed: ' + b.label + ' (' + FM.fmt(b.amountCents) + ')');
    });
    if (!(draft || []).length) errors.push('Keep at least one invoice.');
    for (var i = 1; i < (draft || []).length; i++) if (isISO(draft[i].dueDate) && isISO(draft[i - 1].dueDate) && draft[i].dueDate < draft[i - 1].dueDate) { errors.push('Keep the invoices in date order: ' + (draft[i].label || 'invoice ' + (i + 1)) + ' is due before the one above it.'); break; }
    var was = before.reduce(function (t, b) { return t + b.amountCents; }, 0), now = (draft || []).reduce(function (t, r) { return t + (r.amountCents > 0 ? r.amountCents : 0); }, 0);
    if (now !== was) errors.push('The invoices add up to ' + FM.fmt(now) + '. They need to add up to ' + FM.fmt(was) + ' (' + (now > was ? FM.fmt(now - was) + ' too much' : FM.fmt(was - now) + ' short') + ').');
    if (!changes.length && !errors.length) errors.push('Nothing changed.');
    return { ok: errors.length === 0, errors: errors, moved: moved, changes: changes, totalCents: was, draftCents: now };
  }

  /*
   * Apply a checked draft. who: { name, access }. request: { askedBy: 'customer' | 'us', askedName, reason }.
   * Returns { ok, job, log } or { ok:false, errors }. The job gains scheduleRevisions[] (shown as "Revised" on the packet).
   */
  function apply(job, draft, who, request, opts) {
    opts = opts || {}; request = request || {};
    var r = check(job, draft, opts);
    if (!r.ok) return { ok: false, errors: r.errors };
    if (!String(request.reason || '').trim()) return { ok: false, errors: ['Say why the schedule is changing.'] };
    if (!String(request.askedName || '').trim()) return { ok: false, errors: ['Say who asked for the change.'] };
    if (r.moved && (!who || who.access !== 'full')) return { ok: false, errors: ['Moving money between invoices needs someone with Full access.'], needsApproval: true };
    var next = JSON.parse(JSON.stringify(job)), keep = {}, max = 0;
    next.invoices.forEach(function (i) { var m = String(i.id).match(/-inv(\d+)$/); if (m) max = Math.max(max, +m[1]); });
    var rows = draft.map(function (d) {
      if (d.id) {
        var x = next.invoices.filter(function (i) { return i.id === d.id; })[0];
        if (x.amountCents !== d.amountCents) x.label = relabel(x.label, d.amountCents, r.totalCents);   // "Invoice 3 · 20%" holding 10% becomes "Invoice 3 · 10%"
        x.dueDate = d.dueDate; x.amountCents = d.amountCents; keep[x.id] = true; return x;
      }
      max++; var id = job.jobCode + '-inv' + max; keep[id] = true;
      return { id: id, label: String(d.label).trim(), role: 'progress', changeOrderId: null, dueDate: d.dueDate, amountCents: d.amountCents, status: 'open', payments: [] };
    });
    var cos = next.invoices.filter(function (i) { return i.changeOrderId || i.role === 'change_order' || i.status === 'void'; });
    next.invoices = rows.concat(cos);
    var rev = { on: opts.today || null, by: who.name, askedBy: request.askedBy || 'customer', askedName: String(request.askedName).trim(), reason: String(request.reason).trim(), changes: r.changes, moved: r.moved };
    next.scheduleRevisions = (next.scheduleRevisions || []).concat([rev]);
    return { ok: true, job: next, revision: rev,
      log: 'Payment schedule changed by ' + who.name + ' (asked by ' + rev.askedName + ', ' + (rev.askedBy === 'us' ? 'Fremont Makers' : 'the customer') + '): ' + r.changes.join('; ') + '. Why: ' + rev.reason + '.' };
  }

  /* A label that names a share ("Invoice 3 · 20%") gets the new share; other labels stay as they are */
  function relabel(label, cents, totalCents) {
    var pct = Math.round(cents / totalCents * 1000) / 10;
    return String(label).replace(/(·\s*)\d+(?:\.\d+)?%/, '$1' + pct + '%');
  }

  /* Split one unpaid row into two equal parts (the second gets the odd cent) */
  function split(draft, index, label) {
    var d = JSON.parse(JSON.stringify(draft)), r = d[index], a = Math.floor(r.amountCents / 2);
    d.splice(index + 1, 0, { id: null, label: label || (String(r.label).split('·')[0].trim() + ' (part 2)'), dueDate: r.dueDate, amountCents: r.amountCents - a });
    r.amountCents = a;
    return d;
  }

  return { VERSION: VERSION, contractInvoices: contractInvoices, draftFrom: draftFrom, check: check, apply: apply, split: split };
}));
