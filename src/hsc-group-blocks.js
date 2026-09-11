/**
 * Hotel St. Cloud — Cloudbeds group + allotment-block pickup.
 * GET /api/hsc/group-blocks  (optional ?refresh=1)
 * Never expose the API key to the browser.
 */

const PROP = '23229145280711';
const CB = 'https://hotels.cloudbeds.com/api/v1.2';
const CACHE_KEY = 'bundle:hsc-events-cb-cache';
const CACHE_MS = 8 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function intervalSpan(intervals) {
  const starts = [];
  const ends = [];
  const items = !intervals ? [] : Array.isArray(intervals) ? intervals : Object.values(intervals);
  for (const i of items) {
    if (!i || typeof i !== 'object') continue;
    if (i.startDate) starts.push(i.startDate);
    if (i.endDate) ends.push(i.endDate);
  }
  starts.sort();
  ends.sort();
  return { startDate: starts[0] || null, endDate: ends[ends.length - 1] || null };
}

async function cbGet(env, path, params) {
  const url = new URL(CB + path);
  url.searchParams.set('propertyID', PROP);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: 'Bearer ' + env.CLOUDBEDS_API_KEY,
      Accept: 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = body.message || body.error || ('HTTP ' + res.status);
    throw new Error(path + ': ' + msg);
  }
  return body;
}

async function paged(env, path, extra = {}) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const body = await cbGet(env, path, { pageSize: 100, pageNumber: page, ...extra });
    const rows = body.data || [];
    out.push(...rows);
    if (rows.length < 100) break;
    const total = Number(body.total);
    if (Number.isFinite(total) && out.length >= total) break;
  }
  return out;
}

function compactBlock(b) {
  const span = intervalSpan(b.allotmentIntervals);
  return {
    code: b.allotmentBlockCode || '',
    name: b.allotmentBlockName || '',
    status: b.allotmentBlockStatus || '',
    groupCode: b.groupCode || '',
    eventCode: b.eventCode || '',
    roomsHeld: Number(b.roomsHeld || 0),
    roomsPickedUp: Number(b.roomsPickedUp || 0),
    roomsRemaining: Number(b.roomsRemaining || 0),
    reservationsCount: Number(b.reservationsCount || 0),
    releaseDate: b.releaseDate || null,
    isAutoRelease: !!b.isAutoRelease,
    startDate: span.startDate,
    endDate: span.endDate,
  };
}

function compactGroup(g) {
  const c = (g.contacts || []).find((x) => x.primary) || (g.contacts || [])[0] || {};
  const email = (c.emails && c.emails[0] && (c.emails[0].email || c.emails[0])) || '';
  return {
    code: g.groupCode || '',
    name: g.name || '',
    status: g.status || '',
    type: g.type || '',
    contact: [c.first_name, c.last_name].filter(Boolean).join(' '),
    email: typeof email === 'string' ? email : '',
  };
}

async function fetchLive(env) {
  const [groups, blocks] = await Promise.all([
    paged(env, '/getGroups'),
    paged(env, '/getAllotmentBlocks'),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    propertyID: PROP,
    groups: groups.map(compactGroup),
    blocks: blocks.map(compactBlock),
  };
}

export async function handleHscGroupBlocks(request, env) {
  if (request.method !== 'GET') return null;
  if (!env.CLOUDBEDS_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Cloudbeds key missing on worker' }), { status: 500, headers: CORS });
  }
  const url = new URL(request.url);
  const force = url.searchParams.get('refresh') === '1';
  try {
    if (!force) {
      const raw = await env.PLANNER_DATA.get(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        const age = Date.now() - Date.parse(cached.fetchedAt || 0);
        if (Number.isFinite(age) && age >= 0 && age < CACHE_MS) {
          return new Response(JSON.stringify({ success: true, cached: true, ...cached }), { headers: CORS });
        }
      }
    }
    const live = await fetchLive(env);
    await env.PLANNER_DATA.put(CACHE_KEY, JSON.stringify(live));
    return new Response(JSON.stringify({ success: true, cached: false, ...live }), { headers: CORS });
  } catch (err) {
    const raw = await env.PLANNER_DATA.get(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      return new Response(JSON.stringify({ success: true, cached: true, stale: true, error: err.message, ...cached }), { headers: CORS });
    }
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 502, headers: CORS });
  }
}
