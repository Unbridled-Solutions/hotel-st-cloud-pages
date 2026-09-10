/**
 * Unbridled Hospitality HR form submissions.
 * New hire, employee update, disciplinary, termination.
 * Emails jcarter@unbridledhospitality.com and stores a desk copy in KV.
 */

const HR_TO = "jcarter@unbridledhospitality.com";
const FROM_HOTEL = "Unbridled Hospitality HR <reservations@hotelstcloud.com>";
const FROM_FALLBACK = "Unbridled Hospitality HR <noreply@fremontmakers.com>";

const TYPES = {
  "new-hire": "New Hire",
  "employee-update": "Employee Update",
  "disciplinary": "Disciplinary",
  "termination": "Termination",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function hrAuthed(request, env) {
  const key = env.HR_TRACKER_KEY;
  if (!key) return false;
  const url = new URL(request.url);
  const sent = request.headers.get("x-hr-key") || url.searchParams.get("key") || "";
  return sent === key;
}

function maskValue(key, value) {
  const k = String(key || "");
  const v = String(value == null ? "" : value);
  if (!v) return v;
  if (/ssn|social/i.test(k)) {
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 4) return "***-**-" + digits.slice(-4);
    return "••••";
  }
  if (v.startsWith("data:")) return "(file attached on form, not stored)";
  if (v.length > 4000) return v.slice(0, 4000) + "…";
  return v;
}

function cleanFields(fields) {
  const out = {};
  if (!fields || typeof fields !== "object") return out;
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (typeof v === "boolean") {
      out[k] = v;
      continue;
    }
    const s = String(v).trim();
    if (!s) continue;
    out[k] = maskValue(k, s);
  }
  return out;
}

function employeeName(type, fields) {
  if (fields.employeeName) return fields.employeeName;
  const first = fields.firstName || "";
  const last = fields.lastName || "";
  const full = (first + " " + last).trim();
  if (full) return full;
  if (fields.name) return fields.name;
  return "Unknown";
}

function escapeHtml(s) {
  const amp = String.fromCharCode(38);
  return String(s)
    .split(amp).join(amp + "amp;")
    .split("<").join(amp + "lt;")
    .split(">").join(amp + "gt;")
    .split('"').join(amp + "quot;");
}

function fieldsHtml(fields) {
  const rows = Object.entries(fields)
    .filter(([k]) => !/^s-/.test(k))
    .map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>`;
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

async function sendHrMail(env, payload) {
  const first = await sendResend(env, Object.assign({}, payload, { from: FROM_HOTEL }));
  if (first.id) return Object.assign(first, { from: FROM_HOTEL });
  const second = await sendResend(env, Object.assign({}, payload, { from: FROM_FALLBACK }));
  if (second.id) return Object.assign(second, { from: FROM_FALLBACK, fallback: first.error });
  return { error: first.error || second.error || "send failed" };
}

async function saveSubmission(env, rec) {
  await env.PLANNER_DATA.put("hr:sub:" + rec.id, JSON.stringify(rec));
  let index = [];
  try {
    index = (await env.PLANNER_DATA.get("hr:index", { type: "json" })) || [];
  } catch {
    index = [];
  }
  if (!Array.isArray(index)) index = [];
  index = [rec.id].concat(index.filter((id) => id !== rec.id)).slice(0, 500);
  await env.PLANNER_DATA.put("hr:index", JSON.stringify(index));
}

export async function handleHrForms(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/hr/submit" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const type = body.type;
    if (!TYPES[type]) return json({ error: "Unknown form type" }, 400);
    const fields = cleanFields(body.fields);
    const name = String(body.employeeName || employeeName(type, fields)).trim() || "Unknown";
    const rec = {
      id: "hr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type,
      typeLabel: TYPES[type],
      employeeName: name,
      managerName: fields.managerName || fields.manager || "",
      location: fields.managerLocation || fields.managerTitle || fields.property || "",
      fields,
      status: "new",
      staffNotes: "",
      created: Date.now(),
      emailId: "",
      emailError: "",
    };
    const mail = await sendHrMail(env, {
      to: [HR_TO],
      reply_to: HR_TO,
      subject: `[HR] ${rec.typeLabel} · ${rec.employeeName}`,
      html: `<p>A <strong>${rec.typeLabel}</strong> form was submitted.</p>
<p>Employee: <strong>${rec.employeeName}</strong><br>
Manager: ${rec.managerName || "—"}<br>
Location: ${rec.location || "—"}</p>
${fieldsHtml(fields)}
<p><a href="https://tools.hotelstcloud.com/hr">Open HR tracker</a></p>
<p style="color:#888;font-size:12px">SSN and uploaded files are not included in this email.</p>`,
    });
    if (mail.id) rec.emailId = mail.id;
    else rec.emailError = mail.error || "send failed";
    if (mail.fallback) rec.emailError = (rec.emailError ? rec.emailError + "; " : "") + "from fallback";
    await saveSubmission(env, rec);
    return json({ ok: true, id: rec.id, emailed: Boolean(mail.id) });
  }

  if (path === "/api/hr/submissions" && request.method === "GET") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const index = (await env.PLANNER_DATA.get("hr:index", { type: "json" })) || [];
    const rows = [];
    for (const id of index.slice(0, 400)) {
      const row = await env.PLANNER_DATA.get("hr:sub:" + id, { type: "json" });
      if (row) rows.push(row);
    }
    return json({ submissions: rows });
  }

  if (path === "/api/hr/submissions" && request.method === "PUT") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const body = await request.json();
    if (!body.id) return json({ error: "id required" }, 400);
    const existing = (await env.PLANNER_DATA.get("hr:sub:" + body.id, { type: "json" })) || {};
    const next = Object.assign({}, existing, {
      status: body.status || existing.status,
      staffNotes: body.staffNotes != null ? body.staffNotes : existing.staffNotes,
    });
    await env.PLANNER_DATA.put("hr:sub:" + body.id, JSON.stringify(next));
    return json({ ok: true, submission: next });
  }

  return null;
}
