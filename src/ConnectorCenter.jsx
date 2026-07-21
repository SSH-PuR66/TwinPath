import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Check,
    Clipboard,
    ExternalLink,
    FileCheck2,
    Link2,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Trash2,
} from "lucide-react";

import { connectorCatalog } from "./connectorCatalog";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";

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

export default function ConnectorCenter({ householdId, currentUserId }) {
    const [profile, setProfile] = useState(emptyProfile);
    const [selectedConnector, setSelectedConnector] = useState(
        connectorCatalog[0]
    );
    const [copiedField, setCopiedField] = useState("");
    const [saasDrafts, setSaasDrafts] = useState([]);
    const [draftsLoading, setDraftsLoading] = useState(false);

    const loadSaasDrafts = useCallback(async () => {
        if (!householdId || !currentUserId) return;
        setDraftsLoading(true);
        const { data, error } = await supabase
            .from("agent_artifacts")
            .select("id,file_name,metadata,created_at")
            .eq("household_id", householdId)
            .eq("owner_user_id", currentUserId)
            .eq("artifact_type", "connector_listing")
            .contains("metadata", { engine_id: "micro_saas" })
            .order("created_at", { ascending: false })
            .limit(12);
        if (!error) setSaasDrafts(Array.isArray(data) ? data : []);
        setDraftsLoading(false);
    }, [currentUserId, householdId]);

    useEffect(() => {
        loadSaasDrafts();
    }, [loadSaasDrafts]);

    const completedFields = useMemo(() => {
        return Object.values(profile).filter((value) =>
            String(value).trim()
        ).length;
    }, [profile]);

    async function copyValue(key) {
        const value = String(profile[key] || "").trim();

        if (!value) return;

        await navigator.clipboard.writeText(value);
        setCopiedField(key);

        window.setTimeout(() => {
            setCopiedField("");
        }, 1200);
    }

    async function sharePacket() {
        const text = Object.entries(profile)
            .filter(([, value]) => String(value).trim())
            .map(([key, value]) => {
                return `${profileLabels[key]}: ${value}`;
            })
            .join("\n");

        if (!text) return;

        if (navigator.share) {
            await navigator.share({
                title: "TwinPath application packet",
                text,
            });

            return;
        }

        await navigator.clipboard.writeText(text);
    }

    function clearPacket() {
        setProfile(emptyProfile);
        setCopiedField("");
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
                            <h4>Temporary application packet</h4>
                            <small>
                                {completedFields} fields prepared
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
                            <label className="field" key={key}>
                                <span>{profileLabels[key]}</span>

                                <div className="connector-copy-field">
                                    <input
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
                            </label>
                        ))}
                    </div>

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
