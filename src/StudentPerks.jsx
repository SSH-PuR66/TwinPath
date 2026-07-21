import { useEffect, useState } from "react";
import { ExternalLink, GraduationCap, ShieldCheck } from "lucide-react";
import { studentPerks } from "./opportunityCatalog";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";

export default function StudentPerks({ householdId, currentUserId, onTrack }) {
    const [tracking, setTracking] = useState({});
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!householdId || !currentUserId) return;
        let active = true;
        supabase
            .from("student_perk_tracking")
            .select("perk_id,status,monthly_savings,expires_on")
            .eq("household_id", householdId)
            .eq("owner_user_id", currentUserId)
            .then(({ data }) => {
                if (!active || !Array.isArray(data)) return;
                setTracking(Object.fromEntries(data.map((item) => [item.perk_id, item])));
            });
        return () => {
            active = false;
        };
    }, [currentUserId, householdId]);

    function updateTracking(perkId, changes) {
        setTracking((current) => ({
            ...current,
            [perkId]: {
                status: "reviewing",
                monthly_savings: 0,
                expires_on: "",
                ...current[perkId],
                ...changes,
            },
        }));
    }

    async function saveTracking(perkId) {
        const item = tracking[perkId] || {};
        setMessage("");
        const { error } = await supabase.from("student_perk_tracking").upsert({
            household_id: householdId,
            owner_user_id: currentUserId,
            perk_id: perkId,
            status: item.status || "reviewing",
            monthly_savings: Number(item.monthly_savings) || 0,
            expires_on: item.expires_on || null,
            last_verified_on: item.status === "active"
                ? new Date().toISOString().slice(0, 10)
                : null,
        }, { onConflict: "owner_user_id,perk_id" });
        setMessage(error
            ? "Tracking could not be saved. Apply the latest database migration, then retry."
            : "Student perk tracking saved.");
    }

    return (
        <section className="student-perks">
            <header className="grow-feature-heading">
                <div>
                    <span className="eyebrow">OFFICIAL LINKS ONLY</span>
                    <h2>Student perks without the noise</h2>
                    <p>
                        Check what is available before paying full price. TwinPath does not
                        receive referral credit and does not add affiliate identifiers.
                    </p>
                </div>
                <GraduationCap size={30} aria-hidden="true" />
            </header>

            <div className="grow-notice">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                    Offers, prices, eligibility, school verification, regions, and renewal
                    terms change. A discount only reduces expenses when the purchase was
                    already necessary. Confirm every offer on the official site.
                </span>
            </div>
            {message && <div className="grow-notice" role="status">{message}</div>}

            <div className="perk-grid">
                {studentPerks.map((perk) => {
                    const url = safeExternalUrl(perk.officialUrl, {
                        allowLocalHttp: false,
                    });

                    return (
                        <article className="perk-card" key={perk.id}>
                            <span className="pill blue">{perk.category}</span>
                            <h3>{perk.title}</h3>
                            <p>{perk.description}</p>
                            <div className="route-reporting-note">
                                <ShieldCheck size={15} aria-hidden="true" />
                                <span>{perk.warning}</span>
                            </div>
                            <div className="perk-tracking">
                                <label>
                                    <span>Status</span>
                                    <select
                                        value={tracking[perk.id]?.status || "reviewing"}
                                        onChange={(event) => updateTracking(perk.id, { status: event.target.value })}
                                    >
                                        <option value="reviewing">Reviewing</option>
                                        <option value="active">Active</option>
                                        <option value="expired">Expired</option>
                                        <option value="not_eligible">Not eligible</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Realized monthly savings</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100000"
                                        inputMode="decimal"
                                        value={tracking[perk.id]?.monthly_savings || 0}
                                        onChange={(event) => updateTracking(perk.id, { monthly_savings: event.target.value })}
                                    />
                                </label>
                                <label>
                                    <span>Review or expiry date</span>
                                    <input
                                        type="date"
                                        value={tracking[perk.id]?.expires_on || ""}
                                        onChange={(event) => updateTracking(perk.id, { expires_on: event.target.value })}
                                    />
                                </label>
                            </div>
                            <div className="perk-actions">
                                {url && (
                                    <a
                                        className="button secondary"
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Official site <ExternalLink size={15} />
                                    </a>
                                )}
                                {typeof onTrack === "function" && (
                                    <button
                                        className="button ghost"
                                        type="button"
                                        onClick={() => onTrack(perk)}
                                    >
                                        Track review
                                    </button>
                                )}
                                <button
                                    className="button secondary"
                                    type="button"
                                    disabled={!householdId || !currentUserId}
                                    onClick={() => saveTracking(perk.id)}
                                >
                                    Save status
                                </button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
