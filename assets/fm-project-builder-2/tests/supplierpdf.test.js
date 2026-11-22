/* Reading a supplier PDF (FMSupplierPdf). Run with:   node tests/supplierpdf.test.js
   The texts are what OCR read from two real Wholesale Cabinets order PDFs (pictures of the page), Nov 2026. */
var isNode = typeof require === 'function' && typeof module === 'object';
var SP = isNode ? require('../src/fm-phase2-supplierpdf.js') : globalThis.FMSupplierPdf;
var results = [], failed = 0;
function test(name, fn) { try { fn(); results.push('  ok   ' + name); } catch (e) { failed++; results.push('  FAIL ' + name + '\n         ' + e.message); } }
function eq(a, b, msg) { var sa = JSON.stringify(a), sb = JSON.stringify(b); if (sa !== sb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + sb + ', got ' + sa); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

var CABINETS = 'WHOLESALE\nCABINDITS\nThank you for your order!\n\nOrder # Order Date\n\n1000173203 Oct 9, 2026\n\nShipping Information ~~ Shipping Method Billing Information Payment Method\n\nKristy Slaughenhaupt Free Shipping - Free Kristy Slaughenhaupt Credit Card\n\n=) VDC42RS-VDH Quantity Price Subtotal\nDark Hickory Shaker 1 $707.92 $707.92\nes DC224-VDH Quantity Price Subtotal\nDark Hickory Shaker 2 $446.26 $892.52\n\nOrder Total\nSubtotal $1,600.44\nDiscount $80.02\nTax $132.28\nShipping $0.00\nTotal $1,652.70\n';
var MOLDINGS = 'Order # Order Date\n1000175910 Nov 18, 2026\nMoldings - Outside Corner Quantity Price Subtotal\nBayview White Shaker 2 $19.10 $38.20\nType : RTA Cabinets\nSize : 96"W|3/4"H|3/4\'D\nMoldings - Scribe Quantity Price Subtotal\nBayview White Shaker 2 $17.97 $35.94\nType: RTA Cabinets\n_ Moldings - Outside Corner Quantity Price Subtotal\nMoss Green Shaker 1 $44.16 $44.16\n_ Moldings - Scribe Quantity Price Subtotal\nMoss Green Shaker 2 $20.24 $40.48\n_ Moldings - Outside Corner Quantity Price Subtotal\nBayview Wood Shaker 1 $26.31 $26.31\nMoldings - Scribe Quantity Price Subtotal\nBayview Wood Shaker 1 $26.31 $26.31\nwu SHIPPING FEE Quantity Price Subtotal\n185 $1.00 $185.00\nOrder Total\nSubtotal $396.40\nDiscount $50.73\nTax $0.00\nShipping $0.00\nTotal $345.67\n';

test('cabinet order: SKUs, quantities and prices; the order number and totals; it adds up to the subtotal', function () {
  var r = SP.parse(CABINETS);
  eq(r.items.map(function (x) { return [x.sku, x.qty, x.unitCostCents, x.desc]; }), [['VDC42RS-VDH', 1, 70792, 'Dark Hickory Shaker'], ['DC224-VDH', 2, 44626, 'Dark Hickory Shaker']]);
  eq([r.orderNumber, r.orderDate, r.totals.total, r.check.matches, r.problems.length], ['1000173203', 'Oct 9, 2026', 165270, true, 0]);
});

test('moldings and other products without a SKU keep their name and color; a shipping fee is a fee, not a product', function () {
  var r = SP.parse(MOLDINGS);
  eq(r.items.length, 6);
  eq(r.items[0].sku, 'Moldings - Outside Corner (Bayview White Shaker)');
  ok(/Type: RTA Cabinets/.test(r.items[0].desc));
  eq(r.fees, [{ label: 'Shipping Fee', qty: 185, amountCents: 18500 }]);
  eq([r.check.itemsCents, r.check.matches], [39640, true]);
  var lines = SP.toLines(r); eq(lines.length, 6); eq(lines[2].qty, 1);
});

test('a misread quantity or a missing line is reported, not hidden', function () {
  var r = SP.parse('B24-SBW Quantity Price Subtotal\nBayview White Shaker 3 $100.00 $200.00\nSubtotal $200.00');
  ok(r.problems.some(function (p) { return /doesn't match the subtotal/.test(p); }), r.problems.join(' | '));
  eq(SP.parse('nothing useful here').problems, ['No items were found in this PDF.']);
});

console.log('supplierpdf.test.js\n' + results.join('\n'));
console.log((results.length - failed) + ' passed, ' + failed + ' failed');
if (isNode && failed) process.exit(1);
