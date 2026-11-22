/*
 * Phase 2 preview · Shipping, receiving and damage claims (window.P2Ship). Uses FMShipping. HANDOFF §45.
 *   Job → Shipping tab: Wholesale Cabinets orders and shipments (drop in or paste the emails), receiving at the shop with the
 *   5-day inspection window, and claims (one per order) with a printable claim packet and an email draft to Wholesale Cabinets.
 *   #/shipping: everything arriving, to inspect, and open claims, across jobs, plus a box to paste any WC email.
 *   #/receive/<job>/<order>/<shipment>: the receiving screen (the QR code on the printed receiving checklist goes here).
 */
(function () {
  'use strict';
  var SH = window.FMShipping, FM = window.FMPhase1;
  function U(c) { return c.ui.sh || (c.ui.sh = {}); }
  function cfg(c) { var s = c.store.settings ? c.store.settings() : {}; return Object.assign({}, SH.SETTINGS, s.shipping || {}); }
  function jobNow(c) { var h = location.hash.replace(/^#\/?/, '').split('/'); return h[0] === 'job' ? c.store.job(decodeURIComponent(h[1] || '')) : null; }
  function put(c, j, res) { if (!res.ok) return false; c.store.update(j.jobCode, function () { return res.job; }, res.log || null, c.me().name); return true; }
  function nice(d) { return SH.nice(d); }
  function daysLeft(c, d) { var n = Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(c.TODAY + 'T12:00:00Z')) / 86400000); return n; }

  /* what was sold, by house when the job has houses: [{ sku, qty, house }] */
  function soldLines(c, j) {
    if (c.W && j.jobCode === c.W.jobCode) { var out = []; j.houses.forEach(function (h) { (c.W.models[h.model].lines || []).forEach(function (l) { out.push({ sku: l.sku, qty: l.qty, house: h.name }); }); }); return out; }
    if (c.B && j.jobCode === c.B.jobCode) return c.B.model.lines.map(function (l) { return { sku: l.sku, qty: l.qty }; });
    var o = []; (j.models || []).forEach(function (m) { (m.lines || []).forEach(function (l) { for (var k = 0; k < (m.qty || 1); k++) o.push({ sku: l.sku, qty: l.qty, house: m.qty > 1 ? m.name + ' ' + (k + 1) : null }); }); }); return o;
  }
  function houses(j) { return (j.houses || []).map(function (h) { return h.name; }); }

  /* ---------- reading a dropped or pasted email ---------- */
  function readInto(c, text, scope) {
    var u = U(c), em = SH.readEmail(text), k = SH.kind(em);
    u.read = { scope: scope, kind: k, email: em };
    if (k === 'order') u.read.r = SH.parseOrder(em); else if (k === 'shipment') u.read.r = SH.parseShipment(em);
    else u.read.r = { ok: false, problems: ['This doesn\'t look like a Wholesale Cabinets order confirmation or shipment update. Type it in below instead.'] };
    if (u.read.r.ok && k === 'order') u.read.houses = null;   // default: all houses
    c.render();
  }
  function dropZone(c, scope) {
    var u = U(c), esc = c.esc;
    return '<div class="sh-drop" data-shdrop="' + scope + '"><b>Drop the Wholesale Cabinets email here</b><span class="p2-small fmp1-muted">The order confirmation or the shipment update (.eml from your mail app), or paste it below. Card details in the email are never saved.</span>' +
      '<label class="fmp1-btn p2-filebtn">Choose the email<input type="file" accept=".eml,.txt,.html,.htm,message/rfc822" data-shfile="' + scope + '"></label>' +
      '<textarea class="fmp1-input" rows="3" data-shpaste="' + scope + '" placeholder="…or paste the email text here">' + esc(u.paste || '') + '</textarea>' +
      '<button class="fmp1-btn" data-shread="' + scope + '">Read it</button></div>';
  }
  /* the result of reading an email, for one job (j) or for the shop-wide page (j null: pick the job) */
  function readResult(c, j) {
    var u = U(c), R = u.read, esc = c.esc, $f = c.money; if (!R) return '';
    if (!R.r.ok) return '<div class="fmp1-note fmp1-note--alert p2-small" role="alert"><span>' + esc(R.r.problems.join(' ')) + '</span></div>';
    var warn = R.r.problems.length ? '<div class="fmp1-note fmp1-note--alert p2-small"><span>' + esc(R.r.problems.join(' ')) + '</span></div>' : '';
    if (R.kind === 'order') {
      var o = R.r.order, known = SH.knownShipTo(o.shipTo, cfg(c)), ck = j ? SH.check(o.lines, soldLines(c, j)) : null;
      var target = j || (u.pickJob ? c.store.job(u.pickJob) : null);
      var hs = target ? houses(target) : [];
      var lines = o.lines.map(function (l, i) { var m = ck && ck.lines[i]; return '<tr><td><b>' + esc(l.sku) + '</b> <span class="p2-small fmp1-muted">' + esc(l.item) + '</span></td><td class="r">' + l.qty + '</td><td class="r">' + $f(l.subtotalCents) + '</td><td>' + (ck ? (m.matched ? '<span class="p2-ok">✓ on the quote</span>' : '<span class="sh-warn">not on the quote</span>') : '') + '</td></tr>'; }).join('');
      var diffs = ck ? ck.soldNotOrdered.map(function (x) { return 'Sold, not on this order: ' + x.sku + ' × ' + x.qty; }).concat(ck.qtyDiff.map(function (x) { return x.sku + ': sold ' + x.sold + ', ordered ' + x.ordered; })) : [];
      var claims = target ? (target.claims || []).filter(function (q) { return q.status === 'submitted' || q.status === 'draft'; }) : [];
      return '<div class="sh-read"><span class="fmp1-eyebrow">Order confirmation</span>' + warn +
        '<ul class="p2-list p2-small"><li><span>WC order #</span><b>' + esc(o.number) + '</b></li><li><span>Placed</span><b>' + esc(nice(o.placedOn) || '—') + '</b></li><li><span>Estimated ship date</span><b>' + esc(nice(o.estShip) || '—') + '</b></li>' +
        '<li><span>Ships to</span><b>' + (o.shipTo ? esc(o.shipTo.street + ', ' + o.shipTo.city) + (known ? ' <span class="p2-ok">✓ ' + esc(known.label) + '</span>' : ' <span class="sh-warn">not the shop or College Ave</span>') : '—') + '</b></li>' +
        '<li><span>Total</span><b>' + (o.totalCents != null ? $f(o.totalCents) : '—') + '</b></li></ul>' +
        '<div class="fmp1-table-wrap"><table class="fmp1-table p2-table"><thead><tr><th>SKU</th><th class="r">Qty</th><th class="r">Subtotal</th><th></th></tr></thead><tbody>' + lines + '</tbody></table></div>' +
        (diffs.length ? '<details class="p2-small"><summary>' + diffs.length + ' difference' + (diffs.length > 1 ? 's' : '') + ' from what was sold (a warning; orders often come in parts)</summary><ul>' + diffs.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></details>' : (ck && o.lines.length ? '<p class="p2-small p2-ok">✓ Matches what was sold.</p>' : '')) +
        (j ? '' : '<label class="p2-fld"><span>Which job?</span><select class="fmp1-input" data-shpick><option value="">Choose…</option>' + c.store.jobs().filter(function (x) { return x.stage !== 'quote' && x.stage !== 'lost'; }).map(function (x) { return '<option value="' + esc(x.jobCode) + '"' + (u.pickJob === x.jobCode ? ' selected' : '') + '>' + esc(x.customer + ' · ' + x.jobCode) + '</option>'; }).join('') + '</select></label>') +
        (hs.length ? '<fieldset class="sh-houses"><legend class="p2-small">Houses on this order</legend>' + hs.map(function (h) { return '<label class="p2-small"><input type="checkbox" data-shhouse="' + esc(h) + '"' + (!R.houses || R.houses.indexOf(h) >= 0 ? ' checked' : '') + '> ' + esc(h) + '</label>'; }).join('') + '</fieldset>' : '') +
        '<label class="p2-fld"><span>What it\'s for</span><select class="fmp1-input" data-shkind><option value="original"' + (u.okind !== 'change_order' && u.okind !== 'replacement' ? ' selected' : '') + '>The job\'s cabinets</option><option value="change_order"' + (u.okind === 'change_order' ? ' selected' : '') + '>A change order</option>' +
          (claims.length ? '<option value="replacement"' + (u.okind === 'replacement' ? ' selected' : '') + '>Replacement for claim ' + claims[0].number + '</option>' : '') + '</select></label>' +
        '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-shsaveorder' + (target ? '' : ' disabled') + '>Save the order</button><button class="fmp1-btn fmp1-btn--quiet" data-shclear>Cancel</button></div>' + err(c) + '</div>';
    }
    var s = R.r.shipment, home = j && SH.findOrder(j, s.orderNumber) ? j : c.store.jobs({ all: true }).filter(function (x) { return SH.findOrder(x, s.orderNumber); })[0];
    return '<div class="sh-read"><span class="fmp1-eyebrow">Shipment update</span>' + warn +
      '<ul class="p2-list p2-small"><li><span>WC order #</span><b>' + esc(s.orderNumber) + (home ? ' · ' + esc(home.customer) : ' <span class="sh-warn">not recorded on any job yet</span>') + '</b></li>' + (s.number ? '<li><span>Shipment #</span><b>' + esc(s.number) + '</b></li>' : '') +
      '<li><span>Carrier</span><b>' + esc(s.carrier || '—') + ' · ' + (s.trackKind === 'pro' ? 'PRO ' : 'tracking ') + esc(s.trackNo || '—') + '</b></li>' + (s.scope ? '<li><span>Items</span><b>The ' + esc(s.scope) + ' items (an order can ship in parts)</b></li>' : '') +
      (s.schedulePhone ? '<li><span>Schedule delivery</span><b>Call ' + esc(s.carrier) + ' at ' + esc(s.schedulePhone) + '</b></li>' : '') + '</ul>' +
      (home ? '<div class="p2-row"><button class="fmp1-btn fmp1-btn--primary" data-shsaveship="' + esc(home.jobCode) + '">Save the shipment' + (j && home.jobCode === j.jobCode ? '' : ' on ' + esc(home.customer)) + '</button><button class="fmp1-btn fmp1-btn--quiet" data-shclear>Cancel</button></div>'
        : '<p class="p2-small">Record order ' + esc(s.orderNumber) + ' on its job first (drop in the order confirmation, or type the order # on the job\'s Shipping tab), then add this again.</p>') + err(c) + '</div>';
  }
  function err(c) { var u = U(c); return u.err ? '<p class="p2-small" role="alert" style="color:var(--fmp1-alert-ink)">' + c.esc(u.err) + '</p>' : ''; }

  /* ---------- the job's Shipping tab ---------- */
  function statusBanner(c, j) {
    var st = SH.status(j, c.TODAY, cfg(c)); if (!st) return '';
    var nx = st.next, btn = nx ? (nx.receive ? '<button class="fmp1-btn fmp1-btn--primary" data-shrecv="' + c.esc(nx.receive.order + '|' + nx.receive.ship) + '">' + c.esc(nx.text) + '</button>' : '<span class="p2-small"><b>Next:</b> ' + c.esc(nx.text) + '</span>') : '';
    return '<div class="sh-status is-' + st.tone + '"><b>' + c.esc(st.text) + '</b>' + btn + '</div>';
  }
  function tab(c, j) {
    var u = U(c), esc = c.esc, $f = c.money;
    if (u.rcv && u.rcv.job === j.jobCode) return receiveView(c, j);
    var orders = j.supplierOrders || [], claims = j.claims || [];
    var add = u.adding === j.jobCode ? '<div class="fmp1-card p2-pad">' + (u.read ? readResult(c, j) : dropZone(c, 'job') + '<details class="sh-type"' + (u.typeOpen ? ' open' : '') + '><summary class="p2-small"><b>Or type it in</b></summary>' + typeForm(c, j) + '</details>' + err(c)) + '</div>' : '';
    var list = orders.map(function (o) { return orderCard(c, j, o); }).join('');
    var cl = claims.length ? '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Claims to Wholesale Cabinets · ' + claims.length + '</span>' + (orders.length ? '<button class="fmp1-btn" data-shissue="">Report damage or a missing item</button>' : '') + '</div>' + claims.slice().reverse().map(function (q) { return claimCard(c, j, q); }).join('') + '</div>'
      : orders.length ? '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Claims</span><button class="fmp1-btn" data-shissue="">Report damage or a missing item</button></div><p class="p2-small fmp1-muted">No damage or missing items reported. Found something during assembly? Report it here; it goes on one claim per order, so all replacements ship together.</p></div>' : '';
    return statusBanner(c, j) + '<div class="fmp1-card p2-pad"><div class="p2-between"><span class="fmp1-eyebrow">Wholesale Cabinets orders · ' + orders.length + '</span>' + (u.adding === j.jobCode ? '' : '<button class="fmp1-btn fmp1-btn--primary" data-shadd>+ Add an order or shipment</button>') + '</div>' +
      (orders.length ? '' : '<p class="p2-small fmp1-muted">When you order from Wholesale Cabinets, drop the confirmation email here. When the tracking email comes, drop that in too. Everything about this job\'s delivery stays on this tab.</p>') + '</div>' +
      issueSheet(c, j) + add + list + cl;
  }
  function typeForm(c, j) {
    var u = U(c), esc = c.esc, T = u.type || {}, orders = j.supplierOrders || [];
    return '<div class="p2-form"><label class="p2-fld"><span>WC order #</span><input class="fmp1-input" inputmode="numeric" data-shtf="order" value="' + esc(T.order || '') + '" placeholder="1000174448"></label><button class="fmp1-btn" data-shtypeorder>Save the order</button></div>' +
      (orders.length ? '<div class="p2-form"><label class="p2-fld"><span>Shipment for</span><select class="fmp1-input" data-shtf="sorder">' + orders.map(function (o) { return '<option value="' + esc(o.number) + '"' + (T.sorder === o.number ? ' selected' : '') + '>#' + esc(o.number) + '</option>'; }).join('') + '</select></label>' +
        '<label class="p2-fld"><span>Carrier</span><input class="fmp1-input" data-shtf="carrier" value="' + esc(T.carrier || '') + '" placeholder="FedEx, Old Dominion…"></label><label class="p2-fld"><span>Tracking or PRO #</span><input class="fmp1-input" data-shtf="track" value="' + esc(T.track || '') + '"></label>' +
        '<button class="fmp1-btn" data-shtypeship>Save the shipment</button></div>' : '');
  }
  function orderCard(c, j, o) {
    var esc = c.esc, $f = c.money, known = SH.knownShipTo(o.shipTo, cfg(c));
    var ships = o.shipments.map(function (s) {
      var url = SH.trackUrl(s), insp = s.receivedOn && SH.inspected(o, s, houses(j)), dl = s.deadline ? daysLeft(c, s.deadline) : null;
      return '<li class="sh-ship"><span><b>' + esc(s.carrier) + '</b> ' + (s.trackKind === 'pro' ? 'PRO ' : '#') + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(s.trackNo) + '</a>' : esc(s.trackNo)) + (s.scope ? ' · the ' + esc(s.scope) + ' items' : '') + (s.number ? ' <span class="p2-small fmp1-faint">shipment ' + esc(s.number) + '</span>' : '') +
        '<br><span class="p2-small">' + (s.receivedOn ? 'Received ' + esc(nice(s.receivedOn)) + ' by ' + esc(s.receivedBy) + (s.exception ? ' · BOL exception ' + esc(s.exception) : '') + (insp ? ' · <span class="p2-ok">✓ inspected</span>' : ' · <b class="' + (dl <= 2 ? 'sh-warn' : '') + '">inspect by ' + esc(nice(s.deadline)) + (dl < 0 ? ' (late)' : dl === 0 ? ' (today)' : ' (' + dl + ' day' + (dl === 1 ? '' : 's') + ' left)') + '</b>') : 'Shipped' + (s.shippedOn ? ' ' + esc(nice(s.shippedOn)) : '') + (s.schedulePhone ? ' · call ' + esc(s.carrier) + ' at ' + esc(s.schedulePhone) + ' to schedule' : '')) + '</span></span>' +
        '<span class="p2-row p2-wrap"><button class="fmp1-btn' + (!s.receivedOn || !insp ? ' fmp1-btn--primary' : ' fmp1-btn--quiet') + '" data-shrecv="' + esc(o.id + '|' + s.id) + '">' + (!s.receivedOn ? 'Receive it' : insp ? 'Open' : 'Inspect') + '</button><button class="fmp1-btn fmp1-btn--quiet" data-shprint="' + esc(o.id + '|' + s.id) + '">Print checklist</button></span></li>';
    }).join('');
    return '<div class="fmp1-card p2-pad sh-order"><div class="p2-between"><span><b>WC order #' + esc(o.number) + '</b>' + (o.kind === 'replacement' ? ' <span class="fmp1-pill">replacement</span>' : o.kind === 'change_order' ? ' <span class="fmp1-pill">change order</span>' : '') + '<br><span class="p2-small fmp1-muted">' +
      (o.placedOn ? 'Placed ' + esc(nice(o.placedOn)) : '') + (o.estShip ? ' · ships about ' + esc(nice(o.estShip)) : '') + (o.lines.length ? ' · ' + o.lines.length + ' line' + (o.lines.length > 1 ? 's' : '') : '') + (o.totalCents != null ? ' · ' + $f(o.totalCents) : '') + (o.houses && o.houses.length ? ' · ' + esc(o.houses.length === houses(j).length ? 'all houses' : o.houses.join(', ')) : '') + '</span></span>' +
      (o.shipTo ? '<span class="p2-small">' + (known ? esc(known.label) : '<b class="sh-warn">Ships to ' + esc(o.shipTo.street) + '</b>') + '</span>' : '') + '</div>' +
      (o.lines.length ? '<details class="p2-small"><summary>Lines</summary><ul class="sh-lines">' + o.lines.map(function (l) { return '<li><b>' + esc(l.sku) + '</b> × ' + l.qty + ' <span class="fmp1-muted">' + esc(l.item) + '</span></li>'; }).join('') + '</ul></details>' : '') +
      (ships ? '<ul class="sh-ships">' + ships + '</ul>' : '<p class="p2-small fmp1-muted">No shipment yet. The tracking email usually comes the evening it ships (about 7 PM Eastern).</p>') + '</div>';
  }
  function claimCard(c, j, q) {
    var esc = c.esc, u = U(c), o = (j.supplierOrders || []).filter(function (x) { return x.id === q.orderId; })[0] || {}, its = SH.items(q), d = SH.earliestDeadline(j, q), dl = d ? daysLeft(c, d) : null;
    var rows = its.map(function (i) { return '<li><span><b>' + esc(i.sku) + '</b> × ' + i.qty + ' · ' + esc(SH.KINDS[i.kind]) + ' · ' + esc(SH.PARTS[i.part].toLowerCase()) + (i.house ? ' · ' + esc(i.house) : '') + (i.blocks ? ' · <b class="sh-warn">stops assembly</b>' : '') + (i.note ? '<br><span class="p2-small fmp1-muted">' + esc(i.note) + '</span>' : '') + '</span><span class="p2-small">' + (i.photos.length ? i.photos.length + ' photo' + (i.photos.length > 1 ? 's' : '') : '') + (q.status === 'draft' ? ' <button class="p2-linkbtn" data-shrmitem="' + esc(q.id + '|' + i.id) + '">Remove</button>' : '') + '</span></li>'; }).join('');
    var acts = '';
    if (q.status === 'draft') acts = (u.submit === q.id ? '<div class="p2-form"><label class="p2-fld"><span>How it was filed</span><select class="fmp1-input" data-shsub="via"><option value="email">Emailed to ' + esc(cfg(c).claimsEmail) + '</option><option value="portal">Filed in the Wholesale Cabinets account</option></select></label><label class="p2-fld"><span>Their claim # (if they gave one)</span><input class="fmp1-input" data-shsub="ref"></label><button class="fmp1-btn fmp1-btn--primary" data-shsubmitgo="' + esc(q.id) + '">Mark submitted</button><button class="fmp1-btn fmp1-btn--quiet" data-shsubmit="">Cancel</button></div>'
      : '<span class="p2-row p2-wrap"><button class="fmp1-btn fmp1-btn--primary" data-shpacket="' + esc(q.id) + '"' + (its.length ? '' : ' disabled') + '>Print the claim packet</button><a class="fmp1-btn" href="' + esc(claimMail(c, j, q).mailto) + '" target="_blank" rel="noopener">Email it to Wholesale Cabinets</a><button class="fmp1-btn" data-shsubmit="' + esc(q.id) + '"' + (its.length ? '' : ' disabled') + '>Mark submitted</button></span>' +
        '<p class="p2-small fmp1-faint">Attach the packet PDF and the photos (and the BOL with the exception #, if there is one). Nothing goes out until you send it.</p>');
    else if (q.status !== 'closed' && q.status !== 'denied' && q.status !== 'credit_only') acts = u.closing === q.id ? '<div class="p2-form"><label class="p2-fld"><span>How it ended</span><select class="fmp1-input" data-shcl="outcome"><option value="closed">Replacements received</option><option value="credit_only">A credit instead</option><option value="denied">Denied</option></select></label><label class="p2-fld"><span>Credit ($, if any)</span><input class="fmp1-input" inputmode="decimal" data-shcl="credit"></label><label class="p2-fld"><span>Note</span><input class="fmp1-input" data-shcl="note"></label><button class="fmp1-btn fmp1-btn--primary" data-shclosego="' + esc(q.id) + '">Close the claim</button><button class="fmp1-btn fmp1-btn--quiet" data-shclose="">Cancel</button></div>'
      : '<span class="p2-row p2-wrap"><button class="fmp1-btn' + (q.status === 'replacement_received' ? ' fmp1-btn--primary' : '') + '" data-shclose="' + esc(q.id) + '">Close the claim</button><button class="fmp1-btn fmp1-btn--quiet" data-shpacket="' + esc(q.id) + '">Open the packet</button></span><p class="p2-small fmp1-faint">When the replacement order\'s confirmation comes, add it here as "Replacement for claim ' + q.number + '"; its shipment and receiving work the same way.</p>';
    return '<div class="sh-claim"><div class="p2-between"><b>Claim ' + q.number + ' · WC order #' + esc(o.number || '') + '</b><span class="fmp1-pill">' + esc(SH.CLAIM_STATUS[q.status]) + '</span></div>' +
      '<span class="p2-small">' + (q.status === 'draft' ? (d ? '<b class="' + (dl <= 2 ? 'sh-warn' : '') + '">Submit by ' + esc(nice(d)) + (dl < 0 ? ' (past the 5-day window: submit anyway)' : dl === 0 ? ' (today)' : ' (' + dl + ' day' + (dl === 1 ? '' : 's') + ' left)') + '</b>' : '') + (dl != null && dl <= 1 && dl >= 0 ? ' · Submit now; anything found later goes on a follow-up claim.' : '') : 'Submitted ' + esc(nice(q.submittedOn)) + (q.ref ? ' · their # ' + esc(q.ref) : '') + (q.creditCents ? ' · credit ' + c.money(q.creditCents) : '') + (q.notes ? ' · ' + esc(q.notes) : '')) + (q.exception ? ' · BOL exception ' + esc(q.exception) : '') + '</span>' +
      (rows ? '<ul class="p2-list">' + rows + '</ul>' : '<p class="p2-small fmp1-muted">Nothing on it yet.</p>') + acts + '</div>';
  }
  function claimMail(c, j, q) {
    var o = (j.supplierOrders || []).filter(function (x) { return x.id === q.orderId; })[0] || {}, sh = (o.shipments || [])[0] || {}, to = cfg(c).claimsEmail;
    var subject = 'Damage claim · Order #' + (o.number || '') + ' · Fremont Makers LLC';
    var body = ['Hello,', '', 'We need to file a claim on order #' + (o.number || '') + (sh.number ? ', shipment ' + sh.number : '') + (sh.receivedOn ? ', received ' + c.longDate(sh.receivedOn) : '') + '.' + (q.exception ? ' The BOL exception number is ' + q.exception + '.' : ''), '', 'Items:']
      .concat(SH.items(q).map(function (i) { return '- ' + i.sku + ' × ' + i.qty + ': ' + SH.KINDS[i.kind].toLowerCase() + ', ' + SH.PARTS[i.part].toLowerCase() + (i.note ? ' (' + i.note + ')' : ''); }))
      .concat(['', 'The claim packet and photos are attached' + (q.exception ? ', with the BOL' : '') + '. Please ship all the replacements together.', '', 'Ship to: Fremont Makers LLC, 719 Main St, Cañon City, CO 81212.', '', 'Thank you,', c.me().name + ', Fremont Makers']).join('\n');
    return { to: to, subject: subject, body: body, mailto: 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }

  /* ---------- report damage, missing or wrong (receiving, assembly, install) ---------- */
  function issueSheet(c, j) {
    var u = U(c), I = u.issue; if (!I || I.job !== j.jobCode) return '';
    var esc = c.esc, orders = j.supplierOrders || [], o = orders.filter(function (x) { return x.id === I.orderId; })[0] || orders[orders.length - 1], hs = houses(j);
    if (!I.orderId && o) I.orderId = o.id;
    var chip = function (attr, val, label, on) { return '<button class="fmp1-btn" data-' + attr + '="' + esc(val) + '" aria-pressed="' + !!on + '">' + esc(label) + '</button>'; };
    var dmg = /damage/.test(I.kind || '');
    return '<div class="fmp1-card p2-pad sh-sheet" data-shsheet><div class="p2-between"><b>Report a problem</b><button class="fmp1-btn fmp1-btn--quiet" data-shissuecancel>Cancel</button></div>' +
      (orders.length > 1 ? '<label class="p2-fld"><span>WC order</span><select class="fmp1-input" data-shif="orderId">' + orders.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === I.orderId ? ' selected' : '') + '>#' + esc(x.number) + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="p2-chips" role="group" aria-label="What\'s wrong">' + [['hidden_damage', 'Damaged'], ['missing', 'Missing'], ['wrong_item', 'Wrong item'], ['visible_damage', 'Box damaged at the truck']].map(function (k) { return chip('shik', k[0], k[1], I.kind === k[0]); }).join('') + '</div>' +
      '<label class="p2-fld"><span>Cabinet or part (SKU)</span><input class="fmp1-input" list="sh-skus" data-shif="sku" value="' + esc(I.sku || '') + '" placeholder="W3042-SBW"><datalist id="sh-skus">' + (o ? o.lines.map(function (l) { return '<option value="' + esc(l.sku) + '">' + esc(l.item) + '</option>'; }).join('') : '') + '</datalist></label>' +
      '<div class="p2-chips" role="group" aria-label="Which part">' + Object.keys(SH.PARTS).map(function (k) { return chip('ship', k, SH.PARTS[k], I.part === k); }).join('') + '</div>' +
      '<div class="p2-form"><label class="p2-fld" style="max-width:110px"><span>How many</span><input class="fmp1-input" inputmode="numeric" data-shif="qty" value="' + esc(I.qty || '1') + '"></label>' +
        (hs.length ? '<label class="p2-fld"><span>House</span><select class="fmp1-input" data-shif="house"><option value="">—</option>' + hs.map(function (h) { return '<option' + (I.house === h ? ' selected' : '') + '>' + esc(h) + '</option>'; }).join('') + '</select></label>' : '') +
        '<label class="p2-fld"><span>Does it stop assembly?</span><select class="fmp1-input" data-shif="blocks"><option value="">' + (I.part === 'door' || I.part === 'drawer' ? 'No (doors and drawers can be replaced later)' : 'Choose…') + '</option><option value="no"' + (I.blocks === 'no' ? ' selected' : '') + '>No, keep going</option><option value="yes"' + (I.blocks === 'yes' ? ' selected' : '') + '>Yes, skip to the next cabinet</option></select></label></div>' +
      '<label class="fmp1-btn p2-filebtn sh-cam">' + (I.photos && I.photos.length ? '📷 ' + I.photos.length + ' photo' + (I.photos.length > 1 ? 's' : '') + ' · add another' : '📷 Take a photo' + (dmg ? ' (required)' : '')) + '<input type="file" accept="image/*" capture="environment" multiple data-shphoto></label>' +
      '<label class="p2-fld"><span>Note</span><input class="fmp1-input" data-shif="note" value="' + esc(I.note || '') + '" placeholder="Corner crushed, left side panel split…"></label>' +
      (I.errors ? '<ul class="p2-small sg-errs" role="alert">' + I.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<button class="fmp1-btn fmp1-btn--primary" data-shissuesave>Add to the claim</button></div>';
  }

  /* ---------- receiving at the shop (phone first) ---------- */
  function receiveView(c, j) {
    var u = U(c), esc = c.esc, R = u.rcv, o = (j.supplierOrders || []).filter(function (x) { return x.id === R.order; })[0], s = o && o.shipments.filter(function (x) { return x.id === R.ship; })[0];
    if (!s) { u.rcv = null; return tab(c, j); }
    var back = '<button class="fmp1-btn fmp1-btn--quiet" data-shrcvback>← Shipping tab</button>';
    var head = '<div class="rv-head">' + back + '<b>WC order #' + esc(o.number) + '</b><span class="p2-small">' + esc(s.carrier) + ' ' + (s.trackKind === 'pro' ? 'PRO ' : '#') + esc(s.trackNo) + (s.scope ? ' · the ' + esc(s.scope) + ' items' : '') + ' · ' + esc(j.customer) + '</span></div>';
    if (!s.receivedOn) {
      var F = R.form || (R.form = { date: c.TODAY, damage: null });
      return '<div class="rv">' + head + '<div class="rv-rules"><b>At the truck, before you sign</b><ol><li>Count the pallets and boxes against the BOL.</li><li>Box damage or anything missing? <b>Write it on the BOL before signing. Don\'t refuse the shipment.</b></li><li>If something\'s damaged: tell the driver, get the <b>exception #</b> written on the BOL, and take photos.</li></ol></div>' +
        '<label class="fmp1-btn p2-filebtn rv-big">' + (F.bol ? '✓ BOL photo added · retake' : '📷 Photo of the signed BOL') + '<input type="file" accept="image/*" capture="environment" data-shbol></label>' +
        '<p class="rv-q">Damage or missing boxes noted on the BOL?</p><div class="rv-yn"><button class="fmp1-btn rv-big" data-shdmg="no" aria-pressed="' + (F.damage === false) + '">No</button><button class="fmp1-btn rv-big" data-shdmg="yes" aria-pressed="' + (F.damage === true) + '">Yes</button></div>' +
        (F.damage ? '<label class="p2-fld"><span>Exception # on the BOL</span><input class="fmp1-input" data-shrf="exception" value="' + esc(F.exception || '') + '"></label><label class="p2-row p2-small"><input type="checkbox" data-shrf="noException"' + (F.noException ? ' checked' : '') + '> The driver didn\'t give one</label>' : '') +
        '<label class="p2-fld"><span>Arrived</span><input type="date" class="fmp1-input" data-shrf="date" max="' + c.TODAY + '" value="' + esc(F.date) + '"></label>' +
        err(c) + '<button class="fmp1-btn fmp1-btn--primary rv-big" data-shreceive' + (F.damage == null ? ' disabled' : '') + '>Received' + (F.damage ? ': start the claim' : '') + '</button>' +
        '<p class="p2-small fmp1-faint">Picked up instead? Same steps. Receiving starts the 5-day window to report damage.</p></div>';
    }
    var dl = daysLeft(c, s.deadline), lines = SH.shipmentLines(o, s, window.FMColors ? window.FMColors.name : null), groups = {}, order = [];
    lines.forEach(function (l) { var g = l.item || 'Cabinets'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(l); });
    var allDone = SH.inspected(o, s, houses(j));
    var issuesBySku = {}; (j.claims || []).forEach(function (q) { if (q.orderId === o.id) SH.items(q).forEach(function (i) { issuesBySku[i.sku] = (issuesBySku[i.sku] || 0) + i.qty; }); });
    var body = order.map(function (g) {
      var ls = groups[g], ok = s.okHouses.all || ls.every(function (l) { return s.okLines[l.sku]; });
      return '<section class="rv-group' + (ok ? ' is-ok' : '') + '"><div class="p2-between"><b>' + esc(g) + '</b>' + (ok ? '<span class="p2-ok">✓ All good</span>' : '<button class="fmp1-btn fmp1-btn--primary" data-shgroupok="' + esc(g) + '">All good</button>') + '</div><ul>' + ls.map(function (l) {
        var lok = s.okHouses.all || s.okLines[l.sku], bad = issuesBySku[l.sku];
        return '<li><button class="rv-check" data-shline="' + esc(l.sku) + '" aria-pressed="' + !!lok + '" aria-label="' + esc(l.sku) + ' received">' + (lok ? '✓' : '') + '</button><span><b>' + esc(l.sku) + '</b> × ' + l.qty + (bad ? ' <span class="sh-warn">· ' + bad + ' on the claim</span>' : '') + '</span><button class="rv-warn" data-shissue="' + esc(l.sku) + '" aria-label="Problem with ' + esc(l.sku) + '">⚠</button></li>'; }).join('') + '</ul></section>';
    }).join('');
    return '<div class="rv">' + head + '<div class="rv-count' + (dl <= 2 ? ' is-late' : '') + '"><b>' + (allDone ? '✓ Inspected' : 'Inspect by ' + esc(nice(s.deadline))) + '</b><span>' + (allDone ? 'Received ' + esc(nice(s.receivedOn)) : dl < 0 ? (-dl) + ' day' + (dl === -1 ? '' : 's') + ' past the window: report anything now' : dl === 0 ? 'Today is the last day' : dl + ' day' + (dl === 1 ? '' : 's') + ' left') + '</span></div>' +
      issueSheet(c, j) +
      (allDone ? '' : '<button class="fmp1-btn fmp1-btn--primary rv-big" data-shallok>Everything arrived, no damage</button>') + body +
      '<button class="fmp1-btn rv-big" data-shissue="">⚠ Report damage, missing or wrong</button>' +
      (allDone ? '<p class="p2-ok">' + (SH.openClaims(j).length ? 'Inspection done. Submit the claim on the Shipping tab.' : 'Inspection done. Ready to deliver.') + '</p>' : '') + '</div>';
  }

  /* ---------- printouts ---------- */
  function docHead(c, kicker, title) { return '<header class="doc-head doc-head--center">' + (window.FMQuote ? window.FMQuote.logoHTML({}) : '') + '<div class="doc-kicker">' + c.esc(kicker) + '</div><h1>' + c.esc(title) + '</h1></header>'; }
  function f(k, v) { return '<div><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  function checklistHTML(c, j, o, s, qr) {
    var esc = c.esc, lines = SH.shipmentLines(o, s);
    return '<article class="fm-p1-doc doc-sheet">' + docHead(c, 'Receiving checklist', 'WC order #' + o.number) + (qr ? '<img class="sh-qr" src="' + qr + '" alt="QR code to the receiving screen">' : '') +
      '<section class="doc-fields doc-fields--2">' + f('Job', esc(j.jobCode + ' · ' + j.customer)) + f('Carrier', esc(s.carrier + ' ' + (s.trackKind === 'pro' ? 'PRO ' : '#') + s.trackNo)) + f('Shipment', esc(s.number || '—') + (s.scope ? '<span class="sub">The ' + esc(s.scope) + ' items</span>' : '')) + f('Houses', esc(o.houses && o.houses.length ? o.houses.join(', ') : 'All')) + '</section>' +
      '<div class="doc-flag">DO NOT REFUSE ANY SHIPMENT. Count pallets and boxes against the BOL. Write any box damage or missing items on the BOL before signing, get the driver\'s exception #, and take photos. Report all damage within 5 days.</div>' +
      '<table class="doc-lines"><thead><tr><th>SKU</th><th>Item</th><th class="r">Qty</th><th class="r">Received</th><th class="r">Damaged</th><th class="r">Missing</th></tr></thead><tbody>' + lines.map(function (l) { return '<tr><td><b>' + esc(l.sku) + '</b></td><td>' + esc(l.item) + '</td><td class="r">' + l.qty + '</td><td class="r">☐</td><td class="r">☐</td><td class="r">☐</td></tr>'; }).join('') + '</tbody></table>' +
      '<section class="doc-fields doc-fields--2" style="margin-top:14pt">' + f('BOL exception #', '______________________') + f('Pallets / boxes', '______________________') + '</section>' +
      '<section class="doc-sign"><div><span>Received by</span><span>Date</span></div><div><span>Inspected by</span><span>Date</span></div></section>' +
      '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · 719 Main Street, Cañon City, CO 81212</span><span class="pg">Receiving · ' + esc(j.jobCode) + '</span></footer></article>';
  }
  function packetHTML(c, j, q, photos) {
    var esc = c.esc, o = (j.supplierOrders || []).filter(function (x) { return x.id === q.orderId; })[0] || { shipments: [] }, s = o.shipments.filter(function (x) { return x.receivedOn; })[0] || o.shipments[0] || {};
    var its = SH.items(q), pics = [];
    its.forEach(function (i) { (i.photos || []).forEach(function (p) { if (photos[p]) pics.push({ src: photos[p], label: i.sku + ' · ' + SH.PARTS[i.part] + ' · ' + SH.KINDS[i.kind] + (i.house ? ' · ' + i.house : '') }); }); });
    var page1 = '<article class="fm-p1-doc doc-sheet">' + docHead(c, 'Damage claim', 'Claim ' + q.number + ' · Order #' + (o.number || '')) +
      '<section class="doc-fields doc-fields--2">' + f('From', 'Fremont Makers LLC<span class="sub">719 Main St, Cañon City, CO 81212 · ' + esc(c.me().name) + '</span>') + f('Wholesale Cabinets order', '#' + esc(o.number || '')) +
        f('Shipment', esc(s.number || '—')) + f('Carrier', esc((s.carrier || '—') + (s.trackNo ? ' ' + (s.trackKind === 'pro' ? 'PRO ' : '#') + s.trackNo : ''))) + f('Received', esc(s.receivedOn ? c.longDate(s.receivedOn) : '—')) + f('BOL exception #', esc(q.exception || s.exception || 'None given')) + f('Our job', esc(j.jobCode)) + f('Items', String(its.length)) + '</section>' +
      '<table class="doc-lines"><thead><tr><th>SKU</th><th>Problem</th><th>Part</th><th>House</th><th class="r">Qty</th><th>Note</th></tr></thead><tbody>' + its.map(function (i) { return '<tr><td><b>' + esc(i.sku) + '</b></td><td>' + esc(SH.KINDS[i.kind]) + '</td><td>' + esc(SH.PARTS[i.part]) + '</td><td>' + esc(i.house || '—') + '</td><td class="r">' + i.qty + '</td><td>' + esc(i.note || '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="doc-note">Photos follow, labeled by SKU and part. Please ship all replacement parts together to the address above.</p>' +
      '<footer class="doc-foot doc-foot--end"><span>Fremont Makers LLC · 719 Main Street, Cañon City, CO 81212</span><span class="pg">Claim ' + q.number + '</span></footer></article>';
    var pages = []; for (var i = 0; i < pics.length; i += 2) pages.push('<article class="fm-p1-doc doc-sheet sh-photos">' + pics.slice(i, i + 2).map(function (p) { return '<figure><img src="' + p.src + '" alt=""><figcaption>' + esc(p.label) + '</figcaption></figure>'; }).join('') + '<footer class="doc-foot doc-foot--end"><span>Claim ' + q.number + ' · Order #' + esc(o.number || '') + '</span><span class="pg">Photos ' + (i / 2 + 1) + '</span></footer></article>');
    return page1 + pages.join('');
  }
  var QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', qrp = null;
  function loadQR() { return qrp || (qrp = new Promise(function (res, rej) { if (window.QRCode) return res(); var s = document.createElement('script'); s.src = QR; s.onload = res; s.onerror = function () { qrp = null; rej(); }; document.head.appendChild(s); })); }
  function qrOf(text) { return loadQR().then(function () { return new Promise(function (res) { var d = document.createElement('div'); new window.QRCode(d, { text: text, width: 200, height: 200 }); setTimeout(function () { var cv = d.querySelector('canvas'); res(cv ? cv.toDataURL('image/png') : null); }, 50); }); }, function () { return null; }); }

  /* ---------- the shop-wide Shipping page ---------- */
  function counts(c) {
    var n = 0; c.store.jobs().forEach(function (j) { n += SH.attention(j, c.TODAY, cfg(c)).filter(function (a) { return a.tone === 'alert'; }).length; }); return n + (window.P2Mail ? window.P2Mail.counts(c) : 0);
  }
  function page(c) {
    var esc = c.esc, jobs = c.store.jobs(), arriving = [], inspect = [], claims = [];
    jobs.forEach(function (j) {
      (j.supplierOrders || []).forEach(function (o) { o.shipments.forEach(function (s) {
        if (!s.receivedOn) arriving.push({ j: j, o: o, s: s }); else if (!SH.inspected(o, s, houses(j))) inspect.push({ j: j, o: o, s: s });
      }); if (!o.shipments.length) arriving.push({ j: j, o: o, s: null }); });
      SH.openClaims(j).forEach(function (q) { claims.push({ j: j, q: q }); });
    });
    inspect.sort(function (a, b) { return a.s.deadline < b.s.deadline ? -1 : 1; });
    var row = function (x, right, btn) { return '<li><span><b>' + esc(x.j.customer) + '</b> <span class="p2-small fmp1-faint">' + esc(x.j.jobCode) + '</span><br><span class="p2-small">' + right + '</span></span>' + btn + '</li>'; };
    var A = arriving.map(function (x) { return row(x, 'WC #' + esc(x.o.number) + ' · ' + (x.s ? esc(x.s.carrier) + ' ' + (x.s.trackKind === 'pro' ? 'PRO ' : '#') + (SH.trackUrl(x.s) ? '<a href="' + esc(SH.trackUrl(x.s)) + '" target="_blank" rel="noopener">' + esc(x.s.trackNo) + '</a>' : esc(x.s.trackNo)) + (x.s.scope ? ' · ' + esc(x.s.scope) : '') : 'ordered' + (x.o.estShip ? ', ships about ' + esc(nice(x.o.estShip)) : '') + ' · no tracking yet'),
      x.s ? '<a class="fmp1-btn fmp1-btn--primary" href="#/receive/' + encodeURIComponent(x.j.jobCode) + '/' + encodeURIComponent(x.o.id) + '/' + encodeURIComponent(x.s.id) + '">Receive</a>' : '<a class="fmp1-btn" href="#/job/' + encodeURIComponent(x.j.jobCode) + '/shipping">Open</a>'); }).join('');
    var I = inspect.map(function (x) { var d = daysLeft(c, x.s.deadline); return row(x, 'WC #' + esc(x.o.number) + ' · received ' + esc(nice(x.s.receivedOn)) + ' · <b class="' + (d <= 2 ? 'sh-warn' : '') + '">inspect by ' + esc(nice(x.s.deadline)) + '</b>', '<a class="fmp1-btn fmp1-btn--primary" href="#/receive/' + encodeURIComponent(x.j.jobCode) + '/' + encodeURIComponent(x.o.id) + '/' + encodeURIComponent(x.s.id) + '">Inspect</a>'); }).join('');
    var C = claims.map(function (x) { var d = SH.earliestDeadline(x.j, x.q); return row(x, 'Claim ' + x.q.number + ' · ' + esc(SH.CLAIM_STATUS[x.q.status]) + ' · ' + SH.items(x.q).length + ' item' + (SH.items(x.q).length === 1 ? '' : 's') + (x.q.status === 'draft' && d ? ' · submit by ' + esc(nice(d)) : ''), '<a class="fmp1-btn" href="#/job/' + encodeURIComponent(x.j.jobCode) + '/shipping">Open</a>'); }).join('');
    return '<h1 class="fmp1-h p2-h1">Shipping</h1><p class="p2-sub">Everything coming from Wholesale Cabinets, what\'s at the shop waiting to be inspected, and open claims. Wholesale Cabinets emails arrive in the inbox below and go on their jobs. You can still drop one in by hand.</p>' +
      (window.P2Mail ? window.P2Mail.card(c) : '') +
      '<div class="fmp1-card p2-pad">' + (U(c).read && U(c).read.scope === 'page' ? readResult(c, null) : dropZone(c, 'page')) + '</div>' +
      '<div class="sh-cols"><div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Arriving · ' + arriving.length + '</span>' + (A ? '<ul class="p2-list">' + A + '</ul>' : '<p class="p2-small fmp1-muted">Nothing on the way.</p>') + '</div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">To inspect · ' + inspect.length + '</span>' + (I ? '<ul class="p2-list">' + I + '</ul>' : '<p class="p2-small fmp1-muted">Nothing waiting.</p>') + '</div>' +
      '<div class="fmp1-card p2-pad"><span class="fmp1-eyebrow">Open claims · ' + claims.length + '</span>' + (C ? '<ul class="p2-list">' + C + '</ul>' : '<p class="p2-small fmp1-muted">No open claims.</p>') + '</div></div>';
  }

  /* ---------- events ---------- */
  function savePhotos(c, j, files, label) {
    return Promise.all([].slice.call(files).map(function (file, i) {
      var id = j.jobCode + '-ph-' + Date.now().toString(36) + i; c.files.put(id, file);
      c.store.update(j.jobCode, function (x) { x.documents = (x.documents || []).concat([{ id: id, jobCode: x.jobCode, kind: 'supplier-order', title: label + (files.length > 1 ? ' (' + (i + 1) + ')' : ''), file: file.name, bytes: file.size, type: file.type || 'image/jpeg', uploadedBy: c.me().name, uploadedOn: c.TODAY }]); return x; }, null, c.me().name);
      return id;
    }));
  }
  function click(c, t) {
    var u = U(c), d = t.dataset, j = jobNow(c), who = c.me().name, ctx = { by: who, today: c.TODAY, settings: cfg(c) };
    if (t.hasAttribute('data-shclear')) { u.read = null; u.err = null; u.paste = ''; c.render(); return true; }
    if (d.shread) { var ta = document.querySelector('[data-shpaste="' + d.shread + '"]'); if (ta && ta.value.trim()) readInto(c, ta.value, d.shread); return true; }
    if (t.hasAttribute('data-shsaveship')) {
      var hj = c.store.job(d.shsaveship), rs = SH.addShipment(hj, u.read.r.shipment, ctx);
      if (!rs.ok) { u.err = rs.error; c.render(); return true; }
      put(c, hj, rs); u.read = null; u.err = null; u.adding = null; u.paste = ''; c.render(); return true;
    }
    if (t.hasAttribute('data-shsaveorder')) {
      var tj = j || c.store.job(u.pickJob || ''); if (!tj) { u.err = 'Pick the job.'; c.render(); return true; }
      var hs = houses(tj), sel = hs.length ? [].map.call(document.querySelectorAll('[data-shhouse]:checked'), function (x) { return x.dataset.shhouse; }) : [];
      var kind = u.okind || 'original', claim = kind === 'replacement' ? (tj.claims || []).filter(function (q) { return q.status === 'submitted' || q.status === 'draft'; })[0] : null;
      var ro = SH.addOrder(tj, u.read.r.order, Object.assign({}, ctx, { houses: sel, kind: kind, claimId: claim ? claim.id : null }));
      if (!ro.ok) { u.err = ro.error; c.render(); return true; }
      var nj = ro.job, log = ro.log;
      if (kind === 'original' && nj.stage === 'deposit_paid') { var mv = FM.applyAction(nj, 'order', { date: ro.order.placedOn || c.TODAY }, who); if (mv.ok) { nj = mv.job; log += ' Factory order recorded (' + (ro.order.placedOn || c.TODAY) + ').'; } }
      c.store.update(tj.jobCode, function () { return nj; }, log + (ro.warnings.length ? ' ' + ro.warnings.join(' ') : ''), who);
      u.read = null; u.err = null; u.adding = null; u.okind = null; u.pickJob = null; u.paste = ''; if (!j) c.go('#/job/' + encodeURIComponent(tj.jobCode) + '/shipping'); else c.render(); return true;
    }
    if (!j) return false;
    if (t.hasAttribute('data-shadd')) { u.adding = j.jobCode; u.read = null; u.err = null; c.render(); return true; }
    if (t.hasAttribute('data-shtypeorder')) {
      var T = u.type || {}, r1 = SH.addOrder(j, { number: T.order, lines: [] }, ctx); if (!r1.ok) { u.err = r1.error; c.render(); return true; }
      var n1 = r1.job, l1 = r1.log; if (n1.stage === 'deposit_paid') { var m1 = FM.applyAction(n1, 'order', { date: c.TODAY }, who); if (m1.ok) { n1 = m1.job; l1 += ' Factory order recorded.'; } }
      c.store.update(j.jobCode, function () { return n1; }, l1, who); u.type = {}; u.err = null; u.adding = null; c.render(); return true;
    }
    if (t.hasAttribute('data-shtypeship')) {
      var T2 = u.type || {}, ord = T2.sorder || ((j.supplierOrders || [])[0] || {}).number, r2 = SH.addShipment(j, { orderNumber: ord, carrier: T2.carrier, trackNo: T2.track, trackKind: /old dominion|odfl|estes|xpo|saia|r\+l|yrc|abf|freight/i.test(T2.carrier || '') ? 'pro' : 'tracking' }, ctx);
      if (!r2.ok) { u.err = r2.error; c.render(); return true; }
      put(c, j, r2); u.type = {}; u.err = null; u.adding = null; c.render(); return true;
    }
    if (d.shrecv) { var p = d.shrecv.split('|'); u.rcv = { job: j.jobCode, order: p[0], ship: p[1] }; u.err = null; if (location.hash.split('/')[2] !== 'shipping') c.go('#/job/' + encodeURIComponent(j.jobCode) + '/shipping'); else c.render(); setTimeout(function () { var rv = document.querySelector('.rv'); if (rv) rv.scrollIntoView({ block: 'start' }); }, 30); return true; }
    if (t.hasAttribute('data-shrcvback')) { u.rcv = null; u.issue = null; c.render(); return true; }
    if (d.shdmg) { u.rcv.form.damage = d.shdmg === 'yes'; c.render(); return true; }
    if (t.hasAttribute('data-shreceive')) {
      var F = u.rcv.form, rr = SH.receive(j, u.rcv.order, u.rcv.ship, { date: F.date, exception: F.exception, noException: F.noException, visibleDamage: F.damage, bolDoc: F.bol || null }, ctx);
      if (!rr.ok) { u.err = rr.error; c.render(); return true; }
      put(c, j, rr); u.err = null; c.render(); return true;
    }
    if (t.hasAttribute('data-shallok')) { put(c, j, SH.markOk(j, u.rcv.order, u.rcv.ship, 'all', ctx)); c.render(); return true; }
    if (d.shgroupok) {
      var R = u.rcv, o = j.supplierOrders.filter(function (x) { return x.id === R.order; })[0], s = o.shipments.filter(function (x) { return x.id === R.ship; })[0], cur = j;
      SH.shipmentLines(o, s).filter(function (l) { return (l.item || 'Cabinets') === d.shgroupok; }).forEach(function (l) { var m = SH.markLine(cur, R.order, R.ship, l.sku, true, ctx); if (m.ok) cur = m.job; });
      c.store.update(j.jobCode, function () { return cur; }, d.shgroupok + ' on WC order ' + o.number + ' checked: all good (' + who + ').', who); c.render(); return true;
    }
    if (d.shline) { var R2 = u.rcv, s2 = j.supplierOrders.filter(function (x) { return x.id === R2.order; })[0].shipments.filter(function (x) { return x.id === R2.ship; })[0]; put(c, j, SH.markLine(j, R2.order, R2.ship, d.shline, !s2.okLines[d.shline], ctx)); c.render(); return true; }
    if (d.shissue != null && t.hasAttribute('data-shissue')) { u.issue = { job: j.jobCode, orderId: u.rcv ? u.rcv.order : null, sku: d.shissue || '', kind: u.rcv && !d.shissue ? null : 'hidden_damage', part: null, qty: '1', photos: [], stage: u.rcv ? 'receiving' : 'assembly' }; c.render(); var sh = document.querySelector('[data-shsheet]'); if (sh) sh.scrollIntoView({ block: 'start' }); return true; }
    if (t.hasAttribute('data-shissuecancel')) { u.issue = null; c.render(); return true; }
    if (d.shik) { u.issue.kind = d.shik; c.render(); return true; }
    if (d.ship) { u.issue.part = d.ship; c.render(); return true; }
    if (t.hasAttribute('data-shissuesave')) {
      var I = u.issue, ri = SH.addIssue(j, { orderId: I.orderId, sku: I.sku, kind: I.kind, part: I.part, qty: I.qty, house: I.house, note: I.note, photos: I.photos, stage: I.stage, blocks: I.blocks === 'yes' ? true : I.blocks === 'no' ? false : null }, ctx);
      if (!ri.ok) { I.errors = ri.problems; c.render(); return true; }
      put(c, j, ri); u.issue = null; c.render(); return true;
    }
    if (d.shrmitem) { var pr = d.shrmitem.split('|'); put(c, j, SH.removeIssue(j, pr[0], pr[1], ctx)); c.render(); return true; }
    if (d.shsubmit != null && t.hasAttribute('data-shsubmit')) { u.submit = d.shsubmit || null; u.sub = { via: 'email' }; c.render(); return true; }
    if (d.shsubmitgo) { var rsu = SH.submit(j, d.shsubmitgo, u.sub || { via: 'email' }, ctx); if (!rsu.ok) { u.err = rsu.error; c.render(); return true; } put(c, j, rsu); u.submit = null; c.render(); return true; }
    if (d.shclose != null && t.hasAttribute('data-shclose')) { u.closing = d.shclose || null; u.cl = { outcome: 'closed' }; c.render(); return true; }
    if (d.shclosego) { var Cl = u.cl || {}, rc = SH.close(j, d.shclosego, { outcome: Cl.outcome, creditCents: Cl.credit ? Math.round(parseFloat(Cl.credit) * 100) : null, note: Cl.note }, ctx); if (!rc.ok) { u.err = rc.error; c.render(); return true; } put(c, j, rc); u.closing = null; c.render(); return true; }
    if (d.shprint) {
      var pp = d.shprint.split('|'), po = j.supplierOrders.filter(function (x) { return x.id === pp[0]; })[0], ps = po.shipments.filter(function (x) { return x.id === pp[1]; })[0];
      var link = location.origin + location.pathname + '#/receive/' + encodeURIComponent(j.jobCode) + '/' + encodeURIComponent(po.id) + '/' + encodeURIComponent(ps.id);
      qrOf(link).then(function (qr) { c.ui.viewer = { title: 'Receiving checklist · WC #' + po.number + ' · ' + j.customer, html: checklistHTML(c, j, po, ps, qr), from: '[data-shprint="' + d.shprint + '"]' }; c.render(); });
      return true;
    }
    if (d.shpacket) {
      var q = j.claims.filter(function (x) { return x.id === d.shpacket; })[0], ids = []; SH.items(q).forEach(function (i) { ids = ids.concat(i.photos || []); }); if (q.bolDoc) ids.push(q.bolDoc);
      Promise.all(ids.map(function (id) { return c.files.get(id).then(function (b) { return [id, b ? URL.createObjectURL(b) : null]; }, function () { return [id, null]; }); })).then(function (pairs) {
        var map = {}; pairs.forEach(function (p) { if (p[1]) map[p[0]] = p[1]; });
        c.ui.viewer = { title: 'Claim ' + q.number + ' packet · ' + j.customer, html: packetHTML(c, j, q, map), from: '[data-shpacket="' + d.shpacket + '"]' }; c.render();
      });
      return true;
    }
    return false;
  }
  function input(c, e) {
    var el = e.target, d = el.dataset, u = U(c);
    if (d.shpaste != null && el.hasAttribute('data-shpaste')) { u.paste = el.value; return true; }
    if (d.shtf) { (u.type || (u.type = {}))[d.shtf] = el.value; return true; }
    if (d.shif && u.issue) { u.issue[d.shif] = el.value; return true; }
    if (d.shrf && u.rcv && u.rcv.form) { u.rcv.form[d.shrf] = el.type === 'checkbox' ? el.checked : el.value; return true; }
    if (d.shsub) { (u.sub || (u.sub = {}))[d.shsub] = el.value; return true; }
    if (d.shcl) { (u.cl || (u.cl = {}))[d.shcl] = el.value; return true; }
    return false;
  }
  function change(c, e) {
    var el = e.target, d = el.dataset, u = U(c), j = jobNow(c);
    if (d.shfile) { var file = el.files && el.files[0]; if (file) file.text().then(function (txt) { readInto(c, txt, d.shfile); }); return true; }
    if (el.hasAttribute('data-shpick')) { u.pickJob = el.value || null; c.render(); return true; }
    if (el.hasAttribute('data-shkind')) { u.okind = el.value; return true; }
    if (d.shif === 'orderId' || d.shif === 'blocks' || d.shif === 'house') { u.issue[d.shif] = el.value; c.render(); return true; }
    if (el.hasAttribute('data-shphoto') && j && u.issue) { var I = u.issue; savePhotos(c, j, el.files, 'Damage photo · ' + (I.sku || 'item')).then(function (ids) { I.photos = (I.photos || []).concat(ids); I.errors = null; c.render(); }); return true; }
    if (el.hasAttribute('data-shbol') && j && u.rcv) { var o = j.supplierOrders.filter(function (x) { return x.id === u.rcv.order; })[0]; savePhotos(c, j, el.files, 'BOL · WC order ' + o.number).then(function (ids) { u.rcv.form.bol = ids[0]; c.render(); }); return true; }
    return input(c, e);
  }
  /* drag and drop an .eml onto the drop zone */
  document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('[data-shdrop]')) { e.preventDefault(); e.target.closest('[data-shdrop]').classList.add('is-over'); } });
  document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('[data-shdrop]'); if (z) z.classList.remove('is-over'); });
  document.addEventListener('drop', function (e) {
    var z = e.target.closest && e.target.closest('[data-shdrop]'); if (!z || !window.P2) return; e.preventDefault();
    var f0 = e.dataTransfer.files && e.dataTransfer.files[0], c = window.P2.ctx();
    if (f0) f0.text().then(function (txt) { readInto(c, txt, z.dataset.shdrop); }); else { var txt = e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/plain'); if (txt) readInto(c, txt, z.dataset.shdrop); }
  });

  /* the job header's status line and the board card badge */
  function badge(c, j) { var st = SH.status(j, c.TODAY, cfg(c)); return st ? '<span class="sh-badge is-' + st.tone + '">' + c.esc(st.text) + '</span>' : ''; }
  /* deep link from the printed checklist: #/receive/<job>/<order>/<shipment> */
  function openReceive(c, parts) { U(c).rcv = { job: parts[0], order: parts[1], ship: parts[2] }; c.go('#/job/' + encodeURIComponent(parts[0]) + '/shipping'); setTimeout(function () { var rv = document.querySelector('.rv'); if (rv) rv.scrollIntoView({ block: 'start' }); }, 60); }

  window.P2Ship = { tab: tab, page: page, badge: badge, counts: counts, openReceive: openReceive, claimMail: claimMail, click: click, input: input, change: change, cfg: cfg, soldLines: soldLines };
  if (window.P2) window.P2.render();
})();
