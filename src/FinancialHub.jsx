import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ArrowUpRight,
    Baby,
    Banknote,
    BriefcaseBusiness,
    Check,
    Copy,
    ExternalLink,
    PiggyBank,
    ShieldCheck,
    TrendingUp,
    WalletCards,
} from "lucide-react";

import { financialRoutes } from "./financialRoutes";
import { safeExternalUrl } from "./safeUrl";
import DisclosureSection from "./DisclosureSection";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const MAX_PLANNING_AMOUNT = 1_000_000;
const MAX_PAYPAL_HANDLE_LENGTH = 64;

const likelihoodFactors = {
    high: 1,
    medium: 0.6,
    low: 0.25,
    unknown: 0.4,
};

const speedFactors = {
    immediate: 1,
    fast: 0.9,
    medium: 0.65,
    slow: 0.4,
    unpredictable: 0.25,
};

const officialAccountLinks = {
    paypal: "https://www.paypal.com/myaccount/",
    chime: "https://www.chime.com/",
};

function safeNumber(
    value,
    {
        minimum = 0,
        maximum = MAX_PLANNING_AMOUNT,
        fallback = 0,
    } = {}
) {
    const result = Number(value);

    if (!Number.isFinite(result)) {
        return fallback;
    }

    return Math.min(
        maximum,
        Math.max(minimum, result)
    );
}

function roundCurrency(value) {
    return (
        Math.round(
            (safeNumber(value) + Number.EPSILON) * 100
        ) / 100
    );
}

function calculateAllocation(amount, reserveReady) {
    const safeAmount = safeNumber(amount);

    const allocationRules = reserveReady
        ? [
            {
                name: "Emergency reserve",
                percentage: 0.4,
                icon: ShieldCheck,
                explanation:
                    "Continue strengthening liquid emergency savings.",
            },
            {
                name: "Baby and transportation",
                percentage: 0.25,
                icon: Baby,
                explanation:
                    "Protect near-term family and transportation needs.",
            },
            {
                name: "Career growth",
                percentage: 0.2,
                icon: BriefcaseBusiness,
                explanation:
                    "Use for a measured opportunity with a likely return.",
            },
            {
                name: "Long-term investing",
                percentage: 0.15,
                icon: TrendingUp,
                explanation:
                    "Invest only when this money is not needed soon and you understand the risk.",
            },
        ]
        : [
            {
                name: "Emergency reserve",
                percentage: 0.6,
                icon: ShieldCheck,
                explanation:
                    "Keep liquid for urgent transportation, food, healthcare, or housing.",
            },
            {
                name: "Baby and transportation",
                percentage: 0.3,
                icon: Baby,
                explanation:
                    "Use for necessary family preparation and reliable transportation.",
            },
            {
                name: "Career growth",
                percentage: 0.1,
                icon: BriefcaseBusiness,
                explanation:
                    "Use only for a specific tool or action with a likely measured return.",
            },
        ];

    return allocationRules.map((rule) => ({
        ...rule,
        amount: roundCurrency(
            safeAmount * rule.percentage
        ),
    }));
}

function normalizeLikelihood(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();

    return Object.hasOwn(
        likelihoodFactors,
        normalized
    )
        ? normalized
        : "unknown";
}

function determineSpeedFactor(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase();

    if (
        normalized.includes("immediate") ||
        normalized.includes("same day")
    ) {
        return speedFactors.immediate;
    }

    if (
        normalized.includes("day") ||
        normalized.includes("1–2 week") ||
        normalized.includes("1-2 week")
    ) {
        return speedFactors.fast;
    }

    if (
        normalized.includes("week") ||
        normalized.includes("month")
    ) {
        return speedFactors.medium;
    }

    if (
        normalized.includes("long term") ||
        normalized.includes("long-term")
    ) {
        return speedFactors.slow;
    }

    if (
        normalized.includes("unpredictable") ||
        normalized.includes("varies")
    ) {
        return speedFactors.unpredictable;
    }

    return 0.5;
}

function routeScore(route) {
    const likelihood =
        likelihoodFactors[
        normalizeLikelihood(route.likelihood)
        ];

    const transportation =
        route.carRequired === true ? 0.25 : 1;

    const startupCost = safeNumber(
        route.startupCost,
        {
            maximum: 1_000_000,
        }
    );

    let costFactor = 1;

    if (startupCost > 100) {
        costFactor = 0.25;
    } else if (startupCost > 50) {
        costFactor = 0.45;
    } else if (startupCost > 15) {
        costFactor = 0.7;
    }

    const speed = determineSpeedFactor(
        route.speed
    );

    const score =
        likelihood *
        transportation *
        costFactor *
        speed *
        100;

    return Math.max(
        0,
        Math.min(100, Math.round(score))
    );
}

