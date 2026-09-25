/**
 * Venue inquiry forms (Post Office, Annex, Holiday Table).
 * POST /api/venue-inquire → Resend to hello@unbridledhospitality.com
 */

const TO = "hello@unbridledhospitality.com";
const FROM_HOTEL = "Hotel St. Cloud venues <reservations@hotelstcloud.com>";
const FROM_FALLBACK = "Hotel St. Cloud venues <noreply@fremontmakers.com>";

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

function pick(body) {
  const g = (k) => String(body[k] == null ? "" : body[k]).trim().slice(0, 2000);
  return {
    venue: g("venue").slice(0, 200),
    page: g("page").slice(0, 400),
    name: g("name").slice(0, 120),
    email: g("email").slice(0, 160),
    phone: g("phone").slice(0, 60),
    kind: g("kind").slice(0, 80),
    date: g("date").slice(0, 40),
    guests: g("guests").slice(0, 20),
    room: g("room").slice(0, 120),
    kitchen: g("kitchen").slice(0, 120),
    notes: g("notes").slice(0, 2000),
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

export async function handleVenueInquire(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/venue-inquire") return null;
  if (request.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const d = pick(body);
  if (!d.name || !d.email) {
    return json({ error: "name and email required" }, 400);
  }

  const row = (label, val) =>
    `<tr><td style="padding:8px 12px;color:#666;white-space:nowrap">${esc(label)}</td><td style="padding:8px 12px">${esc(val) || "—"}</td></tr>`;

  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f3ece1;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e6dccb;padding:24px">
    <p style="letter-spacing:.16em;text-transform:uppercase;font-size:11px;color:#6e2c2c;margin:0 0 8px">Venue inquiry</p>
    <h1 style="font-size:22px;margin:0 0 16px;color:#1c2838">${esc(d.venue || "Hall")}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${row("Name", d.name)}
      ${row("Email", d.email)}
      ${row("Phone", d.phone)}
      ${row("Kind of night", d.kind)}
      ${row("Date", d.date)}
      ${row("Headcount", d.guests)}
      ${row("Hall", d.room)}
      ${row("Who cooks", d.kitchen)}
      ${row("Notes", d.notes)}
      ${row("Page", d.page)}
    </table>
  </div>
  </body></html>`;

  const text = [
    d.venue,
    "",
    "Name: " + d.name,
    "Email: " + d.email,
    "Phone: " + d.phone,
    "Kind: " + d.kind,
    "Date: " + d.date,
    "Headcount: " + d.guests,
    "Hall: " + d.room,
    "Kitchen: " + d.kitchen,
    "Notes: " + d.notes,
    "Page: " + d.page,
  ].join("\n");

  const subject =
    "Venue · " +
    (d.room || d.venue || "inquiry") +
    " · " +
    (d.date || "date TBD") +
    " · " +
    d.name;

  const payload = {
    to: [TO],
    subject,
    html,
    text,
  };
  if (d.email) payload.reply_to = d.email;

  let sent = await sendResend(env, Object.assign({}, payload, { from: FROM_HOTEL }));
  if (!sent.id) {
    sent = await sendResend(env, Object.assign({}, payload, { from: FROM_FALLBACK }));
  }
  if (!sent.id) {
    return json({ success: false, error: String(sent.error || "send failed") }, 502);
  }
  return json({ success: true, id: sent.id });
}
