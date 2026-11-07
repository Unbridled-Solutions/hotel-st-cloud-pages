/**
 * Project Builder 2.11 file storage (HANDOFF §32).
 * R2 bucket fm-project-builder-files. Never writes ns=fm-quotes.
 *
 * POST /api/projectbuilder/files  multipart: file + id? + jobCode?
 * GET  /api/projectbuilder/files/:id
 *
 * Remove in the app hides the job.documents row. The object stays in R2.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
  gif: "image/gif",
  dwg: "application/acad",
  dxf: "image/vnd.dxf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  eml: "message/rfc822",
  html: "text/html",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function extOf(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

function safeId(raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 180) return "";
  if (s.includes("..") || s.includes("/") || s.includes("\\")) return "";
  return s;
}

function r2Key(id) {
  return "files/" + id;
}

async function sha256Hex(buf) {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bucket(env) {
  return env.FM_PROJECT_BUILDER_FILES || env.fm_project_builder_files || null;
}

export async function handleFmProjectBuilderFiles(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const store = bucket(env);
  if (!store) return json({ success: false, error: "File storage is not configured." }, 500);

  if (path === "/api/projectbuilder/files" && request.method === "POST") {
    let form;
    try {
      form = await request.formData();
    } catch (err) {
      return json({ success: false, error: "Expected multipart form data." }, 400);
    }
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ success: false, error: "Choose a file." }, 400);
    }
    const name = String(file.name || form.get("name") || "file");
    let e = extOf(name);
    if (!e && (file.type === "text/html" || String(form.get("type") || "") === "text/html")) e = "html";
    if (!TYPES[e] && file.type) {
      const byMime = Object.keys(TYPES).find((k) => TYPES[k] === file.type);
      if (byMime) e = byMime;
    }
    if (!TYPES[e]) {
      return json({ success: false, error: name + " isn't a type the tool keeps." }, 400);
    }
    let buf;
    try {
      buf = await file.arrayBuffer();
    } catch (err) {
      return json({ success: false, error: "Could not read the file." }, 400);
    }
    if (!buf || !buf.byteLength) return json({ success: false, error: "That file is empty." }, 400);
    if (buf.byteLength > MAX_BYTES) {
      return json({ success: false, error: name + " is over 25 MB." }, 400);
    }
    const id = safeId(form.get("id") || name) || ("doc-" + Date.now());
    const sha256 = await sha256Hex(buf);
    const type = file.type || TYPES[e] || "application/octet-stream";
    const jobCode = String(form.get("jobCode") || "").slice(0, 40);
    await store.put(r2Key(id), buf, {
      httpMetadata: { contentType: type },
      customMetadata: {
        jobCode,
        sha256,
        name: name.slice(0, 180),
      },
    });
    return json({
      success: true,
      id,
      sha256,
      bytes: buf.byteLength,
      type,
      file: name,
    });
  }

  const getPrefix = "/api/projectbuilder/files/";
  if (path.startsWith(getPrefix) && request.method === "GET") {
    const id = safeId(decodeURIComponent(path.slice(getPrefix.length)));
    if (!id) return new Response("Not found", { status: 404 });
    const obj = await store.get(r2Key(id));
    if (!obj) return new Response("Not found", { status: 404 });
    const type = obj.httpMetadata?.contentType || "application/octet-stream";
    const name = (obj.customMetadata && obj.customMetadata.name) || id;
    return new Response(obj.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": 'inline; filename="' + name.replace(/["\\]/g, "") + '"',
      },
    });
  }

  if (path === "/api/projectbuilder/files" && request.method === "GET") {
    const id = safeId(url.searchParams.get("id") || "");
    if (!id) return json({ success: false, error: "Missing id." }, 400);
    const dest = new URL("/api/projectbuilder/files/" + encodeURIComponent(id), url.origin);
    return Response.redirect(dest.toString(), 302);
  }

  return json({ success: false, error: "Not found" }, 404);
}
