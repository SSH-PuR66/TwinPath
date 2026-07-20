import { useCallback, useEffect, useState } from "react";
import {
    BadgeCheck,
    CircleSlash,
    Loader2,
    Power,
    ReceiptText,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";

import { supabase } from "./supabase";

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

function cents(value) {
    return money.format((value || 0) / 100);
}

async function sha256Hex(message) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(message)
    );

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

const statusTone = {
    pending_review: "amber",
    approved: "blue",
    executing: "blue",
    settled: "green",
    rejected: "red",
    expired: "red",
    failed: "red",
};

export default function WalletPanel({ session }) {
    const [settings, setSettings] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [recipients, setRecipients] = useState({});
    const [receipts, setReceipts] = useState([]);
    const [busyId, setBusyId] = useState("");
    const [message, setMessage] = useState("");
    const [mfaLevel, setMfaLevel] = useState("aal1");

    const ownerId = session?.user?.id;

    const load = useCallback(async () => {
        if (!ownerId) return;

        const [s, p, r, rec, aal] = await Promise.all([
            supabase.from("wallet_settings").select("*").maybeSingle(),
            supabase
                .from("wallet_proposals")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(25),
            supabase.from("wallet_recipients").select("*"),
            supabase
                .from("wallet_receipts")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10),
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);

        setSettings(s.data || null);
        setProposals(Array.isArray(p.data) ? p.data : []);
        setReceipts(Array.isArray(rec.data) ? rec.data : []);
        setMfaLevel(aal.data?.currentLevel || "aal1");

        const byId = {};
        (r.data || []).forEach((row) => {
            byId[row.id] = row;
        });
        setRecipients(byId);
    }, [ownerId]);

    useEffect(() => {
        load();
    }, [load]);

    async function ensureSettings() {
        const { error } = await supabase
            .from("wallet_settings")
            .upsert({ owner_id: ownerId, enabled: false });

        if (error) setMessage(error.message);
        else await load();
    }

    async function toggleKillSwitch() {
        if (!settings) return;

        const { error } = await supabase
            .from("wallet_settings")
            .update({ enabled: !settings.enabled })
            .eq("owner_id", ownerId);

        if (error) setMessage(error.message);
        await load();
    }

    async function reject(proposal) {
        setBusyId(proposal.id);
        setMessage("");

        const { error } = await supabase
            .from("wallet_proposals")
            .update({ status: "rejected" })
            .eq("id", proposal.id);

        if (error) setMessage(error.message);
        setBusyId("");
        await load();
    }

    async function approveAndExecute(proposal) {
        setBusyId(proposal.id);
        setMessage("");

        try {
            if (mfaLevel !== "aal2") {
                setMessage(
                    "Approval requires an MFA-verified session. Enroll and verify a TOTP factor in Settings, then sign in with it."
                );
                return;
            }

            const boundHash = await sha256Hex(
                `${proposal.amount_cents}|${proposal.currency}|${proposal.recipient_id}|${proposal.purpose}`
            );

            const ttl = settings?.approval_ttl_seconds || 300;

            const { error: approvalError } = await supabase
                .from("wallet_approvals")
                .insert({
                    proposal_id: proposal.id,
                    owner_id: ownerId,
                    bound_hash: boundHash,
                    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
                });

            if (approvalError) {
                setMessage(approvalError.message);
                return;
            }

            const { error: statusError } = await supabase
                .from("wallet_proposals")
                .update({ status: "approved" })
                .eq("id", proposal.id);

            if (statusError) {
                setMessage(statusError.message);
                return;
            }

            const { data, error: execError } = await supabase.functions.invoke(
                "wallet-execute",
                { body: { proposalId: proposal.id } }
            );

            if (execError) setMessage(execError.message);
            else if (data?.ok) setMessage("Transaction settled. Receipt signed.");
        } finally {
            setBusyId("");
            await load();
        }
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">WALLET</p>
                    <h2>Transaction approvals</h2>
                </div>
            </div>

            <div className="card warning-card">
                <ShieldAlert size={24} />
                <div>
                    <strong>Human approval required, by design</strong>
                    <p>
                        Proposals can be created automatically, but nothing executes
                        without your MFA-verified approval. Caps and the kill switch
                        are enforced in the database, not in this page.
                    </p>
                </div>
            </div>

            {message && <div className="card wallet-message">{message}</div>}

            {!settings ? (
                <div className="card">
                    <div className="section-title">
                        <div>
                            <h3>Wallet is not initialized</h3>
                            <p>
                                Create your settings row (kill switch starts OFF, caps at
                                their defaults).
                            </p>
                        </div>

                        <button className="button primary" onClick={ensureSettings}>
                            <ShieldCheck size={16} />
                            Initialize
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="section-title">
                        <div>
                            <h3>Controls</h3>
                            <p>
                                Per-transaction {cents(settings.per_tx_cap_cents)} · daily{" "}
                                {cents(settings.daily_cap_cents)} · monthly{" "}
                                {cents(settings.monthly_cap_cents)} · approvals expire in{" "}
                                {Math.round(settings.approval_ttl_seconds / 60)} min · MFA:{" "}
                                {mfaLevel === "aal2" ? "verified" : "not verified"}
                            </p>
                        </div>

                        <button
                            className={`button ${settings.enabled ? "danger" : "primary"}`}
                            onClick={toggleKillSwitch}
                        >
                            <Power size={16} />
                            {settings.enabled ? "Disable wallet" : "Enable wallet"}
                        </button>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="section-title">
                    <div>
                        <h3>Proposals</h3>
                        <p>Newest first. Approve executes immediately after MFA check.</p>
                    </div>
                </div>

                {proposals.length ? (
                    <div className="document-list">
                        {proposals.map((proposal) => {
                            const recipient = recipients[proposal.recipient_id];

                            return (
                                <div className="document-row" key={proposal.id}>
                                    <div className="document-copy">
                                        <strong>
                                            {cents(proposal.amount_cents)} →{" "}
                                            {recipient?.label || "Unknown recipient"}
                                        </strong>
                                        <small>
                                            {proposal.purpose} ·{" "}
                                            <span className={`pill ${statusTone[proposal.status] || ""}`}>
                                                {proposal.status.replace("_", " ")}
                                            </span>
                                        </small>
                                    </div>

                                    {proposal.status === "pending_review" && (
                                        <>
                                            <button
                                                className="button primary"
                                                disabled={busyId === proposal.id}
                                                onClick={() => approveAndExecute(proposal)}
                                            >
                                                {busyId === proposal.id ? (
                                                    <Loader2 size={15} className="spin" />
                                                ) : (
                                                    <BadgeCheck size={15} />
                                                )}
                                                Approve
                                            </button>

                                            <button
                                                className="button secondary"
                                                disabled={busyId === proposal.id}
                                                onClick={() => reject(proposal)}
                                            >
                                                <CircleSlash size={15} />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="empty-note">No proposals yet.</p>
                )}
            </div>

            <div className="card">
                <div className="section-title">
                    <div>
                        <h3>Signed receipts</h3>
                        <p>Written server-side after settlement; HMAC-signed.</p>
                    </div>
                </div>

                {receipts.length ? (
                    <div className="document-list">
                        {receipts.map((receipt) => (
                            <div className="document-row" key={receipt.id}>
                                <div className="document-icon">
                                    <ReceiptText size={18} />
                                </div>

                                <div className="document-copy">
                                    <strong>
                                        {cents(receipt.amount_cents)} · {receipt.provider}
                                    </strong>
                                    <small>
                                        {receipt.provider_tx_ref} ·{" "}
                                        {new Date(receipt.created_at).toLocaleString()}
                                    </small>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="empty-note">No receipts yet.</p>
                )}
            </div>
        </div>
    );
}
