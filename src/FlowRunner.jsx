import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Clipboard, Copy, Loader2, Sparkles } from "lucide-react";
import { opportunityCatalog } from "./opportunityCatalog.js";
import {
    FLOW_CATALOG,
    PROFILE_SEED,
    activeSteps,
    flowById,
    flowProgress,
    pendingSteps,
    prefillCount,
    remainingMinutes,
    reviewAnswers,
} from "./flowCatalog.js";
import { useControlPlane } from "./useControlPlane.js";

function copyText(value) {
    if (!navigator.clipboard) return Promise.resolve();
    return navigator.clipboard.writeText(String(value || ""));
}

function mergeProfile(profile, answers) {
    return { ...PROFILE_SEED, ...(profile || {}), ...(answers || {}) };
}

function FlowEntry({ flow, profile, onOpen }) {
    const answered = prefillCount(flow, profile);
    const total = activeSteps(flow, profile).length;
    return (
        <article className="flow-entry-card">
            
            <h3>{flow.title}</h3>
            <p>{flow.estMinutes} min in TwinPath · {answered} of {total} already filled in</p>
            <button className="button secondary" type="button" onClick={() => onOpen(flow.id)}>Open flow</button>
        </article>
    );
}

function CopyRow({ label, value, onEdit }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        await copyText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
    }
    return (
        <div className="flow-copy-row">
            <div><strong>{label}</strong><span>{value || "Not answered"}</span></div>
            <div className="flow-copy-actions">
                {onEdit ? <button type="button" className="button ghost" onClick={onEdit}>Edit</button> : null}
                <button type="button" className="button ghost" onClick={copy} aria-label={`Copy ${label}`}>
                    {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
                </button>
            </div>
        </div>
    );
}

