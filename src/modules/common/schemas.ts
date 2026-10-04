import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

export function getPagination(query: { page: number; limit: number }) {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit
  };
}
