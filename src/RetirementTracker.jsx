import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { useControlPlane } from "./useControlPlane";

// IRS 2026 IRA contribution limit: https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits
const ANNUAL_LIMIT = 7_500;
const TAX_YEAR = 2026;
const fidelityBirthRuleUrl = "https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/ira-supplemental.pdf";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function dateLabel(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unknown";
}

export default function RetirementTracker({ householdId, privateMode, dueDate }) {
    const { request, configured } = useControlPlane(householdId);
    const [accounts, setAccounts] = useState([]);
    const [error, setError] = useState("");
    const load = useCallback(async () => {
        if (!configured) return;
        try {
            const result = await request("/v1/retirement/accounts");
            setAccounts(Array.isArray(result?.accounts) ? result.accounts : []);
            setError("");
        } catch (loadError) {
            setError(loadError.message);
        }
    }, [configured, request]);

    useEffect(() => { load(); }, [load]);

    const currentAccounts = useMemo(() => accounts.filter((account) => Number(account.tax_year) === TAX_YEAR), [accounts]);
    const shownMoney = (value) => privateMode ? "••••" : currency.format(Number(value) || 0);

    return <section className="retirement-tracker" aria-labelledby="retirement-title">
        <header className="retirement-heading"><div><span className="eyebrow">MANUAL CONTRIBUTION TRACKER</span><h3 id="retirement-title">Retirement</h3><p>Balances and contribution limits entered by hand. No brokerage connection, market data, or trading tools.</p></div><Landmark size={23} aria-hidden="true" /></header>
        {error ? <div className="error-box" role="alert">{error}</div> : null}
        {currentAccounts.length ? <div className="retirement-account-list">{currentAccounts.map((account) => {
            const earnedIncome = Number(account.earned_income_ytd) || 0;
            const contributions = Number(account.contributions_ytd) || 0;
            const cap = Math.min(earnedIncome, ANNUAL_LIMIT);
            const room = Math.max(0, cap - contributions);
            const earnedIncomeBinds = earnedIncome < ANNUAL_LIMIT;
            return <article className="retirement-account" key={account.id}>
                <div className="retirement-account-name"><strong>{account.nickname}</strong><small>{account.institution || "Manual account"} · Updated {dateLabel(account.updated_at)}</small></div>
                <dl><div><dt>Account value</dt><dd>{shownMoney(account.current_value)}</dd></div><div><dt>Contribution room</dt><dd>{shownMoney(room)}</dd></div><div><dt>Window closes</dt><dd>April 15, 2027</dd></div></dl>
                <p className="retirement-limit">Your limit this year is {shownMoney(cap)} — {earnedIncomeBinds ? `that is your earned income so far, which is below the ${shownMoney(ANNUAL_LIMIT)} annual cap.` : `the ${shownMoney(ANNUAL_LIMIT)} annual cap.`}</p>
            </article>;
        })}</div> : <p className="retirement-empty">No retirement account is recorded for {TAX_YEAR}.</p>}
        <p className="retirement-birth-rule">Qualified birth or adoption distributions can be up to $5,000 per parent within one year of birth; income tax still applies, but the 10% early-withdrawal penalty does not. Twins’ due date: {dateLabel(dueDate)}. <a href={fidelityBirthRuleUrl} target="_blank" rel="noopener noreferrer">Fidelity details</a>. Confirm whether twins count separately with Fidelity, the plan administrator, and a tax professional.</p>
    </section>;
}
