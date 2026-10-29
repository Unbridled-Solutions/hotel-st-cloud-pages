/*
 * Fremont Makers · Project Builder · Phase 1.1 activity + audit trail
 * ------------------------------------------------------------------
 * One append-only timeline per job:
 *   - system events   (stage changes, change orders, payments, schedule changes)
 *   - structured updates (factory delay, shipped, delivery issue, customer contact)
 *   - team notes      (internal, optionally pinned)
 *
 * Rules:
 *   - Entries are never edited or deleted. A correction is a new entry that
 *     points at the one it fixes.
 *   - Every entry needs an actor (who) and a timestamp (when). In production
 *     BOTH come from the server session, never from the browser.
 *   - Entries are hash-chained so tampering is detectable. The hash here is a
 *     fast non-cryptographic one for the browser; the server must use SHA-256
 *     (see HANDOFF.md §10).
 *
 * Pure functions, no storage, never mutates inputs. Depends on FMPhase1.
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./fm-phase1-ledger.js') : root.FMPhase1);
  if (isNode) module.exports = api; else root.FMActivity = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (FM) {
  'use strict';

  var VERSION = '1.1.0-phase1';

  var TYPES = {
    stage_changed:            { label: 'Stage changed', kind: 'system' },
    co_attached:              { label: 'Change order attached', kind: 'system' },
    payment_recorded:         { label: 'Payment recorded', kind: 'system' },
    delivery_date_changed:    { label: 'Delivery date changed', kind: 'system' },
    factory_delay:            { label: 'Factory delay', kind: 'update' },
    factory_shipped:          { label: 'Shipped', kind: 'update' },
    delivery_issue:           { label: 'Delivery issue', kind: 'update' },
    customer_contact:         { label: 'Customer contact', kind: 'update' },
    note:                     { label: 'Note', kind: 'note' },
    schedule_change_requested:{ label: 'Payment schedule change requested', kind: 'schedule' },
    schedule_change_applied:  { label: 'Payment schedule changed', kind: 'schedule' },
    schedule_change_rejected: { label: 'Payment schedule change rejected', kind: 'schedule' },
    correction:               { label: 'Correction', kind: 'correction' }
  };

  /* ---------- hashing (tamper evidence) ---------- */

  function cyrb53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ('00000000' + (h2 >>> 0).toString(16)).slice(-8) + ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
  }

  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }

  function hashEntry(e) {
    var copy = {}; for (var k in e) if (k !== 'hash') copy[k] = e[k];
    return cyrb53(canon(copy));
  }

  /* ---------- core log ---------- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isISODateTime(s) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(s || '')); }
  function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function addDays(iso, n) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function shortDate(iso) {
    if (!iso) return '—';
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], p = iso.split('-');
    return m[+p[1] - 1] + ' ' + (+p[2]);
  }

  /** Append one entry. Returns { ok, log, entry } or { ok:false, error }. */
  function append(log, draft) {
    if (!draft || !TYPES[draft.type]) return { ok: false, error: 'Unknown entry type.' };
    if (!draft.jobCode) return { ok: false, error: 'Every entry needs a job.' };
    if (!draft.actor || !draft.actor.id || !draft.actor.name) return { ok: false, error: 'Every entry needs the employee who made it.' };
    if (!isISODateTime(draft.at)) return { ok: false, error: 'Every entry needs a server timestamp.' };
    if (!draft.summary || !String(draft.summary).trim()) return { ok: false, error: 'Every entry needs a summary.' };
    var prev = log.length ? log[log.length - 1].hash : '0';
    var entry = {
      id: 'act-' + ('00000' + (log.length + 1)).slice(-5),
      jobCode: draft.jobCode,
      type: draft.type,
      at: draft.at,
      actor: { id: draft.actor.id, name: draft.actor.name, role: draft.actor.role || 'staff' },
      summary: String(draft.summary).trim(),
      data: draft.data ? clone(draft.data) : {},
      before: draft.before === undefined ? null : clone(draft.before),
      after: draft.after === undefined ? null : clone(draft.after),
      visibility: 'internal',
      prevHash: prev
    };
    entry.hash = hashEntry(entry);
    return { ok: true, log: log.concat([entry]), entry: entry };
  }

  /** Append several drafts in order; later drafts may reference earlier ids via a function. */
  function appendAll(log, drafts) {
    var cur = log, made = [];
    for (var i = 0; i < drafts.length; i++) {
      var d = typeof drafts[i] === 'function' ? drafts[i](made) : drafts[i];
      var r = append(cur, d);
      if (!r.ok) return r;
      cur = r.log; made.push(r.entry);
    }
    return { ok: true, log: cur, entries: made };
  }

  /** Check the chain. Returns { ok, count, brokenAt, brokenId }. */
  function verify(log) {
    var prev = '0';
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (e.prevHash !== prev || hashEntry(e) !== e.hash) return { ok: false, count: log.length, brokenAt: i, brokenId: e.id };
      prev = e.hash;
    }
    return { ok: true, count: log.length, brokenAt: -1, brokenId: null };
  }

  /* ---------- notes, corrections, timeline ---------- */

  function addNote(log, jobCode, input, actor, at) {
    var text = input && String(input.text || '').trim();
    if (!text) return { ok: false, error: 'Write a note first.' };
    return append(log, { jobCode: jobCode, type: 'note', actor: actor, at: at, summary: text, data: { pinned: !!input.pinned } });
  }

  /** Fix an earlier entry without changing it. `changes` may set summary and/or data fields. */
  function correct(log, targetId, changes, reason, actor, at) {
    var target = log.filter(function (e) { return e.id === targetId; })[0];
    if (!target) return { ok: false, error: 'That entry doesn’t exist.' };
    if (target.type === 'correction') return { ok: false, error: 'Correct the original entry, not a correction.' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'Say why it’s being corrected.' };
    return append(log, {
      jobCode: target.jobCode, type: 'correction', actor: actor, at: at,
      summary: 'Corrected ' + TYPES[target.type].label.toLowerCase() + ': ' + String(reason).trim(),
      data: { targetId: targetId, reason: String(reason).trim(), changes: changes || {} }
    });
  }

  /** Job timeline, newest first, with corrections folded in for display.
   *  The original text is kept on each item as `original`. */
  function timeline(log, jobCode) {
    var byId = {}, items = [];
    log.forEach(function (e) {
      if (e.jobCode !== jobCode) return;
      if (e.type === 'correction') {
        var t = byId[e.data.targetId];
        if (t) {
          t.corrections.push(e);
          if (e.data.changes.summary) t.summary = e.data.changes.summary;
          for (var k in e.data.changes) if (k !== 'summary') t.data[k] = e.data.changes[k];
        }
        return;
      }
      var item = clone(e);
      item.label = TYPES[e.type].label; item.kind = TYPES[e.type].kind;
      item.original = e.summary; item.corrections = [];
      byId[e.id] = item; items.push(item);
    });
    items.reverse();
    return {
      pinned: items.filter(function (i) { return i.type === 'note' && i.data.pinned; }),
      items: items
    };
  }

  /* ---------- structured updates ---------- */

  /** Log a factory delay. Moves the job's delivery date by the same number of
   *  days (or to `newDeliveryDate`) and suggests moving at-delivery invoices.
   *  Suggestions are NOT applied; pass them to proposeScheduleChange. */
  function recordFactoryDelay(job, log, input, actor, at) {
    input = input || {};
    if (!input.vendor) return { ok: false, error: 'Enter the vendor.' };
    if (!isISODate(input.originalShipDate) || !isISODate(input.newShipDate)) return { ok: false, error: 'Enter both ship dates.' };
    var shift = FM.daysBetween(input.originalShipDate, input.newShipDate);
    if (shift <= 0) return { ok: false, error: 'The new ship date must be after the original one.' };
    if (!input.reason || !String(input.reason).trim()) return { ok: false, error: 'Enter the reason for the delay.' };
    var oldDelivery = job.deliveryDate || null;
    var newDelivery = input.newDeliveryDate || (oldDelivery ? addDays(oldDelivery, shift) : null);

    var next = clone(job);
    next.deliveryDate = newDelivery;
    next.delays = (job.delays || []).concat([{
      vendor: input.vendor, originalShipDate: input.originalShipDate, newShipDate: input.newShipDate,
      reason: String(input.reason).trim(), customerNotified: !!input.customerNotified, resolved: false
    }]);

    var drafts = [{
      jobCode: job.jobCode, type: 'factory_delay', actor: actor, at: at,
      summary: input.vendor + ' ship date ' + shortDate(input.originalShipDate) + ' → ' + shortDate(input.newShipDate) + ' · ' + String(input.reason).trim(),
      data: { vendor: input.vendor, originalShipDate: input.originalShipDate, newShipDate: input.newShipDate, days: shift, reason: String(input.reason).trim(), customerNotified: !!input.customerNotified }
    }];
    if (newDelivery && newDelivery !== oldDelivery) {
      drafts.push(function (made) {
        return {
          jobCode: job.jobCode, type: 'delivery_date_changed', actor: actor, at: at,
          summary: 'Delivery ' + shortDate(oldDelivery) + ' → ' + shortDate(newDelivery) + ' (from the factory delay)',
          data: { causeId: made[0].id }, before: { deliveryDate: oldDelivery }, after: { deliveryDate: newDelivery }
        };
      });
    }
    var r = appendAll(log, drafts);
    if (!r.ok) return r;

    var suggestions = oldDelivery && newDelivery ? job.invoices.filter(function (inv) {
      return inv.dueDate === oldDelivery && FM.invoicePaidCents(inv) === 0 && inv.status !== 'void';
    }).map(function (inv) {
      return { invoiceId: inv.id, label: inv.label, from: oldDelivery, to: newDelivery };
    }) : [];
    return { ok: true, job: next, log: r.log, entries: r.entries, suggestions: suggestions };
  }

  function recordShipped(job, log, input, actor, at) {
    input = input || {};
    if (!isISODate(input.shipDate)) return { ok: false, error: 'Enter the ship date.' };
    var next = clone(job);
    next.delays = (job.delays || []).map(function (d) { var c = clone(d); c.resolved = true; return c; });
    var r = append(log, {
      jobCode: job.jobCode, type: 'factory_shipped', actor: actor, at: at,
      summary: (input.vendor || 'Factory order') + ' shipped ' + shortDate(input.shipDate) + (input.tracking ? ' · tracking ' + input.tracking : ''),
      data: { vendor: input.vendor || '', shipDate: input.shipDate, tracking: input.tracking || '' }
    });
    return r.ok ? { ok: true, job: next, log: r.log, entry: r.entry } : r;
  }

  function isDelayed(job) { return (job.delays || []).some(function (d) { return !d.resolved; }); }

  function recordCustomerContact(log, jobCode, input, actor, at) {
    input = input || {};
    if (!input.text) return { ok: false, error: 'Describe the conversation.' };
    return append(log, { jobCode: jobCode, type: 'customer_contact', actor: actor, at: at,
      summary: (input.method ? input.method + ': ' : '') + input.text, data: { method: input.method || '', contact: input.contact || '' } });
  }

  function recordDeliveryIssue(log, jobCode, input, actor, at) {
    input = input || {};
    if (!input.text) return { ok: false, error: 'Describe the issue.' };
    return append(log, { jobCode: jobCode, type: 'delivery_issue', actor: actor, at: at,
      summary: input.text, data: { houses: input.houses || [], noted_on_ticket: !!input.notedOnTicket } });
  }

  /* ---------- system events (called by the app when things happen) ---------- */

  function logStageChange(log, before, after, actor, at) {
    var h = after.history[after.history.length - 1];
    return append(log, { jobCode: after.jobCode, type: 'stage_changed', actor: actor, at: at,
      summary: FM.stageLabel(before.stage) + ' → ' + FM.stageLabel(after.stage) + (h && h.reason ? ' · ' + h.reason : ''),
      data: { date: h ? h.date : null, reason: h ? h.reason : null }, before: { stage: before.stage }, after: { stage: after.stage } });
  }

  function logChangeOrderAttached(log, job, co, actor, at) {
    return append(log, { jobCode: job.jobCode, type: 'co_attached', actor: actor, at: at,
      summary: 'Change Order ' + co.number + ' attached · ' + FM.fmt(co.amountCents, { sign: true }) + ' · contract now ' + FM.fmt(FM.contractSummary(job).currentCents),
      data: { changeOrderId: co.id, legacyJobCode: co.source ? co.source.jobCode : null, amountCents: co.amountCents } });
  }

  function logPayment(log, job, inv, payment, actor, at) {
    return append(log, { jobCode: job.jobCode, type: 'payment_recorded', actor: actor, at: at,
      summary: FM.fmt(payment.amountCents) + ' on ' + inv.label + (payment.reference ? ' · check ' + payment.reference : ' · no reference'),
      data: { invoiceId: inv.id, amountCents: payment.amountCents, date: payment.date, method: payment.method, reference: payment.reference } });
  }

  /* ---------- payment schedule changes ---------- */

  function scheduleSnapshot(job) {
    return job.invoices.map(function (i) { return { invoiceId: i.id, label: i.label, dueDate: i.dueDate, amountCents: i.amountCents, paidCents: FM.invoicePaidCents(i) }; });
  }

  /** Validate a proposed schedule against a job. Returns { ok, error, after, amountsMoved }. */
  function checkSchedule(job, changes) {
    var byId = {}; (changes || []).forEach(function (c) { byId[c.invoiceId] = c; });
    var after = [], moved = false, err = null;
    job.invoices.forEach(function (inv) {
      var c = byId[inv.id], due = inv.dueDate, amt = inv.amountCents;
      if (c) {
        var paid = FM.invoicePaidCents(inv);
        var newDue = c.dueDate || inv.dueDate, newAmt = c.amountCents === undefined ? inv.amountCents : c.amountCents;
        if (paid > 0 && (newDue !== inv.dueDate || newAmt !== inv.amountCents)) err = err || (inv.label + ' has a payment recorded and is locked.');
        if (newAmt <= 0) err = err || ('Each invoice must be more than $0.00.');
        if (!isISODate(newDue)) err = err || ('Enter a due date for ' + inv.label + '.');
        if (newAmt !== inv.amountCents) moved = true;
        due = newDue; amt = newAmt;
      }
      after.push({ invoiceId: inv.id, label: inv.label, dueDate: due, amountCents: amt, paidCents: FM.invoicePaidCents(inv) });
    });
    if (err) return { ok: false, error: err };
    var total = after.reduce(function (t, a) { return t + a.amountCents; }, 0);
    var current = FM.contractSummary(job).currentCents;
    if (total !== current) return { ok: false, error: 'Invoices must add up to the current total of ' + FM.fmt(current) + '. These add up to ' + FM.fmt(total) + '.' };
    var changed = after.some(function (a, i) { return a.dueDate !== job.invoices[i].dueDate || a.amountCents !== job.invoices[i].amountCents; });
    if (!changed) return { ok: false, error: 'Nothing changed.' };
    return { ok: true, after: after, amountsMoved: moved };
  }

  function applySchedule(job, after) {
    var next = clone(job), map = {};
    after.forEach(function (a) { map[a.invoiceId] = a; });
    next.invoices = next.invoices.map(function (inv) { var a = map[inv.id]; if (a) { inv.dueDate = a.dueDate; inv.amountCents = a.amountCents; } return inv; });
    return next;
  }

  function describe(before, after) {
    var parts = [];
    after.forEach(function (a, i) {
      var b = before[i];
      if (b.dueDate !== a.dueDate) parts.push(b.label.split('·')[0].trim() + ' due ' + shortDate(b.dueDate) + ' → ' + shortDate(a.dueDate));
      if (b.amountCents !== a.amountCents) parts.push(b.label.split('·')[0].trim() + ' ' + FM.fmt(b.amountCents) + ' → ' + FM.fmt(a.amountCents));
    });
    return parts.join('; ');
  }

  /** Request a schedule change. Date-only changes apply right away (still logged).
   *  Changes that move money between invoices wait for an owner. */
  function proposeScheduleChange(job, log, input, actor, at) {
    input = input || {};
    if (!input.requestedBy || !input.requestedBy.name) return { ok: false, error: 'Say who asked for the change.' };
    if (!input.reason || !String(input.reason).trim()) return { ok: false, error: 'Enter the reason for the change.' };
    var chk = checkSchedule(job, input.changes);
    if (!chk.ok) return chk;
    var before = scheduleSnapshot(job);
    var needsApproval = chk.amountsMoved;
    var summary = describe(before, chk.after);
    var req = append(log, {
      jobCode: job.jobCode, type: 'schedule_change_requested', actor: actor, at: at,
      summary: summary + ' · asked by ' + input.requestedBy.name + ' (' + (input.requestedBy.kind || 'customer') + ')',
      data: { requestedBy: input.requestedBy, reason: String(input.reason).trim(), changes: input.changes, needsApproval: needsApproval },
      before: before, after: chk.after
    });
    if (!req.ok) return req;
    if (needsApproval) return { ok: true, status: 'pending', job: job, log: req.log, request: req.entry };
    var applied = append(req.log, {
      jobCode: job.jobCode, type: 'schedule_change_applied', actor: actor, at: at,
      summary: summary + ' · dates only, no approval needed',
      data: { requestId: req.entry.id }, before: before, after: chk.after
    });
    if (!applied.ok) return applied;
    return { ok: true, status: 'applied', job: applySchedule(job, chk.after), log: applied.log, request: req.entry };
  }

  function pendingScheduleRequests(log, jobCode) {
    var decided = {};
    log.forEach(function (e) { if ((e.type === 'schedule_change_applied' || e.type === 'schedule_change_rejected') && e.data.requestId) decided[e.data.requestId] = true; });
    return log.filter(function (e) { return e.jobCode === jobCode && e.type === 'schedule_change_requested' && !decided[e.id]; });
  }

  /** Approve or reject a pending request. Only owners may decide changes that move money.
   *  Approval re-checks the schedule against the job as it is now. */
  function decideScheduleChange(job, log, requestId, decision, note, actor, at) {
    var req = pendingScheduleRequests(log, job.jobCode).filter(function (e) { return e.id === requestId; })[0];
    if (!req) return { ok: false, error: 'That request isn’t pending.' };
    if (req.data.needsApproval && actor.role !== 'owner') return { ok: false, error: 'Only an owner can approve or reject changes that move money between invoices.' };
    if (decision === 'reject') {
      if (!note || !String(note).trim()) return { ok: false, error: 'Say why it’s rejected.' };
      var rj = append(log, { jobCode: job.jobCode, type: 'schedule_change_rejected', actor: actor, at: at,
        summary: 'Rejected: ' + String(note).trim(), data: { requestId: requestId, note: String(note).trim() } });
      return rj.ok ? { ok: true, status: 'rejected', job: job, log: rj.log } : rj;
    }
    var chk = checkSchedule(job, req.data.changes);
    if (!chk.ok) return { ok: false, error: 'Can’t approve as requested: ' + chk.error };
    var before = scheduleSnapshot(job);
    var ap = append(log, { jobCode: job.jobCode, type: 'schedule_change_applied', actor: actor, at: at,
      summary: describe(before, chk.after) + ' · approved' + (note ? ' · ' + String(note).trim() : ''),
      data: { requestId: requestId, note: note || '' }, before: before, after: chk.after });
    return ap.ok ? { ok: true, status: 'applied', job: applySchedule(job, chk.after), log: ap.log } : ap;
  }

  /* ---------- export ---------- */

  function exportCSV(log, jobCode) {
    function q(v) { var s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return '"' + s.replace(/"/g, '""') + '"'; }
    var rows = [['id', 'at', 'job', 'employee', 'role', 'type', 'summary', 'before', 'after', 'hash'].map(q).join(',')];
    log.filter(function (e) { return !jobCode || e.jobCode === jobCode; }).forEach(function (e) {
      rows.push([e.id, e.at, e.jobCode, e.actor.name, e.actor.role, TYPES[e.type].label, e.summary, e.before, e.after, e.hash].map(q).join(','));
    });
    return rows.join('\n');
  }

  return {
    VERSION: VERSION, TYPES: TYPES,
    append: append, verify: verify, timeline: timeline, addNote: addNote, correct: correct,
    recordFactoryDelay: recordFactoryDelay, recordShipped: recordShipped, isDelayed: isDelayed,
    recordCustomerContact: recordCustomerContact, recordDeliveryIssue: recordDeliveryIssue,
    logStageChange: logStageChange, logChangeOrderAttached: logChangeOrderAttached, logPayment: logPayment,
    checkSchedule: checkSchedule, proposeScheduleChange: proposeScheduleChange,
    pendingScheduleRequests: pendingScheduleRequests, decideScheduleChange: decideScheduleChange,
    exportCSV: exportCSV, addDays: addDays
  };
}));
