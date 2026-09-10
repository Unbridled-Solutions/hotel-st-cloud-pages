/**
 * Hotel St. Cloud standalone event tickets (Stripe Checkout).
 * Murder mystery + Christmas lights only. Never Jeep / room nights.
 */

const PRICES = {
  "hsc-mm-adult": "price_1UEFDLCYPk1DQzaWAOcPZpAu",
  "hsc-lights-adult": "price_1UEFDLCYPk1DQzaWH4FAJHNf",
  "hsc-lights-child": "price_1UEFDMCYPk1DQzaWtqD6Gvq8",
  "hsc-lights-family": "price_1UEFDMCYPk1DQzaWS6TPn5wS",
};

const EVENTS = {
  "murder-mystery": {
    name: "Murder in Buffalo Chip",
    date: "2026-10-30",
    successPath: "/murder-mystery/thanks/",
    cancelPath: "/murder-mystery/",
  },
  "christmas-lights": {
    name: "Christmas Lights Bus Tour",
    date: "",
    successPath: "/christmas-lights/thanks/",
    cancelPath: "/christmas-lights/",
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function originOf(request) {
  const url = new URL(request.url);
  if (url.hostname.endsWith("hotelstcloud.com") || url.hostname.includes("workers.dev")) {
    return "https://offers.hotelstcloud.com";
  }
  return url.origin;
}

async function stripePost(env, path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    body.append(k, String(v));
  }
  const res = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  data._http = res.status;
  return data;
}

async function stripeGet(env, path) {
  const res = await fetch("https://api.stripe.com/v1" + path, {
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY },
  });
  return res.json();
}

