import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function source(path) {
    return readFile(resolve(root, path), "utf8");
}

const requiredFiles = [
    "supabase/v13-autonomous-operations.sql",
    "supabase/v14-family-gallery-storage-fix.sql",
    "supabase/v15-financial-integrations.sql",
    "workers/control-plane/wrangler.jsonc",
    "workers/control-plane/src/index.js",
    "workers/control-plane/src/persistence-v13.js",
    "workers/control-plane/src/policies.js",
    "workers/control-plane/src/provider-mode.js",
    "workers/control-plane/src/provider-persistence-v15.js",
    "workers/control-plane/src/plaid.js",
    "workers/control-plane/src/stripe.js",
    "src/OperationsControlPlane.jsx",
    "src/operationsCatalog.js",
];

const contents = new Map(
    await Promise.all(
        requiredFiles.map(async (path) => [path, await source(path)])
    )
);

const migration = contents.get("supabase/v13-autonomous-operations.sql");
const requiredTables = [
    "automation_projects",
    "agent_runs",
    "agent_artifacts",
    "agent_approvals",
    "integration_connections",
    "authorized_scopes",
    "revenue_events",
    "agent_audit_events",
];

for (const table of requiredTables) {
    if (!migration.includes(table)) {
        throw new Error(`Control-plane migration is missing ${table}.`);
    }
}

if (!/enable row level security/iu.test(migration)) {
    throw new Error("Control-plane tables must enable row-level security.");
}

if (!/sandbox/iu.test(migration)) {
    throw new Error("Control-plane migration must default to sandbox mode.");
}

const allSource = [...contents.values()].join("\n");
const secretAssignments = [
    /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"'$<]+/u,
    /STRIPE_SECRET_KEY\s*[:=]\s*["'][^"'$<]+/u,
];

for (const pattern of secretAssignments) {
    if (pattern.test(allSource)) {
        throw new Error("A server secret appears to be hardcoded.");
    }
}

const workerConfig = contents.get("workers/control-plane/wrangler.jsonc");

for (const binding of ["AGENT_JOBS", '"crons"', '"observability"']) {
    if (!workerConfig.includes(binding)) {
        throw new Error(`Worker configuration is missing ${binding}.`);
    }
}

const financialMigration = contents.get(
    "supabase/v15-financial-integrations.sql"
);
for (const table of [
    "plaid_items",
    "plaid_accounts",
    "plaid_transactions",
    "stripe_customers",
    "provider_webhook_events",
]) {
    if (!financialMigration.includes(`public.${table}`)) {
        throw new Error(`Financial migration is missing ${table}.`);
    }
}

if (
    !/PROVIDER_MODE"\s*:\s*"production"/u.test(workerConfig) ||
    !/"ratelimits"/u.test(workerConfig)
) {
    throw new Error(
        "Worker providers must deploy in production mode with a rate-limit binding."
    );
}

console.log("Autonomous operations audit passed.");
