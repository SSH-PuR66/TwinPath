# Autonomous operations

TwinPath's Operations Control Plane is a sandbox-first system for evaluating
four kinds of business experiments:

- micro-SaaS products
- authorized bug-bounty research
- digital assets
- content and affiliate pages

It is not an unattended purchasing, exploitation, disclosure, deployment, or
publishing system. Those action classes are policy-gated, require a recent
human approval and an enabled provider, and are not implemented by the
sandbox adapters.

## Components

- The React control plane reads household-scoped records from the Worker API.
- The control-plane Worker authenticates Supabase access tokens, enqueues jobs,
  and persists run state through the Supabase REST API.
- Cloudflare Queues execute deterministic sandbox workflows.
- Cron only discovers and enqueues due sandbox projects.
- Supabase stores projects, runs, artifacts, approvals, scopes, revenue events,
  and an append-only audit trail.

The existing `spend_proposals` and `review_spend_proposal` flow remains the
only spending approval system. Do not deploy `supabase/wallet-schema.sql`.

## Setup

1. Apply the existing SQL files in their documented order, ending with
   `supabase/v13-autonomous-operations.sql`.
2. Create the queue named `twinpath-agent-jobs`.
3. In `workers/control-plane`, set Worker secrets with Wrangler:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Set `VITE_CONTROL_PLANE_URL` in the frontend environment to the Worker
   origin.
5. Start the Worker with `npm run worker:dev` and the app with `npm run dev`.

Never prefix server secrets with `VITE_`; Vite variables are public browser
configuration.

Prefer routing the Worker through the application's own origin. If it uses a
separate origin, add that exact HTTPS origin to `connect-src` in both
`public/_headers` and `vercel.json`; do not broaden the policy to all
`workers.dev` applications.

Wrangler's local runtime does not currently ship a native Windows ARM64
`workerd` binary. On that platform, run Worker development and dry-runs in WSL
or rely on the Linux CI job; the Vite application and pure Node tests still run
natively.

## Provider adapter contract

Adapters accept a validated run with an engine ID and a sandbox input object.
They return deterministic steps and artifacts. They must not:

- call a registrar, payment processor, deployment provider, disclosure API, or
  publishing API
- scan a network target or bypass an authorization boundary
- execute generated code
- include credentials, cookies, tokens, or unredacted private evidence

Future real adapters must be separate modules. Each consequential call must
re-check the integration state, action allowlist, run mode, approval expiry,
scope, and kill switch immediately before the call. An approval is not a
general delegation and cannot be reused for another action.

## Authorized bounty workflow

Only public program definitions and explicitly entered in-scope assets may be
stored. The shipped adapter analyzes deterministic passive fixtures. It does
not perform DNS enumeration, HTTP probing, exploitation, credential testing,
or report submission. Evidence artifacts are private and should be redacted
before export. A human is responsible for confirming the program's current
rules and submitting any report.

## Revenue ledger

Sandbox revenue is stored as simulated and cannot become a transaction.
Only a confirmed, non-sandbox revenue event can be posted through the
idempotent ledger RPC. Webhook signature verification and a real billing
provider are prerequisites for creating confirmed events.

## Emergency shutdown

1. Pause projects in the control plane.
2. Disable Worker routes or the Queue consumer in Cloudflare.
3. Disable affected `integration_connections` records.
4. Rotate any provider and Supabase service-role credentials that may have
   been exposed.
5. Review `agent_audit_events` and failed run records before restoring service.

The Worker must fail closed when Supabase, authentication, policy data, or a
provider is unavailable.

## Verification

Run:

```bash
npm run test:worker
npm run worker:dry-run
npm run build
```

Before enabling any future real adapter, add provider-specific contract tests,
webhook signature tests, cross-household access tests, and a rollback drill.
