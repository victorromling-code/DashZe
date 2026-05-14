import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CLICKUP_TOKEN = Deno.env.get("CLICKUP_TOKEN") ?? "";

const GOALS = [
  { name: "Comercial",        id: "c232edce-acc1-49b2-9932-dc6c3366c556", color: "#6BC950" },
  { name: "Correlaize",       id: "806981d4-1cf1-4d4d-800e-588aaade3459", color: "#FF7043" },
  { name: "Customer Success", id: "09da4b15-a37b-48ce-8ad3-02542260e4ce", color: "#42A5F5" },
  { name: "RH",               id: "493798b6-da94-40a2-add7-83d0b85659a1", color: "#AB47BC" },
  { name: "Financeiro",       id: "44ece088-2719-4ec1-8f14-0d08f5b6e2c5", color: "#EF5350" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const results = await Promise.all(
      GOALS.map(async ({ name, id, color }) => {
        const r = await fetch(`https://api.clickup.com/api/v2/goal/${id}`, {
          headers: { Authorization: CLICKUP_TOKEN },
        });
        const data = await r.json();
        const goal = data.goal || {};
        const krs = (goal.key_results || []).map((kr: any) => {
          const current = kr.steps_current || 0;
          const target = kr.steps_end || 0;
          const percent = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
          return { id: kr.id, name: kr.name, type: kr.type, current, target, percent, unit: kr.unit || "" };
        });
        const goalPct = krs.length > 0
          ? krs.reduce((s: number, k: any) => s + k.percent, 0) / krs.length
          : 0;
        return { name, color, percent: goalPct, keyResults: krs, goalId: id, goalUrl: goal.pretty_url };
      })
    );
    return jsonResponse(results, 200);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
