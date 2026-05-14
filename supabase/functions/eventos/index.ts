import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const r = await fetch(
      "https://api.clickup.com/api/v2/list/901327105128/task?include_closed=false",
      { headers: { Authorization: CLICKUP_TOKEN } }
    );
    const data = await r.json();

    const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const tasks = (data.tasks || [])
      .map((t: any) => {
        const tipoField = t.custom_fields?.find(
          (f: any) => f.id === "76a9a1c4-f6a0-457d-813c-5afc1c1c3ddb"
        );
        const statusField = t.custom_fields?.find(
          (f: any) => f.id === "53f0006f-1529-4894-9eda-878ab0f45a6f"
        );

        const tipo =
          tipoField?.value !== undefined && tipoField?.value !== null
            ? tipoField.type_config?.options?.find(
                (o: any) => o.orderindex === tipoField.value
              )?.name || ""
            : "";

        const status =
          statusField?.value !== undefined && statusField?.value !== null
            ? statusField.type_config?.options?.find(
                (o: any) => o.orderindex === statusField.value
              )?.name || ""
            : "";

        let day: number | null = null;
        let monthAbrev: string | null = null;
        let dateTs: number | null = null;
        const match = t.name.match(/(\d{1,2})\/(\d{2})\s*$/);
        if (match) {
          const dd = parseInt(match[1]);
          const mm = parseInt(match[2]) - 1;
          const now = new Date();
          let d = new Date(now.getFullYear(), mm, dd);
          if (d < now) d = new Date(now.getFullYear() + 1, mm, dd);
          dateTs = d.getTime();
          day = dd;
          monthAbrev = MESES_ABREV[mm];
        }

        return { id: t.id, name: t.name, status, tipo, day, monthAbrev, dateTs };
      })
      .filter((t: any) => t.dateTs && t.status.toLowerCase() !== "finalizado")
      .sort((a: any, b: any) => a.dateTs - b.dateTs);

    return jsonResponse(tasks, 200, req);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, req);
  }
});
