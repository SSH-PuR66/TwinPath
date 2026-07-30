import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    CheckCircle2,
    Edit3,
    ExternalLink,
    FileCheck2,
    Loader2,
    Plus,
    RefreshCw,
    ShieldCheck,
    Trash2,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import { safeExternalUrl } from "./safeUrl";
import DisclosureSection from "./DisclosureSection";

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const categories = [
    "Healthcare",
    "Food",
    "Childcare",
    "Housing",
    "Utilities",
    "Transportation",
    "Education",
    "Taxes",
    "Family support",
    "Other",
];

const statuses = [
    "researching",
    "potential",
    "applying",
    "submitted",
    "documents-requested",
    "approved",
    "denied",
    "renewal-due",
    "closed",
];

const categorySet = new Set(categories);
const statusSet = new Set(statuses);

const starterRoutes = [
    {
        title: "Pregnancy health coverage",
        category: "Healthcare",
    },
    {
        title: "Newborn coverage instructions",
        category: "Healthcare",
    },
    {
        title: "WIC eligibility review",
        category: "Food",
    },
    {
        title: "SNAP eligibility review",
        category: "Food",
    },
    {
        title: "Childcare assistance",
        category: "Childcare",
    },
    {
        title: "Early Head Start",
        category: "Family support",
    },
    {
        title: "Home-visiting program",
        category: "Family support",
    },
    {
        title: "Medical transportation",
        category: "Transportation",
    },
    {
        title: "University emergency aid",
        category: "Education",
    },
    {
        title: "Financial-aid changed-circumstance review",
        category: "Education",
    },
    {
        title: "VITA tax preparation",
        category: "Taxes",
    },
    {
        title: "New York unclaimed funds search",
        category: "Other",
    },
];

function emptyForm() {
    return {
        title: "",
        category: "Healthcare",
        status: "researching",
        official_url: "",
        phone: "",
        confirmation_number: "",
        approved_monthly_value: "",
        approved_one_time_value: "",
        applied_on: "",
        decision_on: "",
        renewal_on: "",
        next_action_on: "",
        next_action: "",
        reporting_obligations: "",
        documents_requested: "",
        notes: "",
        last_verified_on: "",
        visibility: "shared",
    };
}

function routeToForm(route) {
    return {
        title: route.title || "",
        category: categorySet.has(route.category)
            ? route.category
            : "Other",
        status: statusSet.has(route.status)
            ? route.status
            : "researching",
        official_url: route.official_url || "",
        phone: route.phone || "",
        confirmation_number:
            route.confirmation_number || "",
        approved_monthly_value:
            route.approved_monthly_value ?? "",
        approved_one_time_value:
            route.approved_one_time_value ?? "",
        applied_on: route.applied_on || "",
        decision_on: route.decision_on || "",
        renewal_on: route.renewal_on || "",
        next_action_on: route.next_action_on || "",
        next_action: route.next_action || "",
        reporting_obligations:
            route.reporting_obligations || "",
        documents_requested: Array.isArray(
            route.documents_requested
        )
            ? route.documents_requested.join("\n")
            : "",
        notes: route.notes || "",
        last_verified_on:
            route.last_verified_on || "",
        visibility:
            route.visibility === "private"
                ? "private"
                : "shared",
    };
}

function cleanText(value, maximumLength) {
    const normalized = String(value ?? "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .trim();

    return normalized.slice(0, maximumLength);
}

function optionalText(value, maximumLength) {
    const cleaned = cleanText(value, maximumLength);
    return cleaned || null;
}

function parseMoney(value, label) {
    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return 0;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(
            `${label} must be zero or a positive number.`
        );
    }

    if (amount > 1_000_000) {
        throw new Error(
            `${label} is too large. Verify the value before saving.`
        );
    }

    return Math.round(amount * 100) / 100;
}

