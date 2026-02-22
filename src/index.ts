import { serve } from "bun";
import { handleConvertRoute } from './routes/convert';
import { handleAuthCallback } from "./routes/auth";
import { handleStripeWebHook } from "./routes/webhook";
import { initDB } from "./db/database";
import { handleCreateCheckout } from "./routes/payment";

initDB();

const PORT = process.env.PORT;

const corsHeaders = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
};

const server = serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url);

        const clientIp = server.requestIP(req)?.address || '127.0.0.1';

        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        let response: Response;

        // Routes
        if (url.pathname === "/api/auth/callback")
            response = await handleAuthCallback(req);
        else if (url.pathname === "/api/convert")
            response = await handleConvertRoute(req, clientIp);
        else if (url.pathname === "/api/checkout")
            response = await handleCreateCheckout(req, clientIp);
        else if (url.pathname === "/api/webhook/stripe")
            response = await handleStripeWebHook(req);
        else if (url.pathname === "/")
            return new Response("Talechto Audio Converter API Online");
        else
            response = new Response("Not Found :(", { status: 404 });

        for (const [key, value] of Object.entries(corsHeaders)) {
            response.headers.set(key, value);
        }

        return response;
    },
});

console.log(`Talechto Server Running on http://localhost:${PORT}`);