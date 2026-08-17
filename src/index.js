/**
 * Hotel St. Cloud — Cloudflare Worker Entry Point
 * Handles API routes; all other requests fall through to static assets.
 */

const AIRTABLE_BASE = "appUUjLXEUwlyx23M";
const SOCC_TABLE    = "SOCC%20Barista%20Applications";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

function optionsResponse() {
  return new Response(null, { headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }});
}

// Extract readable text from base64-encoded file (PDF/Word)
function extractText(base64) {
  try {
    const binary = atob(base64);
    // Pull out printable ASCII runs of 4+ chars — good enough for resume text
    const matches = binary.match(/[\x20-\x7E]{4,}/g) || [];
    return matches.join(" ").slice(0, 6000); // cap at 6k chars for API
  } catch {
    return "";
  }
}

// Summarise resume text via OpenRouter
async function summariseResume(text, name, env) {
  if (!text || text.length < 50) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://offers.hotelstcloud.com",
        "X-Title": "Standard Oil Coffee Co — Hiring",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are reviewing a barista job application for Standard Oil Coffee Co., a specialty coffee shop. Based on the resume text below, write a concise 2-3 sentence summary of this candidate's relevant experience, coffee skills, and suitability. Be direct and specific. Candidate name: ${name}.\n\nResume text:\n${text}`,
        }],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return optionsResponse();

    // ── DELETE /api/socc-candidates ──────────────────────────────────────────
    if (url.pathname === "/api/socc-candidates" && request.method === "DELETE") {
      try {
        const { id } = await request.json();
        if (!id) return new Response(JSON.stringify({ success: false, error: "No record ID." }), { status: 400, headers: CORS });
        const atRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/SOCC%20Barista%20Applications/${id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` } }
        );
        const data = await atRes.json();
        if (!atRes.ok) throw new Error(data.error?.message || "Delete failed.");
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── GET /api/socc-candidates ─────────────────────────────────────────────
    if (url.pathname === "/api/socc-candidates" && request.method === "GET") {
      try {
        let records = [], offset = "";
        do {
          const atUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/SOCC%20Barista%20Applications?pageSize=100&sort%5B0%5D%5Bfield%5D=Applied%20At&sort%5B0%5D%5Bdirection%5D=desc${offset ? `&offset=${offset}` : ""}`;
          const atRes = await fetch(atUrl, { headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` } });
          const data  = await atRes.json();
          if (!atRes.ok) throw new Error(data.error?.message || "Airtable error");
          records = records.concat(data.records || []);
          offset  = data.offset || "";
        } while (offset);
        return new Response(JSON.stringify({ records }), { status: 200, headers: CORS });
      } catch (err) {
        return new Response(JSON.stringify({ records: [], error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── POST /api/socc-apply ─────────────────────────────────────────────────
    if (url.pathname === "/api/socc-apply" && request.method === "POST") {
      try {
        const body = await request.json();
        if (!body.name || !body.email) {
          return new Response(JSON.stringify({ success: false, error: "Name and email are required." }), { status: 400, headers: CORS });
        }

        const fields = {
          "Name":            body.name         || "",
          "Email":           body.email        || "",
          "Phone":           body.phone        || "",
          "Experience":      body.experience   || "",
          "Availability":    body.availability || "",
          "Resume Filename": body.resume_filename || "",
          "Applied At":      new Date().toISOString(),
          "Source":          "Google Ads — Barista Hiring Campaign",
        };

        // AI resume summary (fire before saving so we can include it)
        if (body.resume_base64 && body.resume_filename) {
          const resumeText = extractText(body.resume_base64);
          const summary    = await summariseResume(resumeText, body.name, env);
          if (summary) fields["Resume Summary"] = summary;
        }

        const atRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SOCC_TABLE}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ fields, typecast: true }),
          }
        );
        const data = await atRes.json();
        if (!atRes.ok) return new Response(JSON.stringify({ success: false, error: data.error?.message || "Submission failed." }), { status: 500, headers: CORS });
        return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: CORS });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── GET /api/planner/bundle?ns=X ─────────────────────────────────────────
    // Returns the full KV bundle for a planner namespace (fp, fp-ph, hsc)
    if (url.pathname === '/api/planner/bundle' && request.method === 'GET') {
      const ns = url.searchParams.get('ns');
      if (!ns) return new Response(JSON.stringify({ error: 'Missing ns param' }), { status: 400, headers: CORS });
      try {
        const raw = await env.PLANNER_DATA.get(`bundle:${ns}`);
        const data = raw ? JSON.parse(raw) : {};
        return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: CORS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── POST /api/planner/bundle?ns=X ─────────────────────────────────────────
    // Saves the full KV bundle for a planner namespace
    if (url.pathname === '/api/planner/bundle' && request.method === 'POST') {
      const ns = url.searchParams.get('ns');
      if (!ns) return new Response(JSON.stringify({ error: 'Missing ns param' }), { status: 400, headers: CORS });
      try {
        const body = await request.json();
        await env.PLANNER_DATA.put(`bundle:${ns}`, JSON.stringify(body));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── POST /api/send-maintenance ───────────────────────────────────────────
    // Sends formatted maintenance request email via Resend.
    // Body: { data: {...}, sendCopy: bool, fileNames: ['a.jpg', ...] }
    if (url.pathname === '/api/send-maintenance' && request.method === 'POST') {
      try {
        const { data, sendCopy, fileNames } = await request.json();
        const d = data;

        const urgencyColor = d.urgency?.includes('Urgent') ? '#ff4d4d'
          : d.urgency?.includes('Soon') ? '#ffb347' : '#3de8c8';
        const urgencyLabel = d.urgency?.includes('Urgent') ? '🔴 Urgent — safety or major disruption'
          : d.urgency?.includes('Soon') ? '🟡 Soon — affecting operations'
          : '🟢 Flexible — when you get a chance';

        const row = (label, val) => `
          <tr>
            <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;width:180px;border-bottom:1px solid #2a2a2a;">${label}</td>
            <td style="padding:10px 16px;font-size:14px;color:#e8eaf0;border-bottom:1px solid #2a2a2a;">${val || '—'}</td>
          </tr>`;

        const divider = (label) => `
          <tr><td colspan="2" style="padding:14px 16px 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4a9eff;border-bottom:1px solid #2a2a2a;">${label}</td></tr>`;

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2e3250;">

    <div style="background:#12151f;padding:20px 24px;border-bottom:1px solid #2e3250;display:flex;align-items:center;gap:14px;">
      <div style="font-size:20px;font-weight:700;color:#e8eaf0;">Unbridled <span style="color:#4a9eff;">Properties</span></div>
      <div style="margin-left:auto;font-size:12px;color:#8b90a8;">Maintenance Request</div>
    </div>

    <div style="padding:18px 24px;background:#161920;border-bottom:1px solid #2e3250;">
      <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(${urgencyColor === '#ff4d4d' ? '255,77,77' : urgencyColor === '#ffb347' ? '255,179,71' : '61,232,200'},.15);color:${urgencyColor};border:1px solid ${urgencyColor}33;">${urgencyLabel}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      ${divider('Location')}
      ${row('Building', d.building)}
      ${row('Suite / Address', d.suite)}
      ${row('Specific Area', d.location_detail)}
      ${divider('Submitted By')}
      ${row('Name', d.name)}
      ${row('Business / Org', d.tenant_org)}
      ${row('Email', d.email ? `<a href="mailto:${d.email}" style="color:#4a9eff;">${d.email}</a>` : null)}
      ${row('Phone', d.phone)}
      ${divider('The Issue')}
      ${row('Category', d.category)}
      ${row('Best Access Time', d.best_time)}
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.05em;vertical-align:top;border-bottom:1px solid #2a2a2a;">Description</td>
        <td style="padding:10px 16px;font-size:14px;color:#e8eaf0;border-bottom:1px solid #2a2a2a;white-space:pre-wrap;line-height:1.6;">${d.description || '—'}</td>
      </tr>
      ${fileNames?.length ? row('Attachments', fileNames.join(', ') + ' <em style="color:#8b90a8;font-size:12px;">(see attached)</em>') : ''}
      ${divider('Submitted')}
      ${row('Time', new Date(d.submitted_at).toLocaleString('en-US', {timeZone:'America/Denver',dateStyle:'medium',timeStyle:'short'}) + ' MT')}
      ${row('Tracker', `<a href="https://offers.hotelstcloud.com/assets/maintenance-tracker" style="color:#4a9eff;">Open Tracker →</a>`)}
    </table>

    <div style="padding:16px 24px;background:#12151f;border-top:1px solid #2e3250;font-size:12px;color:#8b90a8;text-align:center;">
      Unbridled Properties · Cañon City, CO · <a href="https://offers.hotelstcloud.com/assets/maintenance-tracker" style="color:#4a9eff;">Maintenance Tracker</a>
    </div>
  </div>
</body></html>`;

        const to = ['hello@fremontmakers.com'];
        if (sendCopy && d.email) to.push(d.email);

        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Unbridled Properties <noreply@fremontmakers.com>',
            to,
            reply_to: d.email,
            subject: `[Maintenance] ${d.urgency?.split('—')[0].trim() || 'Request'} · ${d.building}${d.suite ? ' · ' + d.suite : ''} · ${d.name}`,
            html
          })
        });

        const resendData = await resendResp.json();
        if (!resendResp.ok) {
          return new Response(JSON.stringify({ success: false, error: resendData }), { status: 500, headers: CORS });
        }
        return new Response(JSON.stringify({ success: true, id: resendData.id }), { status: 200, headers: CORS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── DELETE /api/kv?ns=X&key=Y ────────────────────────────────────────────
    if (url.pathname === '/api/kv' && request.method === 'DELETE') {
      const ns = url.searchParams.get('ns') || 'default';
      const key = url.searchParams.get('key');
      if (!key) return new Response(JSON.stringify({ error: 'key required' }), { status: 400, headers: CORS });
      await env.PLANNER_DATA.delete(`${ns}:${key}`);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
    }

    // ── GET /api/kv?ns=X&key=Y ───────────────────────────────────────────────
    if (url.pathname === '/api/kv' && request.method === 'GET') {
      const ns = url.searchParams.get('ns') || 'default';
      const key = url.searchParams.get('key');
      if (!key) return new Response(JSON.stringify({ error: 'key required' }), { status: 400, headers: CORS });
      const val = await env.PLANNER_DATA.get(`${ns}:${key}`, { type: 'json' });
      return new Response(JSON.stringify(val), { status: 200, headers: CORS });
    }

    // ── PUT /api/kv?ns=X&key=Y ───────────────────────────────────────────────
    if (url.pathname === '/api/kv' && request.method === 'PUT') {
      const ns = url.searchParams.get('ns') || 'default';
      const key = url.searchParams.get('key');
      if (!key) return new Response(JSON.stringify({ error: 'key required' }), { status: 400, headers: CORS });
      const body = await request.json();
      await env.PLANNER_DATA.put(`${ns}:${key}`, JSON.stringify(body));
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
    }

    // ── GET /api/kv/list?ns=X&prefix=Y ──────────────────────────────────────
    if (url.pathname === '/api/kv/list' && request.method === 'GET') {
      const ns = url.searchParams.get('ns') || 'default';
      const prefix = url.searchParams.get('prefix') || '';
      const list = await env.PLANNER_DATA.list({ prefix: `${ns}:${prefix}` });
      // Strip the ns: prefix from keys before returning
      const keys = list.keys.map(k => k.name.slice(ns.length + 1));
      return new Response(JSON.stringify({ keys }), { status: 200, headers: CORS });
    }

    // ── GET /private-docs/*  — executed leases / policies (not in public git) ─
    if (url.pathname.startsWith("/private-docs/")) {
      const assetRequest = new Request(request, {
        headers: new Headers({ ...Object.fromEntries(request.headers), "Cache-Control": "no-cache" }),
      });
      const response = await env.ASSETS.fetch(assetRequest);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(response.body, { status: response.status, headers });
    }

    // ── All other requests → static assets ──────────────────────────────────
    // Bypass Cloudflare edge cache for HTML files — pass cf-cache-skip
    const assetRequest = new Request(request, {
      headers: new Headers({ ...Object.fromEntries(request.headers), 'Cache-Control': 'no-cache' }),
    });
    const response = await env.ASSETS.fetch(assetRequest);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      newHeaders.set('Surrogate-Control', 'no-store');
      newHeaders.delete('ETag');
      newHeaders.delete('Last-Modified');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return response;
  },
};
