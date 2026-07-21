import { useCallback, useEffect, useRef, useState } from "react";
import {
    BadgeCheck,
    CreditCard,
    Link2,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Unlink,
} from "lucide-react";
import { safeCheckoutUrl, safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

function loadPlaidLink() {
    if (window.Plaid?.create) return Promise.resolve(window.Plaid);
    const safeScript = safeExternalUrl(PLAID_SCRIPT, {
        allowedHosts: ["cdn.plaid.com"],
        allowLocalHttp: false,
    });
    if (!safeScript) return Promise.reject(new Error("Plaid Link URL did not pass validation."));

    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-twinpath-plaid="true"]');
        if (existing) {
            existing.addEventListener("load", () => resolve(window.Plaid), { once: true });
            existing.addEventListener("error", () => reject(new Error("Plaid Link could not load.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = safeScript;
        script.async = true;
        script.dataset.twinpathPlaid = "true";
        script.referrerPolicy = "no-referrer";
        script.onload = () => window.Plaid?.create
            ? resolve(window.Plaid)
            : reject(new Error("Plaid Link did not initialize."));
        script.onerror = () => reject(new Error("Plaid Link could not load."));
        document.head.appendChild(script);
    });
}

export default function FinancialConnectionsPanel({
    householdId,
    currentUserId,
    privateMode = false,
}) {
    const controlPlaneUrl = (
        safeExternalUrl(String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim(), {
            allowLocalHttp: true,
        }) || ""
    ).replace(/\/+$/, "");
    const [state, setState] = useState({
        provider_mode: "unconfigured",
        readiness: [],
        connections: [],
        billing: {},
    });
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const oauthResumeAttempted = useRef(false);

    const apiRequest = useCallback(async (path, options = {}) => {
        if (!controlPlaneUrl) throw new Error("Financial connections are not configured.");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session?.access_token) throw new Error("Sign in again to continue.");

        const response = await fetch(`${controlPlaneUrl}${path}`, {
            ...options,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${data.session.access_token}`,
                "X-Household-Id": String(householdId),
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...options.headers,
            },
        });
        const text = await response.text();
        let payload = {};
        if (text) {
            try { payload = JSON.parse(text); }
            catch { payload = { message: text }; }
        }
        if (!response.ok) {
            throw new Error(payload.error?.message || payload.message || `Request failed (${response.status}).`);
        }
        return payload;
    }, [controlPlaneUrl, householdId]);

    const refresh = useCallback(async () => {
        if (!controlPlaneUrl || !householdId || !currentUserId) return;
        setBusy("refresh");
        setError("");
        try {
            const payload = await apiRequest("/v1/financial/connections");
            setState({
                provider_mode: payload.provider_mode || payload.mode || "unknown",
                readiness: Array.isArray(payload.readiness) ? payload.readiness : [],
                connections: Array.isArray(payload.connections) ? payload.connections : [],
                billing: payload.billing || {},
            });
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    }, [apiRequest, controlPlaneUrl, currentUserId, householdId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    function openPlaid(Plaid, linkToken, receivedRedirectUri) {
        const handler = Plaid.create({
            token: linkToken,
            ...(receivedRedirectUri ? { receivedRedirectUri } : {}),
            onSuccess: async (publicToken, metadata) => {
                try {
                    await apiRequest("/v1/financial/plaid/exchange", {
                        method: "POST",
                        body: JSON.stringify({
                            public_token: publicToken,
                            institution_id: metadata?.institution?.institution_id || null,
                            institution_name: metadata?.institution?.name || null,
                        }),
                    });
                    sessionStorage.removeItem("twinpath.plaid.link_token");
                    const completedUrl = new URL(window.location.href);
                    if (completedUrl.searchParams.has("oauth_state_id")) {
                        completedUrl.searchParams.delete("oauth_state_id");
                        window.history.replaceState({}, "", completedUrl);
                    }
                    await refresh();
                } catch (requestError) {
                    setError(requestError.message);
                } finally {
                    setBusy("");
                }
            },
            onExit: (plaidError) => {
                if (plaidError) {
                    setError(plaidError.display_message || "Plaid Link closed with an error.");
                }
                setBusy("");
            },
        });
        handler.open();
    }

    useEffect(() => {
        const oauthState = new URL(window.location.href).searchParams.get("oauth_state_id");
        const linkToken = sessionStorage.getItem("twinpath.plaid.link_token");
        if (!oauthState || !linkToken || oauthResumeAttempted.current) return;
        oauthResumeAttempted.current = true;
        setBusy("connect");
        loadPlaidLink()
            .then((Plaid) => openPlaid(Plaid, linkToken, window.location.href))
            .catch((resumeError) => {
                setError(resumeError.message);
                setBusy("");
            });
    }, [apiRequest, refresh]);

    async function connectPlaid() {
        setBusy("connect");
        setError("");
        try {
            const [Plaid, tokenPayload] = await Promise.all([
                loadPlaidLink(),
                apiRequest("/v1/financial/plaid/link-token", {
                    method: "POST",
                    body: JSON.stringify({}),
                }),
            ]);
            if (!tokenPayload.link_token) throw new Error("The provider did not return a Plaid Link token.");
            sessionStorage.setItem("twinpath.plaid.link_token", tokenPayload.link_token);
            openPlaid(Plaid, tokenPayload.link_token);
        } catch (requestError) {
            setError(requestError.message);
            setBusy("");
        }
    }

    async function mutate(key, path, options = {}) {
        setBusy(key);
        setError("");
        try {
            await apiRequest(path, options);
            await refresh();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    }

    async function openBilling(kind) {
        setBusy(kind);
        setError("");
        try {
            const payload = await apiRequest(`/v1/billing/${kind}`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            const url = safeCheckoutUrl(payload.url);
            if (!url) throw new Error("The billing provider returned an unapproved destination.");
            window.location.assign(url);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    }

    return (
        <section className="connections-panel">
            <header className="grow-feature-heading">
                <div>
                    <span className="eyebrow">CONNECTIONS</span>
                    <h2>Financial data, on your terms</h2>
                    <p>
                        Plaid Link is loaded only when you choose Connect. TwinPath never
                        asks for bank credentials directly and all control-plane calls require
                        your authenticated household session.
                    </p>
                </div>
                <Link2 size={30} />
            </header>

            <div className="connection-status-grid">
                <article>
                    <span>Provider mode</span>
                    <strong>{state.provider_mode.replaceAll("_", " ")}</strong>
                </article>
                <article>
                    <span>Connected institutions</span>
                    <strong>{state.connections.length}</strong>
                </article>
                <article>
                    <span>Readiness checks</span>
                    <strong>{state.readiness.filter((item) => item.status === "ready" || item.status === "passed").length}/{state.readiness.length}</strong>
                </article>
            </div>

            {!controlPlaneUrl && (
                <div className="grow-notice">
                    <ShieldCheck size={18} />
                    <span>
                        VITE_CONTROL_PLANE_URL is not configured. Provider controls remain
                        disabled; no fallback credentials or unauthenticated calls are used.
                    </span>
                </div>
            )}
            {error && <div className="error-box" role="alert">{error}</div>}

            {state.readiness.length > 0 && (
                <div className="readiness-list">
                    {state.readiness.map((check, index) => (
                        <div key={check.id || index}>
                            <BadgeCheck size={17} />
                            <span>
                                <strong>{check.label || check.name || "Provider check"}</strong>
                                <small>{check.message || check.summary || check.status}</small>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {Array.isArray(state.billing.lifecycle) && state.billing.lifecycle.length > 0 && (
                <div className="readiness-list" aria-label="Recent refunds and disputes">
                    {state.billing.lifecycle.map((event) => (
                        <div key={event.stripe_event_id}>
                            <CreditCard size={17} />
                            <span>
                                <strong>{event.event_type.replaceAll(".", " ")}</strong>
                                <small>
                                    {event.status} · {privateMode
                                        ? "••••"
                                        : new Intl.NumberFormat("en-US", {
                                            style: "currency",
                                            currency: event.currency,
                                        }).format(event.amount)}
                                </small>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="connection-actions">
                <button className="button primary" type="button" onClick={connectPlaid}
                    disabled={!controlPlaneUrl || Boolean(busy) ||
                        !state.readiness.some((item) => item.id === "plaid" && item.status === "ready")}>
                    {busy === "connect" ? <Loader2 className="spin" size={17} /> : <Link2 size={17} />}
                    Connect institution
                </button>
                <button className="button secondary" type="button" onClick={refresh}
                    disabled={!controlPlaneUrl || Boolean(busy)}>
                    <RefreshCw className={busy === "refresh" ? "spin" : ""} size={17} /> Refresh
                </button>
                <button className="button secondary" type="button" onClick={() => openBilling("checkout")}
                    disabled={!controlPlaneUrl || Boolean(busy) || !state.billing.checkout_ready}>
                    <CreditCard size={17} /> Checkout
                </button>
                <button className="button ghost" type="button" onClick={() => openBilling("portal")}
                    disabled={!controlPlaneUrl || Boolean(busy) || !state.billing.portal_ready}>
                    Billing portal
                </button>
            </div>

            <div className="connection-list">
                {state.connections.length ? state.connections.map((connection) => (
                    <article key={connection.id}>
                        <div>
                            <span className="pill blue">{connection.provider || "Plaid"}</span>
                            <h3>{privateMode ? "Connected institution" : connection.institution_name || "Connected institution"}</h3>
                            <small>
                                {connection.status || "connected"}
                                {connection.last_synced_at
                                    ? ` · synced ${new Date(connection.last_synced_at).toLocaleString()}`
                                    : " · not synced yet"}
                            </small>
                        </div>
                        <div className="connection-card-actions">
                            <button className="button secondary" type="button"
                                disabled={Boolean(busy)}
                                onClick={() => mutate(`sync:${connection.id}`, `/v1/financial/connections/${encodeURIComponent(connection.id)}/sync`, {
                                    method: "POST",
                                    body: JSON.stringify({}),
                                })}>
                                <RefreshCw size={16} /> Sync
                            </button>
                            <button className="button danger" type="button"
                                disabled={Boolean(busy)}
                                onClick={() => mutate(`disconnect:${connection.id}`, `/v1/financial/connections/${encodeURIComponent(connection.id)}`, {
                                    method: "DELETE",
                                })}>
                                <Unlink size={16} /> Disconnect
                            </button>
                        </div>
                    </article>
                )) : (
                    <div className="empty">No financial institution is connected.</div>
                )}
            </div>
        </section>
    );
}
