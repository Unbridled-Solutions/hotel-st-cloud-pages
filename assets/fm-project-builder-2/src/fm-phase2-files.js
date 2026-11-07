/*
 * Fremont Makers · Project Builder · Phase 2 · Job documents (FMFiles)
 * Version 1.0.0. Pure functions: no DOM, storage or network. UMD: window.FMFiles in a browser.
 *
 * A job's Documents tab has four sections:
 *   Contract and invoices · Change orders (grouped by change order) · Supplier orders · Supporting documents
 * Supporting documents are files the team uploads: architectural plans, photos, specs and selections,
 * emails and notes, anything else. Each one is recorded with who uploaded it and when.
 * Nothing is ever deleted: Remove hides a file from the list and keeps it (with who, when and why) so it
 * can be restored. See HANDOFF.md §32.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMFiles = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';

  var CATEGORIES = {
    architectural: { label: 'Architectural plans', hint: 'Plans, floor plans, elevations or renderings from the client, builder or architect' },
    photo: { label: 'Photos', hint: 'Site photos, existing kitchen, damage, finished install' },
    spec: { label: 'Specs and selections', hint: 'Appliance specs, door style, color or hardware selections' },
    correspondence: { label: 'Emails and notes', hint: 'Emails, texts or notes from the client worth keeping with the job' },
    other: { label: 'Other', hint: 'Anything else that belongs with the job' }
  };
  /* Files the tool makes or attaches itself; the upload form doesn't offer these. */
  var SYSTEM = { contract: 'Contract', invoice: 'Invoice', change_order: 'Change order', 'supplier-order': 'Supplier order' };

  var TYPES = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif',
    dwg: 'application/acad', dxf: 'image/vnd.dxf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv', txt: 'text/plain', eml: 'message/rfc822'
  };
  var IMAGES = { jpg: 1, jpeg: 1, png: 1, webp: 1, gif: 1, heic: 1, heif: 1 };
  var MAX_BYTES = 25 * 1024 * 1024;

  function blank(s) { return s == null || String(s).trim() === ''; }
  function ext(name) { var m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
  function stem(name) { return String(name || '').replace(/\.[A-Za-z0-9]+$/, '').replace(/[_]+/g, ' ').trim(); }
  function size(bytes) { return bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1e3)) + ' KB'; }
  function key(d) { return d.id || d.file; }

  /* The accept="" list for the file picker. */
  function accept() { return Object.keys(TYPES).map(function (e) { return '.' + e; }).join(','); }

  /*
   * Check an upload and build its document record.
   * file:  { name, size, type, sha256? }       (what the browser knows about the picked file; sha256 when it could be worked out)
   * input: { category, title?, note?, changeOrder? }  (changeOrder: the number it belongs to, for files attached to a change order)
   * opts:  { jobCode, by, today, existing: job.documents, seq }
   * Returns { ok, problems[], warnings[], doc }.
   */
  function check(file, input, opts) {
    file = file || {}; input = input || {}; opts = opts || {};
    var P = [], W = [], e = ext(file.name), existing = (opts.existing || []).filter(function (d) { return !d.removed; });
    if (blank(file.name)) P.push('Choose a file.');
    else if (!TYPES[e]) P.push(file.name + ' isn\'t a type the tool keeps. Use PDF, a photo (JPG, PNG, HEIC), CAD (DWG, DXF), Word, Excel, CSV, text or email.');
    if (!(file.size > 0)) P.push('That file is empty.');
    else if (file.size > MAX_BYTES) P.push(file.name + ' is ' + size(file.size) + '. The limit is 25 MB; save a smaller copy (for photos, email-size works).');
    var co = input.changeOrder != null && input.changeOrder !== '' ? +input.changeOrder : null;
    if (co == null && !CATEGORIES[input.category]) P.push('Choose what kind of document it is.');
    if (blank(opts.by)) P.push('Sign in so the upload is recorded under your name.');
    var same = file.sha256 ? existing.filter(function (d) { return d.sha256 && d.sha256 === file.sha256; })[0] : null;
    if (same) P.push('This exact file is already on the job as "' + same.title + '".');
    var name = String(file.name || '');
    if (!same && existing.some(function (d) { return d.file === name; })) {
      var n = 2, base = stem(name), x = e ? '.' + e : '';
      while (existing.some(function (d) { return d.file === base + ' (' + n + ')' + x; })) n++;
      name = base + ' (' + n + ')' + x;
      W.push('A different file named ' + file.name + ' is already on the job, so this one is saved as ' + name + '.');
    }
    var doc = {
      id: (opts.jobCode || 'job') + '-doc' + (opts.seq != null ? opts.seq : existing.length + 1),
      jobCode: opts.jobCode || null,
      kind: co != null ? 'change_order' : 'supporting',
      category: co != null ? (CATEGORIES[input.category] ? input.category : 'other') : input.category,
      title: blank(input.title) ? stem(file.name) : String(input.title).trim(),
      file: name, bytes: file.size || 0, type: file.type || TYPES[e] || '', image: !!IMAGES[e],
      sha256: file.sha256 || null, note: blank(input.note) ? '' : String(input.note).trim(),
      changeOrder: co, uploadedBy: opts.by || '', uploadedOn: opts.today || null
    };
    return { ok: P.length === 0, problems: P, warnings: W, doc: doc };
  }

  /* Remove keeps the file and records who, when and why. Restore brings it back. Neither changes the input. */
  function remove(doc, by, on, reason) {
    if (doc.signRequest) return { ok: false, error: 'Copies signed in the tool stay on the job.' };
    if (doc.kind !== 'supporting' && doc.kind !== 'change_order') return { ok: false, error: 'Signed contracts, invoices and supplier orders stay on the job.' };
    if (!doc.uploadedBy) return { ok: false, error: 'Only uploaded files can be removed.' };
    if (blank(by)) return { ok: false, error: 'Sign in first.' };
    var d = JSON.parse(JSON.stringify(doc)); d.removed = { by: by, on: on || null, reason: blank(reason) ? '' : String(reason).trim() };
    return { ok: true, doc: d, log: 'Removed "' + doc.title + '" from the documents' + (d.removed.reason ? ' (' + d.removed.reason + ')' : '') + '. The file is kept and can be restored.' };
  }
  function restore(doc, by) {
    var d = JSON.parse(JSON.stringify(doc)); delete d.removed;
    return { ok: true, doc: d, log: 'Restored "' + doc.title + '" to the documents (' + by + ').' };
  }

  /*
   * The Documents tab, in sections. Removed files are listed separately so they can be restored.
   * changeOrders: job.changeOrders, so each change order's files sit under its number and reason.
   */
  function sections(documents, changeOrders) {
    var live = (documents || []).filter(function (d) { return !d.removed; });
    var cos = {}, coList = [];
    (changeOrders || []).forEach(function (c) { cos[c.number] = { number: c.number, reason: c.reason || '', status: c.status || '', date: c.date || null, docs: [] }; coList.push(cos[c.number]); });
    var contract = [], supplier = [], supporting = {}, loose = [];
    live.forEach(function (d) {
      if (d.changeOrder != null) {
        if (!cos[d.changeOrder]) { cos[d.changeOrder] = { number: d.changeOrder, reason: '', status: '', date: null, docs: [] }; coList.push(cos[d.changeOrder]); }
        cos[d.changeOrder].docs.push(d); return;
      }
      if (d.kind === 'contract' || d.kind === 'invoice') contract.push(d);
      else if (d.kind === 'supplier-order') supplier.push(d);
      else if (d.kind === 'supporting' || CATEGORIES[d.category]) { var c = CATEGORIES[d.category] ? d.category : 'other'; (supporting[c] = supporting[c] || []).push(d); }
      else loose.push(d);
    });
    if (loose.length) (supporting.other = supporting.other || []).push.apply(supporting.other, loose);
    coList.sort(function (a, b) { return a.number - b.number; });
    return {
      contract: contract,
      changeOrders: coList,
      supplier: supplier,
      supporting: Object.keys(CATEGORIES).filter(function (k) { return supporting[k]; }).map(function (k) { return { category: k, label: CATEGORIES[k].label, docs: supporting[k] }; }),
      supportingCount: Object.keys(supporting).reduce(function (t, k) { return t + supporting[k].length; }, 0),
      removed: (documents || []).filter(function (d) { return d.removed; }),
      count: live.length
    };
  }

  return { VERSION: VERSION, CATEGORIES: CATEGORIES, SYSTEM: SYSTEM, TYPES: TYPES, MAX_BYTES: MAX_BYTES, accept: accept, ext: ext, size: size, key: key,
           check: check, remove: remove, restore: restore, sections: sections };
}));
