/**
 * Hotel St. Cloud — Cloudflare Worker Entry Point
 * Handles API routes; all other requests fall through to static assets.
 */

const AIRTABLE_BASE  = "appUUjLXEUwlyx23M";
const SOCC_TABLE     = "SOCC%20Barista%20Applications";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── GET /api/socc-candidates ─────────────────────────────────────────────
    if (url.pathname === "/api/socc-candidates") {
      try {
        let records = [];
        let offset  = "";
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
    if (url.pathname === "/api/socc-apply") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }});
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });
      }

      try {
        const body = await request.json();

        if (!body.name || !body.email) {
          return new Response(JSON.stringify({ success: false, error: "Name and email are required." }), { status: 400, headers: CORS });
        }

        const fields = {
          "Name":         body.name         || "",
          "Email":        body.email        || "",
          "Phone":        body.phone        || "",
          "Experience":   body.experience   || "",
          "Availability": body.availability || "",
          "Applied At":   new Date().toISOString(),
          "Source":       "Google Ads — Barista Hiring Campaign",
        };

        const atRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE}/${SOCC_TABLE}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ fields, typecast: true }),
          }
        );

        const data = await atRes.json();

        if (!atRes.ok) {
          return new Response(JSON.stringify({ success: false, error: data.error?.message || "Submission failed." }), { status: 500, headers: CORS });
        }

        return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200, headers: CORS });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS });
      }
    }

    // ── All other requests → static assets ──────────────────────────────────
    return env.ASSETS.fetch(request);
  },
};
