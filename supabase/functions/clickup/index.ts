import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { endpoint } = await req.json().catch(() => ({}));
    if (!endpoint) return jsonResponse({ error: "endpoint required" }, 400, req);

    const url = `https://api.clickup.com/api/v2/${endpoint}`;
    const r = await fetch(url, {
      headers: {
        Authorization: CLICKUP_TOKEN,
        "Content-Type": "application/json",
      },
    });
    const data = await r.json();
    return jsonResponse(data, 200, req);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, req);
  }
});
