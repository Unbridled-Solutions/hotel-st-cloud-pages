/* Issuing and sending invoices; the package to finance (FMInvoicing). Run with:   node tests/invoicing.test.js */
var isNode = typeof require === "function" && typeof module === "object";
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push("  ok   " + name); } catch (e) { failed++; results.push("  FAIL " + name + "\n         " + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ": " : "") + "expected " + sb + ", got " + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }
var IV = isNode ? require('../src/fm-phase2-invoicing.js') : globalThis.FMInvoicing;
function job(stage) { return { jobCode: 'FM-2611-101', customer: 'Rod Stambaugh', projectName: 'Office kitchen', stage: stage || 'contract_signed', contractedOn: '2026-11-19', taxCents: 58013, contacts: { buyerEmail: 'rod@example.com', signer: 'Rod Stambaugh' },
  invoices: [{ id: 'i1', label: 'Invoice 1 · 50%', role: 'deposit', amountCents: 409542, dueDate: '2026-11-19', status: 'open', payments: [] }, { id: 'i2', label: 'Invoice 2 · 50%', role: 'progress', amountCents: 409541, dueDate: '2026-12-14', status: 'open', payments: [] }] }; }

test('issuing numbers the invoices by job and splits the sales tax so it adds up exactly; not before signing; not twice', function () {
  eq(IV.issue(job('quote')).ok, false);
  var r = IV.issue(job(), '2026-11-19T10:00:00Z');
  eq(r.invoices.map(function (i) { return [i.number, i.taxCents, i.preTaxCents]; }), [['FM-2611-101-1', 29007, 380535], ['FM-2611-101-2', 29006, 380535]]);
  eq(r.invoices[0].taxCents + r.invoices[1].taxCents, 58013);
  var j = job(); j.invoices = r.invoices; eq(IV.issue(j).ok, false);
});

test('ready to send: the deposit at signing; the last invoice at delivery or its due date; never twice', function () {
  var j = job(); j.invoices = IV.issue(j, 'x').invoices;
  eq(IV.readyList(j, '2026-11-20').map(function (i) { return i.number; }), ['FM-2611-101-1']);
  j.stage = 'delivered'; eq(IV.readyList(j, '2026-11-20').length, 2);
  var m = IV.markSent(j.invoices[0], 'mail', 'Linds', '2026-11-20', 'rod@example.com');
  j.invoices[0] = m.invoice; eq(IV.readyList(j, '2026-11-20').map(function (i) { return i.number; }), ['FM-2611-101-2']);
  eq(IV.markSent(j.invoices[0], 'mail', 'Linds').ok, false);
  eq(IV.stateOf(j, j.invoices[0], '2026-11-20').label, 'Sent Nov 20, 2026');
});

test('the customer email lists each invoice with tax and due date, and how to pay', function () {
  var j = job(); j.invoices = IV.issue(j, 'x').invoices;
  var e = IV.customerEmail(j, [j.invoices[0]], 'Linds');
  ok(/^mailto:rod%40example\.com/.test(e.mailto)); ok(/FM-2611-101-1 · Invoice 1 · 50%: \$4,095\.42 \(includes \$290\.07 sales tax\), due Nov 19, 2026/.test(e.body), e.body); ok(/Checks payable to Fremont Makers LLC/.test(e.body));
});

test('the finance package goes to the finance email with every invoice; marked sent once', function () {
  var j = job(); j.invoices = IV.issue(j, 'x').invoices;
  var e = IV.financeEmail(j, { signedBy: 'Rod Stambaugh and Kristy Slaughenhaupt' });
  eq(e.to, 'sthorp@unbridled.com'); ok(/Executed: FM-2611-101/.test(e.subject)); ok(/FM-2611-101-2/.test(e.body)); ok(/^Sara,\n/.test(e.body), 'addressed to Sara Thorp');
  ok(!/^Sara/.test(IV.financeEmail(j, { to: 'books@fremontmakers.com' }).body), 'no name for another address');
  eq(IV.financeEmail(j, { to: 'books@fremontmakers.com' }).to, 'books@fremontmakers.com');
  var m = IV.markFinanceSent(j, 'mail', 'Linds', '2026-11-20'); eq(m.ok, true); j.financeSent = m.financeSent; eq(IV.markFinanceSent(j, 'mail', 'Linds').ok, false);
});

test('the dashboard to-dos: invoices to send and the finance package', function () {
  var j = job(); j.invoices = IV.issue(j, 'x').invoices; j.esign = { provider: 'fm', state: 'signed' };
  eq(IV.todo([j], '2026-11-20').map(function (t) { return t.kind; }), ['invoice', 'finance']);
});

console.log('invoicing.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
