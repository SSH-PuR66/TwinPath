# TwinPath AI Wallet — human-in-the-loop design

## Flow
1. Structured proposal arrives (Opportunity Import or manual) -> `wallet_proposals`
   insert. The database itself validates amount, allowlisted recipient, purpose,
   per-transaction / daily / monthly caps, and the master kill switch.
2. Proposal sits in `pending_review`. Nothing can execute from this state.
3. The OWNER (a human, with a Supabase MFA `aal2` session — enforced by RLS)
   reviews and inserts a `wallet_approvals` row bound by SHA-256 hash to the
   exact amount + currency + recipient + purpose shown to them. Approvals are
   single-use and expire (default 5 minutes).
4. The `wallet-execute` edge function re-verifies everything server-side
   (status, expiry, single-use consumption, hash binding, active recipient),
   executes through a provider adapter, and stores an HMAC-signed receipt.
5. `wallet_events` is an append-only audit log (UPDATE/DELETE blocked by trigger).

## Control properties
- Kill switch: `wallet_settings.enabled` starts FALSE. Nothing moves until the
  owner turns it on, and flipping it off stops all new proposals instantly.
- Caps enforced in Postgres, not in the client and not by the AI.
- The AI can only PROPOSE. It holds no credentials and cannot approve or
  execute. The MFA approval step is structurally required, not optional.
- Approval binding: if anything about the proposal changed after approval, the
  hash mismatch blocks execution.

## Setup
1. Run `wallet-schema.sql` after `schema.sql` / `security-patch.sql`.
2. Enroll MFA (TOTP) on the owner account in Supabase Auth.
3. `supabase functions deploy wallet-execute`
4. `supabase secrets set WALLET_RECEIPT_SECRET=<long random string>`
   (You generate and set this yourself; nothing else needs it.)
5. Only the `mock` (dry-run) adapter ships. Adding a real money adapter is a
   deliberate owner action: pick a provider with an official API that permits
   your use case, supports your country/age, offers a genuinely isolated
   balance with merchant restrictions, webhooks, no overdraft path, and
   instant revocation — and paste its API key ONLY into
   `supabase secrets set`, never into the repo or the client.

## Deliberately out of scope
No auto-approval mode exists and none should be added. Removing the human MFA
gate turns a controlled wallet into an uncontrolled one; every other safety
property depends on it.
