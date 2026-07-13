import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

function isValidCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const calculateDigit = (length: number) => {
    const sum = value.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(value[9]) && calculateDigit(10) === Number(value[10]);
}

export const customerSignUpSchema = z.object({
  name: z.string().trim().min(5, "Informe o nome completo").max(150)
    .refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().email("E-mail inválido"),
  cpf: z.string().transform(digits).refine(isValidCpf, "CPF inválido"),
  cep: z.string().transform(digits).refine((value) => value.length === 8, "CEP inválido"),
  address: z.string().trim().min(5, "Informe o endereço").max(300),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(128)
});
