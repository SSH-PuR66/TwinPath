import { readFile } from "node:fs/promises";

const config = await readFile(
    new URL("../workers/control-plane/wrangler.jsonc", import.meta.url),
    "utf8"
);

const requiredFragments = [
    '"name": "twinpath-control-plane"',
    '"binding": "AGENT_JOBS"',
    '"PROVIDER_MODE": "production"',
    '"ALLOWED_ORIGINS": "https://twinpath.srodriguez46.workers.dev"',
    '"SUPABASE_URL": "https://wtdmjybpfimmsojsdobx.supabase.co"',
];

for (const fragment of requiredFragments) {
    if (!config.includes(fragment)) {
        throw new Error(
            `Control-plane deployment configuration is missing: ${fragment}`
        );
    }
}

if (/YOUR_|replace_with|example\.com/i.test(config)) {
    throw new Error(
        "Control-plane deployment configuration still contains placeholders."
    );
}

let productionEnv = "";

try {
    productionEnv = await readFile(
        new URL("../.env.production", import.meta.url),
        "utf8"
    );
} catch (error) {
    if (error?.code !== "ENOENT") {
        throw error;
    }
}

const productionControlPlane = productionEnv
    .split(/\r?\n/)
    .find((line) => /^\s*VITE_CONTROL_PLANE_URL\s*=/.test(line))
    ?.split("=", 2)[1]
    ?.trim();

if (productionControlPlane) {
    throw new Error(
        "The production frontend must stay fail-closed until the control-plane Worker is separately deployed and verified."
    );
}

console.log(
    "Control-plane deployment configuration passed fail-closed checks."
);
