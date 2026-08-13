import { z } from "zod";

export const channelParamSchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "INSTAGRAM", "FACEBOOK", "WEBSITE"])
});

export const channelBodySchema = z.object({
  enabled: z.boolean()
});
