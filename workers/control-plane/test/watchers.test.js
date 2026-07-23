import test from "node:test";
import assert from "node:assert/strict";

import { contentFingerprint, validateWatcherInput } from "../src/watchers.js";

test("watcher input validation enforces https and bounds", () => {
  const ok = validateWatcherInput({
    label: "HESC TAP updates",
    url: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid",
  });
  assert.equal(ok.label, "HESC TAP updates");
  assert.ok(ok.url.startsWith("https://"));

  assert.throws(() => validateWatcherInput({ label: "x", url: "https://a.com" }), /label/);
  assert.throws(() => validateWatcherInput({ label: "valid label", url: "http://insecure.com" }), /https/);
  assert.throws(() => validateWatcherInput({ label: "valid label", url: "https://user:pass@evil.com" }), /credentials|https/);
  assert.throws(() => validateWatcherInput({ label: "valid label", url: "not a url" }), /valid https/);
});

test("fingerprint ignores markup, scripts, and clock noise", () => {
  const a = contentFingerprint("<html><script>x=1;</script><body><h1>Deadline: Nov 1</h1><p>Updated 10:32 AM</p></body></html>");
  const b = contentFingerprint("<html><script>x=999;</script><body><h1>Deadline:   Nov 1</h1><p>Updated 4:07 PM</p></body></html>");
  assert.equal(a, b);
  const c = contentFingerprint("<body><h1>Deadline: Dec 15</h1></body>");
  assert.notEqual(a, c);
});
