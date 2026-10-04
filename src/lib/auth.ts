import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { env, googleAuthEnabled, trustedOrigins } from "../env.js";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true
  },
  plugins: [bearer()],
  socialProviders: googleAuthEnabled ? {
    google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! }
  } : {},
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "email-password"] }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        input: false
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false
      },
      phone: {
        type: "string",
        required: false
      }
    }
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, role: "CUSTOMER", mustChangePassword: false } })
      }
    }
  },
  advanced: {
    cookiePrefix: "cg-admin"
  }
});
