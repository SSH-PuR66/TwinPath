import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import {
    CalendarDays,
    Car,
    Clock3,
    Download,
    HelpCircle,
    MapPin,
    Plus,
    Trash2,
} from "lucide-react";

import {
    format,
    isSameDay,
    isValid,
    startOfDay,
} from "date-fns";

import "react-day-picker/style.css";

const categoryColors = {
    Prenatal: "#ff79bd",
    Ultrasound: "#9c8cff",
    "Maternal-fetal medicine": "#ff9f6e",
    WIC: "#52e0cf",
    Benefits: "#65e8ff",
    School: "#6ea8ff",
    "Financial aid": "#65e8ff",
    Work: "#ffc66d",
    Interview: "#5ee5a3",
    Performance: "#d8a7ff",
    Childcare: "#ffb16e",
    Personal: "#a8b0c4",
};

function safeDate(value) {
    const date = new Date(value);
    return isValid(date) ? date : null;
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

    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const description = [
        appointment.notes,
        appointment.questions
            ? `Questions:\n${appointment.questions}`
            : "",
        appointment.transportation_plan
            ? `Transportation:\n${appointment.transportation_plan}`
            : "",
    ]
        .filter(Boolean)
        .join("\n\n");

    const reminderMinutes = Number(
        appointment.reminder_minutes
    );

    const reminderLines =
        Number.isFinite(reminderMinutes) &&
        reminderMinutes > 0
            ? [
                  "BEGIN:VALARM",
                  `TRIGGER:-PT${reminderMinutes}M`,
                  "ACTION:DISPLAY",
                  `DESCRIPTION:${escapeICS(
                      `Reminder: ${appointment.title}`
                  )}`,
                  "END:VALARM",
              ]
            : [];

    const content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TwinPath//Family Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${appointment.id}@twinpath`,
        `DTSTAMP:${toICSDate(new Date())}`,
        `DTSTART:${toICSDate(start)}`,
        `DTEND:${toICSDate(end)}`,
        `SUMMARY:${escapeICS(appointment.title)}`,
        `LOCATION:${escapeICS(appointment.location || "")}`,
        `DESCRIPTION:${escapeICS(description)}`,
        ...reminderLines,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([content], {
        type: "text/calendar;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${String(appointment.title || "appointment")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80) || "appointment"}.ics`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AppointmentCard({
    appointment,
    currentUserId,
    onDelete,
}) {
    const date = safeDate(appointment.starts_at);
    const category = appointment.category || "Personal";

    return (
        <article className="calendar-appointment">
            <div
                className="calendar-category-line"
                style={{
                    background:
                        categoryColors[category] || categoryColors.Personal,
                }}
            />

            <div className="calendar-appointment-main">
                <div className="calendar-appointment-header">
                    <div>
                        <span className="calendar-category">
                            {category}
                        </span>

                        <h4>{appointment.title}</h4>
                    </div>

                    <div className="calendar-card-actions">
                        <button
                            className="icon-button small"
                            type="button"
                            onClick={() =>
                                downloadAppointmentICS(appointment)
                            }
                            aria-label="Export to Apple Calendar"
                            title="Export to calendar"
                        >
                            <Download size={16} />
                        </button>

                        {appointment.owner_user_id === currentUserId && (
                            <button
                                className="icon-button small danger"
                                type="button"
                                onClick={() => onDelete(appointment)}
                                aria-label="Delete appointment"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="calendar-meta">
                    {date && (
                        <span>
                            <Clock3 size={14} />
                            {format(date, "h:mm a")}
                        </span>
                    )}

                    {appointment.location && (
                        <span>
                            <MapPin size={14} />
                            {appointment.location}
                        </span>
                    )}

                    {appointment.visibility === "private" && (
                        <span>Only me</span>
                    )}
                </div>

                {appointment.transportation_plan && (
                    <div className="appointment-detail">
                        <Car size={15} />
                        <div>
                            <strong>Transportation</strong>
                            <p>{appointment.transportation_plan}</p>
                        </div>
                    </div>
                )}

                {appointment.questions && (
                    <div className="appointment-detail">
                        <HelpCircle size={15} />
                        <div>
                            <strong>Questions to ask</strong>
                            <p>{appointment.questions}</p>
                        </div>
                    </div>
                )}

                {appointment.notes && (
                    <p className="appointment-notes">
                        {appointment.notes}
                    </p>
                )}
            </div>
        </article>
    );
}

export default function CalendarView({
    appointments = [],
    currentUserId,
    onAdd,
    onDelete,
}) {
    const [selectedDay, setSelectedDay] = useState(
        startOfDay(new Date())
    );

    const safeAppointments = Array.isArray(appointments)
        ? appointments
        : [];

    const normalized = useMemo(() => {
        return safeAppointments
            .map((appointment) => ({
                ...appointment,
                parsedDate: safeDate(appointment.starts_at),
            }))
            .filter((appointment) => appointment.parsedDate)
            .sort(
                (a, b) =>
                    a.parsedDate.getTime() - b.parsedDate.getTime()
            );
    }, [safeAppointments]);

    const selectedAppointments = useMemo(() => {
        return normalized.filter((appointment) =>
            isSameDay(appointment.parsedDate, selectedDay)
        );
    }, [normalized, selectedDay]);

    const appointmentDates = normalized.map(
        (appointment) => appointment.parsedDate
    );

    return (
        <section className="calendar-layout">
            <div className="calendar-panel">
                <div className="section-title">
                    <div>
                        <span className="eyebrow">CALENDAR</span>
                        <h3>Appointments and deadlines</h3>
                    </div>

                    <button
                        className="button primary"
                        type="button"
                        onClick={() => onAdd(selectedDay)}
                    >
                        <Plus size={17} />
                        Add
                    </button>
                </div>

                <DayPicker
                    mode="single"
                    selected={selectedDay}
                    onSelect={(day) => {
                        if (day) setSelectedDay(startOfDay(day));
                    }}
                    modifiers={{
                        hasAppointment: appointmentDates,
                    }}
                    modifiersClassNames={{
                        hasAppointment: "has-appointment",
                    }}
                    showOutsideDays
                    fixedWeeks
                />

                <div className="calendar-legend">
                    <CalendarDays size={15} />
                    <span>
                        A glowing day contains at least one appointment.
                    </span>
                </div>
            </div>

            <div className="calendar-agenda">
                <div className="calendar-agenda-title">
                    <div>
                        <span className="eyebrow">AGENDA</span>
                        <h3>{format(selectedDay, "EEEE, MMMM d")}</h3>
                    </div>

                    <span className="pill blue">
                        {selectedAppointments.length}
                    </span>
                </div>

                {selectedAppointments.length ? (
                    <div className="calendar-appointment-list">
                        {selectedAppointments.map((appointment) => (
                            <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                currentUserId={currentUserId}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty">
                        No appointments on this day.
                    </div>
                )}
            </div>
        </section>
    );
}
