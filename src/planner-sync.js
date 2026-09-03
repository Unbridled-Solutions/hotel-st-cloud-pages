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
    const rh = Number(te.regularHours || 0);
    const oh = Number(te.overtimeHours || 0);
    if (oh) ot += oh;
    pay += Math.round((rh * Number(wage) + oh * Number(wage)) * 100) / 100;
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

  const fph = await kvGet(env, 'fp-ph');
  status.changed.fphAct = applySeries(fph, 'fp-ph-wk-', 'actrevs', sales.fph);
  status.changed.fphHrly = applySeries(fph, 'fp-ph-wk-', 'hrlyacts', moneyMap(labor.fph));
  fillCurrentMgmt(fph, 'fp-ph-wk-', laborDays, MGMT.fph);
  await kvPut(env, 'fp-ph', fph);

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
  fillCurrentMgmt(hsc, 'hsc-wk-', laborDays, MGMT.hsc);
  await kvPut(env, 'hsc', hsc);

  status.message = 'MarginEdge food + supplies…';
  await setStatus(env, status);
  const food = await kvGet(env, 'uhg-food');
  const supplies = await kvGet(env, 'uhg-supplies');
  if (!supplies.weeks) supplies.weeks = {};
  if (!supplies.budget) supplies.budget = {};
  if (!supplies.budget['2026-P9']) supplies.budget['2026-P9'] = { fp: 2000, hsc: 7000 };
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
      status.errors.push('ME ' + mon + ' ' + e.message);
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
    fillStandingMgmt(data[key], rate);
  }
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
