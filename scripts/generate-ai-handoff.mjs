import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, extname, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1"
);
const outPath = join(root, "docs", "AI-HANDOFF-COMPLETE.md");

const INCLUDE_EXTS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".sql",
  ".md",
  ".json",
  ".jsonc",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".svg",
  ".txt",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  ".wrangler",
  "agent-transcripts",
  "terminals",
]);

const SKIP_FILES = new Set(["package-lock.json", "AI-HANDOFF-COMPLETE.md"]);

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name.startsWith(".") &&
      entry.name !== ".github" &&
      entry.name !== ".env.example"
    ) {
      if (entry.isDirectory() && entry.name !== ".github") continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, acc);
      continue;
    }
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = extname(entry.name).toLowerCase();
    if (
      !INCLUDE_EXTS.has(ext) &&
      entry.name !== "Dockerfile" &&
      !entry.name.endsWith(".d.ts")
    ) {
      continue;
    }
    acc.push(full);
  }
  return acc;
}

function fenceLang(path) {
  const ext = extname(path).toLowerCase();
  return (
    {
      ".js": "javascript",
      ".jsx": "jsx",
      ".ts": "typescript",
      ".tsx": "tsx",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".sql": "sql",
      ".md": "markdown",
      ".json": "json",
      ".jsonc": "jsonc",
      ".css": "css",
      ".html": "html",
      ".yml": "yaml",
      ".yaml": "yaml",
      ".toml": "toml",
      ".svg": "xml",
      ".txt": "text",
    }[ext] || ""
  );
}

const files = (await walk(root)).sort((a, b) => a.localeCompare(b));
const rows = [];
let totalBytes = 0;
for (const full of files) {
  const st = await stat(full);
  totalBytes += st.size;
  rows.push({
    full,
    rel: relative(root, full).split(sep).join("/"),
    size: st.size,
  });
}

const now = new Date().toISOString();
const parts = [];

