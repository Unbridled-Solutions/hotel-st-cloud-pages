/**
 * Cloudflare Pages Function: /api/pnp-records
 * Returns all PNP registrations from Airtable for the admin dashboard.
 * AIRTABLE_API_KEY is a Cloudflare Pages secret.
 */

const BASE_ID = "appUUjLXEUwlyx23M";
const TABLE   = "PNP%20Registrations";

export async function onRequestGet(context) {
  const { env } = context;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    let records = [];
    let offset = "";

    do {
      const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?pageSize=100&sort%5B0%5D%5Bfield%5D=Registered+At&sort%5B0%5D%5Bdirection%5D=desc${offset ? `&offset=${offset}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Airtable error");
      records = records.concat(data.records || []);
      offset = data.offset || "";
    } while (offset);

    return new Response(JSON.stringify({ records }), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ records: [], error: err.message }),
      { status: 500, headers }
    );
  }
}
