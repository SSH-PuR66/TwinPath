import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production omits the unavailable control-plane Worker URL", async () => {
  const source = await readFile(new URL("../.env.production", import.meta.url), "utf8");
  const configuredLine = source
    .split(/\r?\n/)
    .find((line) => /^\s*VITE_CONTROL_PLANE_URL\s*=/.test(line));
  const configuredValue = configuredLine?.split("=", 2)[1]?.trim() || "";

  assert.equal(
    configuredValue,
    "",
    "VITE_CONTROL_PLANE_URL must stay absent until twinpath-control-plane is deployed and verified"
  );
});
