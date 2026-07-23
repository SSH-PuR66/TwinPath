import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
    Baby,
    Bell,
    BriefcaseBusiness,
    CalendarDays,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    Copy,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    FileLock2,
    HeartHandshake,
    Home,
    Loader2,
    LogOut,
    Menu,
    Palette,
    PiggyBank,
    Plus,
    RefreshCw,
    Settings,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
    UserPlus,
    Vault,
    WalletCards,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import ThemeScene, { ThemePreview, usePageHidden } from "./ThemeScene";
import ThemeMarketplace from "./ThemeMarketplace";
import { includedThemes, resolveThemeKey, themes } from "./themeCatalog";
import ProposalsPanel from "./ProposalsPanel";
import { useFeatureFlags } from "./useFeatureFlags";
import DepositRouter from "./DepositRouter";
import MoneyActionCenter from "./MoneyActionCenter";

import {
    initialAllocation,
    legalResources,
    starterTasks,
    wealthSteps,
} from "./resources";

import NetworkStatus from "./NetworkStatus";
import { AnimatedMoney } from "./AnimatedMoney";
import AnimatedPage from "./AnimatedPage";
import RevenueAllocator from "./RevenueAllocator";
import FeatureLoader from "./FeatureLoader";
import { safeExternalUrl } from "./safeUrl";

const CalendarView = lazy(() => import("./CalendarView.jsx"));
const FamilyGallery = lazy(() => import("./FamilyGallery.jsx"));
const FamilySavings = lazy(() => import("./FamilySavings.jsx"));
const FamilyWorkspace = lazy(() => import("./FamilyWorkspace.jsx"));
const GrowWorkspace = lazy(() => import("./GrowWorkspace.jsx"));
const FinancialConnectionsPanel = lazy(() => import("./FinancialConnectionsPanel.jsx"));

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "money", label: "Money", icon: WalletCards },
    { id: "grow", label: "Grow", icon: BriefcaseBusiness },
    { id: "family", label: "Family", icon: Baby },
    { id: "settings", label: "Settings", icon: Settings },
];

const visibilityOptions = [
    { value: "shared", label: "Shared" },
    { value: "private", label: "Only me" },
];

function safeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function nowDateInput() {
    return new Date().toISOString().slice(0, 10);
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
    const start = new Date(appointment.starts_at);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const content = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TwinPath//Family Planner//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${appointment.id}@twinpath`,
        `DTSTAMP:${toICSDate(new Date())}`,
        `DTSTART:${toICSDate(start)}`,
        `DTEND:${toICSDate(end)}`,
        `SUMMARY:${escapeICS(appointment.title)}`,
        `LOCATION:${escapeICS(appointment.location || "")}`,
        `DESCRIPTION:${escapeICS(appointment.notes || "")}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([content], {
        type: "text/calendar;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${safeFileName(appointment.title)}.ics`;
    anchor.click();

    URL.revokeObjectURL(url);
}

function Button({
    children,
    className = "",
    variant = "primary",
    icon: Icon,
    ...props
}) {
    return (
        <button className={`button ${variant} ${className}`} {...props}>
            {Icon && <Icon size={17} />}
            {children}
        </button>
    );
}

function Card({ children, className = "" }) {
    return <section className={`glass-card ${className}`}>{children}</section>;
}

function Empty({ children }) {
    return <div className="empty">{children}</div>;
}

function Pill({ children, tone = "neutral" }) {
    return <span className={`pill ${tone}`}>{children}</span>;
}

function Modal({ title, children, onClose }) {
    return (
        <div className="modal-backdrop" onMouseDown={onClose}>
            <div
                className="modal"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className="modal-header">
                    <h2>{title}</h2>
                    <button className="icon-button" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </header>

                {children}
            </div>
        </div>
    );
}

function Field({ label, children, hint }) {
    return (
        <label className="field">
            <span>{label}</span>
            {children}
            {hint && <small>{hint}</small>}
        </label>
    );
}

function AuthScreen() {
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signInWithPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setBusy(false);

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Incorrect email or password. If you have never created a password, use the secure email link once."
          : authError.message
      );
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);

    const { error: authError } =
      await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });

    setBusy(false);

    if (authError) {
      const isRateLimit =
        authError.message
          ?.toLowerCase()
          .includes("rate limit");

      setError(
        isRateLimit
          ? "Supabase has temporarily limited authentication emails. Stop retrying and wait for the limit shown in Supabase Authentication logs."
          : authError.message
      );

      return;
    }

    setSent(true);
  }

  return (
    <main className="auth-screen">
      <ThemeScene themeKey="aurora" />

      <Card className="auth-card">
        <div className="brand-mark">
          <Sparkles size={26} />
        </div>

        <p className="eyebrow">
          PRIVATE FAMILY COMMAND CENTER
        </p>

        <h1>TwinPath</h1>

        <p className="muted">
          Plan together, protect private information,
          track money and prepare for what comes next.
        </p>

        <div className="segmented">
          <button
            type="button"
            className={mode === "password" ? "active" : ""}
            onClick={() => {
              setMode("password");
              setError("");
              setSent(false);
            }}
          >
            Password
          </button>

          <button
            type="button"
            className={mode === "magic" ? "active" : ""}
            onClick={() => {
              setMode("magic");
              setError("");
              setSent(false);
            }}
          >
            Email link
          </button>
        </div>

        {mode === "password" ? (
          <form
            onSubmit={signInWithPassword}
            className="stack"
          >
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                placeholder="Your TwinPath password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />
            </Field>

            {error && (
              <div className="error-box">{error}</div>
            )}

            <Button type="submit" disabled={busy}>
              {busy && (
                <Loader2
                  className="spin"
                  size={18}
                />
              )}

              Sign in
            </Button>

            <button
              className="text-button"
              type="button"
              onClick={() => {
                setMode("magic");
                setError("");
              }}
            >
              I have not created a password yet
            </button>
          </form>
        ) : sent ? (
          <div className="success-box">
            <CheckCircle2 />

            <div>
              <strong>Check your email</strong>
              <p>
                Open the secure sign-in link on this
                device. Do not request another link.
              </p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={sendMagicLink}
            className="stack"
          >
            <Field
              label="Email"
              hint="Use this once to access your account and create a password."
            >
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />
            </Field>

            {error && (
              <div className="error-box">{error}</div>
            )}

            <Button type="submit" disabled={busy}>
              {busy && (
                <Loader2
                  className="spin"
                  size={18}
                />
              )}

              Send one secure link
            </Button>

            <button
              className="text-button"
              type="button"
              onClick={() => {
                setMode("password");
                setError("");
              }}
            >
              Return to password sign-in
            </button>
          </form>
        )}

        <div className="privacy-note">
          <ShieldCheck size={18} />

          <span>
            Each partner should have a separate account.
            Never share account passwords.
          </span>
        </div>
      </Card>
    </main>
  );
}

