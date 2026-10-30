/*
 * Phase 2 address tests. Run with:   node tests/address.test.js
 */
var isNode = typeof require === 'function' && typeof module === 'object';
var A = isNode ? require('../src/fm-phase2-address.js') : globalThis.FMAddress;
var CU = isNode ? require('../src/fm-phase2-customers.js') : globalThis.FMCustomers;

var results = [], failed = 0;
function test(name, fn) {
  try { fn(); results.push('  ok   ' + name); }
  catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

test('a new address starts in Colorado', function () {
  eq(A.blank(), { street: '', city: '', state: 'CO', zip: '' });
  eq(A.format(A.blank()), '', 'an empty address prints nothing, not just "CO"');
});
test('fields join into the one-line form used by contracts and documents', function () {
  eq(A.format({ street: ' 414 Miners Rd ', city: 'Canon City', state: 'CO', zip: '81212' }), '414 Miners Rd, Canon City, CO 81212');
  eq(A.format({ street: '1 Main St', city: 'Santa Fe', state: 'NM', zip: '' }), '1 Main St, Santa Fe, NM');
});
test('one-line addresses from older jobs split back into fields', function () {
  eq(A.parse('414 Miners Rd, Canon City, CO 81212'), { street: '414 Miners Rd', city: 'Canon City', state: 'CO', zip: '81212' });
  eq(A.parse('22 Elm St, Apt 4, Pueblo, Colorado'.replace('Colorado', 'CO 81003')), { street: '22 Elm St, Apt 4', city: 'Pueblo', state: 'CO', zip: '81003' });
  eq(A.parse('414 Miners Rd Canon City CO 81212'), { street: '414 Miners Rd Canon City', city: '', state: 'CO', zip: '81212' }, 'without commas the city can\'t be told from the street');
  eq(A.parse('Lot 7, Willow Creek'), { street: 'Lot 7', city: 'Willow Creek', state: 'CO', zip: '' });
  eq(A.from({ line: '9 Oak Ave, Florence, CO 81226' }).city, 'Florence');
  eq(A.from({ street: '9 Oak Ave', city: 'Florence', state: '', zip: '81226' }).state, 'CO', 'a missing state falls back to Colorado');
});
test('checks name each missing part', function () {
  eq(A.check({ street: '414 Miners Rd', city: 'Canon City', state: 'CO', zip: '81212' }), []);
  eq(A.check({ street: '', city: '', state: 'XX', zip: '812' }, 'Install address'),
     ['Install address: enter the street.', 'Install address: enter the city.', 'Install address: choose the state.', 'Install address: enter a 5-digit ZIP code.']);
  ok(!A.check({ street: 'a', city: 'b', state: 'CO', zip: '81212-1234' }).length, 'ZIP+4 is fine');
});
test('the form has all four fields, Colorado selected', function () {
  var h = A.fieldsHTML(function (f) { return 'data-x="' + f + '"'; }, null, { legend: 'Install address' });
  ['data-x="street"', 'data-x="city"', 'data-x="state"', 'data-x="zip"', '<legend>Install address</legend>', '<option value="CO" selected>Colorado</option>'].forEach(function (s) { ok(h.indexOf(s) > -1, 'missing ' + s); });
  eq(A.STATES.length, 51, '50 states and DC');
});

test('customer profiles keep the fields of a job entered with them', function () {
  var a = { street: '414 Miners Rd', city: 'Canon City', state: 'CO', zip: '81212' };
  var out = CU.fromJobs([{ customer: 'Wendy Test', projectName: 'Kitchen', installAddress: A.format(a), installAddr: a, contacts: {} }, { customer: 'Old Job', installAddress: '9 Oak Ave, Florence, CO 81226', contacts: {} }]);
  var w = out.filter(function (c) { return c.name === 'Wendy Test'; })[0].addresses[0], o = out.filter(function (c) { return c.name === 'Old Job'; })[0].addresses[0];
  eq([w.street, w.city, w.state, w.zip, w.line], ['414 Miners Rd', 'Canon City', 'CO', '81212', '414 Miners Rd, Canon City, CO 81212']);
  eq(o.street, undefined, 'older jobs keep just the line'); eq(A.from(o).city, 'Florence', 'and still read as fields');
});

console.log('address.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
