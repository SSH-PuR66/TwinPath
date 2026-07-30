import { useMemo, useState } from "react";
import {
    Baby,
    BriefcaseBusiness,
    CircleDollarSign,
    PiggyBank,
    ReceiptText,
    ShieldCheck,
} from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const allocationRules = [
    {
        id: "taxes",
        label: "Tax reserve",
        percentage: 25,
        icon: ReceiptText,
        color: "#ffc66d",
        explanation:
            "A planning reserve for possible income and self-employment tax obligations. Actual tax treatment varies.",
    },
    {
        id: "baby",
        label: "Baby essentials",
        percentage: 35,
        icon: Baby,
        color: "#ff79bd",
        explanation:
            "Near-term supplies, medical transportation and necessary preparation.",
    },
    {
        id: "emergency",
        label: "Emergency reserve",
        percentage: 25,
        icon: ShieldCheck,
        color: "#65e8ff",
        explanation:
            "Liquid savings for urgent family, food, housing and transportation needs.",
    },
    {
        id: "reinvestment",
        label: "Product improvement",
        percentage: 10,
        icon: BriefcaseBusiness,
        color: "#8b7cff",
        explanation:
            "Only for improvements supported by actual customer demand.",
    },
    {
        id: "longTerm",
        label: "Long-term saving",
        percentage: 5,
        icon: PiggyBank,
        color: "#5ee5a3",
        explanation:
            "Use only when the money will not be needed for near-term essentials.",
    },
];

export default function RevenueAllocator({
    privateMode = false,
    onLogIncome,
}) {
    const [grossRevenue, setGrossRevenue] = useState("0");
    const [platformFees, setPlatformFees] = useState("0");
    const [refunds, setRefunds] = useState("0");
    const [otherCosts, setOtherCosts] = useState("0");

    const calculations = useMemo(() => {
        const gross = Math.max(0, Number(grossRevenue) || 0);
        const fees = Math.max(0, Number(platformFees) || 0);
        const refunded = Math.max(0, Number(refunds) || 0);
        const costs = Math.max(0, Number(otherCosts) || 0);

        const net = Math.max(0, gross - fees - refunded - costs);

        return {
            gross,
            fees,
            refunded,
            costs,
            net,
            allocations: allocationRules.map((rule) => ({
                ...rule,
                amount: net * (rule.percentage / 100),
            })),
        };
    }, [grossRevenue, platformFees, refunds, otherCosts]);

    const showMoney = (value) =>
        privateMode ? "••••" : currency.format(value);

    return (
        <section className="revenue-allocator">
            <div className="section-title">
                <div>
                    <span className="eyebrow">REVENUE CYCLE</span>
                    <h3>Allocate money already received</h3>
                    <p>
                        Quotes and pending platform balances are not available cash.
                    </p>
                </div>

                <CircleDollarSign size={25} />
            </div>

            <div className="revenue-input-grid">
                <label className="field">
                    <span>Gross customer payments</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={grossRevenue}
                        onChange={(event) => setGrossRevenue(event.target.value)}
                    />
                </label>

                <label className="field">
                    <span>Platform/payment fees</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={platformFees}
                        onChange={(event) => setPlatformFees(event.target.value)}
                    />
                </label>

                <label className="field">
                    <span>Refunds</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={refunds}
                        onChange={(event) => setRefunds(event.target.value)}
                    />
                </label>

                <label className="field">
                    <span>Other actual costs</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={otherCosts}
                        onChange={(event) => setOtherCosts(event.target.value)}
                    />
                </label>
            </div>

            <div className="revenue-net">
                <span>Net received revenue</span>
                <strong>{showMoney(calculations.net)}</strong>
            </div>

            <div className="revenue-allocation-grid">
                {calculations.allocations.map((item) => {
                    const Icon = item.icon;

                    return (
                        <article
                            className="revenue-allocation-card"
                            key={item.id}
                            style={{ "--allocation-color": item.color }}
                        >
                            <div>
                                <Icon size={19} />
                            </div>

                            <span>{item.label}</span>
                            <strong>{showMoney(item.amount)}</strong>
                            <small>{item.percentage}%</small>
                            <p>{item.explanation}</p>
                        </article>
                    );
                })}
            </div>

            <div className="revenue-actions">
                <button
                    className="button primary"
                    type="button"
                    disabled={calculations.net <= 0}
                    onClick={onLogIncome}
                >
                    Log received income
                </button>

                <a
                    className="button secondary"
                    href="/shop"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Preview public shop
                </a>
            </div>

            <div className="warning-inline">
                <ShieldCheck size={18} />
                <span>
                    Keep income records and report earnings wherever required. Private
                    visibility inside TwinPath is not legal concealment.
                </span>
            </div>
        </section>
    );
}
