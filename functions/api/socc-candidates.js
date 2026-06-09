/**
 * Cloudflare Pages Function: /api/socc-candidates
 * Returns all barista applications for the hiring dashboard.
 * AIRTABLE_API_KEY is a Cloudflare Worker secret.
 */

const BASE_ID = "appUUjLXEUwlyx23M";
const TABLE   = "SOCC%20Barista%20Applications";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export async function onRequestGet(context) {
  const { env } = context;

  try {
    let records = [];
    let offset  = "";

    do {
      const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?pageSize=100&sort%5B0%5D%5Bfield%5D=Applied+At&sort%5B0%5D%5Bdirection%5D=desc${offset ? `&offset=${offset}` : ""}`;
      const res  = await fetch(url, {
        headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Airtable error");
      records = records.concat(data.records || []);
      offset  = data.offset || "";
    } while (offset);

    return new Response(JSON.stringify({ records }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ records: [], error: err.message }), { status: 500, headers: HEADERS });
  }
}
