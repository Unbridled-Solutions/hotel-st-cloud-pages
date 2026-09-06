/**
 * Live Refresh: Toast + Cloudbeds + MarginEdge for today (Denver) and yesterday.
 * Never touches hours (state), events, or typed budgets.
 */

const TZ = 'America/Denver';
const PROP = '23229145280711';
const TOAST_HOST = 'https://ws-api.toasttab.com';
const CB_HOST = 'https://hotels.cloudbeds.com/api/v1.2';
const ME_HOST = 'https://api.marginedge.com/public';

const GUIDS = {
  fp: '7b5dfe8b-f20e-40f9-b60c-18aa10cb083b',
  fph: 'e2e246ee-364f-40bc-b590-4a63945d2db7',
  socc: 'bf898a33-6274-493f-a39b-1c1dce882268',
};

const ME_UNITS = { fp: '1032921369', hsc: '1032920467' };
const FOOD_COGS = new Set(['Food', 'Beer', 'Wine', 'Liquor', 'N/A Bev', 'NA Bev', 'Non-Alcoholic']);
const SUPPLY_CATS = [
  'Kitchen Supplies',
  'Restaurant Supplies',
  'Paper Supplies',
  'Supplies/Hotel',
  'Cleaning / Janitorial Supplies',
  'Linen / Laundry',
  'Office Supplies',
  'Printing',
];
const SUPPLY_SET = new Set(SUPPLY_CATS);
const HSC_TITLES = new Set(['HSC DAY STAFF', 'HSC NIGHT STAFF']);
const MGMT = { fp: '412.00', fph: '206.00', hsc: '534.00', socc: '0' };
const HSC_CHRIS_OFF = '2026-09-14';
const HSC_MGMT_AFTER = '369.86';
function hscMgmtRate(ymd) {
  return ymd >= HSC_CHRIS_OFF ? HSC_MGMT_AFTER : MGMT.hsc;
}
const STATUS_KEY = 'bundle:uhg-sync-status';

function denverYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addYmd(s, n) {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(s) {
  const d = parseYmd(s);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}
function priorYearYmd(s) {
  // Toast "Same week last year" = same weekday, 52 weeks back (364 days).
  // Not the same calendar date. Aug 31 2026 Mon → Sep 1 2025 Mon.
  return addYmd(s, -364);
}
function rangeYmd(from, to) {
  const out = [];
  for (let s = from; s <= to; s = addYmd(s, 1)) out.push(s);
  return out;
}
function ymdToToast(s) { return s.replace(/-/g, ''); }
function fmtMoney(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '';
  return Number(n).toFixed(2);
}
function fmtOcc(n) {
  if (n == null || n === '') return '';
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return x.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
function ensure7(arr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  while (a.length < 7) a.push('');
  return a.slice(0, 7);
}
function blankWeek(extra = {}) {
  return Object.assign({
    pcts: ['', '', '', '', '', '', ''],
    revs: ['', '', '', '', '', '', ''],
    hrlyacts: ['', '', '', '', '', '', ''],
    mgmtacts: ['', '', '', '', '', '', ''],
    actrevs: ['', '', '', '', '', '', ''],
    evtrevs: ['', '', '', '', '', '', ''],
    bookedrevs: ['', '', '', '', '', '', ''],
    occrooms: ['', '', '', '', '', '', ''],
    state: {},
  }, extra);
}
function setDay(week, field, ymd, val) {
  if (val === '' || val == null) return false;
  const di = parseYmd(ymd).getUTCDay();
  const idx = di === 0 ? 6 : di - 1;
  const arr = ensure7(week[field]);
  if (arr[idx] === val) return false;
  arr[idx] = val;
  week[field] = arr;
  return true;
}
function fillStandingMgmt(week, rate) {
  const arr = ensure7(week.mgmtacts);
  if (arr.some((v) => v !== '' && v != null)) return false;
  week.mgmtacts = [rate, rate, rate, rate, rate, rate, rate];
  return true;
}
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url, opts = {}, retries = 5) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(20000, 800 * 2 ** i);
        await sleep(wait);
        last = new Error('HTTP ' + res.status);
        continue;
      }
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url.split('?')[0].slice(-40));
      return { body, headers: res.headers, status: res.status };
    } catch (e) {
      last = e;
      await sleep(Math.min(12000, 400 * 2 ** i));
    }
  }
  throw last || new Error('fetch failed');
}

