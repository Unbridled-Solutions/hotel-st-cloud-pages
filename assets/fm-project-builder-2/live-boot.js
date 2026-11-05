/*
 * Project Builder 2.10.0 live boot.
 * Canonical URL: /projectbuilder
 * GET ns=fm-quotes only (read-only import). Never POST that namespace.
 * New writes go to GET/POST ns=fm-phase1.
 */
(function () {
  'use strict';
  var root = document.getElementById('p2');
  var BASE = '/assets/fm-project-builder-2';
  window.FM_CONFIG = window.FM_CONFIG || {};
  window.FM_CONFIG.live = true;
  window.FM_CONFIG.filesBase = BASE + '/files/';
  window.FM_CONFIG.logoBase = BASE + '/assets/brand/';

  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&'+'amp;')
      .split('<').join('&'+'lt;')
      .split('>').join('&'+'gt;')
      .split('"').join('&'+'quot;');
  }

  function isoToday() {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function fail(msg) {
    if (!root) return;
    root.removeAttribute('style');
    root.innerHTML =
      '<div class="fmp1-card gate" style="grid-column:1/-1"><h1 class="fmp1-h p2-h1">Could not load Project Builder</h1>' +
      '<p class="fmp1-muted">' + esc(msg) + '</p>' +
      '<div class="p2-row"><a class="fmp1-btn fmp1-btn--quiet" href="/quote">Lookup (DNU)</a>' +
      '<a class="fmp1-btn fmp1-btn--quiet" href="/">Dashboard</a></div></div>';
  }

  function loadScripts(urls, done) {
    function next(i) {
      if (i >= urls.length) { done(); return; }
      var s = document.createElement('script');
      s.src = urls[i];
      s.onerror = function () { fail('Could not load ' + urls[i]); };
      s.onload = function () { next(i + 1); };
      document.body.appendChild(s);
    }
    next(0);
  }

  function phase1Storage(saved) {
    var cached = saved || null;
    var timer = null;
    return {
      load: function () { return cached; },
      save: function (st) {
        cached = st;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          fetch('/api/planner/bundle?ns=fm-phase1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
              'fm-phase1-state': st,
              'fm-phase1-savedAt': new Date().toISOString()
            })
          }).catch(function () { /* keep in memory if cloud save fails */ });
        }, 500);
      }
    };
  }

  if (!root) return;
  root.innerHTML = '<div class="fmp1-card p2-pad" style="grid-column:1/-1"><span class="fmp1-eyebrow">Project Builder · v2.10.0</span><p class="fmp1-muted">Reading jobs. The old builder is not being written.</p></div>';

  Promise.all([
    fetch('/api/planner/bundle?ns=fm-quotes', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Quotes GET ' + r.status);
      return r.json();
    }),
    fetch('/api/planner/bundle?ns=fm-phase1', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) return { success: true, data: {} };
      return r.json();
    })
  ]).then(function (pair) {
    var quotesBody = pair[0] || {};
    var phase1Body = pair[1] || {};
    var quotes = quotesBody.data || {};
    var phase1 = phase1Body.data || {};
    if (!window.FMLegacy) throw new Error('FMLegacy missing');
    var read = window.FMLegacy.read(quotes);
    window.FM_SAMPLE = {
      today: isoToday(),
      legacyProjects: read.legacyProjects || []
    };
    window.FM_COMPANY_LEGACY = read.company || null;
    window.FM_LEGACY_SKIPPED = read.skipped || [];
    window.FM_LEGACY_DETAILS = read.details || {};
    window.FM_CONFIG.storage = phase1Storage(phase1['fm-phase1-state'] || null);
    window.FM_CONFIG.importedAt = isoToday();
    loadScripts([
      BASE + '/preview/phase2-app.js',
      BASE + '/preview/phase2-flows.js',
      BASE + '/preview/phase2-elevations.js',
      BASE + '/preview/phase2-measure.js',
      BASE + '/preview/phase2-customers.js',
      BASE + '/preview/phase2-reports.js',
      BASE + '/preview/phase2-company.js'
    ], function () {});
  }).catch(function (err) {
    fail(err.message || String(err));
  });
})();
