import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        colaboradorId: number;
        role: UserRole;
        email: string;
        name: string;
      };
      customerAuth?: {
        userId: string;
        customerId?: number;
        email: string;
        name: string;
      };
    }
  }
}

export {};
