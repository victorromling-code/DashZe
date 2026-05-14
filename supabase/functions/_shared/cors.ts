const ALLOW_HEADERS_FALLBACK = "authorization, x-client-info, apikey, content-type";

// Reflete os cabeçalhos que o navegador pediu no preflight, garantindo que
// qualquer header enviado pela biblioteca supabase-js seja aceito.
export function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ?? ALLOW_HEADERS_FALLBACK,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export function jsonResponse(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
