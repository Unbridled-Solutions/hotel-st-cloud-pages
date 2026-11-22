/*
 * Fremont Makers · Project Builder · Phase 2 · Elevation designs (FMDesigns)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMDesigns in a browser.
 *
 * Owner, Nov 19 (like TJ's "All designs"): elevations can be the start of a project. Draw a design (a kitchen, bath, office,
 * laundry…) without SKUs, keep it in the Designs library, and start a project from it. The project begins with the design:
 *   Design → the customer approves it → Estimate (upload the SKUs, price it) → Contract.
 * A design is saved as a record of its own (designTemplate), never counted as a job: it's left out of every list, total and
 * report (FMStore counts). Starting a project copies the design; the design itself never changes. HANDOFF §37.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMDesigns = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var KINDS = { kitchen: 'Kitchen', bath: 'Bath / vanity', office: 'Office or bar', laundry: 'Laundry / mudroom', builtin: 'Built-ins', other: 'Other' };
  var COLORS = { SBW: 'Bayview White Shaker', SWD: 'Bayview Wood Shaker', VDH: 'Dark Hickory Shaker', UMO: 'Moss Green Shaker' };

  function blank(s) { return s == null || String(s).trim() === ''; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* The next design code: DES-0001, DES-0002 … */
  function nextCode(existing) {
    var max = 0; (existing || []).forEach(function (j) { var m = /^DES-(\d{4})$/.exec(j.jobCode || ''); if (m) max = Math.max(max, +m[1]); });
    return 'DES-' + ('000' + (max + 1)).slice(-4);
  }

  /* A new, empty design. input: { name, kind, color, notes } ctx: { by, today, existing } */
  function create(input, ctx) {
    input = input || {}; ctx = ctx || {}; var P = [];
    if (blank(input.name)) P.push('Name the design (for example "L-shaped kitchen with island").');
    if (!KINDS[input.kind]) P.push('Pick what kind of room it is.');
    if (blank(ctx.by)) P.push('Sign in first.');
    if (P.length) return { ok: false, problems: P };
    var code = nextCode(ctx.existing), name = String(input.name).trim(), color = !blank(input.color) ? String(input.color).trim() : 'SBW';   // a shop code or any cabinet color (FMColors)
    return { ok: true, problems: [], design: {
      id: code, jobCode: code, customer: name, projectName: KINDS[input.kind], stage: 'quote', designTemplate: { kind: input.kind, notes: blank(input.notes) ? '' : String(input.notes).trim(), by: ctx.by, on: ctx.today || null, from: input.from || null },
      models: [{ name: name, qty: 1, lines: [] }], invoices: [], changeOrders: [], documents: [], history: [], contacts: {}, esign: { state: 'none' },
      elevations: input.elevations ? clone(input.elevations) : { rooms: [], sizes: {}, versions: [], revisions: [], sketch: { color: color, by: ctx.by, on: ctx.today || null } }
    } };
  }

  /* Save a project's elevations as a design for the library (the project isn't changed). */
  function fromProject(job, input, ctx) {
    var E = job.elevations;
    if (!E || !(E.rooms || []).length) return { ok: false, problems: ['This project has no elevations to save.'] };
    var rooms = clone(E.rooms), name = blank(input && input.name) ? (job.projectName || job.customer) : input.name;
    rooms.forEach(function (r) { r.set = name; });
    return create({ name: name, kind: (input && input.kind) || 'kitchen', color: (E.sketch && E.sketch.color) || 'SBW', notes: input && input.notes, from: job.jobCode,
      elevations: { rooms: rooms, sizes: clone(E.sizes || {}), versions: [], revisions: [], sketch: { color: (E.sketch && E.sketch.color) || 'SBW', by: ctx && ctx.by, on: ctx && ctx.today } } }, ctx);
  }

  /*
   * Start a project from a design. input: { customer, project, signer, email } ctx: { code (the new job code), by, today, pricing (this job's
   * default pricing settings), plan: { pct: [], names: [] } }
   * The project starts design-first: no SKUs, the design's drawings, and a design approval before it's priced.
   */
  function startProject(design, input, ctx) {
    input = input || {}; ctx = ctx || {}; var P = [];
    if (blank(input.customer)) P.push('Enter the customer.');
    if (blank(ctx.code)) P.push('The new job number is missing.');
    if (blank(ctx.by)) P.push('Sign in first.');
    if (P.length) return { ok: false, problems: P };
    var project = blank(input.project) ? design.customer : String(input.project).trim(), E = design.elevations || { rooms: [], sizes: {} };
    var rooms = clone(E.rooms || []); rooms.forEach(function (r) { r.set = project; });
    var plan = (ctx.plan && ctx.plan.pct) || [50, 50], names = (ctx.plan && ctx.plan.names) || ['Deposit', 'At delivery'], pr = ctx.pricing || {};
    var job = {
      id: ctx.code, jobCode: ctx.code, customer: String(input.customer).trim(), projectName: project, kind: 'single', quoteDate: ctx.today || null, deliveryDate: null,
      originalContractCents: 0, houses: [], history: [], changeOrders: [], contacts: { signer: blank(input.signer) ? String(input.customer).trim() : String(input.signer).trim(), buyerEmail: blank(input.email) ? '' : String(input.email).trim() },
      source: { system: 'phase2' }, stage: 'quote', installAddress: '', invoices: plan.map(function (p, i) { return { id: ctx.code + '-inv' + (i + 1), label: 'Invoice ' + (i + 1) + ' · ' + p + '%', role: i === 0 ? 'deposit' : 'progress', changeOrderId: null, dueDate: null, amountCents: 0, status: 'open', payments: [] }; }),
      taxCents: 0, costCents: 0, absorbedCents: 0, documents: [], fmSigner: null, esign: { state: 'none' }, contractedOn: null,
      pricing: { markupPct: pr.markupPct, discountPctOfCost: pr.discountPctOfCost, gaPct: pr.gaPct, taxPct: pr.taxPct, assemblyHours: 0, assemblyRateCents: pr.assemblyRateCents || 0, assemblyCents: 0, plan: plan.slice(), planNames: names.slice(), planMode: 'preset' },
      models: [{ name: project, qty: 1, lines: [] }], charges: { parts: [] },
      elevations: { rooms: rooms, sizes: clone(E.sizes || {}), versions: [], revisions: [], sketch: { color: (E.sketch && E.sketch.color) || 'SBW', by: ctx.by, on: ctx.today || null }, fromDesign: design.jobCode },
      designFirst: true, fromDesign: { code: design.jobCode, name: design.customer }
    };
    return { ok: true, problems: [], job: job, log: 'Project started from the design "' + design.customer + '" (' + design.jobCode + ') by ' + ctx.by + '. Next: the customer approves the design, then it\'s priced.' };
  }

  /* The library list: designs, newest first, with how many projects started from each. */
  function library(all) {
    var designs = (all || []).filter(function (j) { return j.designTemplate; });
    return designs.map(function (d) {
      var used = (all || []).filter(function (j) { return j.fromDesign && j.fromDesign.code === d.jobCode; });
      var walls = (d.elevations && d.elevations.rooms || []).reduce(function (t, r) { return t + (r.walls || []).length; }, 0);
      return { code: d.jobCode, name: d.customer, kind: d.designTemplate.kind, kindLabel: KINDS[d.designTemplate.kind] || 'Other', notes: d.designTemplate.notes, by: d.designTemplate.by, on: d.designTemplate.on,
               rooms: (d.elevations && d.elevations.rooms || []).length, walls: walls, projects: used.map(function (j) { return { code: j.jobCode, customer: j.customer }; }) };
    }).sort(function (a, b) { return String(b.on || '').localeCompare(String(a.on || '')) || b.code.localeCompare(a.code); });
  }

  return { VERSION: VERSION, KINDS: KINDS, COLORS: COLORS, nextCode: nextCode, create: create, fromProject: fromProject, startProject: startProject, library: library };
}));
