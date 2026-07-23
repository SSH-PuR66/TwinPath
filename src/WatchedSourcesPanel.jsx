import { ExternalLink, Eye, Link2, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { safeExternalUrl } from "./safeUrl";
import { useControlPlane } from "./useControlPlane";

function watcherLabel(url, fallback = "") {
    try {
        return fallback.trim().slice(0, 80) || new URL(url).hostname.replace(/^www\./, "").slice(0, 80);
    } catch {
        return fallback.trim().slice(0, 80);
    }
}

function displayDate(value) {
    if (!value) return "Waiting for its first check";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Check time unavailable";
    return `Checked ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export default function WatchedSourcesPanel({ householdId, sharedLink, onSharedLinkHandled }) {
    const { request, configured } = useControlPlane(householdId);
    const [watchers, setWatchers] = useState([]);
    const [label, setLabel] = useState("");
    const [url, setUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        if (!configured) return;
        try {
            const payload = await request("/v1/watchers");
            setWatchers(Array.isArray(payload.watchers) ? payload.watchers : []);
            setError("");
        } catch (readError) {
            setError(readError.message || "TwinPath could not load watched pages.");
        }
    }, [configured, request]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        if (!sharedLink?.url) return;
        setUrl(sharedLink.url);
        setLabel(watcherLabel(sharedLink.url, sharedLink.title || ""));
        onSharedLinkHandled?.();
    }, [onSharedLinkHandled, sharedLink]);

    async function addWatcher(event) {
        event.preventDefault();
        const safeUrl = safeExternalUrl(url, { allowLocalHttp: false });
        const safeLabel = watcherLabel(safeUrl || "", label);
        if (!safeUrl || !safeLabel) {
            setError("Paste a public HTTPS page and give it a short name.");
            return;
        }

        setBusy(true);
        setError("");
        try {
            const payload = await request("/v1/watchers", {
                method: "POST",
                body: JSON.stringify({ label: safeLabel, url: safeUrl }),
            });
            setWatchers((current) => [payload.watcher, ...current]);
            setLabel("");
            setUrl("");
        } catch (saveError) {
            setError(saveError.message || "TwinPath could not watch that page.");
        } finally {
            setBusy(false);
        }
    }

    async function deactivate(watcher) {
        setBusy(true);
        setError("");
        try {
            await request(`/v1/watchers/${encodeURIComponent(watcher.id)}/deactivate`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            setWatchers((current) => current.filter((item) => item.id !== watcher.id));
        } catch (deactivateError) {
            setError(deactivateError.message || "TwinPath could not stop that watcher.");
        } finally {
            setBusy(false);
        }
    }

    if (!configured) return null;

    return (
        <section className="watched-sources-panel" aria-labelledby="watched-sources-title">
            <header className="watched-sources-heading">
                <span className="watched-sources-icon"><Eye size={19} /></span>
                <div>
                    <span className="eyebrow">WATCHING</span>
                    <h3 id="watched-sources-title">Keep an eye on a page</h3>
                    <p>Share a product or program link to TwinPath, then watch it for public-page changes. No account login, purchase, or checkout happens here.</p>
                </div>
            </header>

            <form className="watched-sources-form" onSubmit={addWatcher}>
                <label className="field">
                    <span>What are you watching?</span>
                    <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="Can-Am Maverick goal" required />
                </label>
                <label className="field">
                    <span>Public page link</span>
                    <input value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…" maxLength={500} required />
                </label>
                <button className="button primary" type="submit" disabled={busy || watchers.length >= 12}>
                    {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Watch page
                </button>
            </form>

            <div className="watcher-trust-note"><ShieldCheck size={16} /><span>Page watching is read-only and checks public changes periodically. Product photos and account data are never imported automatically.</span></div>
            {error ? <div className="error-box" role="alert">{error}</div> : null}

            <div className="watched-sources-list">
                {watchers.length ? watchers.map((watcher) => {
                    const destination = safeExternalUrl(watcher.url, { allowLocalHttp: false });
                    return (
                        <article className="watched-source-row" key={watcher.id}>
                            <span className="watched-source-mark"><Link2 size={16} /></span>
                            <div>
                                <strong>{watcher.label}</strong>
                                <small>{displayDate(watcher.last_checked_at)}{watcher.last_changed_at ? " · Changed page noted" : ""}</small>
                            </div>
                            <div className="watched-source-actions">
                                {destination ? <a className="icon-button small" href={destination} target="_blank" rel="noopener noreferrer" aria-label={`Open ${watcher.label}`}><ExternalLink size={16} /></a> : null}
                                <button className="icon-button small danger" type="button" disabled={busy} onClick={() => deactivate(watcher)} aria-label={`Stop watching ${watcher.label}`}><X size={16} /></button>
                            </div>
                        </article>
                    );
                }) : <div className="watcher-empty">No pages watched yet. Paste a public product, school, or benefit page to keep its changes in one place.</div>}
            </div>
        </section>
    );
}
