/* Supplier orders, shipping, receiving and damage claims (FMShipping), with the owner's two Wholesale Cabinets emails. HANDOFF §45. */
var isNode = typeof require === 'function' && typeof module === 'object';
if (isNode) { globalThis.FMPhase1 = require('../src/fm-phase1-ledger.js'); var FX = require('./fixtures/wc-emails.js'); globalThis.WC_ORDER_EML = FX.WC_ORDER_EML; globalThis.WC_SHIP_EML = FX.WC_SHIP_EML; }
var SH = isNode ? require('../src/fm-phase2-shipping.js') : globalThis.FMShipping;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
var BY = { by: 'Linds', today: '2026-11-05' };
function job(stage) { return { jobCode: 'FM-2609-276', customer: 'Willow Creek Estates', stage: stage || 'deposit_paid', history: [{ from: 'contract_signed', to: 'deposit_paid', date: '2026-10-01' }], houses: [{ name: 'San Luis 1' }, { name: 'San Luis 2' }], invoices: [], changeOrders: [] }; }

test('the order confirmation: order #, dates, ship-to, two lines, totals; the SHIPPING FEE row is skipped; no card data', function () {
  var em = SH.readEmail(WC_ORDER_EML); eq([SH.kind(em), em.subject], ['order', 'Wholesale Cabinets: New Order # 1000174448']);
  var r = SH.parseOrder(em), o = r.order;
  eq([r.ok, o.number, o.placedOn, o.estShip, o.shipTo.street, o.shipTo.zip], [true, '1000174448', '2026-10-28', '2026-11-02', '1330 College Ave', '81212']);
  eq(o.lines, [{ sku: 'F342-SBW', item: 'Bayview White Shaker', type: 'RTA Cabinets', qty: 6, subtotalCents: 11796 }, { sku: 'F342-SWD', item: 'Bayview Wood Shaker', type: 'RTA Cabinets', qty: 4, subtotalCents: 11404 }]);
  eq([o.subtotalCents, o.discountCents, o.totalCents], [27100, -1160, 25940]);
  ok(!/MasterCard|XXXX|Card/i.test(JSON.stringify(r)), 'no payment details');
  eq(SH.knownShipTo(o.shipTo).label, 'College Ave', '1330 College Ave is a real ship-to (owner, Nov 20)');
  eq(SH.knownShipTo({ street: '55 Elm St' }), null);
});

test('the shipment update: order #, shipment #, Complete, Old Dominion PRO, the moss green items, the number to schedule', function () {
  var em = SH.readEmail(WC_SHIP_EML), r = SH.parseShipment(em), s = r.shipment;
  eq([SH.kind(em), r.ok, s.orderNumber, s.number, s.status, s.carrier, s.trackKind, s.trackNo, s.scope, s.schedulePhone], ['shipment', true, '1000174155', '1000168892', 'Complete', 'Old Dominion', 'pro', '39212935785', 'moss green shaker', '800-235-5569']);
  ok(/odfl\.com/.test(s.url));
  var fx = SH.parseShipment({ subject: 'Wholesale Cabinets: Shipment # 1000169078 update', text: 'Your order # 1000174626 status has been changed to Complete.\nYour order is shipping with FedEx tracking number 879567129870.' }).shipment;
  eq([fx.carrier, fx.trackKind, fx.trackNo, fx.number], ['FedEx', 'tracking', '879567129870', '1000169078']); ok(/fedex\.com.*879567129870/.test(fx.url));
});

test('recording orders and shipments: unknown orders and the same email twice change nothing', function () {
  var o = SH.parseOrder(SH.readEmail(WC_ORDER_EML)).order, j = job(), before = JSON.stringify(j);
  var r = SH.addOrder(j, o, BY); ok(r.ok); eq(JSON.stringify(j), before, 'never changes the job passed in'); eq(r.warnings, []);
  eq(SH.addOrder(r.job, o, BY).ok, false, 'same order twice');
  var s = SH.parseShipment(SH.readEmail(WC_SHIP_EML)).shipment;
  eq(SH.addShipment(r.job, s, BY).ok, false, 'its order isn\'t on the job');
  var r2 = SH.addOrder(r.job, { number: '1000174155', lines: [] }, BY), r3 = SH.addShipment(r2.job, s, BY); ok(r3.ok);
  eq(SH.addShipment(r3.job, s, BY).duplicate, true, 'same shipment twice');
  eq(SH.status(r3.job, '2026-11-05').text, 'In transit · Old Dominion PRO 39212935785');
  eq(SH.addOrder(job(), { number: '12', lines: [] }, BY).ok, false);
  ok(SH.addOrder(job(), Object.assign({}, o, { shipTo: { street: '55 Elm St', city: 'Pueblo' } }), BY).warnings.length === 1, 'other ship-to flagged');
});

