/*
 * Fremont Makers Project Builder · Phase 2 · Wholesale Cabinets mail-in (window.FMMailIn). HANDOFF §46.
 *   hello@fremontmakers.com forwards Wholesale Cabinets email to fremontmakers@gmail.com. The server reads that inbox
 *   (HANDOFF §46, Gmail API) and hands each message here as raw text. This module:
 *     1. unwraps a forward (redirected as-is, forwarded inline with "From: … Subject: …", or attached as message/rfc822)
 *     2. checks it is from Wholesale Cabinets (wholesalecabinets.com, wc-us.com)
 *     3. reads it with FMShipping (order confirmation or shipment update; never payment details)
 *     4. finds its job: a shipment by its WC order #; an order by an order # typed on the job, else by the cabinets on it
 *     5. files it on the job (FMShipping.addOrder / addShipment), or leaves it in the inbox for someone to pick the job
 *   Only exact matches from Wholesale Cabinets file on their own. Everything else waits for a person.
 *   The raw email is never kept: an inbox item holds the subject, sender, date and what was read, nothing else.
 *   Pure functions; nothing here sends email or reads card data.
 */
(function (root, factory) {
  // FMShipping is looked up when used, so the scripts can load in any order
  var get = typeof module === 'object' && module.exports ? function () { return require('./fm-phase2-shipping.js'); } : function () { return root.FMShipping; };
  if (typeof module === 'object' && module.exports) module.exports = factory(get); else root.FMMailIn = factory(get);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (getShipping) {
  'use strict';
  var SH = new Proxy({}, { get: function (t, k) { return getShipping()[k]; } });
  var VERSION = '1.0.0';
  var INBOX = 'fremontmakers@gmail.com';
  var WC_DOMAINS = ['wholesalecabinets.com', 'wc-us.com'];
  /* The team's own mailbox that forwards Wholesale Cabinets email here. A forward from it with no original headers left
     (some forwarding rules strip them) is trusted as Wholesale Cabinets. If the original headers are there, they decide. */
  var FORWARDERS = ['hello@fremontmakers.com'];
  // tracking links are kept only when they go to a carrier (a forged email can't slip in another link)
  var CARRIERS = ['fedex.com', 'ups.com', 'usps.com', 'odfl.com', 'estes-express.com', 'xpo.com', 'saia.com', 'rlcarriers.com', 'abfs.com', 'arcb.com', 'yrc.com', 'yellow.com', 'tforcefreight.com', 'centraltransport.com', 'aaacooper.com', 'southeasternfreight.com', 'pittohio.com', 'dhl.com'];
  var ORDER_STAGES = ['contract_signed', 'deposit_paid', 'factory_ordered', 'delivered'];
  var STATUS = { waiting: 'Needs a job', filed: 'Filed', ignored: 'Not for a job' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hash(s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  /* ---------- headers ---------- */
  function headerBlock(raw) { var i = String(raw || '').search(/\r?\n\r?\n/); return i < 0 ? '' : raw.slice(0, i); }
  function header(block, name) {
    var m = String(block || '').match(new RegExp('^' + name + ':[ \\t]*(.*(?:\\r?\\n[ \\t].*)*)', 'im'));
    return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
  }
  function decodeWords(s) {
    return String(s || '').replace(/=\?utf-8\?([QB])\?([^?]*)\?=/gi, function (m, k, t) {
      if (k.toUpperCase() === 'B') { try { return decodeURIComponent(escape((typeof atob === 'function' ? atob : function (x) { return Buffer.from(x, 'base64').toString('binary'); })(t))); } catch (e) { return t; } }
      var b = t.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, function (q, h) { return String.fromCharCode(parseInt(h, 16)); });
      try { return decodeURIComponent(escape(b)); } catch (e) { return b; }
    }).trim();
  }
  function addressOf(from) { var m = String(from || '').match(/<([^>]+)>/) || String(from || '').match(/([^\s<>"]+@[^\s<>"]+)/); return m ? m[1].trim().toLowerCase() : ''; }
  function domainOf(addr) { return String(addr || '').split('@')[1] || ''; }
  function fromWC(addr) { var d = domainOf(addr); return WC_DOMAINS.some(function (w) { return d === w || d.slice(-(w.length + 1)) === '.' + w; }); }
  function isoDate(s) { var t = Date.parse(s); return isNaN(t) ? null : new Date(t).toISOString(); }

  /* ---------- forwards ---------- */
  /* Returns { raw, email, from, subject, date, messageId, forwardedBy, how }. `email` is FMShipping.readEmail of the original. */
  function unwrap(raw) {
    raw = String(raw || '').replace(/\r\n/g, '\n');
    var hb = headerBlock(raw), outerFrom = decodeWords(header(hb, 'From')), outer = { from: outerFrom, subject: decodeWords(header(hb, 'Subject')), date: header(hb, 'Date'), messageId: header(hb, 'Message-ID') };
    // 1. attached as message/rfc822 (Outlook "Forward as attachment", some rules)
    var att = raw.match(/^Content-Type:\s*message\/rfc822[^\n]*(?:\n[ \t][^\n]*)*\n(?:[A-Za-z-]+:[^\n]*(?:\n[ \t][^\n]*)*\n)*\n([\s\S]*)/im);
    if (att && fromWC(addressOf(outerFrom)) === false) {
      var inner = att[1], bd = (hb.match(/boundary="?([^";\n]+)"?/i) || [])[1];
      if (bd) inner = inner.split('\n--' + bd)[0];
      var ih = headerBlock(inner);
      if (header(ih, 'From')) {
        return { raw: inner, email: SH.readEmail(inner), from: decodeWords(header(ih, 'From')), subject: decodeWords(header(ih, 'Subject')), date: header(ih, 'Date') || outer.date, messageId: header(ih, 'Message-ID') || outer.messageId, forwardedBy: addressOf(outerFrom), how: 'attached' };
      }
    }
    var email = SH.readEmail(raw);
    // 2. forwarded inline: Gmail "---------- Forwarded message ---------", Outlook "From: … Sent: … Subject: …"
    if (!fromWC(addressOf(outerFrom)) || /^(fwd?|fw):/i.test(outer.subject)) {
      var t = email.text, re = /(?:-{5,}\s*Forwarded message\s*-{5,}\s*\n)?\s*From:\s*([^\n]+)\n(?:\s*(?:Sent|Date):\s*([^\n]+)\n)?(?:\s*(?:To|Cc):\s*[^\n]*\n)*\s*Subject:\s*([^\n]+)\n/i, m = t.match(re);
      if (m) {
        var body = t.slice(m.index + m[0].length), subj = m[3].trim();
        return { raw: null, email: { subject: subj, text: body }, from: m[1].replace(/\|/g, '').trim(), subject: subj, date: (m[2] && isoDate(m[2].replace(/\|/g, '').replace(/ at /, ' '))) ? m[2].trim() : outer.date, messageId: outer.messageId, forwardedBy: addressOf(outerFrom), how: 'inline' };
      }
    }
    // 3. redirected or auto-forwarded with the original headers (the usual forwarding rule)
    return { raw: raw, email: email, from: outer.from, subject: outer.subject || email.subject, date: outer.date, messageId: outer.messageId, forwardedBy: null, how: 'direct' };
  }

  function safeUrl(url) {
    if (!url) return null;
    var m = String(url).match(/^https:\/\/([^\/?#:]+)/i); if (!m) return null;
    var host = m[1].toLowerCase();
    return CARRIERS.some(function (d) { return host === d || host.slice(-(d.length + 1)) === '.' + d; }) ? url : null;
  }

  /* ---------- finding the job ---------- */
  function hasOrder(job, number) { return (job.supplierOrders || []).some(function (o) { return o.number === String(number); }); }
  /* opts.linesOf(job) → [{ sku, qty }] the cabinets sold on the job (the server passes the job's quote lines). */
  function match(kind, parsed, jobs, opts) {
    opts = opts || {}; jobs = (jobs || []).filter(function (j) { return !j.testVoid && !j.designTemplate; });
    if (kind === 'shipment') {
      var hit = jobs.filter(function (j) { return hasOrder(j, parsed.orderNumber); });
      if (hit.length === 1) return { jobCode: hit[0].jobCode, confidence: 'exact', why: 'WC order #' + parsed.orderNumber + ' is on this job.', candidates: [] };
      return { jobCode: null, confidence: 'none', why: hit.length > 1 ? 'Order #' + parsed.orderNumber + ' is on more than one job.' : 'Order #' + parsed.orderNumber + ' isn\'t on a job yet.', candidates: hit.map(function (j) { return { jobCode: j.jobCode, score: 1, why: 'Has order #' + parsed.orderNumber }; }) };
    }
    if (kind !== 'order') return { jobCode: null, confidence: 'none', why: '', candidates: [] };
    var typed = jobs.filter(function (j) { return hasOrder(j, parsed.number); });
    if (typed.length === 1) return { jobCode: typed[0].jobCode, confidence: 'exact', why: 'Order #' + parsed.number + ' was typed on this job.', candidates: [] };
    var cands = jobs.filter(function (j) { return ORDER_STAGES.indexOf(j.stage) >= 0; }).map(function (j) {
      var why = [], score = 0, sold = opts.linesOf ? (opts.linesOf(j) || []) : [];
      if (sold.length && parsed.lines.length) {
        var ck = SH.check(parsed.lines, sold), on = ck.lines.filter(function (l) { return l.matched; }).length, frac = on / ck.lines.length;
        score += frac * 0.7; if (on) why.push(on + ' of ' + ck.lines.length + ' cabinets are on its quote');
      }
      var st = parsed.shipTo;
      if (st && !SH.knownShipTo(st, opts.settings) && j.installAddress && norm(j.installAddress).indexOf(norm(st.street)) >= 0) { score += 0.3; why.push('ships to its site'); }
      if (st && (norm(st.name) && norm(j.customer).indexOf(norm(st.name)) >= 0 || norm(st.company) && norm(j.customer).indexOf(norm(st.company)) >= 0)) { score += 0.2; why.push('ship-to name matches'); }
      if (j.stage === 'deposit_paid') { score += 0.1; why.push('waiting on its factory order'); }
      return { jobCode: j.jobCode, score: Math.round(Math.min(1, score) * 100) / 100, why: why.join(', ') };
    }).filter(function (x) { return x.score >= 0.2; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
    var top = cands[0], gap = top ? top.score - ((cands[1] || {}).score || 0) : 0;
    if (top && top.score >= 0.6 && gap >= 0.25) return { jobCode: top.jobCode, confidence: 'likely', why: 'Best match: ' + top.why + '.', candidates: cands };
    return { jobCode: null, confidence: 'none', why: cands.length ? 'More than one job could fit.' : 'No job matches its cabinets.', candidates: cands };
  }

  /* ---------- reading one message ---------- */
  /* raw: the message as text (Gmail API format=raw, base64url-decoded). Returns an inbox item (no raw email, no card data). */
  function ingest(raw, opts) {
    opts = opts || {};
    var u = unwrap(raw), addr = addressOf(u.from), wc = fromWC(addr), em = u.email, via = null;
    var fwd = FORWARDERS.concat(((opts.settings || {}).mailInForwarders) || []).map(function (a) { return String(a).toLowerCase(); });
    if (!wc && u.how === 'direct' && fwd.indexOf(addr) >= 0 && opts.forwarderAuth !== false) { wc = true; via = addr; u.forwardedBy = addr; }
    u.subject = String(u.subject || '').replace(/^\s*((fwd?|fw)\s*:\s*)+/i, '');
    var kind = wc ? SH.kind(em) : 'unknown';
    var parsed = null, problems = [];
    if (kind === 'order') { var r = SH.parseOrder(em); if (r.ok) parsed = r.order; else kind = 'unknown'; problems = r.problems || []; }
    else if (kind === 'shipment') { var s = SH.parseShipment(em); if (s.ok) { parsed = s.shipment; parsed.url = safeUrl(parsed.url) || (parsed.trackNo && /fedex/i.test(parsed.carrier || '') ? 'https://www.fedex.com/fedextrack/?trknbr=' + parsed.trackNo : null); } else kind = 'unknown'; problems = s.problems || []; }
    var id = 'mail-' + hash(u.messageId || (u.subject + '|' + u.date + '|' + String(em.text || '').slice(0, 400)));
    var m = parsed ? match(kind, parsed, opts.jobs || [], opts) : { jobCode: null, confidence: 'none', why: '', candidates: [] };
    var item = {
      id: id, messageId: u.messageId || null, receivedAt: opts.receivedAt || isoDate(u.date) || null, inbox: INBOX,
      from: addr, fromWC: wc, forwardedBy: u.forwardedBy, how: via ? 'forwarder' : u.how, subject: String(u.subject || '').slice(0, 200),
      kind: kind, order: kind === 'order' ? parsed : null, shipment: kind === 'shipment' ? parsed : null, problems: problems,
      match: m, status: kind === 'unknown' ? 'ignored' : 'waiting', reason: kind === 'unknown' ? (wc ? 'Not an order or shipment email.' : 'Not from Wholesale Cabinets.') : null,
      jobCode: null, filedBy: null, filedOn: null, auto: false
    };
    return item;
  }
  /* Files on its own only when it's from Wholesale Cabinets, read cleanly, and the job is certain. */
  function autoFile(item) { return !!(item && item.status === 'waiting' && item.fromWC && item.match && item.match.confidence === 'exact' && !(item.problems || []).length); }

  /* ---------- filing on a job ---------- */
  /* Returns FMShipping's { ok, job, log, error, warnings } plus { orderAction } (true when the job should move to Factory ordered).
     ctx: { by, today, settings, houses }. A shipment for an order that isn't on the job yet adds the order first (number only). */
  function file(job, item, ctx) {
    ctx = ctx || {}; var c = Object.assign({}, ctx, { kind: 'original' }), note = ' (from the ' + INBOX + ' inbox)';
    if (item.kind === 'order') {
      var have = (job.supplierOrders || []).filter(function (o) { return o.number === item.order.number; })[0];
      if (have) return fillOrder(job, have, item.order, ctx);
      var claim = (job.claims || []).filter(function (q) { return q.status === 'submitted'; })[0];
      if (claim && ctx.replacement) { c.kind = 'replacement'; c.claimId = claim.id; }
      var r = SH.addOrder(job, item.order, c); if (!r.ok) return r;
      r.log += note; r.orderAction = c.kind === 'original' && job.stage === 'deposit_paid'; return r;
    }
    if (item.kind === 'shipment') {
      var x = job, pre = '';
      if (!SH.findOrder(job, item.shipment.orderNumber)) {
        var a = SH.addOrder(job, { number: item.shipment.orderNumber, lines: [] }, c); if (!a.ok) return a;
        x = a.job; pre = a.log + ' ';
      }
      var s = SH.addShipment(x, item.shipment, ctx); if (!s.ok) return s;
      s.log = pre + s.log + note; s.orderAction = !!pre && job.stage === 'deposit_paid'; return s;
    }
    return { ok: false, error: 'This email isn\'t an order or a shipment.' };
  }
  /* The order # was typed when the factory order was recorded: fill in what was left blank. Nothing already there is changed. */
  function fillOrder(job, have, order, ctx) {
    var x = clone(job), o = x.supplierOrders.filter(function (q) { return q.id === have.id; })[0], filled = [];
    if (!(o.lines || []).length && (order.lines || []).length) { o.lines = clone(order.lines); filled.push(order.lines.length + ' lines'); }
    ['placedOn', 'estShip', 'shipTo', 'subtotalCents', 'discountCents', 'totalCents'].forEach(function (k) { if ((o[k] == null || o[k] === '') && order[k] != null) { o[k] = clone(order[k]); if (k === 'estShip') filled.push('ships about ' + SH.nice(order.estShip)); if (k === 'shipTo') filled.push('ship-to'); } });
    if (!filled.length) return { ok: false, error: 'Order ' + o.number + ' is already filled in on this job.', duplicate: true };
    var warn = []; if (o.shipTo && !SH.knownShipTo(o.shipTo, ctx.settings)) warn.push('Ships to ' + o.shipTo.street + ', ' + o.shipTo.city + ', not the shop or College Ave. Check the address with Wholesale Cabinets.');
    return { ok: true, job: x, order: o, warnings: warn, orderAction: false, log: 'Wholesale Cabinets order ' + o.number + ' filled in from the confirmation email: ' + filled.join(', ') + ' (from the ' + INBOX + ' inbox).' };
  }

  /* ---------- the inbox ---------- */
  function waiting(items) { return (items || []).filter(function (i) { return i.status === 'waiting'; }); }
  function summary(item) {
    if (item.kind === 'order') { var o = item.order; return 'Order #' + o.number + (o.lines.length ? ' · ' + o.lines.length + ' lines' : '') + (o.estShip ? ' · ships about ' + SH.nice(o.estShip) : ''); }
    if (item.kind === 'shipment') { var s = item.shipment; return 'Shipment ' + (s.number || '') + ' on order #' + s.orderNumber + (s.carrier ? ' · ' + s.carrier + ' ' + (s.trackKind === 'pro' ? 'PRO ' : '#') + s.trackNo : '') + (s.scope ? ' · ' + s.scope : ''); }
    return item.reason || item.subject;
  }

  return { VERSION: VERSION, INBOX: INBOX, WC_DOMAINS: WC_DOMAINS, FORWARDERS: FORWARDERS, STATUS: STATUS, unwrap: unwrap, ingest: ingest, match: match, autoFile: autoFile, file: file, fillOrder: fillOrder, safeUrl: safeUrl, fromWC: fromWC, addressOf: addressOf, waiting: waiting, summary: summary };
}));
