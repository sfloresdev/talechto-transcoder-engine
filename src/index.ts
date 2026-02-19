import { serve } from "bun";
import { handleConvertRoute } from './routes/convert';

const PORT = process.env.PORT || 3000;

const server = serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (url.pathname === "/api/convert") {
            const response = await handleConvertRoute(req);

            for (const [key, value] of Object.entries(corsHeaders)) {
                response.headers.set(key, value);
            }
            return response;
        }

        // Status route (Healthcheck)
        if (url.pathname === "/") {
            return new Response("Talechto Audio Converter API Online", {
                headers: corsHeaders
            })
        }
        return new Response("Not Found", { status: 404, headers: corsHeaders });
    },
});

console.log(`Talechto Server Running on http://localhost:${PORT}`);