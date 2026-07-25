import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Check, CheckCircle2, ChevronRight, ExternalLink, HeartHandshake, Loader2, X } from "lucide-react";
import { AnimatedMoney } from "./AnimatedMoney";
import { safeExternalUrl } from "./safeUrl";
import { useControlPlane } from "./useControlPlane";

function officialSiteHost(url) {
    const safe = safeExternalUrl(url);
    if (!safe) return null;
    try {
        return new URL(safe).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

const statuses = ["researching", "eligible_likely", "applied", "approved", "denied", "renewing", "not_eligible"];
const statusLabel = (status) => String(status || "researching").replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
const TIER_ONE_CHECKLIST = [
    { key: "health", programKeys: ["chip_medicaid"], title: "Medicaid is active for Brianna and both twins", action: "Approved. In December, convert the two UNBORN Medicaid IDs to the babies’ real names and dates of birth. If a hospital bill arrives, ask for the financial-assistance application before paying it." },
    { key: "wic", programKeys: ["wic"], title: "WIC is enrolled", action: "Approved during pregnancy. After the birth, call the local agency to add both babies to the case." },
    { key: "tax", programKeys: ["vita", "ctc", "eitc"], title: "Put the 2027 tax appointment on the calendar", action: "Book VITA early and bring both Social Security numbers from the hospital paperwork." },
    { key: "snap", programKeys: ["snap"], title: "SNAP is enrolled", action: "Approved. Add the twins to the case once they arrive. Work-study still strengthens the student exemption." },
];

function enrollmentIsMoving(enrollment) {
    return ["applied", "approved", "renewing"].includes(enrollment?.status);
}

function deadlineTone(deadline) {
    if (!deadline) return "";
    const days = Math.ceil((new Date(`${deadline}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days < 14 ? "urgent" : "";
}

const NURSING_PROGRAMS = new Set(["wic", "chip_medicaid", "ny_childcare", "snap"]);
const CYBER_PROGRAMS = new Set(["tap", "savers_credit", "roth_ira", "ida_match"]);
const displayTrack = (track) => track === "cyber" ? "Cyber" : track === "nursing" ? "Nursing" : "Household";

function programTrack(program) {
    if (program?.enrollment?.track) return program.enrollment.track;
    if (NURSING_PROGRAMS.has(program?.key)) return "nursing";
    if (CYBER_PROGRAMS.has(program?.key)) return "cyber";
    return "household";
}

export default function BenefitsRadar({ householdId, onToast, memberTrack = "household", currentUserId }) {
    const { request, configured } = useControlPlane(householdId);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const prefersReducedMotion = useReducedMotion();

    const refresh = useCallback(async () => {
        if (!configured) return;
        try { setData(await request("/v1/benefits")); setError(""); }
        catch (loadError) { setError(loadError.message); }
    }, [configured, request]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        if (!selected) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [selected]);

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
                    track: selected.enrollment?.track || programTrack(selected),
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
    const visibleTracks = new Set(["household", memberTrack]);
    const orderedPrograms = [...programs]
        .filter((program) => visibleTracks.has(programTrack(program)))
        .sort((a, b) => Number(programTrack(b) === memberTrack) - Number(programTrack(a) === memberTrack));
    const programsByKey = new Map(programs.map((program) => [program.key, program]));
    const tierOneDone = TIER_ONE_CHECKLIST.filter((item) => item.programKeys.some((key) => enrollmentIsMoving(programsByKey.get(key)?.enrollment))).length;
    return (
        <section className="benefits-radar" aria-labelledby="benefits-radar-title">
            <div className="benefits-radar-content" inert={selected ? "" : undefined}>
            <header className="money-tool-heading">
                <HeartHandshake size={23} />
                <div><span className="eyebrow">BENEFITS RADAR</span><h3 id="benefits-radar-title">Keep support programs in view</h3><p>{data?.disclaimer || "Loading household benefit opportunities…"}</p></div>
            </header>
            {data ? <div className="benefits-total"><span>Tracked annual value</span><strong><AnimatedMoney value={Number(data.tracked_annual_value || 0)} whole reducedMotion={prefersReducedMotion} /></strong></div> : null}
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {!data ? <div className="proposal-empty">Loading the benefit catalog…</div> : <>
                <section className="twins-checklist" aria-labelledby="twins-checklist-title">
                    <div className="twins-checklist-heading">
                        <div><span className="eyebrow">TIER 1 · BEFORE THE TWINS</span><h4 id="twins-checklist-title">The four highest-confidence money moves</h4></div>
                        <span>{tierOneDone}/4 in motion</span>
                    </div>
                    <div className="twins-checklist-items">
                        {TIER_ONE_CHECKLIST.map((item) => {
                            const program = item.programKeys.map((key) => programsByKey.get(key)).find(Boolean);
                            const complete = item.programKeys.some((key) => enrollmentIsMoving(programsByKey.get(key)?.enrollment));
                            return <button className={`twins-checklist-item ${complete ? "complete" : ""}`} type="button" key={item.key} onClick={() => program && setSelected({ ...program, enrollment: program.enrollment || { status: "researching", checklist: [] } })}>
                                <span className="twins-checkmark">{complete ? <Check size={15} /> : null}</span>
                                <span><strong>{item.title}</strong><small>{item.action}</small></span>
                                <ChevronRight size={17} aria-hidden="true" />
                            </button>;
                        })}
                    </div>
                </section>
                <div className="benefit-grid">{orderedPrograms.map((program) => {
                const enrollment = program.enrollment;
                const deadline = enrollment?.next_deadline_on;
                const checklist = enrollment?.checklist || [];
                const checklistDone = checklist.filter((item) => item.done).length;
                return <article className="benefit-card" key={program.key}>
                    <div className="benefit-card-top"><span className="benefit-meta">{program.category}</span><span className="benefit-meta">{displayTrack(programTrack(program))}</span><span className={`status-chip ${enrollment?.status || "researching"}`}>{statusLabel(enrollment?.status)}</span></div>
                    <h4>{program.name}</h4><p>{program.eligibility_summary}</p>
                    {deadline ? <small className={`deadline ${deadlineTone(deadline)}`}><CalendarClock size={14} /> {deadlineTone(deadline) ? "Act within 14 days · " : "Deadline "}{new Date(`${deadline}T00:00:00`).toLocaleDateString()}</small> : <small>{program.est_value_note}</small>}
                    {checklist.length ? <small className="benefit-progress">{checklistDone}/{checklist.length} checklist steps done</small> : null}
                    <button className="button ghost" type="button" onClick={() => setSelected({ ...program, enrollment: enrollment || { status: "researching", checklist: [] } })}>Review <ChevronRight size={16} /></button>
                </article>;
            })}</div>
            </>}
            </div>
            <AnimatePresence>{selected ? <motion.div className="benefit-drawer-backdrop" onMouseDown={() => setSelected(null)} initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}><motion.aside className="benefit-drawer" role="dialog" aria-modal="true" aria-label={`Review ${selected.name}`} onMouseDown={(event) => event.stopPropagation()} initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }} transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}><header><div><span className="eyebrow">BENEFIT CHECKLIST · {displayTrack(programTrack(selected)).toUpperCase()}</span><h2>{selected.name}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close"><X size={19} /></button></header><p>{selected.how_to_apply}{officialSiteHost(selected.official_url) ? <>{" "}<a className="inline-external-link" href={safeExternalUrl(selected.official_url) || undefined} target="_blank" rel="noopener noreferrer">{officialSiteHost(selected.official_url)}<ExternalLink size={13} aria-hidden="true" /></a></> : null}</p><form className="benefit-form" onSubmit={save}><fieldset className="benefit-status-control"><legend>Status</legend><div role="radiogroup" aria-label="Benefit status">{statuses.map((status) => <button key={status} className={selected.enrollment?.status === status || (!selected.enrollment?.status && status === "researching") ? "active" : ""} type="button" role="radio" aria-checked={selected.enrollment?.status === status || (!selected.enrollment?.status && status === "researching")} onClick={() => updateEnrollment({ status })}>{statusLabel(status)}</button>)}</div></fieldset><label>Next deadline<input type="date" value={selected.enrollment?.next_deadline_on || ""} onChange={(event) => updateEnrollment({ next_deadline_on: event.target.value || null })} /></label><label>Estimated annual value<input type="number" min="0" max="1000000" step="1" value={selected.enrollment?.est_annual_value || ""} onChange={(event) => updateEnrollment({ est_annual_value: event.target.value })} /></label><label>Notes<textarea value={selected.enrollment?.notes || ""} onChange={(event) => updateEnrollment({ notes: event.target.value })} maxLength={2000} /></label><div className="benefit-checklist"><strong>Your checklist progress</strong>{(selected.enrollment?.checklist || []).map((item, index) => <label key={`${item.label}-${index}`}><input type="checkbox" checked={item.done && item.done_by === currentUserId} onChange={(event) => updateEnrollment({ checklist: selected.enrollment.checklist.map((entry, entryIndex) => entryIndex === index ? { ...entry, done: event.target.checked, done_by: event.target.checked ? currentUserId : null } : entry) })} />{item.label}</label>)}{selected.enrollment?.checklist?.length ? null : <small>Add checklist items after your first application step.</small>}</div><button className="button primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />} Save status</button></form></motion.aside></motion.div> : null}</AnimatePresence>
        </section>
    );
}
