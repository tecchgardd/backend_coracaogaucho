import { z } from "zod";

export const cpfParamSchema = z.object({
  cpf: z.string().min(3)
});

