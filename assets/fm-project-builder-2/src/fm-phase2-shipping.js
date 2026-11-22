/*
 * Fremont Makers · Project Builder · Phase 2 · Supplier orders, shipping, receiving and damage claims (FMShipping)
 * Version 1.0.0. Pure functions: no DOM, storage, network or clock. UMD: window.FMShipping in a browser.
 *
 * Owner, Nov 20: track a job from the Wholesale Cabinets order to the shop, in the Project Builder, so it's the one place
 * the team checks. Phase A (HANDOFF §45): orders and shipments come from the Wholesale Cabinets emails (dropped in or
 * pasted), receiving at the shop starts the 5-day inspection window, and damage, missing or wrong items go on one claim
 * per order (supplier-facing, separate from change orders, which are customer-facing). Invoices are not touched.
 *
 * Stored on the job, additive (§0 rule 9):
 *   supplierOrders: [{ id, number, kind ('original'|'change_order'|'replacement'), claimId, placedOn, estShip, shipTo, houses[],
 *     lines: [{ sku, item, type, qty, subtotalCents }], subtotalCents, discountCents, totalCents, by, on,
 *     shipments: [{ id, number, carrier, trackKind ('tracking'|'pro'), trackNo, url, scope, schedulePhone, status ('shipped'|'received'),
 *       shippedOn, receivedOn, receivedBy, exception, bolDoc, visibleDamage, deadline, okHouses: { <house|'all'>: true }, okLines: { <sku>: true } }] }]
 *   claims: [{ id, number, orderId, status, items: [{ id, sku, house, kind, part, qty, blocks, note, photos[], stage, by, on }],
 *     exception, bolDoc, submittedOn, via, ref, replacementOrderId, creditCents, closedOn, notes }]
 * Never stored: payment method or card details from the emails.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMShipping = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  /* Owner, Nov 20: both addresses are real ship-tos; anything else is flagged. Claims go to the generic inbox (no one rep). */
  var SETTINGS = {
    shipTo: [{ label: 'Shop', street: '719 Main St' }, { label: 'College Ave', street: '1330 College Ave' }],
    claimDays: 5, claimsEmail: 'customerservice@wholesalecabinets.com', supplierPhone: '844-777-1337', supplier: 'Wholesale Cabinets',
    orderReminderDays: 3   // deposit paid this many days without a WC order recorded → Needs attention
  };
  var KINDS = { visible_damage: 'Damaged (seen at the truck)', hidden_damage: 'Damaged (found in the box or during assembly)', missing: 'Missing', wrong_item: 'Wrong item' };
  var PARTS = { box: 'Cabinet box', door: 'Door', drawer: 'Drawer front', shelf: 'Shelf', hardware: 'Hardware', panel: 'Panel or molding', other: 'Other' };
  var CLAIM_STATUS = { draft: 'Draft', submitted: 'Submitted', replacement_ordered: 'Replacement ordered', replacement_shipped: 'Replacement shipped', replacement_received: 'Replacement received', closed: 'Closed', denied: 'Denied', credit_only: 'Credit only' };
  var OPEN = ['draft', 'submitted', 'replacement_ordered', 'replacement_shipped', 'replacement_received'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function blank(s) { return s == null || String(s).trim() === ''; }
  function cents(s) { var n = parseFloat(String(s || '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : Math.round(n * 100); }
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function isoOf(s) { var m = String(s || '').match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/); return m && MON[m[1].toLowerCase()] ? m[3] + '-' + ('0' + MON[m[1].toLowerCase()]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : null; }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function nice(iso) { if (!iso) return ''; var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], p = iso.split('-'); return m[+p[1] - 1] + ' ' + (+p[2]); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* ---------- reading the emails ---------- */
  /* An .eml file (as text) or pasted HTML/text → { subject, text }. Decodes the parts a mail app saves (quoted-printable, base64). */
  function readEmail(raw) {
    raw = String(raw || ''); var subject = '';
    var sm = raw.match(/^Subject:\s*(.+(?:\r?\n[ \t].+)*)/im);
    if (sm) subject = decodeWords(sm[1].replace(/\r?\n[ \t]+/g, ' '));
    var body = raw;
    if (/^(Content-Type|MIME-Version|Received|From):/im.test(raw.slice(0, 4000))) {
      // the text/html (or text/plain) part
      var bd = raw.match(/^Content-Type:\s*multipart\/[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*?boundary="?([^";\r\n]+)"?/im), best = null;
      var parts = bd ? raw.split('--' + bd[1]) : [raw];   // only the real MIME boundary (the HTML can have its own "--" lines)
      parts.forEach(function (p) {
        var hd = p.slice(0, Math.max(0, p.search(/\r?\n\r?\n/))), ct = (hd.match(/^Content-Type:\s*([^;\r\n]+)/im) || [])[1] || '', enc = ((hd.match(/^Content-Transfer-Encoding:\s*([^\r\n]+)/im) || [])[1] || '').trim().toLowerCase();
        if (!/text\/(html|plain)/i.test(ct)) return;
        var i = p.search(/\r?\n\r?\n/); if (i < 0) return;
        var b = p.slice(i).trim();
        if (enc === 'quoted-printable') b = qp(b); else if (enc === 'base64') b = b64(b);
        if (!best || /html/i.test(ct)) best = b;
      });
      if (best) body = best;
    }
    return { subject: subject, text: toText(body) };
  }
  function qp(s) {
    var bytes = s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
    try { return decodeURIComponent(escape(bytes)); } catch (e) { return bytes; }
  }
  function b64(s) {
    try { var bin = (typeof atob === 'function' ? atob : function (x) { return Buffer.from(x, 'base64').toString('binary'); })(s.replace(/\s+/g, '')); return decodeURIComponent(escape(bin)); } catch (e) { return ''; }
  }
  function decodeWords(s) { return s.replace(/=\?utf-8\?([QB])\?([^?]*)\?=/gi, function (m, k, t) { return k.toUpperCase() === 'B' ? b64(t) : qp(t.replace(/_/g, ' ')); }).trim(); }
  function toText(h) {
    var t = String(h || '');
    if (/<[a-z][\s\S]*>/i.test(t)) {
      t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li|table)>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ').replace(/<(?![^>\s]+@[^>\s]+>)[^>]+>/g, '');   // keeps <name@example.com> (forwarded headers)
      t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); });
    }
    return t.replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  }
  function kind(email) {
    var t = email.text || '', s = email.subject || '';
    if (/Shipment\s*#\s*\d+/i.test(s) || /status has been changed to/i.test(t)) return 'shipment';
    if (/Your Order #\s*\d+/i.test(t) || /New Order #\s*\d+/i.test(s)) return 'order';
    return 'unknown';
  }

  /* The order confirmation. Returns { ok, problems, order }. Payment method and card numbers are never read. */
  function parseOrder(email) {
    var t = email.text || '', P = [];
    var m = t.match(/Your Order #\s*(\d+)\s*\(placed on ([^)]+)\)/i) || (email.subject || '').match(/Order #\s*(\d+)/i);
    if (!m) return { ok: false, problems: ['This doesn\'t look like a Wholesale Cabinets order confirmation (no "Your Order #").'] };
    var order = { number: m[1], placedOn: m[2] ? isoOf(m[2]) : null };
    var es = t.match(/Estimated Shipping Date\s*-\s*'?(\d{4}-\d{2}-\d{2})'?/i); order.estShip = es ? es[1] : null;
    // ship-to: the block after "Shipping Information:" (name, company, street, city, state, ZIP), before the phone
    var si = t.split(/Shipping Information:/i)[1] || '';
    var blk = si.split(/\n\s*T:\s|Shipping Method:/i).join('\n').split('\n').map(function (x) { return x.replace(/\|/g, '').trim(); }).filter(function (x) { return x && !/^Shipping Method:?$/i.test(x); });
    var cityIdx = -1; blk.forEach(function (x, i) { if (cityIdx < 0 && /,\s*[A-Za-z ]+,\s*\d{5}/.test(x)) cityIdx = i; });
    if (cityIdx > 0) { var cm = blk[cityIdx].match(/^(.*?),\s*([A-Za-z ]+),\s*(\d{5})/); order.shipTo = { name: blk[0], company: cityIdx > 2 ? blk[1] : '', street: blk[cityIdx - 1], city: cm[1], state: cm[2].trim(), zip: cm[3] }; }
    else { order.shipTo = null; P.push('Couldn\'t read the ship-to address.'); }
    // items: Item | Sku | Type | Qty | Subtotal rows, between the header and "Subtotal"
    var items = (t.split(/\bSubtotal\s*\|\s*\n/i)[1] || t).split(/\n\s*Subtotal\s*\|/i)[0], lines = [];
    var re = /([^\n|]+)\n\s*([A-Z0-9][A-Z0-9().\-\/]*)\s*\n?\s*\|\s*\n?\s*\2\s*\|\s*\n?\s*([^\n|]*)\|\s*\n?\s*(\d+)\s*\|\s*\n?\s*\$?([\d,]+\.\d{2})/g, r;
    while ((r = re.exec(items))) {
      if (/SHIPPING FEE/i.test(r[2]) || /SHIPPING FEE/i.test(r[1])) continue;
      lines.push({ sku: r[2].trim(), item: r[1].trim(), type: r[3].trim(), qty: +r[4], subtotalCents: cents(r[5]) });
    }
    if (!lines.length) P.push('Couldn\'t read the item lines. Add them by hand or paste the email again.');
    order.lines = lines;
    var tot = function (label) { var x = t.match(new RegExp(label + '\\s*\\|?\\s*\\n?\\s*(-?\\$[\\d,]+\\.\\d{2})', 'i')); return x ? cents(x[1]) : null; };
    order.subtotalCents = tot('\\n\\s*Subtotal'); order.discountCents = tot('Discount'); order.shippingCents = tot('Shipping & Handling'); order.totalCents = tot('Grand Total');
    return { ok: true, problems: P, order: order };
  }

  /* The shipment update. Returns { ok, problems, shipment }. */
  function parseShipment(email) {
    var t = email.text || '', s = email.subject || '';
    var on = t.match(/order\s*#\s*(\d+)/i);
    if (!on) return { ok: false, problems: ['This doesn\'t look like a Wholesale Cabinets shipment update (no order #).'] };
    var sh = { orderNumber: on[1], number: ((s.match(/Shipment\s*#\s*(\d+)/i) || t.match(/Shipment\s*#\s*(\d+)/i) || [])[1]) || null };
    var st = t.match(/status has been changed to\s+([A-Za-z ]+?)[.\n]/i); sh.status = st ? st[1].trim() : null;
    var c = t.match(/(?:The\s+(.+?)\s+items\s+(?:are|is)\s+)?shipping with\s+(.+?)\s+(tracking|pro)\s*(?:number|#)?\s*:?\s*([A-Z0-9]+)/i);
    if (c) { sh.scope = c[1] ? c[1].trim() : null; sh.carrier = c[2].trim(); sh.trackKind = c[3].toLowerCase() === 'pro' ? 'pro' : 'tracking'; sh.trackNo = c[4]; }
    var u = t.match(/https?:\/\/[^\s|<>"]+/g); sh.url = u ? u.filter(function (x) { return !/wholesalecabinets/i.test(x); })[0] || null : null;
    var ph = t.match(/schedule your delivery appointment at\s*([\d\-() ]{10,})/i); sh.schedulePhone = ph ? ph[1].trim() : null;
    var P = []; if (!sh.trackNo) P.push('Couldn\'t read the carrier and tracking number. Type them in.');
    if (sh.carrier && /fedex/i.test(sh.carrier) && !sh.url) sh.url = 'https://www.fedex.com/fedextrack/?trknbr=' + sh.trackNo;
    return { ok: true, problems: P, shipment: sh };
  }
  function trackUrl(sh) { return sh.url || (sh.trackNo && /fedex/i.test(sh.carrier || '') ? 'https://www.fedex.com/fedextrack/?trknbr=' + sh.trackNo : null); }

  /* ---------- matching the order to what was sold ---------- */
  function base(sku) { var s = String(sku || '').toUpperCase().trim(), m = s.match(/^(.*?)-([A-Z]{3})$/); return { code: (m ? m[1] : s).replace(/^WC(?=\d)/, 'W'), color: m ? m[2] : '' }; }
  /* jobLines: [{ sku, qty, house }]. Returns { lines: [{ sku, matched, house? }], soldNotOrdered: [{ sku, qty }], orderedNotSold: [{ sku, qty }], qtyDiff: [{ sku, sold, ordered }] } (warnings only). */
  function check(orderLines, jobLines) {
    var sold = {}, ord = {};
    (jobLines || []).forEach(function (l) { var k = base(l.sku); k = k.code + '-' + k.color; sold[k] = (sold[k] || 0) + (+l.qty || 0); });
    var lines = (orderLines || []).map(function (l) { var k = base(l.sku); k = k.code + '-' + k.color; ord[k] = (ord[k] || 0) + (+l.qty || 0); return { sku: l.sku, key: k, matched: !!sold[k] }; });
    var out = { lines: lines, soldNotOrdered: [], orderedNotSold: [], qtyDiff: [] };
    Object.keys(sold).forEach(function (k) { if (!ord[k]) out.soldNotOrdered.push({ sku: k, qty: sold[k] }); else if (ord[k] !== sold[k]) out.qtyDiff.push({ sku: k, sold: sold[k], ordered: ord[k] }); });
    Object.keys(ord).forEach(function (k) { if (!sold[k]) out.orderedNotSold.push({ sku: k, qty: ord[k] }); });
    return out;
  }
  function knownShipTo(shipTo, settings) {
    if (!shipTo) return null;
    var list = (settings && settings.shipTo) || SETTINGS.shipTo;
    return list.filter(function (a) { return norm(shipTo.street).indexOf(norm(a.street)) === 0; })[0] || null;
  }
  /* The shipment's lines: an order can ship in parts by color ("The moss green shaker items are shipping with…"). */
  function shipmentLines(order, sh, colorName) {
    if (!sh.scope) return order.lines;
    var want = norm(sh.scope);
    var hit = order.lines.filter(function (l) { var n = norm(l.item) || norm(colorName ? colorName(base(l.sku).color) : ''); return n && (want.indexOf(n) >= 0 || n.indexOf(want) >= 0); });
    return hit.length ? hit : order.lines;
  }

  /* ---------- changing the job (each returns { ok, job, log, error } and never changes the job passed in) ---------- */
  function addOrder(job, order, ctx) {
    ctx = ctx || {};
    if (blank(order && order.number)) return { ok: false, error: 'Enter the Wholesale Cabinets order #.' };
    if (!/^\d{6,12}$/.test(String(order.number).trim())) return { ok: false, error: 'The order # is the number in the email, like 1000174448.' };
    if ((job.supplierOrders || []).some(function (o) { return o.number === String(order.number).trim(); })) return { ok: false, error: 'Order ' + order.number + ' is already on this job.', duplicate: true };
    if (blank(ctx.by)) return { ok: false, error: 'Sign in first.' };
    var x = clone(job), n = (x.supplierOrders || []).length + 1;
    var o = { id: x.jobCode + '-wc' + n, number: String(order.number).trim(), kind: ctx.kind || 'original', claimId: ctx.claimId || null, placedOn: order.placedOn || ctx.today || null, estShip: order.estShip || null,
      shipTo: order.shipTo || null, houses: ctx.houses || [], lines: order.lines || [], subtotalCents: order.subtotalCents == null ? null : order.subtotalCents, discountCents: order.discountCents == null ? null : order.discountCents,
      totalCents: order.totalCents == null ? null : order.totalCents, by: ctx.by, on: ctx.today || null, shipments: [] };
    x.supplierOrders = (x.supplierOrders || []).concat([o]);
    if (o.kind === 'replacement' && o.claimId) (x.claims || []).forEach(function (cl) { if (cl.id === o.claimId) { cl.replacementOrderId = o.id; if (cl.status === 'submitted' || cl.status === 'draft') cl.status = 'replacement_ordered'; } });
    var warn = []; if (o.shipTo && !knownShipTo(o.shipTo, ctx.settings)) warn.push('Ships to ' + o.shipTo.street + ', ' + o.shipTo.city + ', not the shop or College Ave. Check the address with Wholesale Cabinets.');
    return { ok: true, job: x, order: o, warnings: warn, log: 'Wholesale Cabinets order ' + o.number + ' recorded' + (o.kind === 'replacement' ? ' (replacement)' : '') + ' by ' + ctx.by + (o.lines.length ? ': ' + o.lines.length + ' lines' : '') + (o.estShip ? ', ships about ' + nice(o.estShip) : '') + '.' };
  }
  function findOrder(job, number) { return (job.supplierOrders || []).filter(function (o) { return o.number === String(number).trim(); })[0] || null; }
  function addShipment(job, sh, ctx) {
    ctx = ctx || {}; var o = findOrder(job, sh.orderNumber);
    if (!o) return { ok: false, error: 'Order ' + sh.orderNumber + ' isn\'t on this job. Record the order first.' };
    if (blank(sh.carrier) || blank(sh.trackNo)) return { ok: false, error: 'Enter the carrier and the tracking or PRO number.' };
    if (sh.number && o.shipments.some(function (s) { return s.number === sh.number; })) return { ok: false, error: 'Shipment ' + sh.number + ' is already recorded.', duplicate: true };
    if (o.shipments.some(function (s) { return s.trackNo === sh.trackNo; })) return { ok: false, error: 'That tracking number is already recorded.', duplicate: true };
    var x = clone(job), xo = findOrder(x, sh.orderNumber), id = xo.id + '-s' + (xo.shipments.length + 1);
    var s = { id: id, number: sh.number || null, carrier: sh.carrier.trim(), trackKind: sh.trackKind || 'tracking', trackNo: String(sh.trackNo).trim(), url: sh.url || null, scope: sh.scope || null, schedulePhone: sh.schedulePhone || null,
      status: 'shipped', shippedOn: ctx.today || null, receivedOn: null, receivedBy: null, exception: null, bolDoc: null, visibleDamage: false, deadline: null, okHouses: {}, okLines: {} };
    xo.shipments.push(s);
    (x.claims || []).forEach(function (cl) { if (cl.replacementOrderId === xo.id && cl.status === 'replacement_ordered') cl.status = 'replacement_shipped'; });
    return { ok: true, job: x, shipment: s, log: 'Shipment ' + (s.number || '') + ' on WC order ' + xo.number + ': ' + s.carrier + ' ' + (s.trackKind === 'pro' ? 'PRO ' : 'tracking ') + s.trackNo + (s.scope ? ' (' + s.scope + ')' : '') + '. Recorded by ' + ctx.by + '.' };
  }
  function find(x, orderId, shipId) { var o = (x.supplierOrders || []).filter(function (q) { return q.id === orderId; })[0]; return { o: o, s: o && shipId ? o.shipments.filter(function (q) { return q.id === shipId; })[0] : null }; }

  /* Received at the shop (or picked up). Starts the claim window: deadline = received + 5 days. A "yes" to visible damage opens the draft claim. */
  function receive(job, orderId, shipId, input, ctx) {
    input = input || {}; ctx = ctx || {}; var F = find(job, orderId, shipId);
    if (!F.s) return { ok: false, error: 'Which shipment?' };
    if (F.s.receivedOn) return { ok: false, error: 'Already received ' + nice(F.s.receivedOn) + '.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) return { ok: false, error: 'Enter the date it arrived.' };
    if (ctx.today && input.date > ctx.today) return { ok: false, error: 'The date it arrived can\'t be in the future.' };
    if (input.visibleDamage && blank(input.exception) && !input.noException) return { ok: false, error: 'Enter the exception # the driver wrote on the BOL (or tick "driver didn\'t give one").' };
    var x = clone(job), G = find(x, orderId, shipId), days = (ctx.settings && ctx.settings.claimDays) || SETTINGS.claimDays;
    G.s.status = 'received'; G.s.receivedOn = input.date; G.s.receivedBy = ctx.by; G.s.exception = blank(input.exception) ? null : String(input.exception).trim(); G.s.bolDoc = input.bolDoc || null;
    G.s.visibleDamage = !!input.visibleDamage; G.s.deadline = addDays(input.date, days);
    if (input.visibleDamage) { var cl = draftClaim(x, G.o); cl.exception = cl.exception || G.s.exception; cl.bolDoc = cl.bolDoc || G.s.bolDoc; }
    (x.claims || []).forEach(function (q) { if (q.replacementOrderId === G.o.id && (q.status === 'replacement_shipped' || q.status === 'replacement_ordered')) q.status = 'replacement_received'; });
    return { ok: true, job: x, log: 'WC order ' + G.o.number + (G.s.number ? ' shipment ' + G.s.number : '') + ' received ' + nice(input.date) + ' by ' + ctx.by + (G.s.exception ? ', BOL exception ' + G.s.exception : '') + (input.visibleDamage ? ', visible damage noted on the BOL' : '') + '. Inspect by ' + nice(G.s.deadline) + '.' };
  }
  function draftClaim(x, o) {
    x.claims = x.claims || [];
    var cl = x.claims.filter(function (q) { return q.orderId === o.id && q.status === 'draft'; })[0];
    if (!cl) { cl = { id: x.jobCode + '-cl' + (x.claims.length + 1), number: x.claims.length + 1, orderId: o.id, status: 'draft', items: [], exception: null, bolDoc: null, submittedOn: null, via: null, ref: null, replacementOrderId: null, creditCents: null, closedOn: null, notes: '' }; x.claims.push(cl); }
    return cl;
  }
  /* "All good": every line (or one house's lines) received with no damage. key: a house name, or 'all'. */
  function markOk(job, orderId, shipId, key, ctx) {
    var F = find(job, orderId, shipId); if (!F.s || !F.s.receivedOn) return { ok: false, error: 'Receive the shipment first.' };
    var x = clone(job), G = find(x, orderId, shipId); G.s.okHouses[key || 'all'] = true;
    return { ok: true, job: x, log: (key && key !== 'all' ? key : 'Every line') + ' on WC order ' + G.o.number + ' checked: all good (' + (ctx && ctx.by) + ').' };
  }
  function markLine(job, orderId, shipId, sku, ok, ctx) {
    var F = find(job, orderId, shipId); if (!F.s || !F.s.receivedOn) return { ok: false, error: 'Receive the shipment first.' };
    var x = clone(job), G = find(x, orderId, shipId); if (ok) G.s.okLines[sku] = true; else delete G.s.okLines[sku];
    return { ok: true, job: x, log: null };
  }
  /* A damaged, missing or wrong item, from receiving, assembly or install. Goes on the order's draft claim. */
  function addIssue(job, input, ctx) {
    input = input || {}; ctx = ctx || {}; var P = [];
    var o = (job.supplierOrders || []).filter(function (q) { return q.id === input.orderId; })[0];
    if (!o) P.push('Which Wholesale Cabinets order was it on?');
    if (!KINDS[input.kind]) P.push('Damaged, missing or wrong item?');
    if (blank(input.sku)) P.push('Which cabinet or part?');
    if (!(+input.qty > 0)) P.push('How many?');
    if (/damage/.test(input.kind || '') && !(input.photos && input.photos.length)) P.push('Add a photo of the damage (Wholesale Cabinets needs one).');
    if (blank(ctx.by)) P.push('Sign in first.');
    if (P.length) return { ok: false, problems: P };
    var x = clone(job), xo = (x.supplierOrders || []).filter(function (q) { return q.id === input.orderId; })[0], cl = draftClaim(x, xo);
    var part = PARTS[input.part] ? input.part : 'other';
    var blocks = input.blocks != null ? !!input.blocks : !(part === 'door' || part === 'drawer' || input.kind === 'missing' && part === 'hardware');
    var it = { id: cl.id + '-i' + (cl.items.length + 1), sku: String(input.sku).trim(), house: input.house || null, kind: input.kind, part: part, qty: +input.qty, blocks: blocks, note: String(input.note || '').trim(), photos: input.photos || [], stage: input.stage || 'receiving', by: ctx.by, on: ctx.today || null };
    cl.items.push(it);
    return { ok: true, job: x, claim: cl, item: it, log: KINDS[it.kind] + ': ' + it.sku + ' × ' + it.qty + ' (' + PARTS[it.part].toLowerCase() + ')' + (it.house ? ' · ' + it.house : '') + (it.blocks ? ', stops assembly' : '') + '. On claim ' + cl.number + ' for WC order ' + xo.number + '. By ' + ctx.by + '.' };
  }
  function removeIssue(job, claimId, itemId, ctx) {
    var cl = (job.claims || []).filter(function (q) { return q.id === claimId; })[0];
    if (!cl || cl.status !== 'draft') return { ok: false, error: 'Only a draft claim can be changed.' };
    var x = clone(job), xc = x.claims.filter(function (q) { return q.id === claimId; })[0], it = xc.items.filter(function (i) { return i.id === itemId; })[0];
    if (!it) return { ok: false, error: 'That item isn\'t on the claim.' };
    it.removed = { by: ctx.by, on: ctx.today || null };   // kept on file, not deleted
    return { ok: true, job: x, log: it.sku + ' taken off draft claim ' + xc.number + ' by ' + ctx.by + '.' };
  }
  function items(cl) { return (cl.items || []).filter(function (i) { return !i.removed; }); }
  /* Filed in the Wholesale Cabinets account or emailed to their inbox. */
  function submit(job, claimId, input, ctx) {
    input = input || {}; var cl = (job.claims || []).filter(function (q) { return q.id === claimId; })[0];
    if (!cl || cl.status !== 'draft') return { ok: false, error: 'That claim isn\'t a draft.' };
    if (!items(cl).length) return { ok: false, error: 'Add at least one damaged, missing or wrong item.' };
    if (input.via !== 'portal' && input.via !== 'email') return { ok: false, error: 'Filed in the Wholesale Cabinets account, or emailed?' };
    var x = clone(job), xc = x.claims.filter(function (q) { return q.id === claimId; })[0];
    xc.status = 'submitted'; xc.submittedOn = (ctx && ctx.today) || null; xc.via = input.via; xc.ref = blank(input.ref) ? null : String(input.ref).trim();
    return { ok: true, job: x, log: 'Claim ' + xc.number + ' (' + items(xc).length + ' item' + (items(xc).length > 1 ? 's' : '') + ') submitted ' + (input.via === 'portal' ? 'in the Wholesale Cabinets account' : 'by email') + (xc.ref ? ', reference ' + xc.ref : '') + ' by ' + ctx.by + '.' };
  }
  function close(job, claimId, input, ctx) {
    input = input || {}; var cl = (job.claims || []).filter(function (q) { return q.id === claimId; })[0];
    if (!cl || OPEN.indexOf(cl.status) < 0 || cl.status === 'draft') return { ok: false, error: 'Submit the claim before closing it.' };
    var outcome = input.outcome || 'closed'; if (['closed', 'denied', 'credit_only'].indexOf(outcome) < 0) return { ok: false, error: 'How did it end?' };
    var cr = input.creditCents != null && input.creditCents !== '' ? Math.round(+input.creditCents) : null;
    if (outcome === 'credit_only' && !(cr > 0)) return { ok: false, error: 'Enter the credit amount.' };
    if (outcome === 'denied' && blank(input.note)) return { ok: false, error: 'Say why it was denied.' };
    var x = clone(job), xc = x.claims.filter(function (q) { return q.id === claimId; })[0];
    xc.status = outcome; xc.closedOn = (ctx && ctx.today) || null; xc.creditCents = cr; if (!blank(input.note)) xc.notes = String(input.note).trim();
    return { ok: true, job: x, log: 'Claim ' + xc.number + ' ' + (outcome === 'denied' ? 'denied' : outcome === 'credit_only' ? 'closed with a credit' : 'closed') + (cr ? ' (credit ' + (cr / 100).toFixed(2) + ')' : '') + ' by ' + ctx.by + '.' };
  }
  function openClaims(job) { return (job.claims || []).filter(function (q) { return OPEN.indexOf(q.status) >= 0 && (q.status !== 'draft' || items(q).length); }); }
  function blocked(job) { var out = {}; openClaims(job).forEach(function (q) { items(q).forEach(function (i) { if (i.blocks) out[i.house || 'whole job'] = true; }); }); return Object.keys(out); }

  /* ---------- one status line, and the next step ---------- */
  function shipments(job) { var out = []; (job.supplierOrders || []).forEach(function (o) { o.shipments.forEach(function (s) { out.push({ o: o, s: s }); }); }); return out; }
  function inspected(o, s, houses) {
    if (s.okHouses.all) return true;
    if (houses && houses.length && houses.every(function (h) { return s.okHouses[h]; })) return true;
    var lines = shipmentLines(o, s); return lines.length > 0 && lines.every(function (l) { return s.okLines[l.sku]; });
  }
  /* { text, tone ('info'|'good'|'warn'|'alert'), next: { text, tab, receive? } | null } or null when there's nothing to show. */
  function status(job, today, settings) {
    var A = ['deposit_paid', 'factory_ordered', 'delivered', 'final_paid', 'complete'];
    if (A.indexOf(job.stage) < 0 && !(job.supplierOrders || []).length) return null;
    var orders = job.supplierOrders || [], sh = shipments(job), houses = (job.houses || []).map(function (h) { return h.name; });
    var drafts = (job.claims || []).filter(function (q) { return q.status === 'draft' && items(q).length; }), open = openClaims(job).filter(function (q) { return q.status !== 'draft'; });
    var toInspect = sh.filter(function (x) { return x.s.receivedOn && !inspected(x.o, x.s, houses); }).sort(function (a, b) { return a.s.deadline < b.s.deadline ? -1 : 1; })[0];
    var moving = sh.filter(function (x) { return !x.s.receivedOn; });
    var dl = function (d) { var n = today ? daysBetween(today, d) : null; return n == null ? '' : n < 0 ? ' (' + (-n) + ' day' + (n === -1 ? '' : 's') + ' late)' : n === 0 ? ' (today)' : ' (' + n + ' day' + (n === 1 ? '' : 's') + ' left)'; };
    if (drafts.length) {
      var cd = earliestDeadline(job, drafts[0]);
      return { text: items(drafts[0]).length + ' item' + (items(drafts[0]).length > 1 ? 's' : '') + ' to claim' + (cd ? ' · submit by ' + nice(cd) + dl(cd) : ''), tone: cd && today && daysBetween(today, cd) <= 1 ? 'alert' : 'warn', next: { text: 'Submit claim ' + drafts[0].number + ' to Wholesale Cabinets', tab: 'shipping' } };
    }
    if (toInspect) return { text: 'At the shop since ' + nice(toInspect.s.receivedOn) + ' · inspect by ' + nice(toInspect.s.deadline) + dl(toInspect.s.deadline), tone: today && daysBetween(today, toInspect.s.deadline) <= 2 ? 'alert' : 'warn', next: { text: 'Finish inspecting the delivery', tab: 'shipping', receive: { order: toInspect.o.id, ship: toInspect.s.id } } };
    if (moving.length) { var m = moving[0]; return { text: 'In transit · ' + m.s.carrier + ' ' + (m.s.trackKind === 'pro' ? 'PRO ' : '#') + m.s.trackNo + (moving.length > 1 ? ' · +' + (moving.length - 1) + ' more' : ''), tone: 'info', next: { text: 'Receive the shipment when it arrives', tab: 'shipping', receive: { order: m.o.id, ship: m.s.id } } }; }
    if (open.length) { var b = blocked(job); return { text: open.length + ' open claim' + (open.length > 1 ? 's' : '') + ' · ' + CLAIM_STATUS[open[0].status].toLowerCase() + (b.length ? ' · blocked: ' + b.join(', ') : ''), tone: 'warn', next: open[0].status === 'replacement_received' ? { text: 'Close claim ' + open[0].number, tab: 'shipping' } : null }; }
    var waiting = orders.filter(function (o) { return !o.shipments.length; });
    if (waiting.length) return { text: 'Ordered from Wholesale Cabinets · ' + waiting.map(function (o) { return '#' + o.number + (o.estShip ? ' ships about ' + nice(o.estShip) : ''); }).join(', '), tone: 'info', next: { text: 'Add the shipment when the tracking email comes', tab: 'shipping' } };
    if (sh.length) return { text: 'Received and inspected · ready to deliver', tone: 'good', next: null };
    if (job.stage === 'deposit_paid') return { text: 'No Wholesale Cabinets order recorded yet', tone: 'warn', next: { text: 'Record the Wholesale Cabinets order', tab: 'shipping' } };
    return null;
  }
  function earliestDeadline(job, cl) {
    var o = (job.supplierOrders || []).filter(function (q) { return q.id === cl.orderId; })[0]; if (!o) return null;
    var d = o.shipments.map(function (s) { return s.deadline; }).filter(Boolean).sort()[0]; return d || null;
  }

  /* Needs attention / Today: [{ kind, text, tab, tone }]. */
  function attention(job, today, settings) {
    var out = [], st = settings || SETTINGS, houses = (job.houses || []).map(function (h) { return h.name; });
    if (job.testVoid || job.designTemplate) return out;
    if (job.stage === 'deposit_paid' && !(job.supplierOrders || []).length) {
      var dep = (job.history || []).filter(function (h) { return h.to === 'deposit_paid'; }).pop();
      if (dep && dep.date && today && daysBetween(dep.date, today) >= (st.orderReminderDays || 3)) out.push({ kind: 'order', tone: 'alert', text: 'Deposit paid ' + nice(dep.date) + ', no Wholesale Cabinets order recorded', tab: 'shipping' });
    }
    (job.supplierOrders || []).forEach(function (o) {
      if (o.shipTo && !knownShipTo(o.shipTo, st)) out.push({ kind: 'shipto', tone: 'alert', text: 'WC order ' + o.number + ' ships to ' + o.shipTo.street + ', not the shop or College Ave', tab: 'shipping' });
      o.shipments.forEach(function (s) {
        if (s.receivedOn && !inspected(o, s, houses) && s.deadline && today && daysBetween(today, s.deadline) <= 2) out.push({ kind: 'inspect', tone: 'alert', text: 'Inspect WC order ' + o.number + ' by ' + nice(s.deadline) + ' (5-day claim window)', tab: 'shipping' });
      });
    });
    (job.claims || []).forEach(function (q) { if (q.status === 'draft' && items(q).length) { var d = earliestDeadline(job, q); out.push({ kind: 'claim', tone: d && today && daysBetween(today, d) <= 2 ? 'alert' : 'check', text: 'Claim ' + q.number + ' not submitted' + (d ? ' (due ' + nice(d) + ')' : ''), tab: 'shipping' }); } });
    blocked(job).forEach(function (h) { out.push({ kind: 'blocked', tone: 'alert', text: h + ' is blocked, waiting on a replacement part', tab: 'shipping' }); });
    return out;
  }

  /* The close-out check: no open claims. */
  function closeBlocker(job) { var o = openClaims(job); return o.length ? 'Claim ' + o.map(function (q) { return q.number; }).join(', ') + ' is still open. Close it on the Shipping tab first.' : null; }

  return { VERSION: VERSION, SETTINGS: SETTINGS, KINDS: KINDS, PARTS: PARTS, CLAIM_STATUS: CLAIM_STATUS, readEmail: readEmail, kind: kind, parseOrder: parseOrder, parseShipment: parseShipment, trackUrl: trackUrl,
    base: base, check: check, knownShipTo: knownShipTo, shipmentLines: shipmentLines, addOrder: addOrder, findOrder: findOrder, addShipment: addShipment, receive: receive, markOk: markOk, markLine: markLine,
    addIssue: addIssue, removeIssue: removeIssue, items: items, submit: submit, close: close, openClaims: openClaims, blocked: blocked, inspected: inspected, status: status, attention: attention,
    closeBlocker: closeBlocker, earliestDeadline: earliestDeadline, addDays: addDays, nice: nice };
}));
