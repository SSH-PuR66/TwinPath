import { useCallback, useEffect, useRef, useState } from "react";
import {
    BadgeCheck,
    CircleOff,
    CreditCard,
    Landmark,
    Link2,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Unlink,
    WalletCards,
} from "lucide-react";
import { safeCheckoutUrl, safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";
import { Skeleton } from "./Skeleton";
import { CONTROL_PLANE_TIMEOUT_MS, readControlPlaneResponse } from "./useControlPlane";
import { isE2EMockAuth } from "./mockAuth";

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
    onOpenWallet,
}) {
    const controlPlaneUrl = isE2EMockAuth ? "" : (
        safeExternalUrl(String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim(), {
            allowLocalHttp: true,
        }) || ""
    ).replace(/\/+$/, "");
    const [state, setState] = useState({
        provider_mode: "unconfigured",
        readiness: [],
        connections: [],
        accounts: [],
        liabilities: [],
        recurring: [],
        product_status: [],
        aggregation: {},
        billing: {},
    });
    const [busy, setBusy] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");
    const oauthResumeAttempted = useRef(false);
    const providerDisabled = state.provider_mode === "disabled";
    const plaidReady = state.readiness.some((item) => item.id === "plaid" && item.status === "ready");
    const autonomousSyncReady = state.provider_mode === "production" && plaidReady;
    const syncState = autonomousSyncReady
        ? (state.connections.length ? "automatic" : "ready")
        : "manual";

    const apiRequest = useCallback(async (path, options = {}) => {
        if (!controlPlaneUrl) throw new Error("Financial connections are not configured.");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session?.access_token) throw new Error("Sign in again to continue.");

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), CONTROL_PLANE_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(`${controlPlaneUrl}${path}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${data.session.access_token}`,
                    "X-Household-Id": String(householdId),
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...options.headers,
                },
            });
        } catch (fetchError) {
            if (fetchError?.name === "AbortError") throw new Error("Financial connections took longer than 8 seconds. Retry, or import a CSV instead.");
            throw fetchError;
        } finally { window.clearTimeout(timeout); }
        const payload = await readControlPlaneResponse(response);
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
                accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
                liabilities: Array.isArray(payload.liabilities) ? payload.liabilities : [],
                recurring: Array.isArray(payload.recurring) ? payload.recurring : [],
                product_status: Array.isArray(payload.product_status) ? payload.product_status : [],
                aggregation: payload.aggregation || {},
                billing: payload.billing || {},
            });
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
            setLoaded(true);
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

    const money = (value, currency = "USD") => privateMode
        ? "••••"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
        }).format(Number(value) || 0);

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

    if (!loaded && busy === "refresh") return <section className="connections-panel" aria-label="Loading financial connections"><Skeleton className="skeleton-hero" /><Skeleton className="skeleton-list" /></section>;

    return (
        <section className="connections-panel">
            <header className="grow-feature-heading">
                <div>
                    <span className="eyebrow">CONNECTIONS</span>
                    <h2>Live financial connections</h2>
                    <p>
                        Plaid handles your bank sign-in, then TwinPath keeps balances and transactions current
                        with read-only updates. TwinPath never sees your bank login and never moves money —
                        you approve every plan.
                    </p>
                </div>
                <Link2 size={30} />
            </header>

            <div className="money-boundary-grid" aria-label="Financial feature boundaries">
                <article>
                    <Landmark size={20} />
                    <div>
                        <strong>Live Plaid sync</strong>
                        <span>
                            {autonomousSyncReady
                                ? "Automatic, read-only balance and transaction refreshes. No transfers or purchases."
                                : "Read-only balances and transactions. No transfers or purchases."}
                        </span>
                    </div>
                </article>
                <article>
                    <CreditCard size={20} />
                    <div>
                        <strong>Stripe billing</strong>
                        <span>Pays only for TwinPath plans. It does not fund wallet proposals.</span>
                    </div>
                </article>
                <article>
                    <WalletCards size={20} />
                    <div>
                        <strong>Approval wallet</strong>
                        <span>A manual decision ledger that never charges a connected account.</span>
                    </div>
                    {onOpenWallet && (
                        <button className="button ghost" type="button" onClick={onOpenWallet}>
                            Open wallet
                        </button>
                    )}
                </article>
            </div>

            <div className="connection-status-grid" aria-live="polite">
                <article>
                    <span>Provider mode</span>
                    <strong>{state.provider_mode.replaceAll("_", " ")}</strong>
                </article>
                <article>
                    <span>Connected institutions</span>
                    <strong>{state.connections.length}</strong>
                </article>
                <article>
                    <span>Sync status</span>
                    <strong>{syncState}</strong>
                </article>
            </div>

            {state.accounts.length > 0 && (
                <div className="connection-status-grid financial-aggregate-grid" aria-label="Linked account totals">
                    <article>
                        <span>Available cash</span>
                        <strong>{money(state.aggregation.available_cash)}</strong>
                    </article>
                    <article>
                        <span>Deposit balance</span>
                        <strong>{money(state.aggregation.deposit_balance)}</strong>
                    </article>
                    <article>
                        <span>Credit and loan balance</span>
                        <strong>{money(state.aggregation.debt_balance)}</strong>
                    </article>
                </div>
            )}

            {state.product_status
                .filter((item) => ["liabilities", "recurring"].includes(item.product))
                .map((item) => (
                    <div className="grow-notice" key={`${item.plaid_item_id}-${item.product}`}>
                        <ShieldCheck size={18} />
                        <span>
                            {item.product === "liabilities" ? "Liabilities" : "Recurring analysis"}: {item.status === "enabled"
                                ? "available from this provider"
                                : "not enabled by this provider"}.
                        </span>
                    </div>
                ))}

            {!controlPlaneUrl && (
                <div className="grow-notice">
                    <ShieldCheck size={18} />
                    <span>
                        Financial providers are not enabled in this deployment. Controls stay
                        safely disabled and no unauthenticated fallback is used.
                    </span>
                </div>
            )}
            {controlPlaneUrl && providerDisabled && (
                <div className="grow-notice">
                    <ShieldCheck size={18} />
                    <span>
                        The provider service is intentionally disabled. Configure and verify
                        Plaid or Stripe before these controls can be used.
                    </span>
                </div>
            )}
            {error && <div className="error-box" role="alert">{error}</div>}
            {error && <button className="button secondary" type="button" onClick={refresh}><RefreshCw size={16} /> Retry connections</button>}

            {state.readiness.length > 0 && (
                <div className="readiness-list">
                    {state.readiness.map((check, index) => (
                        <div key={check.id || index}>
                            {check.status === "ready" || check.status === "passed" ? (
                                <BadgeCheck size={17} />
                            ) : (
                                <CircleOff size={17} />
                            )}
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
                        !plaidReady}>
                    {busy === "connect" ? <Loader2 className="spin" size={17} /> : <Link2 size={17} />}
                    Connect financial institution
                </button>
                <button className="button secondary" type="button" onClick={refresh}
                    disabled={!controlPlaneUrl || Boolean(busy)}>
                    <RefreshCw className={busy === "refresh" ? "spin" : ""} size={17} /> Refresh view
                </button>
                <button className="button secondary" type="button"
                    onClick={() => mutate("sync-all", "/v1/plaid/transactions/sync", {
                        method: "POST",
                        body: JSON.stringify({}),
                    })}
                    disabled={!controlPlaneUrl || Boolean(busy) || state.connections.length === 0}>
                    <RefreshCw className={busy === "sync-all" ? "spin" : ""} size={17} /> Sync all bank data
                </button>
                <button className="button secondary" type="button" onClick={() => openBilling("checkout")}
                    disabled={!controlPlaneUrl || Boolean(busy) || !state.billing.checkout_ready}>
                    <CreditCard size={17} /> TwinPath checkout
                </button>
                <button className="button ghost" type="button" onClick={() => openBilling("portal")}
                    disabled={!controlPlaneUrl || Boolean(busy) || !state.billing.portal_ready}>
                    Manage TwinPath billing
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
                                    ? ` · automatically synced ${new Date(connection.last_synced_at).toLocaleString()}`
                                    : autonomousSyncReady ? " · automatic sync is standing by" : " · not synced yet"}
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
                    <div className="empty">No bank connected yet. Connect one for a live 90-day picture, or import a CSV in about two minutes. Bank deposits can take a few minutes to appear after Chime posts them.</div>
                )}
            </div>

            {state.accounts.length > 0 && (
                <div className="connection-list" aria-label="Linked bank accounts">
                    {state.accounts.map((account) => (
                        <article key={account.id}>
                            <div>
                                <span className="pill blue">{account.type || "account"}</span>
                                <h3>{privateMode ? "Linked account" : account.name}</h3>
                                <small>
                                    {privateMode ? "••••" : [account.institution_name, account.mask ? `••${account.mask}` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    {account.updated_at ? ` · updated ${new Date(account.updated_at).toLocaleString()}` : ""}
                                </small>
                            </div>
                            <div className="connection-account-balances">
                                <span>Current <strong>{money(account.current_balance, account.currency)}</strong></span>
                                <span>Available <strong>{money(account.available_balance, account.currency)}</strong></span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {state.liabilities.length > 0 && (
                <div className="connection-list" aria-label="Linked liabilities">
                    {state.liabilities.map((liability) => (
                        <article key={liability.id}>
                            <div>
                                <span className="pill blue">{liability.liability_type}</span>
                                <h3>{privateMode ? "Linked liability" : `Account ••${liability.account_id.slice(-4)}`}</h3>
                                <small>{liability.next_payment_due_date
                                    ? `Next due ${new Date(`${liability.next_payment_due_date}T00:00:00`).toLocaleDateString()}`
                                    : "No provider due date available"}</small>
                            </div>
                            <div className="connection-account-balances">
                                <span>Balance <strong>{money(liability.current_balance, liability.currency)}</strong></span>
                                <span>Minimum <strong>{money(liability.minimum_payment, liability.currency)}</strong></span>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {state.recurring.length > 0 && (
                <div className="connection-list" aria-label="Recurring bills and subscriptions">
                    {state.recurring.filter((stream) => stream.kind === "outflow").map((stream) => (
                        <article key={stream.id}>
                            <div>
                                <span className="pill blue">{stream.frequency || "recurring"}</span>
                                <h3>{privateMode ? "Recurring bill" : stream.description}</h3>
                                <small>{stream.next_date ? `Expected ${new Date(`${stream.next_date}T00:00:00`).toLocaleDateString()}` : "Next date unavailable"}</small>
                            </div>
                            <div className="connection-account-balances">
                                <span>Average <strong>{money(stream.average_amount, stream.currency)}</strong></span>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
