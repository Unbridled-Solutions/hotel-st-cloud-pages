/**
 * Cloudflare Pages Function: /api/socc-apply
 * Accepts barista applications for Standard Oil Coffee Co.
 * Writes to Airtable "SOCC Barista Applications" table.
 * AIRTABLE_API_KEY is a Cloudflare Pages secret.
 */

const BASE_ID = "appUUjLXEUwlyx23M";
const TABLE   = "SOCC%20Barista%20Applications";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();

    const fields = {
      "Name":         body.name         || "",
      "Email":        body.email        || "",
      "Phone":        body.phone        || "",
      "Experience":   body.experience   || "",
      "Availability": body.availability || "",
      "Applied At":   new Date().toISOString(),
      "Source":       "Google Ads — Barista Hiring Campaign",
    };

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || "Airtable error" }),
        { status: 500, headers: HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: HEADERS }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: HEADERS }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
