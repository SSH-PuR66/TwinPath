# El Plan control plane

Sandbox-only Cloudflare Worker for authenticated household automation runs.

## Runtime secrets

Set these with `wrangler secret put`; they are intentionally absent from `wrangler.jsonc`:

- `SUPABASE_ANON_KEY` — used only to validate the caller's Bearer token at `/auth/v1/user`.
- `SUPABASE_SERVICE_ROLE_KEY` — used by HTTP, Queue, and Cron handlers for household-scoped REST persistence.

Configure the non-secret placeholders in `wrangler.jsonc`, then provision
`el-plan-agent-jobs` and its dead-letter queue before deployment.

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

All `/v1` endpoints require `Authorization: Bearer <Supabase JWT>`. Users with multiple
households must also send `X-Household-Id`; it is treated only as a selector and is
validated against Supabase membership.

Run pure deterministic tests with `npm test`.
