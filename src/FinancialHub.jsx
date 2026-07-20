import { useEffect, useMemo, useState } from "react";
import {
    ArrowUpRight,
    Baby,
    Banknote,
    BriefcaseBusiness,
    Copy,
    ExternalLink,
    PiggyBank,
    ShieldCheck,
    TrendingUp,
    WalletCards,
} from "lucide-react";

import { financialRoutes } from "./financialRoutes";
import { safeExternalUrl } from "./safeUrl";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const likelihoodFactors = {
    high: 1,
    medium: 0.6,
    low: 0.25,
    unknown: 0.4,
};

function calculateAllocation(amount, reserveReady) {
    const safeAmount = Math.max(0, Number(amount) || 0);

    if (reserveReady) {
        return [
            {
                name: "Emergency reserve",
                amount: safeAmount * 0.4,
                icon: ShieldCheck,
                explanation:
                    "Continue strengthening liquid emergency savings.",
            },
            {
                name: "Baby and transportation",
                amount: safeAmount * 0.25,
                icon: Baby,
                explanation:
                    "Protect near-term family and transportation needs.",
            },
            {
                name: "Career growth",
                amount: safeAmount * 0.2,
                icon: BriefcaseBusiness,
                explanation:
                    "Use for a measured opportunity with a likely return.",
            },
            {
                name: "Long-term investing",
                amount: safeAmount * 0.15,
                icon: TrendingUp,
                explanation:
                    "Invest only if this money is not needed soon and you understand the risk.",
            },
        ];
    }

    return [
        {
            name: "Emergency reserve",
            amount: safeAmount * 0.6,
            icon: ShieldCheck,
            explanation:
                "Keep liquid for urgent transportation, food, healthcare or housing.",
        },
        {
            name: "Baby and transportation",
            amount: safeAmount * 0.3,
            icon: Baby,
            explanation:
                "Use for necessary family preparation and reliable transportation.",
        },
        {
            name: "Career growth",
            amount: safeAmount * 0.1,
            icon: BriefcaseBusiness,
            explanation:
                "Use only for a specific tool or action with a likely return.",
        },
    ];
}

function routeScore(route) {
    const likelihood =
        likelihoodFactors[route.likelihood] ??
        likelihoodFactors.unknown;

    const transportation = route.carRequired ? 0.25 : 1;
    const cost = route.startupCost > 50 ? 0.45 : 1;

    return Math.round(
        likelihood * transportation * cost * 100
    );
}

