import { useEffect, useMemo, useState } from "react";
import {
    ArrowUpRight,
    Calculator,
    CheckCircle2,
    CircleDollarSign,
    ShieldCheck,
    SlidersHorizontal,
} from "lucide-react";
import { AnimatedMoney } from "./AnimatedMoney";
import { financialRoutes } from "./financialRoutes";
import { opportunityCatalog } from "./opportunityCatalog";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";

const confidencePoints = { high: 30, medium: 20, low: 8, unknown: 12 };
const effortPoints = { low: 25, medium: 16, high: 7 };

function bounded(value, max = 100000000) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(max, number)) : 0;
}

function speedPoints(value = "") {
    const text = String(value).toLowerCase();
    if (text.includes("same day") || text.includes("immediate")) return 25;
    if (text.includes("week")) return 18;
    if (text.includes("month")) return 12;
    if (text.includes("long") || text.includes("unpredictable")) return 5;
    return 10;
}

function normalizeRoute(route, source, index) {
    const type = route.type || route.valueType || (
        String(route.category).toLowerCase().includes("expense")
            ? "expense-reduction"
            : "earned-income"
    );
    const confidence = route.confidence || route.likelihood || "unknown";
    const effort = route.effort || (route.startupCost > 50 ? "high" : "medium");
    const speed = route.speed || "Varies";
    const costPenalty = Math.min(20, bounded(route.startupCost, 10000) / 10);
    const score = Math.round(
        (confidencePoints[confidence] || confidencePoints.unknown) +
        (effortPoints[effort] || effortPoints.medium) +
        speedPoints(speed) +
        (route.carRequired ? 2 : 12) -
        costPenalty
    );

    return {
        ...route,
        id: `${source}-${route.id || index}`,
        source,
        type,
        confidence,
        effort,
        speed,
        score: Math.max(0, Math.min(100, score)),
        url: safeExternalUrl(route.url || route.officialUrl, {
            allowLocalHttp: false,
        }),
        note: route.reportingNote || route.warning,
    };
}

