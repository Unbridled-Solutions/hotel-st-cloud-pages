/*
 * Fremont Makers · Project Builder · Phase 2 · Company P&L and Balance Sheet (HANDOFF §31).  window.FMCompany
 * Pure functions: no DOM, storage or network. Money in integer cents.
 *
 * Carried over from the existing tool's "P&L" and "Balance Sheet" pages, with the same lines, notes and starting
 * amounts, and the owner's numbers brought across read-only (FMLegacy.read(...).company). What changes:
 *   - Revenue and cabinet cost come from the job books (FMBooks.profitAndLoss): revenue is the contract LESS sales tax,
 *     and cabinet cost is the supplier's quoted cost LESS the manufacturer's discount, plus courtesy absorbed. The old page
 *     counted sales tax as revenue and took cost before the discount.
 *   - The old "Assembly labor (from jobs)" expense row is gone: assembly billed to customers counts fully as gross profit
 *     (owner, Nov 4 2026); what the shop pays for the work is in Contract labor and Guaranteed payments.
 *   - A month nobody has entered uses the standard monthly amounts and says so ("estimate"). The old page did the same silently,
 *     even for months before the business kept records; here, months before the first one entered show no expenses ("before records").
 *   - Editing needs Full access, and every change is logged with who and when. The old page's passwords are not used.
 *
 * company state: { months: { 'YYYY-MM': { key: cents } }, standard: { key: cents }, balance: { asOf, values: { key: cents } }, log: [] }
 */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = isNode ? factory(require('./fm-phase2-books.js')) : factory(root.FMBooks);
  if (isNode) module.exports = api; else root.FMCompany = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (BK) {
  'use strict';
  var VERSION = '1.0.0';
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmt(c) { var n = Math.abs(c || 0), s = (n / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (c < 0 ? '−$' : '$') + s; }

  /* The P&L lines you type in, in the old page's order, with its notes. */
  var LINES = [
    { key: 'otherRevenue', section: 'revenue', label: 'Other revenue' },
    { key: 'freight', section: 'cogs', label: 'Freight / delivery' },
    { key: 'guaranteedPayments', section: 'opex', label: 'Guaranteed payments (K-1)', note: 'Tim $85K/yr + Kristy' },
    { key: 'contractLabor', section: 'opex', label: 'Contract labor (1099)', note: 'Tayler' },
    { key: 'rent', section: 'opex', label: 'Rent / warehouse', note: '719 Main' },
    { key: 'vehicle', section: 'opex', label: 'Vehicle / truck' },
    { key: 'fuel', section: 'opex', label: 'Fuel' },
    { key: 'insurance', section: 'opex', label: 'Insurance' },
    { key: 'tools', section: 'opex', label: 'Tools & equipment' },
    { key: 'tech', section: 'opex', label: 'Cell / technology' },
    { key: 'marketing', section: 'opex', label: 'Marketing' },
    { key: 'professional', section: 'opex', label: 'Professional fees' },
    { key: 'office', section: 'opex', label: 'Office supplies' },
    { key: 'misc', section: 'opex', label: 'Miscellaneous', note: 'FCA frame shop $207/mo' },
    { key: 'depreciation', section: 'below', label: 'Depreciation' },
    { key: 'interest', section: 'below', label: 'Interest expense', note: '$100K note @ 6%' },
    { key: 'principal', section: 'below', label: 'Principal payment', note: '$1,933/mo total' }
  ];
  var BY_KEY = {}; LINES.forEach(function (l) { BY_KEY[l.key] = l; });

  /* The old page's standard monthly amounts (used for any month nobody has entered). */
  var STANDARD = { otherRevenue: 0, freight: 0, guaranteedPayments: 1055000, contractLabor: 329300, rent: 225500, vehicle: 7286, fuel: 0, insurance: 0, tools: 0,
    tech: 130858, marketing: 0, professional: 425000, office: 6024, misc: 20700, depreciation: 18214, interest: 50000, principal: 143300 };

  /* Balance Sheet lines, in the old page's order. `minus` lines are subtracted (accumulated depreciation). */
  var BALANCE = [
    { group: 'currentAssets', title: 'Current assets', lines: [['cash', 'Cash & checking'], ['receivable', 'Accounts receivable'], ['inventory', 'Inventory (cabinet stock)'], ['prepaid', 'Prepaid / deposits']] },
    { group: 'fixedAssets', title: 'Fixed assets', lines: [['equipment', 'Shop equipment (FCA financed)'], ['vehicles', 'Vehicles / trucks'], ['leasehold', 'Leasehold improvements'], ['accumDepreciation', 'Less: accumulated depreciation', true]] },
    { group: 'currentLiabilities', title: 'Current liabilities', lines: [['payable', 'Accounts payable'], ['creditCards', 'Credit cards'], ['accrued', 'Accrued expenses'], ['noteCurrent', 'Current portion · note payable']] },
    { group: 'longTermLiabilities', title: 'Long-term liabilities', lines: [['noteLongTerm', 'Note payable · Stan Bullis ($100K @ 6%, 60 mo)'], ['fcaLoan', 'FCA equipment financing']] },
    { group: 'equity', title: 'Members\' equity', lines: [['equityUnbridled', 'Unbridled Companies · capital'], ['equityBigFam', 'BigFam, LLC · capital'], ['retained', 'Retained earnings'], ['netIncomeYtd', 'Net income (YTD)']] }
  ];
  var BAL_LABEL = {}; BALANCE.forEach(function (g) { g.lines.forEach(function (l) { BAL_LABEL[l[0]] = l[1]; }); });

  /* Start from the existing tool's numbers (FMLegacy.read(bundle).company). */
  function fromLegacy(legacy) {
    legacy = legacy || {};
    var values = {}; BALANCE.forEach(function (g) { g.lines.forEach(function (l) { values[l[0]] = 0; }); });
    if (legacy.balance) Object.keys(legacy.balance.values || {}).forEach(function (k) { values[k] = legacy.balance.values[k]; });
    return { months: clone(legacy.months || {}), standard: clone(STANDARD), balance: { asOf: (legacy.balance && legacy.balance.asOf) || '', values: values },
             log: [], source: 'Brought over from the existing tool (read-only copy).' };
  }

  /* ---------- months and periods ---------- */
  function ym(iso) { return String(iso).slice(0, 7); }
  function addMonths(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + (mo < 9 ? '0' : '') + (mo + 1); }
  function lastDay(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7); return m + '-' + String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0'); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthLabel(m) { return MON[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  /* mode: 'rolling3' (this month and the next two, as the old page), 'month' (pick 'YYYY-MM'), 'quarter' ('YYYY-Q3'), 'year' ('YYYY') */
  function columns(mode, pick, today) {
    var now = ym(today);
    if (mode === 'month') return [pick || now];
    if (mode === 'quarter') { var q = /^(\d{4})-Q([1-4])$/.exec(pick || '') || [0, now.slice(0, 4), Math.ceil(+now.slice(5, 7) / 3)]; var s = q[1] + '-' + String((q[2] - 1) * 3 + 1).padStart(2, '0'); return [s, addMonths(s, 1), addMonths(s, 2)]; }
    if (mode === 'year') { var y = pick || now.slice(0, 4), out = []; for (var i = 1; i <= 12; i++) out.push(y + '-' + String(i).padStart(2, '0')); return out; }
    return [now, addMonths(now, 1), addMonths(now, 2)];
  }

  /* The first month anyone entered. Months before it are before the records start: nothing is estimated for them. */
  function firstMonth(company) { var ks = Object.keys(company.months || {}).sort(); return ks[0] || null; }
  function beforeRecords(company, m) { var f = firstMonth(company); return !!f && m < f && !company.months[m]; }
  function value(company, m, key) {
    var e = company.months[m];
    if (e && e[key] != null) return e[key];
    if (beforeRecords(company, m)) return 0;
    return (company.standard || STANDARD)[key] || 0;
  }

  /* One month's figures. books = FMStore.books() (Test / Void jobs are already left out). */
  function month(company, books, m) {
    var pl = BK.profitAndLoss(books, m + '-01', lastDay(m)), t = pl.totals, v = function (k) { return value(company, m, k); };
    var before = beforeRecords(company, m);
    var f = { month: m, label: monthLabel(m), estimated: !company.months[m] && !before, beforeRecords: before, jobs: pl.jobs.map(function (j) { return { jobCode: j.jobCode, customer: j.customer, project: j.project, revenueCents: j.revenueCents, costCents: j.costCents, absorbedCents: j.absorbedCents }; }),
      jobRevenue: t.revenueCents, cabinetCost: t.costCents, absorbed: t.absorbedCents, missingCost: pl.missingCost, input: {} };
    LINES.forEach(function (l) { f.input[l.key] = v(l.key); });
    f.totalRevenue = f.jobRevenue + f.input.otherRevenue;
    f.totalCogs = f.cabinetCost + f.absorbed + f.input.freight;
    f.grossProfit = f.totalRevenue - f.totalCogs;
    f.totalOpex = LINES.filter(function (l) { return l.section === 'opex'; }).reduce(function (s, l) { return s + f.input[l.key]; }, 0);
    f.ebitda = f.grossProfit - f.totalOpex;
    f.belowLine = f.input.depreciation + f.input.interest + f.input.principal;
    f.netIncome = f.ebitda - f.belowLine;
    f.grossMarginPct = f.totalRevenue ? Math.round(f.grossProfit * 1000 / f.totalRevenue) / 10 : 0;
    f.netMarginPct = f.totalRevenue ? Math.round(f.netIncome * 1000 / f.totalRevenue) / 10 : 0;
    return f;
  }

  var SUMS = ['jobRevenue', 'cabinetCost', 'absorbed', 'totalRevenue', 'totalCogs', 'grossProfit', 'totalOpex', 'ebitda', 'belowLine', 'netIncome'];
  function statement(company, books, months) {
    var cols = months.map(function (m) { return month(company, books, m); }), total = { input: {} };
    SUMS.forEach(function (k) { total[k] = cols.reduce(function (s, c) { return s + c[k]; }, 0); });
    LINES.forEach(function (l) { total.input[l.key] = cols.reduce(function (s, c) { return s + c.input[l.key]; }, 0); });
    total.grossMarginPct = total.totalRevenue ? Math.round(total.grossProfit * 1000 / total.totalRevenue) / 10 : 0;
    total.netMarginPct = total.totalRevenue ? Math.round(total.netIncome * 1000 / total.totalRevenue) / 10 : 0;
    return { months: cols, total: total, estimated: cols.filter(function (c) { return c.estimated; }).map(function (c) { return c.month; }) };
  }

  /* ---------- editing (Full access, logged) ---------- */
  function guard(user) { return !user || user.access !== 'full' ? 'Only someone with Full access can change the company books.' : null; }
  function setMonth(company, m, key, cents, user, at) {
    var err = guard(user); if (err) return { ok: false, error: err };
    if (!BY_KEY[key]) return { ok: false, error: 'Unknown line ' + key + '.' };
    if (!/^\d{4}-\d{2}$/.test(m)) return { ok: false, error: 'Pick a month.' };
    if (!isFinite(cents)) return { ok: false, error: 'Enter an amount.' };
    var next = clone(company), before = value(company, m, key);
    if (!next.months[m]) { next.months[m] = {}; LINES.forEach(function (l) { next.months[m][l.key] = value(company, m, l.key); }); }   // entering one line fixes the month's estimate
    next.months[m][key] = Math.round(cents);
    var text = 'Company P&L ' + monthLabel(m) + ' · ' + BY_KEY[key].label + ': ' + fmt(before) + ' → ' + fmt(Math.round(cents)) + (company.months[m] ? '' : ' (month entered; it was an estimate)');
    next.log = [{ at: at || new Date().toISOString(), by: user.name, text: text }].concat(next.log || []);
    return { ok: true, company: next, text: text };
  }
  function setStandard(company, key, cents, user, at) {
    var err = guard(user); if (err) return { ok: false, error: err };
    if (!BY_KEY[key]) return { ok: false, error: 'Unknown line ' + key + '.' };
    var next = clone(company), before = (company.standard || STANDARD)[key] || 0;
    next.standard = next.standard || clone(STANDARD); next.standard[key] = Math.round(cents);
    var text = 'Standard monthly amount · ' + BY_KEY[key].label + ': ' + fmt(before) + ' → ' + fmt(Math.round(cents)) + ' (months not yet entered)';
    next.log = [{ at: at || new Date().toISOString(), by: user.name, text: text }].concat(next.log || []);
    return { ok: true, company: next, text: text };
  }

  /* ---------- balance sheet ---------- */
  function balance(company, hints) {
    var v = (company.balance && company.balance.values) || {}, groups = {};
    BALANCE.forEach(function (g) { groups[g.group] = g.lines.reduce(function (s, l) { return s + (l[2] ? -1 : 1) * (v[l[0]] || 0); }, 0); });
    var assets = groups.currentAssets + groups.fixedAssets, liab = groups.currentLiabilities + groups.longTermLiabilities, le = liab + groups.equity, diff = assets - le;
    var out = { asOf: (company.balance && company.balance.asOf) || '', values: clone(v), groups: groups, totalAssets: assets, totalLiabilities: liab, totalLiabEquity: le,
      differenceCents: diff, balanced: Math.abs(diff) < 2, hints: [] };
    hints = hints || {};
    if (hints.receivableCents != null && hints.receivableCents !== (v.receivable || 0)) out.hints.push({ key: 'receivable', text: 'Customer invoices not yet paid, from the jobs: ' + fmt(hints.receivableCents) + '.' });
    if (hints.netIncomeYtdCents != null && hints.netIncomeYtdCents !== (v.netIncomeYtd || 0)) out.hints.push({ key: 'netIncomeYtd', text: 'Net income this year on the Company P&L: ' + fmt(hints.netIncomeYtdCents) + '.' });
    return out;
  }
  function setBalance(company, key, val, user, at) {
    var err = guard(user); if (err) return { ok: false, error: err };
    var next = clone(company), text;
    next.balance = next.balance || { asOf: '', values: {} };
    if (key === 'asOf') {
      if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) return { ok: false, error: 'Enter the date as YYYY-MM-DD.' };
      text = 'Balance sheet date: ' + (company.balance.asOf || 'none') + ' → ' + (val || 'none');
      next.balance.asOf = val || '';
    } else {
      if (!BAL_LABEL[key]) return { ok: false, error: 'Unknown line ' + key + '.' };
      if (!isFinite(val)) return { ok: false, error: 'Enter an amount.' };
      text = 'Balance sheet · ' + BAL_LABEL[key] + ': ' + fmt(next.balance.values[key] || 0) + ' → ' + fmt(Math.round(val));
      next.balance.values[key] = Math.round(val);
    }
    next.log = [{ at: at || new Date().toISOString(), by: user.name, text: text }].concat(next.log || []);
    return { ok: true, company: next, text: text };
  }
  /* CSV of the balance sheet, like the old page's Export. */
  function balanceCSV(company) {
    var b = balance(company), rows = [['Fremont Makers Cabinet Co. · Balance Sheet'], ['As of', b.asOf]];
    BALANCE.forEach(function (g) { rows.push([]); rows.push([g.title]); g.lines.forEach(function (l) { rows.push([l[1], ((l[2] ? -1 : 1) * (b.values[l[0]] || 0) / 100).toFixed(2)]); }); });
    rows.push([]); rows.push(['Total assets', (b.totalAssets / 100).toFixed(2)]); rows.push(['Total liabilities + equity', (b.totalLiabEquity / 100).toFixed(2)]);
    return rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
  }

  return { VERSION: VERSION, LINES: LINES, STANDARD: STANDARD, BALANCE: BALANCE, fromLegacy: fromLegacy, columns: columns, monthLabel: monthLabel, lastDay: lastDay,
           value: value, month: month, statement: statement, setMonth: setMonth, setStandard: setStandard, balance: balance, setBalance: setBalance, balanceCSV: balanceCSV };
}));