function HouseholdSetup({ onReady }) {
    const [mode, setMode] = useState("create");
    const [name, setName] = useState("Our Family");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");

        const rpc =
            mode === "create"
                ? supabase.rpc("create_household", {
                    household_name: name.trim() || "Our Family",
                })
                : supabase.rpc("join_household", {
                    join_code: code.trim().toUpperCase(),
                });

        const { error: rpcError } = await rpc;

        setBusy(false);

        if (rpcError) {
            setError(rpcError.message);
            return;
        }

        onReady();
    }

    return (
        <main className="auth-screen">
            <ThemeScene themeKey="orbit" />

            <Card className="auth-card">
                <div className="brand-mark">
                    <HeartHandshake size={26} />
                </div>

                <p className="eyebrow">HOUSEHOLD SETUP</p>
                <h1>Start together</h1>

                <div className="segmented">
                    <button
                        className={mode === "create" ? "active" : ""}
                        onClick={() => setMode("create")}
                    >
                        Create
                    </button>

                    <button
                        className={mode === "join" ? "active" : ""}
                        onClick={() => setMode("join")}
                    >
                        Join
                    </button>
                </div>

                <form onSubmit={submit} className="stack">
                    {mode === "create" ? (
                        <Field label="Household name">
                            <input
                                value={name}
                                maxLength={50}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </Field>
                    ) : (
                        <Field
                            label="Invitation code"
                            hint="Enter the code shown in your partner's settings."
                        >
                            <input
                                value={code}
                                maxLength={10}
                                autoCapitalize="characters"
                                onChange={(event) => setCode(event.target.value.toUpperCase())}
                            />
                        </Field>
                    )}

                    {error && <div className="error-box">{error}</div>}

                    <Button type="submit" disabled={busy}>
                        {busy ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
                        {mode === "create" ? "Create household" : "Join household"}
                    </Button>
                </form>
            </Card>
        </main>
    );
}

function AppHeader({
    household,
    privateMode,
    setPrivateMode,
    setSettingsOpen,
}) {
    return (
        <header className="app-header">
            <div>
                <span className="eyebrow">TWINPATH</span>
                <h1>{household?.name || "Our Family"}</h1>
            </div>

            <div className="header-actions">
                <button
                    className="icon-button"
                    onClick={() => setPrivateMode((value) => !value)}
                    aria-label="Toggle private display"
                >
                    {privateMode ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>

                <button
                    className="icon-button"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Open settings"
                >
                    <Settings size={20} />
                </button>
            </div>
        </header>
    );
}

function SummaryCard({ icon: Icon, label, value, detail }) {
    return (
        <Card className="summary-card">
            <div className="summary-icon">
                <Icon size={20} />
            </div>

            <div>
                <span>{label}</span>
                <strong>{value}</strong>
                {detail && <small>{detail}</small>}
            </div>
        </Card>
    );
}

function HomeMoneySnapshot({ householdId, privateMode, proposalCount }) {
    const [overview, setOverview] = useState(null);
    const [status, setStatus] = useState("loading");
    const controlPlaneUrl = (safeExternalUrl(String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim(), {
        allowLocalHttp: true,
    }) || "").replace(/\/+$/, "");

    useEffect(() => {
        let active = true;
        if (!controlPlaneUrl || !householdId) {
            setStatus("unavailable");
            return () => { active = false; };
        }
        async function loadOverview() {
            try {
                const { data } = await supabase.auth.getSession();
                if (!data.session?.access_token) throw new Error("No session");
                const response = await fetch(`${controlPlaneUrl}/v1/financial/summary`, {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                        "X-Household-Id": String(householdId),
                    },
                });
                if (!response.ok) throw new Error("Overview unavailable");
                const next = await response.json();
                if (active) {
                    setOverview(next);
                    setStatus("ready");
                }
            } catch {
                if (active) setStatus(navigator.onLine ? "unavailable" : "offline");
            }
        }
        loadOverview();
        return () => { active = false; };
    }, [controlPlaneUrl, householdId]);

    const amount = (value) => privateMode ? "••••" : moneyFormatter.format(Number(value) || 0);
    const income = Number(overview?.income) || 0;
    const expense = Number(overview?.expense) || 0;
    const net = Number(overview?.net) || 0;
    const latestMonth = Array.isArray(overview?.by_month) ? overview.by_month.at(-1) : null;

    return (
        <Card>
            <div className="section-title">
                <div>
                    <span className="eyebrow">LIVE MONEY SNAPSHOT</span>
                    <h3>What is safe to plan with</h3>
                </div>
                <WalletCards size={22} />
            </div>
            {status === "ready" ? (
                <div className="summary-grid">
                    <SummaryCard icon={WalletCards} label="90-day net" value={amount(net)} detail="Income minus recorded spending" />
                    <SummaryCard icon={RefreshCw} label="Account window" value={`${overview?.window_days || 90} days`} detail={`${overview?.transaction_count || 0} tracked transaction(s)`} />
                    <SummaryCard icon={CircleDollarSign} label="Recorded income" value={amount(income)} detail="Across the current window" />
                    <SummaryCard icon={PiggyBank} label="Savings pace" value={amount(Math.max(0, net))} detail={latestMonth ? `${latestMonth.month} net: ${amount(latestMonth.net)}` : "Connect or import transactions"} />
                </div>
            ) : (
                <p className="muted">
                    {status === "loading" ? "Loading your read-only account snapshot…" : status === "offline"
                        ? "Offline — live account freshness is unavailable. Open Money when reconnected."
                        : "No financial summary is available yet. Connect an institution or import a CSV in Money."}
                </p>
            )}
            {proposalCount > 0 ? <small>{proposalCount} proposal{proposalCount === 1 ? "" : "s"} awaiting your review below.</small> : null}
        </Card>
    );
}

function TodayTab({
    householdId,
    tasks,
    appointments,
    balance,
    privateMode,
    reducedMotion,
    setTaskModal,
    toggleTask,
    proposalCount,
    proposalRefreshKey,
    onProposalCount,
    onFlagsChanged,
    onToast,
}) {
    const incomplete = tasks
        .filter((task) => !task.completed)
        .sort((a, b) => {
            const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
            return (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);
        });

    const safeAppointments = Array.isArray(appointments)
        ? appointments
        : [];

    const upcomingAppointments = safeAppointments
        .filter((item) => {
            if (!item?.starts_at) return false;

            const startTime = new Date(item.starts_at).getTime();

            return Number.isFinite(startTime) && startTime >= Date.now();
        })
        .sort((a, b) => {
            return (
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime()
            );
        });

    const nextAppointment = upcomingAppointments[0] || null;

    return (
        <div className="page-stack">
            <section className="hero">
                <p className="eyebrow">SHARED COMMAND CENTER</p>
                <h2>One clear step at a time.</h2>
                <p>
                    Prioritize healthcare, housing, food, transportation and reliable
                    income before speculative opportunities.
                </p>

                <Button icon={Plus} onClick={() => setTaskModal(true)}>
                    Add task
                </Button>
            </section>

            <HomeMoneySnapshot
                householdId={householdId}
                privateMode={privateMode}
                proposalCount={proposalCount}
            />

            <ProposalsPanel
                householdId={householdId}
                onPendingCount={onProposalCount}
                onFlagsChanged={onFlagsChanged}
                refreshKey={proposalRefreshKey}
                onToast={onToast}
            />

            <DepositRouter householdId={householdId} onToast={onToast} />

            <div className="summary-grid">
                <SummaryCard
                    icon={CheckCircle2}
                    label="Open tasks"
                    value={incomplete.length}
                    detail={`${tasks.filter((task) => task.completed).length} completed`}
                />

                <SummaryCard
                    icon={CalendarDays}
                    label="Next appointment"
                    value={
                        nextAppointment?.starts_at
                            ? dateFormatter.format(
                                  new Date(nextAppointment.starts_at)
                              )
                            : "None"
                    }
                    detail={nextAppointment?.title || "No upcoming appointments"}
                />

                <SummaryCard
                    icon={CircleDollarSign}
                    label="Tracked balance"
                    value={
                        privateMode
                            ? "••••••"
                            : <AnimatedMoney value={balance} reducedMotion={reducedMotion} />
                    }
                    detail="Income minus expenses"
                />
            </div>

            <Card>
                <div className="section-title">
                    <div>
                        <span className="eyebrow">PRIORITY</span>
                        <h3>Next actions</h3>
                    </div>

                    <Pill tone="blue">{incomplete.length} open</Pill>
                </div>

                {incomplete.length ? (
                    <div className="task-list">
                        {incomplete.slice(0, 6).map((task) => (
                            <button
                                key={task.id}
                                className="task-row"
                                onClick={() => toggleTask(task)}
                            >
                                <span className="check-circle" />

                                <span className="task-content">
                                    <strong>{task.title}</strong>
                                    <small>
                                        {task.category || "General"}
                                        {task.due_date
                                            ? ` · Due ${dateFormatter.format(
                                                new Date(`${task.due_date}T12:00:00`)
                                            )}`
                                            : ""}
                                    </small>
                                </span>

                                <Pill
                                    tone={
                                        task.priority === "urgent"
                                            ? "red"
                                            : task.priority === "high"
                                                ? "amber"
                                                : "neutral"
                                    }
                                >
                                    {task.priority}
                                </Pill>
                            </button>
                        ))}
                    </div>
                ) : (
                    <Empty>Nothing urgent. Add the next useful action.</Empty>
                )}
            </Card>

            <Card className="warning-card">
                <ShieldCheck size={23} />
                <div>
                    <strong>Eligibility is never guaranteed by this app</strong>
                    <p>
                        Report residence, household members and income accurately. Count
                        money only after an agency or institution approves it in writing.
                    </p>
                </div>
            </Card>
        </div>
    );
}

