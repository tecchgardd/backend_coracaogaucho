import Stripe from "stripe";
import { env } from "../env.js";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: { name: "coracao-gaucho-backend", version: "1.0.0" }
});
