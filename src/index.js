/**
 * Hotel St. Cloud — Cloudflare Worker Entry Point
 * Handles API routes; all other requests fall through to static assets.
 */

const AIRTABLE_BASE = "appUUjLXEUwlyx23M";
const SOCC_TABLE    = "SOCC%20Barista%20Applications";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
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

    // ── All other requests → static assets ──────────────────────────────────
    const response = await env.ASSETS.fetch(request);

    // Force browsers to always revalidate HTML — no stale cache ever
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return response;
  },
};
