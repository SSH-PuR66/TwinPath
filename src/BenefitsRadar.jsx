import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, HeartHandshake, Loader2, X } from "lucide-react";
import { safeExternalUrl } from "./safeUrl";
import { useControlPlane } from "./useControlPlane";

const statuses = ["researching", "eligible_likely", "applied", "approved", "denied", "renewing", "not_eligible"];
const statusLabel = (status) => String(status || "researching").replaceAll("_", " ");

export default function BenefitsRadar({ householdId, onToast }) {
    const { request, configured } = useControlPlane(householdId);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        if (!configured) return;
        try { setData(await request("/v1/benefits")); setError(""); }
        catch (loadError) { setError(loadError.message); }
    }, [configured, request]);

    useEffect(() => { refresh(); }, [refresh]);

    async function save(event) {
        event.preventDefault();
        if (!selected) return;
        setBusy(true);
        setError("");
        try {
            await request("/v1/benefits/enrollment", {
                method: "POST",
                body: JSON.stringify({
                    program_key: selected.key,
                    status: selected.enrollment?.status || "researching",
                    next_deadline_on: selected.enrollment?.next_deadline_on || null,
                    est_annual_value: Number(selected.enrollment?.est_annual_value) || 0,
                    notes: selected.enrollment?.notes || null,
                    checklist: selected.enrollment?.checklist || [],
                }),
            });
            onToast?.("Benefits status saved.");
            setSelected(null);
            await refresh();
        } catch (saveError) { setError(saveError.message); }
        finally { setBusy(false); }
    }

    function updateEnrollment(changes) {
        setSelected((current) => ({ ...current, enrollment: { ...(current.enrollment || {}), ...changes } }));
    }

    if (!configured) return null;
    const programs = Array.isArray(data?.programs) ? data.programs : [];
    return (
        <section className="benefits-radar" aria-labelledby="benefits-radar-title">
            <header className="money-tool-heading">
                <HeartHandshake size={23} />
                <div><span className="eyebrow">BENEFITS RADAR</span><h3 id="benefits-radar-title">Keep support programs in view</h3><p>{data?.disclaimer || "Loading household benefit opportunities…"}</p></div>
            </header>
            {data ? <div className="benefits-total"><span>Tracked annual value</span><strong>${Number(data.tracked_annual_value || 0).toLocaleString()}</strong></div> : null}
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {!data ? <div className="proposal-empty">Loading the benefit catalog…</div> : <div className="benefit-grid">{programs.map((program) => {
                const enrollment = program.enrollment;
                const deadline = enrollment?.next_deadline_on;
                return <article className="benefit-card" key={program.key}>
                    <div className="benefit-card-top"><span className="pill blue">{program.category}</span><span className={`status-chip ${enrollment?.status || "researching"}`}>{statusLabel(enrollment?.status)}</span></div>
                    <h4>{program.name}</h4><p>{program.eligibility_summary}</p>
                    {deadline ? <small className="deadline"><CalendarClock size={14} /> Deadline {new Date(`${deadline}T00:00:00`).toLocaleDateString()}</small> : <small>{program.est_value_note}</small>}
                    <button className="button ghost" type="button" onClick={() => setSelected({ ...program, enrollment: enrollment || { status: "researching", checklist: [] } })}>Review <ChevronRight size={16} /></button>
                </article>;
            })}</div>}
            {selected ? <div className="benefit-drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="benefit-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={`Review ${selected.name}`}><header><div><span className="eyebrow">BENEFIT CHECKLIST</span><h2>{selected.name}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close"><X size={19} /></button></header><p>{selected.how_to_apply}</p><a className="button secondary" href={safeExternalUrl(selected.official_url) || undefined} target="_blank" rel="noopener noreferrer">Official program site</a><form className="benefit-form" onSubmit={save}><label>Status<select value={selected.enrollment?.status || "researching"} onChange={(event) => updateEnrollment({ status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label>Next deadline<input type="date" value={selected.enrollment?.next_deadline_on || ""} onChange={(event) => updateEnrollment({ next_deadline_on: event.target.value || null })} /></label><label>Estimated annual value<input type="number" min="0" max="1000000" step="1" value={selected.enrollment?.est_annual_value || ""} onChange={(event) => updateEnrollment({ est_annual_value: event.target.value })} /></label><label>Notes<textarea value={selected.enrollment?.notes || ""} onChange={(event) => updateEnrollment({ notes: event.target.value })} maxLength={2000} /></label><div className="benefit-checklist"><strong>Checklist</strong>{(selected.enrollment?.checklist || []).map((item, index) => <label key={`${item.label}-${index}`}><input type="checkbox" checked={item.done} onChange={(event) => updateEnrollment({ checklist: selected.enrollment.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, done: event.target.checked } : entry) })} />{item.label}</label>)}{selected.enrollment?.checklist?.length ? null : <small>Add checklist items after your first application step.</small>}</div><button className="button primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} Save status</button></form></aside></div> : null}
        </section>
    );
}
