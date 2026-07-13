import { z } from "zod";

export const abacatePayWebhookSchema = z.record(z.string(), z.unknown());
