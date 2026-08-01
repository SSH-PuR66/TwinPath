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
        const appointmentSteps = (Array.isArray(appointments) ? appointments : [])
            .filter((appointment) => appointment.category !== "School")
            .map((appointment) => {
                const date = dayFrom(appointment.starts_at);
                return date && date >= today ? {
                    id: `appointment-${appointment.id}`,
                    kind: "appointment",
                    title: appointment.title,
                    detail: appointment.location || "Appointment",
                    date,
                    done: false,
                } : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 1);
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

    // The spine fills to the step you are on. Rows size to their own content, so the
    // list is as tall as the work in it -- the previous layout pinned the map to 31rem
    // and spread the steps across it so a decorative curve had room to weave.
    const progress = steps.length > 1
        ? `${(currentIndex / (steps.length - 1)) * 100}%`
        : "0%";

    // Fill from empty on the first view of a session, then hold. Returning to Home
    // should not replay the animation.
    const [spineProgress, setSpineProgress] = useState(
        () => (prefersReducedMotion || !drawPath ? progress : "0%")
    );

    useEffect(() => {
        if (prefersReducedMotion || !drawPath) {
            setSpineProgress(progress);
            return undefined;
        }
        const frame = requestAnimationFrame(() => setSpineProgress(progress));
        return () => cancelAnimationFrame(frame);
    }, [drawPath, prefersReducedMotion, progress]);

    useEffect(() => {
        if (!drawPath || prefersReducedMotion || !steps.length) return;
        try { sessionStorage.setItem(pathSeenKey, "true"); }
        catch { /* Session storage is optional. */ }
    }, [drawPath, prefersReducedMotion, steps.length]);

    return <section className="now-path" aria-labelledby="now-path-title">
        <header><div><span className="eyebrow">NOW PATH</span><h3 id="now-path-title">What to do right now</h3></div></header>
        {steps.length ? <ol
            className="now-path-steps"
            style={{ "--now-path-progress": spineProgress }}
        >{steps.map((step, index) => {
            const current = index === currentIndex;
            const node = <motion.span className={`now-path-node ${step.done ? "complete" : ""} ${current ? "current" : ""}`} initial={false} animate={current && !prefersReducedMotion ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: 0.6, times: [0, 0.5, 1] }}>{step.done ? <Check size={15} aria-hidden="true" /> : null}</motion.span>;
            const content = <><span className="now-path-step-copy"><strong>{step.title}</strong><small>{step.detail}</small></span>{step.date ? <time dateTime={step.date.toISOString()}>{dateDetail(step.date)}</time> : null}</>;
            return <li className="now-path-step" key={step.id} aria-current={current ? "step" : undefined}>{step.kind === "task" ? <button type="button" onClick={() => onOpenTask?.(step.task)}>{node}{content}</button> : <div>{node}{content}</div>}</li>;
        })}</ol> : <p className="now-path-empty">Nothing urgent right now</p>}
    </section>;
}
