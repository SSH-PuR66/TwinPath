import { useCallback, useEffect, useState } from "react";
import { Bot, Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
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
    memberTrack = "household",
}) {
    const { request, configured } = useControlPlane(householdId);
    const [proposals, setProposals] = useState([]);
    const [busyId, setBusyId] = useState("");
    const [error, setError] = useState("");
    const [handoff, setHandoff] = useState(null);
    const [transferComplete, setTransferComplete] = useState(false);

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
            onToast?.(decision === "approved" ? proposal.payload?.source === "deposit_watch" ? `🎉 Deposit plan approved for $${Number(proposal.payload.amount || 0).toLocaleString()}. You make the transfers when ready.` : "Proposal approved. Your plan is updated." : "Proposal declined. Nothing else changed.");
            if (decision === "approved" && proposal.payload?.source === "deposit_watch") {
                setHandoff(proposal);
                setTransferComplete(false);
            }
            if (decision === "approved") await onFlagsChanged?.();
            await refresh();
        } catch (decisionError) {
            setError(decisionError.message);
        } finally {
            setBusyId("");
        }
    }

    const steps = Array.isArray(handoff?.payload?.steps) ? handoff.payload.steps : [];
    const amounts = steps.map((step) => `${step.bucket}: $${Number(step.amount || 0).toFixed(2)}`).join("\n") || `$${Number(handoff?.payload?.amount || 0).toFixed(2)} transfer plan`;
    async function copyAmounts() {
        try { await navigator.clipboard.writeText(amounts); onToast?.("Transfer amounts copied."); }
        catch { setError("Copy is unavailable here—use the amounts shown below."); }
    }
    function openChime() {
        window.location.assign("chime://");
        window.setTimeout(() => { if (!document.hidden) window.location.assign("https://app.chime.com"); }, 700);
    }
    async function saveTransferCheck(checked) {
        if (!handoff) return;
        setTransferComplete(checked);
        try {
            await request(`/v1/proposals/${encodeURIComponent(handoff.id)}/transfer-complete`, { method: "PATCH", body: JSON.stringify({ completed: checked }) });
        } catch (saveError) { setTransferComplete(!checked); setError(saveError.message); }
    }

    if (!householdId || !configured) return null;
    const visibleProposals = [...proposals]
        .filter((proposal) => ["household", memberTrack].includes(proposal.track || "household"))
        .sort((a, b) => Number((b.track || "household") === memberTrack) - Number((a.track || "household") === memberTrack));
    const pendingCount = visibleProposals.length;

    return (
        <section className={`proposals-panel ${pendingCount ? "has-pending" : "is-clear"}`} aria-label="Pending proposals">
            <header className="proposals-heading">
                <span className="proposal-avatar"><Bot size={18} /></span>
                <div>
                    <span className="eyebrow">CONFIRM OR CONTINUE</span>
                    <h3>{pendingCount ? `${pendingCount} decision${pendingCount === 1 ? "" : "s"} ready for you` : "You are all caught up"}</h3>
                    <p>{pendingCount ? "Review the plan, keep what helps, and make every transfer yourself." : "TwinPath will surface the next useful choice here—nothing happens without your say-so."}</p>
                </div>
            </header>
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {visibleProposals.length === 0 ? (
                <div className="proposal-empty">No approvals waiting. When a new deposit or useful change needs your call, it will appear here live.</div>
            ) : (
                <div className="proposal-list">
                    {visibleProposals.map((proposal) => (
                        <article className="proposal-card" key={proposal.id}>
                            <div className="proposal-card-top">
                                <span className="pill blue">{labels[proposal.kind] || "Suggestion"}</span><span className="track-chip">{proposal.track || "household"}</span>
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
            {handoff ? <div className="benefit-drawer-backdrop" onMouseDown={() => setHandoff(null)}><aside className="benefit-drawer handoff-sheet" onMouseDown={(event) => event.stopPropagation()} aria-label="Complete approved transfers in Chime"><header><div><span className="eyebrow">APPROVED · YOUR NEXT TAPS</span><h2>Complete this in Chime</h2></div><button className="icon-button" type="button" onClick={() => setHandoff(null)} aria-label="Close"><X size={19} /></button></header><p>TwinPath never moves money. Open Chime and make each transfer yourself.</p><ol className="handoff-steps">{steps.length ? steps.map((step, index) => <li key={`${step.bucket}-${index}`}><strong>${Number(step.amount || 0).toFixed(2)} → {String(step.bucket || "your chosen bucket").replaceAll("_", " ")}</strong><small>{step.why}</small></li>) : <li><strong>{amounts}</strong></li>}</ol><div className="proposal-actions"><button className="button primary" type="button" onClick={openChime}><ExternalLink size={16} /> Complete in Chime</button><button className="button secondary" type="button" onClick={copyAmounts}><Copy size={16} /> Copy amounts</button></div><label className="toggle-row"><span><strong>I completed the transfers myself</strong><small>This only records your self-check; it never verifies or initiates a bank action.</small></span><input type="checkbox" checked={transferComplete} onChange={(event) => saveTransferCheck(event.target.checked)} /></label></aside></div> : null}
        </section>
    );
}
