import { useMemo, useState } from "react";
import { ExternalLink, Info, TriangleAlert } from "lucide-react";

import { safeExternalUrl } from "./safeUrl";
import {
    AID_VERIFIED_ON,
    actionState,
    actionTiming,
    actionsForTrack,
    annualAtStake,
    countByState,
    formatMoney,
    longDate,
    tracks,
    valueLabel,
} from "./aidTimelineCatalog";

// Whole literal strings, never a template — the CSS audit strips ${...} out of
// template classNames and would then be checking a class name that doesn't exist.
const STATE_CLASS = {
    now: "aid-plan__chip is-now",
    overdue: "aid-plan__chip is-overdue",
    due: "aid-plan__chip is-due",
    scheduled: "aid-plan__chip is-scheduled",
    birth: "aid-plan__chip is-birth",
};

function link(url) {
    if (typeof url !== "string") return null;
    return safeExternalUrl(url, { allowLocalHttp: false });
}

export default function AidTimeline() {
    const [trackId, setTrackId] = useState("all");
    const [openIds, setOpenIds] = useState(() => new Set());

    const now = new Date();
    const visible = useMemo(() => actionsForTrack(trackId, now), [trackId, now.getDate()]);
    const tally = useMemo(() => countByState(now), [now.getDate()]);
    const stake = useMemo(() => annualAtStake(), []);

    function toggle(id) {
        setOpenIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <section className="aid-plan" aria-label="Aid, tax and benefit deadlines">
            <div className="aid-plan__summary">
                <div className="aid-plan__summary-cell">
                    <span className="aid-plan__summary-figure">{formatMoney(stake)}</span>
                    <span className="aid-plan__summary-label">a year on the table</span>
                </div>
                <div className="aid-plan__summary-cell">
                    <span className="aid-plan__summary-figure">{tally.open}</span>
                    <span className="aid-plan__summary-label">open now</span>
                </div>
                <div className="aid-plan__summary-cell">
                    <span className="aid-plan__summary-figure">{tally.birth}</span>
                    <span className="aid-plan__summary-label">wait for the birth</span>
                </div>
            </div>

            <h3 className="aid-plan__heading">Track</h3>
            <div className="aid-plan__track-rail tp-rail" role="tablist" aria-label="Filter by track">
                {tracks.map((track) => (
                    <button
                        key={track.id}
                        type="button"
                        role="tab"
                        aria-selected={trackId === track.id}
                        className={trackId === track.id ? "aid-plan__track is-active" : "aid-plan__track"}
                        onClick={() => setTrackId(track.id)}
                    >
                        <span className="aid-plan__track-label">{track.short}</span>
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <p className="aid-plan__empty">Nothing filed under this track.</p>
            ) : (
                <ul className="aid-plan__list">
                    {visible.map((action) => {
                        const state = actionState(action, now);
                        const money = valueLabel(action);
                        const isOpen = openIds.has(action.id);
                        const href = link(action.url);
                        return (
                            <li key={action.id} className="aid-plan__item">
                                <div className="aid-plan__item-head">
                                    <h4 className="aid-plan__item-title">{action.title}</h4>
                                    <div className="aid-plan__chips">
                                        <span className={STATE_CLASS[state]}>
                                            {state === "overdue" ? <TriangleAlert size={12} aria-hidden="true" /> : null}
                                            {actionTiming(action, now)}
                                        </span>
                                        {money ? <span className="aid-plan__chip is-money">{money}</span> : null}
                                    </div>
                                </div>

                                <p className="aid-plan__do">{action.do}</p>
                                {action.valueNote ? <p className="aid-plan__note">{action.valueNote}</p> : null}

                                <button
                                    type="button"
                                    className="aid-plan__toggle"
                                    aria-expanded={isOpen}
                                    onClick={() => toggle(action.id)}
                                >
                                    {isOpen ? "Hide the reasoning" : "Why this matters"}
                                </button>

                                {isOpen ? (
                                    <div className="aid-plan__detail">
                                        <p className="aid-plan__why">{action.why}</p>
                                        <div className="aid-plan__meta">
                                            {href ? (
                                                <a
                                                    className="aid-plan__link"
                                                    href={href}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                >
                                                    Open
                                                    <ExternalLink size={12} aria-hidden="true" />
                                                </a>
                                            ) : null}
                                            {action.phone ? (
                                                <span className="aid-plan__meta-row">Call {action.phone}</span>
                                            ) : null}
                                            {action.contact ? (
                                                <span className="aid-plan__meta-row">{action.contact}</span>
                                            ) : null}
                                        </div>
                                        <p className="aid-plan__source">
                                            <Info size={12} aria-hidden="true" />
                                            {action.source}
                                        </p>
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            <p className="route-reporting-note">
                Every figure here traces to the regulation or agency page named on the card, checked{" "}
                {longDate(AID_VERIFIED_ON)}. Pell maximums, the paid-leave cap and the poverty tables all reset
                annually. Nothing on this screen files anything for you, and nothing on this screen stores a
                birth weight, a case number or an SSN — that is deliberate.
            </p>
        </section>
    );
}