parts.push("# TwinPath — Complete AI Handoff Bundle");
parts.push("");
parts.push(
  "> Generated for another AI to continue fixes, migrations, Worker deploy, and feature completion."
);
parts.push(`> Generated at: ${now}`);
parts.push("> Repo root: `C:\\\\Users\\\\sergi\\\\Documents\\\\el_plan`");
parts.push("> Remote app: https://twinpath.srodriguez46.workers.dev/");
parts.push("> GitHub: https://github.com/SSH-PuR66/TwinPath");
parts.push("> Supabase project: wtdmjybpfimmsojsdobx");
parts.push(
  `> Files included: ${rows.length} (~${(totalBytes / 1024 / 1024).toFixed(2)} MB of source text)`
);
parts.push("");
parts.push("---");
parts.push("");
parts.push("## 1. Executive briefing (read first)");
parts.push("");
parts.push("### Product");
parts.push(
  "TwinPath is a private family-planning PWA (Vite/React + Supabase) deployed to Cloudflare Workers."
);
parts.push("Recent work added:");
parts.push(
  "1. Sandboxed Autonomous Operations Control Plane (v13 + Worker + UI)"
);
parts.push(
  "2. Profitability foundation with Plaid (read-only) + Stripe (allowlisted Checkout/Billing) + Family Gallery storage fix (v14/v15)"
);
parts.push("");
parts.push("### Current operational status (as of generation)");
parts.push("- **Frontend Worker `twinpath`**: deployed");
parts.push(
  "- **Supabase migrations v13 → v14 → v15**: user reports applied successfully in SQL Editor"
);
parts.push(
  "- **Control-plane Worker `twinpath-control-plane`**: NOT deployed (health URL 404; not in Cloudflare workers list)"
);
parts.push(
  "- **PROVIDER_MODE**: `disabled` by default (fail-closed until secrets exist)"
);
parts.push(
  "- **Local uncommitted change**: `supabase/v15-financial-integrations.sql` gained a prerequisite preflight `DO` block (not yet committed/pushed)"
);
parts.push("");
parts.push("### Hard constraints (do not violate)");
parts.push("- No unauthorized security testing / scanning / exploitation");
parts.push(
  "- Spend approvals go through existing `spend_proposals` / `review_spend_proposal` — do **not** deploy duplicate `wallet-schema.sql` as a second spend path"
);
parts.push(
  "- Plaid is **read-only** (accounts/transactions/balances). No transfer/payment/ACH write capabilities"
);
parts.push("- Stripe is allowlisted Checkout / Billing Portal only");
parts.push(
  "- Browser must never receive Plaid access tokens, Stripe secret keys, webhook secrets, service-role key, or TOKEN_ENCRYPTION_KEY"
);
parts.push(
  "- Do not hand-create empty `integration_connections` or delete the v15 UPDATE block that hardens it"
);
parts.push("");
parts.push("### Known failure that was diagnosed");
parts.push(
  "v15 failed initially because `public.integration_connections` was missing — that table is created by `supabase/v13-autonomous-operations.sql`. Correct order: **v13 → v14 (if needed) → v15**. Failed v15 transaction should roll back because it starts with `begin;`."
);
parts.push("");
parts.push("### Immediate remaining work for the next AI");
parts.push(
  "1. Confirm DB objects exist (financial_provider_* tables, integration_connections, revenue_events, RLS/grants)"
);
parts.push("2. Commit/push the v15 preflight improvement if desired");
parts.push(
  "3. Deploy `workers/control-plane` as `twinpath-control-plane` (queues + cron + secrets)"
);
parts.push(
  "4. Configure Cloudflare secrets; keep PROVIDER_MODE=disabled until Plaid/Stripe sandbox keys ready"
);
parts.push(
  "5. Verify `VITE_CONTROL_PLANE_URL` points at the control-plane origin and CSP allows it"
);
parts.push(
  "6. Smoke-test Family Gallery upload/read and Grow → Financial Connections / Profitability UI"
);
parts.push("");
parts.push("### Migration order");
parts.push("1. `supabase/schema.sql`");
parts.push("2. `supabase/security-patch.sql`");
parts.push(
  "3. `supabase/v5-opportunity-lab.sql` … through `v12-*` as previously applied"
);
parts.push("4. `supabase/v13-autonomous-operations.sql`");
parts.push("5. `supabase/v14-family-gallery-storage-fix.sql`");
parts.push("6. `supabase/v15-financial-integrations.sql`");
parts.push("7. `notify pgrst, 'reload schema';`");
parts.push("");
parts.push("### Key paths");
parts.push("| Area | Path |");
parts.push("| --- | --- |");
parts.push("| Ops schema | `supabase/v13-autonomous-operations.sql` |");
parts.push("| Gallery fix | `supabase/v14-family-gallery-storage-fix.sql` |");
parts.push("| Finance schema | `supabase/v15-financial-integrations.sql` |");
parts.push("| Control-plane Worker | `workers/control-plane/` |");
parts.push("| Ops UI | `src/OperationsControlPlane.jsx` |");
parts.push(
  "| Grow / finance UI | `src/GrowWorkspace.jsx`, `ProfitabilityWorkspace.jsx`, `FinancialConnectionsPanel.jsx`, `StudentPerks.jsx` |"
);
parts.push(
  "| Docs | `docs/autonomous-operations.md`, `docs/financial-integrations.md`, `docs/profitability-playbook.md` |"
);
parts.push("| Deploy workflow | `.github/workflows/deploy-control-plane.yml` |");
parts.push("");
parts.push("---");
parts.push("");
parts.push("## 2. File manifest");
parts.push("");
parts.push("| Path | Bytes |");
parts.push("| --- | ---: |");
for (const r of rows) {
  parts.push(`| \`${r.rel}\` | ${r.size} |`);
}
parts.push("");
parts.push("---");
parts.push("");
parts.push("## 3. Full source dump");
parts.push("");
parts.push(
  "Each section is one repository file. Paths are relative to the repo root."
);
parts.push("");

for (const r of rows) {
  const content = await readFile(r.full, "utf8");
  const lang = fenceLang(r.rel);
  parts.push(`### FILE: \`${r.rel}\``);
  parts.push("");
  parts.push(`<<<<<<< BEGIN_FILE ${r.rel}`);
  const fence = r.rel.endsWith(".md") ? "`````" : "```";
  parts.push(fence + lang);
  parts.push(content.replace(/\r\n/g, "\n").replace(/\n$/, ""));
  parts.push(fence);
  parts.push(`<<<<<<< END_FILE ${r.rel}`);
  parts.push("");
}

parts.push("---");
parts.push("");
parts.push("## 4. End of handoff bundle");
parts.push("");
parts.push(
  "If this file is too large for one model context window, prioritize in this order:"
);
parts.push(
  "1. This briefing + `docs/financial-integrations.md` + `docs/autonomous-operations.md`"
);
parts.push("2. `supabase/v13-*.sql`, `v14-*.sql`, `v15-*.sql`");
parts.push("3. `workers/control-plane/src/**` + tests + `wrangler.jsonc`");
parts.push(
  "4. `src/GrowWorkspace.jsx`, `ProfitabilityWorkspace.jsx`, `FinancialConnectionsPanel.jsx`, `FamilyGallery.jsx`, `OperationsControlPlane.jsx`, `App.jsx` (relevant sections)"
);
parts.push("5. Remaining frontend/CSS/scripts");

await writeFile(outPath, parts.join("\n"), "utf8");
const outStat = await stat(outPath);
console.log(
  JSON.stringify(
    {
      outPath,
      files: rows.length,
      bytes: outStat.size,
      mb: +(outStat.size / 1024 / 1024).toFixed(2),
    },
    null,
    2
  )
);
