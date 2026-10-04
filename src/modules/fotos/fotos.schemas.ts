import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const fotoQuerySchema = paginationQuerySchema.extend({
  folder: z.string().optional()
});
