import { readFile } from "node:fs/promises";

const config = await readFile(
    new URL("../workers/control-plane/wrangler.jsonc", import.meta.url),
    "utf8"
);

const requiredFragments = [
    '"name": "twinpath-control-plane"',
    '"binding": "AGENT_JOBS"',
    '"PROVIDER_MODE": "disabled"',
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

const productionEnv = await readFile(
    new URL("../.env.production", import.meta.url),
    "utf8"
);

if (
    !productionEnv.includes(
        "VITE_CONTROL_PLANE_URL=https://twinpath-control-plane.srodriguez46.workers.dev"
    )
) {
    throw new Error(
        "The production frontend is not pinned to the control-plane Worker."
    );
}

console.log(
    "Control-plane deployment configuration passed fail-closed checks."
);