export default function FinancialHub({
    onLogTransaction,
    onAddOpportunity,
    privateMode = false,
}) {
    const [amount, setAmount] = useState("50");
    const [reserveReady, setReserveReady] = useState(false);
    const [category, setCategory] = useState("All");
    const [paypalHandle, setPaypalHandle] = useState(
        () => localStorage.getItem("twinpath-paypal-handle") || ""
    );
    const [copied, setCopied] = useState(false);

    const allocation = useMemo(
        () => calculateAllocation(amount, reserveReady),
        [amount, reserveReady]
    );

    const categories = useMemo(
        () => [
            "All",
            ...new Set(
                financialRoutes.map((route) => route.category)
            ),
        ],
        []
    );

    const visibleRoutes =
        category === "All"
            ? financialRoutes
            : financialRoutes.filter(
                (route) => route.category === category
            );

    useEffect(() => {
        const cleaned = paypalHandle
            .trim()
            .replace(/^@/, "")
            .replace(/[^a-zA-Z0-9._-]/g, "");

        if (cleaned) {
            localStorage.setItem(
                "twinpath-paypal-handle",
                cleaned
            );
        } else {
            localStorage.removeItem("twinpath-paypal-handle");
        }
    }, [paypalHandle]);

    const cleanedPayPalHandle = paypalHandle
        .trim()
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "");

    const paypalLink = cleanedPayPalHandle
        ? `https://www.paypal.me/${cleanedPayPalHandle}`
        : "";

    async function copyPayPalLink() {
        if (!paypalLink) return;

        await navigator.clipboard.writeText(paypalLink);
        setCopied(true);

        window.setTimeout(() => {
            setCopied(false);
        }, 1500);
    }

    return (
        <div className="financial-hub">
            <section className="money-planner">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">
                            SMALL-MONEY PLANNER
                        </span>
                        <h3>Give every dollar a job</h3>
                        <p>
                            This is a planning tool. It does not transfer
                            money automatically.
                        </p>
                    </div>

                    <PiggyBank size={25} />
                </div>

                <label className="field">
                    <span>Amount available</span>

                    <div className="money-input">
                        <span>$</span>

                        <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="decimal"
                            value={amount}
                            onChange={(event) =>
                                setAmount(event.target.value)
                            }
                        />
                    </div>
                </label>

                <label className="toggle-row planner-toggle">
                    <span>
                        <strong>Core reserve already funded</strong>
                        <small>
                            Turn this on only if your near-term emergency,
                            transportation, food and healthcare needs are covered.
                        </small>
                    </span>

                    <input
                        type="checkbox"
                        checked={reserveReady}
                        onChange={(event) =>
                            setReserveReady(event.target.checked)
                        }
                    />
                </label>

                <div className="allocation-cards">
                    {allocation.map((item) => {
                        const Icon = item.icon;

                        return (
                            <article
                                className="allocation-card"
                                key={item.name}
                            >
                                <div className="allocation-card-icon">
                                    <Icon size={19} />
                                </div>

                                <div>
                                    <span>{item.name}</span>
                                    <strong>
                                        {privateMode
                                            ? "••••"
                                            : currency.format(item.amount)}
                                    </strong>
                                    <p>{item.explanation}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="financial-action-row">
                    <button
                        className="button secondary"
                        type="button"
                        onClick={onLogTransaction}
                    >
                        <WalletCards size={17} />
                        Log money received or spent
                    </button>

                    <a
                        className="button secondary"
                        href="https://www.paypal.com/myaccount/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open PayPal
                        <ArrowUpRight size={16} />
                    </a>

                    <a
                        className="button secondary"
                        href="https://www.chime.com/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open Chime
                        <ArrowUpRight size={16} />
                    </a>
                </div>

                <div className="warning-inline">
                    <ShieldCheck size={18} />
                    <span>
                        Moving your own money between accounts is not
                        income or an expense. Record only actual income,
                        actual expenses and actual business profit in the
                        transaction ledger.
                    </span>
                </div>
            </section>

            <section className="paypal-link-builder">
                <div>
                    <span className="eyebrow">
                        OPTIONAL PAYMENT LINK
                    </span>
                    <h3>PayPal.me receiving link</h3>
                    <p>
                        Store only your public PayPal.me handle locally on
                        this device. TwinPath never stores your PayPal
                        password.
                    </p>
                </div>

                <label className="field">
                    <span>PayPal.me handle</span>

                    <input
                        value={paypalHandle}
                        placeholder="YourPublicHandle"
                        autoCapitalize="none"
                        autoCorrect="off"
                        onChange={(event) =>
                            setPaypalHandle(event.target.value)
                        }
                    />
                </label>

                {safeExternalUrl(paypalLink) && (
                    <div className="payment-link-preview">
                        <span>{safeExternalUrl(paypalLink)}</span>

                        <button
                            className="icon-button"
                            type="button"
                            onClick={copyPayPalLink}
                            aria-label="Copy PayPal link"
                        >
                            {copied ? "✓" : <Copy size={17} />}
                        </button>

                        <a
                            className="icon-button"
                            href={safeExternalUrl(paypalLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open PayPal link"
                        >
                            <ExternalLink size={17} />
                        </a>
                    </div>
                )}
            </section>

            <section className="route-explorer">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">
                            LEGITIMATE ROUTES
                        </span>
                        <h3>Opportunity and resource map</h3>
                        <p>
                            Potential routes only. Verify details through the
                            official organization.
                        </p>
                    </div>

                    <TrendingUp size={24} />
                </div>

                <div className="chip-row">
                    {categories.map((item) => (
                        <button
                            className={`chip ${category === item ? "active" : ""
                                }`}
                            type="button"
                            key={item}
                            onClick={() => setCategory(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="financial-route-grid">
                    {visibleRoutes.map((route) => {
                        const officialUrl = safeExternalUrl(route.url);

                        return (
                            <article
                                className="financial-route-card"
                                key={route.id}
                            >
                                <div className="route-card-top">
                                    <span className="pill blue">
                                        {route.category}
                                    </span>

                                    <span className="route-score">
                                        Priority fit: {routeScore(route)}
                                    </span>
                                </div>

                                <h4>{route.title}</h4>
                                <p>{route.description}</p>

                                <dl className="route-facts">
                                    <div>
                                        <dt>Startup</dt>
                                        <dd>
                                            {currency.format(route.startupCost)}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Car</dt>
                                        <dd>
                                            {route.carRequired ? "Required" : "No"}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Speed</dt>
                                        <dd>{route.speed}</dd>
                                    </div>
                                </dl>

                                <div className="route-reporting-note">
                                    <Banknote size={15} />
                                    <span>{route.reportingNote}</span>
                                </div>

                                <div className="financial-action-row">
                                    {officialUrl && (
                                        <a
                                            className="button secondary"
                                            href={officialUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Official site
                                            <ExternalLink size={15} />
                                        </a>
                                    )}

                                    <button
                                        className="button ghost"
                                        type="button"
                                        onClick={onAddOpportunity}
                                    >
                                        Track route
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
