/**
 * Cloudflare Worker para Upload Direto no Cloudflare Stream
 * Cole este código no seu dashboard do Cloudflare (Worker: nameless-dust-4193)
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 1. Responde a requisições OPTIONS (Preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 2. Rota para gerar a URL de upload (METADADOS APENAS)
    if (url.pathname === "/api/upload" && (request.method === "POST" || request.method === "GET")) {
      try {
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !apiToken) {
          throw new Error("Credenciais do Cloudflare não configuradas no Worker.");
        }

        // Solicita ao Cloudflare Stream uma URL de upload direto. 
        // O corpo desta requisição é pequeno, não deve causar 413.
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              maxDurationSeconds: 3600,
              expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
            }),
          }
        );

        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
