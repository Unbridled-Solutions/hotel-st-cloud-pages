/*
 * Fremont Makers · Phase 1 · Paper / Dark switch
 * ----------------------------------------------
 * Paper = Canyon Cream background, Dark = Juniper Shadow green.
 * Sets data-fm-theme="paper" | "dark" on a .fm-p1 element and remembers the
 * choice per person in localStorage under its OWN key (fm_phase1_theme).
 * It never reads or writes the existing Project Builder's theme setting.
 *
 * Usage:
 *   FMTheme.init(rootEl);                       // apply saved choice (default Paper)
 *   container.innerHTML = FMTheme.toggleHTML(); // render the switch
 *   FMTheme.bind(container, rootEl, onChange);  // handle clicks (event delegation)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FMTheme = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var KEY = 'fm_phase1_theme';
  var MODES = ['paper', 'dark'];
  var DEFAULT = 'paper';            // matches the existing tool, which opens on Paper

  function normalize(m) { return MODES.indexOf(m) > -1 ? m : null; }

  function load(storage) {
    try { return normalize((storage || window.localStorage).getItem(KEY)); } catch (e) { return null; }
  }
  function save(mode, storage) {
    try { (storage || window.localStorage).setItem(KEY, mode); } catch (e) { /* private mode etc.: still works for this visit */ }
  }

  /** The mode in effect for an element. */
  function get(el) { return normalize(el && el.getAttribute('data-fm-theme')) || DEFAULT; }

  /** Apply a mode to an element; optionally remember it. */
  function set(el, mode, opts) {
    var m = normalize(mode);
    if (!m) throw new Error('Theme must be "paper" or "dark".');
    el.setAttribute('data-fm-theme', m);
    if (!opts || opts.remember !== false) save(m, opts && opts.storage);
    return m;
  }

  /** Apply the saved choice, or `fallback`, or Paper. Returns the mode. */
  function init(el, opts) {
    var m = load(opts && opts.storage) || normalize(opts && opts.fallback) || DEFAULT;
    el.setAttribute('data-fm-theme', m);
    return m;
  }

  /** Markup for the two-button switch. `current` defaults to Paper. */
  function toggleHTML(current) {
    var c = normalize(current) || DEFAULT;
    return '<div class="fmp1-theme" role="group" aria-label="Background">' +
      '<button type="button" data-fm-theme-set="paper" aria-pressed="' + (c === 'paper') + '">Paper</button>' +
      '<button type="button" data-fm-theme-set="dark" aria-pressed="' + (c === 'dark') + '">Dark</button></div>';
  }

  /** Handle clicks on any switch inside `container`. Call once. */
  function bind(container, el, onChange) {
    container.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-fm-theme-set]') : null;
      if (!b) return;
      var m = set(el, b.getAttribute('data-fm-theme-set'));
      var all = container.querySelectorAll('[data-fm-theme-set]');
      for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', String(all[i].getAttribute('data-fm-theme-set') === m));
      if (onChange) onChange(m);
    });
  }

  return { KEY: KEY, MODES: MODES, DEFAULT: DEFAULT, get: get, set: set, init: init, load: load, toggleHTML: toggleHTML, bind: bind };
}));
