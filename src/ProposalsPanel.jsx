import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Loader2, X } from "lucide-react";
import { useControlPlane } from "./useControlPlane";

const labels = {
    config: "Plan update",
    theme: "Theme",
    connector: "Connection",
    new_button: "New control",
    hidden_route: "New space",
    copy_change: "Copy update",
};

export default function ProposalsPanel({
    householdId,
    onFlagsChanged,
    onPendingCount,
    refreshKey = 0,
    onToast,
}) {
    const { request, configured } = useControlPlane(householdId);
    const [proposals, setProposals] = useState([]);
    const [busyId, setBusyId] = useState("");
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        if (!householdId || !configured) return;
        try {
            const payload = await request("/v1/proposals?status=pending");
            const pending = Array.isArray(payload.proposals) ? payload.proposals : [];
            setProposals(pending);
            onPendingCount?.(pending.length);
            setError("");
        } catch (readError) {
            setError(readError.message);
        }
    }, [configured, householdId, onPendingCount, request]);

    useEffect(() => { refresh(); }, [refresh, refreshKey]);

    async function decide(proposal, decision) {
        setBusyId(proposal.id);
        setError("");
        try {
            await request(`/v1/proposals/${encodeURIComponent(proposal.id)}/decision`, {
                method: "POST",
                body: JSON.stringify({ decision }),
            });
            onToast?.(decision === "approved" ? "Proposal approved. Your plan is updated." : "Proposal declined. Nothing else changed.");
            if (decision === "approved") await onFlagsChanged?.();
            await refresh();
        } catch (decisionError) {
            setError(decisionError.message);
        } finally {
            setBusyId("");
        }
    }

    if (!householdId || !configured) return null;

    return (
        <section className="proposals-panel" aria-label="Pending proposals">
            <header className="proposals-heading">
                <span className="proposal-avatar"><Bot size={18} /></span>
                <div>
                    <span className="eyebrow">CONFIRM OR CONTINUE</span>
                    <h3>Suggested next steps</h3>
                    <p>TwinPath can prepare a plan. You decide what changes and make every transfer.</p>
                </div>
            </header>
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {proposals.length === 0 ? (
                <div className="proposal-empty">No approvals are waiting. New deposit plans will appear here live.</div>
            ) : (
                <div className="proposal-list">
                    {proposals.map((proposal) => (
                        <article className="proposal-card" key={proposal.id}>
                            <div className="proposal-card-top">
                                <span className="pill blue">{labels[proposal.kind] || "Suggestion"}</span>
                                <small>{new Date(proposal.created_at).toLocaleDateString()}</small>
                            </div>
                            <h4>{proposal.title}</h4>
                            <p>{proposal.rationale}</p>
                            {proposal.flag_key ? <small>Enables: <code>{proposal.flag_key}</code></small> : null}
                            <div className="proposal-actions">
                                <button className="button primary" type="button" disabled={Boolean(busyId)} onClick={() => decide(proposal, "approved")}>
                                    {busyId === proposal.id ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Approve
                                </button>
                                <button className="button ghost" type="button" disabled={Boolean(busyId)} onClick={() => decide(proposal, "rejected")}>
                                    <X size={16} /> Not now
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
