import assert from "node:assert/strict";
import test from "node:test";
import { customerSignUpSchema } from "./customer-auth.schemas.js";

const validInput = {
  name: "Cliente da Silva",
  email: "cliente@example.com",
  cpf: "529.982.247-25",
  cep: "88750-000",
  address: "Rua Principal, 123",
  password: "senha-segura"
};

test("customer signup normalizes CPF and CEP", () => {
  const parsed = customerSignUpSchema.parse(validInput);
  assert.equal(parsed.cpf, "52998224725");
  assert.equal(parsed.cep, "88750000");
});

test("customer signup rejects invalid CPF and incomplete name", () => {
  assert.equal(customerSignUpSchema.safeParse({ ...validInput, cpf: "111.111.111-11" }).success, false);
  assert.equal(customerSignUpSchema.safeParse({ ...validInput, name: "Cliente" }).success, false);
});
