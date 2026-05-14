import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

const LISTS = [
  { setor: "Comercial",        id: "901327055434" },
  { setor: "Correlaize",       id: "901327055476" },
  { setor: "Customer Success", id: "901327055478" },
  { setor: "RH",               id: "901327055481" },
  { setor: "Financeiro",       id: "901327055488" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const results: Record<string, unknown> = {};
    await Promise.all(
      LISTS.map(async ({ setor, id }) => {
        const r = await fetch(
          `https://api.clickup.com/api/v2/list/${id}/task?include_closed=true`,
          { headers: { Authorization: CLICKUP_TOKEN } }
        );
        const data = await r.json();
        results[setor] = (data.tasks || []).map((t: any) => ({
          name: t.name,
          closed: t.status?.type === "closed",
          status: t.status?.status || "",
        }));
      })
    );
    return jsonResponse(results, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