export default function FlowRunner({ householdId, flowIds = null, compact = false, initialProfile = null, initialFlowId = null, initialReview = false }) {
    const { request, configured } = useControlPlane(householdId);
    const [profile, setProfile] = useState(() => mergeProfile(PROFILE_SEED, initialProfile));
    const [openFlowId, setOpenFlowId] = useState(initialFlowId);
    const [answers, setAnswers] = useState({});
    const [sessionSteps, setSessionSteps] = useState(() => {
        const initialFlow = flowById(initialFlowId);
        return initialFlow ? pendingSteps(initialFlow, mergeProfile(PROFILE_SEED, initialProfile)) : [];
    });
    const [stepIndex, setStepIndex] = useState(0);
    const [review, setReview] = useState(initialReview);
    const [editingField, setEditingField] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (!configured) return undefined;
        let active = true;
        request("/v1/profile")
            .then((payload) => { if (active) setProfile((current) => mergeProfile(current, payload.profile)); })
            .catch(() => { if (active) setMessage("Your saved profile is unavailable right now. You can still review the guided steps."); });
        return () => { active = false; };
    }, [configured, request]);

    const availableFlows = useMemo(
        () => FLOW_CATALOG.filter((flow) => !flowIds || flowIds.includes(flow.id)),
        [flowIds],
    );
    const flow = flowById(openFlowId);
    const workingProfile = mergeProfile(profile, answers);
    const steps = flow ? sessionSteps : [];
    const editStep = flow ? activeSteps(flow, workingProfile).find((step) => step.field === editingField) : null;
    const currentStep = editStep || steps[stepIndex] || null;

    useEffect(() => { inputRef.current?.focus(); }, [currentStep?.id]);

    function open(id) {
        const nextFlow = flowById(id);
        setOpenFlowId(id);
        setAnswers({});
        setSessionSteps(nextFlow ? pendingSteps(nextFlow, profile) : []);
        setStepIndex(0);
        setReview(false);
        setEditingField(null);
        setMessage("");
    }

    function close() {
        setOpenFlowId(null);
        setAnswers({});
        setSessionSteps([]);
        setReview(false);
        setEditingField(null);
    }

    function next(event) {
        event.preventDefault();
        if (!currentStep) { setReview(true); return; }
        const value = answers[currentStep.field] ?? workingProfile[currentStep.field] ?? "";
        if (currentStep.validate && !currentStep.validate(value)) {
            setMessage("Please enter a complete answer before continuing.");
            return;
        }
        setMessage("");
        if (editingField) {
            setEditingField(null);
            setReview(true);
            return;
        }
        if (stepIndex + 1 >= steps.length) setReview(true);
        else setStepIndex((index) => index + 1);
    }

    async function confirm() {
        const completedAt = new Date().toISOString();
        const nextProfile = {
            ...workingProfile,
            flow_progress: {
                ...flowProgress(workingProfile),
                [flow.id]: { lastStepId: activeSteps(flow, workingProfile).at(-1)?.id || null, completedAt },
            },
        };
        setSaving(true);
        setMessage("");
        try {
            if (configured) await request("/v1/profile", { method: "PUT", body: JSON.stringify({ profile: nextProfile }) });
            setProfile(nextProfile);
            setAnswers({});
            setMessage("Saved to your household profile. The next flow will skip these answers.");
        } catch (error) {
            setMessage(error.message || "Your answers could not be saved. Please try again.");
        } finally { setSaving(false); }
    }

    if (!flow) {
        return (
            <section className={compact ? "flow-runner is-compact" : "flow-runner"} aria-label="Guided flows">
                {compact ? null : <div className="flow-runner-heading"><div><span className="eyebrow">GUIDED</span><h2>One question at a time</h2><p>We reuse what your household profile already knows, so you do not answer it twice.</p></div><Sparkles aria-hidden="true" size={20} /></div>}
                <div className="flow-entry-list">
                    {availableFlows.map((entry) => <FlowEntry key={entry.id} flow={entry} profile={profile} onOpen={open} />)}
                </div>
                {message ? <p className="flow-message" role="status">{message}</p> : null}
            </section>
        );
    }

    const total = activeSteps(flow, workingProfile).length;
    const completed = review ? total : total - steps.length + stepIndex;
    const minutes = review ? 0 : remainingMinutes(flow, workingProfile);
    const script = flow.callScript?.replace("{internet_provider}", workingProfile.internet_provider || "your provider");
    const resources = (flow.resourceIds || []).map((id) => opportunityCatalog.find((item) => item.id === id)).filter(Boolean);

    return (
        <section className="flow-runner flow-screen" aria-label={`${flow.title} guided flow`}>
            <header className="flow-topline">
                <button type="button" className="button ghost" onClick={close}><ChevronLeft size={16} /> All flows</button>
                <span>{review ? "Review" : `About ${minutes} min left`}</span>
            </header>
            <div className="flow-progress" aria-label={`${completed} of ${total} questions complete`}>
                {Array.from({ length: total }, (_, index) => <span className={index < completed ? "is-complete" : ""} key={index} />)}
            </div>
            {review ? (
                <div className="flow-review">
                    <span className="eyebrow">READY TO REVIEW</span>
                    <h2>{flow.title}</h2>
                    <p>These are the details TwinPath will keep in your household profile for later flows.</p>
                    <div className="flow-review-card">
                        {reviewAnswers(flow, workingProfile).map((item) => <CopyRow key={item.field} label={item.prompt} value={item.value} onEdit={() => { setEditingField(item.field); setReview(false); }} />)}
                    </div>
                    {flow.checklist ? <div className="flow-output"><h3>Copy-ready FAFSA checklist</h3>{flow.checklist.map(([label, field]) => <CopyRow key={field} label={label} value={workingProfile[field]} />)}</div> : null}
                    {script ? <div className="flow-output"><h3>Call script</h3><CopyRow label="Read or copy this" value={script} /></div> : null}
                    {resources.length ? <div className="flow-output"><h3>Useful program details</h3>{resources.map((item) => <CopyRow key={item.id} label={item.title} value={item.description} />)}</div> : null}
                    <p className="flow-boundary"><Clipboard size={16} aria-hidden="true" /> TwinPath organized this. Submitting it is yours to do.</p>
                    <button type="button" className="button primary" onClick={confirm} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Confirm and save</button>
                    {message ? <p className="flow-message" role="status">{message}</p> : null}
                </div>
            ) : currentStep ? (
                <form className="flow-question" onSubmit={next}>
                    <span className="eyebrow">QUESTION {Math.min(completed + 1, total)} OF {total}</span>
                    <h2>{currentStep.prompt}</h2>
                    {currentStep.help ? <p>{currentStep.help}</p> : null}
                    {currentStep.inputType === "select" ? (
                        <select ref={inputRef} value={answers[currentStep.field] ?? workingProfile[currentStep.field] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [currentStep.field]: event.target.value }))}>
                            <option value="">Choose one</option>
                            {currentStep.options.map((option) => <option value={option} key={option}>{option}</option>)}
                        </select>
                    ) : <input ref={inputRef} type={currentStep.inputType} inputMode={currentStep.inputMode} value={answers[currentStep.field] ?? workingProfile[currentStep.field] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [currentStep.field]: event.target.value }))} />}
                    {message ? <p className="flow-message" role="alert">{message}</p> : null}
                    <div className="flow-actions">
                        {stepIndex > 0 ? <button type="button" className="button ghost" onClick={() => setStepIndex((index) => index - 1)}><ChevronLeft size={16} /> Back</button> : null}
                        <button type="submit" className="button primary">{stepIndex + 1 >= steps.length ? "Review answers" : "Continue"}</button>
                    </div>
                </form>
            ) : <div className="flow-review"><h2>{flow.title}</h2><p>Everything this flow needs is already in your household profile.</p><button type="button" className="button primary" onClick={() => setReview(true)}>Review answers</button></div>}
        </section>
    );
}