function cleanPayPalHandle(value) {
    return String(value || "")
        .trim()
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, MAX_PAYPAL_HANDLE_LENGTH);
}

function readSavedPayPalHandle() {
    try {
        return cleanPayPalHandle(
            window.localStorage.getItem(
                "twinpath-paypal-handle"
            ) || ""
        );
    } catch {
        return "";
    }
}

function savePayPalHandle(value) {
    try {
        if (value) {
            window.localStorage.setItem(
                "twinpath-paypal-handle",
                value
            );
        } else {
            window.localStorage.removeItem(
                "twinpath-paypal-handle"
            );
        }

        return true;
    } catch {
        return false;
    }
}

async function copyText(value) {
    if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
        "function"
    ) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea =
        document.createElement("textarea");

    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");

    textarea.remove();

    if (!copied) {
        throw new Error(
            "Clipboard access is unavailable."
        );
    }
}

function cleanRoute(route, index) {
    if (
        !route ||
        typeof route !== "object" ||
        Array.isArray(route)
    ) {
        return null;
    }

    const title = String(route.title || "")
        .trim()
        .slice(0, 180);

    const category = String(
        route.category || "Other"
    )
        .trim()
        .slice(0, 80);

    if (!title) {
        return null;
    }

    const officialUrl = safeExternalUrl(
        route.url,
        {
            allowLocalHttp: false,
        }
    );

    return {
        ...route,
        id:
            String(route.id || "").trim() ||
            `route-${index}`,
        title,
        category,
        description: String(
            route.description || ""
        )
            .trim()
            .slice(0, 1500),
        reportingNote: String(
            route.reportingNote ||
            "Verify current details and reporting obligations through the official organization."
        )
            .trim()
            .slice(0, 1500),
        carRequired: route.carRequired === true,
        startupCost: safeNumber(
            route.startupCost,
            {
                maximum: 1_000_000,
            }
        ),
        speed: String(route.speed || "Varies")
            .trim()
            .slice(0, 80),
        likelihood: normalizeLikelihood(
            route.likelihood
        ),
        officialUrl,
        score: routeScore(route),
    };
}

