import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const learningSuggestionStatusEnum = z.enum(["PENDENTE", "APROVADO", "REJEITADO"]);

export const learningSuggestionQuerySchema = paginationQuerySchema.extend({
  status: learningSuggestionStatusEnum.optional()
});
