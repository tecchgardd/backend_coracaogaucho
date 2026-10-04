import assert from "node:assert/strict";
import test from "node:test";
import { customerSignUpSchema } from "./customer-auth.schemas.js";

const validInput = {
  name: "Cliente da Silva",
  email: "cliente@example.com",
  cpf: "529.982.247-25",
  phone: "48992210952",
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

test("customer signup requires a valid Brazilian phone and normalizes it", () => {
  const parsed = customerSignUpSchema.parse({ ...validInput, phone: "(48) 99221-0952" });
  assert.equal(parsed.phone, "48992210952");
  assert.equal(customerSignUpSchema.parse({ ...validInput, phone: "4832210952" }).phone, "4832210952");
  const { phone: _phone, ...withoutPhone } = validInput;
  assert.equal(customerSignUpSchema.safeParse(withoutPhone).success, false);
});

test("customer signup rejects invalid phones", () => {
  for (const phone of ["", "992210952", "0992210952", "10992210952", "48892210952", "489922109521"]) {
    assert.equal(customerSignUpSchema.safeParse({ ...validInput, phone }).success, false, phone);
  }
});
