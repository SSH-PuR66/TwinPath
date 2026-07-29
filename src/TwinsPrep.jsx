import { useMemo, useState } from "react";
import {
    Baby,
    Car,
    ExternalLink,
    Info,
    Milk,
    Moon,
    Package,
    ShoppingCart,
    Ticket,
    TriangleAlert,
} from "lucide-react";

import { safeExternalUrl } from "./safeUrl";
import {
    PREP_VERIFIED_ON,
    TWINS_EDD,
    TWINS_LIKELY_ARRIVAL,
    cartUrlForItems,
    kits,
    portals,
    realisticBudget,
} from "./twinsPrepCatalog";

const KIT_ICONS = {
    package: Package,
    car: Car,
    moon: Moon,
    milk: Milk,
    baby: Baby,
    cart: ShoppingCart,
    ticket: Ticket,
};

// Cart links may only ever point at Amazon. Anything else is a bug, not a feature.
const AMAZON_HOSTS = ["www.amazon.com"];

function link(url) {
    if (typeof url !== "string") return null;
    return safeExternalUrl(url, { allowLocalHttp: false });
}

function cartLink(url) {
    if (typeof url !== "string") return null;
    return safeExternalUrl(url, { allowedHosts: AMAZON_HOSTS, allowLocalHttp: false });
}

function parseDay(iso) {
    const [year, month, day] = String(iso).split("-").map(Number);
    return new Date(year, month - 1, day);
}