function qty(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildLineItems(event, body) {
  const items = [];
  if (event === "murder-mystery") {
    const n = qty(body.adults || body.qty);
    if (n) items.push({ price: PRICES["hsc-mm-adult"], quantity: n, lookup: "hsc-mm-adult" });
  } else if (event === "christmas-lights") {
    const a = qty(body.adults);
    const c = qty(body.children);
    const f = qty(body.family);
    if (a) items.push({ price: PRICES["hsc-lights-adult"], quantity: a, lookup: "hsc-lights-adult" });
    if (c) items.push({ price: PRICES["hsc-lights-child"], quantity: c, lookup: "hsc-lights-child" });
    if (f) items.push({ price: PRICES["hsc-lights-family"], quantity: f, lookup: "hsc-lights-family" });
  }
  return items;
}

function ordersAuthed(request, env) {
  const key = env.EVENT_ORDERS_KEY;
  if (!key) return false;
  const url = new URL(request.url);
  const sent = request.headers.get("x-event-key") || url.searchParams.get("key") || "";
  return sent === key;
}

async function saveOrder(env, order) {
  const id = order.id;
  await env.PLANNER_DATA.put("events:order:" + id, JSON.stringify(order));
  let index = [];
  try {
    index = (await env.PLANNER_DATA.get("events:index", { type: "json" })) || [];
  } catch {
    index = [];
  }
  if (!index.includes(id)) {
    index.unshift(id);
    if (index.length > 2000) index = index.slice(0, 2000);
    await env.PLANNER_DATA.put("events:index", JSON.stringify(index));
  }
}

function orderFromSession(session, extra = {}) {
  const meta = session.metadata || {};
  const customer = session.customer_details || {};
  return {
    id: session.id,
    event: meta.event || extra.event || "",
    eventName: meta.eventName || extra.eventName || "",
    eventDate: meta.eventDate || extra.eventDate || "",
    name: meta.name || customer.name || "",
    email: session.customer_email || customer.email || meta.email || "",
    phone: meta.phone || customer.phone || "",
    adults: meta.adults || "0",
    children: meta.children || "0",
    family: meta.family || "0",
    under3: meta.under3 || "0",
    wantRoom: meta.wantRoom || "no",
    notes: meta.notes || "",
    amount: session.amount_total || 0,
    currency: session.currency || "usd",
    paymentStatus: session.payment_status || "",
    status: extra.status || "new",
    created: session.created ? session.created * 1000 : Date.now(),
    staffNotes: extra.staffNotes || "",
    guestEmailId: extra.guestEmailId || "",
    deskEmailId: extra.deskEmailId || "",
    emailError: extra.emailError || "",
  };
}

function money(cents) {
  return "$" + (Number(cents || 0) / 100).toFixed(2);
}

function ticketLine(order) {
  if (order.event === "murder-mystery") {
    return `${order.adults || 0} ticket${Number(order.adults) === 1 ? "" : "s"}`;
  }
  return `Adults ${order.adults || 0} · children ${order.children || 0} · family packs ${order.family || 0} · under 3: ${order.under3 || 0}`;
}

async function sendResend(env, payload) {
  if (!env.RESEND_API_KEY) return { error: "no RESEND_API_KEY" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error?.message || data.message || ("Resend " + res.status) };
  return { id: data.id };
}

async function notifyOrder(env, order) {
  const errors = [];
  if (order.email && !order.guestEmailId) {
    const guest = await sendResend(env, {
      from: "Hotel St. Cloud <noreply@fremontmakers.com>",
      to: [order.email],
      reply_to: "reservations@hotelstcloud.com",
      subject: `You're in · ${order.eventName}`,
      html: `<p>Hi ${order.name || "there"},</p>
<p>We have your tickets for <strong>${order.eventName}</strong>${order.eventDate ? " on " + order.eventDate : ""}.</p>
<p>${ticketLine(order)}<br>Paid ${money(order.amount)}.</p>
${order.wantRoom === "yes" ? "<p>You asked about a room. The desk will follow up.</p>" : ""}
${order.notes ? "<p>Notes we have: " + order.notes + "</p>" : ""}
<p>Hotel St. Cloud · 631 Main Street, Cañon City<br>(719) 602-3469 · reservations@hotelstcloud.com</p>`,
    });
    if (guest.id) order.guestEmailId = guest.id;
    else errors.push("guest: " + (guest.error || "fail"));
  }
  if (!order.deskEmailId) {
    const desk = await sendResend(env, {
      from: "Hotel St. Cloud <noreply@fremontmakers.com>",
      to: ["reservations@hotelstcloud.com"],
      cc: ["lwyss@unbridled.com"],
      subject: `[Tickets] ${order.eventName} · ${order.name}`,
      html: `<p><strong>${order.name}</strong> (${order.email} / ${order.phone || "no phone"})</p>
<p>${order.eventName} ${order.eventDate || ""}</p>
<p>${ticketLine(order)}</p>
<p>Want a room: ${order.wantRoom}</p>
<p>Paid ${money(order.amount)}</p>
<p>Notes: ${order.notes || "none"}</p>
<p><a href="https://offers.hotelstcloud.com/assets/hsc-event-orders">Open orders board</a></p>`,
    });
    if (desk.id) order.deskEmailId = desk.id;
    else errors.push("desk: " + (desk.error || "fail"));
  }
  order.emailError = errors.join("; ");
  await saveOrder(env, order);
  return order;
}

export async function handleEventCheckout(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Stripe is not configured on this Worker yet." }, 503);
  }

  if (path === "/api/events/checkout" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const event = body.event;
    if (!EVENTS[event]) return json({ error: "Unknown event" }, 400);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    if (!name || !email) return json({ error: "Name and email are required." }, 400);
    const items = buildLineItems(event, body);
    if (!items.length) return json({ error: "Add at least one ticket." }, 400);

    const ev = EVENTS[event];
    const origin = originOf(request);
    const params = {
      mode: "payment",
      success_url: origin + ev.successPath + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + ev.cancelPath,
      customer_email: email,
      "payment_intent_data[receipt_email]": email,
      billing_address_collection: "auto",
      phone_number_collection: { enabled: "true" },
      allow_promotion_codes: "true",
      "metadata[event]": event,
      "metadata[eventName]": ev.name,
      "metadata[eventDate]": body.eventDate || ev.date || "",
      "metadata[name]": name,
      "metadata[email]": email,
      "metadata[phone]": phone,
      "metadata[adults]": String(qty(body.adults || body.qty)),
      "metadata[children]": String(qty(body.children)),
      "metadata[family]": String(qty(body.family)),
      "metadata[under3]": String(qty(body.under3)),
      "metadata[wantRoom]": body.wantRoom === "yes" ? "yes" : "no",
      "metadata[notes]": String(body.notes || "").slice(0, 400),
    };
    items.forEach((it, i) => {
      params[`line_items[${i}][price]`] = it.price;
      params[`line_items[${i}][quantity]`] = String(it.quantity);
    });
    // Stripe wants phone_number_collection[enabled]=true as form field
    delete params.phone_number_collection;
    params["phone_number_collection[enabled]"] = "true";

    const session = await stripePost(env, "/checkout/sessions", params);
    if (!session.id || !session.url) {
      return json({ error: session.error?.message || "Could not start checkout." }, 400);
    }
    return json({ url: session.url, id: session.id });
  }

  if (path === "/api/events/confirm" && request.method === "GET") {
    const sessionId = url.searchParams.get("session_id") || "";
    if (!sessionId.startsWith("cs_")) return json({ error: "Missing session" }, 400);
    const session = await stripeGet(env, "/checkout/sessions/" + sessionId);
    if (!session.id) return json({ error: "Session not found" }, 404);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return json({ ok: false, paymentStatus: session.payment_status || session.status });
    }
    const existing = await env.PLANNER_DATA.get("events:order:" + session.id, { type: "json" });
    const order = orderFromSession(session, existing || {});
    await saveOrder(env, order);
    await notifyOrder(env, order);
    return json({ ok: true, order: { eventName: order.eventName, name: order.name, email: order.email, amount: order.amount } });
  }

  if (path === "/api/events/webhook" && request.method === "POST") {
    const raw = await request.text();
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return json({ error: "bad json" }, 400);
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      if (session?.id) {
        const existing = await env.PLANNER_DATA.get("events:order:" + session.id, { type: "json" });
        const order = orderFromSession(session, existing || {});
        await saveOrder(env, order);
        await notifyOrder(env, order);
      }
    }
    return json({ received: true });
  }

  if (path === "/api/events/orders" && request.method === "GET") {
    if (!ordersAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const index = (await env.PLANNER_DATA.get("events:index", { type: "json" })) || [];
    const orders = [];
    for (const id of index.slice(0, 300)) {
      const row = await env.PLANNER_DATA.get("events:order:" + id, { type: "json" });
      if (row) orders.push(row);
    }
    return json({ orders });
  }

  if (path === "/api/events/orders" && request.method === "PUT") {
    if (!ordersAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const body = await request.json();
    if (!body.id) return json({ error: "id required" }, 400);
    const existing = (await env.PLANNER_DATA.get("events:order:" + body.id, { type: "json" })) || {};
    const next = Object.assign({}, existing, {
      status: body.status || existing.status,
      staffNotes: body.staffNotes != null ? body.staffNotes : existing.staffNotes,
    });
    await saveOrder(env, next);
    return json({ ok: true, order: next });
  }

  return null;
}
