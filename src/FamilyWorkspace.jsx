import { lazy, Suspense, useState } from "react";
import {
    CalendarDays,
    GalleryHorizontal,
    HeartHandshake,
    PiggyBank,
} from "lucide-react";

import FeatureLoader from "./FeatureLoader";

const CalendarView = lazy(() =>
    import("./CalendarView.jsx")
);

const FamilyGallery = lazy(() =>
    import("./FamilyGallery.jsx")
);

const FamilySavings = lazy(() =>
    import("./FamilySavings.jsx")
);

const CalendarFeedsPanel = lazy(() =>
    import("./CalendarFeedsPanel.jsx")
);

const sections = [
    {
        id: "calendar",
        label: "Calendar",
        icon: CalendarDays,
    },
    {
        id: "savings",
        label: "Savings",
        icon: PiggyBank,
    },
    {
        id: "gallery",
        label: "Gallery",
        icon: GalleryHorizontal,
    },
    {
        id: "readiness",
        label: "Ready",
        icon: HeartHandshake,
    },
];

export default function FamilyWorkspace({
    appointments,
    householdId,
    currentUserId,
    privateMode,
    onAddAppointment,
    onDeleteAppointment,
    onAppointmentsChanged,
    readinessContent = null,
}) {
    const [section, setSection] =
        useState("calendar");

    return (
        <div className="family-workspace">
            <nav
                className="family-workspace-tabs"
                aria-label="Family Hub sections"
            >
                {sections.map((item) => {
                    const Icon = item.icon;

                    return (
                        <button
                            type="button"
                            key={item.id}
                            className={
                                section === item.id
                                    ? "active"
                                    : ""
                            }
                            onClick={() =>
                                setSection(item.id)
                            }
                            aria-current={
                                section === item.id
                                    ? "page"
                                    : undefined
                            }
                        >
                            <Icon size={17} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <Suspense
                fallback={
                    <FeatureLoader label="Opening Family Hub…" />
                }
            >
                {section === "calendar" && (
                    <>
                        <CalendarView
                            appointments={appointments}
                            currentUserId={currentUserId}
                            onAdd={onAddAppointment}
                            onDelete={onDeleteAppointment}
                        />
                        <CalendarFeedsPanel
                            householdId={householdId}
                            onSynced={onAppointmentsChanged}
                        />
                    </>
                )}

                {section === "savings" && (
                    <FamilySavings
                        householdId={householdId}
                        currentUserId={currentUserId}
                        privateMode={privateMode}
                    />
                )}

                {section === "gallery" && (
                    <FamilyGallery
                        householdId={householdId}
                        currentUserId={currentUserId}
                    />
                )}

                {section === "readiness" && (
                    readinessContent || (
                        <div className="empty">
                            Add the readiness checklist here.
                        </div>
                    )
                )}
            </Suspense>
        </div>
    );
}
