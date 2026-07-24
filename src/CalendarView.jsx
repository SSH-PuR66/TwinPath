import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DayPicker } from "react-day-picker";
import {
    CalendarDays,
    Car,
    Check,
    Clock3,
    Download,
    HelpCircle,
    MapPin,
    Plus,
    Trash2,
    X,
} from "lucide-react";

import { format, isSameDay, isValid, startOfDay } from "date-fns";

import "react-day-picker/style.css";

const categoryColors = {
    Prenatal: "var(--calendar-prenatal)",
    Ultrasound: "var(--calendar-ultrasound)",
    "Maternal-fetal medicine": "var(--calendar-maternal-fetal)",
    WIC: "var(--calendar-wic)",
    Benefits: "var(--calendar-benefits)",
    School: "var(--calendar-school)",
    "Financial aid": "var(--calendar-benefits)",
    Work: "var(--calendar-work)",
    Interview: "var(--calendar-interview)",
    Performance: "var(--calendar-performance)",
    Childcare: "var(--calendar-childcare)",
    Personal: "var(--calendar-personal)",
};

function safeDate(value) {
    const date = new Date(value);
    return isValid(date) ? date : null;
}

function appointmentColor(appointment) {
    return categoryColors[appointment.category] || categoryColors.Personal;
}

function appointmentEnd(appointment, start) {
    const explicitEnd = safeDate(appointment.ends_at);
    return explicitEnd && explicitEnd > start
        ? explicitEnd
        : new Date(start.getTime() + 60 * 60 * 1000);
}

function escapeICS(value = "") {
    return String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll("\n", "\\n")
        .replaceAll(",", "\\,")
        .replaceAll(";", "\\;");
}

function toICSDate(date) {
    return new Date(date)
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace(/\.\d{3}Z$/, "Z");
}

function downloadAppointmentICS(appointment) {
    const start = safeDate(appointment.starts_at);
    if (!start) return;

    const description = [
        appointment.notes,
        appointment.questions ? `Questions:\n${appointment.questions}` : "",
        appointment.transportation_plan
            ? `Transportation:\n${appointment.transportation_plan}`
            : "",
    ].filter(Boolean).join("\n\n");
    const reminderMinutes = Number(appointment.reminder_minutes);
    const reminderLines = Number.isFinite(reminderMinutes) && reminderMinutes > 0
        ? ["BEGIN:VALARM", `TRIGGER:-PT${reminderMinutes}M`, "ACTION:DISPLAY", `DESCRIPTION:${escapeICS(`Reminder: ${appointment.title}`)}`, "END:VALARM"]
        : [];
    const content = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TwinPath//Family Planner//EN",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
        `UID:${appointment.id}@twinpath`, `DTSTAMP:${toICSDate(new Date())}`,
        `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(appointmentEnd(appointment, start))}`,
        `SUMMARY:${escapeICS(appointment.title)}`, `LOCATION:${escapeICS(appointment.location || "")}`,
        `DESCRIPTION:${escapeICS(description)}`, ...reminderLines, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(appointment.title || "appointment").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "appointment"}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CalendarDayButton({ day, children, appointmentsByDate, ...buttonProps }) {
    const appointments = appointmentsByDate.get(format(day.date, "yyyy-MM-dd")) || [];
    const overflow = Math.max(0, appointments.length - 3);
    const baseLabel = buttonProps["aria-label"] || format(day.date, "PPP");

    return <button {...buttonProps} aria-label={appointments.length ? `${baseLabel}, ${appointments.length} appointments` : baseLabel}>
        <span className="calendar-day-number">{children}</span>
        {appointments.length ? <span className="calendar-day-markers" aria-hidden="true">
            <span className="calendar-day-dots">{appointments.slice(0, 3).map((appointment) => <i key={appointment.id} style={{ background: appointmentColor(appointment) }} />)}</span>
            {overflow ? <small>+{overflow}</small> : null}
        </span> : null}
    </button>;
}

function AppointmentTimelineRow({ appointment, currentUserId, onDelete, expanded, onToggle }) {
    const date = safeDate(appointment.starts_at);
    if (!date) return null;
    const end = appointmentEnd(appointment, date);
    const reminder = Number(appointment.reminder_minutes);

    return <article className={`day-sheet-appointment ${expanded ? "is-expanded" : ""}`}>
        <button className="day-sheet-appointment-summary" type="button" onClick={onToggle} aria-expanded={expanded}>
            <span className="day-sheet-category-line" style={{ background: appointmentColor(appointment) }} />
            <span className="day-sheet-appointment-time">{format(date, "h:mm a")}–{format(end, "h:mm a")}</span>
            <span className="day-sheet-appointment-copy"><strong>{appointment.title}</strong><small>{appointment.location || appointment.category || "Appointment"}</small></span>
        </button>
        {expanded ? <div className="day-sheet-appointment-detail">
            <div className="day-sheet-detail-meta">
                <span><Clock3 size={14} />{format(date, "EEEE, MMMM d · h:mm a")}</span>
                {appointment.location ? <span><MapPin size={14} />{appointment.location}</span> : null}
                {appointment.visibility === "private" ? <span>Only me</span> : null}
                {Number.isFinite(reminder) && reminder > 0 ? <span>Reminder {reminder} minutes before</span> : null}
            </div>
            {appointment.transportation_plan ? <div className="appointment-detail"><Car size={15} /><div><strong>Transportation</strong><p>{appointment.transportation_plan}</p></div></div> : null}
            {appointment.questions ? <div className="appointment-detail"><HelpCircle size={15} /><div><strong>Questions to ask</strong><p>{appointment.questions}</p></div></div> : null}
            {appointment.notes ? <p className="appointment-notes">{appointment.notes}</p> : null}
            <div className="day-sheet-actions">
                <button className="button secondary" type="button" onClick={() => downloadAppointmentICS(appointment)}><Download size={16} />Export</button>
                {appointment.owner_user_id === currentUserId ? <button className="button danger" type="button" onClick={() => onDelete(appointment)}><Trash2 size={16} />Delete</button> : null}
            </div>
        </div> : null}
    </article>;
}

