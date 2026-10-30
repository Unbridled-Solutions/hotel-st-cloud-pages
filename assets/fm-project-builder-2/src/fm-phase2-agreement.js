/*
 * Fremont Makers · Project Builder · Phase 2 · Customer Sales Agreement text (HANDOFF §29).  window.FMAgreement
 * Pure functions: no DOM, storage or network.
 *
 * Every contract packet the tool makes starts with this agreement. The wording is taken word for word from the signed
 * packets (Willow Creek FM-2609-276 and Braddy Builders · Penrose FM-2609-314, Sep–Oct 2026). Where the new tool works
 * differently, the wording follows the tool, and each such change is listed in CHANGES (shown to the owner in
 * docs/contract-language-review.md; all approved by the owner Oct 30 2026). Legal terms are never reworded silently: change them here, in one place.
 *
 * sections(job, ctx) → [{ key, title, paras: [text] }], plus `law` (the governing-law line).
 * ctx: { stages: [{ name, pct }], totalCents, bid, assembly (true/false), elevations ('none' | 'agreed' | 'preliminary'),
 *        changeOrders (true when the packet has signed change orders), fmt (cents → '$1,234.56'), dates: [ISO due dates] }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMAgreement = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.1.0';
  var SELLER = 'Fremont Makers LLC, a Colorado limited liability company, 719 Main Street, Cañon City, CO 81212';

  /* The signed packets' text, word for word (Penrose's payment terms; Willow Creek's differ only in the plan). */
  var SIGNED = {
    parties: 'Seller is ' + SELLER + '. Buyer is {buyer} ({signer}). This Agreement, the Quote, the Payment Schedule, and the invoices in this packet are the entire deal. Dollars live on the invoices and the Final Job Quote. Pricing is by bid.',
    goods: 'Seller sells the ready-to-assemble cabinets and hardware listed on the Final Job Quote. Unless the Quote says otherwise in writing: no design professional services, no field measuring, no install into the building, no plumbing, no electrical, no countertops, no appliances.',
    seller: 'Seller is a reseller, not the manufacturer. Most items ship from warehouses in the United States. Out-of-stock orders may take longer because some product originates overseas. Lead times are estimates. Manufacturing or freight delay is not a breach if Seller keeps Buyer reasonably informed.',
    payment: 'Payment is 50 / 30 / 20 of the contract total of {total}. Invoice 1 (50%) is the deposit. The factory order is not placed until Invoice 1 is paid in full. That deposit is non-refundable once the factory order is placed, except as required by law. Invoice 2 (30%) is a progress payment as the order proceeds. Invoice 3 (20%) is due at pickup or delivery. Goods do not leave Seller until paid in full. Colorado sales tax applies as required.',
    elevations: 'Buyer owns measurements, quantities, layouts, and specs. Manufacturer elevation views ship with the Quote. Buyer verifies them against the job. Providing elevations does not make Seller the designer, the measurer, or a warrantor of fit. Order from a bad elevation is Buyer cost, including reorder, restocking, and freight.',
    delivery: 'Buyer inspects at pickup or delivery and notes visible damage on the ticket. Failure to note damage within 48 hours means the Goods are deemed accepted, except for hidden defects. Risk of loss passes on pickup or delivery. Title passes when paid in full.',
    assembly: 'Seller assembly is included in this contract total. It is assembly of the goods only, not installation into the building.',
    warranty: 'Seller warrants the goods for one year from purchase. Claims go to Fremont Makers. This is Seller’s warranty, not a pass-through to the manufacturer or a home builder.',
    law: 'Colorado law. Binding arbitration in Fremont County, one arbitrator. Small claims if the amount fits. If arbitration is unavailable, venue is the state courts of Fremont County.'
  };

  /* Goods as the owner set it Oct 30: design services and field measuring are offered as needed, so they are neither
     promised nor excluded; everything still listed is explicitly NOT included. */
  var GOODS = 'Seller sells the ready-to-assemble cabinets and hardware listed on the Final Job Quote. Unless the Quote says otherwise in writing: no install into the building, no plumbing, no electrical, no countertops, no appliances.';

  /* Where the tool's packets differ from the signed ones, and why. All approved by the owner, Oct 30 2026. */
  var CHANGES = [
    { key: 'parties', what: '"Pricing is by bid." is printed only on bid-priced jobs.', why: 'The old tool printed it on every packet, including itemized ones like Willow Creek.' },
    { key: 'parties', what: 'The list of what makes up the deal adds the elevation drawings (when the packet has them) and change orders both parties sign.', why: 'Packets now include elevations, and signed change orders become part of the contract.' },
    { key: 'payment', what: 'Payment terms are written from the job\'s payment plan, including custom plans with named payments. The deposit is "due on signing".', why: 'Plans are set per job and can be custom (owner, Oct 29); the deposit is due on signing (owner, Oct 27).' },
    { key: 'payment', what: 'Adds: "Each change order both parties sign is billed on its own invoice, due on signing."', why: 'Owner decision Oct 27: each change order gets its own invoice.' },
    { key: 'elevations', what: '"Manufacturer elevation views ship with the Quote" becomes "Elevation drawings ship with the Quote."', why: 'Fremont Makers now draws the elevations in the tool; they are no longer the manufacturer\'s views. The rest of the clause is unchanged.' },
    { key: 'elevations', what: 'When drawings are sent incomplete on purpose, adds: "The elevations in this packet are preliminary. Final elevations will be provided before the factory order is placed."', why: 'Contracts can now go out with incomplete elevations, flagged (Oct 30).' },
    { key: 'assembly', what: 'On a job with no assembly (0 hours), the assembly sentence reads "Assembly is not included in this contract total."', why: 'Assembly is now hours × rate per job, and can be 0.' },
    { key: 'goods', what: 'Drops "no design professional services, no field measuring," from the list of what is not included.', why: 'Owner, Oct 30: those are offered as needed, neither assumed included nor excluded. The rest of the list stays, stating plainly that it is NOT included.' },
    { key: 'signatures', what: 'Adds: "Signed through Dropbox Sign or on paper; each signed copy is an original." The Fremont Makers printed name is filled in with the person signing for this job.', why: 'Contracts are signed in Dropbox Sign or on paper (§16); the signer is picked per job.' }
  ];
  var QUESTIONS = [];   // none open (the field-measuring question was answered Oct 30)

  function pct(n) { return String(Math.round(n * 100) / 100); }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function long(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0] : ''; }

  function paymentText(ctx) {
    var st = ctx.stages || [], n = st.length, total = ctx.fmt(ctx.totalCents), out = [];
    var plain = function (s) { return /^(deposit|progress|final|at delivery|paid in full|payment( \d+)?)$/i.test(String(s.name).trim()); };
    var name = function (s) { return plain(s) ? '' : ', ' + String(s.name).trim() + ','; };
    if (n === 1) out.push('Payment is 100% of the contract total of ' + total + ', due on signing. The factory order is not placed until it is paid in full.');
    else {
      out.push('Payment is ' + st.map(function (s) { return pct(s.pct); }).join(' / ') + ' of the contract total of ' + total + '.');
      out.push('Invoice 1 (' + pct(st[0].pct) + '%)' + name(st[0]) + ' is the deposit, due on signing. The factory order is not placed until Invoice 1 is paid in full. That deposit is non-refundable once the factory order is placed, except as required by law.');
      for (var i = 1; i < n - 1; i++) out.push('Invoice ' + (i + 1) + ' (' + pct(st[i].pct) + '%)' + name(st[i]) + ' is a progress payment as the order proceeds' + (ctx.dates && ctx.dates[i] ? ', due ' + long(ctx.dates[i]) : '') + '.');
      out.push('Invoice ' + n + ' (' + pct(st[n - 1].pct) + '%)' + name(st[n - 1]) + ' is due at pickup or delivery.');
    }
    out.push('Goods do not leave Seller until paid in full. Colorado sales tax applies as required. Each change order both parties sign is billed on its own invoice, due on signing.');
    return out.join(' ');
  }

  function sections(job, ctx) {
    var signer = job.contacts && job.contacts.signer ? job.contacts.signer : job.customer;
    var deal = ['the Quote', 'the Payment Schedule', 'the invoices in this packet'];
    if (ctx.elevations && ctx.elevations !== 'none') deal.push('the elevation drawings');
    deal.push('any change orders both parties sign');
    var parties = 'Seller is ' + SELLER + '. Buyer is ' + job.customer + (signer && signer !== job.customer ? ' (' + signer + ')' : '') + '. This Agreement, ' + deal.slice(0, -1).join(', ') + ', and ' + deal[deal.length - 1] +
      ' are the entire deal. Dollars live on the invoices and the Final Job Quote.' + (ctx.bid ? ' Pricing is by bid.' : '');
    var elev = SIGNED.elevations.replace('Manufacturer elevation views ship with the Quote.', 'Elevation drawings ship with the Quote.') +
      (ctx.elevations === 'preliminary' ? ' The elevations in this packet are preliminary. Final elevations will be provided before the factory order is placed.' : '');
    return [
      { key: 'parties', title: 'Parties and entire agreement', paras: [parties] },
      { key: 'goods', title: 'Goods', paras: [GOODS] },
      { key: 'seller', title: 'Nature of seller', paras: [SIGNED.seller] },
      { key: 'payment', title: 'Payment terms', paras: [paymentText(ctx)] },
      { key: 'elevations', title: 'Measurements and elevations', paras: [elev] },
      { key: 'delivery', title: 'Delivery, inspection, and assembly', paras: [SIGNED.delivery, ctx.assembly === false ? 'Assembly is not included in this contract total.' : SIGNED.assembly] },
      { key: 'warranty', title: 'Warranty', paras: [SIGNED.warranty] }
    ];
  }

  return { VERSION: VERSION, SIGNED: SIGNED, GOODS: GOODS, CHANGES: CHANGES, QUESTIONS: QUESTIONS, LAW: SIGNED.law,
           ESIGN: 'Signed through Dropbox Sign or on paper; each signed copy is an original.', sections: sections, paymentText: paymentText };
}));
