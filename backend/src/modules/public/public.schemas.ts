import { z } from "zod";

export const publicEventQuerySchema = z.object({
  type: z.enum(["BAILE", "CURSO", "EVENTO"]).optional(),
  city: z.string().trim().min(1).optional(),
  upcoming: z.preprocess((value) => value === true || value === 'true' || value === '1', z.boolean()).default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24)
});

export const publicAlbumQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24)
});

export const publicAlbumPhotosQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40)
});

export const slugParamSchema = z.object({ slug: z.string().min(1).max(300) });
export const eventParamSchema = z.object({ id: z.coerce.number().int().positive() });
