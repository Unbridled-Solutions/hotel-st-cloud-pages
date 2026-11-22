/* Wholesale Cabinets mail-in (FMMailIn): forwards, the sender check, matching to a job, filing, and the inbox in the store. HANDOFF §46. */
var isNode = typeof require === 'function' && typeof module === 'object';
if (isNode) { globalThis.FMPhase1 = require('../src/fm-phase1-ledger.js'); var FX = require('./fixtures/wc-emails.js'); globalThis.WC_ORDER_EML = FX.WC_ORDER_EML; globalThis.WC_SHIP_EML = FX.WC_SHIP_EML; }
var SH = isNode ? require('../src/fm-phase2-shipping.js') : globalThis.FMShipping;
var MI = isNode ? require('../src/fm-phase2-mailin.js') : globalThis.FMMailIn;
var ST = isNode ? require('../src/fm-phase2-store.js') : globalThis.FMStore;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
var BY = { by: 'Mail-in', today: '2026-11-05' };
function job(code, stage, orders) { return { jobCode: code, customer: code === 'FM-1' ? 'Willow Creek Estates' : 'Braddy Builders', stage: stage || 'deposit_paid', history: [], houses: [], invoices: [], changeOrders: [], supplierOrders: orders || [] }; }
function order(n, lines) { return { id: 'x-wc1', number: n, kind: 'original', lines: lines || [], shipments: [], placedOn: null, estShip: null, shipTo: null, subtotalCents: null, discountCents: null, totalCents: null }; }
var SOLD = { 'FM-1': [{ sku: 'F342-SBW', qty: 6 }, { sku: 'F342-SWD', qty: 4 }, { sku: 'B24-SBW', qty: 2 }], 'FM-2': [{ sku: 'W3042-NVY', qty: 2 }] };
var OPTS = function (jobs) { return { jobs: jobs, linesOf: function (j) { return SOLD[j.jobCode] || []; }, receivedAt: '2026-11-05T15:00:00Z' }; };

test('an order email redirected as-is: read, from Wholesale Cabinets, matched by its cabinets (likely, so it waits for a click); no card data kept', function () {
  var it = MI.ingest(WC_ORDER_EML, OPTS([job('FM-1'), job('FM-2')]));
  eq([it.how, it.fromWC, it.kind, it.order.number, it.status, it.match.confidence, it.match.jobCode], ['direct', true, 'order', '1000174448', 'waiting', 'likely', 'FM-1']);
  ok(/2 of 2 cabinets/.test(it.match.why), it.match.why); eq(MI.autoFile(it), false, 'a likely match is never filed on its own');
  var s = JSON.stringify(it); ok(!/MasterCard|XXXX|Card|Payment Method/i.test(s), 'no payment details'); ok(!('raw' in it) && s.length < 4000, 'the raw email is not kept');
  eq(MI.summary(it), 'Order #1000174448 · 2 lines · ships about Nov 2');
});

test('a shipment for an order on a job is exact and files on its own; the inbox note is in the log; a second copy is a duplicate', function () {
  var J = job('FM-1', 'factory_ordered', [order('1000174155')]), it = MI.ingest(WC_SHIP_EML, OPTS([J, job('FM-2')]));
  eq([it.kind, it.match.confidence, it.match.jobCode, MI.autoFile(it)], ['shipment', 'exact', 'FM-1', true]);
  ok(/odfl\.com/.test(it.shipment.url), 'the carrier link is kept');
  var r = MI.file(J, it, BY); ok(r.ok, r.error);
  eq([r.job.supplierOrders[0].shipments.length, r.job.supplierOrders[0].shipments[0].trackNo, r.orderAction], [1, '39212935785', false]);
  ok(/fremontmakers@gmail\.com inbox/.test(r.log), r.log);
  eq(MI.file(r.job, it, BY).duplicate, true);
});

test('a shipment whose order isn\'t on any job waits; filing it on a job adds the order (number only) and moves a deposit-paid job to factory ordered', function () {
  var J = job('FM-2'), it = MI.ingest(WC_SHIP_EML, OPTS([job('FM-1'), J]));
  eq([it.status, it.match.confidence, it.match.why], ['waiting', 'none', 'Order #1000174155 isn\'t on a job yet.']);
  var r = MI.file(J, it, BY); ok(r.ok, r.error);
  eq([r.job.supplierOrders[0].number, r.job.supplierOrders[0].lines, r.job.supplierOrders[0].shipments.length, r.orderAction], ['1000174155', [], 1, true]);
});

