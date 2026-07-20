import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    CheckCircle2,
    ExternalLink,
    Loader2,
    Plus,
    RefreshCw,
    ShieldCheck,
    Trash2,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import { safeExternalUrl } from "./safeUrl";

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
        approved_monthly_value: "",
        approved_one_time_value: "",
        applied_on: "",
        renewal_on: "",
        next_action_on: "",
        next_action: "",
        reporting_obligations: "",
        notes: "",
        visibility: "shared",
    };
}

function statusLabel(status) {
    return status.replaceAll("-", " ");
}

export default function FamilySavings({
    householdId,
    currentUserId,
    privateMode = false,
}) {
    const [routes, setRoutes] = useState([]);
    const [form, setForm] = useState(emptyForm());
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadRoutes = useCallback(async () => {
        if (!householdId) return;

        setLoading(true);
        setError("");

        const { data, error: queryError } = await supabase
            .from("family_savings_routes")
            .select("*")
            .eq("household_id", householdId)
            .order("next_action_on", {
                ascending: true,
                nullsFirst: false,
            })
            .order("created_at", {
                ascending: false,
            });

        if (queryError) {
            setError(queryError.message);
            setRoutes([]);
        } else {
            setRoutes(Array.isArray(data) ? data : []);
        }

        setLoading(false);
    }, [householdId]);

    useEffect(() => {
        loadRoutes();
    }, [loadRoutes]);

    const approved = useMemo(
        () => routes.filter((route) => route.status === "approved"),
        [routes]
    );

    const approvedMonthlyReduction = useMemo(
        () =>
            approved.reduce(
                (total, route) =>
                    total + Number(route.approved_monthly_value || 0),
                0
            ),
        [approved]
    );

    const approvedOneTimeValue = useMemo(
        () =>
            approved.reduce(
                (total, route) =>
                    total + Number(route.approved_one_time_value || 0),
                0
            ),
        [approved]
    );

    const activeApplications = routes.filter((route) =>
        [
            "applying",
            "submitted",
            "documents-requested",
        ].includes(route.status)
    ).length;

    const dueSoon = routes.filter((route) => {
        if (!route.next_action_on) return false;

        const due = new Date(`${route.next_action_on}T12:00:00`);
        const days = (due.getTime() - Date.now()) / 86400000;

        return days >= -1 && days <= 14;
    }).length;

    function showMoney(value) {
        return privateMode ? "••••" : currency.format(value);
    }

    async function saveRoute(event) {
        event.preventDefault();

        if (!form.title.trim()) {
            setError("Enter a route name.");
            return;
        }

        let officialUrl = null;

        if (form.official_url.trim()) {
            try {
                const parsed = new URL(form.official_url.trim());

                if (parsed.protocol !== "https:") {
                    throw new Error();
                }

                officialUrl = parsed.toString();
            } catch {
                setError("Official links must use a valid HTTPS address.");
                return;
            }
        }

        setSaving(true);
        setError("");

        const { error: insertError } = await supabase
            .from("family_savings_routes")
            .insert({
                household_id: householdId,
                owner_user_id: currentUserId,
                visibility: form.visibility,
                title: form.title.trim(),
                category: form.category,
                status: form.status,
                official_url: officialUrl,
                phone: form.phone.trim() || null,
                approved_monthly_value:
                    Number(form.approved_monthly_value) || 0,
                approved_one_time_value:
                    Number(form.approved_one_time_value) || 0,
                applied_on: form.applied_on || null,
                renewal_on: form.renewal_on || null,
                next_action_on: form.next_action_on || null,
                next_action: form.next_action.trim() || null,
                reporting_obligations:
                    form.reporting_obligations.trim() || null,
                notes: form.notes.trim() || null,
            });

        setSaving(false);

        if (insertError) {
            setError(insertError.message);
            return;
        }

        setForm(emptyForm());
        setShowForm(false);
        await loadRoutes();
    }

    async function updateStatus(route, status) {
        const { error: updateError } = await supabase
            .from("family_savings_routes")
            .update({
                status,
                decision_on:
                    status === "approved" || status === "denied"
                        ? new Date().toISOString().slice(0, 10)
                        : route.decision_on,
            })
            .eq("id", route.id)
            .eq("owner_user_id", currentUserId);

        if (updateError) {
            setError(updateError.message);
            return;
        }

        await loadRoutes();
    }

    async function deleteRoute(route) {
        if (!window.confirm("Delete this savings route?")) return;

        const { error: deleteError } = await supabase
            .from("family_savings_routes")
            .delete()
            .eq("id", route.id)
            .eq("owner_user_id", currentUserId);

        if (deleteError) {
            setError(deleteError.message);
            return;
        }

        await loadRoutes();
    }

    async function addStarterRoutes() {
        const existingTitles = new Set(
            routes.map((route) => route.title.toLowerCase())
        );

        const records = starterRoutes
            .filter(
                (route) => !existingTitles.has(route.title.toLowerCase())
            )
            .map((route) => ({
                ...route,
                household_id: householdId,
                owner_user_id: currentUserId,
                visibility: "shared",
                status: "researching",
            }));

        if (!records.length) return;

        const { error: insertError } = await supabase
            .from("family_savings_routes")
            .insert(records);

        if (insertError) {
            setError(insertError.message);
            return;
        }

        await loadRoutes();
    }

    return (
        <section className="family-savings">
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        OVERLOOKED OPPORTUNITIES
                    </span>

                    <h3>Family savings stack</h3>

                    <p>
                        Track official decisions, deadlines and approved
                        expense reductions.
                    </p>
                </div>

                <div className="family-savings-actions">
                    <button
                        className="icon-button"
                        type="button"
                        onClick={loadRoutes}
                        aria-label="Refresh savings routes"
                    >
                        <RefreshCw size={17} />
                    </button>

                    <button
                        className="button primary"
                        type="button"
                        onClick={() => setShowForm(true)}
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
                    <small>Count only written approvals</small>
                </article>

                <article>
                    <span>Active applications</span>
                    <strong>{activeApplications}</strong>
                    <small>Do not count as approved</small>
                </article>

                <article>
                    <span>Actions due soon</span>
                    <strong>{dueSoon}</strong>
                    <small>Within 14 days</small>
                </article>
            </div>

            {error && (
                <div className="error-box" role="alert">
                    {error}
                </div>
            )}

            {!routes.length && !loading && (
                <button
                    className="button secondary"
                    type="button"
                    onClick={addStarterRoutes}
                >
                    Add starter opportunity checklist
                </button>
            )}

            {loading ? (
                <div className="savings-loading">
                    <Loader2 className="spin" size={24} />
                    <span>Loading savings routes…</span>
                </div>
            ) : routes.length ? (
                <div className="savings-route-list">
                    {routes.map((route) => {
                        const officialUrl = safeExternalUrl(route.official_url);

                        return (
                            <article className="savings-route-card" key={route.id}>
                                <div className="savings-route-header">
                                    <div>
                                        <span className="pill blue">
                                            {route.category}
                                        </span>

                                        <h4>{route.title}</h4>
                                    </div>

                                    <span className={`savings-status ${route.status}`}>
                                        {statusLabel(route.status)}
                                    </span>
                                </div>

                                <div className="savings-values">
                                    <span>
                                        Monthly:{" "}
                                        <strong>
                                            {showMoney(
                                                Number(route.approved_monthly_value || 0)
                                            )}
                                        </strong>
                                    </span>

                                    <span>
                                        One-time:{" "}
                                        <strong>
                                            {showMoney(
                                                Number(route.approved_one_time_value || 0)
                                            )}
                                        </strong>
                                    </span>
                                </div>

                                {route.next_action && (
                                    <div className="savings-next-action">
                                        <strong>Next action</strong>
                                        <p>{route.next_action}</p>

                                        {route.next_action_on && (
                                            <small>
                                                Due{" "}
                                                {new Date(
                                                    `${route.next_action_on}T12:00:00`
                                                ).toLocaleDateString()}
                                            </small>
                                        )}
                                    </div>
                                )}

                                {route.reporting_obligations && (
                                    <div className="route-reporting-note">
                                        <ShieldCheck size={15} />
                                        <span>{route.reporting_obligations}</span>
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

                                    {route.owner_user_id === currentUserId && (
                                        <>
                                            <select
                                                aria-label={`Update ${route.title} status`}
                                                value={route.status}
                                                onChange={(event) =>
                                                    updateStatus(route, event.target.value)
                                                }
                                            >
                                                {statuses.map((status) => (
                                                    <option value={status} key={status}>
                                                        {statusLabel(status)}
                                                    </option>
                                                ))}
                                            </select>

                                            <button
                                                className="icon-button danger"
                                                type="button"
                                                onClick={() => deleteRoute(route)}
                                                aria-label="Delete route"
                                            >
                                                <Trash2 size={16} />
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
                    Add opportunities you intend to verify with official
                    agencies or organizations.
                </div>
            )}

            <div className="warning-inline">
                <ShieldCheck size={18} />

                <span>
                    Potential eligibility is not approval. Report household,
                    income and residence information accurately and keep
                    written decisions.
                </span>
            </div>

            {showForm && (
                <div
                    className="modal-backdrop"
                    onMouseDown={() => setShowForm(false)}
                >
                    <div
                        className="modal"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header className="modal-header">
                            <h2>Add savings route</h2>

                            <button
                                className="icon-button"
                                type="button"
                                onClick={() => setShowForm(false)}
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <form className="stack" onSubmit={saveRoute}>
                            <label className="field">
                                <span>Program or opportunity</span>

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
                                                category: event.target.value,
                                            })
                                        }
                                    >
                                        {categories.map((category) => (
                                            <option key={category}>
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
                                            <option value={status} key={status}>
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
                                    placeholder="https://..."
                                    value={form.official_url}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            official_url: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <div className="form-grid">
                                <label className="field">
                                    <span>Approved monthly value</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.approved_monthly_value}
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
                                    <span>Approved one-time value</span>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.approved_one_time_value}
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
                                                applied_on: event.target.value,
                                            })
                                        }
                                    />
                                </label>

                                <label className="field">
                                    <span>Renewal date</span>

                                    <input
                                        type="date"
                                        value={form.renewal_on}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                renewal_on: event.target.value,
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
                                            next_action: event.target.value,
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
                                            next_action_on: event.target.value,
                                        })
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Reporting obligations</span>

                                <textarea
                                    rows="3"
                                    maxLength={2000}
                                    placeholder="What changes must be reported, and by when?"
                                    value={form.reporting_obligations}
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
                                <span>Visibility</span>

                                <select
                                    value={form.visibility}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            visibility: event.target.value,
                                        })
                                    }
                                >
                                    <option value="shared">Shared together</option>
                                    <option value="private">Only me</option>
                                </select>
                            </label>

                            <button
                                className="button primary"
                                type="submit"
                                disabled={saving}
                            >
                                {saving ? (
                                    <Loader2 className="spin" size={17} />
                                ) : (
                                    <CheckCircle2 size={17} />
                                )}

                                Save route
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
