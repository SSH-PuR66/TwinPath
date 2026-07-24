import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { format, isValid, startOfDay } from "date-fns";
import { useControlPlane } from "./useControlPlane";

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
const completeBenefitStatuses = new Set(["approved", "denied", "not_eligible"]);
const pathSeenKey = "twinpath-now-path-drawn";

function dayFrom(value) {
    if (!value) return null;
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return isValid(date) ? date : null;
}

function dateDetail(date) {
    return date ? format(date, "EEE, MMM d") : "";
}

export default function NowPath({ householdId, tasks = [], appointments = [], onOpenTask }) {
    const { request, configured } = useControlPlane(householdId);
    const prefersReducedMotion = useReducedMotion();
    const [benefitPrograms, setBenefitPrograms] = useState([]);
    const [drawPath] = useState(() => {
        try { return !sessionStorage.getItem(pathSeenKey); }
        catch { return false; }
    });

    useEffect(() => {
        if (!configured) return undefined;
        let active = true;
        request("/v1/benefits")
            .then((data) => { if (active) setBenefitPrograms(Array.isArray(data?.programs) ? data.programs : []); })
            .catch(() => { if (active) setBenefitPrograms([]); });
        return () => { active = false; };
    }, [configured, request]);

    const steps = useMemo(() => {
        const today = startOfDay(new Date());
        const datedTasks = (Array.isArray(tasks) ? tasks : []).map((task) => {
            const date = dayFrom(task.due_date);
            return date ? {
                id: `task-${task.id}`,
                kind: "task",
                task,
                title: task.title,
                detail: `${task.category || "General"} · ${task.priority || "medium"}`,
                date,
                done: Boolean(task.completed),
            } : null;
        }).filter(Boolean);
        const appointmentSteps = (Array.isArray(appointments) ? appointments : []).map((appointment) => {
            const date = dayFrom(appointment.starts_at);
            return date && date >= today ? {
                id: `appointment-${appointment.id}`,
                kind: "appointment",
                title: appointment.title,
                detail: appointment.location || "Appointment",
                date,
                done: false,
            } : null;
        }).filter(Boolean);
        const benefitSteps = benefitPrograms.map((program) => {
            const date = dayFrom(program?.enrollment?.next_deadline_on);
            return date ? {
                id: `benefit-${program.key}`,
                kind: "benefit",
                title: program.name,
                detail: "Benefit deadline",
                date,
                done: completeBenefitStatuses.has(program?.enrollment?.status),
            } : null;
        }).filter(Boolean);
        const undatedTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => !task.due_date).map((task) => ({
            id: `task-${task.id}`,
            kind: "task",
            task,
            title: task.title,
            detail: `${task.category || "General"} · ${task.priority || "medium"}`,
            date: null,
            done: Boolean(task.completed),
            priority: priorityRank[task.priority] ?? 4,
        }));
        const dated = [...datedTasks, ...appointmentSteps, ...benefitSteps]
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        return [...dated, ...undatedTasks.sort((a, b) => a.priority - b.priority)].slice(0, 5);
    }, [appointments, benefitPrograms, tasks]);

    const firstOpenIndex = steps.findIndex((step) => !step.done);
    const currentIndex = firstOpenIndex === -1 ? steps.length - 1 : firstOpenIndex;
    const visiblePath = steps.length ? (currentIndex + 1) / steps.length : 1;

    useEffect(() => {
        if (!drawPath || prefersReducedMotion || !steps.length) return;
        try { sessionStorage.setItem(pathSeenKey, "true"); }
        catch { /* Session storage is optional. */ }
    }, [drawPath, prefersReducedMotion, steps.length]);

    return <section className="now-path" aria-labelledby="now-path-title">
        <header><div><span className="eyebrow">NOW PATH</span><h3 id="now-path-title">What to do right now</h3></div></header>
        {steps.length ? <div className="now-path-map">
            <svg className="now-path-line" viewBox="0 0 120 500" preserveAspectRatio="none" aria-hidden="true">
                <path d="M60 30 C18 80 102 100 60 140 S18 210 60 250 S102 320 60 360 S18 430 60 470" pathLength="1" />
                <motion.path d="M60 30 C18 80 102 100 60 140 S18 210 60 250 S102 320 60 360 S18 430 60 470" pathLength="1" initial={{ pathLength: prefersReducedMotion || !drawPath ? visiblePath : 0 }} animate={{ pathLength: visiblePath }} transition={{ duration: prefersReducedMotion || !drawPath ? 0 : 0.8, ease: "easeOut" }} />
            </svg>
            <div className="now-path-steps">{steps.map((step, index) => {
                const current = index === currentIndex;
                const position = steps.length === 1 ? 50 : 6 + (index / (steps.length - 1)) * 88;
                const node = <motion.span className={`now-path-node ${step.done ? "complete" : ""} ${current ? "current" : ""}`} initial={false} animate={current && !prefersReducedMotion ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: 0.6, times: [0, 0.5, 1] }}>{step.done ? <Check size={15} aria-hidden="true" /> : null}</motion.span>;
                const content = <><span className="now-path-step-copy"><strong>{step.title}</strong><small>{step.detail}</small></span>{step.date ? <time dateTime={step.date.toISOString()}>{dateDetail(step.date)}</time> : null}</>;
                return <div className="now-path-step" key={step.id} style={{ "--now-path-position": `${position}%` }}>{step.kind === "task" ? <button type="button" onClick={() => onOpenTask?.(step.task)}>{node}{content}</button> : <div>{node}{content}</div>}</div>;
            })}</div>
        </div> : <p className="now-path-empty">Nothing urgent right now</p>}
    </section>;
}
