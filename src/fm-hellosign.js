/**
 * Dropbox Sign (HelloSign) — Fremont Makers
 * Email signature requests. No Client ID (that is only for embedded iframe).
 *
 * Account callback: POST https://tools.fremontmakers.com/api/fm/hellosign/callback
 * Secret: DROPBOX_SIGN_API_KEY (wrangler secret, never git)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function eventHashOk(env, eventTime, eventType, hash) {
  const key = env.DROPBOX_SIGN_API_KEY;
  if (!key || !hash) return false;
  const raw = String(eventTime) + String(eventType) + key;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === String(hash).toLowerCase();
}

function parseCallback(bodyText) {
  // HelloSign posts application/x-www-form-urlencoded with json=...
  try {
    const params = new URLSearchParams(bodyText);
    const raw = params.get("json") || bodyText;
    return JSON.parse(raw);
  } catch {
    try { return JSON.parse(bodyText); } catch { return null; }
  }
}

export async function handleFmHellosign(request, env) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/$/, "") || "/";

  if (p === "/api/fm/hellosign/status" && request.method === "GET") {
    const set = !!(env.DROPBOX_SIGN_API_KEY && String(env.DROPBOX_SIGN_API_KEY).length > 8);
    if (!set) return json({ ok: false, set: false, error: "DROPBOX_SIGN_API_KEY is not set on this Worker." }, 503);
    try {
      const auth = "Basic " + btoa(env.DROPBOX_SIGN_API_KEY + ":");
      const res = await fetch("https://api.hellosign.com/v3/account", { headers: { Authorization: auth } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ ok: false, set: true, error: data.error?.error_msg || "HelloSign rejected the key." }, 502);
      const email = data.account && data.account.email_address;
      return json({ ok: true, set: true, account: email || "ok", mode: "email" });
    } catch (err) {
      return json({ ok: false, set: true, error: err.message }, 502);
    }
  }

  if (p === "/api/fm/hellosign/callback" && request.method === "POST") {
    const text = await request.text();
    const payload = parseCallback(text);
    const ev = payload && payload.event;
    if (ev && env.DROPBOX_SIGN_API_KEY) {
      const ok = await eventHashOk(env, ev.event_time, ev.event_type, ev.event_hash);
      if (!ok) return json({ ok: false, error: "bad event hash" }, 401);
    }
    try {
      const rec = {
        at: Date.now(),
        type: (ev && ev.event_type) || "unknown",
        signature_request_id: payload?.signature_request?.signature_request_id || "",
      };
      await env.PLANNER_DATA.put("fm-hellosign:last-event", JSON.stringify(rec));
    } catch (_) {}
    // HelloSign requires a 200 with this exact body.
    return new Response("Hello API Event Received", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return null;
}
