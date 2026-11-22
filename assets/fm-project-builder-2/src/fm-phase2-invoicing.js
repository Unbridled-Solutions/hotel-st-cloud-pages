/*
 * Fremont Makers · Project Builder · Phase 2 · Issuing and sending invoices; the package to finance (FMInvoicing)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMInvoicing in a browser.
 *
 * Owner, Nov 19 (from TJ's Log & Timber):
 *   - When a contract is fully signed, its invoices are issued: numbered by job (FM-2611-401-1, -2 …), each with the amount
 *     before tax, its share of the sales tax, and the total. They add up to the signed price exactly.
 *   - Send to customer: the deposit is ready at signing; a progress invoice when the cabinets are ordered; the last one at
 *     delivery (or whenever its due date arrives). Change order invoices are ready when the change order is signed.
 *   - The package to finance: the executed agreement with its certificate, and every invoice, in one email.
 * Without the server's email, the tool walks the team through it with their mail app; with it, it's one button. HANDOFF §39.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMInvoicing = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  /* Finance: Sara Thorp, sthorp@unbridled.com (owner confirmed Nov 19). Full access can change it on the Users page. */
  var SETTINGS = { financeEmail: 'sthorp@unbridled.com', financeName: 'Sara Thorp' };
  var ORDER = ['quote', 'contract_signed', 'deposit_paid', 'factory_ordered', 'delivered', 'final_paid', 'complete'];
  var PAY = 'Checks payable to Fremont Makers LLC, 719 Main Street, Cañon City, CO 81212. Ask us for bank transfer details.';

  function money(c) { var n = Math.abs(c); return (c < 0 ? '−' : '') + '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + (n % 100)).slice(-2); }
  function blank(s) { return s == null || String(s).trim() === ''; }
  function live(job) { return (job.invoices || []).filter(function (i) { return i.status !== 'void'; }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nice(iso) { if (!iso) return '—'; var p = String(iso).slice(0, 10).split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }

  /* The contract invoices (not change orders) get the job's sales tax split by their share; the last takes the pennies. */
  function taxSplit(job) {
    var base = live(job).filter(function (i) { return !i.changeOrderId && i.role !== 'change_order'; }), total = base.reduce(function (t, i) { return t + i.amountCents; }, 0), tax = job.taxCents || 0, used = 0, out = {};
    base.forEach(function (inv, k) { var share = k === base.length - 1 ? tax - used : (total ? Math.round(tax * inv.amountCents / total) : 0); used += share; out[inv.id] = share; });
    return out;
  }

  /*
   * Issue the invoices when the contract is fully signed. Only numbers and records them; amounts and due dates stay as signed.
   * Returns { ok, error, invoices (updated copies), log }. Safe to run again: already-issued invoices are left alone.
   */
  function issue(job, at) {
    if (!job || job.stage === 'quote' || job.stage === 'lost') return { ok: false, error: 'Invoices are issued once the contract is signed.' };
    var tax = taxSplit(job), n = 0, fresh = 0;
    var invoices = (job.invoices || []).map(function (inv) {
      var x = JSON.parse(JSON.stringify(inv));
      if (x.status === 'void') return x;
      n++;
      if (!x.number) { x.number = job.jobCode + '-' + n; fresh++; }
      if (!x.issuedAt) x.issuedAt = at || null;
      if (x.taxCents == null && tax[x.id] != null) x.taxCents = tax[x.id];
      if (x.preTaxCents == null && x.taxCents != null) x.preTaxCents = x.amountCents - x.taxCents;
      return x;
    });
    if (!fresh) return { ok: false, error: 'The invoices are already issued.', invoices: invoices };
    var sum = invoices.filter(function (i) { return i.status !== 'void'; }).reduce(function (t, i) { return t + i.amountCents; }, 0);
    return { ok: true, invoices: invoices, log: fresh + ' invoice' + (fresh > 1 ? 's' : '') + ' issued (' + invoices.filter(function (i) { return i.number; }).map(function (i) { return i.number; }).join(', ') + '), ' + money(sum) + ' in all, including ' + money(job.taxCents || 0) + ' sales tax.' };
  }
  function issued(job) { return live(job).some(function (i) { return i.number; }); }

  /* Is this invoice ready to go to the customer? */
  function ready(job, inv, today) {
    if (inv.status === 'void' || inv.sent || !inv.number) return false;
    var paid = (inv.payments || []).reduce(function (t, p) { return t + p.amountCents; }, 0); if (inv.amountCents > 0 && paid >= inv.amountCents) return false;
    if (inv.role === 'deposit' || inv.changeOrderId || inv.role === 'change_order') return true;
    var base = live(job).filter(function (i) { return !i.changeOrderId && i.role !== 'change_order'; }), k = base.indexOf(inv), at = ORDER.indexOf(job.stage);
    var needs = k === base.length - 1 ? 'delivered' : 'factory_ordered';
    if (at >= ORDER.indexOf(needs)) return true;
    return !!(today && inv.dueDate && inv.dueDate <= today);
  }
  function readyList(job, today) { return live(job).filter(function (i) { return ready(job, i, today); }); }
  function stateOf(job, inv, today) {
    var paid = (inv.payments || []).reduce(function (t, p) { return t + p.amountCents; }, 0);
    if (inv.amountCents > 0 && paid >= inv.amountCents) return { key: 'paid', label: 'Paid' };
    if (inv.sent) return { key: 'sent', label: 'Sent ' + nice(String(inv.sent.at || '').slice(0, 10)) };
    if (!inv.number) return { key: 'draft', label: 'Not issued' };
    return ready(job, inv, today) ? { key: 'ready', label: 'Ready to send' } : { key: 'later', label: 'Sent at its stage' };
  }

  /* Mark it sent. how: 'email' (the server sent it) | 'mail' (from the team's mail app) | 'hand' (printed or in person) */
  function markSent(inv, how, by, at, to) {
    if (inv.sent) return { ok: false, error: 'Already marked sent.' };
    if (blank(by)) return { ok: false, error: 'Sign in first.' };
    var x = JSON.parse(JSON.stringify(inv)); x.sent = { how: how || 'mail', by: by, at: at || null, to: to || null };
    return { ok: true, invoice: x, log: (inv.number || inv.label) + ' sent to the customer' + (to ? ' (' + to + ')' : '') + ' by ' + by + (how === 'email' ? ' (emailed by the tool)' : how === 'hand' ? ' (by hand)' : ' (from their mail app)') + '.' };
  }

  /* The customer email for one or more invoices: amounts, due dates and how to pay. */
  function customerEmail(job, invs, from) {
    var to = (job.contacts && job.contacts.buyerEmail) || '', name = ((job.contacts && job.contacts.signer) || job.customer || '').split(' ')[0];
    var subject = 'Fremont Makers invoice' + (invs.length > 1 ? 's' : '') + ' ' + invs.map(function (i) { return i.number || i.label; }).join(', ') + ' · ' + (job.projectName || job.customer);
    var lines = ['Hi ' + name + ',', '', (invs.length > 1 ? 'Your invoices are attached:' : 'Your invoice is attached:')];
    invs.forEach(function (i) { lines.push('- ' + (i.number || '') + ' · ' + i.label + ': ' + money(i.amountCents) + (i.taxCents ? ' (includes ' + money(i.taxCents) + ' sales tax)' : '') + ', due ' + nice(i.dueDate)); });
    lines.push('', PAY, '', 'Thank you,', from || 'Fremont Makers');
    var body = lines.join('\n');
    return { to: to, subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }

  /* The package to finance: the executed agreement with its certificate, and every invoice. */
  function financeEmail(job, opts) {
    opts = opts || {}; var to = opts.to || SETTINGS.financeEmail, who = opts.name != null ? opts.name : (opts.to && opts.to !== SETTINGS.financeEmail ? '' : SETTINGS.financeName), invs = live(job).filter(function (i) { return i.number; });
    var total = invs.reduce(function (t, i) { return t + i.amountCents; }, 0), tax = invs.reduce(function (t, i) { return t + (i.taxCents || 0); }, 0);
    var subject = 'Executed: ' + job.jobCode + ' · ' + job.customer + (job.projectName ? ' · ' + job.projectName : '') + ' · ' + money(total);
    var lines = (who ? [who.split(' ')[0] + ',', ''] : []).concat(['Executed agreement and invoices for ' + job.customer + (job.projectName ? ' (' + job.projectName + ')' : '') + ', job ' + job.jobCode + '.', '',
      'Contracted ' + nice(job.contractedOn) + (opts.signedBy ? ', signed by ' + opts.signedBy : '') + '.', 'Contract total ' + money(total) + ', including ' + money(tax) + ' sales tax.', '', 'Invoices:']);
    invs.forEach(function (i) { lines.push('- ' + i.number + ' · ' + i.label + ': ' + money(i.amountCents) + ' (before tax ' + money(i.preTaxCents != null ? i.preTaxCents : i.amountCents) + ', tax ' + money(i.taxCents || 0) + '), due ' + nice(i.dueDate)); });
    lines.push('', 'Attached: the signed agreement with its certificate of completion' + (opts.attachedNote ? ' (' + opts.attachedNote + ')' : '') + ', and each invoice.', '', 'Thank you,', opts.from || 'Fremont Makers');
    var body = lines.join('\n');
    return { to: to, subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }
  function markFinanceSent(job, how, by, at, to) {
    if (job.financeSent) return { ok: false, error: 'Already sent to finance on ' + nice(String(job.financeSent.at || '').slice(0, 10)) + '.' };
    if (blank(by)) return { ok: false, error: 'Sign in first.' };
    return { ok: true, financeSent: { how: how || 'mail', by: by, at: at || null, to: to || SETTINGS.financeEmail }, log: 'Executed agreement and invoices sent to finance (' + (to || SETTINGS.financeEmail) + ') by ' + by + '.' };
  }

  /* What the team should do now, for the dashboard: invoices ready to send, packages not sent to finance. */
  function todo(jobs, today) {
    var out = [];
    (jobs || []).forEach(function (j) {
      var r = readyList(j, today);
      if (r.length) out.push({ jobCode: j.jobCode, kind: 'invoice', text: r.length + ' invoice' + (r.length > 1 ? 's' : '') + ' ready to send to ' + j.customer, tab: 'invoices' });
      if (issued(j) && !j.financeSent && j.esign && (j.esign.provider === 'fm' || j.esign.provider === 'outside' || j.esign.state === 'signed_on_paper')) out.push({ jobCode: j.jobCode, kind: 'finance', text: 'Send ' + j.customer + '\'s executed agreement and invoices to finance', tab: 'invoices' });
    });
    return out;
  }

  return { VERSION: VERSION, SETTINGS: SETTINGS, money: money, taxSplit: taxSplit, issue: issue, issued: issued, ready: ready, readyList: readyList, stateOf: stateOf, markSent: markSent,
           customerEmail: customerEmail, financeEmail: financeEmail, markFinanceSent: markFinanceSent, todo: todo };
}));
