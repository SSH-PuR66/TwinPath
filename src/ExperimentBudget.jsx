import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bot,
    Check,
    CircleDollarSign,
    ExternalLink,
    Loader2,
    RefreshCw,
    ShieldCheck,
    WalletCards,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import { safeExternalUrl } from "./safeUrl";

// Mirror of the server-side cap enforced in review_spend_proposal().
// The database is the real gate; this is advisory UX only.
const PER_PROPOSAL_CAP = 5;

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

function safeAmount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export default function ExperimentBudget({
    householdId,
    currentUserId,
    privateMode = false,
}) {
    const [budget, setBudget] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [limitInput, setLimitInput] = useState("15");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadData = useCallback(async () => {
        if (!householdId || !currentUserId) return;

        setLoading(true);
        setError("");

        const [budgetResult, proposalsResult] = await Promise.all([
            supabase
                .from("experiment_budgets")
                .select("*")
                .eq("household_id", householdId)
                .eq("owner_user_id", currentUserId)
                .maybeSingle(),

            supabase
                .from("spend_proposals")
                .select("*")
                .eq("household_id", householdId)
                .eq("owner_user_id", currentUserId)
                .order("created_at", { ascending: false }),
        ]);

        if (budgetResult.error) {
            setError(budgetResult.error.message);
        }

        if (proposalsResult.error) {
          const missingTable =
            proposalsResult.error.message
              ?.toLowerCase()
              .includes("spend_proposals") &&
            proposalsResult.error.message
              ?.toLowerCase()
              .includes("schema cache");

          setError(
            missingTable
              ? "The Opportunity Lab database migration has not been applied yet. Run supabase/v5-opportunity-lab.sql."
              : proposalsResult.error.message
          );
        }

        setBudget(budgetResult.data || null);
        setLimitInput(
            String(budgetResult.data?.limit_amount ?? 15)
        );
        setProposals(
          Array.isArray(proposalsResult.data)
            ? proposalsResult.data
            : []
        );

        setLoading(false);
    }, [householdId, currentUserId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totals = useMemo(() => {
        const limit = safeAmount(
            budget?.limit_amount ?? limitInput
        );

        const purchased = proposals
            .filter((item) => item.status === "purchased")
            .reduce(
                (total, item) => total + safeAmount(item.amount),
                0
            );

        const approved = proposals
            .filter((item) => item.status === "approved")
            .reduce(
                (total, item) => total + safeAmount(item.amount),
                0
            );

        const pending = proposals
            .filter((item) => item.status === "pending")
            .reduce(
                (total, item) => total + safeAmount(item.amount),
                0
            );

        return {
            limit,
            purchased,
            approved,
            pending,
            remaining: Math.max(0, limit - purchased),
            availableAfterApproved: Math.max(
                0,
                limit - purchased - approved
            ),
        };
    }, [budget, limitInput, proposals]);

    const showMoney = (value) =>
        privateMode ? "••••" : currency.format(value);

    async function saveBudget(event) {
        event.preventDefault();

        const requestedLimit = safeAmount(limitInput);

        if (requestedLimit > 25) {
            setError("The experiment budget cannot exceed \$25.");
            return;
        }

        if (requestedLimit < totals.purchased) {
            setError(
                "The limit cannot be lower than money already marked as purchased."
            );
            return;
        }

        setSaving(true);
        setError("");

        const { error: saveError } = await supabase
            .from("experiment_budgets")
            .upsert(
                {
                    household_id: householdId,
                    owner_user_id: currentUserId,
                    visibility: "private",
                    name: "AI experiment budget",
                    limit_amount: requestedLimit,
                },
                {
                    onConflict: "household_id,owner_user_id",
                }
            );

        setSaving(false);

        if (saveError) {
            setError(saveError.message);
            return;
        }

        await loadData();
    }

    async function changeProposalStatus(proposal, status) {
        setError("");

        if (
            (status === "approved" || status === "purchased") &&
            safeAmount(proposal.amount) > PER_PROPOSAL_CAP
        ) {
            setError(
                `Individual proposals cannot exceed $${PER_PROPOSAL_CAP}.`
            );
            return;
        }

        if (
            (status === "approved" || status === "purchased") &&
            proposal.recurring
        ) {
            setError("Recurring purchases are not allowed.");
            return;
        }

        if (
            status === "approved" &&
            safeAmount(proposal.amount) >
            totals.availableAfterApproved
        ) {
            setError(
                "Approving this proposal would exceed the remaining budget."
            );
            return;
        }

        if (
            status === "purchased" &&
            safeAmount(proposal.amount) > totals.remaining
        ) {
            setError(
                "This purchase would exceed the experiment budget."
            );
            return;
        }

        const { error: updateError } = await supabase.rpc(
          "review_spend_proposal",
          {
            proposal_id: proposal.id,
            requested_status: status,
          }
        );

        if (updateError) {
            setError(updateError.message);
            return;
        }

        await loadData();
    }

    if (loading) {
        return (
            <section className="experiment-wallet loading-wallet">
                <Loader2 className="spin" size={24} />
                <span>Loading experiment budget…</span>
            </section>
        );
    }

    return (
        <section className="experiment-wallet">
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        AI EXPERIMENT BUDGET
                    </span>
                    <h3>Controlled opportunity funding</h3>
                    <p>
                        Claude may recommend actions. Only you can authorize
                        and complete a real purchase.
                    </p>
                </div>

                <Bot size={26} />
            </div>

            <form
                className="experiment-budget-form"
                onSubmit={saveBudget}
            >
                <label className="field">
                    <span>Total budget limit</span>

                    <div className="money-input">
                        <span>$</span>

                        <input
                            type="number"
                            min="0"
                            max="25"
                            step="1"
                            inputMode="decimal"
                            value={limitInput}
                            onChange={(event) =>
                                setLimitInput(event.target.value)
                            }
                        />
                    </div>
                </label>

                <button
                    className="button secondary"
                    type="submit"
                    disabled={saving}
                >
                    {saving ? (
                        <Loader2 className="spin" size={17} />
                    ) : (
                        <WalletCards size={17} />
                    )}

                    Save budget
                </button>
            </form>

            {error && (
                <div className="error-box" role="alert">
                    {error}
                </div>
            )}

            <div className="experiment-wallet-stats">
                <article>
                    <span>Limit</span>
                    <strong>{showMoney(totals.limit)}</strong>
                </article>

                <article>
                    <span>Purchased</span>
                    <strong>{showMoney(totals.purchased)}</strong>
                </article>

                <article>
                    <span>Approved</span>
                    <strong>{showMoney(totals.approved)}</strong>
                </article>

                <article>
                    <span>Remaining</span>
                    <strong>{showMoney(totals.remaining)}</strong>
                </article>
            </div>

            <div className="experiment-progress">
                <span
                    style={{
                        width: `${totals.limit > 0
                                ? Math.min(
                                    100,
                                    (totals.purchased / totals.limit) * 100
                                )
                                : 0
                            }%`,
                    }}
                />
            </div>

            <div className="experiment-proposals-header">
                <div>
                    <h4>Approval queue</h4>
                    <small>
                        Individual proposals remain capped at ${PER_PROPOSAL_CAP}.
                    </small>
                </div>

                <button
                    className="icon-button"
                    type="button"
                    onClick={loadData}
                    aria-label="Refresh proposals"
                >
                    <RefreshCw size={17} />
                </button>
            </div>

            {proposals.length ? (
                <div className="experiment-proposal-list">
                    {proposals.map((proposal) => (
                        <article
                            className="experiment-proposal-card"
                            key={proposal.id}
                        >
                            <div className="proposal-card-header">
                                <div>
                                    <span className={`pill ${proposal.status}`}>
                                        {proposal.status}
                                    </span>
                                    <h4>{proposal.title}</h4>
                                </div>

                                <strong>
                                    {showMoney(safeAmount(proposal.amount))}
                                </strong>
                            </div>

                            <p>{proposal.purpose}</p>

                            <dl>
                                <div>
                                    <dt>Provider</dt>
                                    <dd>{proposal.provider}</dd>
                                </div>

                                <div>
                                    <dt>Recurring</dt>
                                    <dd>
                                        {proposal.recurring ? "Rejected" : "No"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>Reversible</dt>
                                    <dd>
                                        {proposal.reversible ? "Yes" : "No"}
                                    </dd>
                                </div>
                            </dl>

                            {proposal.free_alternative && (
                                <div className="proposal-alternative">
                                    <strong>Free alternative</strong>
                                    <p>{proposal.free_alternative}</p>
                                </div>
                            )}

                            <div className="proposal-actions">
                                {safeExternalUrl(proposal.official_url) && (
                                <a
                                    className="button ghost"
                                    href={safeExternalUrl(proposal.official_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Verify provider
                                    <ExternalLink size={15} />
                                </a>
                                )}

                                {proposal.status === "pending" && (
                                    <>
                                        <button
                                            className="button secondary"
                                            type="button"
                                            onClick={() =>
                                                changeProposalStatus(
                                                    proposal,
                                                    "approved"
                                                )
                                            }
                                        >
                                            <Check size={16} />
                                            Approve
                                        </button>

                                        <button
                                            className="button danger"
                                            type="button"
                                            onClick={() =>
                                                changeProposalStatus(
                                                    proposal,
                                                    "rejected"
                                                )
                                            }
                                        >
                                            <X size={16} />
                                            Reject
                                        </button>
                                    </>
                                )}

                                {proposal.status === "approved" && (
                                    <button
                                        className="button secondary"
                                        type="button"
                                        onClick={() =>
                                            changeProposalStatus(
                                                proposal,
                                                "purchased"
                                            )
                                        }
                                    >
                                        <CircleDollarSign size={16} />
                                        Mark manually purchased
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="empty">
                    No spending proposals. Keeping the budget unspent is
                    a valid result.
                </div>
            )}

            <div className="warning-inline">
                <ShieldCheck size={18} />
                <span>
                    This ledger does not connect to a bank, card, PayPal,
                    Chime, brokerage, or cryptocurrency wallet.
                </span>
            </div>
        </section>
    );
}
