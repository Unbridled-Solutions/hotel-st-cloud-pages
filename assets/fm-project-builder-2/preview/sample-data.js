/*
 * Sample records copied from the Project Builder screen recording (Oct 27, 2026).
 * The field names are a best guess at how the existing tool stores projects.
 * Hermes: map these to the real schema in the adapter (see HANDOFF.md §4).
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FM_SAMPLE = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, {
  today: '2026-10-27',

  legacyProjects: [
    {
      jobCode: 'FM-2610-475',
      customer: 'Willow Creek Change Order 10/23/26',
      projectName: '',
      quoteDate: '2026-10-23',
      status: 'Proposed',
      total: 8740.71
    },
    {
      jobCode: 'FM-2609-276',
      customer: 'Willow Creek Estates',
      projectName: '2 Cimarron Peak, 2 Mesa Ridge, 2 Pinyon Crest, 2 San Luis, 2 Sangre Vista',
      kind: 'builder_order',
      quoteDate: '2026-10-01',
      deliveryDate: '2026-11-20',
      status: 'Contracted',
      total: 72147.34,
      signerName: 'Willow Creek Estates',
      buyerEmail: 'for HelloSign',
      installAddress: '123 Main St, Canon City CO',
      houses: [
        { jobCode: 'FM-2609-712', name: 'Cimarron Peak 1', model: 'Cimarron Peak', color: 'Bayview White Shaker', lines: 16, total: 7153.81 },
        { jobCode: 'FM-2609-781', name: 'Cimarron Peak 2', model: 'Cimarron Peak', color: 'Bayview White Shaker', lines: 16, total: 7153.81 },
        { jobCode: 'FM-2609-790', name: 'Mesa Ridge 1', model: 'Mesa Ridge', color: 'Moss Green Shaker', lines: 15, total: 7497.75 },
        { jobCode: 'FM-2609-625', name: 'Mesa Ridge 2', model: 'Mesa Ridge', color: 'Moss Green Shaker', lines: 15, total: 7497.75 },
        { jobCode: 'FM-2609-333', name: 'Pinyon Crest 1', model: 'Pinyon Crest', color: 'Moss Green Shaker', lines: 15, total: 7791.98 },
        { jobCode: 'FM-2609-269', name: 'Pinyon Crest 2', model: 'Pinyon Crest', color: 'Moss Green Shaker', lines: 15, total: 7791.98 },
        { jobCode: 'FM-2609-697', name: 'San Luis 1', model: 'San Luis', color: 'Bayview White Shaker', lines: 12, total: 6085.97 },
        { jobCode: 'FM-2609-834', name: 'San Luis 2', model: 'San Luis', color: 'Bayview White Shaker', lines: 12, total: 6085.97 },
        { jobCode: 'FM-2609-862', name: 'Sangre Vista 1', model: 'Sangre Vista', color: 'Bayview Wood Shaker', lines: 19, total: 7544.16 },
        { jobCode: 'FM-2609-334', name: 'Sangre Vista 2', model: 'Sangre Vista', color: 'Bayview Wood Shaker', lines: 19, total: 7544.16 }
      ],
      invoices: [
        { label: 'Invoice 1 · 50% at order', due: '2026-10-01', amount: 35364.33, status: 'Paid', paidDate: '2026-10-02', check: '5547' },
        { label: 'Invoice 2 · 50% at delivery', due: '2026-11-20', amount: 36783.01, status: 'Due' },
        { label: 'Change order 1 invoice', due: '2026-10-26', amount: 8740.71, status: 'Due' }
      ],
      changeLog: [
        { date: '2026-10-26', what: 'Change order 1', amount: 8740.71, reason: 'SKUs updated Oct 2026' }
      ]
    },
    {
      jobCode: 'FM-2609-314',
      customer: 'Braddy Builders',
      projectName: 'Penrose',
      quoteDate: '2026-09-16',
      deliveryDate: '2026-11-09',
      signerName: 'Bernard Braddy',
      status: 'Contracted',
      total: 10973.11,
      buyerEmail: '',
      invoices: [
        { label: 'Invoice 1 · 50%', due: '2026-09-16', amount: 5363.77, status: 'Paid', paidDate: '2026-09-16' },
        { label: 'Invoice 2 · 30%', due: '2026-09-25', amount: 3365.60, status: 'Paid', paidDate: '2026-10-05', check: '2967' },
        { label: 'Invoice 3 · 20%', due: '2026-11-09', amount: 2243.74, status: 'Due' }
      ]
    },
    {
      jobCode: 'FM-2609-991',
      customer: 'Stonewall Holdings',
      projectName: 'Como House',
      quoteDate: '2026-09-14',
      status: 'Lost',
      total: 8744.71
    }
  ],

  /* Model totals as printed in the Oct 2026 contract packet (penny differences). */
  legacyPacketModelTotals: [
    { model: 'San Luis', total: 12171.93 },
    { model: 'Mesa Ridge', total: 14995.50 },
    { model: 'Sangre Vista', total: 15088.33 },
    { model: 'Pinyon Crest', total: 15583.95 },
    { model: 'Cimarron Peak', total: 14307.63 }
  ]
}));