function PlanTab({
    tasks,
    setTaskModal,
    toggleTask,
    deleteTask,
    seedTasks,
}) {
    const [resourceFilter, setResourceFilter] = useState("All");

    const categories = [
        "All",
        ...new Set(legalResources.map((item) => item.category)),
    ];

    const filteredResources =
        resourceFilter === "All"
            ? legalResources
            : legalResources.filter((item) => item.category === resourceFilter);

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">ACTION PLAN</p>
                    <h2>Plan and verify</h2>
                </div>

                <Button icon={Plus} onClick={() => setTaskModal(true)}>
                    Add
                </Button>
            </div>

            <Card>
                <div className="section-title">
                    <div>
                        <h3>Household tasks</h3>
                        <p>Private tasks remain visible only to their owner.</p>
                    </div>

                    {!tasks.length && (
                        <Button variant="secondary" onClick={seedTasks}>
                            Add starter plan
                        </Button>
                    )}
                </div>

                {tasks.length ? (
                    <div className="task-list">
                        {tasks.map((task) => (
                            <div className="task-row static" key={task.id}>
                                <button
                                    className={`check-circle ${task.completed ? "checked" : ""}`}
                                    onClick={() => toggleTask(task)}
                                    aria-label="Toggle task"
                                >
                                    {task.completed && <Check size={14} />}
                                </button>

                                <span
                                    className={`task-content ${task.completed ? "completed" : ""
                                        }`}
                                >
                                    <strong>{task.title}</strong>
                                    <small>
                                        {task.category || "General"}
                                        {task.due_date
                                            ? ` · ${dateFormatter.format(
                                                new Date(`${task.due_date}T12:00:00`)
                                            )}`
                                            : ""}
                                        {task.visibility === "private" ? " · Only me" : ""}
                                    </small>
                                </span>

                                <Pill
                                    tone={
                                        task.priority === "urgent"
                                            ? "red"
                                            : task.priority === "high"
                                                ? "amber"
                                                : "neutral"
                                    }
                                >
                                    {task.priority}
                                </Pill>

                                <button
                                    className="icon-button small danger"
                                    onClick={() => deleteTask(task)}
                                    aria-label="Delete task"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty>No tasks yet. Add one or load the starter plan.</Empty>
                )}
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <span className="eyebrow">LEGAL ROUTES</span>
                        <h3>Resource navigator</h3>
                        <p>Current eligibility must be confirmed with each organization.</p>
                    </div>
                </div>

                <div className="chip-row">
                    {categories.map((category) => (
                        <button
                            key={category}
                            className={`chip ${resourceFilter === category ? "active" : ""
                                }`}
                            onClick={() => setResourceFilter(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="resource-grid">
                    {filteredResources.map((resource) => (
                        <article className="resource-card" key={resource.id}>
                            <div>
                                <Pill tone="blue">{resource.category}</Pill>
                                <h4>{resource.title}</h4>
                                <p>{resource.description}</p>
                            </div>

                            <div className="resource-warning">
                                <ShieldCheck size={16} />
                                <span>{resource.warning}</span>
                            </div>

                             <div className="resource-actions">
                                {safeExternalUrl(resource.url) && (
                                    <a
                                        className="button secondary"
                                        href={safeExternalUrl(resource.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Official site
                                        <ExternalLink size={15} />
                                    </a>
                                )}

                                {resource.phone && (
                                    <a
                                        className="button ghost"
                                        href={`tel:${resource.phone.replace(/[^\d+]/g, "")}`}
                                    >
                                        {resource.phone}
                                    </a>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function MoneyTab({
    householdId,
    currentUserId,
    onImported,
    onToast,
    transactions,
    opportunities,
    privateMode,
    setTransactionModal,
    setOpportunityModal,
    deleteTransaction,
    deleteOpportunity,
}) {
    const income = transactions
        .filter((item) => item.kind === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const expenses = transactions
        .filter((item) => item.kind === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const balance = income - expenses;

    function shownMoney(value) {
        return privateMode ? "••••••" : moneyFormatter.format(value);
    }

    function exportCSV() {
        const header = [
            "Date",
            "Type",
            "Category",
            "Description",
            "Amount",
            "Visibility",
        ];

        const rows = transactions.map((item) => [
            item.transaction_date,
            item.kind,
            item.category || "",
            item.description || "",
            item.amount,
            item.visibility,
        ]);

        const escape = (value) =>
            `"${String(value ?? "").replaceAll('"', '""')}"`;

        const csv = [header, ...rows]
            .map((row) => row.map(escape).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = `twinpath-transactions-${nowDateInput()}.csv`;
        anchor.click();

        URL.revokeObjectURL(url);
    }

    return (
        <div className="page-stack">
            <Suspense fallback={<FeatureLoader label="Opening live money overview…" />}>
                <FinancialConnectionsPanel
                    householdId={householdId}
                    currentUserId={currentUserId}
                    privateMode={privateMode}
                />
            </Suspense>
            <MoneyActionCenter
                householdId={householdId}
                currentUserId={currentUserId}
                onImported={onImported}
                onToast={onToast}
            />
            <div className="page-heading">
                <div>
                    <p className="eyebrow">MONEY</p>
                    <h2>Protect, earn, then grow</h2>
                </div>

                <Button icon={Plus} onClick={() => setTransactionModal(true)}>
                    Transaction
                </Button>
            </div>

            <div className="summary-grid">
                <SummaryCard
                    icon={CircleDollarSign}
                    label="Income"
                    value={shownMoney(income)}
                />

                <SummaryCard
                    icon={WalletCards}
                    label="Expenses"
                    value={shownMoney(expenses)}
                />

                <SummaryCard
                    icon={ShieldCheck}
                    label="Balance"
                    value={shownMoney(balance)}
                />
            </div>

            <Card>
                <RevenueAllocator
                    privateMode={privateMode}
                    onLogIncome={() => setTransactionModal(true)}
                />
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <span className="eyebrow">STARTING PLAN</span>
                        <h3>A cautious \$2,000 allocation</h3>
                        <p>
                            Adjust this to your actual essential expenses and medical needs.
                        </p>
                    </div>
                </div>

                <div className="allocation-list">
                    {initialAllocation.map((item) => (
                        <div className="allocation-row" key={item.name}>
                            <span>{item.name}</span>
                            <strong>
                                {privateMode ? "••••" : moneyFormatter.format(item.amount)}
                            </strong>
                            <div className="progress-track">
                                <span
                                    style={{
                                        width: `${Math.max(4, (item.amount / 2000) * 100)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="warning-inline">
                    <ShieldCheck size={18} />
                    <span>
                        Do not put near-term family money into options, leverage, meme
                        coins, gambling or unauthorized security work.
                    </span>
                </div>
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <h3>Transactions</h3>
                        <p>Track actual profit, not only gross money received.</p>
                    </div>

                    <Button
                        icon={Download}
                        variant="secondary"
                        onClick={exportCSV}
                        disabled={!transactions.length}
                    >
                        CSV
                    </Button>
                </div>

                {transactions.length ? (
                    <div className="transaction-list">
                        {transactions.map((item) => (
                            <div className="transaction-row" key={item.id}>
                                <div
                                    className={`transaction-icon ${item.kind === "income" ? "positive" : "negative"
                                        }`}
                                >
                                    <CircleDollarSign size={18} />
                                </div>

                                <div className="transaction-copy">
                                    <strong>{item.description || item.category}</strong>
                                    <small>
                                        {item.category || "Other"} ·{" "}
                                        {dateFormatter.format(
                                            new Date(`${item.transaction_date}T12:00:00`)
                                        )}
                                        {item.visibility === "private" ? " · Only me" : ""}
                                    </small>
                                </div>

                                <strong
                                    className={
                                        item.kind === "income" ? "money-positive" : "money-negative"
                                    }
                                >
                                    {privateMode
                                        ? "••••"
                                        : `${item.kind === "income" ? "+" : "-"}${moneyFormatter.format(
                                            Number(item.amount)
                                        )}`}
                                </strong>

                                <button
                                    className="icon-button small danger"
                                    onClick={() => deleteTransaction(item)}
                                    aria-label="Delete transaction"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty>No transactions recorded.</Empty>
                )}
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <span className="eyebrow">INCOME PIPELINE</span>
                        <h3>Build reliable income</h3>
                    </div>

                    <Button
                        icon={Plus}
                        variant="secondary"
                        onClick={() => setOpportunityModal(true)}
                    >
                        Add route
                    </Button>
                </div>

                {opportunities.length ? (
                    <div className="opportunity-grid">
                        {opportunities.map((item) => (
                            <article className="opportunity-card" key={item.id}>
                                <div className="opportunity-top">
                                    <Pill tone="blue">{item.status}</Pill>

                                    <button
                                        className="icon-button small danger"
                                        onClick={() => deleteOpportunity(item)}
                                        aria-label="Delete opportunity"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>

                                <h4>{item.title}</h4>
                                <p>{item.organization || "Independent route"}</p>

                                {item.estimated_monthly > 0 && (
                                    <strong>
                                        Potential:{" "}
                                        {privateMode
                                            ? "••••"
                                            : moneyFormatter.format(item.estimated_monthly)}
                                        /month
                                    </strong>
                                )}

                                {item.notes && <small>{item.notes}</small>}
                            </article>
                        ))}
                    </div>
                ) : (
                    <Empty>
                        Add campus IT, work-study, remote support, performance bookings or
                        another legal income route.
                    </Empty>
                )}
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <span className="eyebrow">WEALTH ROADMAP</span>
                        <h3>The realistic path upward</h3>
                    </div>
                </div>

                <div className="timeline">
                    {wealthSteps.map((step, index) => (
                        <div className="timeline-row" key={step.stage}>
                            <div className="timeline-number">{index + 1}</div>

                            <div>
                                <Pill>{step.stage}</Pill>
                                <h4>{step.title}</h4>
                                <p>{step.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function FamilyTab({
    appointments,
    setAppointmentModal,
    deleteAppointment,
}) {
    const safeAppointments = Array.isArray(appointments)
        ? appointments
        : [];

    const checklists = [
        {
            title: "Healthcare",
            items: [
                "Confirm prenatal care with an obstetric team experienced with twins",
                "Ask when maternal-fetal medicine involvement is appropriate",
                "Keep emergency symptom instructions from the medical team",
                "Confirm insurance and confidential communication settings",
            ],
        },
        {
            title: "Delivery transportation",
            items: [
                "Plan A: trusted insured driver",
                "Plan B: taxi or rideshare with sufficient lead time",
                "Plan C: emergency services only for a genuine emergency",
                "Save hospital route and labor-unit phone number offline",
            ],
        },
        {
            title: "Before discharge",
            items: [
                "Complete birth-registration paperwork",
                "Request certified birth-certificate ordering instructions",
                "Accept Social Security number applications if desired",
                "Confirm newborn insurance-enrollment instructions",
                "Ask for written follow-up and warning-sign instructions",
            ],
        },
        {
            title: "Safe essentials",
            items: [
                "Two safe sleep spaces following current pediatric guidance",
                "Two new or fully verified, unexpired car seats",
                "Feeding supplies recommended by the medical team",
                "Diapers, clothing, thermometer and medication guidance",
            ],
        },
    ];

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">FAMILY</p>
                    <h2>Prepare safely together</h2>
                </div>

                <Button icon={CalendarDays} onClick={() => setAppointmentModal(true)}>
                    Appointment
                </Button>
            </div>

            <Card className="warning-card">
                <Baby size={24} />
                <div>
                    <strong>This app does not provide medical advice</strong>
                    <p>
                        A twin pregnancy may require additional monitoring. Follow the
                        obstetric and maternal-fetal medicine teams, and seek emergency
                        help for symptoms they identify as urgent.
                    </p>
                </div>
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <h3>Appointments</h3>
                        <p>Only share medical details both partners consent to sharing.</p>
                    </div>
                </div>

                {safeAppointments.length ? (
                    <div className="appointment-list">
                        {safeAppointments.map((item) => (
                            <article className="appointment-row" key={item.id}>
                                <div className="date-block">
                                    <strong>
                                        {new Date(item.starts_at).toLocaleDateString("en-US", {
                                            day: "2-digit",
                                        })}
                                    </strong>
                                    <span>
                                        {new Date(item.starts_at)
                                            .toLocaleDateString("en-US", { month: "short" })
                                            .toUpperCase()}
                                    </span>
                                </div>

                                <div className="appointment-copy">
                                    <strong>{item.title}</strong>
                                    <small>
                                        {new Date(item.starts_at).toLocaleTimeString("en-US", {
                                            hour: "numeric",
                                            minute: "2-digit",
                                        })}
                                        {item.location ? ` · ${item.location}` : ""}
                                        {item.visibility === "private" ? " · Only me" : ""}
                                    </small>
                                    {item.notes && <p>{item.notes}</p>}
                                </div>

                                <button
                                    className="icon-button small"
                                    onClick={() => downloadAppointmentICS(item)}
                                    aria-label="Add appointment to calendar"
                                >
                                    <Download size={16} />
                                </button>

                                <button
                                    className="icon-button small danger"
                                    onClick={() => deleteAppointment(item)}
                                    aria-label="Delete appointment"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </article>
                        ))}
                    </div>
                ) : (
                    <Empty>No appointments recorded.</Empty>
                )}
            </Card>

            <div className="checklist-grid">
                {checklists.map((list) => (
                    <Card key={list.title}>
                        <h3>{list.title}</h3>

                        <ul className="safe-list">
                            {list.items.map((item) => (
                                <li key={item}>
                                    <CheckCircle2 size={17} />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function VaultTab({
    documents,
    uploadDocument,
    downloadDocument,
    deleteDocument,
    uploading,
}) {
    const [visibility, setVisibility] = useState("private");

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">VAULT</p>
                    <h2>Protected documents</h2>
                </div>
            </div>

            <Card className="warning-card">
                <FileLock2 size={24} />
                <div>
                    <strong>Store the minimum necessary</strong>
                    <p>
                        Avoid uploading full Social Security numbers, complete tax IDs,
                        passwords or unredacted identity documents unless truly necessary.
                        Database access controls are not the same as end-to-end encryption.
                    </p>
                </div>
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <h3>Upload a document</h3>
                        <p>Private files are visible only to the account that uploaded them.</p>
                    </div>
                </div>

                <div className="upload-box">
                    <Upload size={30} />

                    <div>
                        <strong>Select a redacted file</strong>
                        <p>PDF, image or text file. Maximum 10 MB.</p>
                    </div>

                    <select
                        value={visibility}
                        onChange={(event) => setVisibility(event.target.value)}
                    >
                        {visibilityOptions.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <label className="button primary">
                        {uploading ? (
                            <Loader2 size={17} className="spin" />
                        ) : (
                            <Upload size={17} />
                        )}
                        Choose file
                        <input
                            hidden
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,image/*,application/pdf,text/plain"
                            disabled={uploading}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) uploadDocument(file, visibility);
                                event.target.value = "";
                            }}
                        />
                    </label>
                </div>
            </Card>

            <Card>
                <div className="section-title">
                    <div>
                        <h3>Files</h3>
                        <p>Downloads use short-lived signed links.</p>
                    </div>

                    <Pill tone="blue">{documents.length}</Pill>
                </div>

                {documents.length ? (
                    <div className="document-list">
                        {documents.map((document) => (
                            <div className="document-row" key={document.id}>
                                <div className="document-icon">
                                    <Vault size={19} />
                                </div>

                                <div className="document-copy">
                                    <strong>{document.file_name}</strong>
                                    <small>
                                        {(document.file_size / 1024).toFixed(1)} KB ·{" "}
                                        {document.visibility === "private" ? "Only me" : "Shared"}
                                    </small>
                                </div>

                                <button
                                    className="icon-button"
                                    onClick={() => downloadDocument(document)}
                                    aria-label="Download document"
                                >
                                    <Download size={17} />
                                </button>

                                <button
                                    className="icon-button danger"
                                    onClick={() => deleteDocument(document)}
                                    aria-label="Delete document"
                                >
                                    <Trash2 size={17} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty>No documents uploaded.</Empty>
                )}
            </Card>
        </div>
    );
}

function TaskModal({ onClose, onSave }) {
    const [form, setForm] = useState({
        title: "",
        category: "General",
        priority: "medium",
        due_date: "",
        visibility: "shared",
    });
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        await onSave(form);
        setBusy(false);
    }

    return (
        <Modal title="Add task" onClose={onClose}>
            <form className="stack" onSubmit={submit}>
                <Field label="Task">
                    <input
                        autoFocus
                        required
                        maxLength={180}
                        value={form.title}
                        onChange={(event) =>
                            setForm({ ...form, title: event.target.value })
                        }
                    />
                </Field>

                <div className="form-grid">
                    <Field label="Category">
                        <input
                            maxLength={50}
                            value={form.category}
                            onChange={(event) =>
                                setForm({ ...form, category: event.target.value })
                            }
                        />
                    </Field>

                    <Field label="Priority">
                        <select
                            value={form.priority}
                            onChange={(event) =>
                                setForm({ ...form, priority: event.target.value })
                            }
                        >
                            <option value="urgent">Urgent</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </Field>

                    <Field label="Due date">
                        <input
                            type="date"
                            value={form.due_date}
                            onChange={(event) =>
                                setForm({ ...form, due_date: event.target.value })
                            }
                        />
                    </Field>

                    <Field label="Visibility">
                        <select
                            value={form.visibility}
                            onChange={(event) =>
                                setForm({ ...form, visibility: event.target.value })
                            }
                        >
                            {visibilityOptions.map((option) => (
                                <option value={option.value} key={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>

                <Button type="submit" disabled={busy}>
                    {busy && <Loader2 size={17} className="spin" />}
                    Save task
                </Button>
            </form>
        </Modal>
    );
}

function TransactionModal({ onClose, onSave }) {
    const [form, setForm] = useState({
        kind: "expense",
        amount: "",
        category: "Other",
        description: "",
        transaction_date: nowDateInput(),
        visibility: "shared",
    });
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        await onSave({ ...form, amount: Number(form.amount) });
        setBusy(false);
    }

    return (
        <Modal title="Add transaction" onClose={onClose}>
            <form className="stack" onSubmit={submit}>
                <div className="form-grid">
                    <Field label="Type">
                        <select
                            value={form.kind}
                            onChange={(event) =>
                                setForm({ ...form, kind: event.target.value })
                            }
                        >
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                    </Field>

                    <Field label="Amount">
                        <input
                            required
                            min="0.01"
                            step="0.01"
                            type="number"
                            inputMode="decimal"
                            value={form.amount}
                            onChange={(event) =>
                                setForm({ ...form, amount: event.target.value })
                            }
                        />
                    </Field>

                    <Field label="Category">
                        <input
                            required
                            maxLength={60}
                            value={form.category}
                            onChange={(event) =>
                                setForm({ ...form, category: event.target.value })
                            }
                        />
                    </Field>

                    <Field label="Date">
                        <input
                            required
                            type="date"
                            value={form.transaction_date}
                            onChange={(event) =>
                                setForm({ ...form, transaction_date: event.target.value })
                            }
                        />
                    </Field>
                </div>

                <Field label="Description">
                    <input
                        maxLength={180}
                        value={form.description}
                        onChange={(event) =>
                            setForm({ ...form, description: event.target.value })
                        }
                    />
                </Field>

                <Field label="Visibility">
                    <select
                        value={form.visibility}
                        onChange={(event) =>
                            setForm({ ...form, visibility: event.target.value })
                        }
                    >
                        {visibilityOptions.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                <Button type="submit" disabled={busy}>
                    {busy && <Loader2 size={17} className="spin" />}
                    Save transaction
                </Button>
            </form>
        </Modal>
    );
}

function AppointmentModal({ initialDate, onClose, onSave }) {
    const [form, setForm] = useState({
        title: "",
        starts_at: initialDate ? `${initialDate}T09:00` : "",
        location: "",
        notes: "",
        visibility: "shared",
    });
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        await onSave(form);
        setBusy(false);
    }

    return (
        <Modal title="Add appointment" onClose={onClose}>
            <form className="stack" onSubmit={submit}>
                <Field label="Title">
                    <input
                        required
                        maxLength={180}
                        value={form.title}
                        onChange={(event) =>
                            setForm({ ...form, title: event.target.value })
                        }
                    />
                </Field>

                <Field label="Date and time">
                    <input
                        required
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(event) =>
                            setForm({ ...form, starts_at: event.target.value })
                        }
                    />
                </Field>

                <Field label="Location">
                    <input
                        maxLength={180}
                        value={form.location}
                        onChange={(event) =>
                            setForm({ ...form, location: event.target.value })
                        }
                    />
                </Field>

                <Field label="Notes">
                    <textarea
                        rows="3"
                        maxLength={1000}
                        value={form.notes}
                        onChange={(event) =>
                            setForm({ ...form, notes: event.target.value })
                        }
                    />
                </Field>

                <Field label="Visibility">
                    <select
                        value={form.visibility}
                        onChange={(event) =>
                            setForm({ ...form, visibility: event.target.value })
                        }
                    >
                        {visibilityOptions.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                <Button type="submit" disabled={busy}>
                    {busy && <Loader2 size={17} className="spin" />}
                    Save appointment
                </Button>
            </form>
        </Modal>
    );
}

function OpportunityModal({ initialRoute, onClose, onSave }) {
    const [form, setForm] = useState({
        title: initialRoute?.title || "",
        organization: "",
        status: "Idea",
        estimated_monthly: "",
        notes: initialRoute
            ? [
                initialRoute.description,
                initialRoute.reportingNote,
                initialRoute.officialUrl
                    ? `Official source: ${initialRoute.officialUrl}`
                    : "",
            ]
                .filter(Boolean)
                .join("\n\n")
            : "",
        visibility: "shared",
    });
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);

        await onSave({
            ...form,
            estimated_monthly: Number(form.estimated_monthly || 0),
        });

        setBusy(false);
    }

    return (
        <Modal title="Add income route" onClose={onClose}>
            <form className="stack" onSubmit={submit}>
                <Field label="Route or position">
                    <input
                        required
                        maxLength={180}
                        placeholder="Campus IT assistant"
                        value={form.title}
                        onChange={(event) =>
                            setForm({ ...form, title: event.target.value })
                        }
                    />
                </Field>

                <Field label="Organization">
                    <input
                        maxLength={180}
                        value={form.organization}
                        onChange={(event) =>
                            setForm({ ...form, organization: event.target.value })
                        }
                    />
                </Field>

                <div className="form-grid">
                    <Field label="Status">
                        <select
                            value={form.status}
                            onChange={(event) =>
                                setForm({ ...form, status: event.target.value })
                            }
                        >
                            <option>Idea</option>
                            <option>Applied</option>
                            <option>Interviewing</option>
                            <option>Active</option>
                            <option>Paid</option>
                            <option>Archived</option>
                        </select>
                    </Field>

                    <Field label="Estimated monthly amount">
                        <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={form.estimated_monthly}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    estimated_monthly: event.target.value,
                                })
                            }
                        />
                    </Field>
                </div>

                <Field label="Notes">
                    <textarea
                        rows="3"
                        maxLength={1000}
                        value={form.notes}
                        onChange={(event) =>
                            setForm({ ...form, notes: event.target.value })
                        }
                    />
                </Field>

                <Field label="Visibility">
                    <select
                        value={form.visibility}
                        onChange={(event) =>
                            setForm({ ...form, visibility: event.target.value })
                        }
                    >
                        {visibilityOptions.map((option) => (
                            <option value={option.value} key={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>

                <Button type="submit" disabled={busy}>
                    {busy && <Loader2 size={17} className="spin" />}
                    Save route
                </Button>
            </form>
        </Modal>
    );
}

function SettingsModal({
    household,
    profile,
    themeKey,
    setThemeKey,
    reducedMotion,
    setReducedMotion,
    privateMode,
    showThemeCatalog,
    onClose,
}) {
    const [copied, setCopied] = useState(false);
    const [inviteCode, setInviteCode] = useState(household.invite_code);
    const [rotating, setRotating] = useState(false);
    const [settingsError, setSettingsError] = useState("");

    const [newPassword, setNewPassword] = useState("");
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState("");
    const pageHidden = usePageHidden();
    const themeMotionOff = reducedMotion || privateMode || pageHidden;

    async function savePassword(event) {
        event.preventDefault();
        setPasswordMessage("");

        if (newPassword.length < 10) {
            setPasswordMessage(
                "Use at least 10 characters."
            );
            return;
        }

        setPasswordBusy(true);

        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        setPasswordBusy(false);

        if (error) {
            setPasswordMessage(error.message);
            return;
        }

        setNewPassword("");
        setPasswordMessage(
            "Password saved. You can now use password sign-in without requesting an email."
        );
    }

    async function copyCode() {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

    async function rotateCode() {
        const confirmed = window.confirm(
            "Create a new invitation code? The old code will stop working."
        );

        if (!confirmed) return;

        setRotating(true);
        setSettingsError("");

        const { data, error } = await supabase.rpc(
            "rotate_household_invite_code"
        );

        setRotating(false);

        if (error) {
            setSettingsError(error.message);
            return;
        }

        setInviteCode(data);
    }

    async function signOut() {
        await supabase.auth.signOut();
    }

    return (
        <Modal title="Settings" onClose={onClose}>
            <div className="stack">
                <Card className="nested-card">
                    <span className="eyebrow">SIGNED IN</span>
                    <strong>{profile?.display_name || profile?.email || "Member"}</strong>
                    <small>{profile?.email}</small>
                </Card>

                <div>
                    <span className="field-label">Partner invitation code</span>

                    <div className="invite-code">
                        <strong>{inviteCode}</strong>

                        <button className="icon-button" onClick={copyCode}>
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        icon={RefreshCw}
                        onClick={rotateCode}
                        disabled={rotating}
                    >
                        {rotating ? "Rotating…" : "Rotate invitation code"}
                    </Button>

                    {settingsError && (
                        <div className="error-box">{settingsError}</div>
                    )}

                    <small className="muted">
                        Share this only with the partner you want to join the household.
                    </small>
                </div>

                <div>
                    <span className="field-label">Live theme</span>

                    <div className="theme-catalog-note">
                        <strong>19 live themes, included free</strong>
                        <small>
                            No subscription, locked packs or paid visual upgrades.
                        </small>
                    </div>

                    <div className="theme-grid">
                        {Object.entries(includedThemes).map(([key, theme]) => (
                            <button
                                key={key}
                                type="button"
                                className={`theme-option ${themeKey === key ? "active" : ""}`}
                                onClick={() => setThemeKey(key)}
                                aria-pressed={themeKey === key}
                            >
                                <ThemePreview
                                    themeKey={key}
                                    motionOff={themeMotionOff}
                                />
                                <span className="theme-option-copy">
                                    <strong>
                                        <Palette size={15} />
                                        {theme.name}
                                    </strong>
                                    <small>{theme.description}</small>
                                    <span>Included free</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {showThemeCatalog ? (
                        <ThemeMarketplace
                            themeKey={themeKey}
                            onSelectTheme={setThemeKey}
                            motionOff={themeMotionOff}
                        />
                    ) : (
                        <small className="muted">
                            The optional locally packaged theme catalog is not enabled for this household.
                        </small>
                    )}
                </div>

                <label className="toggle-row">
                    <span>
                        <strong>Reduce motion</strong>
                        <small>Uses a static background and less battery.</small>
                    </span>

                    <input
                        type="checkbox"
                        checked={reducedMotion}
                        onChange={(event) => setReducedMotion(event.target.checked)}
                    />
                </label>

                <Card className="nested-card">
                    <span className="eyebrow">ACCOUNT ACCESS</span>
                    <h3>Create or change password</h3>

                    <p className="muted">
                        A password avoids Supabase email limits during
                        ordinary sign-in. Use a unique password that you
                        do not use anywhere else.
                    </p>

                    <form className="stack" onSubmit={savePassword}>
                        <Field label="New password">
                            <input
                                type="password"
                                autoComplete="new-password"
                                minLength={10}
                                required
                                value={newPassword}
                                onChange={(event) =>
                                    setNewPassword(event.target.value)
                                }
                                placeholder="At least 10 characters"
                            />
                        </Field>

                        {passwordMessage && (
                            <div
                                className={
                                    passwordMessage.startsWith("Password saved")
                                        ? "success-box compact"
                                        : "error-box"
                                }
                            >
                                {passwordMessage}
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="secondary"
                            disabled={passwordBusy}
                        >
                            {passwordBusy && (
                                <Loader2 className="spin" size={17} />
                            )}

                            Save password
                        </Button>
                    </form>
                </Card>

                <Button variant="danger" icon={LogOut} onClick={signOut}>
                    Sign out
                </Button>
            </div>
        </Modal>
    );
}

export default function App() {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [household, setHousehold] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState("home");
    const [error, setError] = useState("");

    const [tasks, setTasks] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [opportunities, setOpportunities] = useState([]);
    const [documents, setDocuments] = useState([]);

    const [taskModal, setTaskModal] = useState(false);
    const [transactionModal, setTransactionModal] = useState(false);
    const [appointmentModal, setAppointmentModal] = useState(false);
    const [appointmentDraftDate, setAppointmentDraftDate] = useState(null);
    const [opportunityModal, setOpportunityModal] = useState(false);
    const [opportunityDraft, setOpportunityDraft] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [privateMode, setPrivateMode] = useState(false);
    const [proposalCount, setProposalCount] = useState(0);
    const [proposalRefreshKey, setProposalRefreshKey] = useState(0);
    const [toast, setToast] = useState("");
    const { isEnabled: isFeatureEnabled, refresh: refreshFeatureFlags } = useFeatureFlags(household?.id);
    const onProposalCount = useCallback((count) => setProposalCount(Number(count) || 0), []);
    const showToast = useCallback((message) => {
        setToast(message);
        window.setTimeout(() => setToast((current) => current === message ? "" : current), 5000);
    }, []);

    useEffect(() => {
        const overlayOpen =
            taskModal ||
            transactionModal ||
            appointmentModal ||
            opportunityModal ||
            settingsOpen;

        const previousOverflow =
            document.body.style.overflow;

        const previousPosition =
            document.body.style.position;

        if (overlayOpen) {
            document.body.style.overflow = "hidden";
            document.body.style.position = "relative";
        }

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.position = previousPosition;
        };
    }, [
        taskModal,
        transactionModal,
        appointmentModal,
        opportunityModal,
        settingsOpen,
    ]);

    const [themeKey, setThemeKeyState] = useState(
        resolveThemeKey(localStorage.getItem("twinpath-theme"))
    );

    const [reducedMotion, setReducedMotionState] = useState(
        localStorage.getItem("twinpath-reduced-motion") === "true" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    );

    const balance = useMemo(() => {
        return transactions.reduce((sum, transaction) => {
            const amount = Number(transaction.amount);
            return transaction.kind === "income" ? sum + amount : sum - amount;
        }, 0);
    }, [transactions]);

    function setThemeKey(value) {
        const nextThemeKey = resolveThemeKey(value);
        setThemeKeyState(nextThemeKey);
        localStorage.setItem("twinpath-theme", nextThemeKey);
    }

    function setReducedMotion(value) {
        setReducedMotionState(value);
        localStorage.setItem("twinpath-reduced-motion", String(value));
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            if (!data.session) setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);

            if (!nextSession) {
                setProfile(null);
                setHousehold(null);
                setTasks([]);
                setAppointments([]);
                setTransactions([]);
                setOpportunities([]);
                setDocuments([]);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) loadIdentity();
    }, [session?.user?.id]);

    useEffect(() => {
        if (!household?.id) return;

        loadData();

        const channel = supabase
            .channel(`household-${household.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${household.id}` },
                loadData
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "appointments", filter: `household_id=eq.${household.id}` },
                loadData
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "transactions", filter: `household_id=eq.${household.id}` },
                (payload) => {
                    loadData();
                    if (payload.eventType === "INSERT" && payload.new?.kind === "income") {
                        showToast("New income is available in your plan.");
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "income_opportunities", filter: `household_id=eq.${household.id}` },
                loadData
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "documents", filter: `household_id=eq.${household.id}` },
                loadData
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "agent_proposals", filter: `household_id=eq.${household.id}` },
                (payload) => {
                    setProposalRefreshKey((value) => value + 1);
                    if (payload.eventType === "INSERT" && payload.new?.status === "pending") {
                        showToast("A new suggested next step is ready for your review.");
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [household?.id]);

    async function loadIdentity() {
        setLoading(true);
        setError("");

        const [{ data: profileData, error: profileError }, membershipResult] =
            await Promise.all([
                supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", session.user.id)
                    .maybeSingle(),
                supabase
                    .from("household_members")
                    .select("household_id, role, households(*)")
                    .eq("user_id", session.user.id)
                    .order("joined_at", { ascending: true })
                    .limit(1),
            ]);

        if (profileError || membershipResult.error) {
            setError(
                profileError?.message ||
                membershipResult.error?.message ||
                "Could not load account."
            );
        }

        setProfile(profileData);
        const membership = Array.isArray(membershipResult.data)
            ? membershipResult.data[0]
            : membershipResult.data;

        setHousehold(membership?.households || null);
        setLoading(false);
    }

    async function loadData() {
        if (!household?.id) return;

        setRefreshing(true);

        const [
            taskResult,
            appointmentResult,
            transactionResult,
            opportunityResult,
            documentResult,
        ] = await Promise.all([
            supabase
                .from("tasks")
                .select("*")
                .eq("household_id", household.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("appointments")
                .select("*")
                .eq("household_id", household.id)
                .order("starts_at", { ascending: true }),
            supabase
                .from("transactions")
                .select("*")
                .eq("household_id", household.id)
                .order("transaction_date", { ascending: false }),
            supabase
                .from("income_opportunities")
                .select("*")
                .eq("household_id", household.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("documents")
                .select("*")
                .eq("household_id", household.id)
                .order("created_at", { ascending: false }),
        ]);

        const firstError = [
            taskResult.error,
            appointmentResult.error,
            transactionResult.error,
            opportunityResult.error,
            documentResult.error,
        ].find(Boolean);

        if (firstError) setError(firstError.message);

        setTasks(
            Array.isArray(taskResult.data) ? taskResult.data : []
        );

        setAppointments(
            Array.isArray(appointmentResult.data)
                ? appointmentResult.data
                : []
        );

        setTransactions(
            Array.isArray(transactionResult.data)
                ? transactionResult.data
                : []
        );

        setOpportunities(
            Array.isArray(opportunityResult.data)
                ? opportunityResult.data
                : []
        );

        setDocuments(
            Array.isArray(documentResult.data)
                ? documentResult.data
                : []
        );
        setRefreshing(false);
    }

    async function insertRecord(table, values) {
        setError("");

        const { error: insertError } = await supabase.from(table).insert({
            ...values,
            household_id: household.id,
            owner_user_id: session.user.id,
        });

        if (insertError) {
            setError(insertError.message);
            return false;
        }

        await loadData();
        return true;
    }

    async function deleteRecord(table, record) {
        if (!window.confirm("Delete this item permanently?")) return;

        const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .eq("id", record.id);

        if (deleteError) {
            setError(deleteError.message);
            return;
        }

        await loadData();
    }

    async function saveTask(form) {
        const success = await insertRecord("tasks", {
            ...form,
            due_date: form.due_date || null,
        });

        if (success) setTaskModal(false);
    }

    async function saveTransaction(form) {
        const success = await insertRecord("transactions", form);
        if (success) setTransactionModal(false);
    }

    async function saveAppointment(form) {
        const success = await insertRecord("appointments", {
            ...form,
            starts_at: new Date(form.starts_at).toISOString(),
        });

        if (success) setAppointmentModal(false);
    }

    async function saveOpportunity(form) {
        const success = await insertRecord("income_opportunities", form);
        if (success) setOpportunityModal(false);
    }

    async function toggleTask(task) {
        const { error: updateError } = await supabase
            .from("tasks")
            .update({
                completed: !task.completed,
                completed_at: !task.completed ? new Date().toISOString() : null,
            })
            .eq("id", task.id);

        if (updateError) setError(updateError.message);
        else loadData();
    }

    async function seedTasks() {
        const rows = starterTasks.map((task) => ({
            ...task,
            household_id: household.id,
            owner_user_id: session.user.id,
            visibility: "shared",
        }));

        const { error: seedError } = await supabase.from("tasks").insert(rows);

        if (seedError) setError(seedError.message);
        else loadData();
    }

    async function uploadDocument(file, visibility) {
        setError("");

        if (file.size > 10 * 1024 * 1024) {
            setError("Files must be 10 MB or smaller.");
            return;
        }

        setUploading(true);

        const path = `${household.id}/${session.user.id}/${crypto.randomUUID()}-${safeFileName(
            file.name
        )}`;

        const { error: storageError } = await supabase.storage
            .from("vault")
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "application/octet-stream",
            });

        if (storageError) {
            setError(storageError.message);
            setUploading(false);
            return;
        }

        const { error: metadataError } = await supabase.from("documents").insert({
            household_id: household.id,
            owner_user_id: session.user.id,
            visibility,
            file_name: file.name,
            storage_path: path,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
        });

        if (metadataError) {
            await supabase.storage.from("vault").remove([path]);
            setError(metadataError.message);
        }

        setUploading(false);
        await loadData();
    }

    async function downloadDocument(document) {
        const { data, error: signedError } = await supabase.storage
            .from("vault")
            .createSignedUrl(document.storage_path, 60);

        if (signedError) {
            setError(signedError.message);
            return;
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    async function deleteDocument(document) {
        if (!window.confirm("Delete this file permanently?")) return;

        setError("");

        const { error: storageError } = await supabase.storage
            .from("vault")
            .remove([document.storage_path]);

        if (storageError) {
            setError(storageError.message);
            return;
        }

        const { error: metadataError } = await supabase
            .from("documents")
            .delete()
            .eq("id", document.id);

        if (metadataError) {
            setError(
                `The file was removed, but its metadata could not be deleted: ${metadataError.message}`
            );
            return;
        }

        await loadData();
    }

    if (!session) return <AuthScreen />;

    if (loading) {
        return (
            <main className="loading-screen">
                <ThemeScene themeKey={themeKey} reducedMotion={reducedMotion} />
                <Loader2 className="spin" size={34} />
                <span>Opening TwinPath…</span>
            </main>
        );
    }

    if (!household) {
        return <HouseholdSetup onReady={loadIdentity} />;
    }

    return (
        <div
            className={`app-shell ${privateMode ? "private-display" : ""}`}
            style={{
                "--accent": themes[themeKey]?.accent,
                "--accent-2": themes[themeKey]?.accent2,
            }}
        >
            <ThemeScene
                themeKey={themeKey}
                reducedMotion={reducedMotion}
                privateMode={privateMode}
            />

            <div className="app-layer">
                <NetworkStatus />
                <AppHeader
                    household={household}
                    privateMode={privateMode}
                    setPrivateMode={setPrivateMode}
                    setSettingsOpen={setSettingsOpen}
                />

                {error && (
                    <div className="global-error">
                        <span>{error}</span>
                        <button onClick={() => setError("")}>
                            <X size={17} />
                        </button>
                    </div>
                )}

                {toast ? <div className="app-toast" role="status">{toast}</div> : null}

                {refreshing && (
                    <div className="sync-indicator">
                        <RefreshCw size={13} className="spin" />
                        Syncing
                    </div>
                )}

                <main className="content">
                    <AnimatedPage key={tab} reducedMotion={reducedMotion}>
                    {tab === "home" && (
                        <TodayTab
                            householdId={household.id}
                            tasks={tasks}
                            appointments={appointments}
                            balance={balance}
                            privateMode={privateMode}
                            reducedMotion={reducedMotion}
                            setTaskModal={setTaskModal}
                            toggleTask={toggleTask}
                            proposalCount={proposalCount}
                            proposalRefreshKey={proposalRefreshKey}
                            onProposalCount={onProposalCount}
                            onFlagsChanged={refreshFeatureFlags}
                            onToast={showToast}
                        />
                    )}

                    {tab === "money" && (
                        <MoneyTab
                            householdId={household.id}
                            currentUserId={session.user.id}
                            transactions={transactions}
                            opportunities={opportunities}
                            privateMode={privateMode}
                            setTransactionModal={setTransactionModal}
                            setOpportunityModal={setOpportunityModal}
                            deleteTransaction={(item) =>
                                deleteRecord("transactions", item)
                            }
                            deleteOpportunity={(item) =>
                                deleteRecord("income_opportunities", item)
                            }
                            onImported={loadData}
                            onToast={showToast}
                        />
                    )}

                    {tab === "family" && (
                        <Suspense
                            fallback={
                                <FeatureLoader label="Opening Family Hub…" />
                            }
                        >
                            <div className="page-stack">
                                <FamilyTab
                                    appointments={appointments}
                                    householdId={household.id}
                                    currentUserId={session.user.id}
                                    privateMode={privateMode}
                                    setAppointmentModal={
                                        setAppointmentModal
                                    }
                                    deleteAppointment={(item) =>
                                        deleteRecord(
                                            "appointments",
                                            item
                                        )
                                    }
                                />

                                <FamilyWorkspace
                                    appointments={appointments}
                                    householdId={household.id}
                                    currentUserId={session.user.id}
                                    privateMode={privateMode}
                                    onAddAppointment={(
                                        selectedDate
                                    ) => {
                                        if (selectedDate) {
                                            setAppointmentDraftDate(
                                                selectedDate
                                            );
                                        }

                                        setAppointmentModal(true);
                                    }}
                                    onDeleteAppointment={(item) =>
                                        deleteRecord(
                                            "appointments",
                                            item
                                        )
                                    }
                                />
                            </div>
                        </Suspense>
                    )}

                    {tab === "grow" && (
                        <Suspense
                            fallback={
                                <FeatureLoader label="Opening Growth Center…" />
                            }
                        >
                            <GrowWorkspace
                                householdId={household.id}
                                currentUserId={session.user.id}
                                transactions={transactions}
                                privateMode={privateMode}
                                reducedMotion={reducedMotion}
                                onLogTransaction={() => setTransactionModal(true)}
                                onAddOpportunity={(route) => {
                                    setOpportunityDraft(route || null);
                                    setOpportunityModal(true);
                                }}
                                onImported={loadData}
                            />
                        </Suspense>
                    )}

                    </AnimatedPage>
                </main>

                <nav className="bottom-nav" aria-label="Main navigation">
                    {tabs.map((item) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.id}
                                className={(item.id === "settings" ? settingsOpen : tab === item.id) ? "active" : ""}
                                onClick={() => {
                                    if (item.id === "settings") setSettingsOpen(true);
                                    else setTab(item.id);
                                }}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                                {item.id === "home" && proposalCount > 0 ? (
                                    <b className="nav-badge" aria-label={`${proposalCount} pending proposals`}>{proposalCount}</b>
                                ) : null}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {taskModal && (
                <TaskModal
                    onClose={() => setTaskModal(false)}
                    onSave={saveTask}
                />
            )}

            {transactionModal && (
                <TransactionModal
                    onClose={() => setTransactionModal(false)}
                    onSave={saveTransaction}
                />
            )}

            {appointmentModal && (
                <AppointmentModal
                    initialDate={appointmentDraftDate}
                    onClose={() => {
                        setAppointmentModal(false);
                        setAppointmentDraftDate(null);
                    }}
                    onSave={saveAppointment}
                />
            )}

            {opportunityModal && (
                <OpportunityModal
                    initialRoute={opportunityDraft}
                    onClose={() => {
                        setOpportunityModal(false);
                        setOpportunityDraft(null);
                    }}
                    onSave={saveOpportunity}
                />
            )}

            {settingsOpen && (
                <SettingsModal
                    household={household}
                    profile={profile}
                    themeKey={themeKey}
                    setThemeKey={setThemeKey}
                    reducedMotion={reducedMotion}
                    setReducedMotion={setReducedMotion}
                    privateMode={privateMode}
                    showThemeCatalog={isFeatureEnabled("theme_catalog")}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
        </div>
    );
}

