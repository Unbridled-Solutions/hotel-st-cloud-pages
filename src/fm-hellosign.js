/**
 * Dropbox Sign (HelloSign) — Fremont Makers
 * Email signature requests. No Client ID (iframe only).
 *
 * POST https://tools.fremontmakers.com/api/fm/hellosign/callback
 * POST https://tools.fremontmakers.com/api/fm/hellosign/send
 * GET  https://tools.fremontmakers.com/api/fm/hellosign/status
 * Secret: DROPBOX_SIGN_API_KEY
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function authHeader(key) {
  return "Basic " + btoa(key + ":");
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
  try {
    const params = new URLSearchParams(bodyText);
    const raw = params.get("json") || bodyText;
    return JSON.parse(raw);
  } catch {
    try { return JSON.parse(bodyText); } catch { return null; }
  }
}

function pdfEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textToPdf(title, body) {
  const lines = [];
  const wrap = (text, max) => {
    const words = String(text || "").split(/\s+/);
    let cur = "";
    words.forEach((w) => {
      if ((cur + " " + w).trim().length > max) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    });
    if (cur) lines.push(cur);
  };
  wrap(title, 72);
  lines.push("");
  String(body || "").split(/\n/).forEach((row) => {
    if (!row.trim()) { lines.push(""); return; }
    wrap(row, 86);
  });
  const content = ["BT", "/F1 12 Tf", "50 760 Td", "14 TL"];
  lines.slice(0, 48).forEach((ln, i) => {
    if (i === 0) content.push("(" + pdfEscape(ln) + ") Tj");
    else content.push("T* (" + pdfEscape(ln) + ") Tj");
  });
  content.push("ET");
  const stream = content.join("\n");
  const objs = [];
  const add = (s) => { objs.push(s); };
  add("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj");
  add("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj");
  add("3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj");
  add("4 0 obj<< /Length " + stream.length + " >>stream\n" + stream + "\nendstream endobj");
  add("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj");
  let pdf = "%PDF-1.4\n";
  const offs = [0];
  objs.forEach((o) => { offs.push(pdf.length); pdf += o + "\n"; });
  const xref = pdf.length;
  pdf += "xref\n0 " + (objs.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  offs.slice(1).forEach((n) => { pdf += String(n).padStart(10, "0") + " 00000 n \n"; });
  pdf += "trailer<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return pdf;
}

async function sendSignatureRequest(env, payload) {
  const key = env.DROPBOX_SIGN_API_KEY;
  if (!key) return { ok: false, error: "DROPBOX_SIGN_API_KEY is not set." };
  const email = String(payload.signerEmail || "").trim();
  const name = String(payload.signerName || payload.signerEmail || "Buyer").trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Buyer email is required." };
  const title = payload.title || "Fremont Makers";
  const subject = payload.subject || title;
  const message = payload.message || "Please review and sign.";
  const pdf = textToPdf(title, payload.documentText || title);
  const form = new FormData();
  form.append("title", title);
  form.append("subject", subject);
  form.append("message", message);
  form.append("signers[0][email_address]", email);
  form.append("signers[0][name]", name);
  form.append("signers[0][order]", "0");
  form.append("file[0]", new Blob([pdf], { type: "application/pdf" }), "fremont-makers.pdf");
  form.append("metadata[quote_id]", String(payload.quoteId || ""));
  form.append("metadata[kind]", String(payload.kind || "contract"));
  if (payload.testMode) form.append("test_mode", "1");
  const res = await fetch("https://api.hellosign.com/v3/signature_request/send", {
    method: "POST",
    headers: { Authorization: authHeader(key) },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error?.error_msg || data.error?.error_name || "HelloSign send failed." };
  }
  const sr = data.signature_request || {};
  return {
    ok: true,
    signature_request_id: sr.signature_request_id || "",
    details_url: sr.details_url || "",
  };
}

async function stampQuoteSign(env, quoteId, rec) {
  if (!quoteId) return;
  try {
    const raw = await env.PLANNER_DATA.get("bundle:fm-quotes");
    const bundle = raw ? JSON.parse(raw) : {};
    const key = "fm-quote-" + quoteId;
    let q = bundle[key];
    if (typeof q === "string") q = JSON.parse(q);
    if (!q || typeof q !== "object") return;
    const list = Array.isArray(q.signRequests) ? q.signRequests : [];
    list.push(rec);
    q.signRequests = list;
    bundle[key] = q;
    await env.PLANNER_DATA.put("bundle:fm-quotes", JSON.stringify(bundle));
  } catch (_) {}
}

export async function handleFmHellosign(request, env) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/$/, "") || "/";

  if (p === "/api/fm/hellosign/status" && request.method === "GET") {
    const set = !!(env.DROPBOX_SIGN_API_KEY && String(env.DROPBOX_SIGN_API_KEY).length > 8);
    if (!set) return json({ ok: false, set: false, error: "DROPBOX_SIGN_API_KEY is not set on this Worker." }, 503);
    try {
      const res = await fetch("https://api.hellosign.com/v3/account", { headers: { Authorization: authHeader(env.DROPBOX_SIGN_API_KEY) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return json({ ok: false, set: true, error: data.error?.error_msg || "HelloSign rejected the key." }, 502);
      const email = data.account && data.account.email_address;
      return json({ ok: true, set: true, account: email || "ok", mode: "email" });
    } catch (err) {
      return json({ ok: false, set: true, error: err.message }, 502);
    }
  }

  if (p === "/api/fm/hellosign/send" && request.method === "POST") {
    let payload = {};
    try { payload = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    try {
      const out = await sendSignatureRequest(env, payload);
      if (out.ok && payload.quoteId) {
        await stampQuoteSign(env, payload.quoteId, {
          at: Date.now(),
          kind: payload.kind || "contract",
          signature_request_id: out.signature_request_id,
          signerEmail: payload.signerEmail,
          status: "sent",
        });
      }
      return json(out, out.ok ? 200 : 400);
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
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
      const sr = payload?.signature_request || {};
      const rec = {
        at: Date.now(),
        type: (ev && ev.event_type) || "unknown",
        signature_request_id: sr.signature_request_id || "",
        quote_id: sr.metadata?.quote_id || "",
        is_complete: !!sr.is_complete,
      };
      await env.PLANNER_DATA.put("fm-hellosign:last-event", JSON.stringify(rec));
      if (rec.quote_id) {
        await stampQuoteSign(env, rec.quote_id, {
          at: Date.now(),
          kind: sr.metadata?.kind || "",
          signature_request_id: rec.signature_request_id,
          status: rec.is_complete ? "complete" : (ev?.event_type || "event"),
        });
      }
    } catch (_) {}
    return new Response("Hello API Event Received", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return null;
}
