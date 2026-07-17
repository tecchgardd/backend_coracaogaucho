process.env.NODE_ENV = "test";
process.env.STRIPE_SECRET_KEY ||= "sk_test_unit";
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_unit";
process.env.STRIPE_CURRENCY ||= "brl";
process.env.FRONTEND_URL ||= "http://localhost:3000";
process.env.BACKEND_URL ||= "http://localhost:3333";
process.env.N8N_INTEGRATION_SECRET ||= "unit-integration-secret";
