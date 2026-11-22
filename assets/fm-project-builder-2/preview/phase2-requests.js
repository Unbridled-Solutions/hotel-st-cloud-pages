/*
 * Phase 2 preview · "Need an update?" (window.P2Requests). Uses FMRequests (src/fm-phase2-requests.js).
 *   The sidebar button opens a short form: 1. what kind  2. where (picked for them from the page they're on)  3. tell us.
 *   Sending saves it, and in the live tool the server emails the owner. #/updates lists every request with its status.
 *   HANDOFF §36.
 */
(function () {
  'use strict';
  var R = window.FMRequests;
  var LIVE = !!(window.FM_CONFIG && window.FM_CONFIG.live);
  var VERSION = (window.FM_CONFIG && window.FM_CONFIG.version) || '2.12.0 (preview)';
  var HELD = [];   // screenshots picked in the form: { name, bytes, type, blob }

  /* The last few errors that showed on this screen go with a request, so a "nothing happened" report has something to go on. */
  var ERRORS = [];
  window.addEventListener('error', function (e) { ERRORS.push((e.message || 'Error') + (e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : '')); if (ERRORS.length > 10) ERRORS.shift(); });
  window.addEventListener('unhandledrejection', function (e) { ERRORS.push('Unhandled: ' + (e.reason && e.reason.message || e.reason)); if (ERRORS.length > 10) ERRORS.shift(); });

  var CO_STEPS = ['What happened', 'Cabinets', 'Price', 'Review'], NP_STEPS = ['Customer', 'Homes', 'Cabinets', 'Price', 'Review'];
  /* What's open right now: the job, a change order or New Project step, or a document in the viewer. */
  function openNow(c) {
    var h = location.hash.replace(/^#\/?/, '').split('/'), o = {};
    if (h[0] === 'job') { var j = c.store.job(decodeURIComponent(h[1] || '')); if (j) o.job = { jobCode: j.jobCode, customer: j.customer, projectName: j.projectName }; }
    if (c.ui.co && h[0] === 'job' && h[2] === 'changes') { o.flow = 'new change order'; o.step = CO_STEPS[c.ui.co.step] || null; }
    if (h[0] === 'new') { try { var d = JSON.parse(localStorage.getItem('fm_phase2_draft') || 'null'); if (d) o.step = NP_STEPS[d.step] || null; o.flow = o.step ? 'New project' : null; } catch (e) { /* no draft */ } }
    if (c.ui.viewer) o.viewer = c.ui.viewer.title;
    return o;
  }

  function start(c) {
    var w = R.where(location.hash, openNow(c));
    HELD = [];
    c.ui.req = { step: 0, kind: null, area: w.area, where: w, text: '', urgency: 'soon', errors: null, hash: location.hash };
  }

  /* ---------- the form ---------- */
  function dialog(c) {
    var F = c.ui.req; if (!F) return '';
    var esc = c.esc, steps = ['What kind?', 'Where?', 'Tell us'];
    var head = '<div class="rq-head"><b id="rq-title">Need an update?</b>' + (F.step < 3 ? '<span class="rq-steps" aria-label="Step ' + (F.step + 1) + ' of 3">' + steps.map(function (s, i) { return '<span class="' + (i === F.step ? 'on' : i < F.step ? 'done' : '') + '">' + (i + 1) + '. ' + s + '</span>'; }).join('') + '</span>' : '') +
      '<button class="rq-x" data-rqclose aria-label="Close">×</button></div>';
    var body = '';
    if (F.step === 0) {
      body = '<p class="rq-lede">Found something that isn\'t right, or have an idea? Lindsay gets it right away. It takes under a minute.</p>' +
        '<div class="rq-kinds">' + Object.keys(R.KINDS).map(function (k) { var K = R.KINDS[k];
          return '<button class="rq-kind rq-kind--' + k + '" data-rqkind="' + k + '"><b>' + esc(K.label) + '</b><span>' + esc(K.hint) + '</span></button>'; }).join('') + '</div>';
    } else if (F.step === 1) {
      body = '<p class="rq-lede">Where is it? We filled in the page you were on.</p>' +
        '<div class="rq-where"><span class="rq-wlabel">You were on</span><b>' + esc(F.where.label) + '</b></div>' +
        '<label class="p2-fld"><span>Is it here, or somewhere else?</span><select class="fmp1-input" data-rqf="area">' + R.AREAS.map(function (a) {
          return '<option value="' + a[0] + '"' + (F.area === a[0] ? ' selected' : '') + '>' + esc(a[0] === F.where.area ? 'Right here: ' + F.where.label : a[1]) + '</option>'; }).join('') + '</select></label>' +
        '<div class="rq-foot"><button class="fmp1-btn fmp1-btn--quiet" data-rqback>Back</button><button class="fmp1-btn fmp1-btn--primary" data-rqnext data-autofocus>' + (F.area === F.where.area ? 'Yes, it\'s here' : 'Next') + '</button></div>';
    } else if (F.step === 2) {
      var K = R.KINDS[F.kind];
      body = '<label class="p2-fld rq-text"><span><b>' + esc(K.ask) + '</b></span><textarea class="fmp1-input" rows="5" data-rqf="text" data-autofocus placeholder="For example: ' + esc(K.example) + '">' + esc(F.text) + '</textarea></label>' +
        '<div class="rq-urg" role="radiogroup" aria-label="How urgent?"><span class="p2-small"><b>How urgent?</b></span>' + Object.keys(R.URGENCY).map(function (u) {
          return '<button class="fmp1-btn rq-u rq-u--' + u + '" role="radio" aria-checked="' + (F.urgency === u) + '" data-rqurg="' + u + '">' + esc(R.URGENCY[u]) + '</button>'; }).join('') + '</div>' +
        '<div class="rq-shot"><label class="fmp1-btn fmp1-btn--quiet p2-filebtn">+ Add a screenshot (optional)<input type="file" data-rqshot accept=".png,.jpg,.jpeg,.heic,.heif,.gif,.webp,.pdf" multiple></label>' +
          (HELD.length ? '<span class="p2-small">' + HELD.map(function (f, i) { return esc(f.name) + ' <button class="p2-linkbtn p2-small" data-rqshotrm="' + i + '" aria-label="Remove ' + esc(f.name) + '">remove</button>'; }).join(' · ') + '</span>' : '') +
          '<details class="p2-small rq-how"><summary>How do I take a screenshot?</summary><ul><li><b>Mac:</b> press Shift + Command + 4, then drag over the part of the screen. It saves to your Desktop.</li><li><b>Windows:</b> press Windows + Shift + S, then drag. Paste it into Paint and save, or use the file it offers.</li><li><b>iPhone / iPad:</b> press the side button and volume up together. It goes to Photos.</li></ul></details></div>' +
        '<p class="p2-small fmp1-faint">We\'ll also send the page you were on, your name and the time, so you don\'t need to explain where.</p>' +
        (F.errors ? '<ul class="rq-errs" role="alert">' + F.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="rq-foot"><button class="fmp1-btn fmp1-btn--quiet" data-rqback>Back</button><button class="fmp1-btn fmp1-btn--primary" data-rqsend>Send to Lindsay</button></div>';
    } else {
      var q = (c.store.requests() || []).filter(function (x) { return x.id === F.sent; })[0], m = q ? R.email(q) : null;
      body = '<div class="rq-done" role="status"><span class="rq-tick" aria-hidden="true">✓</span><h2 class="fmp1-h">Sent. Thank you!</h2>' +
        '<p>' + (LIVE ? (F.emailFailed ? 'It\'s saved.' : 'Lindsay gets an email right now.') : 'In the live tool, Lindsay gets an email right away.') + ' Your request is <b>' + esc(F.sent) + '</b>. You can check on it any time under <b>Update requests</b> in the menu.</p>' +
        (F.kind === 'stuck' ? '<p class="p2-small">While you wait: if something has to go out today, ask Lindsay directly too.</p>' : '') +
        (m && (!LIVE || F.emailFailed) ? '<div class="fmp1-note fmp1-note--' + (F.emailFailed ? 'alert' : 'info') + ' p2-small"><span>' + (F.emailFailed ? '<b>The email didn\'t go out.</b> Your request is saved. Press this to send it from your mail app:' : '<b>Preview:</b> the live tool emails Lindsay by itself. From this preview, send it with your mail app instead.') + '</span> <a class="fmp1-btn" href="' + esc(m.mailto) + '" target="_blank" rel="noopener">Email it to Lindsay</a></div>' : '') +
        '<div class="rq-foot"><button class="fmp1-btn fmp1-btn--quiet" data-rqgo>See update requests</button><button class="fmp1-btn fmp1-btn--primary" data-rqclose data-autofocus>Done</button></div></div>';
    }
    return '<div class="rq-backdrop" data-rqbackdrop><div class="rq-dialog" role="dialog" aria-modal="true" aria-labelledby="rq-title">' + head + '<div class="rq-body">' + body + '</div></div></div>';
  }

  /* Live: the server emails the owner (POST, signed in; same shape as TJ's Log & Timber so one sender serves both, HANDOFF §36).
     The recipient is fixed on the server; "to" is sent only so the request reads the same in both tools. */
  var ENDPOINT = (window.FM_CONFIG && window.FM_CONFIG.requestsEndpoint) || '/api/projectbuilder/requests';
  function b64(blob) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(blob); }); }
  function emailIt(q, shots) {
    var m = R.email(q, { link: location.origin + location.pathname + '#/updates' });
    return Promise.all(shots.map(function (f) { return b64(f.blob).then(function (d) { return { name: f.name, type: f.type, base64: d }; }); })).then(function (files) {
      return fetch(ENDPOINT, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: R.TO, subject: m.subject, text: m.body, request: q, screenshots: files }) });
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); }).then(function (j) { if (!j || !j.ok) throw new Error('not sent'); return j; });
  }

  function send(c) {
    var F = c.ui.req, me = c.me(), n = c.store.nextRequestNumber();
    var users = window.P2Users && window.P2Users.list ? window.P2Users.list() : [];
    var meFull = users.filter(function (u) { return u.id === me.id; })[0] || me;
    var made = R.create({ kind: F.kind, area: F.area, text: F.text, urgency: F.urgency, attachments: HELD.map(function (f, i) { return { name: f.name, bytes: f.bytes, type: f.type, key: 'req-' + n + '-' + (i + 1) }; }) },
      { seq: n, by: { name: me.name, email: meFull.email || null, access: me.access }, at: new Date().toISOString(), today: c.TODAY, hash: F.hash, where: F.where,
        userAgent: navigator.userAgent, screen: window.innerWidth + '×' + window.innerHeight, version: VERSION, errors: ERRORS });
    if (!made.ok) { F.errors = made.problems; c.render(); return; }
    var q = made.request;
    var shots = HELD.slice();
    Promise.all(shots.map(function (f, i) { return c.files.put(q.attachments[i].key, f.blob); })).then(function () {
      q.emailed = LIVE ? null : { preview: true };   // live: the server records when the email went out
      c.store.addRequest(q, me.name);
      HELD = []; F.step = 3; F.sent = q.id; F.errors = null; F.emailFailed = false; c.render();
      if (LIVE) emailIt(q, shots).then(null, function () { if (c.ui.req && c.ui.req.sent === q.id) { c.ui.req.emailFailed = true; c.render(); } });
    });
  }

  /* ---------- the list ---------- */
  var TONE = { new: 'fmp1-pill--alert', working: 'fmp1-pill--proposed', question: 'fmp1-pill--alert', fixed: 'fmp1-pill--good', notdoing: '' };
  function page(c) {
    var esc = c.esc, all = c.store.requests(), filt = c.ui.reqFilter || 'open', full = c.me().access === 'full', cnt = R.counts(all);
    var list = all.filter(function (r) { return filt === 'all' || (filt === 'mine' ? r.by === c.me().name : ['new', 'working', 'question'].indexOf(r.status) >= 0); });
    var rows = list.map(function (r) {
      var open = c.ui.reqOpen === r.id, K = R.KINDS[r.kind] || { label: r.kind };
      var detail = open ? '<div class="rq-detail"><p class="rq-words">' + esc(r.text) + '</p>' +
        (r.attachments.length ? '<div class="p2-row p2-wrap">' + r.attachments.map(function (a) { return '<button class="fmp1-btn fmp1-btn--quiet" data-rqopenshot="' + esc(a.key || '') + '" data-rqname="' + esc(a.name) + '">Screenshot: ' + esc(a.name) + '</button>'; }).join('') + '</div>' : '') +
        '<p class="p2-small fmp1-faint">' + esc(r.context.browser) + (r.context.screen ? ' · ' + esc(r.context.screen) : '') + ' · version ' + esc(r.context.version || '—') + (r.context.errors.length ? ' · ' + r.context.errors.length + ' error' + (r.context.errors.length > 1 ? 's' : '') + ' on screen: ' + esc(r.context.errors.join(' | ')) : ' · no errors on screen') + '</p>' +
        '<ol class="rq-hist">' + r.history.map(function (h) { return '<li><b>' + esc(R.STATUS[h.status] || h.status) + '</b> · ' + esc(h.by) + (h.at ? ' · ' + esc(String(h.at).slice(0, 10)) : '') + (h.note && h.note !== 'Sent' ? ': ' + esc(h.note) : '') + '</li>'; }).join('') + '</ol>' +
        (r.jobCode && c.store.job(r.jobCode) ? '<p><a href="#/job/' + encodeURIComponent(r.jobCode) + '/' + (r.area.indexOf('job:') === 0 ? r.area.slice(4) : 'overview') + '">Go to that page</a></p>' : '') +
        '<div class="p2-form"><label class="p2-fld" style="flex:1 1 260px"><span>' + (full ? 'Note (shows to whoever sent it)' : 'Add something (it happened again, an answer…)') + '</span><input class="fmp1-input" data-rqnote value="' + esc(c.ui.reqNote || '') + '"></label>' +
          (full ? Object.keys(R.STATUS).filter(function (s) { return s !== 'new'; }).map(function (s) { return '<button class="fmp1-btn' + (s === 'fixed' ? ' fmp1-btn--primary' : ' fmp1-btn--quiet') + '" data-rqstatus="' + s + '" data-id="' + esc(r.id) + '">' + esc(R.STATUS[s]) + '</button>'; }).join('') : '') +
          '<button class="fmp1-btn' + (full ? ' fmp1-btn--quiet' : ' fmp1-btn--primary') + '" data-rqaddnote="' + esc(r.id) + '">Add note</button>' +
          (c.ui.reqErr && c.ui.reqOpen === r.id ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink);flex-basis:100%">' + esc(c.ui.reqErr) + '</span>' : '') + '</div></div>' : '';
      return '<li class="rq-item' + (open ? ' is-open' : '') + '"><button class="rq-row" data-rqopen="' + esc(r.id) + '" aria-expanded="' + open + '">' +
        '<span class="rq-id fmp1-code">' + esc(r.id) + '</span><span class="rq-main"><b>' + esc(K.label) + '</b><span class="p2-small">' + esc(r.where) + '</span><span class="p2-small fmp1-faint">' + esc(r.text.length > 110 ? r.text.slice(0, 110) + '…' : r.text) + '</span></span>' +
        '<span class="rq-meta"><span class="fmp1-pill ' + (TONE[r.status] || '') + '">' + esc(R.STATUS[r.status]) + '</span>' + (r.urgency === 'blocking' && r.status !== 'fixed' && r.status !== 'notdoing' ? '<span class="rq-urgent">Stopping work</span>' : '') + '<span class="p2-small fmp1-faint">' + esc(r.by) + ' · ' + esc(String(r.at || '').slice(0, 10)) + '</span></span></button>' + detail + '</li>';
    }).join('');
    return '<div class="p2-between"><div><h1 class="fmp1-h p2-h1">Update requests</h1><p class="p2-sub">Problems and ideas the team has sent. Each one is emailed to Lindsay (' + esc(R.TO) + ') the moment it\'s sent.</p></div>' +
      '<button class="fmp1-btn fmp1-btn--primary" data-rqstart>Need an update?</button></div>' +
      '<div class="p2-chips" role="group" aria-label="Show">' + [['open', 'Open (' + cnt.open + ')'], ['mine', 'Sent by me'], ['all', 'All (' + all.length + ')']].map(function (f) { return '<button class="fmp1-btn" data-rqfilter="' + f[0] + '" aria-pressed="' + (filt === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (rows ? '<ul class="rq-list">' + rows + '</ul>' : '<div class="fmp1-card p2-pad"><p>' + (filt === 'open' ? 'Nothing open. ' : 'Nothing here yet. ') + 'Spot something? Press <b>Need an update?</b> in the menu, on any page.</p></div>');
  }

  /* ---------- events ---------- */
  function click(c, t) {
    if (t.hasAttribute('data-rqstart')) { start(c); c.render(); return true; }
    var F = c.ui.req;
    if (F) {
      if (t.hasAttribute('data-rqclose')) { c.ui.req = null; HELD = []; c.render(); return true; }
      if (t.hasAttribute('data-rqgo')) { c.ui.req = null; HELD = []; c.go('#/updates'); return true; }
      if (t.dataset.rqkind) { F.kind = t.dataset.rqkind; F.step = 1; c.render(); return true; }
      if (t.hasAttribute('data-rqnext')) { F.step = 2; c.render(); return true; }
      if (t.hasAttribute('data-rqback')) { F.step = Math.max(0, F.step - 1); F.errors = null; c.render(); return true; }
      if (t.dataset.rqurg) { F.urgency = t.dataset.rqurg; c.render(); return true; }
      if (t.dataset.rqshotrm != null) { HELD.splice(+t.dataset.rqshotrm, 1); c.render(); return true; }
      if (t.hasAttribute('data-rqsend')) { send(c); return true; }
    }
    if (t.dataset.rqfilter) { c.ui.reqFilter = t.dataset.rqfilter; c.render(); return true; }
    if (t.dataset.rqopen) { c.ui.reqOpen = c.ui.reqOpen === t.dataset.rqopen ? null : t.dataset.rqopen; c.ui.reqNote = ''; c.ui.reqErr = null; c.render(); return true; }
    if (t.dataset.rqstatus || t.dataset.rqaddnote) {
      var id = t.dataset.id || t.dataset.rqaddnote, q = c.store.requests().filter(function (x) { return x.id === id; })[0]; if (!q) return true;
      var res = t.dataset.rqstatus ? R.setStatus(q, t.dataset.rqstatus, c.me(), c.ui.reqNote, new Date().toISOString()) : R.addNote(q, c.me(), c.ui.reqNote, new Date().toISOString());
      if (!res.ok) { c.ui.reqErr = res.error; c.render(); return true; }
      c.store.updateRequest(res.request, res.log, c.me().name); c.ui.reqNote = ''; c.ui.reqErr = null; c.render(); return true;
    }
    if (t.dataset.rqopenshot != null) {
      var key = t.dataset.rqopenshot, name = t.dataset.rqname;
      c.files.get(key).then(function (blob) {
        c.ui.viewer = { title: name, html: blob ? (/pdf$/i.test(name) ? '<iframe class="pv-pdf" src="' + URL.createObjectURL(blob) + '" title="' + c.esc(name) + '"></iframe>' : '<img class="pv-img" src="' + URL.createObjectURL(blob) + '" alt="' + c.esc(name) + '">') : '<p>This screenshot was added in a different browser, so the preview can\'t show it. Live, it comes from the server.</p>', from: '[data-rqopenshot="' + key + '"]' };
        c.render();
      });
      return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target;
    if (el.dataset.rqf && c.ui.req) {
      c.ui.req[el.dataset.rqf] = el.value;
      if (el.dataset.rqf === 'area') { var b = document.querySelector('[data-rqnext]'); if (b) b.textContent = el.value === c.ui.req.where.area ? 'Yes, it\'s here' : 'Next'; }
      return true;
    }
    if (el.hasAttribute('data-rqnote')) { c.ui.reqNote = el.value; return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target;
    if (el.hasAttribute('data-rqshot') && c.ui.req) {
      [].slice.call(el.files || []).forEach(function (f) { HELD.push({ name: f.name, bytes: f.size, type: f.type, blob: f }); });
      el.value = ''; c.ui.req.errors = R.check({ kind: c.ui.req.kind, area: c.ui.req.area, text: 'placeholder text', attachments: HELD }).filter(function (p) { return /screenshot|MB|Up to/.test(p); });
      if (!c.ui.req.errors.length) c.ui.req.errors = null;
      c.render(); return true;
    }
    return input(c, e);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && window.P2) { var c = window.P2.ctx(); if (c.ui.req) { c.ui.req = null; HELD = []; c.render(); } }
  });

  window.P2Requests = { dialog: dialog, page: page, click: click, input: input, change: change, start: start };
  if (window.P2) window.P2.render();
})();
