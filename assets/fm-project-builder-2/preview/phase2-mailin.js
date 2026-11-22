/*
 * Phase 2 preview · Wholesale Cabinets inbox (window.P2Mail). Uses FMMailIn and FMShipping. HANDOFF §46.
 *   The Inbox card at the top of the Shipping page: emails read from fremontmakers@gmail.com. Exact matches are already filed;
 *   the rest wait here with the likely job, one click to file, or "Not for a job". On the live site the server reads the inbox
 *   (HANDOFF §46); the preview has "Simulate an email arriving" to drop an .eml through the same path.
 */
(function () {
  'use strict';
  var MI = window.FMMailIn, SH = window.FMShipping, FM = window.FMPhase1;
  function U(c) { return c.ui.ml || (c.ui.ml = {}); }
  function items(c) { return c.store.mailIn ? c.store.mailIn() : []; }
  function cfg(c) { return window.P2Ship ? window.P2Ship.cfg(c) : SH.SETTINGS; }
  function nowISO() { return new Date().toISOString(); }
  function when(c, iso) { if (!iso) return ''; var d = iso.slice(0, 10); return d === c.TODAY ? 'today' : SH.nice(d); }

  /* What the server does for each new message (HANDOFF §46): read it, save it, file it when the job is certain. */
  function deliver(c, raw, opts) {
    opts = opts || {};
    var item = MI.ingest(raw, { jobs: c.store.jobs(), linesOf: function (j) { return window.P2Ship ? window.P2Ship.soldLines(c, j) : []; }, settings: cfg(c), receivedAt: opts.receivedAt || c.TODAY + nowISO().slice(10) });   // the preview's date
    var r = c.store.addMailIn(item); if (!r.ok) return r;
    if (MI.autoFile(item)) fileOn(c, item.id, item.match.jobCode, true);
    return { ok: true, item: item };
  }
  function fileOn(c, id, jobCode, auto) {
    var item = items(c).filter(function (x) { return x.id === id; })[0], job = c.store.job(jobCode);
    if (!item || !job) return { ok: false, error: 'Pick the job.' };
    var who = auto ? 'Mail-in' : c.me().name, res = MI.file(job, item, { by: who, today: c.TODAY, settings: cfg(c) });
    if (!res.ok) {
      if (res.duplicate) { c.store.updateMailIn(id, { status: 'filed', jobCode: jobCode, filedBy: who, filedOn: c.TODAY, auto: !!auto, error: null, reason: 'Already on the job' }, null, who); return { ok: true }; }
      c.store.updateMailIn(id, { error: res.error }, null, who); return res;
    }
    var nj = res.job, log = res.log;
    if (res.orderAction && FM) { var mv = FM.applyAction(nj, 'order', { date: (item.order && item.order.placedOn) || c.TODAY }, who); if (mv.ok) { nj = mv.job; log += ' Factory order recorded.'; } }
    c.store.update(jobCode, function () { return nj; }, log + (res.warnings && res.warnings.length ? ' ' + res.warnings.join(' ') : ''), who);
    c.store.updateMailIn(id, { status: 'filed', jobCode: jobCode, filedBy: who, filedOn: c.TODAY, auto: !!auto, error: null }, null, who);
    return { ok: true };
  }

  function jobOptions(c, it) {
    var esc = c.esc, seen = {}, cand = (it.match.candidates || []).map(function (x) { seen[x.jobCode] = 1; var j = c.store.job(x.jobCode); return j ? '<option value="' + esc(j.jobCode) + '">' + esc(j.customer + ' · ' + j.jobCode) + (x.why ? ' (' + esc(x.why) + ')' : '') + '</option>' : ''; }).join('');
    var rest = c.store.jobs().filter(function (j) { return !seen[j.jobCode] && j.stage !== 'quote' && j.stage !== 'lost' && j.stage !== 'complete'; }).map(function (j) { return '<option value="' + esc(j.jobCode) + '">' + esc(j.customer + ' · ' + j.jobCode) + '</option>'; }).join('');
    return '<option value="">Choose a job…</option>' + (cand ? '<optgroup label="Could be">' + cand + '</optgroup>' : '') + '<optgroup label="Active jobs">' + rest + '</optgroup>';
  }
  function waitingRow(c, it) {
    var esc = c.esc, sug = it.match.confidence === 'likely' ? c.store.job(it.match.jobCode) : null;
    return '<li class="ml-item"><div class="ml-main"><b>' + esc(MI.summary(it)) + '</b><span class="p2-small fmp1-muted">' + esc(it.subject) + ' · ' + esc(when(c, it.receivedAt)) + (it.forwardedBy ? ' · forwarded by ' + esc(it.forwardedBy) : '') + '</span>' +
      (sug ? '<span class="p2-small">Looks like <b>' + esc(sug.customer) + '</b>: ' + esc(it.match.why.replace(/^Best match: /, '')) + '</span>' : (it.match.why ? '<span class="p2-small fmp1-muted">' + esc(it.match.why) + '</span>' : '')) +
      (it.problems && it.problems.length ? '<span class="p2-small sh-warn">' + esc(it.problems.join(' ')) + '</span>' : '') +
      (it.error ? '<span class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + esc(it.error) + '</span>' : '') + '</div>' +
      '<div class="ml-act">' + (sug ? '<button class="fmp1-btn fmp1-btn--primary" data-mlfile="' + esc(it.id) + '" data-mljob="' + esc(sug.jobCode) + '">File on ' + esc(sug.customer) + '</button>' : '') +
      '<span class="ml-pick"><select class="fmp1-input" data-mlpick="' + esc(it.id) + '" aria-label="Job for this email">' + jobOptions(c, it) + '</select><button class="fmp1-btn' + (sug ? '' : ' fmp1-btn--primary') + '" data-mlfile="' + esc(it.id) + '">File</button></span>' +
      '<button class="p2-linkbtn" data-mlignore="' + esc(it.id) + '">Not for a job</button></div></li>';
  }
  function card(c) {
    var esc = c.esc, u = U(c), all = items(c), wait = MI.waiting(all), filed = all.filter(function (x) { return x.status === 'filed'; }).slice(0, 5), aside = all.filter(function (x) { return x.status === 'ignored'; });
    var F = filed.map(function (it) { var j = c.store.job(it.jobCode) || {}; return '<li><span class="p2-small"><span class="p2-ok">✓</span> ' + esc(MI.summary(it)) + ' → <a href="#/job/' + encodeURIComponent(it.jobCode) + '/shipping">' + esc(j.customer || it.jobCode) + '</a></span><span class="p2-small fmp1-faint">' + (it.auto ? 'filed automatically' : 'filed by ' + esc(it.filedBy)) + ' · ' + esc(when(c, it.filedOn)) + '</span></li>'; }).join('');
    var A = aside.slice(0, 20).map(function (it) { return '<li><span class="p2-small">' + esc(it.subject) + ' <span class="fmp1-faint">· ' + esc(it.from) + ' · ' + esc(it.reason || '') + '</span></span>' + (it.kind !== 'unknown' ? '<button class="p2-linkbtn" data-mlback="' + esc(it.id) + '">Put back</button>' : '') + '</li>'; }).join('');
    return '<div class="fmp1-card p2-pad ml-card"><div class="p2-between"><span class="fmp1-eyebrow">Inbox · ' + esc(MI.INBOX) + (wait.length ? ' · <b class="sh-warn">' + wait.length + ' need' + (wait.length === 1 ? 's' : '') + ' a job</b>' : '') + '</span></div>' +
      '<p class="p2-small fmp1-muted">Wholesale Cabinets emails forwarded from hello@fremontmakers.com. Orders and shipments that match a job are filed on their own. The rest wait here for you to pick the job.</p>' +
      (wait.length ? '<ul class="ml-list">' + wait.map(function (it) { return waitingRow(c, it); }).join('') + '</ul>' : '<p class="p2-small p2-ok">✓ Nothing waiting. Every email is on its job.</p>') +
      (F ? '<details class="p2-small"' + (u.showFiled ? ' open' : '') + '><summary>Recently filed · ' + filed.length + '</summary><ul class="p2-list ml-filed">' + F + '</ul></details>' : '') +
      (A ? '<details class="p2-small"><summary>Not for a job · ' + aside.length + '</summary><ul class="p2-list ml-filed">' + A + '</ul></details>' : '') +
      '<details class="ml-sim"' + (u.simOpen ? ' open' : '') + '><summary class="p2-small"><b>Preview only:</b> simulate an email arriving</summary>' +
        '<p class="p2-small fmp1-faint">On the live site the server reads the inbox every few minutes. Here, drop a saved Wholesale Cabinets .eml (or paste its source) to send it through the same steps.</p>' +
        '<label class="sh-drop ml-drop" data-mldrop><input type="file" accept=".eml,message/rfc822,text/plain" data-mlfilein hidden><span>Drop an .eml here or <u>choose a file</u></span></label>' +
        '<textarea class="fmp1-input" rows="3" data-mlpaste placeholder="…or paste the email source">' + esc(u.paste || '') + '</textarea>' +
        '<div class="p2-row"><button class="fmp1-btn" data-mlsim>Deliver to the inbox</button></div>' +
        (u.msg ? '<p class="p2-small" role="status">' + esc(u.msg) + '</p>' : '') + '</details></div>';
  }
  function counts(c) { return MI.waiting(items(c)).length; }
  /* Today: one line per email waiting for a job. */
  function today(c) { return MI.waiting(items(c)).map(function (it) { return { href: '#/shipping', tone: 'alert', status: 'Email', title: MI.summary(it) + ' needs a job', customer: 'Wholesale Cabinets inbox', action: 'File it' }; }); }

  function simulate(c, raw) {
    var u = U(c); u.simOpen = true;
    var r = deliver(c, raw);
    if (!r.ok) u.msg = r.error;
    else { var it = items(c).filter(function (x) { return x.id === r.item.id; })[0]; u.msg = it.status === 'filed' ? 'Filed automatically on ' + ((c.store.job(it.jobCode) || {}).customer || it.jobCode) + '.' : it.status === 'ignored' ? 'Set aside: ' + it.reason : 'In the inbox, waiting for a job.'; u.paste = ''; }
    c.render();
  }
  function click(c, t) {
    var d = t.dataset;
    if (d.mlfile) { var sel = document.querySelector('[data-mlpick="' + d.mlfile + '"]'), code = d.mljob || (sel && sel.value); if (!code) { c.store.updateMailIn(d.mlfile, { error: 'Pick the job first.' }); c.render(); return true; } fileOn(c, d.mlfile, code, false); c.render(); return true; }
    if (d.mlignore) { c.store.updateMailIn(d.mlignore, { status: 'ignored', reason: 'Set aside by ' + c.me().name, error: null }, null, c.me().name); c.render(); return true; }
    if (d.mlback) { c.store.updateMailIn(d.mlback, { status: 'waiting', reason: null }, null, c.me().name); c.render(); return true; }
    if (t.hasAttribute('data-mlsim')) { var ta = document.querySelector('[data-mlpaste]'); if (ta && ta.value.trim()) simulate(c, ta.value); return true; }
    return false;
  }
  function input(c, e) { if (e.target.hasAttribute('data-mlpaste')) { U(c).paste = e.target.value; return true; } return false; }
  function change(c, e) {
    var el = e.target;
    if (el.hasAttribute('data-mlfilein') && el.files && el.files[0]) { el.files[0].text().then(function (txt) { simulate(c, txt); }); return true; }
    if (el.hasAttribute('data-mlpick')) { c.store.updateMailIn(el.dataset.mlpick, { error: null }); return true; }
    return false;
  }
  function wireDrop() {
    document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('[data-mldrop]')) { e.preventDefault(); e.target.closest('[data-mldrop]').classList.add('is-over'); } });
    document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('[data-mldrop]'); if (z) z.classList.remove('is-over'); });
    document.addEventListener('drop', function (e) { var z = e.target.closest && e.target.closest('[data-mldrop]'); if (!z) return; e.preventDefault(); e.stopPropagation(); var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f && window.P2) f.text().then(function (txt) { simulate(window.P2.ctx(), txt); }); }, true);
  }
  wireDrop();

  window.P2Mail = { card: card, counts: counts, today: today, deliver: deliver, fileOn: fileOn, click: click, input: input, change: change };
  if (window.P2) window.P2.render();
})();
