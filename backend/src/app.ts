import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { toNodeHandler } from "better-auth/node";
import type {} from "./types/express.js";
import { env, isTrustedDevOrigin, trustedOrigins } from "./env.js";
import { auth } from "./lib/auth.js";
import { errorMiddleware, notFoundMiddleware } from "./middlewares/error.middleware.js";
import { routes } from "./routes/index.js";
import { swaggerSpec } from "./docs/swagger.js";
import { webhooksController } from "./modules/webhooks/webhooks.controller.js";
import { asyncHandler } from "./utils/http.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || trustedOrigins.includes(origin) || isTrustedDevOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origem não permitida pelo CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    })
  );

  const helmetFactory = helmet as unknown as () => express.RequestHandler;
  app.use(helmetFactory());
  app.get("/health", (_req, res) => res.json({ status: "ok", stripeConfigured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) }));
  app.get("/", (_req, res) => {
    res.json({ name: "Coração Gaúcho API", status: "ok", health: "/health" });
  });
  app.use("/api/auth/sign-up", (req, res, next) => {
    if (env.ALLOW_PUBLIC_SIGNUP || req.originalUrl.startsWith("/api/auth/sign-up/email")) return next();
    return res.status(403).json({ message: "Cadastro público desabilitado" });
  });
  app.all("/api/auth/*", toNodeHandler(auth));
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), asyncHandler(webhooksController.stripe));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api", routes);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

const app = createApp();

export default app;