test('an order # typed on the job is exact; the email fills in the blank lines, ship date and ship-to, and changes nothing already there', function () {
  var J = job('FM-2', 'factory_ordered', [order('1000174448')]), it = MI.ingest(WC_ORDER_EML, OPTS([job('FM-1'), J]));
  eq([it.match.confidence, it.match.jobCode, MI.autoFile(it)], ['exact', 'FM-2', true]);
  var r = MI.file(J, it, BY); ok(r.ok, r.error);
  var o = r.job.supplierOrders[0]; eq([o.lines.length, o.estShip, o.shipTo.street, o.id], [2, '2026-11-02', '1330 College Ave', 'x-wc1']);
  ok(/filled in from the confirmation email: 2 lines, ships about Nov 2, ship-to/.test(r.log), r.log);
  eq(MI.file(r.job, it, BY).duplicate, true, 'already filled in');
  var J2 = job('FM-2', 'factory_ordered', [Object.assign(order('1000174448'), { estShip: '2026-12-01', lines: [{ sku: 'X', qty: 1 }] })]), r2 = MI.file(J2, it, BY);
  eq([r2.job.supplierOrders[0].estShip, r2.job.supplierOrders[0].lines.length], ['2026-12-01', 1], 'a typed date and lines are kept');
});

test('forwarded inline (Gmail and Outlook style) and forwarded as an attachment are unwrapped to the original', function () {
  var em = SH.readEmail(WC_SHIP_EML).text;
  var gmail = 'From: Tim <hello@fremontmakers.com>\nTo: fremontmakers@gmail.com\nSubject: Fwd: Wholesale Cabinets: Shipment # 1000168892 update\nMessage-ID: <fwd1@x>\nContent-Type: text/plain; charset=utf-8\n\nFYI\n\n---------- Forwarded message ---------\nFrom: WholesaleCabinets.com <customerservice@wholesalecabinets.com>\nDate: Mon, Nov 2, 2026 at 7:03 AM\nSubject: Wholesale Cabinets: Shipment # 1000168892 update\nTo: Tim Slaughenhaupt <hello@fremontmakers.com>\n\n' + em;
  var g = MI.ingest(gmail, OPTS([job('FM-1', 'factory_ordered', [order('1000174155')])]));
  eq([g.how, g.forwardedBy, g.from, g.fromWC, g.kind, g.shipment.trackNo, g.match.confidence], ['inline', 'hello@fremontmakers.com', 'customerservice@wholesalecabinets.com', true, 'shipment', '39212935785', 'exact']);
  var outlook = 'From: Tim <hello@fremontmakers.com>\nSubject: FW: Wholesale Cabinets: Shipment # 1000168892 update\nContent-Type: text/plain\n\n________________________________\nFrom: WholesaleCabinets.com <customerservice@wholesalecabinets.com>\nSent: Monday, November 2, 2026 7:03 AM\nTo: Tim Slaughenhaupt <hello@fremontmakers.com>\nSubject: Wholesale Cabinets: Shipment # 1000168892 update\n\n' + em;
  var o = MI.ingest(outlook, OPTS([])); eq([o.how, o.fromWC, o.kind, o.shipment.orderNumber], ['inline', true, 'shipment', '1000174155']);
  var att = 'From: Tim <hello@fremontmakers.com>\nSubject: Fwd: shipment\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary="OUTER"\n\n--OUTER\nContent-Type: text/plain\n\nSee attached\n--OUTER\nContent-Type: message/rfc822\nContent-Disposition: attachment\n\n' + WC_SHIP_EML + '\n--OUTER--\n';
  var a = MI.ingest(att, OPTS([])); eq([a.how, a.fromWC, a.kind, a.shipment.number], ['attached', true, 'shipment', '1000168892']);
});

test('not from Wholesale Cabinets: set aside, never filed; tracking links only to carriers; other WC email is set aside too', function () {
  var fake = 'From: Wholesale Cabinets <orders@wholesa1ecabinets.co>\nSubject: Wholesale Cabinets: Shipment # 1 update\nContent-Type: text/plain\n\nYour order # 1000174155 status has been changed to Complete.\nYour order is shipping with FedEx tracking number 879567129870. https://evil.example/pay';
  var f = MI.ingest(fake, OPTS([job('FM-1', 'factory_ordered', [order('1000174155')])]));
  eq([f.fromWC, f.kind, f.status, f.reason, MI.autoFile(f)], [false, 'unknown', 'ignored', 'Not from Wholesale Cabinets.', false]);
  eq([MI.safeUrl('https://www.odfl.com/Trace/standardResult.faces?pro=1'), MI.safeUrl('https://evil.example/odfl.com'), MI.safeUrl('http://www.fedex.com/x'), MI.safeUrl('https://odfl.com.evil.example/')], ['https://www.odfl.com/Trace/standardResult.faces?pro=1', null, null, null]);
  var promo = MI.ingest('From: WholesaleCabinets.com <customerservice@wholesalecabinets.com>\nSubject: Black Friday savings\nContent-Type: text/plain\n\n20% off everything', OPTS([]));
  eq([promo.kind, promo.status, promo.reason], ['unknown', 'ignored', 'Not an order or shipment email.']);
  var ship = MI.ingest('From: customerservice@wholesalecabinets.com\nSubject: Wholesale Cabinets: Shipment # 2 update\nContent-Type: text/plain\n\nYour order # 1000174155 status has been changed to Complete.\nYour order is shipping with FedEx tracking number 879567129870. https://evil.example/track', OPTS([]));
  ok(/fedex\.com.*879567129870/.test(ship.shipment.url), 'a non-carrier link is replaced with the carrier\'s own: ' + ship.shipment.url);
});

