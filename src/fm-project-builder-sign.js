/**
 * Project Builder in-tool e-sign (HANDOFF §34). Never writes ns=fm-quotes.
 *
 * POST /api/projectbuilder/sign/send
 * GET  /api/projectbuilder/sign/:token
 * GET  /api/projectbuilder/sign/:token/document
 * POST /api/projectbuilder/sign/:token
 * POST /api/projectbuilder/sign/:id/cancel
 * POST /api/projectbuilder/sign/:id/remind
 * POST /api/projectbuilder/sign/outside
 *
 * Server sets at (UTC), ip, userAgent. Tokens are secrets — never logged whole.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FMSign = require("./../assets/fm-project-builder-2/src/fm-phase2-sign.js");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const NS = "fm-phase1";
const SIGN_BASE = "https://tools.fremontmakers.com/projectbuilder";
const MAX_HTML = 4 * 1024 * 1024;
const hits = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function denverToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function rateLimit(key) {
  const now = Date.now();
  const win = hits.get(key) || [];
  const recent = win.filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 30;
}

function tokenTail(t) {
  const s = String(t || "");
  return s.length > 8 ? s.slice(0, 4) + "…" + s.slice(-4) : "(short)";
}

async function sha256Hex(buf) {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function freezeWrap(inner) {
  return (
    "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Fremont Makers · document to sign</title>" +
    "<link rel=\"stylesheet\" href=\"https://tools.fremontmakers.com/assets/fm-project-builder-2/src/fm-phase1-theme.css\">" +
    "<link rel=\"stylesheet\" href=\"https://tools.fremontmakers.com/assets/fm-project-builder-2/src/fm-phase1-print.css\">" +
    "<style>body{margin:0;background:#EFE8DA;padding:16px}</style></head>" +
    "<body class=\"fm-p1\">" +
    inner +
    "</body></html>"
  );
}

function filesBucket(env) {
  return env.FM_PROJECT_BUILDER_FILES || env.fm_project_builder_files || null;
}

async function putBytes(env, id, bytes, type, name, jobCode, sha256) {
  const store = filesBucket(env);
  if (!store) throw new Error("File storage is not configured.");
  await store.put("files/" + id, bytes, {
    httpMetadata: { contentType: type },
    customMetadata: { jobCode: String(jobCode || ""), sha256, name: String(name || id).slice(0, 180) },
  });
}

async function getBytes(env, id) {
  const store = filesBucket(env);
  if (!store) return null;
  const obj = await store.get("files/" + id);
  if (!obj) return null;
  return { buf: await obj.arrayBuffer(), type: obj.httpMetadata?.contentType || "application/octet-stream" };
}

function parseState(data) {
  let st = data && data["fm-phase1-state"];
  if (typeof st === "string") {
    try { st = JSON.parse(st); } catch (e) { st = null; }
  }
  if (!st || typeof st !== "object") st = { jobs: [], log: [], seq: 0, today: denverToday() };
  if (!Array.isArray(st.jobs)) st.jobs = [];
  if (!Array.isArray(st.log)) st.log = [];
  if (!st.seq) st.seq = 0;
  return st;
}

async function loadState(env) {
  const raw = await env.PLANNER_DATA.get("bundle:" + NS);
  const data = raw ? JSON.parse(raw) : {};
  return { data, state: parseState(data) };
}

async function saveState(env, data, state, logText, jobCode, by) {
  if (logText) {
    state.seq = (state.seq || 0) + 1;
    state.log = state.log || [];
    state.log.unshift({
      id: state.seq,
      jobCode: jobCode || "",
      text: logText,
      by: by || "system",
      at: new Date().toISOString(),
    });
  }
  const next = Object.assign({}, data || {}, {
    "fm-phase1-state": state,
    "fm-phase1-savedAt": new Date().toISOString(),
  });
  await env.PLANNER_DATA.put("bundle:" + NS, JSON.stringify(next));
  return state;
}

function jobOf(state, code) {
  return (state.jobs || []).find((j) => j.jobCode === code) || null;
}

function findByToken(state, token) {
  if (!token) return null;
  for (const j of state.jobs || []) {
    const r = j.esign && j.esign.request;
    if (r && (r.signers || []).some((s) => s.token === token)) return { job: j, req: r, co: null };
    for (const co of j.changeOrders || []) {
      const q = co.esign && co.esign.request;
      if (q && (q.signers || []).some((s) => s.token === token)) return { job: j, req: q, co };
    }
  }
  return null;
}

function findByRequestId(state, id) {
  if (!id) return null;
  for (const j of state.jobs || []) {
    const r = j.esign && j.esign.request;
    if (r && r.id === id) return { job: j, req: r, co: null };
    for (const co of j.changeOrders || []) {
      const q = co.esign && co.esign.request;
      if (q && q.id === id) return { job: j, req: q, co };
    }
  }
  return null;
}

function writeReq(job, co, req, today) {
  const es = Object.assign(FMSign.jobState(req, today), { request: req });
  if (co) {
    job.changeOrders = (job.changeOrders || []).map((y) => {
      if (y.id === co.id) y.esign = { provider: "fm", request: req };
      return y;
    });
  } else {
    job.esign = es;
  }
}

function applyContracted(job, today, how, who) {
  job.stage = "contract_signed";
  job.contractedOn = today;
  job.history = (job.history || []).concat([{ from: "quote", to: "contract_signed", date: today, reason: how, by: who }]);
  if (job.invoices && job.invoices[0] && !job.invoices[0].changeOrderId) job.invoices[0].dueDate = today;
  const E = job.elevations;
  if (E && E.rooms && E.rooms.length) {
    E.versions = E.versions || [];
    E.versions.push({
      n: E.versions.length + 1,
      label: job.elevAck ? "As signed · preliminary" : "As signed",
      signed: true,
      at: new Date().toISOString(),
      by: who,
      rooms: JSON.parse(JSON.stringify(E.rooms)),
      sizes: JSON.parse(JSON.stringify(E.sizes || {})),
    });
  }
}

function applyCoSigned(job, co, today) {
  if (!co || co.status !== "sent") return;
  co.status = "signed";
  co.signedOn = today;
  job.taxCents = (job.taxCents || 0) + (co.taxCents || 0);
  if (job.costCents != null) job.costCents += co.costCents || 0;
  if (co.amountCents) {
    job.invoices = (job.invoices || []).concat([{
      id: job.jobCode + "-inv" + ((job.invoices || []).length + 1),
      label: (co.amountCents < 0 ? "Credit" : "Change order " + co.number + " invoice"),
      role: "change_order",
      changeOrderId: co.id,
      dueDate: today,
      amountCents: co.amountCents,
      status: "open",
      payments: [],
    }]);
  }
  if (co.newDeliveryDate) job.deliveryDate = co.newDeliveryDate;
}

function publicSigner(s) {
  if (!s) return null;
  return { role: s.role, name: s.name, email: s.email, status: s.status, order: s.order };
}

function publicReq(req) {
  if (!req) return null;
  return {
    id: req.id,
    kind: req.kind,
    title: req.title,
    jobCode: req.jobCode,
    coNumber: req.coNumber,
    sha256: req.sha256,
    pages: req.pages,
    status: req.status,
    expiresOn: req.expiresOn,
    acknowledgementOnly: req.acknowledgementOnly,
    signers: (req.signers || []).map(publicSigner),
  };
}

async function handleSend(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.jobCode) return json({ ok: false, error: "Missing job." }, 400);
  const html = String(body.html || "");
  if (!html.trim()) return json({ ok: false, error: "The document is empty." }, 400);
  if (html.length > MAX_HTML) return json({ ok: false, error: "The document is too large to freeze." }, 400);
  const { data, state } = await loadState(env);
  const job = jobOf(state, body.jobCode);
  if (!job) return json({ ok: false, error: "No job " + body.jobCode + "." }, 404);
  const kind = body.kind === "change_order" ? "change_order" : "contract";
  let co = null;
  if (kind === "change_order") {
    co = (job.changeOrders || []).find((x) => Number(x.number) === Number(body.coNumber) || x.id === body.coId) || null;
    if (!co) return json({ ok: false, error: "No change order on that job." }, 404);
  }
  const wrapped = freezeWrap(html);
  const bytes = new TextEncoder().encode(wrapped);
  const sha256 = await sha256Hex(bytes);
  const today = denverToday();
  const at = new Date().toISOString();
  const tokens = [randomToken(), randomToken()];
  const pages = (html.match(/class="fm-p1-doc/g) || []).length;
  const made = FMSign.create(
    {
      kind,
      coNumber: co ? co.number : null,
      sha256,
      title: co ? "Change order " + co.number + " · " + job.jobCode : "Contract packet · " + job.jobCode,
      pages,
    },
    {
      jobCode: job.jobCode,
      buyer: body.buyer || {},
      fremont: body.fremont || job.fmSigner || null,
      tokens,
      today,
      at,
      by: String(body.by || "").trim(),
    }
  );
  if (!made.ok) return json({ ok: false, problems: made.problems, error: made.problems.join(" ") }, 400);
  const fileId = "sign-" + made.request.id;
  await putBytes(env, fileId, bytes, "text/html; charset=utf-8", fileId + ".html", job.jobCode, sha256);
  writeReq(job, co, made.request, today);
  const log =
    (co ? "Change order " + co.number : "Contract") +
    " sent for signature in the tool by " +
    made.request.sentBy +
    ". Fingerprint " +
    sha256.slice(0, 16) +
    "…";
  await saveState(env, data, state, log, job.jobCode, made.request.sentBy);
  const next = FMSign.nextSigner(made.request);
  return json({
    ok: true,
    request: made.request,
    job: job,
    link: next ? FMSign.link(SIGN_BASE, next.token) : null,
    log,
  });
}

async function handleGetToken(request, env, token, wantDoc) {
  if (rateLimit("get:" + clientIp(request) + ":" + tokenTail(token))) {
    return json({ ok: false, error: "Too many tries. Wait a minute." }, 429);
  }
  const { data, state } = await loadState(env);
  const hit = findByToken(state, token);
  if (!hit) return json({ ok: false, error: "This signing link isn't valid. Ask Fremont Makers for a new one." }, 404);
  const today = denverToday();
  const at = new Date().toISOString();
  const opened = FMSign.open(hit.req, token, { at, today, ip: clientIp(request), userAgent: request.headers.get("User-Agent") || "" });
  writeReq(hit.job, hit.co, opened.request, today);
  await saveState(env, data, state, null, hit.job.jobCode, "system");
  const ck = opened.check;
  const out = {
    ok: ck.ok,
    stage: ck.stage,
    error: ck.error,
    signer: publicSigner(ck.signer),
    request: publicReq(opened.request),
    consent: FMSign.CONSENT,
    consentLabel: FMSign.CONSENT_LABEL,
    agreeLabel: FMSign.AGREE_LABEL,
    sha256: opened.request.sha256,
  };
  if (wantDoc) {
    const file = await getBytes(env, "sign-" + opened.request.id);
    if (file) {
      out.html = new TextDecoder().decode(file.buf);
      out.type = file.type;
    }
    const signedId = hit.job.jobCode + "-signed-" + opened.request.id.slice(-8);
    const signed = await getBytes(env, signedId);
    if (signed) {
      out.signedHtml = new TextDecoder().decode(signed.buf);
      out.completed = opened.request.status === "completed";
    }
  }
  return json(out);
}

async function handlePostToken(request, env, token) {
  if (rateLimit("post:" + clientIp(request) + ":" + tokenTail(token))) {
    return json({ ok: false, error: "Too many tries. Wait a minute." }, 429);
  }
  const body = await request.json().catch(() => null) || {};
  const { data, state } = await loadState(env);
  const hit = findByToken(state, token);
  if (!hit) return json({ ok: false, error: "This signing link isn't valid." }, 404);
  const today = denverToday();
  const ctx = {
    at: new Date().toISOString(),
    today,
    ip: clientIp(request),
    userAgent: request.headers.get("User-Agent") || "",
    sha256: hit.req.sha256,
  };
  const action = body.action === "decline" ? "decline" : "sign";
  let result;
  if (action === "decline") {
    result = FMSign.decline(hit.req, token, body.reason, ctx);
    if (!result.ok) return json({ ok: false, error: result.error, problems: [result.error] }, 400);
  } else {
    result = FMSign.sign(hit.req, token, {
      consent: !!body.consent,
      agree: !!body.agree,
      typedName: body.typedName,
      drawn: body.drawn || null,
    }, ctx);
    if (!result.ok) return json({ ok: false, problems: result.problems, error: result.problems.join(" ") }, 400);
  }
  writeReq(hit.job, hit.co, result.request, today);
  if (result.completed) {
    const frozen = await getBytes(env, "sign-" + result.request.id);
    const inner = frozen ? new TextDecoder().decode(frozen.buf) : "";
    const cert = FMSign.renderCertificate(result.request, {});
    const full = inner.replace("</body>", cert + "</body>");
    const fullBytes = new TextEncoder().encode(full);
    const h = await sha256Hex(fullBytes);
    const id = hit.job.jobCode + "-signed-" + result.request.id.slice(-8);
    const name = hit.co
      ? hit.job.jobCode + " change order " + hit.co.number + " signed.html"
      : hit.job.jobCode + " signed contract.html";
    await putBytes(env, id, fullBytes, "text/html; charset=utf-8", name, hit.job.jobCode, h);
    const d = {
      id,
      jobCode: hit.job.jobCode,
      kind: hit.co ? "change_order" : "contract",
      changeOrder: hit.co ? hit.co.number : null,
      title: hit.co ? "Change order " + hit.co.number + ", signed, with certificate" : "Signed contract with certificate",
      file: name,
      bytes: fullBytes.byteLength,
      type: "text/html",
      sha256: h,
      uploadedBy: "Signed in the tool",
      uploadedOn: today,
      signRequest: result.request.id,
      contains: "Signed by " + result.request.signers.map((s) => s.name).join(" and ") + "; certificate of completion",
    };
    hit.job.documents = (hit.job.documents || []).filter((y) => y.id !== id).concat([d]);
    const how = "signed in the tool by " + result.request.signers.map((s) => s.name).join(" and ");
    if (hit.co) applyCoSigned(hit.job, (hit.job.changeOrders || []).find((x) => x.id === hit.co.id), today);
    else applyContracted(hit.job, today, how, "system");
  }
  await saveState(env, data, state, result.log, hit.job.jobCode, "system");
  return json({
    ok: true,
    request: result.request,
    completed: !!result.completed,
    job: hit.job,
    log: result.log,
    next: result.next || null,
  });
}

async function handleCancel(request, env, id) {
  const body = await request.json().catch(() => null) || {};
  const { data, state } = await loadState(env);
  const hit = findByRequestId(state, id);
  if (!hit) return json({ ok: false, error: "No request " + id + "." }, 404);
  const result = FMSign.cancel(hit.req, String(body.by || "").trim(), body.reason, new Date().toISOString());
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  writeReq(hit.job, hit.co, result.request, denverToday());
  await saveState(env, data, state, result.log, hit.job.jobCode, body.by);
  return json({ ok: true, request: result.request, job: hit.job, log: result.log });
}

async function handleRemind(request, env, id) {
  const body = await request.json().catch(() => null) || {};
  const { data, state } = await loadState(env);
  const hit = findByRequestId(state, id);
  if (!hit) return json({ ok: false, error: "No request " + id + "." }, 404);
  const today = denverToday();
  const result = FMSign.remind(hit.req, { today, at: new Date().toISOString(), by: String(body.by || "").trim() });
  if (!result.ok) return json({ ok: false, error: result.error }, 400);
  writeReq(hit.job, hit.co, result.request, today);
  await saveState(env, data, state, result.log, hit.job.jobCode, body.by);
  const next = FMSign.nextSigner(result.request);
  const url = next ? FMSign.link(SIGN_BASE, next.token) : null;
  return json({
    ok: true,
    request: result.request,
    job: hit.job,
    log: result.log,
    email: next && url ? FMSign.email(result.request, next, url, "reminder", (body.by || "Fremont Makers") + ", Fremont Makers") : null,
  });
}

async function handleOutside(request, env) {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, error: "Expected form data." }, 400);
  const jobCode = String(form.get("jobCode") || "");
  const by = String(form.get("by") || "").trim();
  const action = String(form.get("action") || "record");
  const { data, state } = await loadState(env);
  const job = jobOf(state, jobCode);
  if (!job) return json({ ok: false, error: "No job " + jobCode + "." }, 404);
  const today = denverToday();
  if (action === "sent") {
    const m = FMSign.markSentOutside(job.esign, {
      method: String(form.get("method") || ""),
      sentOn: String(form.get("sentOn") || today),
      by,
    });
    if (!m.ok) return json({ ok: false, problems: m.problems, error: m.problems.join(" ") }, 400);
    job.esign = m.state;
    await saveState(env, data, state, m.log, job.jobCode, by);
    return json({ ok: true, job, log: m.log });
  }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return json({ ok: false, error: "Upload the signed copy." }, 400);
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const rr = FMSign.recordOutside(job.esign || { state: "none" }, {
    method: String(form.get("method") || ""),
    signedOn: String(form.get("signedOn") || ""),
    file: { name: file.name, bytes: buf.byteLength, sha256 },
    buyerSignedAll: form.get("buyer") === "1" || form.get("buyer") === "true",
    fmSigned: form.get("fm") === "1" || form.get("fm") === "true",
    fmSignerName: job.fmSigner ? job.fmSigner.name : "",
    by,
    needsCountersign: form.get("needsCountersign") !== "0",
  }, { today });
  if (!rr.ok) return json({ ok: false, problems: rr.problems, error: rr.problems.join(" ") }, 400);
  const id = job.jobCode + "-doc-out-" + Date.now();
  await putBytes(env, id, buf, file.type || "application/pdf", file.name, job.jobCode, sha256);
  const doc = Object.assign({ id, jobCode: job.jobCode }, rr.document);
  job.esign = rr.state;
  job.documents = (job.documents || []).concat([doc]);
  applyContracted(job, today, rr.log, by);
  await saveState(env, data, state, rr.log, job.jobCode, by);
  return json({ ok: true, job, log: rr.log, document: doc });
}

export async function handleFmProjectBuilderSign(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (!path.startsWith("/api/projectbuilder/sign")) return null;

  try {
    if (path === "/api/projectbuilder/sign/send" && request.method === "POST") {
      return await handleSend(request, env);
    }
    if (path === "/api/projectbuilder/sign/outside" && request.method === "POST") {
      return await handleOutside(request, env);
    }
    const cancel = path.match(/^\/api\/projectbuilder\/sign\/([^/]+)\/cancel$/);
    if (cancel && request.method === "POST") return await handleCancel(request, env, decodeURIComponent(cancel[1]));
    const remind = path.match(/^\/api\/projectbuilder\/sign\/([^/]+)\/remind$/);
    if (remind && request.method === "POST") return await handleRemind(request, env, decodeURIComponent(remind[1]));
    const doc = path.match(/^\/api\/projectbuilder\/sign\/([^/]+)\/document$/);
    if (doc && request.method === "GET") return await handleGetToken(request, env, decodeURIComponent(doc[1]), true);
    const tok = path.match(/^\/api\/projectbuilder\/sign\/([^/]+)$/);
    if (tok && request.method === "GET") return await handleGetToken(request, env, decodeURIComponent(tok[1]), false);
    if (tok && request.method === "POST") return await handlePostToken(request, env, decodeURIComponent(tok[1]));
    return json({ ok: false, error: "Not found" }, 404);
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
}
