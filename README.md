# TwinPath

TwinPath is a private, shared family-planning PWA for two adults.

It provides:

- Shared and private tasks
- Appointments and birth-preparation checklists
- Transactions and CSV export
- Income-opportunity tracking
- Legal resource navigation
- Private/shared document storage
- Built-in animated depth themes plus an optional, locally packaged theme catalog
- Reduced-motion mode
- Passwordless authentication
- Household invitation codes
- Supabase row-level security
- Real-time synchronization
- iPhone home-screen installation

## Important limitations

TwinPath is not:

- A medical provider
- A lawyer
- A tax preparer
- A financial adviser
- A benefits agency
- An eligibility determination
- End-to-end encrypted storage

Never use the app to conceal income, misrepresent residence or household
composition, evade taxes, submit false applications, or conduct unauthorized
security testing.

Benefits, tax credits, scholarships, and grants must be confirmed through the
official administering organization.

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- A Vercel, Cloudflare Pages, Netlify, or similar hosting account

## 1. Install dependencies

```bash
npm install
```

## Autonomous Operations Control Plane

TwinPath includes an optional sandbox-first control plane backed by Supabase
and a separate Cloudflare Worker. It can model four deterministic experiment
workflows and stage private artifacts and approvals. It does not perform real
deployment, spending, vulnerability disclosure, asset purchasing, scanning,
or publishing.

Apply the versioned SQL files through
`supabase/v18-plaid-product-streams.sql` in order (after v15 and v17), configure the Worker secrets, and
set `VITE_CONTROL_PLANE_URL` to its origin.
See [docs/autonomous-operations.md](docs/autonomous-operations.md) for setup,
policy boundaries, migration guidance, and emergency shutdown.

## Financial connections and profitability

Plaid can provide read-only account data for supported institutions such as
M&T Bank and Chime. Stripe can provide allowlisted Checkout and Billing
sessions. Provider access is disabled until credentials, signed webhooks, and
readiness checks are configured.

Liabilities and recurring-stream analysis are optional per provider. Their
unavailability never prevents balance or Transactions sync, and the UI shows
that state rather than example financial data. See [theme-assets/README.md](theme-assets/README.md)
for the reviewed local-only theme intake process and [docs/IOS-BUILD.md](docs/IOS-BUILD.md)
for the intentionally manual future Capacitor path.

See [docs/financial-integrations.md](docs/financial-integrations.md) for the
security model and activation process. Profit goals and opportunity scores are
planning scenarios, not guaranteed financial outcomes. The route-priority and
goal methodology is documented in
[docs/profitability-playbook.md](docs/profitability-playbook.md).
