import assert from "node:assert/strict";
import { isExistingAccountError, validateRegisterInput } from "./register-account";

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

async function main() {
  await run("rejects a short password and a missing business name", () => {
    assert.equal(validateRegisterInput({ email: "a@b.co", password: "12345", businessName: "Acme" }).ok, false);
    assert.equal(validateRegisterInput({ email: "a@b.co", password: "123456", businessName: "  " }).ok, false);
    const ok = validateRegisterInput({ email: "  a@b.co ", password: "123456", businessName: " Acme " });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.email, "a@b.co");
      assert.equal(ok.value.businessName, "Acme");
    }
  });

  await run("recognizes an email that already has an account", () => {
    assert.equal(isExistingAccountError({ code: "email_exists", message: "already" }), true);
    assert.equal(
      isExistingAccountError({ message: "A user with this email address has already been registered" }),
      true
    );
    assert.equal(isExistingAccountError({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" }), false);
  });

  console.log("\nall register tests passed");
}

void main();
