import Stripe from "stripe";
import { db } from "../db/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover'
});

const enpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function handleStripeWebHook(req: Request): Promise<Response> {
    if (req.method !== 'POST') return new Response("Method not allowed", { status: 405 });

    const sig = req.headers.get('stripe-signature');
    if (!sig) return new Response("Missing stripe-signature header", { status: 400 });

    let event: Stripe.Event;

    try {
        const body = await req.text();
        event = await stripe.webhooks.constructEventAsync(body, sig, enpointSecret);
    } catch (err: any) {
        console.error(`[Webhook Signature Error] ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // Retrieve the user ID we saved before
                const userId = session.metadata?.userId || session.client_reference_id;
                const stripeCustomerId = session.customer as string;

                if (userId && session.subscription) {

                    const premiumUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    const premiumUntil = premiumUntilDate.toISOString();

                    console.log(`[Stripe] Payment succes for user ${userId}. Upgrading to Premium...`)
                    db.query(`
                        UPDATE users
                        SET is_premium = 1, 
                            stripe_customer_id = $customerId,
                            premium_until = $premium_until    
                        WHERE id = $id
                    `).run({
                        $id: userId,
                        $customerId: stripeCustomerId,
                        $premium_until: premiumUntil
                    });
                }
                break;
            }

            // We hear the following months
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                // Ignorane the first bill
                if (invoice.billing_reason === 'subscription_cycle') {
                    const stripeCustomerId = invoice.customer as string;
                    const premiumUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    
                    console.log(`[Stripe] Renewal successful for customer ${stripeCustomerId}. Extending 30 days...`);
                    db.query(`
                        UPDATE users
                        SET is_premium = 1,
                            premium_until = $premium_until
                        WHERE stripe_customer_id = $customerId
                    `).run({
                        $customerId: stripeCustomerId,
                        $premium_until: premiumUntilDate.toISOString()
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const stripeCustomerId = invoice.customer as string;

                console.log(`[Stripe] Failed to pay invoice ${invoice.id} for customer ${stripeCustomerId}`);
                db.query(`
                    UPDATE users
                    SET is_premium = 0
                    WHERE stripe_customer_id = $customerId
                `).run({
                    $customerId: stripeCustomerId
                });
                break;
            }

            case 'customer.subscription.deleted': {
                // If user cancels subscription or its credit card expires
                const subscription = event.data.object as Stripe.Subscription;
                // Stripe client ID
                const stripeCustomerId = subscription.customer as string;
                console.log(`[Stripe] Subscription deleted: ${subscription.id}`);

                db.query(`UPDATE users
                    SET is_premium = 0
                    WHERE stripe_customer_id = $customerId
                `).run({
                    $customerId: stripeCustomerId
                });
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`)
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (error: any) {
        console.error("[WebHook Processing Error] ", error.message)
        return new Response("Internal Server Error", { status: 500 });
    }
}
