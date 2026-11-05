/*
 * The existing tool's cloud data (GET /api/planner/bundle?ns=fm-quotes → .data), read Nov 5 2026, trimmed for tests:
 * the project list, every listed record (3 jobs, the 10 Willow Creek houses, 5 leftover test houses whose order was
 * deleted), two records that are stored but no longer listed (the Willow Creek change order once saved as its own project,
 * and a test project), the Company P&L months and the Balance Sheet. Saved quote/elevation versions are emptied to keep it small.
 * Read-only reference for FMLegacy (src/fm-phase2-legacy.js). Values are as stored: some numbers are strings.
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FM_LEGACY_BUNDLE = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, {
"fm-quotes-index": [
{
"id": "mumz2cc8cj0mbh2rcfq",
"jobCode": "FM-2609-276",
"customer": "Willow Creek Estates",
"project": "2 San Luis, 2 Mesa Ridge, 2 Sangre Vista, 2 Pinyon Crest, 2 Cimarron Peak",
"date": "2026-10-01",
"status": "contract",
"total": 72147.34000000001,
"createdAt": 1790704231928,
"kind": "order"
},
{
"id": "mu4cq509zy0usv7izn",
"jobCode": "FM-2609-314",
"customer": "Braddy Builders",
"project": "Penrose",
"date": "2026-09-16",
"status": "contract",
"total": 10973.11,
"createdAt": 1789578319833
},
{
"id": "mu1qnu3amn3kj9eo2z",
"jobCode": "FM-2609-991",
"customer": "Stonewall Holdings",
"project": "Como House",
"date": "2026-09-14",
"status": "lost",
"total": 8744.71,
"createdAt": 1789420328470
},
{
"id": "mu5viezxl0wdbx627uk",
"jobCode": "FM-2609-733",
"customer": "Willow CreekTEST",
"project": "Pinyon Crest 1",
"date": "2026-09-17",
"status": "proposed",
"total": 0,
"createdAt": 1789670338413,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"kind": "child"
},
{
"id": "mu5viezyvdc3y96t54",
"jobCode": "FM-2609-202",
"customer": "Willow CreekTEST",
"project": "Pinyon Crest 2",
"date": "2026-09-17",
"status": "proposed",
"total": 0,
"createdAt": 1789670338414,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"kind": "child"
},
{
"id": "mu5viezyn4k9d8isd3j",
"jobCode": "FM-2609-903",
"customer": "Willow CreekTEST",
"project": "Cimarron Peak 1",
"date": "2026-09-17",
"status": "proposed",
"total": 0,
"createdAt": 1789670338414,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"kind": "child"
},
{
"id": "mu5viezy2273tv5pmz8",
"jobCode": "FM-2609-282",
"customer": "Willow CreekTEST",
"project": "Cimarron Peak 2",
"date": "2026-09-17",
"status": "proposed",
"total": 0,
"createdAt": 1789670338414,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"kind": "child"
},
{
"id": "mu5viezyvcvn2zf128",
"jobCode": "FM-2609-469",
"customer": "Willow CreekTEST",
"project": "Cimarron Peak 3",
"date": "2026-09-17",
"status": "proposed",
"total": 0,
"createdAt": 1789670338414,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"kind": "child"
},
{
"id": "mumz2cc9k6aox8a9r3g",
"jobCode": "FM-2609-697",
"customer": "Willow Creek Estates",
"project": "San Luis 1",
"date": "2026-09-29",
"status": "contract",
"total": 6085.97,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9j2wujzkxvs",
"jobCode": "FM-2609-834",
"customer": "Willow Creek Estates",
"project": "San Luis 2",
"date": "2026-09-29",
"status": "contract",
"total": 6085.97,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9nybyk4vqgrl",
"jobCode": "FM-2609-790",
"customer": "Willow Creek Estates",
"project": "Mesa Ridge 1",
"date": "2026-09-29",
"status": "contract",
"total": 7497.75,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9abtnn2hspuv",
"jobCode": "FM-2609-625",
"customer": "Willow Creek Estates",
"project": "Mesa Ridge 2",
"date": "2026-09-29",
"status": "contract",
"total": 7497.75,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9z1fwanuwfhg",
"jobCode": "FM-2609-862",
"customer": "Willow Creek Estates",
"project": "Sangre Vista 1",
"date": "2026-09-29",
"status": "contract",
"total": 7544.16,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9sxazr5eqgw",
"jobCode": "FM-2609-334",
"customer": "Willow Creek Estates",
"project": "Sangre Vista 2",
"date": "2026-09-29",
"status": "contract",
"total": 7544.16,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9p553aei5a3i",
"jobCode": "FM-2609-333",
"customer": "Willow Creek Estates",
"project": "Pinyon Crest 1",
"date": "2026-09-29",
"status": "contract",
"total": 7791.98,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9gpc8kcdic0e",
"jobCode": "FM-2609-269",
"customer": "Willow Creek Estates",
"project": "Pinyon Crest 2",
"date": "2026-09-29",
"status": "contract",
"total": 7791.98,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9vk653p1gckb",
"jobCode": "FM-2609-712",
"customer": "Willow Creek Estates",
"project": "Cimarron Peak 1",
"date": "2026-09-29",
"status": "contract",
"total": 7153.81,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
},
{
"id": "mumz2cc9f7hxryl4it",
"jobCode": "FM-2609-781",
"customer": "Willow Creek Estates",
"project": "Cimarron Peak 2",
"date": "2026-09-29",
"status": "contract",
"total": 7153.81,
"createdAt": 1790704231929,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"kind": "child"
}
],
"fm-quote-fm-test-price-change": {
"id": "fm-test-price-change",
"status": "contract",
"jobCode": "FM-TEST-CO",
"customer": "TEST — do not send to buyer",
"signerName": "Lindsay Walkthrough",
"customerEmail": "",
"project": "Price-this-change demo (courtesy $0)",
"date": "2026-10-14",
"address": "719 Main Street, Cañon City, CO",
"gnaPct": "0",
"taxPct": "0",
"bulkDiscPct": "0",
"cabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"qty": 2,
"cost": "300",
"markup": "35",
"serial": "BC24-VDH",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 3,
"cost": "500",
"markup": "35",
"serial": "VDC42RS-VDH",
"id": "t5"
},
{
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"cost": "300",
"markup": "35",
"serial": "DC224-VDH",
"id": "t6"
}
],
"labor": [
{
"name": "Assembly",
"rate": "40",
"hours": ""
}
],
"reconciliationData": null,
"ar": {
"d1Due": "2026-10-14",
"d2Due": "2026-11-14",
"d3Due": "2026-12-14",
"d1Amt": 1215,
"d2Amt": 729,
"d3Amt": 486,
"d1Paid": false,
"d2Paid": false,
"d3Paid": false,
"d1PaidAmt": null,
"d2PaidAmt": null,
"d3PaidAmt": null,
"d1Check": "",
"d2Check": "",
"d3Check": "",
"depositPaid": 0,
"progressPaid": 0,
"finalPaid": 0
},
"installDate": "2026-12-14",
"modelQty": 1,
"quoteVersions": [],
"kind": "job",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "",
"childIds": [],
"modelMix": [],
"modelKey": "",
"modelName": "",
"unitIndex": 0,
"builderProgram": "",
"builderId": "",
"payPlan": "50-30-20",
"colorName": "",
"revenueStream": "cabinets",
"changeOrders": [
{
"n": 1,
"at": 1791992791389,
"kind": "skus",
"reason": "Swap DC324 and VDC12 for VDC42RS and DC224. Net change is small — courtesy, shop eats it.",
"payChoice": "keep",
"changeAmount": 0,
"oldTotal": 2430,
"newTotal": 2565,
"billTotal": 2430,
"signatures": "pending",
"diff": {
"added": [
{
"key": "VDC42RS-VDH",
"serial": "VDC42RS-VDH",
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 1,
"oldQty": 0,
"newQty": 1
},
{
"key": "DC224-VDH",
"serial": "DC224-VDH",
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"oldQty": 0,
"newQty": 2
}
],
"removed": [
{
"key": "DC324-VDH",
"serial": "DC324-VDH",
"desc": "Dark Hickory Shaker DC324",
"qty": 2,
"oldQty": 2,
"newQty": 0
},
{
"key": "VDC12-VDH",
"serial": "VDC12-VDH",
"desc": "Dark Hickory Shaker VDC12",
"qty": 1,
"oldQty": 1,
"newQty": 0
}
],
"changed": [],
"same": []
},
"cabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"serial": "BC24-VDH",
"qty": 2,
"cost": 300,
"markup": "35",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker VSB30",
"serial": "VSB30-VDH",
"qty": 1,
"cost": 200,
"markup": "35",
"id": "t4"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"serial": "VDC42RS-VDH",
"qty": 1,
"cost": 500,
"markup": "35",
"id": "t5"
},
{
"desc": "Dark Hickory Shaker DC224",
"serial": "DC224-VDH",
"qty": 2,
"cost": 300,
"markup": "35",
"id": "t6"
}
],
"oldCabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"serial": "BC24-VDH",
"qty": 2,
"cost": 300,
"markup": "35",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker DC324",
"serial": "DC324-VDH",
"qty": 2,
"cost": 400,
"markup": "35",
"id": "t2"
},
{
"desc": "Dark Hickory Shaker VDC12",
"serial": "VDC12-VDH",
"qty": 1,
"cost": 200,
"markup": "35",
"id": "t3"
},
{
"desc": "Dark Hickory Shaker VSB30",
"serial": "VSB30-VDH",
"qty": 1,
"cost": 200,
"markup": "35",
"id": "t4"
}
],
"schedule": {
"d1Amt": 1215,
"d2Amt": 729,
"d3Amt": 486,
"d1Due": "2026-10-14",
"d2Due": "2026-11-14",
"d3Due": "2026-12-14",
"d1Paid": false,
"d2Paid": false,
"d3Paid": false
}
},
{
"n": 2,
"at": 1791992958151,
"kind": "both",
"reason": "need to adjust skus\n",
"payChoice": "keep",
"changeAmount": 0,
"oldTotal": 2430,
"newTotal": 3645,
"billTotal": 2430,
"signatures": "pending",
"diff": {
"added": [
{
"key": "VDC42RS-VDH",
"serial": "VDC42RS-VDH",
"qty": 2,
"cost": 500,
"desc": "Dark Hickory Shaker VDC42RS",
"oldQty": 1,
"newQty": 3
}
],
"removed": [
{
"key": "VSB30-VDH",
"serial": "VSB30-VDH",
"qty": 1,
"cost": 200,
"desc": "Dark Hickory Shaker VSB30",
"oldQty": 1,
"newQty": 0
}
],
"changed": [
{
"key": "VDC42RS-VDH",
"desc": "Dark Hickory Shaker VDC42RS",
"oldQty": 1,
"newQty": 3,
"oldCost": 500,
"newCost": 500
}
],
"same": [
{
"key": "BC24-VDH",
"serial": "BC24-VDH",
"qty": 2,
"cost": 300,
"desc": "Dark Hickory Shaker BC24"
},
{
"key": "DC224-VDH",
"serial": "DC224-VDH",
"qty": 2,
"cost": 300,
"desc": "Dark Hickory Shaker DC224"
}
]
},
"cabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"serial": "BC24-VDH",
"qty": "2",
"cost": "300",
"markup": "35",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"serial": "VDC42RS-VDH",
"qty": "3",
"cost": "500",
"markup": "35",
"id": "t5"
},
{
"desc": "Dark Hickory Shaker DC224",
"serial": "DC224-VDH",
"qty": "2",
"cost": "300",
"markup": "35",
"id": "t6"
}
],
"oldCabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"qty": 2,
"cost": "300",
"markup": "35",
"serial": "BC24-VDH",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker VSB30",
"qty": 1,
"cost": "200",
"markup": "35",
"serial": "VSB30-VDH",
"id": "t4"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 1,
"cost": "500",
"markup": "35",
"serial": "VDC42RS-VDH",
"id": "t5"
},
{
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"cost": "300",
"markup": "35",
"serial": "DC224-VDH",
"id": "t6"
}
],
"schedule": {
"d1Amt": 1215,
"d1Due": "2026-10-14",
"d1Paid": false,
"d2Amt": 729,
"d2Due": "2026-11-14",
"d2Paid": false,
"d3Amt": 486,
"d3Due": "2026-12-14",
"d3Paid": false
}
}
],
"contractTotal": 2430,
"originalCabinets": [
{
"desc": "Dark Hickory Shaker BC24",
"serial": "BC24-VDH",
"qty": 2,
"cost": 300,
"markup": "35",
"id": "t1"
},
{
"desc": "Dark Hickory Shaker DC324",
"serial": "DC324-VDH",
"qty": 2,
"cost": 400,
"markup": "35",
"id": "t2"
},
{
"desc": "Dark Hickory Shaker VDC12",
"serial": "VDC12-VDH",
"qty": 1,
"cost": 200,
"markup": "35",
"id": "t3"
},
{
"desc": "Dark Hickory Shaker VSB30",
"serial": "VSB30-VDH",
"qty": 1,
"cost": 200,
"markup": "35",
"id": "t4"
}
],
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1791993016324
},
"fm-quote-mu1qnu3amn3kj9eo2z": {
"id": "mu1qnu3amn3kj9eo2z",
"status": "lost",
"jobCode": "FM-2609-991",
"customer": "Stonewall Holdings",
"signerName": "Stonewall Holdings",
"project": "Como House",
"date": "2026-09-14",
"address": "",
"gnaPct": "5",
"taxPct": "4.9",
"bulkDiscPct": "5",
"cabinets": [
{
"desc": "Bayview Wood Shaker USV2496",
"qty": 2,
"cost": "76.75",
"markup": "30",
"serial": "USV2496-SWD",
"id": "ryi5urp1f3c"
},
{
"desc": "Bayview Wood Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SWD",
"id": "rxdkof5balq"
},
{
"desc": "Bayview Wood Shaker WSV42",
"qty": 6,
"cost": "24.86",
"markup": "30",
"serial": "WSV42-SWD",
"id": "ra0blebdpr0"
},
{
"desc": "Bayview Wood Shaker TKC",
"qty": 2,
"cost": "28.51",
"markup": "30",
"serial": "TKC-SWD",
"id": "rksad2jayys"
},
{
"desc": "Bayview Wood Shaker W3624",
"qty": 1,
"cost": "323.77",
"markup": "30",
"serial": "W3624-SWD",
"id": "rvbvif3upxf"
},
{
"desc": "Bayview Wood Shaker W1542",
"qty": 1,
"cost": "250.69",
"markup": "30",
"serial": "W1542-SWD",
"id": "rny8xcgdsos"
},
{
"desc": "Bayview Wood Shaker W3042",
"qty": 1,
"cost": "450.21",
"markup": "30",
"serial": "W3042-SWD",
"id": "rl3lssp9rlx"
},
{
"desc": "Bayview Wood Shaker DCW2442",
"qty": 1,
"cost": "473.6",
"markup": "30",
"serial": "DCW2442-SWD",
"id": "rsbhymoqwgk"
},
{
"desc": "Bayview Wood Shaker W2442",
"qty": 1,
"cost": "385.16",
"markup": "30",
"serial": "W2442-SWD",
"id": "r07g7gahkv6"
},
{
"desc": "Bayview Wood Shaker W3024",
"qty": 1,
"cost": "275.54",
"markup": "30",
"serial": "W3024-SWD",
"id": "r7t2aphcivj"
},
{
"desc": "Bayview Wood Shaker W1842",
"qty": 1,
"cost": "288.69",
"markup": "30",
"serial": "W1842-SWD",
"id": "r0yuxqho1o1"
},
{
"desc": "Bayview Wood Shaker B21",
"qty": 1,
"cost": "359.59",
"markup": "30",
"serial": "B21-SWD",
"id": "rj0p8n8fbuy"
},
{
"desc": "Bayview Wood Shaker SB36",
"qty": 1,
"cost": "434.14",
"markup": "30",
"serial": "SB36-SWD",
"id": "rng9sjq9vdy"
},
{
"desc": "Bayview Wood Shaker ERB36",
"qty": 1,
"cost": "512.34",
"markup": "30",
"serial": "ERB36-SWD",
"id": "r45zp209mjz"
},
{
"desc": "Bayview Wood Shaker 3DB12",
"qty": 1,
"cost": "401.25",
"markup": "30",
"serial": "3DB12-SWD",
"id": "rf46h0dua8y"
},
{
"desc": "Bayview Wood Shaker B18",
"qty": 1,
"cost": "326.7",
"markup": "30",
"serial": "B18-SWD",
"id": "rclav2x42zy"
},
{
"desc": "Bayview Wood Shaker U249624",
"qty": 1,
"cost": "1023.93",
"markup": "30",
"serial": "U249624-SWD",
"id": "rtm7r7pndwq"
},
{
"desc": "Bayview Wood Shaker SM8(SCR)",
"qty": 3,
"cost": "26.31",
"markup": "30",
"serial": "SM8(SCR)-SWD",
"id": "ruby628kwe7"
}
],
"labor": [
{
"name": "Assembly",
"rate": "40",
"hours": "13"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "",
"modelQty": 1,
"quoteVersions": [],
"kind": "job",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "",
"childIds": [],
"modelMix": [],
"modelKey": "",
"modelName": "",
"unitIndex": 0,
"builderProgram": "",
"builderId": "",
"payPlan": "50-30-20",
"colorName": "",
"revenueStream": "cabinets",
"saved_at": 1791579422802
},
"fm-quote-mu4cq509zy0usv7izn": {
"id": "mu4cq509zy0usv7izn",
"status": "contract",
"jobCode": "FM-2609-314",
"customer": "Braddy Builders",
"signerName": "Bernard Braddy",
"customerEmail": "",
"project": "Penrose",
"date": "2026-09-16",
"address": "",
"gnaPct": "5",
"taxPct": "8.7",
"bulkDiscPct": "5",
"cabinets": [
{
"desc": "Dark Hickory Shaker PWB18K",
"qty": 1,
"cost": "227.36",
"markup": "0",
"serial": "PWB18K-VDH",
"id": "royexh3et0i"
},
{
"desc": "Dark Hickory Shaker SM8",
"qty": 5,
"cost": "22.97",
"markup": "30",
"serial": "SM8-VDH",
"id": "ri0ie6x6etc"
},
{
"desc": "Dark Hickory Shaker WC3024",
"qty": 2,
"cost": "228",
"markup": "30",
"serial": "WC3024-VDH",
"id": "rmhmxw3bqp1"
},
{
"desc": "Dark Hickory Shaker TK8",
"qty": 5,
"cost": "20.46",
"markup": "30",
"serial": "TK8-VDH",
"id": "rwwap7qms1k"
},
{
"desc": "Dark Hickory Shaker WF342",
"qty": 2,
"cost": "36.09",
"markup": "30",
"serial": "WF342-VDH",
"id": "rdqwe18n0f3"
},
{
"desc": "Dark Hickory Shaker TU",
"qty": 1,
"cost": "16.66",
"markup": "0",
"serial": "TU-VDH",
"id": "r02lxocxzrk"
},
{
"desc": "Dark Hickory Shaker DWP3",
"qty": 1,
"cost": "99.5",
"markup": "30",
"serial": "DWP3-VDH",
"id": "rhqbpmapo1g"
},
{
"desc": "Dark Hickory Shaker BC33",
"qty": 1,
"cost": "426.38",
"markup": "30",
"serial": "BC33-VDH",
"id": "r6x5w8dbijl"
},
{
"desc": "Dark Hickory Shaker BC18",
"qty": 1,
"cost": "275.31",
"markup": "30",
"serial": "BC18-VDH",
"id": "ric2u69dm3f"
},
{
"desc": "Dark Hickory Shaker SB36",
"qty": 1,
"cost": "318.05",
"markup": "30",
"serial": "SB36-VDH",
"id": "r6sciltk2m9"
},
{
"desc": "Dark Hickory Shaker BC24",
"qty": 3,
"cost": "331.96",
"markup": "30",
"serial": "BC24-VDH",
"id": "r33fw11i8tc"
},
{
"desc": "Dark Hickory Shaker WC2442",
"qty": 4,
"cost": "306.12",
"markup": "30",
"serial": "WC2442-VDH",
"id": "rn6omh3y4h9"
},
{
"desc": "Dark Hickory Shaker WC362424",
"qty": 1,
"cost": "297.19",
"markup": "30",
"serial": "WC362424-VDH",
"id": "rwdqblwflhv"
},
{
"desc": "Dark Hickory Shaker VDC15",
"qty": 1,
"cost": "369.73",
"markup": "30",
"serial": "VDC15-VDH",
"id": "r83xmyeht3u"
},
{
"desc": "Dark Hickory Shaker VSB30",
"qty": 2,
"cost": "270.34",
"markup": "30",
"serial": "VSB30-VDH",
"id": "rupcn6d37of"
},
{
"desc": "Dark Hickory Shaker FP9624-1.5",
"qty": 1,
"cost": "230.41",
"markup": "30",
"serial": "FP9624-1.5-VDH",
"id": "rhh9w30b8o0"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 1,
"cost": "0",
"markup": "0",
"serial": "VDC42RS-VDH",
"id": "1791989423456.1094"
},
{
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"cost": "0",
"markup": "0",
"serial": "DC224-VDH",
"id": "1791989423457.4077"
}
],
"labor": [
{
"name": "Assembly",
"rate": "40",
"hours": "16"
}
],
"reconciliationData": null,
"ar": {
"d1Due": "2026-09-16",
"d2Due": "2026-09-25",
"d3Due": "2026-11-09",
"d1Paid": true,
"d2Paid": true,
"d3Paid": true,
"depositPaid": 5363.77,
"progressPaid": 3365.6,
"finalPaid": 2243.74,
"d1PaidAt": "2026-09-16",
"d1Amt": 5363.77,
"d1PaidAmt": 5363.77,
"d2Amt": 3365.6,
"d3Amt": 2243.74,
"d2PaidAt": "2026-10-05",
"d2Check": "2967",
"d2PaidAmt": 3365.6,
"d3PaidAt": "2026-11-04",
"d3Check": "2980",
"d3PaidAmt": 2243.74
},
"installDate": "2026-11-09",
"modelQty": 1,
"quoteVersions": [],
"kind": "job",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "",
"childIds": [],
"modelMix": [],
"modelKey": "",
"modelName": "",
"unitIndex": 0,
"builderProgram": "",
"builderId": "",
"payPlan": "50-30-20",
"colorName": "",
"revenueStream": "cabinets",
"changeOrders": [
{
"n": 1,
"at": 1791989423429,
"kind": "skus",
"reason": "SKUs updated Oct 2026",
"oldTotal": 10973.11,
"newTotal": 11150.667042,
"signatures": "pending",
"payChoice": "keep",
"billTotal": 10973.11,
"cabinets": [
{
"desc": "Dark Hickory Shaker PWB18K",
"qty": 1,
"cost": "227.36",
"markup": "0",
"serial": "PWB18K-VDH",
"id": "royexh3et0i"
},
{
"desc": "Dark Hickory Shaker SM8",
"qty": 5,
"cost": "22.97",
"markup": "30",
"serial": "SM8-VDH",
"id": "ri0ie6x6etc"
},
{
"desc": "Dark Hickory Shaker WC3024",
"qty": 2,
"cost": "228",
"markup": "30",
"serial": "WC3024-VDH",
"id": "rmhmxw3bqp1"
},
{
"desc": "Dark Hickory Shaker TK8",
"qty": 5,
"cost": "20.46",
"markup": "30",
"serial": "TK8-VDH",
"id": "rwwap7qms1k"
},
{
"desc": "Dark Hickory Shaker WF342",
"qty": 2,
"cost": "36.09",
"markup": "30",
"serial": "WF342-VDH",
"id": "rdqwe18n0f3"
},
{
"desc": "Dark Hickory Shaker TU",
"qty": 1,
"cost": "16.66",
"markup": "0",
"serial": "TU-VDH",
"id": "r02lxocxzrk"
},
{
"desc": "Dark Hickory Shaker DWP3",
"qty": 1,
"cost": "99.5",
"markup": "30",
"serial": "DWP3-VDH",
"id": "rhqbpmapo1g"
},
{
"desc": "Dark Hickory Shaker BC33",
"qty": 1,
"cost": "426.38",
"markup": "30",
"serial": "BC33-VDH",
"id": "r6x5w8dbijl"
},
{
"desc": "Dark Hickory Shaker BC18",
"qty": 1,
"cost": "275.31",
"markup": "30",
"serial": "BC18-VDH",
"id": "ric2u69dm3f"
},
{
"desc": "Dark Hickory Shaker SB36",
"qty": 1,
"cost": "318.05",
"markup": "30",
"serial": "SB36-VDH",
"id": "r6sciltk2m9"
},
{
"desc": "Dark Hickory Shaker BC24",
"qty": 3,
"cost": "331.96",
"markup": "30",
"serial": "BC24-VDH",
"id": "r33fw11i8tc"
},
{
"desc": "Dark Hickory Shaker WC2442",
"qty": 4,
"cost": "306.12",
"markup": "30",
"serial": "WC2442-VDH",
"id": "rn6omh3y4h9"
},
{
"desc": "Dark Hickory Shaker WC362424",
"qty": 1,
"cost": "297.19",
"markup": "30",
"serial": "WC362424-VDH",
"id": "rwdqblwflhv"
},
{
"desc": "Dark Hickory Shaker VDC15",
"qty": 1,
"cost": "369.73",
"markup": "30",
"serial": "VDC15-VDH",
"id": "r83xmyeht3u"
},
{
"desc": "Dark Hickory Shaker VSB30",
"qty": 2,
"cost": "270.34",
"markup": "30",
"serial": "VSB30-VDH",
"id": "rupcn6d37of"
},
{
"desc": "Dark Hickory Shaker FP9624-1.5",
"qty": 1,
"cost": "230.41",
"markup": "30",
"serial": "FP9624-1.5-VDH",
"id": "rhh9w30b8o0"
},
{
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 1,
"cost": "0",
"markup": "0",
"serial": "VDC42RS-VDH",
"id": "1791989423456.1094"
},
{
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"cost": "0",
"markup": "0",
"serial": "DC224-VDH",
"id": "1791989423457.4077"
}
],
"oldCabinets": [
{
"desc": "Dark Hickory Shaker PWB18K",
"qty": 1,
"cost": "227.36",
"markup": "0",
"serial": "PWB18K-VDH",
"id": "royexh3et0i"
},
{
"desc": "Dark Hickory Shaker SM8",
"qty": 5,
"cost": "22.97",
"markup": "30",
"serial": "SM8-VDH",
"id": "ri0ie6x6etc"
},
{
"desc": "Dark Hickory Shaker WC3024",
"qty": 2,
"cost": "228",
"markup": "30",
"serial": "WC3024-VDH",
"id": "rmhmxw3bqp1"
},
{
"desc": "Dark Hickory Shaker TK8",
"qty": 5,
"cost": "20.46",
"markup": "30",
"serial": "TK8-VDH",
"id": "rwwap7qms1k"
},
{
"desc": "Dark Hickory Shaker WF342",
"qty": 2,
"cost": "36.09",
"markup": "30",
"serial": "WF342-VDH",
"id": "rdqwe18n0f3"
},
{
"desc": "Dark Hickory Shaker TU",
"qty": 1,
"cost": "16.66",
"markup": "0",
"serial": "TU-VDH",
"id": "r02lxocxzrk"
},
{
"desc": "Dark Hickory Shaker DWP3",
"qty": 1,
"cost": "99.5",
"markup": "30",
"serial": "DWP3-VDH",
"id": "rhqbpmapo1g"
},
{
"desc": "Dark Hickory Shaker BC33",
"qty": 1,
"cost": "426.38",
"markup": "30",
"serial": "BC33-VDH",
"id": "r6x5w8dbijl"
},
{
"desc": "Dark Hickory Shaker BC18",
"qty": 1,
"cost": "275.31",
"markup": "30",
"serial": "BC18-VDH",
"id": "ric2u69dm3f"
},
{
"desc": "Dark Hickory Shaker SB36",
"qty": 1,
"cost": "318.05",
"markup": "30",
"serial": "SB36-VDH",
"id": "r6sciltk2m9"
},
{
"desc": "Dark Hickory Shaker DC324",
"qty": 2,
"cost": "466.13",
"markup": "30",
"serial": "DC324-VDH",
"id": "ru7yv1l7sq2"
},
{
"desc": "Dark Hickory Shaker BC24",
"qty": 3,
"cost": "331.96",
"markup": "30",
"serial": "BC24-VDH",
"id": "r33fw11i8tc"
},
{
"desc": "Dark Hickory Shaker WC2442",
"qty": 4,
"cost": "306.12",
"markup": "30",
"serial": "WC2442-VDH",
"id": "rn6omh3y4h9"
},
{
"desc": "Dark Hickory Shaker WC362424",
"qty": 1,
"cost": "297.19",
"markup": "30",
"serial": "WC362424-VDH",
"id": "rwdqblwflhv"
},
{
"desc": "Dark Hickory Shaker VDC15",
"qty": 1,
"cost": "369.73",
"markup": "30",
"serial": "VDC15-VDH",
"id": "r83xmyeht3u"
},
{
"desc": "Dark Hickory Shaker VDC12",
"qty": 1,
"cost": "336.93",
"markup": "30",
"serial": "VDC12-VDH",
"id": "rp1safzmpyd"
},
{
"desc": "Dark Hickory Shaker VSB30",
"qty": 2,
"cost": "270.34",
"markup": "30",
"serial": "VSB30-VDH",
"id": "rupcn6d37of"
},
{
"desc": "Dark Hickory Shaker FP9624-1.5",
"qty": 1,
"cost": "230.41",
"markup": "30",
"serial": "FP9624-1.5-VDH",
"id": "rhh9w30b8o0"
}
],
"diff": {
"added": [
{
"key": "VDC42RS-VDH",
"desc": "Dark Hickory Shaker VDC42RS",
"qty": 1,
"serial": "VDC42RS-VDH"
},
{
"key": "DC224-VDH",
"desc": "Dark Hickory Shaker DC224",
"qty": 2,
"serial": "DC224-VDH"
}
],
"removed": [],
"changed": [],
"same": []
}
}
],
"contractTotal": 10973.11,
"originalCabinets": [
{
"desc": "Dark Hickory Shaker PWB18K",
"qty": 1,
"cost": "227.36",
"markup": "0",
"serial": "PWB18K-VDH",
"id": "royexh3et0i"
},
{
"desc": "Dark Hickory Shaker SM8",
"qty": 5,
"cost": "22.97",
"markup": "30",
"serial": "SM8-VDH",
"id": "ri0ie6x6etc"
},
{
"desc": "Dark Hickory Shaker WC3024",
"qty": 2,
"cost": "228",
"markup": "30",
"serial": "WC3024-VDH",
"id": "rmhmxw3bqp1"
},
{
"desc": "Dark Hickory Shaker TK8",
"qty": 5,
"cost": "20.46",
"markup": "30",
"serial": "TK8-VDH",
"id": "rwwap7qms1k"
},
{
"desc": "Dark Hickory Shaker WF342",
"qty": 2,
"cost": "36.09",
"markup": "30",
"serial": "WF342-VDH",
"id": "rdqwe18n0f3"
},
{
"desc": "Dark Hickory Shaker TU",
"qty": 1,
"cost": "16.66",
"markup": "0",
"serial": "TU-VDH",
"id": "r02lxocxzrk"
},
{
"desc": "Dark Hickory Shaker DWP3",
"qty": 1,
"cost": "99.5",
"markup": "30",
"serial": "DWP3-VDH",
"id": "rhqbpmapo1g"
},
{
"desc": "Dark Hickory Shaker BC33",
"qty": 1,
"cost": "426.38",
"markup": "30",
"serial": "BC33-VDH",
"id": "r6x5w8dbijl"
},
{
"desc": "Dark Hickory Shaker BC18",
"qty": 1,
"cost": "275.31",
"markup": "30",
"serial": "BC18-VDH",
"id": "ric2u69dm3f"
},
{
"desc": "Dark Hickory Shaker SB36",
"qty": 1,
"cost": "318.05",
"markup": "30",
"serial": "SB36-VDH",
"id": "r6sciltk2m9"
},
{
"desc": "Dark Hickory Shaker DC324",
"qty": 2,
"cost": "466.13",
"markup": "30",
"serial": "DC324-VDH",
"id": "ru7yv1l7sq2"
},
{
"desc": "Dark Hickory Shaker BC24",
"qty": 3,
"cost": "331.96",
"markup": "30",
"serial": "BC24-VDH",
"id": "r33fw11i8tc"
},
{
"desc": "Dark Hickory Shaker WC2442",
"qty": 4,
"cost": "306.12",
"markup": "30",
"serial": "WC2442-VDH",
"id": "rn6omh3y4h9"
},
{
"desc": "Dark Hickory Shaker WC362424",
"qty": 1,
"cost": "297.19",
"markup": "30",
"serial": "WC362424-VDH",
"id": "rwdqblwflhv"
},
{
"desc": "Dark Hickory Shaker VDC15",
"qty": 1,
"cost": "369.73",
"markup": "30",
"serial": "VDC15-VDH",
"id": "r83xmyeht3u"
},
{
"desc": "Dark Hickory Shaker VDC12",
"qty": 1,
"cost": "336.93",
"markup": "30",
"serial": "VDC12-VDH",
"id": "rp1safzmpyd"
},
{
"desc": "Dark Hickory Shaker VSB30",
"qty": 2,
"cost": "270.34",
"markup": "30",
"serial": "VSB30-VDH",
"id": "rupcn6d37of"
},
{
"desc": "Dark Hickory Shaker FP9624-1.5",
"qty": 1,
"cost": "230.41",
"markup": "30",
"serial": "FP9624-1.5-VDH",
"id": "rhh9w30b8o0"
}
],
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793830974113
},
"fm-quote-mu5viezxl0wdbx627uk": {
"id": "mu5viezxl0wdbx627uk",
"kind": "child",
"parentOrderId": "mu5viezxm2hp7p4x0d",
"modelKey": "pinyon-crest",
"modelName": "Pinyon Crest",
"unitIndex": 1,
"status": "proposed",
"jobCode": "FM-2609-733",
"customer": "Willow CreekTEST",
"signerName": "TEST Rod Stambaugh",
"project": "Pinyon Crest 1",
"date": "2026-09-17",
"address": "",
"gnaPct": "10",
"taxPct": "8.7",
"bulkDiscPct": "0",
"cabinets": [],
"labor": [],
"revenueStream": "cabinets",
"modelQty": 1,
"saved_at": 1789670338413,
"colorName": "Moss Green Shaker"
},
"fm-quote-mu5viezy2273tv5pmz8": {
"id": "mu5viezy2273tv5pmz8",
"status": "proposed",
"jobCode": "FM-2609-282",
"customer": "Willow CreekTEST",
"signerName": "TEST Rod Stambaugh",
"project": "Cimarron Peak 2",
"date": "2026-09-17",
"address": "",
"gnaPct": "10",
"taxPct": "8.7",
"bulkDiscPct": "0",
"cabinets": [],
"labor": [
{
"name": "Assembly",
"rate": "40",
"hours": ""
}
],
"reconciliationData": null,
"ar": null,
"installDate": "",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"childIds": [],
"modelMix": [],
"modelKey": "cimarron-peak",
"modelName": "Cimarron Peak",
"unitIndex": 2,
"builderProgram": "",
"revenueStream": "cabinets",
"saved_at": 1789670392222,
"colorName": "Bayview White Shaker"
},
"fm-quote-mu5viezyn4k9d8isd3j": {
"id": "mu5viezyn4k9d8isd3j",
"status": "proposed",
"jobCode": "FM-2609-903",
"customer": "Willow CreekTEST",
"signerName": "TEST Rod Stambaugh",
"project": "Cimarron Peak 1",
"date": "2026-09-17",
"address": "",
"gnaPct": "10",
"taxPct": "8.7",
"bulkDiscPct": "0",
"cabinets": [],
"labor": [
{
"name": "Assembly",
"rate": "40",
"hours": ""
}
],
"reconciliationData": null,
"ar": null,
"installDate": "",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mu5viezxm2hp7p4x0d",
"childIds": [],
"modelMix": [],
"modelKey": "cimarron-peak",
"modelName": "Cimarron Peak",
"unitIndex": 1,
"builderProgram": "",
"revenueStream": "cabinets",
"saved_at": 1789670564555,
"colorName": "Bayview White Shaker"
},
"fm-quote-mu5viezyvcvn2zf128": {
"id": "mu5viezyvcvn2zf128",
"kind": "child",
"parentOrderId": "mu5viezxm2hp7p4x0d",
"modelKey": "cimarron-peak",
"modelName": "Cimarron Peak",
"unitIndex": 3,
"status": "proposed",
"jobCode": "FM-2609-469",
"customer": "Willow CreekTEST",
"signerName": "TEST Rod Stambaugh",
"project": "Cimarron Peak 3",
"date": "2026-09-17",
"address": "",
"gnaPct": "10",
"taxPct": "8.7",
"bulkDiscPct": "0",
"cabinets": [],
"labor": [],
"revenueStream": "cabinets",
"modelQty": 1,
"saved_at": 1789670338414,
"colorName": "Bayview White Shaker"
},
"fm-quote-mu5viezyvdc3y96t54": {
"id": "mu5viezyvdc3y96t54",
"kind": "child",
"parentOrderId": "mu5viezxm2hp7p4x0d",
"modelKey": "pinyon-crest",
"modelName": "Pinyon Crest",
"unitIndex": 2,
"status": "proposed",
"jobCode": "FM-2609-202",
"customer": "Willow CreekTEST",
"signerName": "TEST Rod Stambaugh",
"project": "Pinyon Crest 2",
"date": "2026-09-17",
"address": "",
"gnaPct": "10",
"taxPct": "8.7",
"bulkDiscPct": "0",
"cabinets": [],
"labor": [],
"revenueStream": "cabinets",
"modelQty": 1,
"saved_at": 1789670338414,
"colorName": "Moss Green Shaker"
},
"fm-quote-mumz2cc8cj0mbh2rcfq": {
"id": "mumz2cc8cj0mbh2rcfq",
"kind": "order",
"isOrder": true,
"status": "contract",
"jobCode": "FM-2609-276",
"customer": "Willow Creek Estates",
"signerName": "Willow Creek Estates",
"project": "2 San Luis, 2 Mesa Ridge, 2 Sangre Vista, 2 Pinyon Crest, 2 Cimarron Peak",
"date": "2026-10-01",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "5",
"cabinets": [],
"labor": [],
"revenueStream": "cabinets",
"builderProgram": "Willow Creek",
"builderId": "willow-creek",
"payPlan": "50-50",
"childIds": [
"mumz2cc9k6aox8a9r3g",
"mumz2cc9j2wujzkxvs",
"mumz2cc9nybyk4vqgrl",
"mumz2cc9abtnn2hspuv",
"mumz2cc9z1fwanuwfhg",
"mumz2cc9sxazr5eqgw",
"mumz2cc9p553aei5a3i",
"mumz2cc9gpc8kcdic0e",
"mumz2cc9vk653p1gckb",
"mumz2cc9f7hxryl4it"
],
"modelMix": [
{
"name": "San Luis",
"qty": 2
},
{
"name": "Mesa Ridge",
"qty": 2
},
{
"name": "Sangre Vista",
"qty": 2
},
{
"name": "Pinyon Crest",
"qty": 2
},
{
"name": "Cimarron Peak",
"qty": 2
}
],
"saved_at": 1793889098721,
"installDate": "2026-11-20",
"ar": {
"d1Due": "2026-10-01",
"d2Due": "2026-11-20",
"d3Due": "",
"d1Paid": true,
"d2Paid": false,
"d3Paid": false,
"d1PaidAt": "2026-10-02",
"d2PaidAt": "",
"d3PaidAt": "",
"d3Amt": 0,
"d1Check": "5547",
"d2Check": "",
"d3Check": "",
"d1Copy": "",
"d2Copy": "",
"d3Copy": "",
"depositPaid": 35364.33,
"progressPaid": 0,
"finalPaid": 0,
"d1PaidAmt": 35364.33,
"d1Amt": 35364.33,
"d2Amt": 36783.01
},
"contractTotal": 72147.34000000001,
"changeOrders": [
{
"n": 1,
"at": 1793045418468,
"kind": "skus",
"reason": "SKUs updated Oct 2026",
"payChoice": "custom",
"changeAmount": 8740.71,
"oldTotal": 72147.34000000001,
"oldSkuTotal": 0,
"newTotal": 8740.71,
"billTotal": 72147.34000000001,
"scope": "order",
"houseId": "",
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"signatures": "pending",
"diff": {
"added": [
{
"key": "B30-SBW",
"serial": "B30-SBW",
"qty": 2,
"cost": 353.81,
"desc": "Bayview White Shaker B30",
"oldQty": 0,
"newQty": 2
},
{
"key": "FPV4296-SBW",
"serial": "FPV4296-SBW",
"qty": 3,
"cost": 85.36,
"desc": "Bayview White Shaker FPV4296",
"oldQty": 0,
"newQty": 3
},
{
"key": "FPV4296-SWD",
"serial": "FPV4296-SWD",
"qty": 2,
"cost": 123.52,
"desc": "Bayview Wood Shaker FPV4296",
"oldQty": 0,
"newQty": 2
},
{
"key": "FPV4296-UMO",
"serial": "FPV4296-UMO",
"qty": 3,
"cost": 122.82,
"desc": "Moss Green Shaker FPV4296",
"oldQty": 0,
"newQty": 3
},
{
"key": "OCM-UMO",
"serial": "OCM-UMO",
"qty": 1,
"cost": 44.16,
"desc": "Moss Green Shaker OCM",
"oldQty": 0,
"newQty": 1
},
{
"key": "OCM8-SBW",
"serial": "OCM8-SBW",
"qty": 1,
"cost": 19.1,
"desc": "Bayview White Shaker OCM8",
"oldQty": 0,
"newQty": 1
},
{
"key": "OCM8-SWD",
"serial": "OCM8-SWD",
"qty": 1,
"cost": 26.31,
"desc": "Bayview Wood Shaker OCM8",
"oldQty": 0,
"newQty": 1
},
{
"key": "SCR-UMO",
"serial": "SCR-UMO",
"qty": 1,
"cost": 20.24,
"desc": "Moss Green Shaker SCR",
"oldQty": 0,
"newQty": 1
},
{
"key": "SM8(SCR)-SBW",
"serial": "SM8(SCR)-SBW",
"qty": 1,
"cost": 17.97,
"desc": "Bayview White Shaker SM8(SCR)",
"oldQty": 0,
"newQty": 1
},
{
"key": "SM8(SCR)-SWD",
"serial": "SM8(SCR)-SWD",
"qty": 1,
"cost": 26.31,
"desc": "Bayview Wood Shaker SM8(SCR)",
"oldQty": 0,
"newQty": 1
},
{
"key": "W3024-SBW",
"serial": "W3024-SBW",
"qty": 4,
"cost": 190.94,
"desc": "Bayview White Shaker W3024",
"oldQty": 0,
"newQty": 4
},
{
"key": "W3024-SWD",
"serial": "W3024-SWD",
"qty": 2,
"cost": 275.54,
"desc": "Bayview Wood Shaker W3024",
"oldQty": 0,
"newQty": 2
},
{
"key": "W3024-UMO",
"serial": "W3024-UMO",
"qty": 4,
"cost": 277.39,
"desc": "Moss Green Shaker W3024",
"oldQty": 0,
"newQty": 4
},
{
"key": "W3042-SBW",
"serial": "W3042-SBW",
"qty": 4,
"cost": 307.76,
"desc": "Bayview White Shaker W3042",
"oldQty": 0,
"newQty": 4
}
],
"removed": [],
"changed": [],
"same": []
},
"cabinets": [
{
"desc": "Bayview White Shaker W3042",
"serial": "W3042-SBW",
"qty": "4",
"cost": "307.76",
"markup": "70",
"id": ""
},
{
"desc": "Bayview White Shaker B30",
"serial": "B30-SBW",
"qty": "2",
"cost": "353.81",
"markup": "72",
"id": ""
},
{
"desc": "Moss Green Shaker W3024",
"serial": "W3024-UMO",
"qty": "4",
"cost": "277.39",
"markup": "18",
"id": ""
},
{
"desc": "Bayview Wood Shaker W3024",
"serial": "W3024-SWD",
"qty": "2",
"cost": "275.54",
"markup": "42",
"id": ""
},
{
"desc": "Bayview White Shaker W3024",
"serial": "W3024-SBW",
"qty": "4",
"cost": "190.94",
"markup": "70",
"id": ""
},
{
"desc": "Bayview Wood Shaker OCM8",
"serial": "OCM8-SWD",
"qty": "1",
"cost": "26.31",
"markup": "42",
"id": ""
},
{
"desc": "Bayview Wood Shaker SM8(SCR)",
"serial": "SM8(SCR)-SWD",
"qty": "1",
"cost": "26.31",
"markup": "0",
"id": ""
},
{
"desc": "Bayview Wood Shaker FPV4296",
"serial": "FPV4296-SWD",
"qty": "2",
"cost": "123.52",
"markup": "42",
"id": ""
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"serial": "SM8(SCR)-SBW",
"qty": "1",
"cost": "17.97",
"markup": "50",
"id": ""
},
{
"desc": "Bayview White Shaker OCM8",
"serial": "OCM8-SBW",
"qty": "1",
"cost": "19.1",
"markup": "70",
"id": ""
},
{
"desc": "Bayview White Shaker FPV4296",
"serial": "FPV4296-SBW",
"qty": "3",
"cost": "85.36",
"markup": "72",
"id": ""
},
{
"desc": "Moss Green Shaker OCM",
"serial": "OCM-UMO",
"qty": "1",
"cost": "44.16",
"markup": "18",
"id": ""
},
{
"desc": "Moss Green Shaker SCR",
"serial": "SCR-UMO",
"qty": "1",
"cost": "20.24",
"markup": "30",
"id": ""
},
{
"desc": "Moss Green Shaker FPV4296",
"serial": "FPV4296-UMO",
"qty": "3",
"cost": "122.82",
"markup": "18",
"id": ""
}
],
"oldCabinets": [],
"labor": [
{
"name": "Assembly",
"rate": 20.5,
"hours": 5
}
],
"laborRate": 20.5,
"laborHours": 5,
"bulkDiscPct": 5,
"gnaPct": 2,
"taxPct": 7.9,
"materialsNet": 5388.73,
"cabinetsSell": 8127.63,
"billHow": "separate",
"extraInvoice": {
"n": 1,
"amt": 8740.71,
"due": "2026-10-26",
"paid": true,
"reason": "SKUs updated Oct 2026",
"paidAt": "2026-10-28",
"check": "5568",
"paidAmt": 8740.71
},
"schedule": {
"d1Amt": 35364.33,
"d1Due": "2026-10-01",
"d1Paid": true,
"d2Amt": 36783.01,
"d2Due": "2026-10-29",
"d2Paid": false
}
}
]
},
"fm-quote-mumz2cc9abtnn2hspuv": {
"id": "mumz2cc9abtnn2hspuv",
"status": "contract",
"jobCode": "FM-2609-625",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"project": "Mesa Ridge 2",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Moss Green Shaker W362424",
"qty": 1,
"cost": "396.06",
"markup": "19",
"serial": "W362424-UMO",
"id": "r6ged9fyae3"
},
{
"desc": "Moss Green Shaker F342",
"qty": 4,
"cost": "22.08",
"markup": "10",
"serial": "F342-UMO",
"id": "r2ik4mbvglf"
},
{
"desc": "Moss Green Shaker SB36",
"qty": 1,
"cost": "427.81",
"markup": "19",
"serial": "SB36-UMO",
"id": "rznv8c0ptod"
},
{
"desc": "Moss Green Shaker TUK",
"qty": 1,
"cost": "36.8",
"markup": "0",
"serial": "TUK-UMO",
"id": "rpsxnamis69"
},
{
"desc": "Moss Green Shaker TKC",
"qty": 4,
"cost": "25.3",
"markup": "19",
"serial": "TKC-UMO",
"id": "rtlrzik1ndx"
},
{
"desc": "Moss Green Shaker SCR",
"qty": 4,
"cost": "20.24",
"markup": "19",
"serial": "SCR-UMO",
"id": "rw411hf4ja"
},
{
"desc": "Moss Green Shaker ACM8",
"qty": 2,
"cost": "72.68",
"markup": "19",
"serial": "ACM8-UMO",
"id": "rmx7pmcf0mq"
},
{
"desc": "Moss Green Shaker F642",
"qty": 2,
"cost": "43.24",
"markup": "19",
"serial": "F642-UMO",
"id": "r2hcd8cofqf"
},
{
"desc": "Moss Green Shaker W3018",
"qty": 1,
"cost": "231.85",
"markup": "19",
"serial": "W3018-UMO",
"id": "rehwnwgeygx"
},
{
"desc": "Moss Green Shaker W2442",
"qty": 2,
"cost": "387.79",
"markup": "19",
"serial": "W2442-UMO",
"id": "ruw1y7e17zw"
},
{
"desc": "Moss Green Shaker 3VDB24",
"qty": 1,
"cost": "506.01",
"markup": "19",
"serial": "3VDB24-UMO",
"id": "rewbsd9obrb"
},
{
"desc": "Moss Green Shaker 3VDB12",
"qty": 1,
"cost": "394.23",
"markup": "19",
"serial": "3VDB12-UMO",
"id": "r70ebri4gpw"
},
{
"desc": "Moss Green Shaker VS30S",
"qty": 4,
"cost": "344.08",
"markup": "19",
"serial": "VS30S-UMO",
"id": "rrc42y6js5f"
},
{
"desc": "Moss Green Shaker B21",
"qty": 1,
"cost": "359.73",
"markup": "19",
"serial": "B21-UMO",
"id": "rysuk67vgxk"
},
{
"desc": "Moss Green Shaker B24",
"qty": 3,
"cost": "395.15",
"markup": "19",
"serial": "B24-UMO",
"id": "rfgzs73w2lp"
}
],
"labor": [
{
"name": "Assembly",
"rate": "22.25",
"hours": "10.25"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "mesa-ridge",
"modelName": "Mesa Ridge",
"unitIndex": 2,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Moss Green Shaker",
"revenueStream": "cabinets",
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9f7hxryl4it": {
"id": "mumz2cc9f7hxryl4it",
"status": "contract",
"jobCode": "FM-2609-781",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"project": "Cimarron Peak 2",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview White Shaker W362424",
"qty": 1,
"cost": "278.56",
"markup": "72",
"serial": "W362424-SBW",
"id": "r9egjeea9hx"
},
{
"desc": "Bayview White Shaker F342",
"qty": 1,
"cost": "19.66",
"markup": "0",
"serial": "F342-SBW",
"id": "r3q90nulpbh"
},
{
"desc": "Bayview White Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SBW",
"id": "r705pa7g2mc"
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"qty": 3,
"cost": "17.97",
"markup": "58",
"serial": "SM8(SCR)-SBW",
"id": "rgpxnjc6hoj"
},
{
"desc": "Bayview White Shaker ACM8",
"qty": 2,
"cost": "72.45",
"markup": "72",
"serial": "ACM8-SBW",
"id": "rupo1zxtbcf"
},
{
"desc": "Bayview White Shaker TKC",
"qty": 3,
"cost": "19.66",
"markup": "72",
"serial": "TKC-SBW",
"id": "rk6bz4rsdx3"
},
{
"desc": "Bayview White Shaker W2142",
"qty": 2,
"cost": "217.34",
"markup": "72",
"serial": "W2142-SBW",
"id": "rndsys5imqy"
},
{
"desc": "Bayview White Shaker W3018",
"qty": 1,
"cost": "158.37",
"markup": "72",
"serial": "W3018-SBW",
"id": "rhvcla0r54u"
},
{
"desc": "Bayview White Shaker 3VDB12",
"qty": 1,
"cost": "272.94",
"markup": "72",
"serial": "3VDB12-SBW",
"id": "rdvmz1xz24f"
},
{
"desc": "Bayview White Shaker VS30",
"qty": 3,
"cost": "230.26",
"markup": "72",
"serial": "VS30-SBW",
"id": "r9d2mbdljs2"
},
{
"desc": "Bayview White Shaker VS36",
"qty": 1,
"cost": "263.39",
"markup": "72",
"serial": "VS36-SBW",
"id": "rs4ue1w4gmb"
},
{
"desc": "Bayview White Shaker 2DB36",
"qty": 1,
"cost": "421.2",
"markup": "72",
"serial": "2DB36-SBW",
"id": "rf83vzuko2l"
},
{
"desc": "Bayview White Shaker SB36",
"qty": 1,
"cost": "299.9",
"markup": "72",
"serial": "SB36-SBW",
"id": "rw6j25312a4"
},
{
"desc": "Bayview White Shaker B18",
"qty": 1,
"cost": "230.26",
"markup": "72",
"serial": "B18-SBW",
"id": "r9c0g91e5nx"
},
{
"desc": "Bayview White Shaker 3DB21",
"qty": 1,
"cost": "353.25",
"markup": "72",
"serial": "3DB21-SBW",
"id": "rsqo0inopyo"
},
{
"desc": "Bayview White Shaker B21",
"qty": 1,
"cost": "247.1",
"markup": "72",
"serial": "B21-SBW",
"id": "rxahll7xb8f"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "11.5"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "cimarron-peak",
"modelName": "Cimarron Peak",
"unitIndex": 2,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview White Shaker",
"revenueStream": "cabinets",
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9gpc8kcdic0e": {
"id": "mumz2cc9gpc8kcdic0e",
"status": "contract",
"jobCode": "FM-2609-269",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"project": "Pinyon Crest 2",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Moss Green Shaker W362424",
"qty": 1,
"cost": "396.06",
"markup": "18",
"serial": "W362424-UMO",
"id": "rngkq1u268k"
},
{
"desc": "Moss Green Shaker F342",
"qty": 1,
"cost": "22.08",
"markup": "0",
"serial": "F342-UMO",
"id": "r5kkbe92aj1"
},
{
"desc": "Moss Green Shaker TUK",
"qty": 1,
"cost": "36.8",
"markup": "0",
"serial": "TUK-UMO",
"id": "r78ubfn6q4r"
},
{
"desc": "Moss Green Shaker TKC",
"qty": 3,
"cost": "25.3",
"markup": "18",
"serial": "TKC-UMO",
"id": "r645kpxb5qh"
},
{
"desc": "Moss Green Shaker SCR",
"qty": 3,
"cost": "20.24",
"markup": "18",
"serial": "SCR-UMO",
"id": "rpekj9ndeif"
},
{
"desc": "Moss Green Shaker LACM8",
"qty": 2,
"cost": "93.85",
"markup": "18",
"serial": "LACM8-UMO",
"id": "rz7w3eyxu76"
},
{
"desc": "Moss Green Shaker W3018",
"qty": 1,
"cost": "231.85",
"markup": "18",
"serial": "W3018-UMO",
"id": "r7wtrpmru14"
},
{
"desc": "Moss Green Shaker W3642",
"qty": 2,
"cost": "516.13",
"markup": "18",
"serial": "W3642-UMO",
"id": "rq6r3b4473a"
},
{
"desc": "Moss Green Shaker 3VDB12",
"qty": 1,
"cost": "394.23",
"markup": "18",
"serial": "3VDB12-UMO",
"id": "rc04nwyquqn"
},
{
"desc": "Moss Green Shaker VS36",
"qty": 2,
"cost": "413.55",
"markup": "18",
"serial": "VS36-UMO",
"id": "rwfp3w2sckx"
},
{
"desc": "Moss Green Shaker 3DB24",
"qty": 1,
"cost": "533.61",
"markup": "18",
"serial": "3DB24-UMO",
"id": "rtwhdjhw2i7"
},
{
"desc": "Moss Green Shaker SB36",
"qty": 1,
"cost": "427.81",
"markup": "18",
"serial": "SB36-UMO",
"id": "r2e5yafgob8"
},
{
"desc": "Moss Green Shaker 3DB18",
"qty": 1,
"cost": "474.27",
"markup": "18",
"serial": "3DB18-UMO",
"id": "rb55k2ydddv"
},
{
"desc": "Moss Green Shaker 2DB36",
"qty": 1,
"cost": "683.11",
"markup": "18",
"serial": "2DB36-UMO",
"id": "rwyccqo5yga"
},
{
"desc": "Moss Green Shaker B36",
"qty": 2,
"cost": "569.95",
"markup": "18",
"serial": "B36-UMO",
"id": "r4ep3uzwm7f"
}
],
"labor": [
{
"name": "Assembly",
"rate": "22.25",
"hours": "9"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "pinyon-crest",
"modelName": "Pinyon Crest",
"unitIndex": 2,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Moss Green Shaker",
"revenueStream": "cabinets",
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9j2wujzkxvs": {
"id": "mumz2cc9j2wujzkxvs",
"status": "contract",
"jobCode": "FM-2609-834",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"project": "San Luis 2",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview White Shaker W362424",
"qty": 1,
"cost": "278.56",
"markup": "70",
"serial": "W362424-SBW",
"id": "rkaatpjvz0v"
},
{
"desc": "Bayview White Shaker F342",
"qty": 1,
"cost": "19.66",
"markup": "50",
"serial": "F342-SBW",
"id": "rloy5qs9tzp"
},
{
"desc": "Bayview White Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SBW",
"id": "r1my4rznhcm"
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"qty": 3,
"cost": "17.97",
"markup": "70",
"serial": "SM8(SCR)-SBW",
"id": "rfkomh5i2dk"
},
{
"desc": "Bayview White Shaker ACM8",
"qty": 2,
"cost": "72.45",
"markup": "70",
"serial": "ACM8-SBW",
"id": "rgj8edlbfb7"
},
{
"desc": "Bayview White Shaker TKC",
"qty": 3,
"cost": "19.66",
"markup": "70",
"serial": "TKC-SBW",
"id": "rklmrcbn0by"
},
{
"desc": "Bayview White Shaker W3342",
"qty": 2,
"cost": "327.42",
"markup": "70",
"serial": "W3342-SBW",
"id": "roomf1qaf16"
},
{
"desc": "Bayview White Shaker W3018",
"qty": 1,
"cost": "158.37",
"markup": "70",
"serial": "W3018-SBW",
"id": "rln2f421x5y"
},
{
"desc": "Bayview White Shaker VS30",
"qty": 2,
"cost": "230.26",
"markup": "70",
"serial": "VS30-SBW",
"id": "ra7wukt0b6w"
},
{
"desc": "Bayview White Shaker SB36",
"qty": 1,
"cost": "299.9",
"markup": "70",
"serial": "SB36-SBW",
"id": "rls8l6eszor"
},
{
"desc": "Bayview White Shaker B18",
"qty": 2,
"cost": "230.26",
"markup": "70",
"serial": "B18-SBW",
"id": "rauu7z0k7i5"
},
{
"desc": "Bayview White Shaker B33",
"qty": 2,
"cost": "374.59",
"markup": "70",
"serial": "B33-SBW",
"id": "rzqyatusla2"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "12.5"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "san-luis",
"modelName": "San Luis",
"unitIndex": 2,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview White Shaker",
"revenueStream": "cabinets",
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9k6aox8a9r3g": {
"id": "mumz2cc9k6aox8a9r3g",
"status": "contract",
"jobCode": "FM-2609-697",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"customerEmail": "",
"project": "San Luis 1",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview White Shaker W362424",
"qty": 1,
"cost": "278.56",
"markup": "70",
"serial": "W362424-SBW",
"id": "rowng0szqsh"
},
{
"desc": "Bayview White Shaker F342",
"qty": 1,
"cost": "19.66",
"markup": "50",
"serial": "F342-SBW",
"id": "rnsmrx8o7q3"
},
{
"desc": "Bayview White Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SBW",
"id": "r0zsmo4v1ki"
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"qty": 3,
"cost": "17.97",
"markup": "70",
"serial": "SM8(SCR)-SBW",
"id": "r4rzpp5h8rt"
},
{
"desc": "Bayview White Shaker ACM8",
"qty": 2,
"cost": "72.45",
"markup": "70",
"serial": "ACM8-SBW",
"id": "ru43w5azh2c"
},
{
"desc": "Bayview White Shaker TKC",
"qty": 3,
"cost": "19.66",
"markup": "70",
"serial": "TKC-SBW",
"id": "r5s6q0o8jl2"
},
{
"desc": "Bayview White Shaker W3342",
"qty": 2,
"cost": "327.42",
"markup": "70",
"serial": "W3342-SBW",
"id": "rpabt3d9lls"
},
{
"desc": "Bayview White Shaker W3018",
"qty": 1,
"cost": "158.37",
"markup": "70",
"serial": "W3018-SBW",
"id": "r0ds7q6i1lh"
},
{
"desc": "Bayview White Shaker VS30",
"qty": 2,
"cost": "230.26",
"markup": "70",
"serial": "VS30-SBW",
"id": "r2qsxgq79jb"
},
{
"desc": "Bayview White Shaker SB36",
"qty": 1,
"cost": "299.9",
"markup": "70",
"serial": "SB36-SBW",
"id": "rz837ixgf7h"
},
{
"desc": "Bayview White Shaker B18",
"qty": 2,
"cost": "230.26",
"markup": "70",
"serial": "B18-SBW",
"id": "ro1o8ma99nj"
},
{
"desc": "Bayview White Shaker B33",
"qty": 2,
"cost": "374.59",
"markup": "70",
"serial": "B33-SBW",
"id": "rjdy2qqp2gy"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "12.5"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "san-luis",
"modelName": "San Luis",
"unitIndex": 1,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview White Shaker",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9nybyk4vqgrl": {
"id": "mumz2cc9nybyk4vqgrl",
"status": "contract",
"jobCode": "FM-2609-790",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"customerEmail": "",
"project": "Mesa Ridge 1",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Moss Green Shaker W362424",
"qty": 1,
"cost": "396.06",
"markup": "19",
"serial": "W362424-UMO",
"id": "rlgwrvivgv1"
},
{
"desc": "Moss Green Shaker F342",
"qty": 4,
"cost": "22.08",
"markup": "10",
"serial": "F342-UMO",
"id": "rs8r51fjjpw"
},
{
"desc": "Moss Green Shaker SB36",
"qty": 1,
"cost": "427.81",
"markup": "19",
"serial": "SB36-UMO",
"id": "rlyg40hq46t"
},
{
"desc": "Moss Green Shaker TUK",
"qty": 1,
"cost": "36.8",
"markup": "0",
"serial": "TUK-UMO",
"id": "rhvw4ox62zt"
},
{
"desc": "Moss Green Shaker TKC",
"qty": 4,
"cost": "25.3",
"markup": "19",
"serial": "TKC-UMO",
"id": "rxaouue31ic"
},
{
"desc": "Moss Green Shaker SCR",
"qty": 4,
"cost": "20.24",
"markup": "19",
"serial": "SCR-UMO",
"id": "rx0h12wltif"
},
{
"desc": "Moss Green Shaker ACM8",
"qty": 2,
"cost": "72.68",
"markup": "19",
"serial": "ACM8-UMO",
"id": "rg8voglestz"
},
{
"desc": "Moss Green Shaker F642",
"qty": 2,
"cost": "43.24",
"markup": "19",
"serial": "F642-UMO",
"id": "r91qo7i8a6x"
},
{
"desc": "Moss Green Shaker W3018",
"qty": 1,
"cost": "231.85",
"markup": "19",
"serial": "W3018-UMO",
"id": "r6ctvceq8l9"
},
{
"desc": "Moss Green Shaker W2442",
"qty": 2,
"cost": "387.79",
"markup": "19",
"serial": "W2442-UMO",
"id": "r8s3pxm2i01"
},
{
"desc": "Moss Green Shaker 3VDB24",
"qty": 1,
"cost": "506.01",
"markup": "19",
"serial": "3VDB24-UMO",
"id": "r9g21xkmecg"
},
{
"desc": "Moss Green Shaker 3VDB12",
"qty": 1,
"cost": "394.23",
"markup": "19",
"serial": "3VDB12-UMO",
"id": "r5fgrj8145j"
},
{
"desc": "Moss Green Shaker VS30S",
"qty": 4,
"cost": "344.08",
"markup": "19",
"serial": "VS30S-UMO",
"id": "r71vadv8jtc"
},
{
"desc": "Moss Green Shaker B21",
"qty": 1,
"cost": "359.73",
"markup": "19",
"serial": "B21-UMO",
"id": "r25fuq49t72"
},
{
"desc": "Moss Green Shaker B24",
"qty": 3,
"cost": "395.15",
"markup": "19",
"serial": "B24-UMO",
"id": "rdryfolvco2"
}
],
"labor": [
{
"name": "Assembly",
"rate": "22.25",
"hours": "10.25"
}
],
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "mesa-ridge",
"modelName": "Mesa Ridge",
"unitIndex": 1,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Moss Green Shaker",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9p553aei5a3i": {
"id": "mumz2cc9p553aei5a3i",
"status": "contract",
"jobCode": "FM-2609-333",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"customerEmail": "",
"project": "Pinyon Crest 1",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Moss Green Shaker W362424",
"qty": 1,
"cost": "396.06",
"markup": "18",
"serial": "W362424-UMO",
"id": "rdwcrooquj2"
},
{
"desc": "Moss Green Shaker F342",
"qty": 1,
"cost": "22.08",
"markup": "0",
"serial": "F342-UMO",
"id": "ruj1qsybrkq"
},
{
"desc": "Moss Green Shaker TUK",
"qty": 1,
"cost": "36.8",
"markup": "0",
"serial": "TUK-UMO",
"id": "ry2bnwn2kas"
},
{
"desc": "Moss Green Shaker TKC",
"qty": 3,
"cost": "25.3",
"markup": "18",
"serial": "TKC-UMO",
"id": "ri70oq5fm7s"
},
{
"desc": "Moss Green Shaker SCR",
"qty": 3,
"cost": "20.24",
"markup": "18",
"serial": "SCR-UMO",
"id": "rsqy1ya1ahn"
},
{
"desc": "Moss Green Shaker LACM8",
"qty": 2,
"cost": "93.85",
"markup": "18",
"serial": "LACM8-UMO",
"id": "r4idktv6ld1"
},
{
"desc": "Moss Green Shaker W3018",
"qty": 1,
"cost": "231.85",
"markup": "18",
"serial": "W3018-UMO",
"id": "rv5d7fq5q6r"
},
{
"desc": "Moss Green Shaker W3642",
"qty": 2,
"cost": "516.13",
"markup": "18",
"serial": "W3642-UMO",
"id": "r4obtttl4c4"
},
{
"desc": "Moss Green Shaker 3VDB12",
"qty": 1,
"cost": "394.23",
"markup": "18",
"serial": "3VDB12-UMO",
"id": "rqyxrp6ft84"
},
{
"desc": "Moss Green Shaker VS36",
"qty": 2,
"cost": "413.55",
"markup": "18",
"serial": "VS36-UMO",
"id": "r8avmg4ek7f"
},
{
"desc": "Moss Green Shaker 3DB24",
"qty": 1,
"cost": "533.61",
"markup": "18",
"serial": "3DB24-UMO",
"id": "rq0txh3vdgu"
},
{
"desc": "Moss Green Shaker SB36",
"qty": 1,
"cost": "427.81",
"markup": "18",
"serial": "SB36-UMO",
"id": "r5cf7wc998n"
},
{
"desc": "Moss Green Shaker 3DB18",
"qty": 1,
"cost": "474.27",
"markup": "18",
"serial": "3DB18-UMO",
"id": "rkslbypj8jz"
},
{
"desc": "Moss Green Shaker 2DB36",
"qty": 1,
"cost": "683.11",
"markup": "18",
"serial": "2DB36-UMO",
"id": "ri6qpv5qspv"
},
{
"desc": "Moss Green Shaker B36",
"qty": 2,
"cost": "569.95",
"markup": "18",
"serial": "B36-UMO",
"id": "razetivf3h8"
}
],
"labor": [
{
"name": "Assembly",
"rate": "22.25",
"hours": "9"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "pinyon-crest",
"modelName": "Pinyon Crest",
"unitIndex": 1,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Moss Green Shaker",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9sxazr5eqgw": {
"id": "mumz2cc9sxazr5eqgw",
"status": "contract",
"jobCode": "FM-2609-334",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"project": "Sangre Vista 2",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview Wood Shaker W362424",
"qty": 1,
"cost": "399.05",
"markup": "42",
"serial": "W362424-SWD",
"id": "rhwvpu5op8d"
},
{
"desc": "Bayview Wood Shaker F342",
"qty": 1,
"cost": "28.51",
"markup": "0",
"serial": "F342-SWD",
"id": "ro5tsn87a0h"
},
{
"desc": "Bayview Wood Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SWD",
"id": "r5pcfj63wrg"
},
{
"desc": "Bayview Wood Shaker S2496",
"qty": 1,
"cost": "166.65",
"markup": "42",
"serial": "S2496-SWD",
"id": "ryc1i3911g8"
},
{
"desc": "Bayview Wood Shaker WSV42",
"qty": 4,
"cost": "24.86",
"markup": "42",
"serial": "WSV42-SWD",
"id": "rl16xzrvuah"
},
{
"desc": "Bayview Wood Shaker BSV",
"qty": 3,
"cost": "38.01",
"markup": "42",
"serial": "BSV-SWD",
"id": "rzgne73m4nq"
},
{
"desc": "Bayview Wood Shaker SM8(SCR)",
"qty": 3,
"cost": "26.31",
"markup": "42",
"serial": "SM8(SCR)-SWD",
"id": "rkpw8ykphj0"
},
{
"desc": "Bayview Wood Shaker ACM8",
"qty": 2,
"cost": "103.79",
"markup": "42",
"serial": "ACM8-SWD",
"id": "rxj46mjqxjs"
},
{
"desc": "Bayview Wood Shaker TKC",
"qty": 3,
"cost": "28.51",
"markup": "42",
"serial": "TKC-SWD",
"id": "rx67pix600r"
},
{
"desc": "Bayview Wood Shaker W1242",
"qty": 1,
"cost": "213.42",
"markup": "42",
"serial": "W1242-SWD",
"id": "r8l9sloq10s"
},
{
"desc": "Bayview Wood Shaker W2142",
"qty": 1,
"cost": "316.47",
"markup": "42",
"serial": "W2142-SWD",
"id": "rqikdqzifn4"
},
{
"desc": "Bayview Wood Shaker W3018",
"qty": 1,
"cost": "229.5",
"markup": "42",
"serial": "W3018-SWD",
"id": "rce6n9kit62"
},
{
"desc": "Bayview Wood Shaker 3VDB12",
"qty": 1,
"cost": "391.74",
"markup": "42",
"serial": "3VDB12-SWD",
"id": "rr5sj5zt6th"
},
{
"desc": "Bayview Wood Shaker VS30",
"qty": 2,
"cost": "347.89",
"markup": "42",
"serial": "VS30-SWD",
"id": "rl2yov5qdn4"
},
{
"desc": "Bayview Wood Shaker VS36",
"qty": 1,
"cost": "391.01",
"markup": "42",
"serial": "VS36-SWD",
"id": "rbshpjr6c2n"
},
{
"desc": "Bayview Wood Shaker 3DB12",
"qty": 1,
"cost": "401.25",
"markup": "42",
"serial": "3DB12-SWD",
"id": "r3axyber1ex"
},
{
"desc": "Bayview Wood Shaker B21",
"qty": 1,
"cost": "359.59",
"markup": "42",
"serial": "B21-SWD",
"id": "rwqztlmslh2"
},
{
"desc": "Bayview Wood Shaker SB36",
"qty": 1,
"cost": "434.14",
"markup": "42",
"serial": "SB36-SWD",
"id": "rldh7k6hrqk"
},
{
"desc": "Bayview Wood Shaker 2DB36",
"qty": 1,
"cost": "524.02",
"markup": "42",
"serial": "2DB36-SWD",
"id": "r7ws0q2qjn0"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "9"
}
],
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "sangre-vista",
"modelName": "Sangre Vista",
"unitIndex": 2,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview Wood Shaker",
"revenueStream": "cabinets",
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9vk653p1gckb": {
"id": "mumz2cc9vk653p1gckb",
"status": "contract",
"jobCode": "FM-2609-712",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"customerEmail": "",
"project": "Cimarron Peak 1",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview White Shaker W362424",
"qty": 1,
"cost": "278.56",
"markup": "72",
"serial": "W362424-SBW",
"id": "rc0vm6y4fb6"
},
{
"desc": "Bayview White Shaker F342",
"qty": 1,
"cost": "19.66",
"markup": "0",
"serial": "F342-SBW",
"id": "rn434c06nnd"
},
{
"desc": "Bayview White Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SBW",
"id": "rbfrcg1ji9g"
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"qty": 3,
"cost": "17.97",
"markup": "58",
"serial": "SM8(SCR)-SBW",
"id": "rxnsgtbztg"
},
{
"desc": "Bayview White Shaker ACM8",
"qty": 2,
"cost": "72.45",
"markup": "72",
"serial": "ACM8-SBW",
"id": "rozgfy5p3sy"
},
{
"desc": "Bayview White Shaker TKC",
"qty": 3,
"cost": "19.66",
"markup": "72",
"serial": "TKC-SBW",
"id": "r8ovlu8el0i"
},
{
"desc": "Bayview White Shaker W2142",
"qty": 2,
"cost": "217.34",
"markup": "72",
"serial": "W2142-SBW",
"id": "r5ln7ifvgdb"
},
{
"desc": "Bayview White Shaker W3018",
"qty": 1,
"cost": "158.37",
"markup": "72",
"serial": "W3018-SBW",
"id": "rda84c3pndj"
},
{
"desc": "Bayview White Shaker 3VDB12",
"qty": 1,
"cost": "272.94",
"markup": "72",
"serial": "3VDB12-SBW",
"id": "r5fmnaiqcxn"
},
{
"desc": "Bayview White Shaker VS30",
"qty": 3,
"cost": "230.26",
"markup": "72",
"serial": "VS30-SBW",
"id": "raclwm3fegz"
},
{
"desc": "Bayview White Shaker VS36",
"qty": 1,
"cost": "263.39",
"markup": "72",
"serial": "VS36-SBW",
"id": "rkbxswn6uv4"
},
{
"desc": "Bayview White Shaker 2DB36",
"qty": 1,
"cost": "421.2",
"markup": "72",
"serial": "2DB36-SBW",
"id": "rlfvu28241o"
},
{
"desc": "Bayview White Shaker SB36",
"qty": 1,
"cost": "299.9",
"markup": "72",
"serial": "SB36-SBW",
"id": "r1tu1rdnhj0"
},
{
"desc": "Bayview White Shaker B18",
"qty": 1,
"cost": "230.26",
"markup": "72",
"serial": "B18-SBW",
"id": "rklu2lqxnxp"
},
{
"desc": "Bayview White Shaker 3DB21",
"qty": 1,
"cost": "353.25",
"markup": "72",
"serial": "3DB21-SBW",
"id": "r5tu8514s0f"
},
{
"desc": "Bayview White Shaker B21",
"qty": 1,
"cost": "247.1",
"markup": "72",
"serial": "B21-SBW",
"id": "rhjft0q6c3t"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "11.5"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "cimarron-peak",
"modelName": "Cimarron Peak",
"unitIndex": 1,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview White Shaker",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793046366791
},
"fm-quote-mumz2cc9z1fwanuwfhg": {
"id": "mumz2cc9z1fwanuwfhg",
"status": "contract",
"jobCode": "FM-2609-862",
"customer": "Willow Creek Estates",
"signerName": "Rod Stambaugh",
"customerEmail": "",
"project": "Sangre Vista 1",
"date": "2026-09-29",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "12",
"cabinets": [
{
"desc": "Bayview Wood Shaker W362424",
"qty": 1,
"cost": "399.05",
"markup": "42",
"serial": "W362424-SWD",
"id": "reogxx8jjo7"
},
{
"desc": "Bayview Wood Shaker F342",
"qty": 1,
"cost": "28.51",
"markup": "0",
"serial": "F342-SWD",
"id": "r38an9ioibh"
},
{
"desc": "Bayview Wood Shaker TUK",
"qty": 1,
"cost": "31.45",
"markup": "0",
"serial": "TUK-SWD",
"id": "rwmrnu93rph"
},
{
"desc": "Bayview Wood Shaker S2496",
"qty": 1,
"cost": "166.65",
"markup": "42",
"serial": "S2496-SWD",
"id": "rire45teyti"
},
{
"desc": "Bayview Wood Shaker WSV42",
"qty": 4,
"cost": "24.86",
"markup": "42",
"serial": "WSV42-SWD",
"id": "rgzxsabgwn4"
},
{
"desc": "Bayview Wood Shaker BSV",
"qty": 3,
"cost": "38.01",
"markup": "42",
"serial": "BSV-SWD",
"id": "rj18dyqy3zi"
},
{
"desc": "Bayview Wood Shaker SM8(SCR)",
"qty": 3,
"cost": "26.31",
"markup": "42",
"serial": "SM8(SCR)-SWD",
"id": "r1t81lyt8vw"
},
{
"desc": "Bayview Wood Shaker ACM8",
"qty": 2,
"cost": "103.79",
"markup": "42",
"serial": "ACM8-SWD",
"id": "rthgtspksk7"
},
{
"desc": "Bayview Wood Shaker TKC",
"qty": 3,
"cost": "28.51",
"markup": "42",
"serial": "TKC-SWD",
"id": "rd71aq7zkxt"
},
{
"desc": "Bayview Wood Shaker W1242",
"qty": 1,
"cost": "213.42",
"markup": "42",
"serial": "W1242-SWD",
"id": "roieph7bkb8"
},
{
"desc": "Bayview Wood Shaker W2142",
"qty": 1,
"cost": "316.47",
"markup": "42",
"serial": "W2142-SWD",
"id": "r5epsgehfn1"
},
{
"desc": "Bayview Wood Shaker W3018",
"qty": 1,
"cost": "229.5",
"markup": "42",
"serial": "W3018-SWD",
"id": "rinusqnnidu"
},
{
"desc": "Bayview Wood Shaker 3VDB12",
"qty": 1,
"cost": "391.74",
"markup": "42",
"serial": "3VDB12-SWD",
"id": "r701l5blbin"
},
{
"desc": "Bayview Wood Shaker VS30",
"qty": 2,
"cost": "347.89",
"markup": "42",
"serial": "VS30-SWD",
"id": "rryzca7bj40"
},
{
"desc": "Bayview Wood Shaker VS36",
"qty": 1,
"cost": "391.01",
"markup": "42",
"serial": "VS36-SWD",
"id": "r8xkerajckh"
},
{
"desc": "Bayview Wood Shaker 3DB12",
"qty": 1,
"cost": "401.25",
"markup": "42",
"serial": "3DB12-SWD",
"id": "r85pqoh4lru"
},
{
"desc": "Bayview Wood Shaker B21",
"qty": 1,
"cost": "359.59",
"markup": "42",
"serial": "B21-SWD",
"id": "r0jank3hvua"
},
{
"desc": "Bayview Wood Shaker SB36",
"qty": 1,
"cost": "434.14",
"markup": "42",
"serial": "SB36-SWD",
"id": "r52w9slzrx6"
},
{
"desc": "Bayview Wood Shaker 2DB36",
"qty": 1,
"cost": "524.02",
"markup": "42",
"serial": "2DB36-SWD",
"id": "rw0uijcuxr8"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "9"
}
],
"ar": null,
"installDate": "2026-11-20",
"modelQty": 1,
"quoteVersions": [],
"kind": "child",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "mumz2cc8cj0mbh2rcfq",
"childIds": [],
"modelMix": [],
"modelKey": "sangre-vista",
"modelName": "Sangre Vista",
"unitIndex": 1,
"builderProgram": "",
"builderId": "",
"payPlan": "50-50",
"colorName": "Bayview Wood Shaker",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793046366791
},
"fm-quote-mvleseeq6wwc6eqzlae": {
"id": "mvleseeq6wwc6eqzlae",
"status": "proposed",
"jobCode": "FM-2610-475",
"customer": "Willow Creek Change Order 10/23/26",
"signerName": "Willow Creek Change Order 10/23/26",
"customerEmail": "",
"project": "",
"date": "2026-10-23",
"address": "",
"gnaPct": "2",
"taxPct": "7.9",
"bulkDiscPct": "5",
"cabinets": [
{
"desc": "Bayview White Shaker W3042",
"qty": 4,
"cost": "307.76",
"markup": "70",
"serial": "W3042-SBW",
"id": "r4r0dzk9jcz"
},
{
"desc": "Bayview White Shaker B30",
"qty": 2,
"cost": "353.81",
"markup": "72",
"serial": "B30-SBW",
"id": "recxksto67f"
},
{
"desc": "Moss Green Shaker W3024",
"qty": 4,
"cost": "277.39",
"markup": "18",
"serial": "W3024-UMO",
"id": "rdesqhah7bq"
},
{
"desc": "Bayview Wood Shaker W3024",
"qty": 2,
"cost": "275.54",
"markup": "42",
"serial": "W3024-SWD",
"id": "r1x03rk7utv"
},
{
"desc": "Bayview White Shaker W3024",
"qty": 4,
"cost": "190.94",
"markup": "70",
"serial": "W3024-SBW",
"id": "ruo9kldq15e"
},
{
"desc": "Bayview Wood Shaker OCM8",
"qty": 1,
"cost": "26.31",
"markup": "42",
"serial": "OCM8-SWD",
"id": "raz7mvscrtr"
},
{
"desc": "Bayview Wood Shaker SM8(SCR)",
"qty": 1,
"cost": "26.31",
"markup": "0",
"serial": "SM8(SCR)-SWD",
"id": "rt4bvzo2wda"
},
{
"desc": "Bayview Wood Shaker FPV4296",
"qty": 2,
"cost": "123.52",
"markup": "42",
"serial": "FPV4296-SWD",
"id": "rirw3kk86xm"
},
{
"desc": "Bayview White Shaker SM8(SCR)",
"qty": 1,
"cost": "17.97",
"markup": "50",
"serial": "SM8(SCR)-SBW",
"id": "rk9g691m07o"
},
{
"desc": "Bayview White Shaker OCM8",
"qty": 1,
"cost": "19.1",
"markup": "70",
"serial": "OCM8-SBW",
"id": "r19qu2zjkd9"
},
{
"desc": "Bayview White Shaker FPV4296",
"qty": 3,
"cost": "85.36",
"markup": "72",
"serial": "FPV4296-SBW",
"id": "rg0u1a5d8d0"
},
{
"desc": "Moss Green Shaker OCM",
"qty": 1,
"cost": "44.16",
"markup": "18",
"serial": "OCM-UMO",
"id": "r7gr8iolb9w"
},
{
"desc": "Moss Green Shaker SCR",
"qty": 1,
"cost": "20.24",
"markup": "30",
"serial": "SCR-UMO",
"id": "r2a7pdx7pi9"
},
{
"desc": "Moss Green Shaker FPV4296",
"qty": 3,
"cost": "122.82",
"markup": "18",
"serial": "FPV4296-UMO",
"id": "r93p48t2qi8"
}
],
"labor": [
{
"name": "Assembly",
"rate": "20.5",
"hours": "5"
}
],
"reconciliationData": null,
"ar": null,
"installDate": "",
"modelQty": 1,
"quoteVersions": [],
"kind": "job",
"isOrder": false,
"isTemplate": false,
"parentOrderId": "",
"childIds": [],
"modelMix": [],
"modelKey": "",
"modelName": "",
"unitIndex": 0,
"builderProgram": "",
"builderId": "",
"payPlan": "50-30-20",
"colorName": "",
"revenueStream": "cabinets",
"changeOrders": [],
"originalCabinets": null,
"signRequests": [],
"elevationDraft": null,
"elevationVersions": [],
"saved_at": 1793114627312
},
"fm-balance-sheet": {
"date": "",
"bs-cash": "4807.72",
"bs-ar": "0",
"bs-inventory": "0",
"bs-prepaid": "0",
"bs-equipment": "19323.35",
"bs-vehicles": "0",
"bs-leasehold": "0",
"bs-accum-dep": "18723.35",
"bs-ap": "4528.86",
"bs-cc": "0",
"bs-accrued": "0",
"bs-note-current": "17196",
"bs-note-lt": "82804",
"bs-fca-loan": "0",
"bs-equity-stan": "108562.77",
"bs-equity-partner": "0",
"bs-retained": "-100196.88",
"bs-net-income": "-7487.03"
},
"fm-cpnl-2026-09": {
"other-revenue": 0,
"freight": 0,
"salaries": 10550,
"owner-draw": 3293,
"rent": 2255,
"vehicle": 72.86,
"fuel": 0,
"insurance": 0,
"tools": 0,
"tech": 0,
"marketing": 0,
"professional": 0,
"office": 0,
"misc": 0,
"depreciation": 182.14,
"interest": 500,
"principal": 1433
},
"fm-cpnl-2026-07": {
"other-revenue": 0,
"freight": 0,
"salaries": 0,
"owner-draw": 0,
"rent": 0,
"vehicle": 72.86,
"fuel": 0,
"insurance": 0,
"tools": 0,
"tech": 1308.58,
"marketing": 0,
"professional": 4250,
"office": 60.24,
"misc": 207,
"depreciation": 0,
"interest": 0,
"principal": 0
},
"fm-cpnl-2026-08": {
"other-revenue": 0,
"freight": 0,
"salaries": 10550,
"owner-draw": 3293,
"rent": 2255,
"vehicle": 72.86,
"fuel": 0,
"insurance": 0,
"tools": 0,
"tech": 0,
"marketing": 0,
"professional": 0,
"office": 0,
"misc": 0,
"depreciation": 182.14,
"interest": 500,
"principal": 1433
}
}));