export default function FinancialHub({
    onLogTransaction,
    onAddOpportunity,
    privateMode = false,
}) {
    const [amount, setAmount] = useState("50");
    const [reserveReady, setReserveReady] =
        useState(false);

    const [category, setCategory] =
        useState("All");
    const [showAllRoutes, setShowAllRoutes] =
        useState(false);

    const [paypalHandle, setPaypalHandle] =
        useState(readSavedPayPalHandle);

    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] =
        useState("");

    const [storageWarning, setStorageWarning] =
        useState("");

    const safePayPalAccountUrl =
        safeExternalUrl(
            officialAccountLinks.paypal,
            {
                allowLocalHttp: false,
                allowedHosts: ["paypal.com"],
            }
        );

    const safeChimeUrl = safeExternalUrl(
        officialAccountLinks.chime,
        {
            allowLocalHttp: false,
            allowedHosts: ["chime.com"],
        }
    );

    const normalizedRoutes = useMemo(() => {
        const source = Array.isArray(financialRoutes)
            ? financialRoutes
            : [];

        return source
            .map(cleanRoute)
            .filter(Boolean);
    }, []);

    const allocation = useMemo(
        () =>
            calculateAllocation(
                amount,
                reserveReady
            ),
        [amount, reserveReady]
    );

    const routeCategories = useMemo(
        () => [
            "All",
            ...new Set(
                normalizedRoutes.map(
                    (route) => route.category
                )
            ),
        ],
        [normalizedRoutes]
    );

    const visibleRoutes = useMemo(() => {
        if (category === "All") {
            return normalizedRoutes;
        }

        return normalizedRoutes.filter(
            (route) =>
                route.category === category
        );
    }, [
        category,
        normalizedRoutes,
    ]);

    const cleanedPayPalHandle = useMemo(
        () => cleanPayPalHandle(paypalHandle),
        [paypalHandle]
    );

    const paypalLink = useMemo(() => {
        if (!cleanedPayPalHandle) {
            return null;
        }

        return safeExternalUrl(
            `https://www.paypal.me/${cleanedPayPalHandle}`,
            {
                allowLocalHttp: false,
                allowedHosts: ["paypal.me"],
            }
        );
    }, [cleanedPayPalHandle]);

    useEffect(() => {
        const stored = savePayPalHandle(
            cleanedPayPalHandle
        );

        setStorageWarning(
            stored
                ? ""
                : "This browser blocked local storage. The public handle will not be remembered on this device."
        );
    }, [cleanedPayPalHandle]);

    useEffect(() => {
        if (
            category !== "All" &&
            !routeCategories.includes(category)
        ) {
            setCategory("All");
        }
    }, [category, routeCategories]);

    function handleAmountChange(event) {
        const value = event.target.value;

        if (value === "") {
            setAmount("");
            return;
        }

        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
            return;
        }

        setAmount(
            String(
                Math.min(
                    MAX_PLANNING_AMOUNT,
                    Math.max(0, parsed)
                )
            )
        );
    }

    async function copyPayPalLink() {
        if (!paypalLink) return;

        setCopyError("");

        try {
            await copyText(paypalLink);
            setCopied(true);

            window.setTimeout(() => {
                setCopied(false);
            }, 1500);
        } catch {
            setCopied(false);

            setCopyError(
                "TwinPath could not copy the link. Press and hold the displayed link to copy it manually."
            );
        }
    }

    function logTransaction() {
        if (
            typeof onLogTransaction === "function"
        ) {
            onLogTransaction();
        }
    }

    function trackRoute(route) {
        if (
            typeof onAddOpportunity === "function"
        ) {
            onAddOpportunity(route);
        }
    }

    return (
        <div className="financial-hub">
            <DisclosureSection id="financial-budget" title="Budget summary" hint="Give money already available a clear job">
            <section className="money-planner">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">
                            SMALL-MONEY PLANNER
                        </span>

                        <h3>Give every dollar a job</h3>

                        <p>
                            This planning tool does not transfer
                            money, connect accounts, or count
                            potential income as available cash.
                        </p>
                    </div>

                    <PiggyBank size={25} />
                </div>

                <label className="field">
                    <span>Amount actually available</span>

                    <div className="money-input">
                        <span>$</span>

                        <input
                            type="number"
                            min="0"
                            max={MAX_PLANNING_AMOUNT}
                            step="0.01"
                            inputMode="decimal"
                            value={amount}
                            onChange={handleAmountChange}
                            aria-describedby="money-planner-help"
                        />
                    </div>

                    <small id="money-planner-help">
                        Use cash you already have—not expected
                        refunds, pending benefits, unpaid orders,
                        or unsettled payouts.
                    </small>
                </label>

                <label className="toggle-row planner-toggle">
                    <span>
                        <strong>
                            Core reserve already funded
                        </strong>

                        <small>
                            Turn this on only when near-term
                            emergency, transportation, food,
                            healthcare, and family needs are
                            covered.
                        </small>
                    </span>

                    <input
                        type="checkbox"
                        checked={reserveReady}
                        onChange={(event) =>
                            setReserveReady(
                                event.target.checked
                            )
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
                                            : currency.format(
                                                item.amount
                                            )}
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
                        onClick={logTransaction}
                        disabled={
                            typeof onLogTransaction !==
                            "function"
                        }
                    >
                        <WalletCards size={17} />
                        Log money received or spent
                    </button>

                    {safePayPalAccountUrl && (
                        <a
                            className="button secondary"
                            href={safePayPalAccountUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open PayPal
                            <ArrowUpRight size={16} />
                        </a>
                    )}

                    {safeChimeUrl && (
                        <a
                            className="button secondary"
                            href={safeChimeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open Chime
                            <ArrowUpRight size={16} />
                        </a>
                    )}
                </div>

                <div className="warning-inline">
                    <ShieldCheck size={18} />

                    <span>
                        Moving money between your own accounts
                        is not income or an expense. Record only
                        actual income, expenses, fees, refunds,
                        and business profit.
                    </span>
                </div>
            </section>
            </DisclosureSection>

            <DisclosureSection id="financial-payment-link" title="Receiving link" hint="A public PayPal.me handle" collapseOnPhone>
            <section className="paypal-link-builder">
                <div>
                    <span className="eyebrow">
                        OPTIONAL PAYMENT LINK
                    </span>

                    <h3>PayPal.me receiving link</h3>

                    <p>
                        Store only a public PayPal.me handle
                        locally on this device. TwinPath does not
                        request or store a PayPal password,
                        account number, or authentication code.
                    </p>
                </div>

                <label className="field">
                    <span>Public PayPal.me handle</span>

                    <input
                        value={paypalHandle}
                        maxLength={
                            MAX_PAYPAL_HANDLE_LENGTH
                        }
                        placeholder="YourPublicHandle"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        onChange={(event) => {
                            setPaypalHandle(
                                cleanPayPalHandle(
                                    event.target.value
                                )
                            );

                            setCopyError("");
                        }}
                    />

                    <small>
                        This handle is public to anyone who
                        receives the payment link.
                    </small>
                </label>

                {paypalLink && (
                    <div className="payment-link-preview">
                        <span title={paypalLink}>
                            {paypalLink}
                        </span>

                        <button
                            className="icon-button"
                            type="button"
                            onClick={copyPayPalLink}
                            aria-label="Copy PayPal link"
                        >
                            {copied ? (
                                <Check size={17} />
                            ) : (
                                <Copy size={17} />
                            )}
                        </button>

                        <a
                            className="icon-button"
                            href={paypalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open PayPal link"
                        >
                            <ExternalLink size={17} />
                        </a>
                    </div>
                )}

                {copyError && (
                    <div
                        className="error-box"
                        role="alert"
                    >
                        {copyError}
                    </div>
                )}

                {storageWarning && (
                    <div className="route-reporting-note">
                        <ShieldCheck size={15} />
                        <span>{storageWarning}</span>
                    </div>
                )}
            </section>
            </DisclosureSection>

            <DisclosureSection id="financial-routes" title="Resource map" hint="Official-source research routes" collapseOnPhone>
            <section className="route-explorer">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">
                            VERIFIED-SOURCE ROUTES
                        </span>

                        <h3>
                            Opportunity and resource map
                        </h3>

                        <p>
                            These are research starting points,
                            not guaranteed eligibility, income,
                            awards, or investment returns.
                        </p>
                    </div>

                    <TrendingUp size={24} />
                </div>

                <div
                    className="chip-row"
                    aria-label="Financial route categories"
                >
                    {routeCategories.map((item) => (
                        <button
                            className={`chip ${category === item
                                    ? "active"
                                    : ""
                                }`}
                            type="button"
                            key={item}
                            onClick={() => {
                                setCategory(item);
                                setShowAllRoutes(false);
                            }}
                            aria-pressed={
                                category === item
                            }
                        >
                            {item}
                        </button>
                    ))}
                </div>

                {visibleRoutes.length ? (
                    <div className="financial-route-grid">
                        {(showAllRoutes ? visibleRoutes : visibleRoutes.slice(0, 8)).map((route) => (
                            <article
                                className="financial-route-card"
                                key={route.id}
                            >
                                <div className="route-card-top">
                                    <span className="pill blue">
                                        {route.category}
                                    </span>

                                    <span className="route-score">
                                        Planning fit: {route.score}/100
                                    </span>
                                </div>

                                <h4>{route.title}</h4>

                                {route.description && (
                                    <p>{route.description}</p>
                                )}

                                <dl className="route-facts">
                                    <div>
                                        <dt>Startup</dt>

                                        <dd>
                                            {currency.format(
                                                route.startupCost
                                            )}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Car</dt>

                                        <dd>
                                            {route.carRequired
                                                ? "Required"
                                                : "No"}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Speed</dt>
                                        <dd>{route.speed}</dd>
                                    </div>
                                </dl>

                                <div className="route-reporting-note">
                                    <Banknote size={15} />

                                    <span>
                                        {route.reportingNote}
                                    </span>
                                </div>

                                <div className="financial-action-row">
                                    {route.officialUrl ? (
                                        <a
                                            className="button secondary"
                                            href={route.officialUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Official site
                                            <ExternalLink size={15} />
                                        </a>
                                    ) : (
                                        <button
                                            className="button secondary"
                                            type="button"
                                            disabled
                                            title="The source URL failed validation."
                                        >
                                            Source unavailable
                                        </button>
                                    )}

                                    <button
                                        className="button ghost"
                                        type="button"
                                        onClick={() =>
                                            trackRoute(route)
                                        }
                                        disabled={
                                            typeof onAddOpportunity !==
                                            "function"
                                        }
                                    >
                                        Track route
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty">
                        No valid routes are available in this
                        category.
                    </div>
                )}
                {visibleRoutes.length > 8 && !showAllRoutes ? (
                    <button className="button secondary" type="button" onClick={() => setShowAllRoutes(true)}>
                        Show all {visibleRoutes.length}
                    </button>
                ) : null}
            </section>
            </DisclosureSection>
        </div>
    );
}
