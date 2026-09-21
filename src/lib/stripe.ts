import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** `null` si el proyecto aún no tiene claves configuradas. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}
