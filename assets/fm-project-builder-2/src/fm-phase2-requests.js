/*
 * Fremont Makers · Project Builder · Phase 2 · "Need an update?" requests (FMRequests)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMRequests in a browser.
 *
 * Owner, Nov 12: a quick way for the team to report something broken, a wrong number, something confusing, or an idea,
 * from anywhere in the tool. Each one is emailed to the owner (lwyss@unbridled.com) and kept in a list with its status.
 * Three short steps: what kind → where (worked out from the page they're on) → tell us. The tool adds the details a
 * non-technical person wouldn't know to give: the page, job, tab and step, who, when, the browser and any recent errors.
 * HANDOFF.md §36.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMRequests = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var TO = 'lwyss@unbridled.com';

  var KINDS = {
    broken: { label: 'Something isn\'t working', hint: 'A button does nothing, an error shows, or the wrong thing happened',
      ask: 'What were you trying to do, and what happened instead?', example: 'I clicked Save on the payment and nothing happened. The invoice still shows unpaid.' },
    numbers: { label: 'A number looks wrong', hint: 'A price, total, balance, tax or date isn\'t right',
      ask: 'Which number is wrong, and what should it be?', example: 'Penrose balance shows $120.00 but the customer paid in full.' },
    stuck: { label: 'I\'m stuck or confused', hint: 'You can\'t find something or don\'t know how to do it',
      ask: 'What are you trying to do?', example: 'I need to add a cabinet to a change order but can\'t find where.' },
    idea: { label: 'I have an idea', hint: 'Something that would make the tool easier or better',
      ask: 'What would help, and why?', example: 'It would save time if the deposit reminder showed on the dashboard.' }
  };
  var URGENCY = { blocking: 'It\'s stopping my work', soon: 'Soon, please', later: 'It can wait' };
  var STATUS = { new: 'New', working: 'Working on it', fixed: 'Fixed', notdoing: 'Not doing', question: 'Question for you' };

  /* Parts of the tool, for "where is it?". The page they're on is picked for them; they can change it. */
  var AREAS = [
    ['projects', 'All projects'], ['new', 'New project'],
    ['job:overview', 'A project › Overview'], ['job:cabinets', 'A project › Cabinets'], ['job:elevations', 'A project › Elevations'],
    ['job:changes', 'A project › Change orders'], ['job:contract', 'A project › Contract and signing'], ['job:invoices', 'A project › Invoices and payments'],
    ['job:documents', 'A project › Documents'], ['job:activity', 'A project › Activity'],
    ['elevations', 'Elevations'], ['customers', 'Customers'], ['measure', 'Field measure'],
    ['books', 'Company books (dashboard, P&L, balances, reports)'], ['users', 'Users'],
    ['printed', 'A printed document (contract packet, invoice, change order)'], ['sign', 'The customer signing page'], ['other', 'Somewhere else / not sure']
  ];
  var AREA_LABEL = {}; AREAS.forEach(function (a) { AREA_LABEL[a[0]] = a[1]; });
  var BOOKS = { dashboard: 'Dashboard', pipeline: 'Pipeline', deposits: 'Deposits due', reconcile: 'Reconcile', pnl: 'Job P&L', company: 'Company P&L', jobbalances: 'Job balances', balance: 'Balance sheet', exports: 'Reports & exports' };
  var TABS = { overview: 'Overview', cabinets: 'Cabinets', elevations: 'Elevations', changes: 'Change orders', contract: 'Contract', invoices: 'Invoices', documents: 'Documents', activity: 'Activity' };

  function blank(s) { return s == null || String(s).trim() === ''; }
  /* Shown in Mountain Time (Cañon City). */
  function when(at) {
    if (!at || !/T/.test(at)) return at || '';
    try { return new Date(at).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); } catch (e) { return at; }
  }

  /*
   * Where the person is, from the page address and what's open.
   * hash: location.hash ('#/job/FM-2609-314/changes'); open: { job: { jobCode, customer, projectName }, flow: 'New change order 2', step: 'Cabinets', viewer: 'Invoice 2' }
   * Returns { area, label, jobCode, detail }. label is the plain sentence shown to them and in the email.
   */
  function where(hash, open) {
    open = open || {};
    var h = String(hash || '').replace(/^#\/?/, '').split('/'), a = h[0] || 'books', area = 'other', parts = [], code = null;
    if (a === 'job') {
      var tab = h[2] || 'overview'; area = 'job:' + (TABS[tab] ? tab : 'overview'); code = decodeURIComponent(h[1] || '') || null;
      var j = open.job; parts.push(j ? j.customer + (j.projectName ? ' · ' + j.projectName : '') + ' (' + (j.jobCode || code) + ')' : 'Project ' + code); parts.push(TABS[tab] || tab);
    } else if (a === 'books') { area = 'books'; parts.push('Company books', BOOKS[h[1]] || BOOKS.dashboard); }
    else if (AREA_LABEL[a]) { area = a; parts.push(AREA_LABEL[a]); if (a === 'customers' && h[1]) parts.push(decodeURIComponent(h[1])); }
    else parts.push('Somewhere else');
    if (open.flow) parts.push(open.flow + (open.step ? ', step: ' + open.step : ''));
    if (open.viewer) { parts.push('viewing ' + open.viewer); }
    return { area: area, label: parts.join(' › '), jobCode: code || (open.job && open.job.jobCode) || null, detail: open.flow || open.viewer || null };
  }

  /* Make the browser string readable: "Chrome on Mac". */
  function browser(ua) {
    ua = String(ua || ''); if (!ua) return 'unknown';
    var b = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    var o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '';
    return b + (o ? ' on ' + o : '');
  }

  /*
   * Check what they filled in.
   * input: { kind, area, text, urgency, attachments: [{ name, bytes, type }] }
   */
  var SHOT_TYPES = /\.(png|jpe?g|heic|heif|gif|webp|pdf)$/i, SHOT_MAX = 10 * 1024 * 1024;
  function check(input) {
    input = input || {}; var P = [];
    if (!KINDS[input.kind]) P.push('Pick what kind of update it is.');
    if (!AREA_LABEL[input.area]) P.push('Pick where in the tool it is.');
    if (blank(input.text)) P.push('Tell us a little about it. One sentence is plenty.');
    else if (String(input.text).trim().length < 8) P.push('Add a few more words so Lindsay knows what to look at.');
    (input.attachments || []).forEach(function (f) {
      if (!SHOT_TYPES.test(f.name || '')) P.push(f.name + ': add a screenshot or photo (PNG, JPG, HEIC) or a PDF.');
      else if (f.bytes > SHOT_MAX) P.push(f.name + ' is over 10 MB. Take a smaller screenshot.');
    });
    if ((input.attachments || []).length > 3) P.push('Up to 3 screenshots, please.');
    return P;
  }

  /*
   * Build the request.
   * ctx: { seq, by: { name, email, access }, at (ISO), today, hash, where (from where()), userAgent, screen: 'w×h', version, errors: [text] }
   * Returns { ok, problems, request }.
   */
  function create(input, ctx) {
    input = input || {}; ctx = ctx || {};
    var P = check(input);
    if (!ctx.by || blank(ctx.by.name)) P.push('Sign in so Lindsay knows who sent it.');
    if (P.length) return { ok: false, problems: P, request: null };
    var w = ctx.where || where(ctx.hash, {}), n = ctx.seq || 1;
    var area = input.area === w.area ? w : { area: input.area, label: AREA_LABEL[input.area] + (w.area !== input.area ? ' (they were on ' + w.label + ')' : ''), jobCode: w.jobCode, detail: null };
    var req = {
      id: 'REQ-' + ('000' + n).slice(-4), number: n, kind: input.kind, urgency: URGENCY[input.urgency] ? input.urgency : 'soon',
      area: area.area, where: area.label, jobCode: area.jobCode || null, text: String(input.text).trim(),
      attachments: (input.attachments || []).map(function (f) { return { name: f.name, bytes: f.bytes, type: f.type || '', key: f.key || null }; }),
      by: ctx.by.name, byEmail: ctx.by.email || null, at: ctx.at || ctx.today || null,
      context: { page: ctx.hash || null, version: ctx.version || null, browser: browser(ctx.userAgent), screen: ctx.screen || null, errors: (ctx.errors || []).slice(-5) },
      status: 'new', history: [{ at: ctx.at || null, by: ctx.by.name, status: 'new', note: 'Sent' }], emailed: null
    };
    return { ok: true, problems: [], request: req };
  }

  /* The email to the owner. The server sends it; nothing here needs the person to have email set up. */
  function email(req, opts) {
    opts = opts || {};
    var k = KINDS[req.kind] || { label: req.kind }, urgent = req.urgency === 'blocking';
    var subject = (urgent ? '[Stopping work] ' : '') + 'Project Builder ' + req.id + ': ' + k.label + ' · ' + req.where.split(' › ').slice(0, 2).join(' › ');
    var lines = [
      req.by + ' sent a "Need an update?" request.', '',
      'What: ' + k.label, 'Where: ' + req.where, 'How urgent: ' + URGENCY[req.urgency], '',
      'In their words:', req.text, ''
    ];
    if (req.attachments.length) lines.push('Screenshots: ' + req.attachments.map(function (a) { return a.name; }).join(', ') + (opts.attachedNote ? ' (' + opts.attachedNote + ')' : ''), '');
    lines.push('Details the tool added:',
      '- Sent ' + when(req.at) + ' by ' + req.by + (req.byEmail ? ' (' + req.byEmail + ')' : ''),
      '- Page: ' + (req.context.page || '—') + (req.jobCode ? ' · job ' + req.jobCode : ''),
      '- Version: ' + (req.context.version || '—') + ' · ' + req.context.browser + (req.context.screen ? ' · screen ' + req.context.screen : ''));
    lines.push(req.context.errors.length ? '- Recent errors on their screen:\n  ' + req.context.errors.join('\n  ') : '- No errors showed on their screen.');
    if (opts.link) lines.push('', 'Open it in the tool: ' + opts.link);
    var body = lines.join('\n');
    var to = opts.to || TO;
    return { to: to, subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }

  /* Change a request's status (Full access). A note is required for "Not doing" and "Question for you". */
  function setStatus(req, status, user, note, at) {
    if (!STATUS[status]) return { ok: false, error: 'Pick a status.' };
    if (!user || user.access !== 'full') return { ok: false, error: 'Only someone with Full access can change a request\'s status.' };
    if ((status === 'notdoing' || status === 'question') && blank(note)) return { ok: false, error: status === 'question' ? 'Write the question so they can answer it.' : 'Say why, so they know.' };
    if (status === req.status && blank(note)) return { ok: false, error: 'It\'s already ' + STATUS[status] + '.' };
    var r = JSON.parse(JSON.stringify(req)); r.status = status;
    r.history.push({ at: at || null, by: user.name, status: status, note: blank(note) ? '' : String(note).trim() });
    return { ok: true, request: r, log: req.id + ' marked ' + STATUS[status] + ' by ' + user.name + (blank(note) ? '.' : ': ' + String(note).trim()) };
  }

  /* The requester adds more (answers a question, or "it happened again"). */
  function addNote(req, user, note, at) {
    if (blank(note)) return { ok: false, error: 'Write something to add.' };
    if (!user || blank(user.name)) return { ok: false, error: 'Sign in first.' };
    var r = JSON.parse(JSON.stringify(req));
    r.history.push({ at: at || null, by: user.name, status: r.status === 'question' ? 'new' : r.status, note: String(note).trim() });
    if (r.status === 'question') r.status = 'new';
    return { ok: true, request: r, log: user.name + ' added to ' + req.id + ': ' + String(note).trim() };
  }

  /* Counts for the sidebar badge: open = new, working, question. */
  function counts(list) {
    var c = { open: 0, new: 0, working: 0, question: 0, fixed: 0, notdoing: 0 };
    (list || []).forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; if (r.status === 'new' || r.status === 'working' || r.status === 'question') c.open++; });
    return c;
  }

  return { VERSION: VERSION, TO: TO, KINDS: KINDS, URGENCY: URGENCY, STATUS: STATUS, AREAS: AREAS, AREA_LABEL: AREA_LABEL,
           where: where, browser: browser, check: check, create: create, email: email, setStatus: setStatus, addNote: addNote, counts: counts };
}));