function longDate(iso) {
    return parseDay(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function daysFromToday(iso) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((parseDay(iso) - today) / 86400000);
}

export default function TwinsPrep() {
    const [portalId, setPortalId] = useState(portals[0].id);
    const [kitId, setKitId] = useState(kits[0].id);

    const portal = portals.find((entry) => entry.id === portalId) || portals[0];
    const kit = kits.find((entry) => entry.id === kitId) || kits[0];

    const portalUrl = useMemo(() => link(portal.url), [portal]);
    const kitCartUrl = useMemo(() => cartLink(cartUrlForItems(kit.items)), [kit]);

    const daysLeft = daysFromToday(TWINS_LIKELY_ARRIVAL);
    const KitIcon = KIT_ICONS[kit.icon] || Package;

    return (
        <div className="twins-prep">
            <div className="twins-prep__clock">
                <div className="twins-prep__clock-figure">
                    <strong>{daysLeft > 0 ? daysLeft : 0}</strong>
                    <span>days</span>
                </div>
                <p>
                    Plan for <b>{longDate(TWINS_LIKELY_ARRIVAL)}</b>, not the{" "}
                    {longDate(TWINS_EDD)} due date. Median twin gestation is 35.2 weeks and
                    roughly 57&ndash;60% of twin pregnancies deliver before 37 weeks.
                </p>
            </div>

            <p className="grow-feature-heading">Student portals</p>

            <div className="twins-prep__portals" role="tablist" aria-label="Student portals">
                {portals.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        aria-selected={entry.id === portalId}
                        className={
                            entry.id === portalId
                                ? "twins-prep__portal is-active"
                                : "twins-prep__portal"
                        }
                        onClick={() => setPortalId(entry.id)}
                    >
                        <span>{entry.name}</span>
                        <em>{entry.lead}</em>
                    </button>
                ))}
            </div>

            <div className="twins-prep__panel" key={portal.id}>
                <div className="twins-prep__portal-head">
                    <h4>{portal.name}</h4>
                    {portalUrl ? (
                        <a
                            className="button secondary"
                            href={portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open
                            <ExternalLink size={14} aria-hidden="true" />
                        </a>
                    ) : null}
                </div>

                <p className="twins-prep__truth">
                    <Info size={14} aria-hidden="true" />
                    <span>{portal.truth}</span>
                </p>

                <ul className="twins-prep__picks">
                    {portal.picks.map((pick) => {
                        const href = link(pick.url);
                        return (
                            <li key={pick.label} className="twins-prep__pick">
                                <div className="twins-prep__pick-head">
                                    <span>{pick.label}</span>
                                    {href ? (
                                        <a
                                            className="button ghost"
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Go
                                            <ExternalLink size={13} aria-hidden="true" />
                                        </a>
                                    ) : null}
                                </div>
                                <p>{pick.detail}</p>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <p className="grow-feature-heading">Carts</p>

            <div className="twins-prep__kit-rail tp-rail" role="tablist" aria-label="Prep kits">
                {kits.map((entry) => {
                    const Icon = KIT_ICONS[entry.icon] || Package;
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            role="tab"
                            aria-selected={entry.id === kitId}
                            className={
                                entry.id === kitId
                                    ? "twins-prep__kit-chip is-active"
                                    : "twins-prep__kit-chip"
                            }
                            onClick={() => setKitId(entry.id)}
                        >
                            <Icon size={16} aria-hidden="true" />
                            <span>{entry.short}</span>
                        </button>
                    );
                })}
            </div>

            <div className="twins-prep__panel" key={kit.id}>
                <div className="twins-prep__kit-head">
                    <div>
                        <span className="eyebrow">{kit.when}</span>
                        <h4>
                            <KitIcon size={16} aria-hidden="true" />
                            <span>{kit.headline}</span>
                        </h4>
                    </div>
                    {kitCartUrl ? (
                        <a
                            className="button secondary"
                            href={kitCartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <ShoppingCart size={14} aria-hidden="true" />
                            Fill cart &middot; {kit.items.length} items
                        </a>
                    ) : null}
                </div>

                <p className="twins-prep__note">{kit.note}</p>

                {kit.items && kit.items.length ? (
                    <ul className="twins-prep__items">
                        {kit.items.map((item) => {
                            const href = cartLink(cartUrlForItems([item]));
                            return (
                                <li key={item.asin + item.name} className="twins-prep__item">
                                    <div className="twins-prep__item-head">
                                        <span className="twins-prep__item-name">{item.name}</span>
                                        <span className="pill">{item.qty}&times;</span>
                                        <span className="twins-prep__item-price">{item.price}</span>
                                    </div>
                                    <p className="twins-prep__item-why">{item.why}</p>
                                    {href ? (
                                        <a
                                            className="button ghost"
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Add {item.qty} to cart
                                            <ExternalLink size={13} aria-hidden="true" />
                                        </a>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : null}

                {kit.steps && kit.steps.length ? (
                    <ol className="twins-prep__steps">
                        {kit.steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                ) : null}

                {kit.math ? (
                    <div className="twins-prep__math">
                        <span className="eyebrow">{kit.math.title}</span>
                        {kit.math.rows.map((row) => (
                            <div className="twins-prep__math-row" key={row[0]}>
                                {row.map((cell, cellIndex) => (
                                    <span key={cell + cellIndex}>{cell}</span>
                                ))}
                            </div>
                        ))}
                        <p>{kit.math.footer}</p>
                    </div>
                ) : null}

                {kit.warnings && kit.warnings.length ? (
                    <ul className="twins-prep__warnings">
                        {kit.warnings.map((warning) => (
                            <li key={warning} className="twins-prep__warn">
                                <TriangleAlert size={14} aria-hidden="true" />
                                <span>{warning}</span>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>

            <p className="twins-prep__budget">
                <strong>
                    ${realisticBudget.low}&ndash;${realisticBudget.high}
                </strong>{" "}
                is what this entire list costs, against the {realisticBudget.contrast} a
                standard twin registry implies. {realisticBudget.note}
            </p>

            <p className="route-reporting-note">
                Every link opens the storefront or prefills an Amazon cart. TwinPath never
                completes a purchase and carries no affiliate or referral tag on any link here.
                Offers verified {longDate(PREP_VERIFIED_ON)} &mdash; confirm price and terms on
                the merchant&apos;s own page before paying.
            </p>
        </div>
    );
}
