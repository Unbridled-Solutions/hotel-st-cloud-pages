/**
 * Cloudflare Pages Function: /api/pnp-register
 * Accepts POST from the PNP registration form and writes to Airtable.
 * AIRTABLE_API_KEY is stored as a Cloudflare Pages secret — never in the HTML.
 */

const BASE_ID = "appUUjLXEUwlyx23M";
const TABLE   = "PNP%20Registrations";

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const body = await request.json();

    const fields = {
      "Full Name":           body.fullName     || "",
      "Email":               body.email        || "",
      "Phone":               body.phone        || "",
      "Address":             body.address      || "",
      "Attendee Type":       body.attendeeType || "",
      "Dietary Restrictions": body.dietary     || "",
      "Hotel Room Needed":   body.hotelRoom === "yes" ? true : false,
      "T-Shirt Size":        body.tshirtSize   || "",
      "Registered At":       new Date().toISOString(),
    };

    const airtableRes = await fetch(
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

    const data = await airtableRes.json();

    if (!airtableRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: data.error || "Airtable error" }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers }
    );
  }
}

// Handle preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
