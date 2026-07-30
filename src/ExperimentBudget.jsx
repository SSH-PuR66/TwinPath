import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Check,
    CircleDollarSign,
    ExternalLink,
    Landmark,
    Loader2,
    Plus,
    RefreshCw,
    ShieldCheck,
    WalletCards,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import { safeExternalUrl } from "./safeUrl";
import DisclosureSection from "./DisclosureSection";

// Mirror of the server-side cap enforced in review_spend_proposal().
// The database is the real gate; this is advisory UX only.
const PER_PROPOSAL_CAP = 5;

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const emptyProposal = {
    title: "",
    provider: "",
    officialUrl: "",
    amount: "",
    purpose: "",
    expectedBenefit: "",
    freeAlternative: "",
    reversible: false,
};

function safeAmount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export default function ExperimentBudget({
    householdId,
    currentUserId,
    privateMode = false,
    onOpenConnections,
}) {
    const [budget, setBudget] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [limitInput, setLimitInput] = useState("15");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creatingProposal, setCreatingProposal] = useState(false);
    const [reviewingProposalId, setReviewingProposalId] = useState("");
    const [proposalForm, setProposalForm] = useState(emptyProposal);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [showAllProposals, setShowAllProposals] = useState(false);
    const loadRequestRef = useRef(0);

    const loadData = useCallback(async () => {
        if (!householdId || !currentUserId) return;

        const requestId = ++loadRequestRef.current;

        setLoading(true);
        setError("");

        let budgetResult;
        let proposalsResult;

        try {
            [budgetResult, proposalsResult] = await Promise.all([
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
        } catch (loadError) {
            if (requestId !== loadRequestRef.current) return;
            setError(loadError.message || "The approval wallet could not be loaded.");
            setLoading(false);
            return;
        }

        if (requestId !== loadRequestRef.current) return;

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

        return () => {
            loadRequestRef.current += 1;
        };
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
        setNotice("");

        try {
            const { error: saveError } = await supabase
                .from("experiment_budgets")
                .upsert(
                    {
                        household_id: householdId,
                        owner_user_id: currentUserId,
                        visibility: "private",
                        name: "Approval wallet budget",
                        limit_amount: requestedLimit,
                    },
                    {
                        onConflict: "household_id,owner_user_id",
                    }
                );

            if (saveError) throw saveError;

            setNotice("Budget guardrail saved.");
            await loadData();
        } catch (saveError) {
            setError(saveError.message || "The budget could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    async function createProposal(event) {
        event.preventDefault();

        const amount = safeAmount(proposalForm.amount);
        const requiredText = [
            ["title", "Add a short proposal title."],
            ["provider", "Add the provider name."],
            ["purpose", "Explain what the purchase is for."],
            ["expectedBenefit", "Describe the expected benefit."],
        ];
        const missingField = requiredText.find(
            ([key]) => !proposalForm[key].trim()
        );
        const officialUrl = safeExternalUrl(proposalForm.officialUrl, {
            allowLocalHttp: false,
        });

        if (missingField) {
            setError(missingField[1]);
            return;
        }

        if (!officialUrl) {
            setError("Enter the provider's official HTTPS URL.");
            return;
        }

        if (amount <= 0 || amount > PER_PROPOSAL_CAP) {
            setError(`Proposal amounts must be between $0.01 and $${PER_PROPOSAL_CAP}.`);
            return;
        }

        setCreatingProposal(true);
        setError("");
        setNotice("");

        try {
            const { error: proposalError } = await supabase
                .from("spend_proposals")
                .insert({
                    household_id: householdId,
                    owner_user_id: currentUserId,
                    visibility: "private",
                    title: proposalForm.title.trim(),
                    provider: proposalForm.provider.trim(),
                    official_url: officialUrl,
                    amount,
                    purpose: proposalForm.purpose.trim(),
                    expected_benefit: proposalForm.expectedBenefit.trim(),
                    free_alternative:
                        proposalForm.freeAlternative.trim() || null,
                    recurring: false,
                    reversible: proposalForm.reversible,
                    status: "pending",
                });

            if (proposalError) throw proposalError;

            setProposalForm(emptyProposal);
            setNotice("Proposal added to the approval queue. No charge was made.");
            await loadData();
        } catch (proposalError) {
            setError(
                proposalError.message || "The spending proposal could not be created."
            );
        } finally {
            setCreatingProposal(false);
        }
    }

    async function changeProposalStatus(proposal, status) {
        if (reviewingProposalId) return;

        setError("");
        setNotice("");

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

        setReviewingProposalId(proposal.id);

        try {
            const { error: updateError } = await supabase.rpc(
                "review_spend_proposal",
                {
                    proposal_id: proposal.id,
                    requested_status: status,
                }
            );

            if (updateError) throw updateError;

            setNotice(
                status === "purchased"
                    ? "Purchase recorded manually. TwinPath did not move money."
                    : `Proposal ${status}.`
            );
            await loadData();
        } catch (updateError) {
            setError(updateError.message || "The proposal could not be updated.");
        } finally {
            setReviewingProposalId("");
        }
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
                    <span className="eyebrow">APPROVAL WALLET</span>
                    <h3>Approve first. Purchase yourself.</h3>
                    <p>
                        Set a private guardrail, review each proposal, then
                        complete approved purchases directly with the provider.
                    </p>
                </div>

                <WalletCards size={26} />
            </div>

            <DisclosureSection id="experiment-budget-summary" title="Budget summary" hint="Limit, totals, and spending guardrail">
            <div className="wallet-safety-strip">
                <ShieldCheck size={19} />
                <div>
                    <strong>A decision ledger, not a payment account</strong>
                    <span>
                        TwinPath never stores payment credentials or moves money.
                        Plaid connections remain read-only and separate.
                    </span>
                </div>
                {onOpenConnections && (
                    <button
                        className="button ghost"
                        type="button"
                        onClick={onOpenConnections}
                    >
                        <Landmark size={16} />
                        Open connections
                    </button>
                )}
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

            {notice && (
                <div className="success-box" role="status">
                    {notice}
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
                    <span>Pending</span>
                    <strong>{showMoney(totals.pending)}</strong>
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

            </DisclosureSection>

            <DisclosureSection id="experiment-budget-proposals" title="Purchase proposals" hint="Review requests before buying" collapseOnPhone>
            <form className="wallet-proposal-form" onSubmit={createProposal}>
                <div className="wallet-proposal-heading">
                    <div>
                        <span className="eyebrow">NEW PROPOSAL</span>
                        <h4>Add a purchase for review</h4>
                        <small>
                            One-time purchases only, capped at ${PER_PROPOSAL_CAP}.
                            Adding a proposal never creates a charge.
                        </small>
                    </div>
                    <Plus size={22} />
                </div>

                <div className="wallet-proposal-grid">
                    <label className="field">
                        <span>Title</span>
                        <input
                            required
                            maxLength={180}
                            value={proposalForm.title}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                title: event.target.value,
                            }))}
                            placeholder="Example: Domain for portfolio"
                        />
                    </label>

                    <label className="field">
                        <span>Provider</span>
                        <input
                            required
                            maxLength={180}
                            value={proposalForm.provider}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                provider: event.target.value,
                            }))}
                            placeholder="Provider name"
                        />
                    </label>

                    <label className="field">
                        <span>Official provider URL</span>
                        <input
                            required
                            type="url"
                            inputMode="url"
                            maxLength={1000}
                            value={proposalForm.officialUrl}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                officialUrl: event.target.value,
                            }))}
                            placeholder="https://provider.example"
                        />
                    </label>

                    <label className="field">
                        <span>Amount</span>
                        <div className="money-input">
                            <span>$</span>
                            <input
                                required
                                type="number"
                                min="0.01"
                                max={PER_PROPOSAL_CAP}
                                step="0.01"
                                inputMode="decimal"
                                value={proposalForm.amount}
                                onChange={(event) => setProposalForm((current) => ({
                                    ...current,
                                    amount: event.target.value,
                                }))}
                                placeholder="0.00"
                            />
                        </div>
                    </label>

                    <label className="field wallet-proposal-wide">
                        <span>Purpose</span>
                        <textarea
                            required
                            maxLength={2000}
                            rows={3}
                            value={proposalForm.purpose}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                purpose: event.target.value,
                            }))}
                            placeholder="What will this purchase enable?"
                        />
                    </label>

                    <label className="field">
                        <span>Expected benefit</span>
                        <textarea
                            required
                            maxLength={2000}
                            rows={3}
                            value={proposalForm.expectedBenefit}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                expectedBenefit: event.target.value,
                            }))}
                            placeholder="What result would make this worthwhile?"
                        />
                    </label>

                    <label className="field">
                        <span>Free alternative (optional)</span>
                        <textarea
                            maxLength={2000}
                            rows={3}
                            value={proposalForm.freeAlternative}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                freeAlternative: event.target.value,
                            }))}
                            placeholder="What no-cost option did you consider?"
                        />
                    </label>
                </div>

                <div className="wallet-proposal-footer">
                    <label className="wallet-checkbox">
                        <input
                            type="checkbox"
                            checked={proposalForm.reversible}
                            onChange={(event) => setProposalForm((current) => ({
                                ...current,
                                reversible: event.target.checked,
                            }))}
                        />
                        <span>This purchase can be reversed or refunded</span>
                    </label>

                    <button
                        className="button primary"
                        type="submit"
                        disabled={creatingProposal || Boolean(reviewingProposalId)}
                    >
                        {creatingProposal ? (
                            <Loader2 className="spin" size={17} />
                        ) : (
                            <Plus size={17} />
                        )}
                        Add for review
                    </button>
                </div>
            </form>

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
                    disabled={Boolean(reviewingProposalId) || creatingProposal}
                    aria-label="Refresh proposals"
                >
                    <RefreshCw size={17} />
                </button>
            </div>

            {proposals.length ? (
                <div className="experiment-proposal-list">
                    {(showAllProposals ? proposals : proposals.slice(0, 8)).map((proposal) => {
                        const providerUrl = safeExternalUrl(
                            proposal.official_url
                        );
                        const isReviewing = reviewingProposalId === proposal.id;

                        return (
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

                                <div className="proposal-benefit">
                                    <strong>Expected benefit</strong>
                                    <p>{proposal.expected_benefit}</p>
                                </div>

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
                                    {providerUrl && (
                                        <a
                                            className="button ghost"
                                            href={providerUrl}
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
                                                 disabled={Boolean(reviewingProposalId)}
                                                 onClick={() =>
                                                    changeProposalStatus(
                                                        proposal,
                                                        "approved"
                                                    )
                                                }
                                             >
                                                 {isReviewing ? (
                                                     <Loader2 className="spin" size={16} />
                                                 ) : (
                                                     <Check size={16} />
                                                 )}
                                                 Approve
                                            </button>

                                            <button
                                                 className="button danger"
                                                 type="button"
                                                 disabled={Boolean(reviewingProposalId)}
                                                onClick={() =>
                                                    changeProposalStatus(
                                                        proposal,
                                                        "rejected"
                                                    )
                                                }
                                             >
                                                 {isReviewing ? (
                                                     <Loader2 className="spin" size={16} />
                                                 ) : (
                                                     <X size={16} />
                                                 )}
                                                 Reject
                                            </button>
                                        </>
                                    )}

                                {proposal.status === "approved" && (
                                    <button
                                         className="button secondary"
                                         type="button"
                                         disabled={Boolean(reviewingProposalId)}
                                        onClick={() =>
                                            changeProposalStatus(
                                                proposal,
                                                "purchased"
                                            )
                                        }
                                     >
                                         {isReviewing ? (
                                             <Loader2 className="spin" size={16} />
                                         ) : (
                                             <CircleDollarSign size={16} />
                                         )}
                                         Mark manually purchased
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
                </div>
            ) : (
                <div className="empty">
                    No spending proposals. Keeping the budget unspent is
                    a valid result.
                </div>
            )}
            {proposals.length > 8 && !showAllProposals ? (
                <button className="button secondary" type="button" onClick={() => setShowAllProposals(true)}>
                    Show all {proposals.length}
                </button>
            ) : null}

            <div className="warning-inline">
                <ShieldCheck size={18} />
                <span>
                    This ledger does not connect to a bank, card, PayPal,
                    Chime, brokerage, or cryptocurrency wallet.
                </span>
            </div>
            </DisclosureSection>
        </section>
    );
}
