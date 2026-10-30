/*
 * Fremont Makers Project Builder · Phase 2 · Street addresses (HANDOFF §28).  window.FMAddress
 *
 * Addresses are entered as Street, City, State, ZIP. State starts at Colorado and can be changed.
 * Every record keeps the joined one-line form too (job.installAddress, address.line), so contracts, documents
 * and jobs saved before this change read the same as before.
 *
 * address: { street, city, state: 'CO', zip }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMAddress = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '0.1.0';
  var DEFAULT_STATE = 'CO';
  var STATES = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
    ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
    ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
    ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
    ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
    ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
    ['WI', 'Wisconsin'], ['WY', 'Wyoming']];
  var CODES = {}; STATES.forEach(function (s) { CODES[s[0]] = s[1]; });

  function s(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' '); }
  function blank(state) { return { street: '', city: '', state: state || DEFAULT_STATE, zip: '' }; }
  function isBlank(a) { return !a || !(s(a.street) || s(a.city) || s(a.zip)); }

  /* "414 Miners Rd, Canon City, CO 81212" */
  function format(a) {
    if (!a) return '';
    var tail = [s(a.state), s(a.zip)].filter(Boolean).join(' ');
    return [s(a.street), s(a.city), isBlank(a) ? '' : tail].filter(Boolean).join(', ');
  }

  /* Best effort from a one-line address (older jobs and profiles). With commas: street, city, ST zip.
     Without commas only the state and ZIP at the end can be told apart, so the rest stays in Street. */
  function parse(line) {
    var t = s(line), a = blank();
    if (!t) return a;
    var m = t.match(/^(.*?)[,\s]+([A-Za-z]{2})\.?\s*,?\s*(\d{5}(?:-\d{4})?)?$/);
    if (m && CODES[m[2].toUpperCase()]) { a.state = m[2].toUpperCase(); a.zip = m[3] || ''; t = m[1]; }
    else { var z = t.match(/^(.*?)[,\s]+(\d{5}(?:-\d{4})?)$/); if (z) { a.zip = z[2]; t = z[1]; } }
    var parts = t.split(',').map(s).filter(Boolean);
    if (parts.length > 1) { a.city = parts.pop(); a.street = parts.join(', '); } else a.street = parts[0] || '';
    return a;
  }

  /* An address record as fields: structured if it has them, otherwise parsed from its one-line form. */
  function from(rec, lineKey) {
    if (!rec) return blank();
    if (rec.street != null || rec.city != null || rec.zip != null) return { street: s(rec.street), city: s(rec.city), state: s(rec.state) || DEFAULT_STATE, zip: s(rec.zip) };
    return parse(rec[lineKey || 'line']);
  }

  function check(a, what) {
    var p = [], w = what || 'The address';
    if (!s(a && a.street)) p.push(w + ': enter the street.');
    if (!s(a && a.city)) p.push(w + ': enter the city.');
    if (!CODES[s(a && a.state).toUpperCase()]) p.push(w + ': choose the state.');
    if (!/^\d{5}(-\d{4})?$/.test(s(a && a.zip))) p.push(w + ': enter a 5-digit ZIP code.');
    return p;
  }

  /* Form fields. attr(field) returns the data attribute for one field, e.g. 'data-npaddr="street"'. */
  function fieldsHTML(attr, a, opts) {
    opts = opts || {}; a = a || blank();
    function q(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    var legend = opts.legend ? '<legend>' + q(opts.legend) + '</legend>' : '';
    return '<fieldset class="p2-addr">' + legend +
      '<label class="p2-fld p2-addr-street"><span>Street</span><input class="fmp1-input" autocomplete="street-address" ' + attr('street') + '  value="' + q(a.street) + '"></label>' +
      '<label class="p2-fld p2-addr-city"><span>City</span><input class="fmp1-input" autocomplete="address-level2" ' + attr('city') + ' value="' + q(a.city) + '"></label>' +
      '<label class="p2-fld p2-addr-state"><span>State</span><select class="fmp1-input" autocomplete="address-level1" ' + attr('state') + '>' +
        STATES.map(function (st) { return '<option value="' + st[0] + '"' + ((a.state || DEFAULT_STATE) === st[0] ? ' selected' : '') + '>' + st[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="p2-fld p2-addr-zip"><span>ZIP</span><input class="fmp1-input" inputmode="numeric" autocomplete="postal-code" maxlength="10" ' + attr('zip') + ' value="' + q(a.zip) + '"></label></fieldset>';
  }

  return { VERSION: VERSION, DEFAULT_STATE: DEFAULT_STATE, STATES: STATES, blank: blank, isBlank: isBlank, format: format, parse: parse, from: from, check: check, fieldsHTML: fieldsHTML };
}));
