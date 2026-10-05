/**
 * 1887 Historic Eatery reservations.
 * Guest widget + desk/phone book. One cover list. Server-side pacing.
 *
 * GET  /api/1887-reservations?date=YYYY-MM-DD
 * GET  /api/1887-reservations/availability?date=&party=
 * POST /api/1887-reservations           create
 * POST /api/1887-reservations/update    edit / cancel / noshow  (staff)
 */

const NS_CFG = "1887-res:config";
function resKey(date, id) {
  return "1887-res:" + date + ":" + id;
}
const TZ = "America/Denver";
const PHONE = "(719) 602-3469";
const PHONE_TEL = "7196023469";
const CALL_LINE =
  "Don't see a time that works? Call us at (719) 602-3469 — we'll see if there are any alternate times that might work for your group.";

const DEFAULT_CFG = {
  slotMinutes: 15,
  slotCap: 30,
  windowCap: 45,
  windowSlots: 2, // this slot + 1 neighbor = 30 minutes
  largePartyMin: 6,
  largePartyMax: 9,
  onlinePartyMax: 9,
  callPartyMin: 10,
  lastStartMinutesBeforeClose: 30,
  meals: {
    breakfast: { label: "Breakfast", start: "07:00", end: "11:00" },
    lunch: { label: "Lunch", start: "11:00", end: "14:00" },
    dinner: { label: "Dinner", start: "16:00", end: "21:00" },
  },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function esc(s) {
  const amp = String.fromCharCode(38);
  return String(s || "")
    .split(amp).join(amp + "amp;")
    .split("<").join(amp + "lt;")
    .split(">").join(amp + "gt;")
    .split('"').join(amp + "quot;");
}

function g(v, n) {
  return String(v == null ? "" : v).trim().slice(0, n);
}

function todayDenver() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowHmDenver() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour").value;
  const m = parts.find((p) => p.type === "minute").value;
  return h + ":" + m;
}

function validDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d || "");
}

function hmToMin(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  return h * 60 + m;
}

function minToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function mealForTime(cfg, hm) {
  const t = hmToMin(hm);
  if (t >= hmToMin("07:00") && t < hmToMin("11:00")) return "breakfast";
  if (t >= hmToMin("11:00") && t < hmToMin("16:00")) return "lunch";
  if (t >= hmToMin("16:00") && t < hmToMin("22:00")) return "dinner";
  if (t >= hmToMin("04:00") && t < hmToMin("07:00")) return "breakfast";
  return "dinner";
}

function slotsForMeal(cfg, mealId) {
  const meal = cfg.meals[mealId];
  if (!meal) return [];
  const start = hmToMin(meal.start);
  const end = hmToMin(meal.end) - (cfg.lastStartMinutesBeforeClose || 0);
  const step = cfg.slotMinutes || 15;
  const out = [];
  for (let t = start; t <= end; t += step) out.push(minToHm(t));
  return out;
}

function allSlots(cfg) {
  return ["breakfast", "lunch", "dinner"].flatMap((m) => slotsForMeal(cfg, m));
}

function neighborSlots(cfg, hm) {
  const all = allSlots(cfg);
  const i = all.indexOf(hm);
  if (i < 0) return [hm];
  const extra = (cfg.windowSlots || 2) - 1;
  const set = new Set([hm]);
  for (let k = 1; k <= extra; k++) {
    if (all[i - k]) set.add(all[i - k]);
    if (all[i + k]) set.add(all[i + k]);
  }
  return [...set];
}

function liveRes(list) {
  return (list || []).filter((r) => r && r.status !== "cancelled" && r.status !== "noshow");
}

function coversAt(list, hm) {
  return liveRes(list)
    .filter((r) => r.time === hm)
    .reduce((n, r) => n + (Number(r.party) || 0), 0);
}

function largeCountAt(cfg, list, hm) {
  return liveRes(list).filter((r) => {
    const p = Number(r.party) || 0;
    return r.time === hm && p >= cfg.largePartyMin && p <= cfg.largePartyMax;
  }).length;
}

function windowCovers(cfg, list, hm) {
  const neigh = neighborSlots(cfg, hm);
  return liveRes(list)
    .filter((r) => neigh.includes(r.time))
    .reduce((n, r) => n + (Number(r.party) || 0), 0);
}

