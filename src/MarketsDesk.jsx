import { useMemo, useState } from "react";
import { Info, Lock, TrendingDown, TrendingUp } from "lucide-react";
import {
    MARKETS_PRIOR_SESSION,
    REALIZED_TRADES_ALL_TIME,
    SLEEVES,
    accounts,
    dayChange,
    formatMoney,
    formatPct,
    formatQuantity,
    formatSigned,
    holdingsFor,
    marketValue,
    mixRows,
    snapshotLabel,
    totals,
    trend,
    unrealized,
    unrealizedPct,
} from "./marketsCatalog.js";

/**
 * MarketsDesk — a read-only window on the brokerage accounts.
 *
 * There is no write path in this component. No control that could hand a
 * ticket to a broker, no confirm, no quantity input. It renders numbers that
 * already exist and stamps the moment they were read, so a stale price can
 * never be mistaken for a live one. Positions change in the broker's own app,
 * moved by the person who owns the account.
 */

// Whole literal strings, never a template — the CSS audit strips ${...} out of
// template classNames and would then be checking a class name that doesn't exist.
const TREND_CLASS = {
    up: "markets-desk__chip is-up",
    down: "markets-desk__chip is-down",
    flat: "markets-desk__chip is-flat",
};

const FIGURE_CLASS = {
    up: "markets-desk__summary-figure is-up",
    down: "markets-desk__summary-figure is-down",
    flat: "markets-desk__summary-figure is-flat",
};

const FILL_CLASS = {
    us: "markets-desk__mix-fill is-us",
    intl: "markets-desk__mix-fill is-intl",
    em: "markets-desk__mix-fill is-em",
    bond: "markets-desk__mix-fill is-bond",
    single: "markets-desk__mix-fill is-single",
    crypto: "markets-desk__mix-fill is-crypto",
    cash: "markets-desk__mix-fill is-cash",
};

const SLEEVE_LABEL = SLEEVES.reduce((map, sleeve) => {
    map[sleeve.id] = sleeve.label;
    return map;
}, {});

function trendIcon(direction) {
    if (direction === "up") return TrendingUp;
    if (direction === "down") return TrendingDown;
    return null;
}