function AppointmentGroup({ title, appointments, currentUserId, onDelete, expandedId, setExpandedId }) {
    if (!appointments.length) return null;
    return <section className="day-sheet-group" aria-label={title}>
        <h3>{title}</h3>
        {appointments.map((appointment) => <AppointmentTimelineRow key={appointment.id} appointment={appointment} currentUserId={currentUserId} onDelete={onDelete} expanded={expandedId === appointment.id} onToggle={() => setExpandedId((current) => current === appointment.id ? null : appointment.id)} />)}
    </section>;
}

export default function CalendarView({ appointments = [], currentUserId, onAdd, onDelete }) {
    const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()));
    const [sheetDay, setSheetDay] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const prefersReducedMotion = useReducedMotion();
    const normalized = useMemo(() => (Array.isArray(appointments) ? appointments : []).map((appointment) => ({ ...appointment, parsedDate: safeDate(appointment.starts_at) })).filter((appointment) => appointment.parsedDate).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()), [appointments]);
    const appointmentsByDate = useMemo(() => normalized.reduce((days, appointment) => {
        const key = format(appointment.parsedDate, "yyyy-MM-dd");
        const current = days.get(key) || [];
        current.push(appointment);
        days.set(key, current);
        return days;
    }, new Map()), [normalized]);
    const sheetAppointments = sheetDay ? normalized.filter((appointment) => isSameDay(appointment.parsedDate, sheetDay)) : [];
    const classes = sheetAppointments.filter((appointment) => appointment.category === "School");
    const otherAppointments = sheetAppointments.filter((appointment) => appointment.category !== "School");

    useEffect(() => {
        if (!sheetDay) return undefined;
        const closeOnEscape = (event) => { if (event.key === "Escape") setSheetDay(null); };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [sheetDay]);

    function selectDay(day) {
        if (!day) return;
        const nextDay = startOfDay(day);
        setSelectedDay(nextDay);
        setExpandedId(null);
        if ((appointmentsByDate.get(format(nextDay, "yyyy-MM-dd")) || []).length) setSheetDay(nextDay);
    }

    return <section className="calendar-view">
        <div className="calendar-layout" inert={sheetDay ? "" : undefined}>
            <div className="calendar-panel">
                <div className="section-title">
                    <div><span className="eyebrow">CALENDAR</span><h3>Appointments and deadlines</h3></div>
                    <button className="button primary" type="button" onClick={() => onAdd(selectedDay)}><Plus size={17} />Add</button>
                </div>
                <DayPicker mode="single" selected={selectedDay} onSelect={selectDay} modifiers={{ hasAppointment: normalized.map((appointment) => appointment.parsedDate) }} modifiersClassNames={{ hasAppointment: "has-appointment" }} components={{ DayButton: (props) => <CalendarDayButton {...props} appointmentsByDate={appointmentsByDate} /> }} showOutsideDays fixedWeeks />
                <div className="calendar-legend"><CalendarDays size={15} /><span>Dots show appointments. Tap a marked day to review it.</span></div>
            </div>
        </div>
        <AnimatePresence>
            {sheetDay ? <motion.div className="day-sheet-backdrop" onMouseDown={() => setSheetDay(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}>
                <motion.aside className="day-sheet" role="dialog" aria-modal="true" aria-labelledby="day-sheet-title" onMouseDown={(event) => event.stopPropagation()} initial={prefersReducedMotion ? false : { opacity: 0, y: 120 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 120 }} transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" }}>
                    <header><div><span className="eyebrow">DAY SCHEDULE</span><h2 id="day-sheet-title">{format(sheetDay, "EEEE, MMMM d")}</h2><p>{sheetAppointments.length} {sheetAppointments.length === 1 ? "appointment" : "appointments"}</p></div><div className="day-sheet-header-actions"><button className="button secondary" type="button" onClick={() => onAdd(sheetDay)}><Plus size={16} />Add</button><button className="icon-button" type="button" onClick={() => setSheetDay(null)} aria-label="Close"><X size={19} /></button></div></header>
                    <div className="day-sheet-timeline"><AppointmentGroup title="Classes" appointments={classes} currentUserId={currentUserId} onDelete={onDelete} expandedId={expandedId} setExpandedId={setExpandedId} /><AppointmentGroup title="Appointments" appointments={otherAppointments} currentUserId={currentUserId} onDelete={onDelete} expandedId={expandedId} setExpandedId={setExpandedId} /></div>
                </motion.aside>
            </motion.div> : null}
        </AnimatePresence>
    </section>;
}
