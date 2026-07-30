# El Plan control plane

Cloudflare Worker for sandbox-only autonomous runs and explicitly gated Plaid/Stripe user flows.

## Runtime secrets

Set these with `wrangler secret put`; they are intentionally absent from `wrangler.jsonc`:

- `SUPABASE_ANON_KEY` — used only to validate the caller's Bearer token at `/auth/v1/user`.
- `SUPABASE_SERVICE_ROLE_KEY` — used by HTTP, Queue, and Cron handlers for household-scoped REST persistence.
- `PLAID_CLIENT_ID` and `PLAID_SECRET` — Plaid server credentials.
- `TOKEN_ENCRYPTION_KEY` — base64 or hex encoded 32-byte AES-GCM key for Plaid access tokens.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — Stripe server and webhook credentials.

Configure the non-secret placeholders in `wrangler.jsonc`, then provision
`el-plan-agent-jobs` and its dead-letter queue before deployment.
`PROVIDER_MODE` defaults to `disabled`; choose `sandbox` explicitly for test providers.
Plaid uses its sandbox host unless both `PROVIDER_MODE` and `PLAID_ENV` are
explicitly `production`. Autonomous queue and cron runs remain sandbox-only in every mode.

## REST tables

The configured tables are expected to expose:

- `household_members`: `user_id`, `household_id`, `role`
- `agent_scopes`: scope fields written by `createScope`
- `agent_runs`: run lifecycle, input, output, error, and timestamps
- `agent_approvals`: approval status, decision identity, note, and timestamps

Supabase RLS should remain enabled for direct clients. The Worker uses its service role
only after deriving the user from Supabase Auth and resolving a matching household
membership; every resource query includes `household_id`.

## Endpoints

- `GET /health`
- `GET /v1/bootstrap` or `GET /v1/dashboard`
- `POST /v1/scopes`
- `POST /v1/runs`
- `POST /v1/runs/:id/cancel`
- `POST /v1/approvals/:id/decision`
- `POST /v1/plaid/link-token`
- `POST /v1/plaid/public-token/exchange`
- `GET /v1/plaid/accounts`
- `POST /v1/plaid/transactions/sync`
- `POST /v1/plaid/disconnect`
- `POST /v1/stripe/checkout`
- `POST /v1/stripe/billing-portal`
- `POST /v1/webhooks/plaid`
- `POST /v1/webhooks/stripe`

All `/v1` endpoints except the two provider webhooks require
`Authorization: Bearer <Supabase JWT>`. Provider webhooks instead require provider
signature verification over the bounded raw request body. Users with multiple
households must also send `X-Household-Id`; it is treated only as a selector and is
validated against Supabase membership.

Stripe Checkout accepts only price IDs configured in `STRIPE_ALLOWED_PRICE_IDS`;
all redirect URLs are server-configured HTTPS URLs. Stripe webhook event IDs are
claimed idempotently before processing, and only verified payment events can be
written as service-role revenue events. No route implements transfers, payouts,
withdrawals, charges, or autonomous spending.

Run pure deterministic tests with `npm test`.
