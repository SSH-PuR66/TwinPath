import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// Minimal functional inbox for agent proposals. Reads under RLS; decisions
// go through the decide_agent_proposal RPC, which enforces household
// membership and flips the linked feature flag on approval.
// Visual polish intentionally left to the design pass.
export default function ProposalsPanel({ householdId, onFlagsChanged }) {
    const [proposals, setProposals] = useState([]);
    const [busyId, setBusyId] = useState("");
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        if (!householdId) return;
        const { data, error: readError } = await supabase
            .from("agent_proposals")
            .select(
                "id,kind,title,rationale,flag_key,status,origin,created_at"
            )
            .eq("household_id", householdId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(20);
        if (readError) {
            setError(readError.message);
            return;
        }
        setProposals(Array.isArray(data) ? data : []);
    }, [householdId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    async function decide(proposalId, decision) {
        setBusyId(proposalId);
        setError("");
        const { error: rpcError } = await supabase.rpc(
            "decide_agent_proposal",
            {
                p_proposal_id: proposalId,
                p_decision: decision,
                p_note: null,
            }
        );
        setBusyId("");
        if (rpcError) {
            setError(rpcError.message);
            return;
        }
        await refresh();
        if (decision === "approved" && typeof onFlagsChanged === "function") {
            onFlagsChanged();
        }
    }

    if (!householdId) return null;

    return (
        <section aria-label="Pending proposals">
            <h3>Proposals</h3>
            {error ? <p role="alert">{error}</p> : null}
            {proposals.length === 0 ? (
                <p>No pending proposals.</p>
            ) : (
                <ul>
                    {proposals.map((proposal) => (
                        <li key={proposal.id}>
                            <strong>{proposal.title}</strong>{" "}
                            <em>({proposal.kind})</em>
                            <p>{proposal.rationale}</p>
                            {proposal.flag_key ? (
                                <p>
                                    Activates flag:{" "}
                                    <code>{proposal.flag_key}</code>
                                </p>
                            ) : null}
                            <button
                                type="button"
                                disabled={busyId === proposal.id}
                                onClick={() =>
                                    decide(proposal.id, "approved")
                                }
                            >
                                Approve
                            </button>
                            <button
                                type="button"
                                disabled={busyId === proposal.id}
                                onClick={() =>
                                    decide(proposal.id, "rejected")
                                }
                            >
                                Reject
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