export default function ProfitabilityWorkspace({
    householdId,
    currentUserId,
    transactions = [],
    privateMode = false,
    reducedMotion = false,
    onLogTransaction,
    onTrackRoute,
}) {
    const [goal, setGoal] = useState(1000000);
    const [startingCapital, setStartingCapital] = useState(0);
    const [months, setMonths] = useState(12);
    const [routeType, setRouteType] = useState("all");
    const [sortBy, setSortBy] = useState("score");
    const [reductions, setReductions] = useState([
        { id: "subscriptions", label: "Cancelled subscriptions", amount: 0, verified: false },
        { id: "discounts", label: "Other confirmed discounts", amount: 0, verified: false },
        { id: "benefits", label: "Approved recurring assistance", amount: 0, verified: false },
    ]);
    const [trackedPerkSavings, setTrackedPerkSavings] = useState(0);

    useEffect(() => {
        if (!householdId || !currentUserId) return;
        let active = true;
        supabase
            .from("student_perk_tracking")
            .select("monthly_savings")
            .eq("household_id", householdId)
            .eq("owner_user_id", currentUserId)
            .eq("status", "active")
            .then(({ data }) => {
                if (!active || !Array.isArray(data)) return;
                setTrackedPerkSavings(data.reduce(
                    (sum, item) => sum + bounded(item.monthly_savings, 100000),
                    0
                ));
            });
        return () => {
            active = false;
        };
    }, [currentUserId, householdId]);

    const cashflow = useMemo(() => {
        return transactions.reduce(
            (total, item) => {
                const amount = bounded(item.amount);
                if (item.kind === "income") total.income += amount;
                if (item.kind === "expense") total.expenses += amount;
                return total;
            },
            { income: 0, expenses: 0 }
        );
    }, [transactions]);

    const verifiedReduction = trackedPerkSavings + reductions
        .filter((item) => item.verified)
        .reduce((sum, item) => sum + bounded(item.amount, 1000000), 0);
    const verifiedNet = cashflow.income - cashflow.expenses + verifiedReduction;
    const currentMonthNet = useMemo(() => {
        const now = new Date();
        return transactions.reduce((total, item) => {
            const date = new Date(item.transaction_date || item.created_at || "");
            if (
                Number.isNaN(date.getTime()) ||
                date.getFullYear() !== now.getFullYear() ||
                date.getMonth() !== now.getMonth()
            ) {
                return total;
            }
            const amount = bounded(item.amount);
            return total + (item.kind === "income" ? amount : item.kind === "expense" ? -amount : 0);
        }, 0) + verifiedReduction;
    }, [transactions, verifiedReduction]);
    const currentProgress = Math.max(0, bounded(startingCapital) + verifiedNet);
    const remaining = Math.max(0, bounded(goal) - currentProgress);
    const monthlyTarget = remaining / Math.max(1, bounded(months, 120));
    const monthlyVariance = currentMonthNet - monthlyTarget;

    const routes = useMemo(() => {
        const combined = [
            ...financialRoutes.map((route, index) => normalizeRoute(route, "financial", index)),
            ...opportunityCatalog.map((route, index) => normalizeRoute(route, "catalog", index)),
        ];
        const unique = [...new Map(combined.map((route) => [
            `${route.title}-${route.type}`,
            route,
        ])).values()];
        const visible = routeType === "all"
            ? unique
            : unique.filter((route) => route.type === routeType);

        return visible.sort((a, b) => {
            if (sortBy === "speed") return speedPoints(b.speed) - speedPoints(a.speed);
            if (sortBy === "effort") return (effortPoints[b.effort] || 0) - (effortPoints[a.effort] || 0);
            if (sortBy === "confidence") return (confidencePoints[b.confidence] || 0) - (confidencePoints[a.confidence] || 0);
            if (sortBy === "type") return a.type.localeCompare(b.type);
            return b.score - a.score;
        });
    }, [routeType, sortBy]);

    return (
        <section className="profitability-workspace">
            <header className="profit-hero">
                <div>
                    <span className="eyebrow">PROFIT PLAN</span>
                    <h2>Build from what cleared.</h2>
                    <p>
                        Recorded cashflow and confirmed reductions stay separate from
                        scenarios. Expected payments, discounts, awards, and benefits are
                        excluded until received or approved.
                    </p>
                </div>
                <Calculator size={30} aria-hidden="true" />
            </header>

            <div className="profit-summary">
                {[
                    ["Recorded income", cashflow.income],
                    ["Recorded expenses", cashflow.expenses],
                    ["Verified reductions", verifiedReduction],
                    ["Evidence-based net", verifiedNet],
                ].map(([label, value]) => (
                    <article key={label}>
                        <span>{label}</span>
                        <strong>
                            <AnimatedMoney
                                value={value}
                                hidden={privateMode}
                                reducedMotion={reducedMotion}
                            />
                        </strong>
                    </article>
                ))}
            </div>

            <div className="profit-columns">
                <section className="profit-panel">
                    <div className="section-title">
                        <div>
                            <h3>Expense reductions</h3>
                            <p>Count only reductions confirmed on a bill or written approval.</p>
                        </div>
                        <CheckCircle2 size={22} />
                    </div>
                    <div className="reduction-list">
                        {reductions.map((item) => (
                            <div className="reduction-row" key={item.id}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={item.verified}
                                        onChange={(event) => setReductions((current) =>
                                            current.map((entry) => entry.id === item.id
                                                ? { ...entry, verified: event.target.checked }
                                                : entry
                                            )
                                        )}
                                    />
                                    <span>{item.label}</span>
                                </label>
                                <div className="money-input">
                                    <span>$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        inputMode="decimal"
                                        aria-label={`${item.label} monthly amount`}
                                        value={item.amount}
                                        onChange={(event) => setReductions((current) =>
                                            current.map((entry) => entry.id === item.id
                                                ? { ...entry, amount: event.target.value }
                                                : entry
                                            )
                                        )}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="button secondary" type="button" onClick={onLogTransaction}>
                        <CircleDollarSign size={17} /> Log cleared cashflow
                    </button>
                </section>

                <section className="profit-panel goal-scenario">
                    <div className="section-title">
                        <div>
                            <span className="eyebrow">CONFIGURABLE SCENARIO</span>
                            <h3>One-year goal math</h3>
                        </div>
                        <SlidersHorizontal size={22} />
                    </div>
                    <div className="scenario-inputs">
                        <label className="field">
                            <span>Goal</span>
                            <input type="number" min="0" max="100000000" value={goal}
                                onChange={(event) => setGoal(event.target.value)} />
                        </label>
                        <label className="field">
                            <span>Starting capital</span>
                            <input type="number" min="0" max="100000000" value={startingCapital}
                                onChange={(event) => setStartingCapital(event.target.value)} />
                        </label>
                        <label className="field">
                            <span>Months</span>
                            <input type="number" min="1" max="120" value={months}
                                onChange={(event) => setMonths(event.target.value)} />
                        </label>
                    </div>
                    <div className="scenario-result">
                        <span>Required average per month</span>
                        <strong>
                            <AnimatedMoney value={monthlyTarget} hidden={privateMode} reducedMotion={reducedMotion} />
                        </strong>
                    </div>
                    <div className="scenario-result">
                        <span>Current-month pace variance</span>
                        <strong>
                            <AnimatedMoney value={monthlyVariance} hidden={privateMode} reducedMotion={reducedMotion} />
                        </strong>
                    </div>
                    <div className="grow-notice danger">
                        <ShieldCheck size={18} />
                        <span>
                            This is arithmetic, not a forecast or guarantee. A $1M one-year
                            goal is unusually difficult and may be unrealistic. No route,
                            discount, automation, investment, or business outcome is promised.
                        </span>
                    </div>
                </section>
            </div>

            <section className="profit-panel">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">PRIORITIZED ROUTES</span>
                        <h3>Compare effort, confidence, speed, and type</h3>
                    </div>
                </div>
                <div className="route-controls">
                    <label>
                        <span>Type</span>
                        <select value={routeType} onChange={(event) => setRouteType(event.target.value)}>
                            <option value="all">All</option>
                            <option value="earned-income">Earned income</option>
                            <option value="expense-reduction">Expense reduction</option>
                            <option value="education-aid">Education aid</option>
                            <option value="income-protection">Income protection</option>
                            <option value="asset-recovery">Asset recovery</option>
                        </select>
                    </label>
                    <label>
                        <span>Sort</span>
                        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                            <option value="score">Overall fit</option>
                            <option value="type">Type</option>
                            <option value="effort">Lowest effort</option>
                            <option value="confidence">Confidence</option>
                            <option value="speed">Speed</option>
                        </select>
                    </label>
                </div>
                <div className="profit-route-grid">
                    {routes.slice(0, 18).map((route) => (
                        <article className="profit-route-card" key={route.id}>
                            <div className="route-card-top">
                                <span className="pill blue">{route.type.replaceAll("-", " ")}</span>
                                <strong>{route.score}/100</strong>
                            </div>
                            <h3>{route.title}</h3>
                            <p>{route.description}</p>
                            <dl>
                                <div><dt>Effort</dt><dd>{route.effort}</dd></div>
                                <div><dt>Confidence</dt><dd>{route.confidence}</dd></div>
                                <div><dt>Speed</dt><dd>{route.speed}</dd></div>
                            </dl>
                            {route.note && <small>{route.note}</small>}
                            <div className="perk-actions">
                                {route.url && (
                                    <a className="button secondary" href={route.url}
                                        target="_blank" rel="noopener noreferrer">
                                        Official site <ArrowUpRight size={15} />
                                    </a>
                                )}
                                <button className="button ghost" type="button"
                                    onClick={() => onTrackRoute?.(route)}>
                                    Track
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </section>
    );
}