function fitsPacing(cfg, list, hm, party) {
  const p = Number(party) || 0;
  if (p < 1) return { ok: false, reason: "party" };
  if (coversAt(list, hm) + p > cfg.slotCap) return { ok: false, reason: "slot" };
  if (windowCovers(cfg, list, hm) + p > cfg.windowCap) return { ok: false, reason: "pace" };
  if (p >= cfg.largePartyMin && p <= cfg.largePartyMax) {
    if (largeCountAt(cfg, list, hm) >= 1) return { ok: false, reason: "large" };
    if (coversAt(list, hm) >= 8) return { ok: false, reason: "large-busy" };
  }
  return { ok: true };
}

function prettyTime(hm) {
  const [h, m] = hm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hr = ((h + 11) % 12) + 1;
  return hr + ":" + String(m).padStart(2, "0") + " " + ap;
}

function prettyDate(iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 18, 0, 0)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function loadCfg(env) {
  try {
    const raw = await env.PLANNER_DATA.get(NS_CFG);
    if (!raw) return DEFAULT_CFG;
    const saved = JSON.parse(raw);
    return {
      ...DEFAULT_CFG,
      ...saved,
      meals: { ...DEFAULT_CFG.meals, ...(saved.meals || {}) },
    };
  } catch {
    return DEFAULT_CFG;
  }
}

