import { CalendarPlus, Link2, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { safeExternalUrl } from "./safeUrl";
import { useControlPlane } from "./useControlPlane";

const SOURCE_LABEL = { outlook: "Outlook", blackboard: "Blackboard", google: "Google", other: "Calendar" };

function syncSummary(feed) {
    if (feed.last_error) return `Could not read the feed: ${feed.last_error}`;
    if (!feed.last_sync_at) return "Waiting for its first sync";
    const date = new Date(feed.last_sync_at);
    const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const count = typeof feed.event_count === "number" ? `${feed.event_count} upcoming` : "";
    return [count, when ? `synced ${when}` : ""].filter(Boolean).join(" · ");
}

export default function CalendarFeedsPanel({ householdId, onSynced }) {
    const { request, configured } = useControlPlane(householdId);
    const [feeds, setFeeds] = useState([]);
    const [label, setLabel] = useState("");
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [showHelp, setShowHelp] = useState(false);

    const refresh = useCallback(async () => {
        if (!configured) return;
        try {
            const payload = await request("/v1/calendar/feeds");
            setFeeds(Array.isArray(payload.feeds) ? payload.feeds : []);
            setError("");
        } catch (readError) {
            setError(readError.message || "TwinPath could not load your calendar feeds.");
        }
    }, [configured, request]);

    useEffect(() => { refresh(); }, [refresh]);

    async function addFeed(event) {
        event.preventDefault();
        const safeUrl = safeExternalUrl(url, { allowLocalHttp: false });
        if (!safeUrl || !label.trim()) {
            setError("Paste the calendar's .ics link and give it a short name.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const payload = await request("/v1/calendar/feeds", { method: "POST", body: JSON.stringify({ label: label.trim(), url: safeUrl }) });
            setFeeds((current) => [payload.feed, ...current]);
            setLabel("");
            setUrl("");
            await refresh();
            onSynced?.();
        } catch (saveError) {
            setError(saveError.message || "TwinPath could not connect that calendar.");
        } finally {
            setBusy(false);
        }
    }

    async function syncNow(feed) {
        setBusy(true);
        setError("");
        try {
            await request(`/v1/calendar/feeds/${encodeURIComponent(feed.id)}/sync`, { method: "POST", body: JSON.stringify({}) });
            await refresh();
            onSynced?.();
        } catch (syncError) {
            setError(syncError.message || "TwinPath could not sync that calendar.");
        } finally {
            setBusy(false);
        }
    }

    async function remove(feed) {
        setBusy(true);
        setError("");
        try {
            await request(`/v1/calendar/feeds/${encodeURIComponent(feed.id)}`, { method: "DELETE" });
            setFeeds((current) => current.filter((item) => item.id !== feed.id));
            onSynced?.();
        } catch (removeError) {
            setError(removeError.message || "TwinPath could not disconnect that calendar.");
        } finally {
            setBusy(false);
        }
    }

    if (!configured) return null;

    return (
        <section className="watched-sources-panel" aria-labelledby="calendar-feeds-title">
            <header className="watched-sources-heading">
                <span className="watched-sources-icon"><CalendarPlus size={19} /></span>
                <div>
                    <span className="eyebrow">CONNECTED CALENDARS</span>
                    <h3 id="calendar-feeds-title">Bring in Outlook and Blackboard</h3>
                    <p>Each of them publishes a private calendar link. Paste it here and classes, deadlines and meetings land on the family calendar, refreshed every half hour. No password leaves your account.</p>
                </div>
            </header>

            <form className="watched-sources-form" onSubmit={addFeed}>
                <label className="field">
                    <span>Name</span>
                    <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="Blackboard · Fall 2026" required />
                </label>
                <label className="field">
                    <span>Calendar link (.ics)</span>
                    <input value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…/learn.ics" maxLength={800} required />
                </label>
                <button className="button primary" type="submit" disabled={busy || feeds.length >= 6}>
                    {busy ? <Loader2 className="spin" size={16} /> : <CalendarPlus size={16} />} Connect calendar
                </button>
            </form>

            <button className="button secondary" type="button" onClick={() => setShowHelp((value) => !value)} aria-expanded={showHelp}>
                {showHelp ? "Hide the steps" : "Where do I find the link?"}
            </button>
            {showHelp ? (
                <div className="feed-help">
                    <p><strong>Outlook (Iona email).</strong> Outlook on the web → Settings → Calendar → Shared calendars → Publish a calendar → pick your calendar, “Can view all details”, Publish → copy the <em>ICS</em> link.</p>
                    <p><strong>Blackboard.</strong> Calendar (left menu) → the gear or “Calendar settings” → Get external calendar link → copy the link that ends in <em>learn.ics</em>.</p>
                    <p><strong>PeopleSoft.</strong> It has no feed. Your class schedule appears in Blackboard once courses are published; for anything else, add it to Outlook and it flows through the Outlook link.</p>
                </div>
            ) : null}

            <div className="watcher-trust-note"><ShieldCheck size={16} /><span>Feeds are read-only links that only you can see. Disconnecting removes every event they added.</span></div>
            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <div className="watched-sources-list">
                {feeds.length ? feeds.map((feed) => (
                    <article className="watched-source-row" key={feed.id}>
                        <span className="watched-source-mark"><Link2 size={16} /></span>
                        <div>
                            <strong>{feed.label} <span className="feed-source-tag">{SOURCE_LABEL[feed.source] || SOURCE_LABEL.other}</span></strong>
                            <small>{syncSummary(feed)}</small>
                        </div>
                        <div className="watched-source-actions">
                            <button className="icon-button small" type="button" disabled={busy} onClick={() => syncNow(feed)} aria-label={`Sync ${feed.label} now`}><RefreshCw size={16} /></button>
                            <button className="icon-button small danger" type="button" disabled={busy} onClick={() => remove(feed)} aria-label={`Disconnect ${feed.label}`}><X size={16} /></button>
                        </div>
                    </article>
                )) : <div className="watcher-empty">No calendars connected yet. Outlook and Blackboard take about a minute each.</div>}
            </div>
        </section>
    );
}
