import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Check,
    Clipboard,
    ExternalLink,
    FileCheck2,
    Landmark,
    Link2,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Trash2,
    WalletCards,
} from "lucide-react";

import { connectorCatalog } from "./connectorCatalog";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";
import { useControlPlane } from "./useControlPlane";

const emptyProfile = {
    legalName: "",
    preferredEmail: "",
    phone: "",
    mailingAddress: "",
    residentialCounty: "",
    state: "New York",
    school: "Iona University",
    program: "Cybersecurity B.S.",
    expectedGraduation: "",
    currentIncome: "",
};

const profileLabels = {
    legalName: "Legal name",
    preferredEmail: "Email",
    phone: "Phone",
    mailingAddress: "Mailing address",
    residentialCounty: "Residential county",
    state: "State",
    school: "School",
    program: "Program",
    expectedGraduation: "Expected graduation",
    currentIncome: "Current income",
};

function packetFromVault(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return emptyProfile;
    }

    return Object.fromEntries(
        Object.keys(emptyProfile).map((key) => [
            key,
            typeof value[key] === "string" ? value[key].slice(0, 500) : "",
        ])
    );
}

async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Clipboard access is unavailable.");
}

export default function ConnectorCenter({
    householdId,
    currentUserId,
    onOpenConnections,
    onOpenWallet,
}) {
    const [profile, setProfile] = useState(emptyProfile);
    const [selectedConnector, setSelectedConnector] = useState(
        connectorCatalog[0]
    );
    const [copiedField, setCopiedField] = useState("");
    const [saasDrafts, setSaasDrafts] = useState([]);
    const [draftsLoading, setDraftsLoading] = useState(false);
    const [connectorNotice, setConnectorNotice] = useState("");
    const [connectorError, setConnectorError] = useState("");
    const [vaultBusy, setVaultBusy] = useState(false);
    const [vaultUpdatedAt, setVaultUpdatedAt] = useState("");
    const { request, configured } = useControlPlane(householdId);

    const loadSaasDrafts = useCallback(async () => {
        if (!householdId || !currentUserId) return;
        setDraftsLoading(true);
        setConnectorError("");
        const { data, error } = await supabase
            .from("agent_artifacts")
            .select("id,file_name,metadata,created_at")
            .eq("household_id", householdId)
            .eq("owner_user_id", currentUserId)
            .eq("artifact_type", "connector_listing")
            .contains("metadata", { engine_id: "micro_saas" })
            .order("created_at", { ascending: false })
            .limit(12);
        if (error) {
            setConnectorError(error.message || "Application drafts could not be loaded.");
        } else {
            setSaasDrafts(Array.isArray(data) ? data : []);
        }
        setDraftsLoading(false);
    }, [currentUserId, householdId]);

    useEffect(() => {
        loadSaasDrafts();
    }, [loadSaasDrafts]);

    const loadSavedPacket = useCallback(async () => {
        if (!configured) return;
        setVaultBusy(true);
        try {
            const payload = await request("/v1/profile");
            const savedPacket = packetFromVault(payload?.profile?.application_packet);
            if (Object.values(savedPacket).some((value) => value.trim())) {
                setProfile(savedPacket);
                setVaultUpdatedAt(payload.updated_at || "");
            }
        } catch (loadError) {
            setConnectorError(loadError.message || "Your saved application packet could not be loaded.");
        } finally {
            setVaultBusy(false);
        }
    }, [configured, request]);

    useEffect(() => {
        loadSavedPacket();
    }, [loadSavedPacket]);

    const completedFields = useMemo(() => {
        return Object.values(profile).filter((value) =>
            String(value).trim()
        ).length;
    }, [profile]);

    async function copyValue(key) {
        const value = String(profile[key] || "").trim();

        if (!value) return;

        setConnectorError("");
        setConnectorNotice("");
        try {
            await writeClipboard(value);
            setCopiedField(key);
            setConnectorNotice(`${profileLabels[key]} copied.`);

            window.setTimeout(() => {
                setCopiedField("");
            }, 1200);
        } catch (error) {
            setConnectorError(error.message || "This value could not be copied.");
        }
    }

    async function sharePacket() {
        const text = Object.entries(profile)
            .filter(([, value]) => String(value).trim())
            .map(([key, value]) => {
                return `${profileLabels[key]}: ${value}`;
            })
            .join("\n");

        if (!text) return;

        setConnectorError("");
        setConnectorNotice("");
        try {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: "TwinPath application packet",
                        text,
                    });
                    setConnectorNotice("Application packet shared.");
                    return;
                } catch (shareError) {
                    if (shareError?.name === "AbortError") return;
                }
            }

            await writeClipboard(text);
            setConnectorNotice(
                navigator.share
                    ? "Sharing was unavailable, so the application packet was copied."
                    : "Application packet copied."
            );
        } catch (error) {
            setConnectorError(error.message || "The application packet could not be shared.");
        }
    }

    function clearPacket() {
        setProfile(emptyProfile);
        setCopiedField("");
        setConnectorError("");
        setConnectorNotice("Temporary application packet cleared.");
    }

    async function savePacket() {
        if (!configured) {
            setConnectorError("TwinPath’s private profile service is not configured for this deployment.");
            return;
        }

        setVaultBusy(true);
        setConnectorError("");
        setConnectorNotice("");
        try {
            // Fetch the latest record before writing so other saved household
            // details are retained when this packet changes.
            const current = await request("/v1/profile");
            const payload = await request("/v1/profile", {
                method: "PUT",
                body: JSON.stringify({
                    profile: {
                        ...(current?.profile || {}),
                        application_packet: profile,
                    },
                }),
            });
            setVaultUpdatedAt(payload.updated_at || new Date().toISOString());
            setConnectorNotice("Application packet saved. It will prefill here when you return.");
        } catch (saveError) {
            setConnectorError(saveError.message || "Your application packet could not be saved.");
        } finally {
            setVaultBusy(false);
        }
    }

    return (
        <section className="connector-center">
            <div className="section-title">
                <div>
                    <span className="eyebrow">APPLICATION CONNECTORS</span>
                    <h3>Prepare once, apply accurately</h3>
                    <p>
                        Values remain in memory and disappear when the app is
                        fully closed or refreshed.
                    </p>
                </div>

                <Link2 size={25} />
            </div>

            <div className="connector-security-note">
                <ShieldCheck size={18} />

                <span>
                    Never enter passwords, Social Security numbers, benefit
                    IDs, account numbers, card details or authentication codes.
                </span>
            </div>

            <div className="connector-context-actions">
                <article>
                    <Landmark size={20} />
                    <div>
                        <strong>Financial connections stay separate</strong>
                        <span>They import read-only account data and never fill this packet.</span>
                    </div>
                    {onOpenConnections && (
                        <button className="button ghost" type="button" onClick={onOpenConnections}>
                            Open connections
                        </button>
                    )}
                </article>
                <article>
                    <WalletCards size={20} />
                    <div>
                        <strong>Purchases require a separate approval</strong>
                        <span>The approval wallet records decisions and never moves money.</span>
                    </div>
                    {onOpenWallet && (
                        <button className="button ghost" type="button" onClick={onOpenWallet}>
                            Open wallet
                        </button>
                    )}
                </article>
            </div>

            {connectorError && (
                <div className="error-box" role="alert">{connectorError}</div>
            )}
            {connectorNotice && (
                <div className="success-box" role="status">{connectorNotice}</div>
            )}

            <div className="connector-draft-list">
                <div className="connector-profile-heading">
                    <div>
                        <h4>Micro-SaaS listing drafts</h4>
                        <small>
                            Sandboxed drafts from the Operations Control Plane
                        </small>
                    </div>
                    <button
                        className="icon-button"
                        type="button"
                        onClick={loadSaasDrafts}
                        disabled={draftsLoading}
                        aria-label="Refresh SaaS listing drafts"
                    >
                        {draftsLoading ? (
                            <Loader2 className="spin" size={17} />
                        ) : (
                            <RefreshCw size={17} />
                        )}
                    </button>
                </div>

                {saasDrafts.length ? (
                    saasDrafts.map((draft) => (
                        <article className="connector-draft-card" key={draft.id}>
                            <span className="pill blue">Unpublished draft</span>
                            <strong>
                                {draft.metadata?.title || draft.file_name}
                            </strong>
                            <small>
                                Review in Operations before any public listing.
                            </small>
                        </article>
                    ))
                ) : (
                    <div className="empty compact">
                        No approved SaaS listing drafts yet.
                    </div>
                )}
            </div>

            <div className="connector-layout">
                <div className="connector-profile">
                    <div className="connector-profile-heading">
                        <div>
                            <h4>Application packet</h4>
                            <small>
                                {completedFields} fields prepared{vaultUpdatedAt ? " · saved for this household" : " · private until you save"}
                            </small>
                        </div>

                        <button
                            className="icon-button danger"
                            type="button"
                            onClick={clearPacket}
                            aria-label="Clear temporary packet"
                        >
                            <Trash2 size={17} />
                        </button>
                    </div>

                    <div className="connector-profile-grid">
                        {Object.entries(profile).map(([key, value]) => (
                            <div className="field" key={key}>
                                <label
                                    className="field-label connector-field-label"
                                    htmlFor={`connector-${key}`}
                                >
                                    {profileLabels[key]}
                                </label>

                                <div className="connector-copy-field">
                                    <input
                                        id={`connector-${key}`}
                                        value={value}
                                        autoComplete="off"
                                        onChange={(event) =>
                                            setProfile({
                                                ...profile,
                                                [key]: event.target.value,
                                            })
                                        }
                                    />

                                    <button
                                        type="button"
                                        onClick={() => copyValue(key)}
                                        disabled={!String(value).trim()}
                                        aria-label={`Copy ${profileLabels[key]}`}
                                    >
                                        {copiedField === key ? (
                                            <Check size={16} />
                                        ) : (
                                            <Clipboard size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="connector-packet-actions">
                        <button
                            className="button primary"
                            type="button"
                            onClick={savePacket}
                            disabled={!completedFields || vaultBusy || !configured}
                        >
                            {vaultBusy ? <Loader2 className="spin" size={17} /> : <Check size={17} />}
                            Save and prefill next time
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            onClick={sharePacket}
                            disabled={!completedFields}
                        >
                            <FileCheck2 size={17} />
                            Share or copy packet
                        </button>
                    </div>

                    <small className="connector-vault-note">
                        Saved details stay in your household profile until you choose to copy or share them. Official sites are opened separately and are never submitted automatically.
                    </small>
                </div>

                <div className="connector-catalog">
                    <div className="connector-list">
                        {connectorCatalog.map((connector) => (
                            <button
                                type="button"
                                key={connector.id}
                                className={
                                    selectedConnector.id === connector.id
                                        ? "active"
                                        : ""
                                }
                                onClick={() => setSelectedConnector(connector)}
                            >
                                <span>{connector.category}</span>
                                <strong>{connector.title}</strong>
                            </button>
                        ))}
                    </div>

                    <article className="connector-details">
                        <span className="pill blue">
                            {selectedConnector.category}
                        </span>

                        <h4>{selectedConnector.title}</h4>

                        <h5>Information commonly requested</h5>

                        <ul>
                            {selectedConnector.fields.map((field) => (
                                <li key={field}>
                                    <Check size={15} />
                                    {field}
                                </li>
                            ))}
                        </ul>

                        <h5>Documents to prepare</h5>

                        <ul>
                            {selectedConnector.documents.map((document) => (
                                <li key={document}>
                                    <FileCheck2 size={15} />
                                    {document}
                                </li>
                            ))}
                        </ul>

                        <div className="route-reporting-note">
                            <ShieldCheck size={15} />
                            <span>{selectedConnector.warning}</span>
                        </div>

                        {safeExternalUrl(selectedConnector.officialUrl) && (
                            <a
                                className="button primary"
                                href={safeExternalUrl(selectedConnector.officialUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open official application
                                <ExternalLink size={16} />
                            </a>
                        )}
                    </article>
                </div>
            </div>
        </section>
    );
}
