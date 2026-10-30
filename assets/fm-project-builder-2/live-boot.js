/*
 * Project Builder 2.0 boot. GET ns=fm-quotes only. Never POST it.
 * Flag fm_phase1 must be on (query or localStorage) before live jobs load.
 * Then loads Phase 2 screens. Writes stay in browser preview storage.
 * FM_CONFIG.live stays false until sign-in + shared database exist.
 */
(function () {
  'use strict';
  var root = document.getElementById('p2');
  window.FM_CONFIG = window.FM_CONFIG || { live: false, filesBase: '/assets/fm-project-builder-2/files/' };
  window.FM_CONFIG.live = false;
  var params = new URLSearchParams(location.search);
  var flagged = params.get('fm_phase1') === 'on';
  try {
    if (flagged) localStorage.setItem('fm_phase1', 'on');
    if (localStorage.getItem('fm_phase1') === 'on') flagged = true;
  } catch (e) {}

  function esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('\u0026amp;')
      .split('<').join('\u0026lt;')
      .split('>').join('\u0026gt;')
      .split('"').join('\u0026quot;');
  }

  function gate() {
    root.removeAttribute('style');
    root.innerHTML =
      '<div class="fmp1-card gate" style="grid-column:1/-1">' +
      '<div class="pv-brand" style="display:flex;gap:12px;align-items:center"><div class="pv-mark" style="width:34px;text-align:center;font-family:var(--fmp1-font-display);font-weight:700"><span>F</span><span>M</span></div>' +
      '<div><span class="pv-word">FREMONT MAKERS</span><span class="fmp1-eyebrow">Project Builder 2.0 · v2.8.0</span></div></div>' +
      '<h1 class="fmp1-h p2-h1">This is the new book. The current builder is still the live one.</h1>' +
      '<p class="fmp1-muted p2-sub">2.8.0 reads jobs from the current Project Builder and never writes them. Preview bar stays on until sign-in and a shared database exist. Current tool stays at /quote.</p>' +
      '<div class="p2-row" style="margin-top:16px">' +
      '<a class="fmp1-btn fmp1-btn--primary" href="/project-builder-2?fm_phase1=on">Open 2.0</a>' +
      '<a class="fmp1-btn fmp1-btn--quiet" href="/quote">Current Project Builder</a>' +
      '<a class="fmp1-btn fmp1-btn--quiet" href="/">Dashboard</a>' +
      '</div></div>';
  }

  function fail(msg) {
    root.innerHTML =
      '<div class="fmp1-card gate" style="grid-column:1/-1"><h1 class="fmp1-h p2-h1">Could not load 2.0</h1>' +
      '<p class="fmp1-muted">' + esc(msg) + '</p>' +
      '<div class="p2-row"><a class="fmp1-btn" href="/quote">Current Project Builder</a></div></div>';
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

  if (!flagged) { gate(); return; }

  root.innerHTML = '<div class="fmp1-card p2-pad" style="grid-column:1/-1"><span class="fmp1-eyebrow">Project Builder 2.0 · v2.8.0</span><p class="fmp1-muted">Reading current jobs. Nothing is being written to the live builder.</p></div>';

  fetch('/api/planner/bundle?ns=fm-quotes', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('Quotes GET ' + r.status);
      return r.json();
    })
    .then(function (body) {
      var data = (body && body.data) || {};
      if (!window.FMPhase1Adapter) throw new Error('Adapter missing');
      window.FM_SAMPLE = window.FMPhase1Adapter.sampleFromBundle(data);
      window.FM_SAMPLE._readOnlyNs = 'fm-quotes';
      window.FM_SAMPLE._note = 'Live GET ns=fm-quotes. 2.0 does not POST that namespace.';
      loadScripts([
        '/assets/fm-project-builder-2/src/fm-phase2-measure.js',
        '/assets/fm-project-builder-2/src/fm-phase2-reports.js',
        '/assets/fm-project-builder-2/src/fm-phase2-customers.js',
        '/assets/fm-project-builder-2/src/fm-phase2-address.js',
        '/assets/fm-project-builder-2/preview/phase2-app.js',
        '/assets/fm-project-builder-2/preview/phase2-flows.js',
        '/assets/fm-project-builder-2/preview/phase2-elevations.js',
        '/assets/fm-project-builder-2/preview/phase2-measure.js',
        '/assets/fm-project-builder-2/preview/phase2-customers.js',
        '/assets/fm-project-builder-2/preview/phase2-reports.js'
      ], function () {});
    })
    .catch(function (err) { fail(err.message || String(err)); });
})();
