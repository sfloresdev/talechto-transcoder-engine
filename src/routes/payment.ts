import Stripe from 'stripe';
import { identifyRequester } from '../middleware/identify';
import { db } from '../db/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover'
});

export async function handleCreateCheckout(req: Request, ip: string): Promise<Response> {

    if (req.method !== 'POST')
        return new Response("Method not allowed", { status: 405 })

    try {
        const userId = await identifyRequester(req, ip);

        if (!userId) {
            return new Response(JSON.stringify({
                error: "You need to login with Google before buying Premium"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            })
        }

        const user = db.query(`SELECT email, is_premium FROM users WHERE id = $id`)
            .get({ $id: userId }) as { email: string, is_premium: number } | null;

        if (user?.is_premium === 1) {
            return new Response(JSON.stringify({ error: "User already has an active subscription" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: 'Talechto Premium Pass',
                            description: 'Unlimited conversions and no file size limit',
                        },
                        unit_amount: 250,
                        recurring: {
                            interval: 'month',
                        }
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cancel`,
            client_reference_id: userId,
            metadata: {
                userId: userId
            },
        };

        if (user?.email)
            sessionConfig.customer_email = user.email;

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        })
    } catch (error: any) {
        console.error("[Stripe Error]", error.message)
        return new Response(JSON.stringify({ error: "Couldn't create subscription session" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        })
    }
}