async function loadDay(env, date) {
  const prefix = "1887-res:" + date + ":";
  const reservations = [];
  let cursor;
  do {
    const page = await env.PLANNER_DATA.list({ prefix, cursor, limit: 1000 });
    for (const k of page.keys) {
      const raw = await env.PLANNER_DATA.get(k.name);
      if (!raw) continue;
      try {
        reservations.push(JSON.parse(raw));
      } catch {
        /* skip bad row */
      }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return { date, reservations, version: reservations.length };
}

async function saveRes(env, r) {
  await env.PLANNER_DATA.put(resKey(r.date, r.id), JSON.stringify(r));
}

function overAfterInsert(cfg, list, reservation) {
  if (coversAt(list, reservation.time) > cfg.slotCap) return "slot";
  if (windowCovers(cfg, list, reservation.time) > cfg.windowCap) return "pace";
  const p = Number(reservation.party) || 0;
  if (p >= cfg.largePartyMin && p <= cfg.largePartyMax) {
    if (largeCountAt(cfg, list, reservation.time) > 1) return "large";
  }
  return null;
}

function publicSlots(cfg, day, party, date) {
  const p = Number(party) || 2;
  const today = todayDenver();
  const now = nowHmDenver();
  return allSlots(cfg).map((hm) => {
    const meal = mealForTime(cfg, hm);
    let open = fitsPacing(cfg, day.reservations, hm, p).ok;
    if (date < today) open = false;
    if (date === today && hm <= now) open = false;
    if (p >= cfg.callPartyMin) open = false;
    return { time: hm, label: prettyTime(hm), meal, open };
  });
}

function staffDayView(cfg, day) {
  const live = liveRes(day.reservations);
  const meals = ["breakfast", "lunch", "dinner"].map((id) => {
    const extra = (day.reservations || [])
      .filter((r) => r && r.status !== "cancelled" && (r.meal === id || mealForTime(cfg, r.time) === id))
      .map((r) => r.time);
    const times = [...new Set(slotsForMeal(cfg, id).concat(extra))].sort((a, b) => hmToMin(a) - hmToMin(b));
    const slots = times.map((hm) => {
      const rows = (day.reservations || [])
        .filter((r) => r && r.time === hm && r.status !== "cancelled")
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return {
        time: hm,
        label: prettyTime(hm),
        covers: coversAt(day.reservations, hm),
        window: windowCovers(cfg, day.reservations, hm),
        rows,
      };
    });
    const covers = live
      .filter((r) => r.meal === id)
      .reduce((n, r) => n + (Number(r.party) || 0), 0);
    const parties = live.filter((r) => r.meal === id).length;
    return { id, label: cfg.meals[id].label, covers, parties, slots };
  });
  const kitchen = {
    breakfast: meals[0].covers,
    lunch: meals[1].covers,
    dinner: meals[2].covers,
    day: live.reduce((n, r) => n + (Number(r.party) || 0), 0),
  };
  return {
    date: day.date,
    prettyDate: prettyDate(day.date),
    version: day.version,
    totals: {
      covers: kitchen.day,
      parties: live.length,
    },
    kitchen,
    meals,
    cancelled: day.reservations.filter((r) => r.status === "cancelled"),
  };
}

async function sendResend(env, payload) {
  if (!env.RESEND_API_KEY) return { error: "no resend key" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.message || data.error || res.status };
  return { id: data.id };
}

const MENU_LINKS = [
  ["Breakfast", "https://irp.cdn-website.com/0f03241a/files/uploaded/1887+Historic+Eatery_Breakfast+Menu_2026+Web.pdf"],
  ["Lunch", "https://irp.cdn-website.com/0f03241a/files/uploaded/1887+Historic+Eatery_Lunch+Menu_2026+Web.pdf"],
  ["Dinner", "https://irp.cdn-website.com/0f03241a/files/uploaded/1887+Historic+Eatery_Spring+Menu+2026.pdf"],
];

function menuHtml() {
  return MENU_LINKS.map(
    ([label, href]) =>
      `<a href="${href}" style="display:inline-block;margin:0 10px 8px 0;color:#786f5c;font-weight:600">${esc(label)} menu</a>`
  ).join("");
}

function resHtml(title, rows, extra) {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#786f5c;white-space:nowrap">${esc(k)}</td><td style="padding:8px 12px">${esc(v) || "—"}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#fff8dd;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fffcf2;border:1px solid #cfc6a8;padding:24px">
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:#b79f36;margin:0 0 8px">1887 Historic Eatery</p>
    <h1 style="font-size:24px;margin:0 0 16px;color:#191d23">${esc(title)}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px">${body}</table>
    ${extra || ""}
    <p style="margin:18px 0 0;font-size:14px;color:#5c5648">Questions? Call ${esc(PHONE)}.</p>
  </div></body></html>`;
}

async function emailGuest(env, r, kind) {
  if (!r.email) return;
  const meal = r.mealLabel || r.meal || "";
  const when = prettyDate(r.date) + " · " + prettyTime(r.time);
  const title =
    kind === "cancel"
      ? "We released your table"
      : kind === "update"
        ? "Your table has changed"
        : "We'll see you at 1887";
  const extra =
    kind === "cancel"
      ? ""
      : `<p style="margin:18px 0 8px;font-size:15px;color:#191d23">While you wait, take a look at the menu.</p><p>${menuHtml()}</p>`;
  const html = resHtml(title, [
    ["Name", r.name],
    ["When", when],
    ["Meal", meal],
    ["Party", String(r.party)],
    ["Phone", r.phone],
    ["Notes", r.notes],
    ["Confirmation", r.id.slice(0, 8).toUpperCase()],
  ], extra);
  const text = [
    title,
    when,
    "Party of " + r.party,
    r.name,
    PHONE,
    "",
    "Menus:",
    MENU_LINKS.map(([label, href]) => label + ": " + href).join("\n"),
  ].join("\n");
  const payload = {
    to: [r.email],
    subject: "1887 · " + title + " · " + prettyDate(r.date),
    html,
    text,
  };
  let sent = await sendResend(env, Object.assign({}, payload, { from: "1887 Historic Eatery <reservations@hotelstcloud.com>" }));
  if (!sent.id) {
    sent = await sendResend(env, Object.assign({}, payload, { from: "1887 Historic Eatery <noreply@fremontmakers.com>" }));
  }
  return sent;
}

async function emailDesk(env, r, kind) {
  const when = prettyDate(r.date) + " · " + prettyTime(r.time);
  const title =
    kind === "cancel"
      ? "Cancelled"
      : kind === "update"
        ? "Updated"
        : "New reservation";
  const html = resHtml("1887 · " + title, [
    ["Name", r.name],
    ["When", when],
    ["Party", String(r.party)],
    ["Phone", r.phone],
    ["Email", r.email],
    ["Source", r.source],
    ["Taken by", r.takenBy],
    ["Notes", r.notes],
    ["Override", r.override ? "yes" : ""],
    ["Book", "https://offers.hotelstcloud.com/assets/1887-reservations-book"],
  ]);
  const payload = {
    to: ["reservations@hotelstcloud.com", "hello@unbridledhospitality.com"],
    subject: "1887 · " + title + " · " + r.party + " · " + prettyTime(r.time) + " · " + r.name,
    html,
    text: title + "\n" + when + "\n" + r.name + " party " + r.party + "\n" + r.phone,
  };
  let sent = await sendResend(env, Object.assign({}, payload, { from: "1887 Historic Eatery <reservations@hotelstcloud.com>" }));
  if (!sent.id) {
    sent = await sendResend(env, Object.assign({}, payload, { from: "1887 Historic Eatery <noreply@fremontmakers.com>" }));
  }
  return sent;
}

function newId() {
  return crypto.randomUUID();
}

export async function handleEateryReservations(request, env, ctx) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/1887-reservations")) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const cfg = await loadCfg(env);

  if (url.pathname === "/api/1887-reservations" && request.method === "GET") {
    const date = url.searchParams.get("date") || todayDenver();
    if (!validDate(date)) return json({ error: "bad date" }, 400);
    const day = await loadDay(env, date);
    return json({
      success: true,
      cfg: {
        slotCap: cfg.slotCap,
        windowCap: cfg.windowCap,
        onlinePartyMax: cfg.onlinePartyMax,
        callPartyMin: cfg.callPartyMin,
        phone: PHONE,
        phoneTel: PHONE_TEL,
        callLine: CALL_LINE,
        meals: cfg.meals,
      },
      day: staffDayView(cfg, day),
      reservations: day.reservations,
    });
  }

  if (url.pathname === "/api/1887-reservations/availability" && request.method === "GET") {
    const date = url.searchParams.get("date") || "";
    const party = Number(url.searchParams.get("party") || 2);
    if (!validDate(date)) return json({ error: "bad date" }, 400);
    if (party >= cfg.callPartyMin) {
      return json({
        success: true,
        call: true,
        phone: PHONE,
        callLine: CALL_LINE,
        slots: [],
      });
    }
    const day = await loadDay(env, date);
    const slots = publicSlots(cfg, day, party, date);
    const any = slots.some((s) => s.open);
    return json({
      success: true,
      date,
      party,
      phone: PHONE,
      callLine: CALL_LINE,
      meals: cfg.meals,
      slots,
      anyOpen: any,
    });
  }

  if (url.pathname === "/api/1887-reservations" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const date = g(body.date, 10);
    const time = g(body.time, 5);
    const name = g(body.name, 80);
    const phone = g(body.phone, 40);
    const email = g(body.email, 120);
    const notes = g(body.notes, 400);
    const takenBy = g(body.takenBy, 60);
    const sourceRaw = g(body.source, 20);
    const source = sourceRaw === "staff" || sourceRaw === "sheet" ? sourceRaw : "web";
    const silent = !!body.silent || source === "sheet";
    const override = source === "staff" && !!body.override;
    const party = Number(body.party);

    if (!validDate(date) || !/^\d{2}:\d{2}$/.test(time)) return json({ error: "date and time required" }, 400);
    if (!name) return json({ error: "name required" }, 400);
    if (!phone && source === "web") return json({ error: "name and phone required" }, 400);
    if (!Number.isFinite(party) || party < 1 || party > 200) return json({ error: "party" }, 400);
    if (source === "web") {
      if (!email) return json({ error: "email required" }, 400);
      if (party > cfg.onlinePartyMax) {
        return json({ error: "call", call: true, phone: PHONE, callLine: CALL_LINE }, 400);
      }
    }
    const meal = mealForTime(cfg, time);
    if (!meal) return json({ error: "that time is not a seating" }, 400);
    if (source === "web" && !slotsForMeal(cfg, meal).includes(time)) {
      return json({ error: "that time is not a seating" }, 400);
    }
    const today = todayDenver();
    if (date < today && source !== "sheet") return json({ error: "that date has passed" }, 400);
    if (date === today && time <= nowHmDenver() && source === "web") {
      return json({ error: "that time has passed" }, 400);
    }
    const maxOut = new Date(today + "T12:00:00");
    maxOut.setDate(maxOut.getDate() + 90);
    const maxStr = maxOut.toISOString().slice(0, 10);
    if (date > maxStr && source === "web") return json({ error: "too far out — please call" }, 400);

    const reservation = {
      id: g(body.id, 80) || newId(),
      date,
      time,
      meal,
      mealLabel: cfg.meals[meal].label,
      party,
      name,
      phone,
      email,
      notes,
      source,
      takenBy: source === "web" ? "web" : takenBy || (source === "sheet" ? "sheet" : "desk"),
      status: "booked",
      override: override || false,
      createdAt: new Date().toISOString(),
    };

    const before = await loadDay(env, date);
    if (reservation.id && before.reservations.some((r) => r.id === reservation.id)) {
      return json({ success: true, duplicate: true, reservation: before.reservations.find((r) => r.id === reservation.id) });
    }
    if (!override && source !== "sheet") {
      const fit = fitsPacing(cfg, before.reservations, time, party);
      if (!fit.ok) {
        return json(
          { success: false, error: "full", reason: fit.reason, callLine: CALL_LINE, phone: PHONE },
          409
        );
      }
    }
    await saveRes(env, reservation);
    const after = await loadDay(env, date);
    const saved = after.reservations.find((r) => r.id === reservation.id) || reservation;
    if (!override && source !== "sheet") {
      const over = overAfterInsert(cfg, after.reservations, saved);
      if (over) {
        await env.PLANNER_DATA.delete(resKey(date, reservation.id));
        return json(
          { success: false, error: "full", reason: over, callLine: CALL_LINE, phone: PHONE },
          409
        );
      }
    }
    if (!silent) ctxEmail(env, ctx, saved, "new");
    return json({
      success: true,
      reservation: {
        id: saved.id,
        date: saved.date,
        time: saved.time,
        prettyTime: prettyTime(saved.time),
        prettyDate: prettyDate(saved.date),
        meal: saved.mealLabel,
        party: saved.party,
        name: saved.name,
        confirmation: saved.id.slice(0, 8).toUpperCase(),
      },
    });
  }

  if (url.pathname === "/api/1887-reservations/update" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const date = g(body.date, 10);
    const id = g(body.id, 80);
    const action = g(body.action, 20);
    if (!validDate(date) || !id) return json({ error: "id and date required" }, 400);

    const raw = await env.PLANNER_DATA.get(resKey(date, id));
    if (!raw) return json({ success: false, error: "not found" }, 404);
    let cur;
    try {
      cur = JSON.parse(raw);
    } catch {
      return json({ success: false, error: "not found" }, 404);
    }
    if (action === "cancel") cur.status = "cancelled";
    else if (action === "noshow") cur.status = "noshow";
    else if (action === "restore") cur.status = "booked";
    else if (action === "edit") {
      if (body.name != null) cur.name = g(body.name, 80);
      if (body.phone != null) cur.phone = g(body.phone, 40);
      if (body.email != null) cur.email = g(body.email, 120);
      if (body.notes != null) cur.notes = g(body.notes, 400);
      if (body.takenBy != null) cur.takenBy = g(body.takenBy, 60);
      if (body.party != null) cur.party = Number(body.party) || cur.party;
      if (body.time) {
        const t = g(body.time, 5);
        const meal = mealForTime(cfg, t);
        if (!meal) return json({ error: "that time is not a seating" }, 400);
        cur.time = t;
        cur.meal = meal;
        cur.mealLabel = cfg.meals[meal].label;
      }
      if (!body.override) {
        const day = await loadDay(env, date);
        const others = day.reservations.filter((r) => r.id !== id);
        const fit = fitsPacing(cfg, others, cur.time, cur.party);
        if (!fit.ok) return json({ success: false, error: "full", reason: fit.reason }, 409);
      } else {
        cur.override = true;
      }
    } else {
      return json({ success: false, error: "bad action" }, 400);
    }
    cur.updatedAt = new Date().toISOString();
    await saveRes(env, cur);
    const kind = action === "cancel" ? "cancel" : "update";
    if (action !== "noshow") ctxEmail(env, ctx, cur, kind);
    return json({ success: true, reservation: cur });
  }

  return json({ error: "not found" }, 404);
}

function ctxEmail(env, ctx, reservation, kind) {
  const run = Promise.all([
    emailGuest(env, reservation, kind),
    emailDesk(env, reservation, kind),
  ]).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(run);
}
