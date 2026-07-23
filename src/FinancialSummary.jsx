import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { useControlPlane } from "./useControlPlane";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function FinancialSummary({ householdId, privateMode }) {
    const { request, configured } = useControlPlane(householdId);
    const [summary, setSummary] = useState(null);
    const [status, setStatus] = useState("loading");
    const [error, setError] = useState("");
    const refresh = useCallback(async () => {
        if (!configured) return;
        setStatus("loading");
        try { setSummary(await request("/v1/financial/summary")); setError(""); setStatus("ready"); }
        catch (loadError) { setError(loadError.message); setStatus("error"); }
    }, [configured, request]);

    useEffect(() => { refresh(); }, [refresh]);
    const maxMonthValue = useMemo(() => Math.max(1, ...(summary?.by_month || []).map((month) => Math.max(month.income, month.expense))), [summary]);
    const showMoney = (value) => privateMode ? "••••••" : money.format(Math.abs(Number(value) || 0));

    if (!configured) return null;
    if (status === "loading") return <section className="financial-summary financial-summary-loading" aria-label="Loading 90-day financial summary"><ChartNoAxesCombined size={23} /><div><span className="eyebrow">MONEY · LAST 90 DAYS</span><h2>Preparing your money picture…</h2><p>We are adding up the income and spending you have chosen to track.</p></div></section>;
    if (status === "error") return <section className="financial-summary" aria-label="Financial summary unavailable"><div><span className="eyebrow">MONEY · LAST 90 DAYS</span><h2>Your summary needs a quick retry.</h2><p>{error}</p></div><button className="button secondary" type="button" onClick={refresh}><RefreshCw size={16} /> Try again</button></section>;

    const net = Number(summary?.net) || 0;
    return <section className="financial-summary" aria-labelledby="financial-summary-title">
        <header><div><span className="eyebrow">MONEY · LAST 90 DAYS</span><h2 id="financial-summary-title">{net >= 0 ? "+" : "−"}{showMoney(net)} net</h2><p>{summary?.transaction_count ? "A clear view of what came in and what went out." : "Connect a bank or import a CSV — it takes about two minutes."}</p></div><ChartNoAxesCombined size={27} aria-hidden="true" /></header>
        <div className="financial-summary-split"><div><ArrowUpRight size={17} /><span>Income</span><strong>{showMoney(summary?.income)}</strong></div><div><ArrowDownRight size={17} /><span>Spent</span><strong>{showMoney(summary?.expense)}</strong></div></div>
        {summary?.transaction_count ? <><div className="financial-category-list"><strong>Top spending categories</strong>{(summary.top_expense_categories || []).slice(0, 3).map((item) => <div key={item.category}><span>{item.category}</span><b>{showMoney(item.total)}</b></div>)}</div>{summary.by_month?.length ? <div className="financial-month-bars" aria-label="Income and spending by month">{summary.by_month.map((month) => <div key={month.month}><div className="financial-bar-pair"><span className="income" style={{ height: `${Math.max(8, (month.income / maxMonthValue) * 100)}%` }} /><span className="expense" style={{ height: `${Math.max(8, (month.expense / maxMonthValue) * 100)}%` }} /></div><small>{new Date(`${month.month}-01T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</small></div>)}</div> : null}</> : null}
    </section>;
}
