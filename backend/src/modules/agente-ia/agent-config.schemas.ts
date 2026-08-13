import { z } from "zod";

export const updateConfigSchema = z.object({
  aiEnabled: z.boolean().optional(),
  firstResponseMode: z.enum(["INSTANT", "DELAYED"]).optional(),
  firstResponseDelaySeconds: z.number().int().min(0).optional(),
  humanQueueSlaSeconds: z.number().int().min(1).optional()
});

export const statusSchema = z.object({
  enabled: z.boolean()
});
