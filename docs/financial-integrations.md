# Financial integrations

TwinPath supports a fail-closed integration path for Plaid account data and
Stripe customer payments. It does not guarantee income, transfer money, place
trades, or automate purchases.

## Provider roles

- Plaid provides read-only account and transaction data. Availability for M&T
  Bank and Chime is determined by Plaid at connection time.
- Stripe creates allowlisted Checkout or Billing Portal sessions and reports
  signed payment events.
- Supabase stores household-scoped connection metadata, synchronized ledger
  rows, provider-event idempotency records, and audit events.
- The control-plane Worker owns all provider credentials and API calls.

Browser code must never receive Plaid access tokens, Stripe secret keys,
webhook secrets, the Supabase service-role key, or the token-encryption key.

## Migration order

Apply migrations in repository order:

1. `supabase/schema.sql`
2. `supabase/security-patch.sql`
3. `supabase/v5-opportunity-lab.sql` through
   `supabase/v13-autonomous-operations.sql`
4. `supabase/v14-family-gallery-storage-fix.sql`
5. `supabase/v15-financial-integrations.sql`

The v14 migration repairs the private Family Gallery storage policies. The v15
migration adds provider synchronization and encrypted credential records.

## Cloudflare configuration

The separate control-plane Worker requires:

### Non-secret variables

- `ENVIRONMENT=production`
- `PROVIDER_MODE=disabled`, `sandbox`, or `production`
- `ALLOWED_ORIGINS=https://twinpath.srodriguez46.workers.dev`
- `SUPABASE_URL`
- `PLAID_ENV=sandbox`, `development`, or `production`
- `STRIPE_API_VERSION`
- allowlisted Stripe price identifiers

### Secrets

- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_ENCRYPTION_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_WEBHOOK_URL` when configured
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Use a random 256-bit token-encryption key. Rotate it by adding a new key
version, re-encrypting stored provider credentials, and only then retiring the
old version.

`PROVIDER_MODE=disabled` is the safe deployment default. Sandbox mode requires
Plaid sandbox credentials and Stripe test keys. Production mode additionally
requires Plaid Production approval, Stripe live keys, live webhook endpoints,
and a successful readiness check.

## Plaid onboarding

1. Register the control-plane redirect and webhook URLs in Plaid.
   The configured OAuth redirect is
   `https://twinpath.srodriguez46.workers.dev/`; Link resumes with the
   same short-lived link token kept in session storage.
2. Start with Sandbox and test Link, token exchange, account discovery,
   transaction pagination, cursor persistence, duplicate delivery, disconnect,
   and item errors.
3. Request Production access from Plaid.
4. Review the institutions and products enabled for the Production account.
5. Move to production only after the user-facing consent and deletion flows pass.

Plaid connections are read-only. TwinPath does not request transfer, payment,
identity-document, or investment-trading permissions.

Implementation references:

- [Plaid Link API](https://plaid.com/docs/api/link/)
- [Plaid Items and token exchange](https://plaid.com/docs/api/items/)
- [Plaid webhook verification](https://plaid.com/docs/api/webhooks/webhook-verification/)

Disconnecting a Plaid item must revoke it at Plaid, delete encrypted access
credentials, stop synchronization, and retain only ledger records the user has
chosen to keep.

## Stripe onboarding

1. Create test products and prices and add only their IDs to the Worker
   allowlist.
2. Register the Stripe webhook endpoint and subscribe only to events consumed
   by the Worker.
3. Verify signatures against the raw request body and store event IDs before
   applying side effects.
4. Test successful payment, subscription renewal, refund, dispute, duplicate
   event, stale signature, and invalid currency cases.
5. Repeat with separate live products, live keys, and a live webhook secret.

Only signed, verified, live USD revenue events can enter the TwinPath
transactions ledger. Test and simulated events remain separate.

Implementation references:

- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- [Stripe webhook endpoint setup](https://docs.stripe.com/webhooks/quickstart)

## Incident shutdown

1. Set `PROVIDER_MODE=disabled`.
2. Disable Worker routes or the Queue consumer.
3. Revoke affected Plaid items and rotate Stripe/Plaid credentials.
4. Rotate the token-encryption and Supabase service-role keys if exposure is
   suspected.
5. Review provider webhook records and `agent_audit_events`.
6. Re-enable test mode first and complete the readiness checks before live
   restoration.

## Profit goal model

The profitability workspace is a planning and measurement tool. A one-year
$1,000,000 goal is an aggressive scenario, not a forecast or guarantee. It
must keep verified income, expense reduction, projected opportunities, and
high-variance experiments visibly separate.