async function kvGet(env, ns) {
  const raw = await env.PLANNER_DATA.get('bundle:' + ns);
  return raw ? JSON.parse(raw) : {};
}
async function kvPut(env, ns, data) {
  await env.PLANNER_DATA.put('bundle:' + ns, JSON.stringify(data));
}
async function setStatus(env, st) {
  await env.PLANNER_DATA.put(STATUS_KEY, JSON.stringify(st));
}

async function toastLogin(env) {
  const { body } = await fetchJson(TOAST_HOST + '/authentication/v1/authentication/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env.TOAST_CLIENT_ID,
      clientSecret: env.TOAST_CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  });
  const token = body?.token?.accessToken;
  if (!token) throw new Error('Toast auth failed');
  return token;
}
function toastHeaders(token, guid) {
  return {
    Authorization: 'Bearer ' + token,
    'Toast-Restaurant-External-ID': guid,
    Accept: 'application/json',
  };
}
async function toastGet(token, guid, path, params) {
  const url = new URL(TOAST_HOST + path);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const { body } = await fetchJson(url.toString(), { headers: toastHeaders(token, guid) });
  return body;
}

function checkNet(c) {
  if (c.voided || c.deleted) return 0;
  let amt = Number(c.amount || 0);
  for (const s of c.selections || []) {
    if (s.voided || s.deleted) continue;
    if (s.deferred) amt -= Number(s.price || 0);
    if (s.selectionType === 'HOUSE_ACCOUNT_PAY_BALANCE') amt -= Number(s.price || 0);
  }
  for (const sc of c.appliedServiceCharges || []) {
    if (sc.serviceChargeCategory === 'FUNDRAISING_CAMPAIGN') {
      amt -= Number(sc.chargeAmount || sc.amount || 0);
    }
  }
  return amt;
}
async function dayOrders(token, guid, ymd) {
  const orders = [];
  for (let page = 1; page <= 25; page++) {
    const body = await toastGet(token, guid, '/orders/v2/ordersBulk', {
      businessDate: ymdToToast(ymd), pageSize: '100', page: String(page),
    });
    if (!Array.isArray(body) || !body.length) break;
    orders.push(...body);
    if (body.length < 100) break;
  }
  return orders;
}
async function dayRefunds(token, guid, ymd) {
  const ids = await toastGet(token, guid, '/orders/v2/payments', {
    refundBusinessDate: ymdToToast(ymd),
  });
  if (!Array.isArray(ids) || !ids.length) return 0;
  let total = 0;
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    const p = await toastGet(token, guid, '/orders/v2/payments/' + id);
    const ra = Number(p?.refund?.refundAmount || 0);
    total += ra;
  }
  return total;
}
function ordersNet(orders) {
  let total = 0;
  let n = 0;
  for (const o of orders) {
    if (o.voided || o.deleted || o.excessFood) continue;
    for (const c of o.checks || []) {
      if (c.voided || c.deleted) continue;
      total += checkNet(c);
      n += 1;
    }
  }
  return { net: Math.round(total * 100) / 100, checks: n, orders: orders.length };
}
function hoursWorked(te) {
  const rh = Number(te.regularHours || 0);
  const oh = Number(te.overtimeHours || 0);
  if (te.outDate) return rh + oh;
  if (!te.inDate) return rh + oh;
  const start = Date.parse(te.inDate);
  if (!Number.isFinite(start)) return rh + oh;
  return Math.max(0, (Date.now() - start) / 3600000);
}
async function dayLabor(token, guid, jobs, ymd, mode) {
  const tes = await toastGet(token, guid, '/labor/v1/timeEntries', {
    businessDate: ymdToToast(ymd),
  });
  const list = Array.isArray(tes) ? tes : [];
  let pay = 0;
  let n = 0;
  let ot = 0;
  for (const te of list) {
    if (te.deleted) continue;
    const jg = te.jobReference?.guid;
    const job = jobs[jg] || {};
    const title = String(job.title || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const wage = te.hourlyWage;
    if (wage == null || job.wageFrequency === 'SALARY' || Number(wage) === 0) continue;
    if (mode === 'hsc' && !HSC_TITLES.has(title)) continue;
    if (mode === 'fph' && HSC_TITLES.has(title)) continue;
    const hours = hoursWorked(te);
    const oh = Number(te.overtimeHours || 0);
    if (oh) ot += oh;
    pay += Math.round(hours * Number(wage) * 100) / 100;
    n += 1;
  }
  return { pay: Math.round(pay * 100) / 100, n, ot: Math.round(ot * 100) / 100 };
}

async function loadJobs(token, guid) {
  const body = await toastGet(token, guid, '/labor/v1/jobs');
  const map = {};
  for (const j of body || []) map[j.guid] = j;
  return map;
}

async function cloudbedsOcc(env, ymd) {
  const url = `${CB_HOST}/getDashboard?propertyID=${PROP}&date=${ymd}`;
  const { body } = await fetchJson(url, {
    headers: { Authorization: 'Bearer ' + env.CLOUDBEDS_API_KEY, Accept: 'application/json' },
  });
  const data = body?.data || body || {};
  return data.percentageOccupied;
}
async function cloudbedsRoomRev(env, from, to, tight = false) {
  const ids = new Set();
  const checkInFrom = tight ? addYmd(from, -7) : addYmd(from, -14);
  const pageCap = tight ? 12 : 50;
  for (let page = 1; page <= pageCap; page++) {
    const url = `${CB_HOST}/getReservations?propertyID=${PROP}&pageSize=100&pageNumber=${page}`
      + `&checkInFrom=${checkInFrom}&checkInTo=${to}`;
    const { body } = await fetchJson(url, {
      headers: { Authorization: 'Bearer ' + env.CLOUDBEDS_API_KEY, Accept: 'application/json' },
    });
    const recs = body?.data || [];
    for (const rec of recs) {
      const st = String(rec.status || '').toLowerCase();
      if (['confirmed', 'checked_in', 'checked_out'].includes(st)) {
        const rid = rec.reservationID || rec.reservationId;
        if (rid) ids.add(String(rid));
      }
    }
    if (recs.length < 100) break;
  }
  const nightly = {};
  const list = [...ids];
  for (let i = 0; i < list.length; i += 20) {
    const batch = list.slice(i, i + 20);
    const url = `${CB_HOST}/getReservationsWithRateDetails?propertyID=${PROP}&reservationID=${batch.join(',')}`;
    try {
      const { body } = await fetchJson(url, {
        headers: { Authorization: 'Bearer ' + env.CLOUDBEDS_API_KEY, Accept: 'application/json' },
      });
      let data = body?.data || [];
      if (data && !Array.isArray(data)) data = [data];
      for (const res of data) {
        const rooms = res.rooms || res.reservationRooms || [];
        for (const room of rooms) {
          const rates = room.detailedRoomRates || {};
          for (const [day, amt] of Object.entries(rates)) {
            nightly[day] = (nightly[day] || 0) + Number(amt || 0);
          }
        }
      }
    } catch (_) { /* keep going */ }
  }
  const out = {};
  for (const d of rangeYmd(from, to)) out[d] = Math.round((nightly[d] || 0) * 100) / 100;
  return out;
}

function parsePnl(report) {
  const r = (report?.profitAndLossReports || [null])[0] || {};
  let food = 0;
  for (const c of r.cogs?.categories || []) {
    const name = String(c.name || '').trim();
    if (FOOD_COGS.has(name) || /^n\/?a\s*bev/i.test(name)) food += Number(c.total || 0);
  }
  const cats = {};
  for (const k of SUPPLY_CATS) cats[k] = 0;
  for (const it of r.expenses?.items || []) {
    const name = String(it.name || '').trim();
    if (SUPPLY_SET.has(name)) cats[name] = Math.round(Number(it.total || 0) * 100) / 100;
  }
  const supplies = Math.round(SUPPLY_CATS.reduce((s, k) => s + cats[k], 0) * 100) / 100;
  return { food: Math.round(food * 100) / 100, cats, supplies };
}
async function marginWeek(env, unitId, mon, sun) {
  const url = `${ME_HOST}/profitAndLoss/report?restaurantUnitId=${unitId}&startDate=${mon}&endDate=${sun}`;
  const { body } = await fetchJson(url, {
    headers: { 'x-api-key': env.MARGINEDGE_API_KEY, Accept: 'application/json' },
  });
  return parsePnl(body);
}

function weekKey(prefix, ymd) { return prefix + mondayOf(ymd); }
function applySeries(data, prefix, field, byDay, opts = {}) {
  let n = 0;
  for (const [ymd, val] of Object.entries(byDay)) {
    const key = weekKey(prefix, ymd);
    if (!data[key]) {
      if (!opts.create) continue;
      data[key] = blankWeek(opts.template || {});
      data[key].week = mondayOf(ymd);
    }
    const w = data[key];
    if (setDay(w, field, ymd, val)) {
      w.saved_at = Date.now();
      n += 1;
    }
    data[key] = w;
  }
  return n;
}

async function toastNetForDay(token, guid, ymd) {
  const orders = await dayOrders(token, guid, ymd);
  const refund = await dayRefunds(token, guid, ymd);
  const { net, orders: nOrd } = ordersNet(orders);
  const adj = Math.round((net - refund) * 100) / 100;
  if (nOrd === 0 && refund === 0) return '';
  return fmtMoney(adj);
}

const LYOY_GUID = { fp: GUIDS.fp, 'fp-ph': GUIDS.fph, socc: GUIDS.socc };
function lyoyNs(ns) { return ns + '-lyoy'; }

async function mergeLyoyDays(env, token, guid, lyDays, ns) {
  const cache = lyoyNs(ns);
  const lyoy = await kvGet(env, cache);
  let n = 0;
  for (const ly of lyDays) {
    if (lyoy[ly] !== undefined && lyoy[ly] !== null) continue;
    lyoy[ly] = await toastNetForDay(token, guid, ly);
    n += 1;
  }
  if (n) await kvPut(env, cache, lyoy);
  return { lyoy, filled: n };
}

async function mergeHscLyoyDays(env, lyDays) {
  const lyoy = await kvGet(env, 'hsc-lyoy');
  const missing = lyDays.filter((d) => {
    const rec = lyoy[d];
    return !rec || rec.occ == null || rec.occ === '' || rec.rev == null || rec.rev === '';
  });
  if (!missing.length) return { lyoy, filled: 0 };
  const from = missing.reduce((a, b) => (a < b ? a : b));
  const to = missing.reduce((a, b) => (a > b ? a : b));
  let roomRev = {};
  try { roomRev = await cloudbedsRoomRev(env, from, to, true); } catch (_) { roomRev = {}; }
  let n = 0;
  for (const ly of missing) {
    const rec = (lyoy[ly] && typeof lyoy[ly] === 'object') ? lyoy[ly] : {};
    if (rec.occ == null || rec.occ === '') {
      try { rec.occ = fmtOcc(await cloudbedsOcc(env, ly)); } catch (_) { rec.occ = rec.occ ?? ''; }
    }
    if (rec.rev == null || rec.rev === '') {
      rec.rev = roomRev[ly] != null && roomRev[ly] !== '' ? fmtMoney(roomRev[ly]) : (rec.rev ?? '');
    }
    lyoy[ly] = rec;
    n += 1;
  }
  if (n) await kvPut(env, 'hsc-lyoy', lyoy);
  return { lyoy, filled: n };
}

export async function handlePlannerLyoy(request, env) {
  const url = new URL(request.url);
  const ns = url.searchParams.get('ns') || 'fp';
  const week = url.searchParams.get('week') || '';
  if (ns === 'hsc') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return json({ success: false, error: 'Missing week=YYYY-MM-DD (Monday)' }, 400);
    }
    const mon = mondayOf(week);
    const thisDays = rangeYmd(mon, addYmd(mon, 6));
    const lyDays = thisDays.map(priorYearYmd);
    const cached = await kvGet(env, 'hsc-lyoy');
    const missing = lyDays.filter((d) => {
      const rec = cached[d];
      return !rec || rec.occ == null || rec.occ === '' || rec.rev == null || rec.rev === '';
    });
    if (missing.length) await mergeHscLyoyDays(env, missing);
    const lyoy = await kvGet(env, 'hsc-lyoy');
    const days = thisDays.map((ymd, i) => {
      const rec = lyoy[lyDays[i]] || {};
      return { date: ymd, lyDate: lyDays[i], occ: rec.occ ?? '', rev: rec.rev ?? '' };
    });
    return json({ success: true, ns, week: mon, days });
  }
  const guid = LYOY_GUID[ns];
  if (!guid) {
    return json({ success: false, error: 'lyoy ns must be fp, fp-ph, socc, or hsc' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return json({ success: false, error: 'Missing week=YYYY-MM-DD (Monday)' }, 400);
  }
  const mon = mondayOf(week);
  const thisDays = rangeYmd(mon, addYmd(mon, 6));
  const lyDays = thisDays.map(priorYearYmd);
  const cached = await kvGet(env, lyoyNs(ns));
  const missing = lyDays.filter((d) => cached[d] === undefined || cached[d] === null);
  if (missing.length) {
    const token = await toastLogin(env);
    await mergeLyoyDays(env, token, guid, missing, ns);
  }
  const lyoy = await kvGet(env, lyoyNs(ns));
  const days = thisDays.map((ymd, i) => ({
    date: ymd,
    lyDate: lyDays[i],
    net: lyoy[lyDays[i]] ?? '',
  }));
  return json({ success: true, ns, week: mon, days });
}

export async function handlePlannerSyncStatus(env) {
  const raw = await env.PLANNER_DATA.get(STATUS_KEY);
  const data = raw ? JSON.parse(raw) : { state: 'idle', message: 'No sync yet' };
  return json(data);
}

export async function handlePlannerSync(request, env, ctx) {
  const missing = ['TOAST_CLIENT_ID', 'TOAST_CLIENT_SECRET', 'CLOUDBEDS_API_KEY', 'MARGINEDGE_API_KEY']
    .filter((k) => !env[k]);
  if (missing.length) {
    return json({ success: false, error: 'Worker missing secrets: ' + missing.join(', ') }, 500);
  }
  const prevRaw = await env.PLANNER_DATA.get(STATUS_KEY);
  const prev = prevRaw ? JSON.parse(prevRaw) : {};
  if (prev.state === 'running' && prev.started && (Date.now() - Date.parse(prev.started) < 4 * 60 * 1000)) {
    return json({ success: true, state: 'running', message: prev.message || 'Already pulling', started: prev.started });
  }
  const today = denverYmd();
  const yesterday = addYmd(today, -1);
  const lookbackFrom = yesterday;
  const cbTo = today;
  const status = {
    state: 'running',
    started: new Date().toISOString(),
    denverToday: today,
    yesterday,
    lookbackFrom,
    cloudbedsTo: cbTo,
    message: 'Pulling Toast, Cloudbeds, MarginEdge…',
    errors: [],
    changed: {},
    mode: 'live-refresh',
  };
  await setStatus(env, status);
  const run = runSync(env, status).catch(async (err) => {
    status.state = 'error';
    status.finished = new Date().toISOString();
    status.message = String(err.message || err);
    status.errors.push(status.message);
    try { await setStatus(env, status); } catch (e) {}
  });
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(run);
  else await run;
  return json({
    success: true,
    state: 'running',
    message: status.message,
    started: status.started,
    yesterday,
    lookbackFrom,
  });
}

async function runSync(env, status) {
  const today = status.denverToday;
  const yesterday = status.yesterday;
  const from = status.lookbackFrom;
  const laborDays = rangeYmd(from, today);
  const salesDays = rangeYmd(from, today);
  const cbDays = rangeYmd(from, today);
  const mondays = [...new Set(salesDays.map(mondayOf))];

  status.message = 'Toast login…';
  await setStatus(env, status);
  const token = await toastLogin(env);

  const jobs = {
    fp: await loadJobs(token, GUIDS.fp),
    fph: await loadJobs(token, GUIDS.fph),
    socc: await loadJobs(token, GUIDS.socc),
  };

  const sales = { fp: {}, fph: {}, socc: {} };
  const labor = { fp: {}, fph: {}, hsc: {}, socc: {} };

  for (const day of salesDays) {
    status.message = 'Toast ' + day;
    await setStatus(env, status);
    for (const name of ['fp', 'fph', 'socc']) {
      const orders = await dayOrders(token, GUIDS[name], day);
      const refund = await dayRefunds(token, GUIDS[name], day);
      const { net, orders: nOrd } = ordersNet(orders);
      const adj = Math.round((net - refund) * 100) / 100;
      if (nOrd === 0 && refund === 0) sales[name][day] = '';
      else sales[name][day] = fmtMoney(adj);
    }
    labor.fp[day] = (await dayLabor(token, GUIDS.fp, jobs.fp, day, 'all')).pay;
    labor.fph[day] = (await dayLabor(token, GUIDS.fph, jobs.fph, day, 'fph')).pay;
    labor.hsc[day] = (await dayLabor(token, GUIDS.fph, jobs.fph, day, 'hsc')).pay;
    labor.socc[day] = (await dayLabor(token, GUIDS.socc, jobs.socc, day, 'all')).pay;
  }

  const moneyMap = (obj) => {
    const out = {};
    for (const [d, v] of Object.entries(obj)) out[d] = v === '' ? '' : fmtMoney(v);
    return out;
  };

  status.message = 'Saving Toast…';
  await setStatus(env, status);

  const fp = await kvGet(env, 'fp');
  status.changed.fpAct = applySeries(fp, 'fp-labor-wk-', 'actrevs', sales.fp);
  status.changed.fpHrly = applySeries(fp, 'fp-labor-wk-', 'hrlyacts', moneyMap(labor.fp));
  fillCurrentMgmt(fp, 'fp-labor-wk-', laborDays, MGMT.fp);
  await kvPut(env, 'fp', fp);

  try {
    const lyDays = [...new Set(salesDays.map(priorYearYmd))];
    const lyRes = await mergeLyoyDays(env, token, GUIDS.fp, lyDays, 'fp');
    status.changed.fpLyoy = lyRes.filled;
  } catch (e) {
    status.errors.push('FP LY net sales ' + e.message);
  }

  const fph = await kvGet(env, 'fp-ph');
  status.changed.fphAct = applySeries(fph, 'fp-ph-wk-', 'actrevs', sales.fph);
  status.changed.fphHrly = applySeries(fph, 'fp-ph-wk-', 'hrlyacts', moneyMap(labor.fph));
  fillCurrentMgmt(fph, 'fp-ph-wk-', laborDays, MGMT.fph);
  await kvPut(env, 'fp-ph', fph);
  try {
    const lyDays = [...new Set(salesDays.map(priorYearYmd))];
    const lyRes = await mergeLyoyDays(env, token, GUIDS.fph, lyDays, 'fp-ph');
    status.changed.fphLyoy = lyRes.filled;
  } catch (e) {
    status.errors.push('FPH LY net sales ' + e.message);
  }

  const socc = await kvGet(env, 'socc');
  status.changed.soccAct = applySeries(socc, 'socc-wk-', 'actrevs', sales.socc, {
    create: true,
    template: { revs: ['1000', '1000', '1000', '1000', '1000', '1000', '1000'], mgmtacts: ['0', '0', '0', '0', '0', '0', '0'] },
  });
  status.changed.soccHrly = applySeries(socc, 'socc-wk-', 'hrlyacts', moneyMap(labor.socc), { create: true });
  fillCurrentMgmt(socc, 'socc-wk-', laborDays, MGMT.socc);
  for (const day of laborDays) {
    const key = 'socc-wk-' + mondayOf(day);
    const w = socc[key];
    if (!w) continue;
    const revs = ensure7(w.revs);
    if (!revs.some((v) => v !== '' && v != null)) w.revs = ['1000', '1000', '1000', '1000', '1000', '1000', '1000'];
  }
  await kvPut(env, 'socc', socc);
  try {
    const lyDays = [...new Set(salesDays.map(priorYearYmd))];
    const lyRes = await mergeLyoyDays(env, token, GUIDS.socc, lyDays, 'socc');
    status.changed.soccLyoy = lyRes.filled;
  } catch (e) {
    status.errors.push('SOCC LY net sales ' + e.message);
  }

  status.message = 'Cloudbeds occupancy + room $…';
  await setStatus(env, status);
  const hsc = await kvGet(env, 'hsc');
  const occ = {};
  for (const d of cbDays) {
    try { occ[d] = await cloudbedsOcc(env, d); }
    catch (e) { status.errors.push('CB occ ' + d + ' ' + e.message); }
  }
  let roomRev = {};
  try { roomRev = await cloudbedsRoomRev(env, from, today, true); }
  catch (e) { status.errors.push('CB room$ ' + e.message); }
  const occMap = {};
  for (const [d, v] of Object.entries(occ)) occMap[d] = fmtOcc(v);
  const bookedMap = {};
  for (const [d, v] of Object.entries(roomRev)) bookedMap[d] = fmtMoney(v);
  status.changed.hscOcc = applySeries(hsc, 'hsc-wk-', 'occrooms', occMap);
  status.changed.hscBooked = applySeries(hsc, 'hsc-wk-', 'bookedrevs', bookedMap);
  status.changed.hscHrly = applySeries(hsc, 'hsc-wk-', 'hrlyacts', moneyMap(labor.hsc));
  let actFill = 0;
  for (const d of laborDays) {
    const key = 'hsc-wk-' + mondayOf(d);
    const w = hsc[key];
    if (!w) continue;
    const di = parseYmd(d).getUTCDay();
    const idx = di === 0 ? 6 : di - 1;
    const acts = ensure7(w.actrevs);
    const booked = ensure7(w.bookedrevs);
    if (booked[idx]) {
      if (acts[idx] !== booked[idx]) actFill += 1;
      acts[idx] = booked[idx];
      w.actrevs = acts;
    }
    hsc[key] = w;
  }
  status.changed.hscActFill = actFill;
  fillCurrentMgmt(hsc, 'hsc-wk-', laborDays, hscMgmtRate);
  await kvPut(env, 'hsc', hsc);
  try {
    const lyDays = [...new Set(cbDays.map(priorYearYmd))];
    const lyRes = await mergeHscLyoyDays(env, lyDays);
    status.changed.hscLyoy = lyRes.filled;
  } catch (e) {
    status.errors.push('HSC LY Cloudbeds ' + e.message);
  }

  status.message = 'MarginEdge food + supplies…';
  await setStatus(env, status);
  const food = await kvGet(env, 'uhg-food');
  const supplies = await kvGet(env, 'uhg-supplies');
  if (!supplies.weeks) supplies.weeks = {};
  if (!supplies.budget) supplies.budget = {};
  if (!supplies.budget['2026-P9']) supplies.budget['2026-P9'] = { fp: 2000, hsc: 7000 };
  // Weekly pass — full week P&L for each Monday in the window
  for (const mon of mondays) {
    const sun = addYmd(mon, 6);
    try {
      const fpP = await marginWeek(env, ME_UNITS.fp, mon, sun);
      const hscP = await marginWeek(env, ME_UNITS.hsc, mon, sun);
      const cur = (food[mon] && typeof food[mon] === 'object') ? food[mon] : {};
      if (fpP.food || hscP.food || fpP.supplies || hscP.supplies) {
        cur.fp = fpP.food;
        cur.hsc = hscP.food;
        cur.supplies = Math.round((fpP.supplies + hscP.supplies) * 100) / 100;
        food[mon] = cur;
      }
      supplies.weeks[mon] = { fp: fpP.cats, hsc: hscP.cats };
    } catch (e) {
      status.errors.push('ME week ' + mon + ' ' + e.message);
    }
  }
  // Daily pass — pull yesterday + today individually for the daily row display
  for (const day of [yesterday, today]) {
    if (day === mondayOf(day)) continue; // Monday already covered by weekly pass
    try {
      const fpD = await marginWeek(env, ME_UNITS.fp, day, day);
      const hscD = await marginWeek(env, ME_UNITS.hsc, day, day);
      const cur = (food[day] && typeof food[day] === 'object') ? food[day] : {};
      if (fpD.food || hscD.food || fpD.supplies || hscD.supplies) {
        cur.fp = fpD.food;
        cur.hsc = hscD.food;
        cur.supplies = Math.round((fpD.supplies + hscD.supplies) * 100) / 100;
        food[day] = cur;
      }
    } catch (e) {
      status.errors.push('ME daily ' + day + ' ' + e.message);
    }
  }
  await kvPut(env, 'uhg-food', food);
  await kvPut(env, 'uhg-supplies', supplies);

  const log = await kvGet(env, 'uhg-log');
  const entries = Array.isArray(log.entries) ? log.entries.slice() : [];
  entries.push({
    ts: new Date().toISOString(),
    kind: 'system',
    field: 'live-refresh',
    note: `Refresh ${from}–${today} Toast sales+labor, Cloudbeds occ+room$, MarginEdge food+supplies.`,
    from: null,
    to: null,
  });
  await kvPut(env, 'uhg-log', { entries });

  status.state = 'ok';
  status.finished = new Date().toISOString();
  status.message = status.errors.length
    ? 'Pulled with warnings: ' + status.errors.slice(0, 3).join('; ')
    : `Live through ${today} Denver. Toast + Cloudbeds + MarginEdge.`;
  await setStatus(env, status);
}

function fillCurrentMgmt(data, prefix, laborDays, rate) {
  const todayMon = mondayOf(laborDays[laborDays.length - 1]);
  const nextMon = addYmd(todayMon, 7);
  for (const mon of [todayMon, nextMon]) {
    const key = prefix + mon;
    if (!data[key]) continue;
    if (typeof rate === 'function') fillStandingMgmtByDay(data[key], mon, rate);
    else fillStandingMgmt(data[key], rate);
  }
}
function fillStandingMgmtByDay(week, mon, rateFn) {
  const arr = ensure7(week.mgmtacts);
  for (let i = 0; i < 7; i++) {
    const ymd = addYmd(mon, i);
    const r = rateFn(ymd);
    const cur = arr[i];
    if (cur === '' || cur == null || cur === MGMT.hsc) arr[i] = r;
  }
  week.mgmtacts = arr;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