test('receiving starts the 5-day window; All good finishes it; status and Needs attention follow', function () {
  var j = SH.addOrder(job('factory_ordered'), SH.parseOrder(SH.readEmail(WC_ORDER_EML)).order, BY).job;
  j = SH.addShipment(j, { orderNumber: '1000174448', carrier: 'FedEx', trackNo: '879567129870' }, BY).job;
  var o = j.supplierOrders[0], s = o.shipments[0];
  eq(SH.receive(j, o.id, s.id, { date: '2026-11-09' }, BY).ok, false, 'not in the future');
  eq(SH.receive(j, o.id, s.id, { date: '2026-11-05', visibleDamage: true }, BY).ok, false, 'damage needs the exception #');
  var r = SH.receive(j, o.id, s.id, { date: '2026-11-05' }, BY); j = r.job; s = j.supplierOrders[0].shipments[0];
  eq([s.receivedOn, s.deadline], ['2026-11-05', '2026-11-10']);
  eq(SH.status(j, '2026-11-08').text, 'At the shop since Nov 5 · inspect by Nov 10 (2 days left)');
  ok(SH.attention(j, '2026-11-08').some(function (a) { return a.kind === 'inspect'; }));
  j = SH.markOk(j, o.id, s.id, 'all', BY).job;
  eq([SH.status(j, '2026-11-08').text, SH.attention(j, '2026-11-08')], ['Received and inspected · ready to deliver', []]);
});

test('claims: one per order, photo required for damage, doors don\'t stop assembly, submit, close; open claims block close-out', function () {
  var j = SH.addOrder(job('factory_ordered'), { number: '1000174448', lines: [{ sku: 'F342-SBW', item: 'Bayview White Shaker', qty: 6 }] }, BY).job;
  j = SH.addShipment(j, { orderNumber: '1000174448', carrier: 'FedEx', trackNo: '1' }, BY).job;
  var o = j.supplierOrders[0]; j = SH.receive(j, o.id, o.shipments[0].id, { date: '2026-11-05', visibleDamage: true, exception: 'EX-77' }, BY).job;
  eq([j.claims.length, j.claims[0].exception], [1, 'EX-77'], 'visible damage opens the draft claim with the exception #');
  eq(SH.addIssue(j, { orderId: o.id, sku: 'F342-SBW', kind: 'hidden_damage', part: 'door', qty: 1 }, BY).ok, false, 'photo required');
  var a = SH.addIssue(j, { orderId: o.id, sku: 'F342-SBW', kind: 'hidden_damage', part: 'door', qty: 1, photos: ['p1'], house: 'San Luis 1' }, BY); j = a.job;
  var b = SH.addIssue(j, { orderId: o.id, sku: 'F342-SBW', kind: 'missing', part: 'box', qty: 1 }, BY); j = b.job;
  eq([j.claims.length, j.claims[0].items.length, a.item.blocks, b.item.blocks], [1, 2, false, true], 'same draft claim; a missing box stops assembly');
  eq(SH.blocked(j), ['whole job']);
  ok(/^2 items to claim · submit by Nov 10/.test(SH.status(j, '2026-11-06').text));
  j = SH.removeIssue(j, j.claims[0].id, b.item.id, BY).job; eq([SH.items(j.claims[0]).length, j.claims[0].items.length], [1, 2], 'removed items are kept on file');
  eq(SH.submit(j, j.claims[0].id, {}, BY).ok, false);
  j = SH.submit(j, j.claims[0].id, { via: 'email', ref: 'WC-123' }, BY).job; eq(j.claims[0].status, 'submitted');
  ok(/still open/.test(SH.closeBlocker(j)));
  var rep = SH.addOrder(j, { number: '1000175000', lines: [] }, Object.assign({ kind: 'replacement', claimId: j.claims[0].id }, BY)); j = rep.job;
  eq(j.claims[0].status, 'replacement_ordered');
  j = SH.addShipment(j, { orderNumber: '1000175000', carrier: 'FedEx', trackNo: '2' }, BY).job; eq(j.claims[0].status, 'replacement_shipped');
  var ro = j.supplierOrders[1]; j = SH.receive(j, ro.id, ro.shipments[0].id, { date: '2026-11-20' }, Object.assign({}, BY, { today: '2026-11-20' })).job; eq(j.claims[0].status, 'replacement_received');
  eq(SH.close(j, j.claims[0].id, { outcome: 'denied' }, BY).ok, false, 'denied needs a reason');
  j = SH.close(j, j.claims[0].id, { outcome: 'closed' }, BY).job; eq([j.claims[0].status, SH.closeBlocker(j)], ['closed', null]);
});

test('an order can ship in parts by color; sold-vs-ordered is a warning list', function () {
  var o = { lines: [{ sku: 'W3042-UMO', item: 'Moss Green Shaker', qty: 2 }, { sku: 'B30-SBW', item: 'Bayview White Shaker', qty: 1 }] };
  eq(SH.shipmentLines(o, { scope: 'moss green shaker' }).map(function (l) { return l.sku; }), ['W3042-UMO']);
  eq(SH.shipmentLines(o, { scope: null }).length, 2);
  var ck = SH.check(o.lines, [{ sku: 'W3042-UMO', qty: 3 }, { sku: 'SB36-SBW', qty: 1 }]);
  eq([ck.lines.map(function (l) { return l.matched; }), ck.soldNotOrdered, ck.orderedNotSold, ck.qtyDiff], [[true, false], [{ sku: 'SB36-SBW', qty: 1 }], [{ sku: 'B30-SBW', qty: 1 }], [{ sku: 'W3042-UMO', sold: 3, ordered: 2 }]]);
  eq(SH.base('WC2430-VDH'), { code: 'W2430', color: 'VDH' });
});

console.log('shipping.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
