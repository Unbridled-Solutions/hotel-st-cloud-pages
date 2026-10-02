/**
 * Unbridled Hospitality HR form submissions.
 * New hire, employee update, disciplinary, termination, plus Active roster.
 * Emails jcarter@unbridledhospitality.com and stores a desk copy in KV.
 *
 * Full SSN is stored on the record (ssnFull) for payroll.
 * Email + tracker list stay masked. Reveal is GET /api/hr/ssn with
 * tracker PIN (x-hr-key) AND Jessica payroll PIN 0518 (x-payroll-pin).
 *
 * Files (I-9 photos, extra docs) live in R2 MAINTENANCE_UPLOADS under hr/<id>/.
 * Download: GET /api/hr/file/<key> with x-hr-key.
 *
 * Active employees (status "active") are scanned daily for Colorado Secure
 * Savings Roth: 180 days from hire date and age 18+. Emails Jessica once.
 */

const HR_TO = "jcarter@unbridledhospitality.com";
const FROM_HOTEL = "Unbridled Hospitality HR <reservations@hotelstcloud.com>";
const FROM_FALLBACK = "Unbridled Hospitality HR <noreply@fremontmakers.com>";
const SSN_PIN = "0518";
const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const STATUSES = ["new", "in-progress", "done", "active", "archived"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPES = {
  "new-hire": "New Hire",
  "employee-update": "Employee Update",
  "disciplinary": "Disciplinary",
  "termination": "Termination",
  "active": "Active",
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

function ssnPinOk(request) {
  const url = new URL(request.url);
  const sent = request.headers.get("x-payroll-pin") || url.searchParams.get("pin") || "";
  return String(sent).trim() === SSN_PIN;
}

function digitsOnly(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}

function formatSsn(digits) {
  const d = digitsOnly(digits);
  if (d.length === 9) return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
  return d;
}

function maskSsnDigits(digits) {
  const d = digitsOnly(digits);
  if (d.length >= 4) return "***-**-" + d.slice(-4);
  return d ? "••••" : "";
}

function extractSsn(fields) {
  if (!fields || typeof fields !== "object") return "";
  for (const [k, v] of Object.entries(fields)) {
    if (!/ssn|social/i.test(k)) continue;
    const d = digitsOnly(v);
    if (d.length === 9) return d;
  }
  return "";
}

function maskValue(key, value) {
  const k = String(key || "");
  const v = String(value == null ? "" : value);
  if (!v) return v;
  if (/ssn|social/i.test(k)) {
    return maskSsnDigits(v) || "••••";
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

function parseDateParts(v) {
  if (v && typeof v === "object" && v.y && v.mo && v.d) {
    return { y: +v.y, mo: +v.mo, d: +v.d };
  }
  const s = String(v == null ? "" : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { y: +m[3], mo: +m[1], d: +m[2] };
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase()) + 1;
    if (mo) return { y: +m[3], mo, d: +m[2] };
  }
  return null;
}

function formatLongDate(v) {
  const p = parseDateParts(v);
  if (!p || p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31) {
    return String(v == null ? "" : v).trim();
  }
  return MONTHS[p.mo - 1] + " " + String(p.d).padStart(2, "0") + ", " + p.y;
}

function denverTodayParts(now = Date.now()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(now));
  const get = (t) => +parts.find((p) => p.type === t).value;
  return { y: get("year"), mo: get("month"), d: get("day") };
}

function addDays(p, n) {
  const dt = new Date(Date.UTC(p.y, p.mo - 1, p.d + n));
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function daysBetween(a, b) {
  const aUtc = Date.UTC(a.y, a.mo - 1, a.d);
  const bUtc = Date.UTC(b.y, b.mo - 1, b.d);
  return Math.floor((bUtc - aUtc) / 86400000);
}

function ageOn(dob, on) {
  let age = on.y - dob.y;
  if (on.mo < dob.mo || (on.mo === dob.mo && on.d < dob.d)) age -= 1;
  return age;
}

function recField(rec, keys) {
  const f = rec && rec.fields && typeof rec.fields === "object" ? rec.fields : {};
  for (const k of keys) {
    if (f[k]) return f[k];
  }
  return "";
}

function savingsInfo(rec, today = denverTodayParts()) {
  const hire = parseDateParts(recField(rec, ["hireDate", "hire_date", "startDate"]));
  const dob = parseDateParts(recField(rec, ["dob", "dateOfBirth", "birthDate"]));
  const emailedAt = rec && rec.coSecureSavings && rec.coSecureSavings.emailedAt;
  const out = {
    hireDate: hire ? formatLongDate(hire) : "",
    dobOnFile: Boolean(dob),
    daysEmployed: hire ? daysBetween(hire, today) : null,
    dueOn: hire ? formatLongDate(addDays(hire, 180)) : "",
    age: dob ? ageOn(dob, today) : null,
    eligible: false,
    emailed: Boolean(emailedAt),
    emailedAt: emailedAt || null,
    reason: (rec && rec.coSecureSavings && rec.coSecureSavings.reason) || "",
  };
  out.eligible = out.daysEmployed != null && out.daysEmployed >= 180 && out.age != null && out.age >= 18;
  return out;
}

function publicRecord(rec) {
  if (!rec || typeof rec !== "object") return rec;
  const copy = Object.assign({}, rec);
  delete copy.ssnFull;
  const fields = Object.assign({}, rec.fields || {});
  const full = digitsOnly(rec.ssnFull || "");
  if (full.length === 9) fields.ssn = maskSsnDigits(full);
  copy.fields = fields;
  copy.ssnOnFile = full.length === 9;
  copy.savings = savingsInfo(rec);
  return copy;
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

function safeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
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

async function loadAllSubs(env) {
  const index = (await env.PLANNER_DATA.get("hr:index", { type: "json" })) || [];
  const rows = [];
  for (const id of (Array.isArray(index) ? index : []).slice(0, 500)) {
    const row = await env.PLANNER_DATA.get("hr:sub:" + id, { type: "json" });
    if (row) rows.push(row);
  }
  return rows;
}

async function parseSubmitBody(request) {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("multipart/form-data")) {
    const fd = await request.formData();
    const raw = fd.get("data");
    const body = JSON.parse(typeof raw === "string" ? raw : "{}");
    const files = fd.getAll("files").filter(Boolean);
    return { body, files };
  }
  const body = await request.json();
  return { body, files: [] };
}

async function storeHrFiles(env, recId, files) {
  const attachments = [];
  if (!files || !files.length) return attachments;
  const bucket = env.MAINTENANCE_UPLOADS;
  if (!bucket) throw new Error("File storage is not configured");
  let n = 0;
  const errors = [];
  for (const file of files) {
    if (n >= MAX_FILES) break;
    let buf;
    try {
      buf = await file.arrayBuffer();
    } catch (err) {
      errors.push((file && file.name) || "file");
      continue;
    }
    if (!buf || !buf.byteLength) {
      errors.push((file && file.name) || "empty");
      continue;
    }
    if (buf.byteLength > MAX_BYTES) {
      errors.push(((file && file.name) || "file") + " over 8 MB");
      continue;
    }
    const filename = safeName(file.name || ("file-" + n + ".bin"));
    const key = "hr/" + recId + "/" + filename;
    await bucket.put(key, buf, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    attachments.push({ name: file.name || filename, key, size: buf.byteLength, type: file.type || "" });
    n += 1;
  }
  if (!attachments.length) {
    throw new Error(errors.length ? ("Could not store files: " + errors.join(", ")) : "Could not store files");
  }
  return attachments;
}

function savingsEmailHtml(rec, info, reason) {
  const name = escapeHtml(rec.employeeName || "Unknown");
  const hire = escapeHtml(info.hireDate || "—");
  const due = escapeHtml(info.dueOn || "—");
  const days = info.daysEmployed == null ? "—" : String(info.daysEmployed);
  const age = info.age == null ? "not on file" : String(info.age);
  const loc = escapeHtml(rec.location || "—");
  if (reason === "missing-dob") {
    return `<p>${name} has been <strong>active 180 days</strong> (hire date ${hire}; due ${due}; ${days} days in).</p>
<p>Date of birth is not on the Active card, so age could not be confirmed. Confirm they are 18 or older, then enter them into the <strong>Colorado Secure Savings Roth</strong> program.</p>
<p>Location: ${loc}</p>
<p><a href="https://tools.unbridledhospitality.com/hr/tracker/">Open HR tracker</a></p>`;
  }
  return `<p>${name} has been <strong>active 180 days</strong> and is 18 or older.</p>
<p>Hire date: ${hire}<br>
180-day date: ${due}<br>
Days employed: ${days}<br>
Age (from DOB on file): ${age}<br>
Location: ${loc}</p>
<p>Please enter them into the <strong>Colorado Secure Savings Roth</strong> program.</p>
<p><a href="https://tools.unbridledhospitality.com/hr/tracker/">Open HR tracker</a></p>`;
}

export async function handleHrSavingsScan(env) {
  const today = denverTodayParts();
  const rows = await loadAllSubs(env);
  const sent = [];
  const skipped = [];
  for (const rec of rows) {
    if ((rec.status || "") !== "active") continue;
    if (rec.coSecureSavings && rec.coSecureSavings.emailedAt) {
      skipped.push({ id: rec.id, reason: "already-emailed" });
      continue;
    }
    const info = savingsInfo(rec, today);
    if (info.daysEmployed == null || info.daysEmployed < 180) continue;
    let reason = "enroll";
    if (!info.dobOnFile) reason = "missing-dob";
    else if (info.age == null || info.age < 18) {
      skipped.push({ id: rec.id, reason: "under-18" });
      continue;
    }
    const mail = await sendHrMail(env, {
      to: [HR_TO],
      reply_to: HR_TO,
      subject: `[HR] Colorado Secure Savings · ${rec.employeeName}`,
      html: savingsEmailHtml(rec, info, reason),
    });
    rec.coSecureSavings = {
      emailedAt: Date.now(),
      emailId: mail.id || "",
      emailError: mail.error || "",
      reason,
      days: info.daysEmployed,
      age: info.age,
    };
    await env.PLANNER_DATA.put("hr:sub:" + rec.id, JSON.stringify(rec));
    sent.push({
      id: rec.id,
      name: rec.employeeName,
      reason,
      emailed: Boolean(mail.id),
      error: mail.error || "",
    });
  }
  return { ok: true, sent, skipped: skipped.length };
}

export async function handleHrForms(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/hr/submit" && request.method === "POST") {
    let parsed;
    try {
      parsed = await parseSubmitBody(request);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const body = parsed.body || {};
    const type = body.type;
    if (!TYPES[type] || type === "active") return json({ error: "Unknown form type" }, 400);
    const rawFields = body.fields || {};
    const ssnFull = extractSsn(rawFields);
    const fields = cleanFields(rawFields);
    const name = String(body.employeeName || employeeName(type, fields)).trim() || "Unknown";
    const rec = {
      id: "hr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type,
      typeLabel: TYPES[type],
      employeeName: name,
      managerName: fields.managerName || fields.manager || "",
      location: fields.managerLocation || fields.managerTitle || fields.property || "",
      fields,
      ssnFull: ssnFull.length === 9 ? ssnFull : "",
      attachments: [],
      status: "new",
      staffNotes: "",
      created: Date.now(),
      emailId: "",
      emailError: "",
    };
    if (type === "new-hire" && (!parsed.files || !parsed.files.length)) {
      return json({ error: "I-9 photos are required. Upload them and Submit to HR again." }, 400);
    }
    try {
      rec.attachments = await storeHrFiles(env, rec.id, parsed.files);
    } catch (err) {
      return json({ error: (err && err.message) || "Could not store files" }, 500);
    }
    const fileLine = rec.attachments.length
      ? `<p>Files on tracker: ${rec.attachments.map((a) => escapeHtml(a.name)).join(", ")}</p>`
      : "";
    const mail = await sendHrMail(env, {
      to: [HR_TO],
      reply_to: HR_TO,
      subject: `[HR] ${rec.typeLabel} · ${rec.employeeName}`,
      html: `<p>A <strong>${rec.typeLabel}</strong> form was submitted.</p>
<p>Employee: <strong>${rec.employeeName}</strong><br>
Manager: ${rec.managerName || "—"}<br>
Location: ${rec.location || "—"}</p>
${fieldsHtml(fields)}
${fileLine}
<p><a href="https://tools.unbridledhospitality.com/hr/tracker/">Open HR tracker</a></p>
<p style="color:#888;font-size:12px">Full SSN is not in this email. Open the tracker card and use View SSN with the payroll PIN. Uploaded files are on the tracker, not attached here.</p>`,
    });
    if (mail.id) rec.emailId = mail.id;
    else rec.emailError = mail.error || "send failed";
    if (mail.fallback) rec.emailError = (rec.emailError ? rec.emailError + "; " : "") + "from fallback";
    await saveSubmission(env, rec);
    return json({
      ok: true,
      id: rec.id,
      emailed: Boolean(mail.id),
      ssnOnFile: rec.ssnFull.length === 9,
      files: rec.attachments.length,
    });
  }

  if (path === "/api/hr/employee" && request.method === "POST") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const first = String(body.firstName || "").trim();
    const last = String(body.lastName || "").trim();
    const name = String(body.employeeName || (first + " " + last).trim()).trim();
    if (!name) return json({ error: "Name required" }, 400);
    const hireDate = formatLongDate(body.hireDate || "");
    if (!parseDateParts(hireDate)) return json({ error: "Hire date required" }, 400);
    const dobRaw = String(body.dob || "").trim();
    const dob = dobRaw ? formatLongDate(dobRaw) : "";
    if (dobRaw && !parseDateParts(dob)) return json({ error: "Date of birth is not a valid date" }, 400);
    const location = String(body.location || "").trim();
    const managerName = String(body.managerName || "").trim();
    const fields = cleanFields({
      firstName: first,
      lastName: last,
      employeeName: name,
      hireDate,
      dob,
      position: body.position,
      phone: body.phone,
      email: body.email,
      managerName,
      managerLocation: location,
    });
    const rec = {
      id: "hr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type: "active",
      typeLabel: "Active",
      employeeName: name,
      managerName,
      location,
      fields,
      ssnFull: "",
      attachments: [],
      status: "active",
      staffNotes: String(body.staffNotes || "").trim(),
      created: Date.now(),
      source: "manual",
      emailId: "",
      emailError: "",
    };
    await saveSubmission(env, rec);
    return json({ ok: true, id: rec.id, submission: publicRecord(rec) });
  }

  if ((path === "/api/hr/savings-scan" && (request.method === "POST" || request.method === "GET"))) {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const result = await handleHrSavingsScan(env);
    return json(result);
  }

  if (path.startsWith("/api/hr/file/") && request.method === "GET") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const key = decodeURIComponent(path.slice("/api/hr/file/".length));
    if (!key.startsWith("hr/") || key.includes("..")) return json({ error: "Not found" }, 404);
    const obj = await env.MAINTENANCE_UPLOADS.get(key);
    if (!obj) return json({ error: "Not found" }, 404);
    const name = key.split("/").pop() || "file";
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": 'attachment; filename="' + name.replace(/"/g, "") + '"',
        "Cache-Control": "private, no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (path === "/api/hr/ssn" && request.method === "GET") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    if (!ssnPinOk(request)) return json({ error: "Payroll PIN required" }, 401);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return json({ error: "id required" }, 400);
    const rec = await env.PLANNER_DATA.get("hr:sub:" + id, { type: "json" });
    if (!rec) return json({ error: "Not found" }, 404);
    const full = digitsOnly(rec.ssnFull || "");
    const last4 = full.length >= 4 ? full.slice(-4) : digitsOnly((rec.fields || {}).ssn).slice(-4);
    if (full.length !== 9) {
      return json({
        id,
        onFile: false,
        last4: last4 || "",
        ssn: "",
        message: "Full SSN was not stored on this record. Last four only.",
      });
    }
    return json({ id, onFile: true, last4: full.slice(-4), ssn: formatSsn(full) });
  }

  if (path === "/api/hr/submissions" && request.method === "GET") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const rows = await loadAllSubs(env);
    return json({ submissions: rows.slice(0, 400).map(publicRecord) });
  }

  if (path === "/api/hr/submissions" && request.method === "PUT") {
    if (!hrAuthed(request, env)) return json({ error: "Unauthorized" }, 401);
    const body = await request.json();
    if (!body.id) return json({ error: "id required" }, 400);
    const existing = (await env.PLANNER_DATA.get("hr:sub:" + body.id, { type: "json" })) || {};
    if (!existing.id) return json({ error: "Not found" }, 404);
    const next = Object.assign({}, existing, {
      status: body.status || existing.status,
      staffNotes: body.staffNotes != null ? body.staffNotes : existing.staffNotes,
    });
    if (body.status && STATUSES.indexOf(body.status) === -1) {
      return json({ error: "Unknown status" }, 400);
    }
    if (body.employeeName) next.employeeName = String(body.employeeName).trim();
    if (body.managerName != null) next.managerName = String(body.managerName).trim();
    if (body.location != null) next.location = String(body.location).trim();
    if (body.fields && typeof body.fields === "object") {
      const merged = Object.assign({}, existing.fields || {}, cleanFields(body.fields));
      if (body.fields.hireDate) merged.hireDate = formatLongDate(body.fields.hireDate);
      if (body.fields.dob) merged.dob = formatLongDate(body.fields.dob);
      next.fields = merged;
    }
    await env.PLANNER_DATA.put("hr:sub:" + body.id, JSON.stringify(next));
    return json({ ok: true, submission: publicRecord(next) });
  }

  return null;
}
