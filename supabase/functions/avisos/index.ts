import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const r = await fetch(
      "https://api.clickup.com/api/v2/list/901327085034/task?include_closed=false",
      { headers: { Authorization: CLICKUP_TOKEN } }
    );
    const data = await r.json();

    const tasks = (data.tasks || []).map((t: any) => {
      const setorField = t.custom_fields?.find((f: any) => f.name === "Setor");
      const dataField = t.custom_fields?.find((f: any) => f.name === "Data");

      let setor = "";
      if (setorField && setorField.value !== undefined && setorField.value !== null) {
        const opt = setorField.type_config?.options?.find(
          (o: any) => o.orderindex === setorField.value
        );
        setor = opt?.name || "";
      }

      let date = "";
      if (dataField?.value) {
        const d = new Date(parseInt(dataField.value));
        const m = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        date = `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
      }

      return {
        id: t.id,
        title: t.name,
        description: t.description || "",
        status: t.status?.status || "",
        setor,
        date,
      };
    });

    return jsonResponse(tasks, 200, req);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500, req);
  }
});
