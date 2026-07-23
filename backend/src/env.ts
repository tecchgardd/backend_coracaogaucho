import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  AUTH_TRUSTED_ORIGINS: z.string().default(""),
  ALLOW_PUBLIC_SIGNUP: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  PRODUCTION_ORIGIN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_CURRENCY: z.literal("brl").default("brl"),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  N8N_INTEGRATION_SECRET: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().default(5)
});

export const env = envSchema.parse(process.env);
export const googleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const trustedOrigins = [
  "https://gabriel.expo.app",
  ...env.AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  env.FRONTEND_URL,
  env.PRODUCTION_ORIGIN,
  ...(env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:19006",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://localhost:3333",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081"
      ])
].filter(Boolean) as string[];

export function isTrustedDevOrigin(origin: string) {
  if (env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}
