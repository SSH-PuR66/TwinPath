import { useMemo, useState } from "react";
import { ChevronDown, Info, Lock, TrendingDown, TrendingUp } from "lucide-react";
import {
    BIG_MOVE_THRESHOLD,
    MARKETS_PRIOR_SESSION,
    REALIZED_TRADES_ALL_TIME,
    SLEEVES,
    accounts,
    closesFor,
    dayChange,
    formatMoney,
    formatPct,
    formatQuantity,
    formatSigned,
    holdingsFor,
    isBigMove,
    marketValue,
    mixRows,
    plainSummary,
    sessionDayName,
    sessionMovePct,
    snapshotLabel,
    totals,
    trend,
    unrealized,
    unrealizedPct,
} from "./marketsCatalog.js";

/**
 * MarketsDesk v2 — a read-only window on the brokerage accounts.
 *
 * Still no write path: no control that could hand a ticket to a broker, no
 * confirm, no quantity input. v2 changes how the same observed numbers READ —
 * each holding leads with a plain sentence and a small picture of July, and
 * the technical grid folds away until asked for. The design bar: understand
 * the money in five seconds without knowing what "unrealized" means.
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

const SPARK_CLASS = {
    up: "markets-desk__spark-line is-up",
    down: "markets-desk__spark-line is-down",
    flat: "markets-desk__spark-line is-flat",
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

// Presentation-only arrangements of the same rows. Nothing here touches data.
const SORT_MODES = [
    { id: "size", label: "Biggest first" },
    { id: "movers", label: "Movers" },
    { id: "gain", label: "Overall gain" },
];

const SORT_COMPARE = {
    size: (a, b) => marketValue(b) - marketValue(a),
    movers: (a, b) => Math.abs(dayChange(b)) - Math.abs(dayChange(a)),
    gain: (a, b) => unrealized(b) - unrealized(a),
};

// One-line meanings for the words the grid uses. Definitions, not advice.
const GLOSSARY = [
    ["Worth now", "shares held × the price at the snapshot moment."],
    ["Unrealized", "worth now minus what was paid. It only becomes real money when something is closed out."],
    ["Average cost", "the average price paid per share across every purchase."],
    ["Today", "how much this position moved between the prior close and the snapshot."],
    ["Locked", "the broker will not release these shares yet, so they cannot be touched."],
    ["Snapshot", "every number here was read at one stamped moment. Nothing on this screen is live."],
];

function trendIcon(direction) {
    if (direction === "up") return TrendingUp;
    if (direction === "down") return TrendingDown;
    return null;
}

/**
 * A month of closes as a 120x32 polyline. Pure presentation of closesFor().
 * Height is normalized to the symbol's own July range so the shape reads even
 * when the absolute move is small.
 */
function Sparkline({ symbol }) {
    const closes = closesFor(symbol);
    if (!closes || closes.length < 2) return null;
    const w = 120;
    const h = 32;
    const pad = 2;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const step = (w - pad * 2) / (closes.length - 1);
    const points = closes
        .map((price, index) => {
            const x = pad + index * step;
            const y = pad + (h - pad * 2) * (1 - (price - min) / span);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    const direction = trend(closes[closes.length - 1] - closes[0]);
    return (
        <svg
            className="markets-desk__spark"
            viewBox="0 0 120 32"
            role="img"
            aria-label={`July price path for ${symbol}, ${closes.length} sessions`}
        >
            <polyline
                className={SPARK_CLASS[direction]}
                points={points}
                fill="none"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function MarketsDesk() {
    const [scope, setScope] = useState("all");
    const [sortMode, setSortMode] = useState("size");
    const [openDetails, setOpenDetails] = useState(() => new Set());
    const [glossaryShown, setGlossaryShown] = useState(false);

    const scopeTotals = useMemo(() => totals(scope), [scope]);
    const rows = useMemo(() => {
        const list = holdingsFor(scope);
        list.sort(SORT_COMPARE[sortMode] || SORT_COMPARE.size);
        return list;
    }, [scope, sortMode]);
    const mix = useMemo(() => mixRows(scope), [scope]);
    const stamp = useMemo(() => snapshotLabel(), []);
    const dayName = useMemo(() => sessionDayName(), []);

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

    function toggleDetails(id) {
        setOpenDetails((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

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
                        {dayName}, vs the {MARKETS_PRIOR_SESSION} close
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

            <div className="markets-desk__list-head">
                <h3 className="markets-desk__heading">Holdings</h3>
                <div className="markets-desk__sort" role="group" aria-label="Arrange holdings">
                    {SORT_MODES.map((mode) => (
                        <button
                            type="button"
                            key={mode.id}
                            aria-pressed={sortMode === mode.id}
                            className={
                                sortMode === mode.id
                                    ? "markets-desk__sort-button is-active"
                                    : "markets-desk__sort-button"
                            }
                            onClick={() => setSortMode(mode.id)}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            <button
                type="button"
                className="markets-desk__glossary-toggle"
                aria-expanded={glossaryShown}
                onClick={() => setGlossaryShown((shown) => !shown)}
            >
                <Info size={12} aria-hidden="true" />
                What am I looking at?
            </button>
            {glossaryShown ? (
                <dl className="markets-desk__glossary">
                    {GLOSSARY.map(([term, meaning]) => (
                        <div className="markets-desk__glossary-row" key={term}>
                            <dt>{term}</dt>
                            <dd>{meaning}</dd>
                        </div>
                    ))}
                    <div className="markets-desk__glossary-row">
                        <dt>And</dt>
                        <dd>nothing here is advice — every figure is an observed number.</dd>
                    </div>
                </dl>
            ) : null}

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
                        const detailsShown = openDetails.has(holding.id);
                        return (
                            <li className="markets-desk__item" key={holding.id}>
                                <div className="markets-desk__item-head">
                                    <span className="markets-desk__name">{holding.name}</span>
                                    <span className="markets-desk__sym">{holding.symbol}</span>
                                    <span className="markets-desk__chips">
                                        {isBigMove(holding) ? (
                                            <span className="markets-desk__chip is-move">
                                                moved {formatPct(sessionMovePct(holding))} {dayName}
                                            </span>
                                        ) : null}
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

                                <div className="markets-desk__story">
                                    <p className="markets-desk__sentence">{plainSummary(holding)}</p>
                                    <Sparkline symbol={holding.symbol} />
                                </div>

                                <button
                                    type="button"
                                    className="markets-desk__details-toggle"
                                    aria-expanded={detailsShown}
                                    onClick={() => toggleDetails(holding.id)}
                                >
                                    <ChevronDown
                                        size={12}
                                        aria-hidden="true"
                                        className={
                                            detailsShown
                                                ? "markets-desk__details-caret is-open"
                                                : "markets-desk__details-caret"
                                        }
                                    />
                                    {detailsShown ? "Hide the numbers" : "Show the numbers"}
                                </button>

                                {detailsShown ? (
                                    <div className="markets-desk__details">
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
                                    </div>
                                ) : null}

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
                    : `${REALIZED_TRADES_ALL_TIME} closing positions are on record.`}{" "}
                A move of {formatPct(BIG_MOVE_THRESHOLD).replace("+", "")} or more in a share
                price gets flagged, purely as a size note.
            </p>
            <p className="route-reporting-note">
                TwinPath reads these accounts and never moves them. Positions change in the
                broker's own app, by you. Nothing here is advice — every figure is an observed
                number, not a suggestion about what to hold.
            </p>
        </section>
    );
}
