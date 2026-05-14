import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const r = await fetch(
      "https://api.clickup.com/api/v2/list/901327085209/task?include_closed=true",
      { headers: { Authorization: CLICKUP_TOKEN } }
    );
    const data = await r.json();

    const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

    const tasks = (data.tasks || []).map((t: any) => {
      const dataField = t.custom_fields?.find((f: any) => f.name === "Data");
      const cargoField = t.custom_fields?.find(
        (f: any) => f.id === "dfb5a262-d8ce-4f6b-b8b2-1fb9d82ae5d3"
      );

      let day: number | null = null;
      let month: number | null = null;
      let dateStr = "";
      if (dataField?.value) {
        const d = new Date(parseInt(dataField.value));
        day = d.getDate();
        month = d.getMonth();
        dateStr = `${day} de ${MONTHS[month]}`;
      }

      let cargo = "";
      if (cargoField && cargoField.value !== undefined && cargoField.value !== null) {
        const opt = cargoField.type_config?.options?.find(
          (o: any) => o.orderindex === cargoField.value
        );
        cargo = opt?.name || "";
      }

      return { name: t.name, dateStr, day, month, cargo };
    });

    return jsonResponse(tasks, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
