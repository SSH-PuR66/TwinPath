import test from "node:test";
import assert from "node:assert/strict";

import { findForbiddenKeys, validateProfile } from "../src/profile.js";

test("clean profiles pass and normalize", () => {
  const profile = validateProfile({
    adults: [
      {
        name: "Sergio Wesley Rodriguez",
        dob: "2008-05-26",
        email: "srodriguez46@gaels.iona.edu",
        school: "Iona University",
        student_id: "0828446",
      },
      {
        name: "Brianna Caceres",
        dob: "2006-08-31",
        school: "Dutchess Community College",
      },
    ],
    addresses: { sergio: "918 Main St, Fishkill NY 12524" },
    twins_due: "2026-12-28",
  });
  assert.equal(profile.adults.length, 2);
});

test("government identifier and credential keys are refused", () => {
  assert.equal(findForbiddenKeys({ a: { ssn: "x" } }).length, 1);
  assert.equal(findForbiddenKeys({ social_security_number: 1 }).length, 1);
  assert.equal(findForbiddenKeys({ drivers_license_number: 1 }).length, 1);
  assert.equal(findForbiddenKeys({ bank: { routing: 1 } }).length, 1);
  assert.throws(
    () => validateProfile({ guardian: { ssn: "000" } }),
    /not allowed in the vault/,
  );
});

test("oversized profiles are rejected", () => {
  assert.throws(
    () => validateProfile({ blob: "x".repeat(20000) }),
    /at most 16 KB/,
  );
});
