// TwinPath wallet executor — Supabase Edge Function.
// Executes ONE approved, MFA-gated, unconsumed, unexpired transaction intent.
// Provider credentials live ONLY in edge-function secrets that the owner
// configures themselves (supabase secrets set ...). The AI never sees them.

import { createClient } from "npm:@supabase/supabase-js@2";

const SIGNING_SECRET = Deno.env.get("WALLET_RECEIPT_SECRET") ?? "";

// ---------- Provider adapter interface ----------
interface ExecuteResult {
    ok: boolean;
    providerTxRef?: string;
    raw?: unknown;
    error?: string;
}

interface Adapter {
    execute(args: {
        amountCents: number;
        currency: string;
        recipientRef: string;
        purpose: string;
        idempotencyKey: string;
    }): Promise<ExecuteResult>;
}

// The only adapter shipped is a dry-run mock. A real adapter must be added
// deliberately by the owner, must use an isolated balance with no overdraft
// path, and must support merchant restrictions + revocation.
const adapters: Record<string, Adapter> = {
    mock: {
        async execute({ idempotencyKey }) {
            return { ok: true, providerTxRef: `mock_${idempotencyKey}`, raw: { dryRun: true } };
        },
    },
};

async function hmac(message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(SIGNING_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("method", { status: 405 });
    if (!SIGNING_SECRET) return new Response("server not configured", { status: 500 });

    // Caller must be the authenticated owner (JWT forwarded by the client).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return new Response("unauthorized", { status: 401 });
    const ownerId = userData.user.id;

    const { proposalId } = await req.json().catch(() => ({}));
    if (!proposalId) return new Response("proposalId required", { status: 400 });

    // Service-role client for state transitions (server-only).
    const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load proposal + approval + recipient, all owner-scoped.
    const { data: p } = await admin.from("wallet_proposals")
        .select("*").eq("id", proposalId).eq("owner_id", ownerId).single();
    if (!p) return new Response("not found", { status: 404 });
    if (p.status !== "approved") return new Response("not approved", { status: 409 });

    const { data: a } = await admin.from("wallet_approvals")
        .select("*").eq("proposal_id", proposalId).eq("owner_id", ownerId).single();
    if (!a) return new Response("no approval", { status: 409 });
    if (a.consumed_at) return new Response("approval already used", { status: 409 });
    if (new Date(a.expires_at) < new Date()) {
        await admin.from("wallet_proposals").update({ status: "expired" }).eq("id", proposalId);
        return new Response("approval expired", { status: 409 });
    }

    // Verify the approval is bound to exactly this proposal's terms.
    const boundInput = `${p.amount_cents}|${p.currency}|${p.recipient_id}|${p.purpose}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(boundInput));
    const boundHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
    if (boundHash !== a.bound_hash) return new Response("approval binding mismatch", { status: 409 });

    const { data: r } = await admin.from("wallet_recipients")
        .select("*").eq("id", p.recipient_id).eq("owner_id", ownerId).eq("active", true).single();
    if (!r) return new Response("recipient inactive", { status: 409 });

    const adapter = adapters[r.provider];
    if (!adapter) return new Response("no adapter for provider", { status: 409 });

    // Consume the approval FIRST (single use), then execute.
    const { error: consumeErr } = await admin.from("wallet_approvals")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", a.id).is("consumed_at", null);
    if (consumeErr) return new Response("consume failed", { status: 409 });

    await admin.from("wallet_proposals").update({ status: "executing" }).eq("id", proposalId);
    await admin.from("wallet_events").insert({
        owner_id: ownerId, proposal_id: proposalId, event: "execute_start",
    });

    const result = await adapter.execute({
        amountCents: p.amount_cents,
        currency: p.currency,
        recipientRef: r.recipient_ref,
        purpose: p.purpose,
        idempotencyKey: proposalId,
    });

    if (!result.ok) {
        await admin.from("wallet_proposals").update({ status: "failed" }).eq("id", proposalId);
        await admin.from("wallet_events").insert({
            owner_id: ownerId, proposal_id: proposalId, event: "execute_failed",
            detail: { error: result.error ?? "unknown" },
        });
        return new Response(JSON.stringify({ ok: false }), { status: 502 });
    }

    const signature = await hmac(
        `${proposalId}|${p.amount_cents}|${p.currency}|${r.provider}|${result.providerTxRef}`,
    );

    await admin.from("wallet_receipts").insert({
        proposal_id: proposalId, owner_id: ownerId, provider: r.provider,
        provider_tx_ref: result.providerTxRef, amount_cents: p.amount_cents,
        signature, raw_response: result.raw ?? null,
    });
    await admin.from("wallet_proposals").update({ status: "settled" }).eq("id", proposalId);
    await admin.from("wallet_events").insert({
        owner_id: ownerId, proposal_id: proposalId, event: "settled",
        detail: { providerTxRef: result.providerTxRef },
    });

    return new Response(JSON.stringify({ ok: true, receiptSigned: true }), {
        headers: { "Content-Type": "application/json" },
    });
});