test('the inbox in the store: saved once (no raw email), only the inbox fields change, logged under MAIL; a live store has no inbox until the first email', function () {
  var s = ST.create({ seed: { jobs: [job('FM-1')], log: [], seq: 0, settings: {} }, live: true });
  eq(s.mailIn(), []); ok(!('mailIn' in s.state), 'nothing added just by loading');
  var it = MI.ingest(WC_ORDER_EML, OPTS(s.jobs())); it.raw = 'should not be kept';
  ok(s.addMailIn(it, '2026-11-05T15:00:00Z').ok); eq(s.addMailIn(it).duplicate, true);
  ok(!('raw' in s.mailIn()[0]), 'raw dropped');
  var u = s.updateMailIn(it.id, { status: 'filed', jobCode: 'FM-1', filedBy: 'Linds', filedOn: '2026-11-05', order: { number: 'changed' } }, 'Filed by Linds', 'Linds');
  eq([u.ok, u.item.status, u.item.order.number], [true, 'filed', '1000174448'], 'what was read stays as it was');
  eq(s.updateMailIn(it.id, { status: 'deleted' }).ok, false);
  ok(s.log().some(function (e) { return e.jobCode === 'MAIL'; }) && s.log().some(function (e) { return e.jobCode === 'FM-1' && /Filed by Linds/.test(e.text); }));
});

test('forwarded by hello@fremontmakers.com with the original headers gone: trusted as Wholesale Cabinets (unless the server says the sender failed checks); a wrapped non-WC original is still set aside', function () {
  var em = SH.readEmail(WC_SHIP_EML).text, J = job('FM-1', 'factory_ordered', [order('1000174155')]);
  var bare = 'From: Fremont Makers <hello@fremontmakers.com>\nTo: fremontmakers@gmail.com\nSubject: FW: Wholesale Cabinets: Shipment # 1000168892 update\nMessage-ID: <fwd2@x>\nContent-Type: text/plain\n\n' + em;
  var b = MI.ingest(bare, OPTS([J]));
  eq([b.how, b.fromWC, b.forwardedBy, b.subject, b.kind, b.match.confidence, MI.autoFile(b)], ['forwarder', true, 'hello@fremontmakers.com', 'Wholesale Cabinets: Shipment # 1000168892 update', 'shipment', 'exact', true]);
  var o = MI.ingest(bare.replace('Shipment # 1000168892 update', 'New Order # 1000174448').replace(em, SH.readEmail(WC_ORDER_EML).text), OPTS([job('FM-1'), job('FM-2')]));
  eq([o.fromWC, o.kind, o.order.number, o.match.confidence], [true, 'order', '1000174448', 'likely']);
  var failedAuth = MI.ingest(bare, Object.assign(OPTS([J]), { forwarderAuth: false }));
  eq([failedAuth.fromWC, failedAuth.status, failedAuth.reason], [false, 'ignored', 'Not from Wholesale Cabinets.']);
  var wrapped = 'From: Fremont Makers <hello@fremontmakers.com>\nSubject: Fwd: Wholesale Cabinets: Shipment # 1 update\nContent-Type: text/plain\n\n---------- Forwarded message ---------\nFrom: Wholesale Cabinets <orders@wholesa1ecabinets.co>\nDate: Mon, Nov 2, 2026 at 7:03 AM\nSubject: Wholesale Cabinets: Shipment # 1 update\n\n' + em;
  var w = MI.ingest(wrapped, OPTS([J])); eq([w.how, w.fromWC, w.status, MI.autoFile(w)], ['inline', false, 'ignored', false]);
  var other = MI.ingest(bare.replace('hello@fremontmakers.com', 'someone@gmail.com'), OPTS([J])); eq([other.fromWC, other.status], [false, 'ignored'], 'only the team mailbox is trusted');
  var extra = MI.ingest(bare.replace('hello@fremontmakers.com', 'tim@fremontmakers.com'), Object.assign(OPTS([J]), { settings: { mailInForwarders: ['Tim@fremontmakers.com'] } })); eq(extra.fromWC, true, 'settings can add a forwarding mailbox');
});

console.log('mailin.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
