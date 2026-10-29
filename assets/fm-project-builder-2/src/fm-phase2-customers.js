/*
 * Fremont Makers Project Builder · Phase 2 · Customers and templates (HANDOFF §25).  window.FMCustomers
 *
 * A customer profile holds who they are and how to reach them: contacts (who signs, who gets invoices, who's on site),
 * addresses (billing and job sites), notes, and templates. Pricing never lives here: markup, discount, G&A, tax,
 * assembly and the payment plan are set on each job (owner rule; "Copy from a past job" in New Project still works).
 *
 * A template is a reusable house setup: one home, or a builder order with several models (Willow Creek: San Luis,
 * Mesa Ridge, Sangre Vista, Pinyon Crest, Cimarron Peak), each with its usual house count, cabinet lines and drawings.
 *
 * customer: { id, name, kind: 'builder'|'homeowner'|'other', contacts: [{ id, name, role, email, phone, signs }],
 *             addresses: [{ id, label, kind: 'billing'|'site', line }], notes, templates: [template], createdAt }
 * template: { id, name, kind: 'single'|'builder', models: [{ name, qty, lines: [{ sku, desc, qty, unitCostCents }], rooms: [elevation room] }],
 *             fromJob, costsAsOf, createdAt, createdBy }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMCustomers = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.1.0';
  var ROLES = { signer: 'Signs contracts', billing: 'Gets invoices', site: 'On site / superintendent', other: 'Other' };
  var KINDS = { builder: 'Builder', homeowner: 'Homeowner', other: 'Other' };

  var seq = 0;
  function newId(p) { seq++; return (p || 'c') + '-' + Date.now().toString(36) + '-' + seq; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function key(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  function blank(name, kind) { return { id: newId('cust'), name: String(name || '').trim(), kind: kind || 'homeowner', contacts: [], addresses: [], notes: '', templates: [] }; }

  /* Profiles for every customer already on a job (change orders filed as projects are skipped). Existing profiles are kept;
     a contact or site seen on a job is added once. */
  function fromJobs(jobs, existing) {
    var out = clone(existing || []), by = {};
    out.forEach(function (c) { by[key(c.name)] = c; });
    (jobs || []).forEach(function (j) {
      if (!j.customer || /change order/i.test(j.customer) || j.parentJobCode) return;
      var c = by[key(j.customer)];
      if (!c) { c = blank(j.customer, guessKind(j)); out.push(c); by[key(j.customer)] = c; }
      var signer = j.contacts && String(j.contacts.signer || '').trim(), email = j.contacts && String(j.contacts.buyerEmail || '').trim();
      if (!isEmail(email)) email = '';   // jobs sometimes hold a note here ("needed for HelloSign"), not an address
      if (signer && !/^sample customer$/i.test(signer) && !c.contacts.some(function (x) { return key(x.name) === key(signer); }))
        c.contacts.push({ id: newId('ct'), name: signer, role: 'signer', email: email, phone: '', signs: true });
      else if (signer && email) c.contacts.forEach(function (x) { if (key(x.name) === key(signer) && !x.email) x.email = email; });
      var site = String(j.installAddress || '').trim();
      if (site && !c.addresses.some(function (a) { return key(a.line) === key(site); })) c.addresses.push({ id: newId('ad'), label: j.projectName || 'Job site', kind: 'site', line: site });
    });
    return out;
  }
  function guessKind(j) {
    if (j.kind === 'builder_order' || (j.houses && j.houses.length > 1)) return 'builder';
    return /\b(builders?|homes|construction|contractors?|development|developers?|estates|properties|holdings)\b/i.test(j.customer || '') ? 'builder' : 'homeowner';
  }
  function jobsFor(customer, jobs) { return (jobs || []).filter(function (j) { return key(j.customer) === key(customer.name) && !j.parentJobCode; }); }
  function signer(customer) { return (customer.contacts || []).filter(function (x) { return x.signs; })[0] || (customer.contacts || [])[0] || null; }

  function check(customer, others) {
    var p = [];
    if (!String(customer.name || '').trim()) p.push('Enter the customer\'s name.');
    if ((others || []).some(function (o) { return o.id !== customer.id && key(o.name) === key(customer.name); })) p.push('There\'s already a customer called ' + customer.name + '.');
    (customer.contacts || []).forEach(function (x, i) {
      var who = x.name || 'Contact ' + (i + 1);
      if (!String(x.name || '').trim()) p.push('Contact ' + (i + 1) + ': enter a name.');
      if (x.email && !isEmail(x.email)) p.push(who + ': that email doesn\'t look right.');
      if (x.signs && !x.email) p.push(who + ' signs contracts, so they need an email for Dropbox Sign.');
    });
    return p;
  }

  /* A template from a job's homes: sets = [{ key, qty, lines }] (cabinets after change orders), rooms = elevation rooms keyed by set. */
  function templateFromSets(name, sets, rooms, opts) {
    opts = opts || {};
    var kind = sets.length > 1 || (sets[0] && sets[0].qty > 1) ? 'builder' : 'single';
    return { id: newId('tpl'), name: String(name || '').trim() || 'Template', kind: kind,
      models: sets.map(function (s) {
        return { name: s.key, qty: Math.max(1, +s.qty || 1),
          lines: (s.lines || []).filter(function (l) { return +l.qty > 0; }).map(function (l) { return { sku: l.sku, desc: l.desc || '', qty: +l.qty, unitCostCents: l.unitCostCents != null ? l.unitCostCents : Math.round((+l.unitCost || 0) * 100) }; }),
          rooms: clone((rooms || []).filter(function (r) { return r.set === s.key; })) };
      }),
      fromJob: opts.fromJob || null, costsAsOf: opts.today || null, createdAt: opts.today || null, createdBy: opts.by || null };
  }
  function summary(t) {
    var houses = t.models.reduce(function (n, m) { return n + m.qty; }, 0), lines = t.models.reduce(function (n, m) { return n + m.lines.length; }, 0),
      rooms = t.models.reduce(function (n, m) { return n + m.rooms.length; }, 0);
    return (t.kind === 'builder' ? t.models.length + ' model' + (t.models.length === 1 ? '' : 's') + ', ' + houses + ' house' + (houses === 1 ? '' : 's') : 'One home') +
      ' · ' + lines + ' cabinet lines' + (rooms ? ' · ' + rooms + ' room' + (rooms === 1 ? '' : 's') + ' drawn' : '');
  }

  return { VERSION: VERSION, ROLES: ROLES, KINDS: KINDS, newId: newId, key: key, isEmail: isEmail, blank: blank, fromJobs: fromJobs, jobsFor: jobsFor,
    signer: signer, check: check, templateFromSets: templateFromSets, summary: summary };
}));
