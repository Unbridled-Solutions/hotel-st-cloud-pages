/*
 * Fremont Makers · Project Builder · Phase 2 · Emails to the customer (FMEmails)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMEmails in a browser.
 *
 * Owner, Nov 19 (from TJ's Log & Timber): the tool suggests the right email to the customer at each step of a project
 * (design to approve, contract to sign, signed, invoices, payment received, ordered, delivered, thank you) and writes it.
 * Every email comes from a template that Full access can reword (Company → Email templates); a blank template falls back
 * to the wording here. Placeholders in {curly braces} are filled in from the job. HANDOFF §43.
 *
 * Templates the team saved: settings.emailTemplates = { <kind>: { subject, body } }. Nothing else is stored.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMEmails = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var COMPANY = 'Fremont Makers';
  var PAY = 'Checks payable to Fremont Makers LLC, 719 Main Street, Cañon City, CO 81212. Ask us for bank transfer details.';

  /* In the order a project goes. step: where it fits (FMSteps keys). */
  var TEMPLATES = [
    { kind: 'design-approve', step: 'design', name: 'Design ready to approve', who: 'To the customer, with the drawings',
      subject: 'Your {company} cabinet design for {project}',
      body: 'Hi {first},\n\nYour cabinet design for {project} is ready. {designLine}\n\nTake a look and let us know if you\'d like anything changed. Once you approve it, we\'ll price it and send your contract.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'designLine', 'link', 'sender'] },
    { kind: 'contract-sign', step: 'estimate', name: 'Contract ready to sign', who: 'To the buyer, with their signing link',
      subject: 'Your {company} contract is ready to sign',
      body: 'Hi {first},\n\nYour cabinet contract for {project} ({code}) is ready. Contract price: {price}.\n\nPlease review and sign it here:\n{link}\n\nThe link is just for you and works until {expires}. You can ask us for a paper copy at any time. Your first invoice is due at signing; we place your factory order once it\'s paid.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'price', 'link', 'expires', 'sender'] },
    { kind: 'sign-reminder', step: 'estimate', name: 'Signing reminder', who: 'To whoever hasn\'t signed yet',
      subject: 'Reminder: your {company} contract is waiting for your signature',
      body: 'Hi {first},\n\nA quick reminder: your cabinet contract for {project} is waiting for your signature:\n{link}\n\nThe link works until {expires}. Reply to this email with any questions.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'link', 'expires', 'sender'] },
    { kind: 'contract-signed', step: 'order', name: 'Signed: thank you and what\'s next', who: 'To the buyer, once everyone has signed',
      subject: 'Signed: your {company} contract for {project}',
      body: 'Hi {first},\n\nThank you! Everyone has signed the contract for {project} ({code}). {copyLine}\n\nWhat happens next:\n- Your deposit invoice comes in a separate email.\n- Once it\'s paid, we place your factory order.\n- We\'ll confirm your delivery date when the factory gives it to us.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'copyLine', 'link', 'sender'] },
    { kind: 'invoice', step: 'order', name: 'Invoices to the customer', who: 'To the customer, with the invoice PDF attached',
      subject: '{company} {invoiceWord} {invoiceNumbers} · {project}',
      body: 'Hi {first},\n\n{attachedLine}\n\n{invoiceList}\n\n{payHow}\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'invoiceWord', 'invoiceNumbers', 'attachedLine', 'invoiceList', 'payHow', 'sender'] },
    { kind: 'payment-receipt', step: 'order', name: 'Payment received', who: 'To the customer when a payment is recorded',
      subject: 'Payment received · {project} · {company}',
      body: 'Hi {first},\n\nThank you. We received your payment of {amount} on {payDate} for {project}.\n\nYour account\nContract total: {price}\nPaid to date: {paidToDate}\nBalance to finish: {balance}\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'amount', 'payDate', 'price', 'paidToDate', 'balance', 'sender'] },
    { kind: 'order-placed', step: 'order', name: 'Cabinets ordered', who: 'To the customer when the factory order is placed',
      subject: 'Your cabinets are ordered · {project}',
      body: 'Hi {first},\n\nGood news: we placed the factory order for {project} on {orderedOn}. {deliveryLine}\n\nWe\'ll be in touch before delivery to set a time. If anything changes at the site before then (measurements, appliances, timing), please let us know right away.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'orderedOn', 'deliveryLine', 'sender'] },
    { kind: 'shipped', step: 'order', name: 'Cabinets shipped', who: 'To the customer when the tracking email comes (HANDOFF §45)',
      subject: 'Your cabinets have shipped · {project}',
      body: 'Hi {first},\n\nGood news: your cabinets for {project} have left the factory{carrierLine}. They come to our shop in Cañon City first, where we check every box before {deliveryWord}.\n\nWe\'ll let you know as soon as they\'re in.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'carrierLine', 'deliveryWord', 'sender'] },
    { kind: 'at-shop', step: 'order', name: 'Cabinets at our shop', who: 'To the customer once the shipment is received and checked',
      subject: 'Your cabinets are at our shop · {project}',
      body: 'Hi {first},\n\nYour cabinets for {project} arrived at our shop on {receivedOn}, and we\'ve checked them over. {nextLine}\n\nWhat day works for you? Reply here or give us a call.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'receivedOn', 'nextLine', 'sender'] },
    { kind: 'replacing', step: 'order', name: 'A few pieces are being replaced', who: 'To the customer when a claim is filed with the factory',
      subject: 'Quick update on your cabinets · {project}',
      body: 'Hi {first},\n\nA quick update on {project}: when we checked your cabinets, a few pieces needed replacing:\n{replaceList}\n\nWe\'ve asked the factory for replacements, and they ship together. Nothing changes on your price. We\'ll let you know when they arrive and how it affects {deliveryWord}.\n\nThank you for your patience,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'replaceList', 'deliveryWord', 'sender'] },
    { kind: 'replacement-in', step: 'order', name: 'Replacement pieces are in', who: 'To the customer when the replacement parts arrive',
      subject: 'Your replacement pieces are in · {project}',
      body: 'Hi {first},\n\nThe replacement pieces for {project} arrived at our shop, so your order is complete. Let\'s set a day for {deliveryWord}.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'deliveryWord', 'sender'] },
    { kind: 'delivered', step: 'close', name: 'Delivered: final invoice', who: 'To the customer after delivery',
      subject: 'Your cabinets were delivered · {project}',
      body: 'Hi {first},\n\nYour cabinets for {project} were delivered on {deliveredOn}. Please look everything over and tell us within 7 days about anything damaged or missing, so we can take care of it.\n\n{balanceLine}\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'deliveredOn', 'balanceLine', 'sender'] },
    { kind: 'change-order', step: 'order', name: 'Change order to sign', who: 'To the buyer, with the change order\'s signing link',
      subject: 'Change order {coNumber} for {project}',
      body: 'Hi {first},\n\nChange order {coNumber} for {project} is ready: {coWhat}. Please review and {coAct} it here:\n{link}\n\nThe link works until {expires}.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'coNumber', 'coWhat', 'coAct', 'link', 'expires', 'sender'] },
    { kind: 'thank-you', step: 'close', name: 'Thank you, care guide and review', who: 'To the customer when the project is closed out',
      subject: 'Thank you from {company} · {project}',
      body: 'Hi {first},\n\nThank you for choosing Fremont Makers for {project}. It was a pleasure working with you.\n\nYour care guide and warranty details are attached. Your one-year warranty runs through {warrantyEnd}.\n\n{reviewLine}If a friend or neighbor is planning a kitchen, bath or closet, we\'d be grateful for the introduction.\n\nThank you,\n{sender}',
      vars: ['first', 'name', 'project', 'code', 'warrantyEnd', 'reviewLine', 'sender'] }
  ];
  var BY = {}; TEMPLATES.forEach(function (t) { BY[t.kind] = t; });
  var LABELS = { first: 'first name of the person it goes to', name: 'their full name', project: 'project name', code: 'job code', price: 'contract total', link: 'their private link',
    expires: 'the date the link stops working', sender: 'your name, Fremont Makers', designLine: 'the signing link, or "The drawings are attached."', copyLine: 'the link to their signed copy',
    invoiceWord: '"invoice" or "invoices"', invoiceNumbers: 'the invoice numbers', attachedLine: '"Your invoice is attached:" or "Your invoices are attached:"', invoiceList: 'one line per invoice with amount, tax and due date',
    payHow: 'how to pay', amount: 'payment amount', payDate: 'date received', paidToDate: 'paid to date', balance: 'balance to finish', orderedOn: 'date the order was placed',
    deliveryLine: 'the estimated delivery date, if there is one', deliveredOn: 'delivery date', balanceLine: 'what\'s left to pay, or "Your account is paid in full."',
    coNumber: 'change order number', coWhat: 'the amount, credit or "no charge"', coAct: '"sign" or "acknowledge"', carrierLine: 'the carrier, like " with Old Dominion"', deliveryWord: '"delivery"', receivedOn: 'the day it reached the shop', nextLine: 'what happens next (assembly, delivery or pickup)', replaceList: 'one line per piece being replaced', warrantyEnd: 'the date the warranty ends', reviewLine: 'the review link, when one is set', company: 'Fremont Makers' };

  function blank(s) { return s == null || String(s).trim() === ''; }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function nice(iso) { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || ''; var p = iso.split('-'); return MON[+p[1] - 1] + ' ' + (+p[2].slice(0, 2)) + ', ' + p[0]; }
  function money(c) { var n = Math.round(c || 0), neg = n < 0; n = Math.abs(n); return (neg ? '−' : '') + '$' + Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + ('0' + n % 100).slice(-2); }
  function ledger() { return typeof FMPhase1 !== 'undefined' ? FMPhase1 : (typeof globalThis !== 'undefined' && globalThis.FMPhase1) || null; }
  function paidOf(inv) { var L = ledger(); return L ? L.invoicePaidCents(inv) : (inv.payments || []).reduce(function (t, p) { return t + (p.amountCents || 0); }, 0); }
  function histOn(job, to) { var h = (job.history || []).filter(function (x) { return x.to === to; }).pop(); return h ? h.date : null; }

  /* The template in use for a kind: the team's saved wording, or the default. saved: settings.emailTemplates. */
  function template(kind, saved) {
    var o = (saved && saved[kind]) || {}, d = BY[kind] || {};
    return { subject: !blank(o.subject) ? o.subject : d.subject || '', body: !blank(o.body) ? o.body : d.body || '', edited: !blank(o.subject) || !blank(o.body) };
  }
  function fill(s, v) { return String(s || '').replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : k === 'company' ? COMPANY : m; }); }
  /* { subject, body } for a kind, filled in. Unknown placeholders are left as typed, so a typo shows. */
  function compose(kind, vars, saved) {
    var t = template(kind, saved), v = Object.assign({ company: COMPANY }, vars || {});
    return { subject: fill(t.subject, v).replace(/\s+/g, ' ').trim(), body: fill(t.body, v).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
  }
  function mailto(to, m) { return 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body); }

  /*
   * Fill-ins from a job. opts: { sender, link, expires, invoices (the ones being sent), payment ({ amountCents, date }),
   * coNumber, warrantyEnd ('YYYY-MM-DD'), reviewLink }.
   */
  function varsFor(job, opts) {
    opts = opts || {}; var L = ledger(), c = job.contacts || {}, s = L ? L.contractSummary(job) : { currentCents: job.originalContractCents || 0, paidCents: 0 };
    var who = c.signer || job.customer || '', invs = opts.invoices || [], balance = s.currentCents - s.paidCents, co = opts.coNumber != null ? (job.changeOrders || []).filter(function (x) { return x.number === opts.coNumber; })[0] : null;
    var ack = co && (co.kind === 'courtesy' || co.kind === 'notice');
    return {
      first: String(who).split(/[ &]/)[0] || 'there', name: who, customer: job.customer || '', project: job.projectName || job.customer || '', code: job.jobCode,
      price: money(s.currentCents), sender: opts.sender || COMPANY, link: opts.link || '', expires: opts.expires ? nice(opts.expires) : '',
      designLine: opts.link ? 'Please review and approve it here:\n' + opts.link : 'The drawings are attached.',
      copyLine: opts.link ? 'Download your signed copy here:\n' + opts.link + '\nPlease save it for your records.' : 'Your signed copy is attached; please save it for your records.',
      invoiceWord: invs.length > 1 ? 'invoices' : 'invoice', invoiceNumbers: invs.map(function (i) { return i.number || i.label; }).join(', '),
      attachedLine: invs.length > 1 ? 'Your invoices for ' + (job.projectName || job.customer) + ' are attached:' : 'Your invoice for ' + (job.projectName || job.customer) + ' is attached:',
      invoiceList: invs.map(function (i) { return '- ' + (i.number ? i.number + ' · ' : '') + i.label + ': ' + money(i.amountCents - paidOf(i)) + (i.taxCents ? ' (includes ' + money(i.taxCents) + ' sales tax)' : '') + ', due ' + nice(i.dueDate); }).join('\n'),
      payHow: PAY, amount: opts.payment ? money(opts.payment.amountCents) : '', payDate: opts.payment ? nice(opts.payment.date) : '',
      paidToDate: money(s.paidCents), balance: money(balance),
      orderedOn: nice(histOn(job, 'factory_ordered') || job.orderedOn || ''), deliveredOn: nice(job.deliveredOn || histOn(job, 'delivered') || ''),
      deliveryLine: job.deliveryDate ? 'The factory estimates delivery around ' + nice(job.deliveryDate) + '.' : 'We\'ll let you know the delivery date as soon as the factory confirms it.',
      balanceLine: balance > 0 ? 'Your final invoice is attached: ' + money(balance) + ' to finish. ' + PAY : 'Your account is paid in full. Thank you!',
      coNumber: co ? co.number : '', coWhat: co ? (ack ? (co.kind === 'courtesy' ? 'at no charge' : 'with no change to your contract') : co.amountCents < 0 ? 'a credit of ' + money(-co.amountCents) : money(co.amountCents)) : '', coAct: ack ? 'acknowledge' : 'sign',
      warrantyEnd: opts.warrantyEnd ? nice(opts.warrantyEnd) : 'one year from your contract date',
      carrierLine: shipInfo(job).carrier ? ' with ' + shipInfo(job).carrier : '', deliveryWord: 'delivery or pickup', receivedOn: nice(shipInfo(job).receivedOn) || 'this week',
      nextLine: 'Next we assemble them, then we\'ll set a day for delivery or pickup.', replaceList: shipInfo(job).replace.map(function (i) { return '- ' + i; }).join('\n') || '- (the pieces)',
      reviewLine: opts.reviewLink ? 'If you\'re happy with your cabinets, would you leave us a short review? It helps a small Colorado shop more than you know:\n' + opts.reviewLink + '\n\n' : ''
    };
  }

  /* What shipping knows (FMShipping, HANDOFF §45): the latest carrier, when it reached the shop, what's being replaced. */
  function shipInfo(job) {
    var out = { carrier: '', receivedOn: '', replace: [] }, S = typeof FMShipping !== 'undefined' ? FMShipping : null;
    (job.supplierOrders || []).forEach(function (o) { (o.shipments || []).forEach(function (s) { out.carrier = s.carrier || out.carrier; if (s.receivedOn) out.receivedOn = s.receivedOn; }); });
    (job.claims || []).forEach(function (q) { if (['closed', 'denied', 'credit_only'].indexOf(q.status) < 0) (q.items || []).forEach(function (i) { if (!i.removed) out.replace.push(i.sku + ' × ' + i.qty + (S ? ' (' + S.PARTS[i.part].toLowerCase() + ')' : '')); }); });
    return out;
  }
  /*
   * The emails that fit where a job is now, most useful first: [{ kind, why, opts }]. opts is what varsFor needs beyond the job
   * (which invoices, which payment, which change order). o: { sign (FMSign, for who's next on a signing request), today ('YYYY-MM-DD'),
   * ready (FMInvoicing.readyList(job, today): invoices ready to send; without it, unpaid invoices that are due and not sent) }.
   */
  function suggest(job, o) {
    o = o || {}; var sign = o.sign, today = o.today;
    var out = [], st = job.stage, r = job.esign && job.esign.request, dr = job.designSign && job.designSign.request;
    if (st === 'lost' || job.testVoid || job.designTemplate) return out;
    var live = (job.invoices || []).filter(function (i) { return i.status !== 'void'; });
    var due = live.filter(function (i) { return i.amountCents > 0 && paidOf(i) < i.amountCents && (!i.dueDate || !today || i.dueDate <= today || i.role === 'deposit' || i.ready); });
    var unsent = o.ready || due.filter(function (i) { return !i.sent && i.number; });
    var pays = []; live.forEach(function (i) { (i.payments || []).forEach(function (p) { pays.push(p); }); }); pays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (st === 'quote') {
      if (dr && dr.status === 'out') out.push({ kind: 'design-approve', why: 'The design is out for the customer\'s approval.' });
      else if (job.designFirst && !job.designApproval && job.elevations && (job.elevations.rooms || []).length) out.push({ kind: 'design-approve', why: 'The design is drawn and waiting on the customer.' });
      if (r && r.status === 'out') {
        var n = sign && sign.nextSigner ? sign.nextSigner(r) : null, late = sign && sign.reminderDue ? sign.reminderDue(r, today) : null;
        if (!n || n.role !== 'fremont') out.push({ kind: late ? 'sign-reminder' : 'contract-sign', why: late ? 'Day ' + late.day + ': the buyer hasn\'t signed yet.' : 'The contract is out for signature.' });
      }
    }
    (job.changeOrders || []).forEach(function (co) { if (co.status === 'sent') out.push({ kind: 'change-order', why: 'Change order ' + co.number + ' is waiting on the buyer.', opts: { coNumber: co.number } }); });
    if (st === 'contract_signed') out.push({ kind: 'contract-signed', why: 'The contract was just signed.' });
    if (unsent.length && st !== 'quote') out.push({ kind: 'invoice', why: unsent.length + ' invoice' + (unsent.length > 1 ? 's are' : ' is') + ' ready to send.', opts: { invoices: unsent } });
    var SO = job.supplierOrders || [], ships = []; SO.forEach(function (o) { (o.shipments || []).forEach(function (s) { ships.push(s); }); });
    var claimsOpen = (job.claims || []).filter(function (q) { return ['submitted', 'replacement_ordered', 'replacement_shipped'].indexOf(q.status) >= 0; });
    if (st === 'factory_ordered' && !ships.length) out.push({ kind: 'order-placed', why: 'The factory order is placed.' });
    if (ships.some(function (s) { return !s.receivedOn; })) out.push({ kind: 'shipped', why: 'A shipment is on its way to the shop.' });
    if (claimsOpen.length) out.push({ kind: 'replacing', why: 'Claim ' + claimsOpen[0].number + ' is with Wholesale Cabinets.' });
    if ((job.claims || []).some(function (q) { return q.status === 'replacement_received'; })) out.push({ kind: 'replacement-in', why: 'The replacement pieces arrived.' });
    else if (ships.length && ships.every(function (s) { return s.receivedOn; }) && !claimsOpen.length && (st === 'factory_ordered' || st === 'deposit_paid')) out.push({ kind: 'at-shop', why: 'Everything is at the shop.' });
    if (st === 'delivered') out.push({ kind: 'delivered', why: 'The cabinets were delivered.' });
    if (pays.length && st !== 'quote') out.push({ kind: 'payment-receipt', why: 'Last payment: ' + money(pays[pays.length - 1].amountCents) + ' on ' + nice(pays[pays.length - 1].date) + '.', opts: { payment: pays[pays.length - 1] } });
    if (st === 'final_paid' || st === 'complete') out.push({ kind: 'thank-you', why: st === 'complete' ? 'The project is closed out.' : 'Paid in full.' });
    return out;
  }

  /* Check a template the team typed. Returns { ok, problems }. Placeholders must be ones that template knows. */
  function check(kind, t) {
    var d = BY[kind], problems = [];
    if (!d) return { ok: false, problems: ['Unknown email.'] };
    var known = d.vars.concat(['company', 'customer', 'price', 'paidToDate', 'balance']);
    [t.subject, t.body].forEach(function (s) { String(s || '').replace(/\{(\w+)\}/g, function (m, k) { if (known.indexOf(k) < 0 && problems.indexOf('{' + k + '} isn\'t a fill-in for this email.') < 0) problems.push('{' + k + '} isn\'t a fill-in for this email.'); return m; }); });
    if (String(t.subject || '').length > 200) problems.push('Keep the subject under 200 characters.');
    return { ok: !problems.length, problems: problems };
  }

  return { VERSION: VERSION, TEMPLATES: TEMPLATES, LABELS: LABELS, PAY: PAY, template: template, compose: compose, mailto: mailto, varsFor: varsFor, suggest: suggest, check: check };
}));