export default function MarketsDesk() {
    const [scope, setScope] = useState("all");

    const scopeTotals = useMemo(() => totals(scope), [scope]);
    const rows = useMemo(() => holdingsFor(scope), [scope]);
    const mix = useMemo(() => mixRows(scope), [scope]);
    const stamp = useMemo(() => snapshotLabel(), []);

    const scopes = useMemo(
        () => [
            { id: "all", label: "All accounts", short: "All" },
            ...accounts.map((account) => ({
                id: account.id,
                label: account.label,
                short: account.short,
            })),
        ],
        [],
    );

    const activeAccount = accounts.find((account) => account.id === scope) || null;
    const dayTrend = trend(scopeTotals.day);
    const gainTrend = trend(scopeTotals.gain);

    return (
        <section className="markets-desk" aria-label="Markets — read only">
            <div className="markets-desk__summary">
                <div className="markets-desk__summary-cell">
                    <span className="markets-desk__summary-figure">
                        {formatMoney(scopeTotals.total)}
                    </span>
                    <span className="markets-desk__summary-label">
                        Value held {scope === "all" ? "across all three accounts" : "in this account"}
                    </span>
                </div>
                <div className="markets-desk__summary-cell">
                    <span className={FIGURE_CLASS[gainTrend]}>
                        {formatSigned(scopeTotals.gain)}
                    </span>
                    <span className="markets-desk__summary-label">
                        Unrealized, {formatPct(scopeTotals.gainPct)} on cost
                    </span>
                </div>
                <div className="markets-desk__summary-cell">
                    <span className={FIGURE_CLASS[dayTrend]}>
                        {formatSigned(scopeTotals.day)}
                    </span>
                    <span className="markets-desk__summary-label">
                        Since the {MARKETS_PRIOR_SESSION} close
                    </span>
                </div>
            </div>

            <h3 className="markets-desk__heading">Account</h3>
            <div className="markets-desk__account-rail tp-rail" role="tablist" aria-label="Account">
                {scopes.map((item) => {
                    const isActive = scope === item.id;
                    const itemTotals = totals(item.id);
                    return (
                        <button
                            type="button"
                            key={item.id}
                            role="tab"
                            aria-selected={isActive}
                            className={isActive ? "markets-desk__account is-active" : "markets-desk__account"}
                            onClick={() => setScope(item.id)}
                        >
                            <span className="markets-desk__account-label">{item.short}</span>
                            <span className="markets-desk__account-value">
                                {formatMoney(itemTotals.total)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeAccount ? (
                <p className="markets-desk__note">{activeAccount.note}</p>
            ) : null}

            <h3 className="markets-desk__heading">Holdings</h3>
            {rows.length === 0 ? (
                <p className="markets-desk__empty">
                    No positions in this account — {formatMoney(scopeTotals.cash)} sitting in cash.
                </p>
            ) : (
                <ul className="markets-desk__list">
                    {rows.map((holding) => {
                        const gain = unrealized(holding);
                        const direction = trend(gain);
                        const Icon = trendIcon(direction);
                        return (
                            <li className="markets-desk__item" key={holding.id}>
                                <div className="markets-desk__item-head">
                                    <span className="markets-desk__sym">{holding.symbol}</span>
                                    <span className="markets-desk__name">{holding.name}</span>
                                    <span className="markets-desk__chips">
                                        <span className={TREND_CLASS[direction]}>
                                            {Icon ? <Icon size={11} aria-hidden="true" /> : null}
                                            {formatPct(unrealizedPct(holding))}
                                        </span>
                                        {holding.locked ? (
                                            <span className="markets-desk__chip is-locked">
                                                <Lock size={11} aria-hidden="true" />
                                                Locked
                                            </span>
                                        ) : null}
                                    </span>
                                </div>
                                <div className="markets-desk__grid">
                                    <div className="markets-desk__cell">
                                        <span className="markets-desk__cell-label">Worth now</span>
                                        <span className="markets-desk__cell-figure">
                                            {formatMoney(marketValue(holding))}
                                        </span>
                                    </div>
                                    <div className="markets-desk__cell">
                                        <span className="markets-desk__cell-label">Unrealized</span>
                                        <span className="markets-desk__cell-figure">
                                            {formatSigned(gain)}
                                        </span>
                                    </div>
                                    <div className="markets-desk__cell">
                                        <span className="markets-desk__cell-label">Today</span>
                                        <span className="markets-desk__cell-figure">
                                            {formatSigned(dayChange(holding))}
                                        </span>
                                    </div>
                                    <div className="markets-desk__cell">
                                        <span className="markets-desk__cell-label">Shares</span>
                                        <span className="markets-desk__cell-figure">
                                            {formatQuantity(holding.quantity)}
                                        </span>
                                    </div>
                                </div>
                                <p className="markets-desk__meta">
                                    {SLEEVE_LABEL[holding.sleeve] || holding.sleeve} · average cost{" "}
                                    {formatMoney(holding.avgCost)} · last {formatMoney(holding.price)}
                                </p>
                                {holding.locked ? (
                                    <p className="markets-desk__locked-note">{holding.locked}</p>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            <h3 className="markets-desk__heading">How it is spread</h3>
            {mix.length === 0 ? (
                <p className="markets-desk__empty">Nothing to spread yet.</p>
            ) : (
                <ul className="markets-desk__mix">
                    {mix.map((row) => (
                        <li className="markets-desk__mix-row" key={row.id}>
                            <span className="markets-desk__mix-label">{row.label}</span>
                            <span className="markets-desk__mix-bar">
                                <span
                                    className={FILL_CLASS[row.id] || "markets-desk__mix-fill is-cash"}
                                    style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }}
                                />
                            </span>
                            <span className="markets-desk__mix-figure">
                                {Math.round(row.share * 100)}%
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <p className="markets-desk__stamp">
                <Info size={12} aria-hidden="true" />
                Read {stamp}. Prices are a snapshot from that moment, not a live feed.{" "}
                {REALIZED_TRADES_ALL_TIME === 0
                    ? "Nothing has ever been closed out, so there is no realized gain or loss to carry onto a tax return."
                    : `${REALIZED_TRADES_ALL_TIME} closing positions are on record.`}
            </p>
            <p className="route-reporting-note">
                TwinPath reads these accounts and never moves them. Positions change in the
                broker's own app, by you. Nothing here is advice — every figure is an observed
                number, not a suggestion about what to hold.
            </p>
        </section>
    );
}