function normalizeDate(value, label) {
    if (!value) return null;

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        throw new Error(`${label} is not a valid date.`);
    }

    const date = new Date(`${value}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        throw new Error(`${label} is not a valid date.`);
    }

    return value;
}

function formatStoredDate(value) {
    if (!value) return "";

    const date = new Date(`${value}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function statusLabel(status) {
    if (typeof status !== "string") {
        return "unknown";
    }

    return status.replaceAll("-", " ");
}

function normalizeDocuments(value) {
    return [
        ...new Set(
            String(value || "")
                .split(/\r?\n/)
                .map((item) => cleanText(item, 250))
                .filter(Boolean)
                .slice(0, 30)
        ),
    ];
}

function explainSupabaseError(error) {
    const message =
        error?.message ||
        "The savings route operation failed.";

    const normalized = message.toLowerCase();

    if (
        normalized.includes("could not find the table") &&
        normalized.includes("family_savings_routes")
    ) {
        return (
            "The Family Savings database migration is missing. " +
            "Run supabase/v9-family-savings.sql in the connected " +
            "Supabase project."
        );
    }

    if (
        normalized.includes("schema cache") &&
        normalized.includes("family_savings_routes")
    ) {
        return (
            "Supabase has not loaded the Family Savings table. " +
            "Run: notify pgrst, 'reload schema';"
        );
    }

    if (normalized.includes("row-level security")) {
        return (
            "Supabase rejected this action under its privacy rules. " +
            "Confirm that the signed-in account belongs to this household " +
            "and that the Family Savings RLS policies are installed."
        );
    }

    if (
        normalized.includes("violates check constraint")
    ) {
        return (
            "One of the saved values is outside the database limits. " +
            "Review the category, status, amounts, dates, and text lengths."
        );
    }

    if (
        normalized.includes("duplicate") ||
        normalized.includes("unique constraint")
    ) {
        return "That savings route appears to have already been added.";
    }

    return message;
}

function isActionDueSoon(value) {
    if (!value) return false;

    const due = new Date(`${value}T12:00:00`);

    if (Number.isNaN(due.getTime())) {
        return false;
    }

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    const differenceInDays =
        (due.getTime() - now.getTime()) / 86_400_000;

    return differenceInDays >= -1 && differenceInDays <= 14;
}

function isRenewalDueSoon(value) {
    if (!value) return false;

    const renewal = new Date(`${value}T12:00:00`);

    if (Number.isNaN(renewal.getTime())) {
        return false;
    }

    const now = new Date();
    now.setHours(12, 0, 0, 0);

    const differenceInDays =
        (renewal.getTime() - now.getTime()) /
        86_400_000;

    return differenceInDays >= 0 && differenceInDays <= 30;
}

export default function FamilySavings({
    householdId,
    currentUserId,
    privateMode = false,
}) {
    const [routes, setRoutes] = useState([]);
    const [form, setForm] = useState(emptyForm());
    const [editingRoute, setEditingRoute] =
        useState(null);

    const [showForm, setShowForm] = useState(false);
    const [showAllRoutes, setShowAllRoutes] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [starterBusy, setStarterBusy] =
        useState(false);

    const [updatingRouteId, setUpdatingRouteId] =
        useState("");

    const [deletingRouteId, setDeletingRouteId] =
        useState("");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const requestSequence = useRef(0);

    const loadRoutes = useCallback(
        async ({ silent = false } = {}) => {
            if (!householdId) {
                setRoutes([]);
                setLoading(false);
                return;
            }

            const requestId = ++requestSequence.current;

            if (!silent) {
                setLoading(true);
            }

            setError("");

            const { data, error: queryError } =
                await supabase
                    .from("family_savings_routes")
                    .select("*")
                    .eq("household_id", householdId)
                    .order("next_action_on", {
                        ascending: true,
                        nullsFirst: false,
                    })
                    .order("renewal_on", {
                        ascending: true,
                        nullsFirst: false,
                    })
                    .order("created_at", {
                        ascending: false,
                    });

            if (requestId !== requestSequence.current) {
                return;
            }

            if (queryError) {
                setError(explainSupabaseError(queryError));
                setRoutes([]);
            } else {
                setRoutes(
                    Array.isArray(data) ? data : []
                );
            }

            setLoading(false);
        },
        [householdId]
    );

    useEffect(() => {
        loadRoutes();
    }, [loadRoutes]);

    useEffect(() => {
        if (!showForm) return undefined;

        const previousOverflow =
            document.body.style.overflow;

        function handleEscape(event) {
            if (event.key === "Escape") {
                setShowForm(false);
                setEditingRoute(null);
                setForm(emptyForm());
            }
        }

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleEscape);

        return () => {
            document.body.style.overflow =
                previousOverflow;

            window.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, [showForm]);

    const approvedRoutes = useMemo(
        () =>
            routes.filter(
                (route) => route.status === "approved"
            ),
        [routes]
    );

    const approvedMonthlyReduction = useMemo(
        () =>
            approvedRoutes.reduce((total, route) => {
                const amount = Number(
                    route.approved_monthly_value || 0
                );

                return total +
                    (Number.isFinite(amount) && amount >= 0
                        ? amount
                        : 0);
            }, 0),
        [approvedRoutes]
    );

    const approvedOneTimeValue = useMemo(
        () =>
            approvedRoutes.reduce((total, route) => {
                const amount = Number(
                    route.approved_one_time_value || 0
                );

                return total +
                    (Number.isFinite(amount) && amount >= 0
                        ? amount
                        : 0);
            }, 0),
        [approvedRoutes]
    );

    const activeApplications = useMemo(
        () =>
            routes.filter((route) =>
                [
                    "applying",
                    "submitted",
                    "documents-requested",
                ].includes(route.status)
            ).length,
        [routes]
    );

    const dueSoon = useMemo(
        () =>
            routes.filter((route) =>
                isActionDueSoon(route.next_action_on)
            ).length,
        [routes]
    );

    const renewalsDue = useMemo(
        () =>
            routes.filter((route) =>
                isRenewalDueSoon(route.renewal_on)
            ).length,
        [routes]
    );

    function showMoney(value) {
        const amount = Number(value);

        if (privateMode) {
            return "••••";
        }

        return currency.format(
            Number.isFinite(amount) ? amount : 0
        );
    }

    function resetFeedback() {
        setError("");
        setMessage("");
    }

    function openNewRouteForm() {
        resetFeedback();
        setEditingRoute(null);
        setForm(emptyForm());
        setShowForm(true);
    }

    function openEditRouteForm(route) {
        if (route.owner_user_id !== currentUserId) {
            setError(
                "Only the person who created this route can edit it."
            );
            return;
        }

        resetFeedback();
        setEditingRoute(route);
        setForm(routeToForm(route));
        setShowForm(true);
    }

    function closeForm() {
        if (saving) return;

        setShowForm(false);
        setEditingRoute(null);
        setForm(emptyForm());
    }

    function createPayload() {
        const title = cleanText(form.title, 180);

        if (!title) {
            throw new Error("Enter a route name.");
        }

        if (!categorySet.has(form.category)) {
            throw new Error(
                "Select a valid savings category."
            );
        }

        if (!statusSet.has(form.status)) {
            throw new Error(
                "Select a valid application status."
            );
        }

        let officialUrl = null;

        if (form.official_url.trim()) {
            officialUrl = safeExternalUrl(
                form.official_url,
                {
                    allowLocalHttp: false,
                }
            );

            if (!officialUrl) {
                throw new Error(
                    "Official links must use a valid public HTTPS address without embedded credentials."
                );
            }
        }

        const monthlyValue = parseMoney(
            form.approved_monthly_value,
            "Approved monthly value"
        );

        const oneTimeValue = parseMoney(
            form.approved_one_time_value,
            "Approved one-time value"
        );

        return {
            household_id: householdId,
            owner_user_id: currentUserId,
            visibility:
                form.visibility === "private"
                    ? "private"
                    : "shared",

            title,
            category: form.category,
            status: form.status,
            official_url: officialUrl,

            phone: optionalText(form.phone, 40),

            confirmation_number: optionalText(
                form.confirmation_number,
                120
            ),

            approved_monthly_value: monthlyValue,
            approved_one_time_value: oneTimeValue,

            applied_on: normalizeDate(
                form.applied_on,
                "Application date"
            ),

            decision_on: normalizeDate(
                form.decision_on,
                "Decision date"
            ),

            renewal_on: normalizeDate(
                form.renewal_on,
                "Renewal date"
            ),

            next_action_on: normalizeDate(
                form.next_action_on,
                "Next-action date"
            ),

            next_action: optionalText(
                form.next_action,
                1000
            ),

            reporting_obligations: optionalText(
                form.reporting_obligations,
                2000
            ),

            documents_requested: normalizeDocuments(
                form.documents_requested
            ),

            notes: optionalText(form.notes, 3000),

            last_verified_on: normalizeDate(
                form.last_verified_on,
                "Verification date"
            ),
        };
    }

    async function saveRoute(event) {
        event.preventDefault();

        if (saving) return;

        resetFeedback();

        if (!householdId || !currentUserId) {
            setError(
                "The current household or account could not be identified."
            );
            return;
        }

        let payload;

        try {
            payload = createPayload();
        } catch (validationError) {
            setError(validationError.message);
            return;
        }

        setSaving(true);

        try {
            if (editingRoute) {
                const { error: updateError } =
                    await supabase
                        .from("family_savings_routes")
                        .update(payload)
                        .eq("id", editingRoute.id)
                        .eq(
                            "owner_user_id",
                            currentUserId
                        );

                if (updateError) {
                    throw updateError;
                }

                setMessage(
                    `"${payload.title}" was updated.`
                );
            } else {
                const normalizedTitle =
                    payload.title.toLowerCase();

                const duplicate = routes.some(
                    (route) =>
                        String(route.title || "")
                            .trim()
                            .toLowerCase() === normalizedTitle
                );

                if (duplicate) {
                    throw new Error(
                        "A savings route with this title already exists."
                    );
                }

                const { error: insertError } =
                    await supabase
                        .from("family_savings_routes")
                        .insert(payload);

                if (insertError) {
                    throw insertError;
                }

                setMessage(
                    `"${payload.title}" was added.`
                );
            }

            setShowForm(false);
            setEditingRoute(null);
            setForm(emptyForm());

            await loadRoutes({ silent: true });
        } catch (saveError) {
            setError(
                explainSupabaseError(saveError)
            );
        } finally {
            setSaving(false);
        }
    }

    async function updateStatus(route, nextStatus) {
        if (updatingRouteId) return;

        resetFeedback();

        if (route.owner_user_id !== currentUserId) {
            setError(
                "Only the route owner can change its status."
            );
            return;
        }

        if (!statusSet.has(nextStatus)) {
            setError("Invalid savings-route status.");
            return;
        }

        const previousStatus = route.status;

        setUpdatingRouteId(route.id);

        setRoutes((currentRoutes) =>
            currentRoutes.map((item) =>
                item.id === route.id
                    ? { ...item, status: nextStatus }
                    : item
            )
        );

        const today = new Date()
            .toISOString()
            .slice(0, 10);

        const decisionStatus =
            nextStatus === "approved" ||
            nextStatus === "denied";

        const { error: updateError } =
            await supabase
                .from("family_savings_routes")
                .update({
                    status: nextStatus,
                    decision_on: decisionStatus
                        ? route.decision_on || today
                        : null,
                })
                .eq("id", route.id)
                .eq("owner_user_id", currentUserId);

        if (updateError) {
            setRoutes((currentRoutes) =>
                currentRoutes.map((item) =>
                    item.id === route.id
                        ? {
                            ...item,
                            status: previousStatus,
                        }
                        : item
                )
            );

            setError(
                explainSupabaseError(updateError)
            );
        } else {
            setMessage(
                `"${route.title}" is now ${statusLabel(
                    nextStatus
                )}.`
            );

            await loadRoutes({ silent: true });
        }

        setUpdatingRouteId("");
    }

    async function deleteRoute(route) {
        if (deletingRouteId) return;

        resetFeedback();

        if (route.owner_user_id !== currentUserId) {
            setError(
                "Only the route owner can delete it."
            );
            return;
        }

        const confirmed = window.confirm(
            `Delete "${route.title}" permanently?`
        );

        if (!confirmed) return;

        setDeletingRouteId(route.id);

        const { error: deleteError } =
            await supabase
                .from("family_savings_routes")
                .delete()
                .eq("id", route.id)
                .eq("owner_user_id", currentUserId);

        if (deleteError) {
            setError(
                explainSupabaseError(deleteError)
            );
        } else {
            setMessage(
                `"${route.title}" was deleted.`
            );

            setRoutes((currentRoutes) =>
                currentRoutes.filter(
                    (item) => item.id !== route.id
                )
            );
        }

        setDeletingRouteId("");
    }

    async function addStarterRoutes() {
        if (starterBusy) return;

        resetFeedback();
        setStarterBusy(true);

        try {
            const existingTitles = new Set(
                routes.map((route) =>
                    String(route.title || "")
                        .trim()
                        .toLowerCase()
                )
            );

            const records = starterRoutes
                .filter(
                    (route) =>
                        !existingTitles.has(
                            route.title.toLowerCase()
                        )
                )
                .map((route) => ({
                    ...route,
                    household_id: householdId,
                    owner_user_id: currentUserId,
                    visibility: "shared",
                    status: "researching",
                    approved_monthly_value: 0,
                    approved_one_time_value: 0,
                    documents_requested: [],
                }));

            if (!records.length) {
                setMessage(
                    "All starter opportunities are already present."
                );
                return;
            }

            const { error: insertError } =
                await supabase
                    .from("family_savings_routes")
                    .insert(records);

            if (insertError) {
                throw insertError;
            }

            setMessage(
                `${records.length} starter opportunities were added.`
            );

            await loadRoutes({ silent: true });
        } catch (starterError) {
            setError(
                explainSupabaseError(starterError)
            );
        } finally {
            setStarterBusy(false);
        }
    }

    return (
        <section
            className="family-savings"
            aria-busy={loading}
        >
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        OVERLOOKED OPPORTUNITIES
                    </span>

                    <h3>Family savings stack</h3>

                    <p>
                        Track official decisions, deadlines,
                        renewals, requested documents, and approved
                        expense reductions.
                    </p>
                </div>

                <div className="family-savings-actions">
                    <button
                        className="icon-button"
                        type="button"
                        onClick={() => loadRoutes()}
                        disabled={loading}
                        aria-label="Refresh savings routes"
                    >
                        <RefreshCw
                            className={loading ? "spin" : ""}
                            size={17}
                        />
                    </button>

                    <button
                        className="button primary"
                        type="button"
                        onClick={openNewRouteForm}
                    >
                        <Plus size={17} />
                        Add
                    </button>
                </div>
            </div>

            <div className="savings-summary-grid">
                <article>
                    <span>Approved monthly reduction</span>
                    <strong>
                        {showMoney(approvedMonthlyReduction)}
                    </strong>
                    <small>Not cash income</small>
                </article>

                <article>
                    <span>Approved one-time value</span>
                    <strong>
                        {showMoney(approvedOneTimeValue)}
                    </strong>
                    <small>Written approvals only</small>
                </article>

                <article>
                    <span>Active applications</span>
                    <strong>{activeApplications}</strong>
                    <small>Not yet approved</small>
                </article>

                <article>
                    <span>Deadlines and renewals</span>
                    <strong>{dueSoon + renewalsDue}</strong>
                    <small>
                        {dueSoon} actions · {renewalsDue} renewals
                    </small>
                </article>
            </div>

            {error && (
                <div className="error-box" role="alert">
                    {error}
                </div>
            )}

            {message && (
                <div
                    className="success-box compact"
                    role="status"
                >
                    <CheckCircle2 size={18} />
                    <span>{message}</span>
                </div>
            )}

            {!routes.length && !loading && (
                <button
                    className="button secondary"
                    type="button"
                    onClick={addStarterRoutes}
                    disabled={starterBusy}
                >
                    {starterBusy ? (
                        <Loader2
                            className="spin"
                            size={17}
                        />
                    ) : (
                        <FileCheck2 size={17} />
                    )}

                    Add starter opportunity checklist
                </button>
            )}

            <DisclosureSection id="savings-goals" title="Savings goals" hint={`${routes.length} tracked routes`}>
            {loading ? (
                <div className="savings-loading">
                    <Loader2 className="spin" size={24} />
                    <span>Loading savings routes…</span>
                </div>
            ) : routes.length ? (
                <div className="savings-route-list">
                    {(showAllRoutes ? routes : routes.slice(0, 8)).map((route) => {
                        const officialUrl =
                            safeExternalUrl(
                                route.official_url,
                                {
                                    allowLocalHttp: false,
                                }
                            );

                        const routeOwnedByCurrentUser =
                            route.owner_user_id ===
                            currentUserId;

                        const statusUpdating =
                            updatingRouteId === route.id;

                        const routeDeleting =
                            deletingRouteId === route.id;

                        return (
                            <article
                                className="savings-route-card"
                                key={route.id}
                            >
                                <div className="savings-route-header">
                                    <div>
                                        <span className="pill blue">
                                            {route.category}
                                        </span>

                                        <h4>{route.title}</h4>
                                    </div>

                                    <span
                                        className={`savings-status ${route.status}`}
                                    >
                                        {statusLabel(route.status)}
                                    </span>
                                </div>

                                <div className="savings-values">
                                    <span>
                                        Monthly:{" "}
                                        <strong>
                                            {showMoney(
                                                route.status === "approved"
                                                    ? route.approved_monthly_value
                                                    : 0
                                            )}
                                        </strong>
                                    </span>

                                    <span>
                                        One-time:{" "}
                                        <strong>
                                            {showMoney(
                                                route.status === "approved"
                                                    ? route.approved_one_time_value
                                                    : 0
                                            )}
                                        </strong>
                                    </span>
                                </div>

                                {route.status !== "approved" &&
                                    (Number(
                                        route.approved_monthly_value || 0
                                    ) > 0 ||
                                        Number(
                                            route.approved_one_time_value || 0
                                        ) > 0) && (
                                        <div className="route-reporting-note">
                                            <ShieldCheck size={15} />

                                            <span>
                                                Values are recorded but excluded
                                                from totals until this route is
                                                marked approved.
                                            </span>
                                        </div>
                                    )}

                                {route.next_action && (
                                    <div className="savings-next-action">
                                        <strong>Next action</strong>
                                        <p>{route.next_action}</p>

                                        {route.next_action_on && (
                                            <small>
                                                Due{" "}
                                                {formatStoredDate(
                                                    route.next_action_on
                                                )}
                                            </small>
                                        )}
                                    </div>
                                )}

                                {route.renewal_on && (
                                    <div className="savings-next-action">
                                        <strong>
                                            {isRenewalDueSoon(
                                                route.renewal_on
                                            )
                                                ? "Renewal due soon"
                                                : "Renewal"}
                                        </strong>

                                        <p>
                                            {formatStoredDate(
                                                route.renewal_on
                                            )}
                                        </p>
                                    </div>
                                )}

                                {Array.isArray(
                                    route.documents_requested
                                ) &&
                                    route.documents_requested.length >
                                    0 && (
                                        <div className="savings-next-action">
                                            <strong>
                                                Documents requested
                                            </strong>

                                            <p>
                                                {route.documents_requested.join(
                                                    " · "
                                                )}
                                            </p>
                                        </div>
                                    )}

                                {route.reporting_obligations && (
                                    <div className="route-reporting-note">
                                        <ShieldCheck size={15} />

                                        <span>
                                            {route.reporting_obligations}
                                        </span>
                                    </div>
                                )}

                                <div className="savings-route-actions">
                                    {officialUrl && (
                                        <a
                                            className="button ghost"
                                            href={officialUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Official source
                                            <ExternalLink size={15} />
                                        </a>
                                    )}

                                    {routeOwnedByCurrentUser && (
                                        <>
                                            <button
                                                className="button ghost"
                                                type="button"
                                                onClick={() =>
                                                    openEditRouteForm(route)
                                                }
                                                disabled={
                                                    statusUpdating ||
                                                    routeDeleting
                                                }
                                            >
                                                <Edit3 size={15} />
                                                Edit
                                            </button>

                                            <select
                                                aria-label={`Update ${route.title} status`}
                                                value={route.status}
                                                disabled={
                                                    statusUpdating ||
                                                    routeDeleting
                                                }
                                                onChange={(event) =>
                                                    updateStatus(
                                                        route,
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                {statuses.map((status) => (
                                                    <option
                                                        value={status}
                                                        key={status}
                                                    >
                                                        {statusLabel(status)}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                className="icon-button danger"
                                                type="button"
                                                onClick={() =>
                                                    deleteRoute(route)
                                                }
                                                disabled={
                                                    statusUpdating ||
                                                    routeDeleting
                                                }
                                                aria-label={`Delete ${route.title}`}
                                            >
                                                {routeDeleting ? (
                                                    <Loader2
                                                        className="spin"
                                                        size={16}
                                                    />
                                                ) : (
                                                    <Trash2 size={16} />
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty">
                    Add opportunities that you intend to
                    verify through official agencies or
                    organizations.
                </div>
            )}
            {routes.length > 8 && !showAllRoutes ? <button className="button secondary" type="button" onClick={() => setShowAllRoutes(true)}>Show all {routes.length}</button> : null}
            </DisclosureSection>

            <DisclosureSection id="savings-records" title="Record quality" hint="Approvals and reporting" collapseOnPhone>
            <div className="warning-inline">
                <ShieldCheck size={18} />

                <span>
                    Potential eligibility is not approval.
                    Report household, income, residence, and
                    student information accurately. Keep
                    written decisions and reporting instructions.
                </span>
            </div>
            </DisclosureSection>

            {showForm && (
                <div
                    className="modal-backdrop"
                    onMouseDown={closeForm}
                >
                    <div
                        className="modal"
                        onMouseDown={(event) =>
                            event.stopPropagation()
                        }
                        role="dialog"
                        aria-modal="true"
                        aria-label={
                            editingRoute
                                ? "Edit savings route"
                                : "Add savings route"
                        }
                    >
                        <header className="modal-header">
                            <h2>
                                {editingRoute
                                    ? "Edit savings route"
                                    : "Add savings route"}
                            </h2>

                            <button
                                className="icon-button"
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <form
                            className="stack"
                            onSubmit={saveRoute}
                        >
                            <label className="field">
                                <span>
                                    Program or opportunity
                                </span>

                                <input
                                    required
                                    maxLength={180}
                                    value={form.title}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            title: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <div className="form-grid">
                                <label className="field">
                                    <span>Category</span>

                                    <select
                                        value={form.category}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                category:
                                                    event.target.value,
                                            })
                                        }
                                    >
                                        {categories.map((category) => (
                                            <option
                                                value={category}
                                                key={category}
                                            >
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="field">
                                    <span>Status</span>

                                    <select
                                        value={form.status}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                status: event.target.value,
                                            })
                                        }
                                    >
                                        {statuses.map((status) => (
                                            <option
                                                value={status}
                                                key={status}
                                            >
                                                {statusLabel(status)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <label className="field">
                                <span>Official HTTPS source</span>

                                <input
                                    type="url"
                                    inputMode="url"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    placeholder="https://..."
                                    value={form.official_url}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            official_url:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <div className="form-grid">
                                <label className="field">
                                    <span>Office phone</span>

                                    <input
                                        type="tel"
                                        inputMode="tel"
                                        maxLength={40}
                                        value={form.phone}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                phone:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label className="field">
                                    <span>
                                        Confirmation number
                                    </span>

                                    <input
                                        maxLength={120}
                                        autoComplete="off"
                                        value={
                                            form.confirmation_number
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                confirmation_number:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <div className="form-grid">
                                <label className="field">
                                    <span>
                                        Approved monthly value
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={
                                            form.approved_monthly_value
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                approved_monthly_value:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label className="field">
                                    <span>
                                        Approved one-time value
                                    </span>

                                    <input
                                        type="number"
                                        min="0"
                                        max="1000000"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={
                                            form.approved_one_time_value
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                approved_one_time_value:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <div className="form-grid">
                                <label className="field">
                                    <span>Applied on</span>

                                    <input
                                        type="date"
                                        value={form.applied_on}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                applied_on:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label className="field">
                                    <span>Decision date</span>

                                    <input
                                        type="date"
                                        value={form.decision_on}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                decision_on:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <div className="form-grid">
                                <label className="field">
                                    <span>Renewal date</span>

                                    <input
                                        type="date"
                                        value={form.renewal_on}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                renewal_on:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label className="field">
                                    <span>
                                        Last officially verified
                                    </span>

                                    <input
                                        type="date"
                                        value={
                                            form.last_verified_on
                                        }
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                last_verified_on:
                                                    event.target.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>

                            <label className="field">
                                <span>Next action</span>

                                <textarea
                                    rows="2"
                                    maxLength={1000}
                                    value={form.next_action}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            next_action:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Next-action date</span>

                                <input
                                    type="date"
                                    value={form.next_action_on}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            next_action_on:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>
                                    Documents requested
                                </span>

                                <textarea
                                    rows="4"
                                    maxLength={4000}
                                    placeholder={
                                        "One document per line\nProof of residency\nIncome statement"
                                    }
                                    value={
                                        form.documents_requested
                                    }
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            documents_requested:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>
                                    Reporting obligations
                                </span>

                                <textarea
                                    rows="3"
                                    maxLength={2000}
                                    placeholder={
                                        "What changes must be reported, and by when?"
                                    }
                                    value={
                                        form.reporting_obligations
                                    }
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            reporting_obligations:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Notes</span>

                                <textarea
                                    rows="4"
                                    maxLength={3000}
                                    value={form.notes}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            notes:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Visibility</span>

                                <select
                                    value={form.visibility}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            visibility:
                                                event.target.value,
                                        })
                                    }
                                >
                                    <option value="shared">
                                        Shared together
                                    </option>

                                    <option value="private">
                                        Only me
                                    </option>
                                </select>
                            </label>

                            <button
                                className="button primary"
                                type="submit"
                                disabled={saving}
                            >
                                {saving ? (
                                    <Loader2
                                        className="spin"
                                        size={17}
                                    />
                                ) : (
                                    <CheckCircle2 size={17} />
                                )}

                                {saving
                                    ? "Saving…"
                                    : editingRoute
                                        ? "Save changes"
                                        : "Save route"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
