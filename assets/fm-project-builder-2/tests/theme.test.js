/*
 * Paper / Dark switch tests. Run with:   node tests/theme.test.js
 * Uses a stub element and stub storage, so no browser is needed.
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var T = isNode ? require('../src/fm-phase1-theme-toggle.js') : globalThis.FMTheme;

var results = [], failed = 0;
function test(name, fn) {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, msg) {
  var sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa);
}
function el() { var a = {}; return { setAttribute: function (k, v) { a[k] = String(v); }, getAttribute: function (k) { return a[k] === undefined ? null : a[k]; } }; }
function store(init) { var s = init || {}; return { getItem: function (k) { return s[k] === undefined ? null : s[k]; }, setItem: function (k, v) { s[k] = String(v); }, raw: s }; }
function broken() { return { getItem: function () { throw new Error('blocked'); }, setItem: function () { throw new Error('blocked'); } }; }

test('defaults to Paper, like the existing tool', function () {
  var e = el(); eq(T.init(e, { storage: store() }), 'paper'); eq(e.getAttribute('data-fm-theme'), 'paper');
});

test('remembers Dark under its own key only', function () {
  var s = store({ theme: 'paper' }), e = el();
  T.set(e, 'dark', { storage: s });
  eq(s.raw, { theme: 'paper', fm_phase1_theme: 'dark' }, 'existing tool key untouched');
  var e2 = el(); eq(T.init(e2, { storage: s }), 'dark');
});

test('ignores junk in storage and rejects unknown modes', function () {
  eq(T.init(el(), { storage: store({ fm_phase1_theme: 'neon' }) }), 'paper');
  var threw = false; try { T.set(el(), 'neon', { storage: store() }); } catch (x) { threw = x.message === 'Theme must be "paper" or "dark".'; }
  eq(threw, true);
});

test('still works when storage is blocked (private mode)', function () {
  var e = el(); eq(T.init(e, { storage: broken() }), 'paper');
  eq(T.set(e, 'dark', { storage: broken() }), 'dark');
  eq(e.getAttribute('data-fm-theme'), 'dark');
});

test('switch markup marks the current mode', function () {
  var h = T.toggleHTML('dark');
  eq(h.indexOf('data-fm-theme-set="dark" aria-pressed="true"') > -1, true);
  eq(h.indexOf('data-fm-theme-set="paper" aria-pressed="false"') > -1, true);
});

var summary = 'Phase 1 Paper/Dark switch\n' + results.join('\n') + '\n' + (results.length - failed) + ' passed, ' + failed + ' failed';
if (isNode) { console.log(summary); if (failed) process.exitCode = 1; }
summary;
