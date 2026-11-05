/*
 * The Company P&L months and Balance Sheet from the existing tool, read Nov 5 2026 and converted to cents
 * (exactly what FMLegacy.read(bundle).company gives). The preview starts the company books from this, read-only.
 * In production, Hermes builds it from the live bundle with FMLegacy.read.
 */
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.FM_COMPANY_LEGACY = data;
}(typeof globalThis !== 'undefined' ? globalThis : this, {
 "months": {
  "2026-07": {
   "otherRevenue": 0,
   "freight": 0,
   "guaranteedPayments": 0,
   "contractLabor": 0,
   "rent": 0,
   "vehicle": 7286,
   "fuel": 0,
   "insurance": 0,
   "tools": 0,
   "tech": 130858,
   "marketing": 0,
   "professional": 425000,
   "office": 6024,
   "misc": 20700,
   "depreciation": 0,
   "interest": 0,
   "principal": 0
  },
  "2026-08": {
   "otherRevenue": 0,
   "freight": 0,
   "guaranteedPayments": 1055000,
   "contractLabor": 329300,
   "rent": 225500,
   "vehicle": 7286,
   "fuel": 0,
   "insurance": 0,
   "tools": 0,
   "tech": 0,
   "marketing": 0,
   "professional": 0,
   "office": 0,
   "misc": 0,
   "depreciation": 18214,
   "interest": 50000,
   "principal": 143300
  },
  "2026-09": {
   "otherRevenue": 0,
   "freight": 0,
   "guaranteedPayments": 1055000,
   "contractLabor": 329300,
   "rent": 225500,
   "vehicle": 7286,
   "fuel": 0,
   "insurance": 0,
   "tools": 0,
   "tech": 0,
   "marketing": 0,
   "professional": 0,
   "office": 0,
   "misc": 0,
   "depreciation": 18214,
   "interest": 50000,
   "principal": 143300
  }
 },
 "balance": {
  "asOf": "",
  "values": {
   "cash": 480772,
   "receivable": 0,
   "inventory": 0,
   "prepaid": 0,
   "equipment": 1932335,
   "vehicles": 0,
   "leasehold": 0,
   "accumDepreciation": 1872335,
   "payable": 452886,
   "creditCards": 0,
   "accrued": 0,
   "noteCurrent": 1719600,
   "noteLongTerm": 8280400,
   "fcaLoan": 0,
   "equityUnbridled": 10856277,
   "equityBigFam": 0,
   "retained": -10019688,
   "netIncomeYtd": -748703
  }
 }
}));
