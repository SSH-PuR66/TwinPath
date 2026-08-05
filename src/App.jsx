import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Baby,
  Bell,
  Bot,
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
import {
  isE2EMockAuth,
  mockAppData,
  mockHousehold,
  mockProfile,
  mockSession,
} from "./mockAuth";
import { usePaneOverflow } from "./hooks/usePaneOverflow";
import ThemeScene, { ThemePreview, usePageHidden } from "./ThemeScene";
import ThemeMarketplace from "./ThemeMarketplace";
import { communityThemeCredits, includedThemes, resolveThemeKey, themes } from "./themeCatalog";
import ProposalsPanel from "./ProposalsPanel";
import { useFeatureFlags } from "./useFeatureFlags";
import DepositRouter from "./DepositRouter";
import MoneyActionCenter from "./MoneyActionCenter";
import CsvImportPanel from "./CsvImportPanel";
import IosInstallHint from "./IosInstallHint";
import FinancialSummary from "./FinancialSummary";
import WatchedSourcesPanel from "./WatchedSourcesPanel";
import ProfileVaultPanel from "./ProfileVaultPanel";
import NowPath from "./NowPath";
import Runway from "./Runway";
import DisclosureSection from "./DisclosureSection";
import FlowRunner from "./FlowRunner";

import {
    initialAllocation,
    legalResources,
    starterTasks,
    wealthSteps,
} from "./resources";

import { motion } from "framer-motion";
import NetworkStatus from "./NetworkStatus";
import { AnimatedMoney } from "./AnimatedMoney";
import AnimatedPage from "./AnimatedPage";
import RevenueAllocator from "./RevenueAllocator";
import FeatureLoader from "./FeatureLoader";
import { safeExternalUrl } from "./safeUrl";
import { TWINS_EDD, TWINS_LIKELY_ARRIVAL } from "./twinsDates";

const CalendarView = lazy(() => import("./CalendarView.jsx"));
const FamilyGallery = lazy(() => import("./FamilyGallery.jsx"));
const FamilySavings = lazy(() => import("./FamilySavings.jsx"));
const FamilyWorkspace = lazy(() => import("./FamilyWorkspace.jsx"));
const GrowWorkspace = lazy(() => import("./GrowWorkspace.jsx"));
const FinancialConnectionsPanel = lazy(() => import("./FinancialConnectionsPanel.jsx"));
const RetirementTracker = lazy(() => import("./RetirementTracker.jsx"));
const MoneyFlowMap = lazy(() => import("./MoneyFlowMap.jsx"));

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

// Two dates on purpose - see src/twinsDates.js. The countdown plans against the
// realistic arrival (median twin gestation is 35.2 weeks); anything that says
// the words "due date" to Sergio has to show the EDD the practice wrote down.
const twinsArrivalTarget = new Date(`${TWINS_LIKELY_ARRIVAL}T12:00:00`);
const twinsDueWindow = new Date(`${TWINS_EDD}T12:00:00`);

const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "money", label: "Money", icon: WalletCards },
    { id: "grow", label: "Grow", icon: BriefcaseBusiness },
    { id: "family", label: "Family", icon: Baby },
    { id: "settings", label: "Settings", icon: Settings },
];

function tabFromPathname(pathname = window.location.pathname) {
    const path = String(pathname).toLowerCase();
    return ["money", "grow", "family"].includes(path.slice(1))
        ? path.slice(1)
        : "home";
}

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

function PageIntro({ eyebrow, title, purpose, action = null }) {
    return (
        <header className="page-intro">
            <div>
                <p className="eyebrow">{eyebrow}</p>
                <h2>{title}</h2>
                <p>{purpose}</p>
            </div>
            {action}
        </header>
    );
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

// Where a sign-in link is allowed to land. Local dev keeps its own origin;
// every other origin is pinned to the deployed app so an emailed link can
// never drop someone on a host their phone cannot reach.
const CANONICAL_APP_URL = "https://twinpath.srodriguez46.workers.dev";

function authRedirectUrl() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  return configured || CANONICAL_APP_URL;
}

function AuthScreen() {
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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
          emailRedirectTo: authRedirectUrl(),
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

    setCode("");
    setSent(true);
  }

  // Redirect-free sign-in. The same email carries a short code, so a phone
  // that cannot open the link can still get in by typing the code.
  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: authError } =
      await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });

    setBusy(false);

    if (authError) {
      setError(
        "That code did not work. Codes expire after an hour — use the newest email, or request one more link."
      );
    }
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
              Email me a sign-in link instead
            </button>
          </form>
        ) : sent ? (
          <>
            <div className="success-box">
              <CheckCircle2 />

              <div>
                <strong>Check your email</strong>
                <p>
                  Tap the sign-in link in that email on
                  this device and you are in. If your
                  email also shows a 6-digit code, you
                  can type it below instead.
                </p>
              </div>
            </div>

            <form onSubmit={verifyCode} className="stack">
              <Field
                label="6-digit code (only if the email has one)"
                hint="Not every email includes a code. If yours does not, use the link above."
              >
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value)
                  }
                />
              </Field>

              {error && (
                <div className="error-box">{error}</div>
              )}

              <Button
                type="submit"
                disabled={busy || code.trim().length < 6}
              >
                {busy && (
                  <Loader2 className="spin" size={18} />
                )}

                Sign in with code
              </Button>

              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </form>
          </>
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
            You each get your own account, so your space stays
            yours. Keep your password to yourself — that is what
            keeps the private side private.
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

const MEMBER_TRACKS = ["household", "cyber", "nursing"];

function resolveMemberTrack(profile, user) {
    // profiles.track is the source of truth, so each member keeps their own
    // dashboard on every device. The name check below only covers accounts
    // saved before that column existed.
    const stored = String(profile?.track || "").trim().toLowerCase();
    if (MEMBER_TRACKS.includes(stored)) return stored;
    const identity = `${profile?.display_name || ""} ${profile?.email || user?.email || ""}`.toLowerCase();
    if (identity.includes("brianna")) return "nursing";
    if (identity.includes("sergio")) return "cyber";
    return "household";
}

const memberTrackLabel = (track) => track === "cyber" ? "Cyber" : track === "nursing" ? "Nursing" : "Household";

// Each member's own lane. Household steps are shared; the cyber and nursing
// lists are the personal path that only that member sees.
const TRACK_PATHS = {
    nursing: {
        eyebrow: "NURSING PATH",
        title: "Brianna's next moves",
        blurb: "School, licensure, and the support programs that pay for both — in the order that matters before late December.",
        steps: [
            {
                title: "Call WIC while you are still pregnant",
                detail: "Pregnant applicants qualify now — there is no reason to wait for the birth. Food benefits plus nutrition support for you and, once they arrive, both twins.",
                link: { label: "New York WIC", url: "https://www.health.ny.gov/prevention/nutrition/wic/" },
            },
            {
                title: "Confirm prenatal coverage before the next appointment",
                detail: "Verify Medicaid or CHIP is active. If any hospital bill shows up, ask for the financial-assistance application before you pay a dollar of it.",
            },
            {
                title: "Pin down exactly where the DCC degree leaves you",
                detail: "Two very different paths start from a finished degree. If it is the nursing AAS, the next gate is the NCLEX-RN and a license. If it is pre-nursing or general studies, the next gate is a seat in an RN program. Write down which one it is — every step below depends on the answer.",
            },
            {
                title: "If you are NCLEX-eligible, pick the test window now",
                detail: "Register early enough to choose a date that is clearly before late December or clearly after the twins are settled. New-graduate hospital residencies hire months ahead and will often hold a start date for you.",
                link: { label: "NY nursing licensure", url: "https://www.op.nysed.gov/professions/registered-professional-nursing" },
            },
            {
                title: "Price out the CNA bridge",
                detail: "A CNA certificate is the short paid step between now and the RN license. Clinical hours also count as real experience on a nursing school record.",
            },
            {
                title: "Line up the Nurse Corps Scholarship window",
                detail: "Tuition, fees, and a monthly stipend in exchange for serving at a shortage facility after licensure. The cycle opens once a year, so check the current dates and get transcripts and the essay ready early.",
                link: { label: "HRSA Nurse Corps", url: "https://www.hrsa.gov/loan-scholarships/nurse-corps/scholarship" },
            },
            {
                title: "Get child care assistance in motion early",
                detail: "New York helps student-parents with child care costs, and the waitlists are the slow part. Starting the paperwork now is worth more than starting it perfectly later.",
            },
        ],
    },
    cyber: {
        eyebrow: "CYBER PATH",
        title: "Sergio's next moves",
        blurb: "Iona deadlines first, then the certifications and campus income that compound.",
        steps: [
            {
                title: "Call Student Financial Services before August 3",
                detail: "914-633-2497. The appeal window closes and nothing else on this list matters as much.",
            },
            {
                title: "Finish required trainings by August 20",
                detail: "These block registration holds. Short tasks, hard deadline.",
            },
            {
                title: "Send the transcript by August 24",
                detail: "Late transcripts delay credit evaluation, which delays aid.",
            },
            {
                title: "Keep TAP and FAFSA current",
                detail: "State aid renews on its own clock. A missed renewal is the most common way a semester gets expensive.",
                link: { label: "HESC financial aid", url: "https://www.hesc.ny.gov/" },
            },
            {
                title: "Chase funded certifications, not paid ones",
                detail: "Security+ and similar exams are often covered by student vouchers, department funds, or workforce grants. Ask the department before paying retail.",
            },
            {
                title: "Put work-study on campus, in IT",
                detail: "Help desk hours pay like work-study and read like experience. Same paycheck, better resume.",
            },
        ],
    },
};

function TrackPathCard({ memberTrack }) {
    const path = TRACK_PATHS[memberTrack];
    if (!path) return null;
    return (
        <Card>
            <div className="section-title">
                <div>
                    <span className="eyebrow">{path.eyebrow}</span>
                    <h3>{path.title}</h3>
                </div>
                <Pill tone="blue">{path.steps.length} steps</Pill>
            </div>
            <p className="muted">{path.blurb}</p>
            <ol className="track-path-list">
                {path.steps.map((step) => (
                    <li key={step.title}>
                        <strong>{step.title}</strong>
                        <small>{step.detail}</small>
                        {step.link ? (
                            <a href={step.link.url} target="_blank" rel="noreferrer noopener">
                                {step.link.label}
                            </a>
                        ) : null}
                    </li>
                ))}
            </ol>
        </Card>
    );
}

function HomeMoneySnapshot({ householdId, privateMode, proposalCount }) {
    const [overview, setOverview] = useState(null);
    const [networthSnapshots, setNetworthSnapshots] = useState([]);
    const [status, setStatus] = useState("loading");
    const controlPlaneUrl = isE2EMockAuth ? "" : (safeExternalUrl(String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim(), {
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
                const controller = new AbortController();
                const timeout = window.setTimeout(() => controller.abort(), 8_000);
                let response;
                try { response = await fetch(`${controlPlaneUrl}/v1/financial/summary`, {
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                        "X-Household-Id": String(householdId),
                    },
                }); } finally { window.clearTimeout(timeout); }
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

    useEffect(() => {
        if (!householdId) return undefined;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);
        supabase.from("networth_snapshots")
            .select("as_of,cash,investments,other_assets,liabilities,net")
            .eq("household_id", householdId)
            .order("as_of", { ascending: true })
            .limit(90)
            .abortSignal(controller.signal)
            .then(({ data, error }) => { if (!error) setNetworthSnapshots(Array.isArray(data) ? data : []); })
            .catch(() => {})
            .finally(() => window.clearTimeout(timeout));
        return () => { controller.abort(); window.clearTimeout(timeout); };
    }, [householdId]);

    const amount = (value) => privateMode ? "••••" : moneyFormatter.format(Number(value) || 0);
    // A 90-day net-flow figure reads like a balance at a glance, which is how
    // "+$57" got mistaken for the money actually sitting in Chime. When the
    // bank reports a real balance, that becomes the headline and the flow
    // number moves down into the details where it belongs.
    const cashTotal = overview?.balances?.cash_total ?? null;
    const balanceAsOf = overview?.balances?.as_of ? new Date(overview.balances.as_of) : null;
    const balanceStale = balanceAsOf
        ? Date.now() - balanceAsOf.getTime() > 24 * 60 * 60 * 1000
        : false;
    const income = Number(overview?.income) || 0;
    const expense = Number(overview?.expense) || 0;
    const net = Number(overview?.net) || 0;
    const latestMonth = Array.isArray(overview?.by_month) ? overview.by_month.at(-1) : null;
    const latestNetworth = networthSnapshots.at(-1);
    const sparkValues = networthSnapshots.map((snapshot) => Number(snapshot.net) || 0);
    const sparkMin = Math.min(...sparkValues, 0);
    const sparkMax = Math.max(...sparkValues, 1);
    const sparkPoints = sparkValues.map((value, index) => `${sparkValues.length === 1 ? 50 : (index / (sparkValues.length - 1)) * 100},${36 - ((value - sparkMin) / (sparkMax - sparkMin || 1)) * 32}`).join(" ");

    return (
        <Card className="home-money-hero">
            <div className="section-title">
                <div>
                    <span className="eyebrow">LIVE MONEY SNAPSHOT</span>
                    <h3>What is safe to plan with</h3>
                </div>
                <WalletCards size={22} />
            </div>
            {status === "ready" ? (
                <div className="home-money-layout">
                    {cashTotal === null ? (
                        <div className="home-money-primary">
                            <span>90-day net</span>
                            <strong className={net >= 0 ? "money-positive" : "money-negative"}>{net >= 0 ? "+" : "−"}{amount(Math.abs(net))}</strong>
                            <small>Income minus recorded spending. It is a planning signal, not a bank balance.</small>
                        </div>
                    ) : (
                        <div className="home-money-primary">
                            <span>In your connected accounts</span>
                            <strong className="money-positive">{amount(cashTotal)}</strong>
                            <small>
                                {balanceAsOf ? `Balance your bank reported, last refreshed ${balanceAsOf.toLocaleString()}.` : "Balance your bank reported."}
                                {balanceStale ? " A deposit made since then may not have synced yet — refresh in Money." : ""}
                            </small>
                        </div>
                    )}
                    <div className="home-money-details">
                        {cashTotal === null ? null : (
                            <div>
                                <span>90-day net</span>
                                <strong className={net >= 0 ? "money-positive" : "money-negative"}>{net >= 0 ? "+" : "−"}{amount(Math.abs(net))}</strong>
                                <small>Income minus spending — a flow signal, not a balance.</small>
                            </div>
                        )}
                        <div><span>Income tracked</span><strong>{amount(income)}</strong></div>
                        <div><span>Spent</span><strong>{amount(expense)}</strong></div>
                        <div><span>Last update</span><strong>{overview?.transaction_count || 0} items</strong><small>{latestMonth ? `${latestMonth.month} net: ${amount(latestMonth.net)}` : "Connect or import to begin"}</small></div>
                    </div>
                </div>
            ) : (
                <p className="muted">
                    {status === "loading" ? "Loading your read-only account snapshot…" : status === "offline"
                        ? "Offline — live account freshness is unavailable. Open Money when reconnected."
                        : "No financial summary is available yet. Connect an institution or import a CSV in Money."}
                </p>
            )}
            <div className="networth-strip">
                <div><span>NET WORTH</span><strong>{latestNetworth ? amount(latestNetworth.net) : "—"}</strong><small>{latestNetworth ? `As of ${new Date(`${latestNetworth.as_of}T00:00:00`).toLocaleDateString()}` : "No balance-sheet snapshot yet"}</small></div>
                {sparkValues.length ? <svg viewBox="0 0 100 40" role="img" aria-label="Net worth over time"><polyline points={sparkPoints} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : null}
            </div>
            {proposalCount > 0 ? <small>{proposalCount} proposal{proposalCount === 1 ? "" : "s"} awaiting your review below.</small> : null}
        </Card>
    );
}

function AutomationStatus({ proposalCount }) {
    const reviewLabel = proposalCount ? `${proposalCount} decision${proposalCount === 1 ? "" : "s"} waiting` : "No decisions waiting";
    return (
        <Card className="automation-status">
            <div className="section-title">
                <div><span className="eyebrow">AUTOMATION, WITH PERMISSION</span><h3>What TwinPath is watching</h3></div>
                <Bell size={21} />
            </div>
            <div className="automation-list">
                <div><Bot size={17} /><span><strong>New deposits</strong><small>When live data is connected, a deposit can become a suggested plan for you to approve.</small></span><b>{reviewLabel}</b></div>
                <div><RefreshCw size={17} /><span><strong>Transactions</strong><small>Read-only updates keep your money picture current—no transfers, purchases, or account changes.</small></span></div>
                <div><ShieldCheck size={17} /><span><strong>Every dollar stays yours</strong><small>TwinPath can calculate, remind, and prepare. You make every final move.</small></span></div>
            </div>
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
    openTaskDetail,
    proposalCount,
    proposalRefreshKey,
    onProposalCount,
    onFlagsChanged,
    onToast,
    memberTrack,
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
    const daysUntilTwins = Math.max(0, Math.ceil((twinsArrivalTarget.getTime() - Date.now()) / 86_400_000));

    const nextDatedTask =
        incomplete
            .filter((task) => task.due_date)
            .map((task) => ({
                label: task.title,
                at: new Date(`${task.due_date}T12:00:00`).getTime(),
            }))
            .filter((item) => Number.isFinite(item.at))
            .sort((a, b) => a.at - b.at)[0] || null;

    const nextObligation =
        [
            nextAppointment && Number.isFinite(new Date(nextAppointment.starts_at).getTime())
                ? {
                    label: nextAppointment.title,
                    at: new Date(nextAppointment.starts_at).getTime(),
                }
                : null,
            nextDatedTask,
        ]
            .filter(Boolean)
            .sort((a, b) => a.at - b.at)[0] || null;

    return (
        <div className="page-stack">
            <PageIntro
                eyebrow="HOME"
                title="Today"
                purpose="See the next useful step for your household."
                action={<Button icon={Plus} onClick={() => setTaskModal(true)}>Add task</Button>}
            />
            <FlowRunner householdId={householdId} />
            <section className="hero">
                <p className="eyebrow">{memberTrack === "cyber" ? "CYBER + FAMILY RUNWAY" : memberTrack === "nursing" ? "NURSING + FAMILY RUNWAY" : "FAMILY RUNWAY · LATE DECEMBER"}</p>
                {memberTrack === "cyber" || memberTrack === "nursing" ? (
                    <h2>{memberTrack === "cyber" ? `${daysUntilTwins} days to twin time — keep Iona deadlines visible.` : "Nurse Corps, CNA, and child-care steps—one calm checklist."}</h2>
                ) : (
                    <Runway />
                )}
                <p>
                    {memberTrack === "cyber" ? "Household foundations first, then cyber coursework, Iona opportunities, and deadlines that compound your options." : memberTrack === "nursing" ? "Household support first, then licensure timing, the CNA option, and the programs that help pay for nursing school." : "Keep the next move small and useful: care, housing, food, rides, and reliable income first. You two are building calm, one decision at a time."}
                </p>

                {nextObligation ? (
                    <p className="hero-next">
                        <CalendarDays size={15} aria-hidden="true" />
                        <span>{`Next: ${nextObligation.label}`}</span>
                        <strong>{dateFormatter.format(new Date(nextObligation.at))}</strong>
                    </p>
                ) : null}

                <Button icon={Plus} onClick={() => setTaskModal(true)}>
                    Add task
                </Button>
            </section>

            <NowPath householdId={householdId} tasks={tasks} appointments={appointments} onOpenTask={openTaskDetail} />

            <DisclosureSection
                id="home-today"
                title="Today at a glance"
                hint="Open tasks, the next appointment, the tracked balance"
            >
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
                                    onClick={() => openTaskDetail(task)}
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
            </DisclosureSection>

            <DisclosureSection
                id="home-track"
                title="Your track and the money snapshot"
                hint="Where this household stands right now"
                collapseOnPhone
            >
                <TrackPathCard memberTrack={memberTrack} />

                <HomeMoneySnapshot
                    householdId={householdId}
                    privateMode={privateMode}
                    proposalCount={proposalCount}
                />
            </DisclosureSection>

            <DisclosureSection
                id="home-automation"
                title="Approvals, automation and deposit routing"
                hint="What the app is waiting on you to decide"
                collapseOnPhone
            >
                <div className="home-control-grid">
                    <ProposalsPanel
                        householdId={householdId}
                        onPendingCount={onProposalCount}
                        onFlagsChanged={onFlagsChanged}
                        refreshKey={proposalRefreshKey}
                        onToast={onToast}
                        memberTrack={memberTrack}
                    />
                    <AutomationStatus proposalCount={proposalCount} />
                </div>

                <DepositRouter householdId={householdId} onToast={onToast} />
            </DisclosureSection>

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
    memberTrack,
    onImported,
    onToast,
    transactions,
    opportunities,
    privateMode,
    setTransactionModal,
    setOpportunityModal,
    deleteTransaction,
    deleteOpportunity,
    sharedImport,
    onSharedImportHandled,
    twinsDueDate,
}) {
    const [showAllTransactions, setShowAllTransactions] = useState(false);
    const paneRootRef = useRef(null);
    usePaneOverflow(paneRootRef);
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
            <PageIntro
                eyebrow="MONEY"
                title="Money"
                purpose="See what is logged, then take one next money step."
                action={<Button icon={Plus} onClick={() => setTransactionModal(true)}>Transaction</Button>}
            />
        <div ref={paneRootRef} className="tp-shell money-density">
            <section className="tp-pane money-density__summary">
                <header className="tp-pane__head">
                    <span>Financial pulse</span>
                    <em>Read the last 90 days first</em>
                </header>
                <div className="tp-pane__body">
                    <div className="money-density__pulse">
                        <p className="eyebrow">MONEY</p>
                        <h2>{shownMoney(balance)} available</h2>
                        <p>{shownMoney(income)} in and {shownMoney(expenses)} out across logged transactions.</p>
                        <div className="summary-grid tp-strip">
                            <SummaryCard icon={CircleDollarSign} label="Income" value={shownMoney(income)} />
                            <SummaryCard icon={WalletCards} label="Expenses" value={shownMoney(expenses)} />
                            <SummaryCard icon={ShieldCheck} label="Balance" value={shownMoney(balance)} />
                        </div>
                    </div>
                </div>
            </section>
            <section className="tp-pane money-density__workspace">
                <header className="tp-pane__head">
                    <span>Money workspace</span>
                    <em>Scroll this pane, not the page</em>
                </header>
                <div className="tp-pane__body">
                    <div className="page-stack">
            <DisclosureSection
                id="money-flow"
                title="Where the money went"
                hint="The last 90 days, drawn as a flow"
                collapseOnPhone
            >
                <Suspense fallback={<FeatureLoader label="Drawing the money flow" />}>
                    <MoneyFlowMap householdId={householdId} privateMode={privateMode} />
                </Suspense>
            </DisclosureSection>

            <DisclosureSection
                id="money-accounts"
                title="Accounts, transactions and the starting plan"
                hint="Connect a bank, log money, read every line"
                collapseOnPhone
            >
                <MoneyActionCenter
                    householdId={householdId}
                    currentUserId={currentUserId}
                    onImported={onImported}
                    onToast={onToast}
                    sharedImport={sharedImport}
                    onSharedImportHandled={onSharedImportHandled}
                    memberTrack={memberTrack}
                />
                <Suspense fallback={<FeatureLoader label="Opening live money overview…" />}>
                    <FinancialConnectionsPanel
                        householdId={householdId}
                        currentUserId={currentUserId}
                        privateMode={privateMode}
                    />
                </Suspense>
                <Suspense fallback={<FeatureLoader label="Opening retirement tracker…" />}>
                    <RetirementTracker householdId={householdId} privateMode={privateMode} dueDate={twinsDueDate} />
                </Suspense>
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
                            {(showAllTransactions ? transactions : transactions.slice(0, 8)).map((item) => (
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
                    {transactions.length > 8 && !showAllTransactions ? <Button variant="secondary" onClick={() => setShowAllTransactions(true)}>Show all {transactions.length}</Button> : null}
                </Card>
            </DisclosureSection>

            <DisclosureSection
                id="money-routes"
                title="Income routes and the road up"
                hint="Where the next dollar could come from"
                collapseOnPhone
            >
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
            </DisclosureSection>
                    </div>
                </div>
            </section>
        </div>
        </div>
    );
}

function GrowTab({
    householdId,
    currentUserId,
    transactions,
    opportunities,
    privateMode,
    reducedMotion,
    setTransactionModal,
    setOpportunityModal,
    setOpportunityDraft,
    onImported,
}) {
    const paneRootRef = useRef(null);
    usePaneOverflow(paneRootRef);

    return (
        <div className="page-stack">
            <PageIntro
                eyebrow="GROW"
                title="Grow"
                purpose="Keep one income route moving at a time."
                action={<Button icon={Plus} onClick={() => setOpportunityModal(true)}>Add route</Button>}
            />
            <FlowRunner householdId={householdId} flowIds={["aid-moving"]} compact />
        <div ref={paneRootRef} className="tp-shell grow-density">
            <section className="tp-pane grow-density__hero">
                <header className="tp-pane__head">
                    <span>Current goal</span>
                    <em>One next move at a time</em>
                </header>
                <div className="tp-pane__body">
                    <GrowHero
                        opportunities={opportunities}
                        privateMode={privateMode}
                        onAddRoute={() => setOpportunityModal(true)}
                    />
                </div>
            </section>

            <section className="tp-pane grow-density__workspace">
                <header className="tp-pane__head">
                    <span>Growth workspace</span>
                    <em>Scroll this pane, not the page</em>
                </header>
                <div className="tp-pane__body">
                    <Suspense fallback={<FeatureLoader label="Opening Growth Center..." />}>
                        <GrowWorkspace
                            householdId={householdId}
                            currentUserId={currentUserId}
                            transactions={transactions}
                            privateMode={privateMode}
                            reducedMotion={reducedMotion}
                            onLogTransaction={() => setTransactionModal(true)}
                            onAddOpportunity={(route) => {
                                setOpportunityDraft(route || null);
                                setOpportunityModal(true);
                            }}
                            onImported={onImported}
                        />
                    </Suspense>
                </div>
            </section>
        </div>
        </div>
    );
}

const growStages = ["Idea", "Applied", "Interviewing", "Active", "Paid"];

function GrowHero({ opportunities, privateMode, onAddRoute }) {
    const routes = Array.isArray(opportunities) ? opportunities : [];

    const lead =
        routes
            .map((item) => ({ item, stage: growStages.indexOf(item.status) }))
            .filter((entry) => entry.stage >= 0)
            .sort(
                (a, b) =>
                    b.stage - a.stage ||
                    Number(b.item.estimated_monthly || 0) -
                        Number(a.item.estimated_monthly || 0)
            )[0] || null;

    const step = lead ? lead.stage + 1 : 0;
    const percent = lead ? Math.round((step / growStages.length) * 100) : 0;
    const monthly = lead ? Number(lead.item.estimated_monthly || 0) : 0;

    return (
        <section className="hero">
            <p className="eyebrow">CURRENT GOAL</p>

            {lead ? (
                <>
                    <h2>{lead.item.title}</h2>
                    <p>
                        {lead.item.organization || "Independent route"}
                        {monthly > 0 && !privateMode
                            ? `, worth about ${moneyFormatter.format(monthly)} a month once it pays.`
                            : "."}
                    </p>

                    <div className="grow-hero-progress">
                        <div
                            className="grow-hero-track"
                            role="img"
                            aria-label={`Stage ${step} of ${growStages.length}: ${lead.item.status}`}
                        >
                            <span
                                className="grow-hero-fill"
                                style={{ width: `${percent}%` }}
                            />
                        </div>

                        <strong className="grow-hero-stage">{`${lead.item.status}, ${step} of ${growStages.length}`}</strong>
                    </div>
                </>
            ) : (
                <>
                    <h2>No income route is in motion yet.</h2>
                    <p>
                        Add one route and this line tracks it from idea to first payment.
                    </p>
                </>
            )}

            <Button icon={Plus} onClick={onAddRoute}>
                Add route
            </Button>
        </section>
    );
}

function FamilyTab({
    householdId,
    appointments,
    setAppointmentModal,
}) {
    const safeAppointments = Array.isArray(appointments)
        ? appointments
        : [];

    const nextShared =
        safeAppointments
            .map((item) => ({ item, at: new Date(item.starts_at).getTime() }))
            .filter((entry) => Number.isFinite(entry.at))
            .filter((entry) => entry.at >= Date.now() - 3_600_000)
            .sort((a, b) => a.at - b.at)[0] || null;

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
            <PageIntro
                eyebrow="FAMILY"
                title="Family"
                purpose="Keep the next shared care or preparation step visible."
                action={<Button icon={CalendarDays} onClick={() => setAppointmentModal(true)}>Appointment</Button>}
            />
            <FlowRunner householdId={householdId} flowIds={["twins-setup"]} compact />
            <section className="hero">
                <p className="eyebrow">NEXT TOGETHER</p>

                {nextShared ? (
                    <>
                        <h2>{nextShared.item.title}</h2>
                        <p className="hero-next">
                            <CalendarDays size={15} aria-hidden="true" />
                            <span>{nextShared.item.location || "Shared calendar"}</span>
                            <strong>{dateTimeFormatter.format(new Date(nextShared.at))}</strong>
                        </p>
                    </>
                ) : (
                    <>
                        <h2>Nothing is on the shared calendar yet.</h2>
                        <p>Add the next appointment and it will lead this tab.</p>
                    </>
                )}

                <Button icon={CalendarDays} onClick={() => setAppointmentModal(true)}>
                    Appointment
                </Button>
            </section>

            <DisclosureSection
                id="family-calendar"
                title="Safety notes and the calendar count"
                hint="What this app is not, plus every scheduled item"
            >
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
                            <h3>Calendar</h3>
                            <p>Review the day schedule below; appointment details stay there instead of repeating in a long list.</p>
                        </div>
                        <Pill tone="blue">{safeAppointments.length}</Pill>
                    </div>
                    <p className="family-calendar-summary">{safeAppointments.length ? `${safeAppointments.length} scheduled ${safeAppointments.length === 1 ? "item is" : "items are"} available in the calendar day sheets.` : "No appointments recorded."}</p>
                </Card>
            </DisclosureSection>

            <DisclosureSection
                id="family-checklists"
                title="Preparation checklists"
                hint="Healthcare, transportation, discharge and safe essentials"
                collapseOnPhone
            >
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
            </DisclosureSection>
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

function TaskDetailModal({ task, onClose, onToggle }) {
    return (
        <Modal title={task.title} onClose={onClose}>
            <div className="task-detail stack">
                <p>{task.category || "General"} · {task.priority || "medium"} priority</p>
                {task.due_date ? <p>Due {dateFormatter.format(new Date(`${task.due_date}T12:00:00`))}</p> : <p>No due date</p>}
                <p>{task.visibility === "private" ? "Only me" : "Shared with your household"}</p>
                <Button type="button" onClick={() => { onToggle(task); onClose(); }}>
                    <Check size={17} />
                    {task.completed ? "Mark open" : "Mark complete"}
                </Button>
            </div>
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
    memberTrack,
    setMemberTrack,
    showThemeCatalog,
    sharedLink,
    onSharedLinkHandled,
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

                <div className="stack">
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
                        <strong>{Object.keys(includedThemes).length} live themes, included free</strong>
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

                    <section className="theme-credits" aria-labelledby="theme-credits-title">
                        <span className="eyebrow">ABOUT THE PALETTES</span>
                        <h3 id="theme-credits-title">Community palette credits</h3>
                        <p>Catppuccin, Nord, Rosé Pine, Tokyo Night, and Everforest remain the work of their respective communities.</p>
                        <div>{communityThemeCredits.map((credit) => <a key={credit.name} href={safeExternalUrl(credit.url) || undefined} target="_blank" rel="noopener noreferrer">{credit.name}<ExternalLink size={13} /></a>)}</div>
                    </section>

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

                <WatchedSourcesPanel
                    householdId={household.id}
                    sharedLink={sharedLink}
                    onSharedLinkHandled={onSharedLinkHandled}
                />

                <ProfileVaultPanel householdId={household.id} />

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

                <label className="field">
                    <span>View focus</span>
                    <select value={memberTrack} onChange={(event) => setMemberTrack(event.target.value)}>
                        <option value="household">Household</option>
                        <option value="cyber">Cyber</option>
                        <option value="nursing">Nursing</option>
                    </select>
                    <small className="muted">Saved to your account as {memberTrackLabel(resolveMemberTrack(profile))} — switching changes only what you see, never shared records.</small>
                </label>

                <Button variant="danger" icon={LogOut} onClick={signOut}>
                    Sign out
                </Button>
            </div>
        </Modal>
    );
}

export default function App() {
    const [session, setSession] = useState(() => isE2EMockAuth ? mockSession : null);
    const [profile, setProfile] = useState(() => isE2EMockAuth ? mockProfile : null);
    const [household, setHousehold] = useState(() => isE2EMockAuth ? mockHousehold : null);
    const [loading, setLoading] = useState(!isE2EMockAuth);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState(() => tabFromPathname());
    const [error, setError] = useState("");

    const [tasks, setTasks] = useState(() => isE2EMockAuth ? mockAppData.tasks : []);
    const [appointments, setAppointments] = useState(() => isE2EMockAuth ? mockAppData.appointments : []);
    const [transactions, setTransactions] = useState(() => isE2EMockAuth ? mockAppData.transactions : []);
    const [opportunities, setOpportunities] = useState(() => isE2EMockAuth ? mockAppData.opportunities : []);
    const [documents, setDocuments] = useState(() => isE2EMockAuth ? mockAppData.documents : []);

    const [taskModal, setTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [transactionModal, setTransactionModal] = useState(false);
    const [appointmentModal, setAppointmentModal] = useState(false);
    const [appointmentDraftDate, setAppointmentDraftDate] = useState(null);
    const [opportunityModal, setOpportunityModal] = useState(false);
    const [opportunityDraft, setOpportunityDraft] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(() => window.location.pathname.toLowerCase() === "/settings");
    const [uploading, setUploading] = useState(false);
    const [privateMode, setPrivateMode] = useState(false);
    const [proposalCount, setProposalCount] = useState(0);
    const [proposalRefreshKey, setProposalRefreshKey] = useState(0);
    const [toast, setToast] = useState("");
    const [sharedImport, setSharedImport] = useState(null);
    const [memberTrack, setMemberTrack] = useState("household");
    const { isEnabled: isFeatureEnabled, refresh: refreshFeatureFlags } = useFeatureFlags(household?.id);
    const onProposalCount = useCallback((count) => setProposalCount(Number(count) || 0), []);
    const refreshPendingProposalCount = useCallback(async () => {
        if (!household?.id) return;
        const { count, error: countError } = await supabase
            .from("agent_proposals")
            .select("id", { count: "exact", head: true })
            .eq("household_id", household.id)
            .eq("status", "pending");
        if (!countError) onProposalCount(count);
    }, [household?.id, onProposalCount]);
    const showToast = useCallback((message) => {
        setToast(message);
        window.setTimeout(() => setToast((current) => current === message ? "" : current), 5000);
    }, []);

    // View focus is a per-member setting, not a per-session toggle, so it is
    // written back to the profile row and follows them to any device.
    const changeMemberTrack = useCallback(async (nextTrack) => {
        const track = MEMBER_TRACKS.includes(nextTrack) ? nextTrack : "household";
        setMemberTrack(track);
        const userId = session?.user?.id;
        if (!userId) return;
        const { data, error: trackError } = await supabase
            .from("profiles")
            .update({ track })
            .eq("id", userId)
            .select()
            .maybeSingle();
        if (trackError) {
            showToast("View focus changed for now, but it could not be saved to your profile.");
            return;
        }
        if (data) setProfile(data);
    }, [session?.user?.id, showToast]);
    const clearSharedLink = useCallback(() => {
        setSharedImport((current) => current?.kind === "link" ? null : current);
    }, []);
    const clearSharedCsv = useCallback(() => {
        setSharedImport((current) => current?.kind === "csv" ? null : current);
        // This is handled by the service worker when present. A failure here
        // is harmless: an old local share is overwritten by the next share.
        fetch("/__twinpath-share/pending", { method: "DELETE" }).catch(() => {});
    }, []);

    useEffect(() => {
        const currentUrl = new URL(window.location.href);
        const shareError = currentUrl.searchParams.get("share-error");
        const sharedId = currentUrl.searchParams.get("shared-import");
        const shared = currentUrl.searchParams.get("shared");
        if (!shareError && !sharedId && !shared) return undefined;

        currentUrl.searchParams.delete("share-error");
        currentUrl.searchParams.delete("shared-import");
        currentUrl.searchParams.delete("shared");
        window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);

        if (shareError) {
            showToast(shareError === "file-too-large" ? "That shared file is too large. Choose a CSV under 512 KB." : "TwinPath could not read that shared item. Paste it into the app instead.");
            return undefined;
        }

        let active = true;
        const sharePath = shared ? "/__twinpath-share/pending" : `/__twinpath-share/${encodeURIComponent(sharedId)}`;
        fetch(sharePath, { cache: "no-store" })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error("Shared item expired.")))
            .then((payload) => {
                if (!active || !payload || !["csv", "link"].includes(payload.kind)) return;
                setSharedImport({ ...payload, id: shared ? "pending" : sharedId });
                if (payload.kind === "csv") {
                    setTab("money");
                    showToast("Shared CSV ready to review before import.");
                } else {
                    setSettingsOpen(true);
                    showToast("Shared link ready to watch. Nothing was opened or purchased.");
                }
            })
            .catch((sharedError) => active && showToast(sharedError.message || "Shared item is no longer available."));

        return () => { active = false; };
    }, [showToast]);

    useEffect(() => {
        if (profile || session?.user) setMemberTrack(resolveMemberTrack(profile, session?.user));
    }, [profile?.id, session?.user?.id]);

    useEffect(() => {
        const overlayOpen =
            taskModal ||
            transactionModal ||
            appointmentModal ||
            opportunityModal ||
            settingsOpen;

        const previousStyles = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
        };
        const scrollY = window.scrollY;

        if (overlayOpen) {
            document.body.style.overflow = "hidden";
            document.body.style.position = "fixed";
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = "100%";
        }

        return () => {
            Object.assign(document.body.style, previousStyles);
            if (overlayOpen) window.scrollTo(0, scrollY);
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

    useEffect(() => {
        const theme = themes[themeKey];
        if (!theme) return;
        document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute("content", theme.background);
    }, [themeKey]);

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return undefined;
        const syncKeyboardInset = () => {
            const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
            document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
        };
        syncKeyboardInset();
        viewport.addEventListener("resize", syncKeyboardInset);
        viewport.addEventListener("scroll", syncKeyboardInset);
        return () => {
            viewport.removeEventListener("resize", syncKeyboardInset);
            viewport.removeEventListener("scroll", syncKeyboardInset);
            document.documentElement.style.removeProperty("--keyboard-inset");
        };
    }, []);

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
        if (isE2EMockAuth) return undefined;
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
        if (isE2EMockAuth) return undefined;
        if (session?.user) loadIdentity();
    }, [session?.user?.id]);

    useEffect(() => {
        if (isE2EMockAuth) return undefined;
        if (!household?.id) return;

        loadData();
        refreshPendingProposalCount();

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
                    refreshPendingProposalCount();
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
    }, [household?.id, refreshPendingProposalCount]);

    async function loadIdentity() {
        if (isE2EMockAuth) {
            setProfile(mockProfile);
            setHousehold(mockHousehold);
            setLoading(false);
            return;
        }
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
        if (isE2EMockAuth) return;
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

    const importRoute = window.location.pathname === "/import";

    return (
        <div
            className={`app-shell ${privateMode ? "private-display" : ""} ${["money", "grow"].includes(tab) ? "density-route" : ""}`}
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
                <IosInstallHint />
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
                    {importRoute ? (
                        <section className="page-stack import-route" aria-label="Review shared CSV import">
                            <div className="page-heading"><div><p className="eyebrow">SHARED CSV</p><h2>Review before importing</h2><p>Nothing reaches your financial records until you confirm the reviewed rows.</p></div></div>
                            <CsvImportPanel
                                householdId={household.id}
                                onImported={loadData}
                                onToast={showToast}
                                sharedImport={sharedImport?.kind === "csv" ? sharedImport : null}
                                onSharedImportHandled={clearSharedCsv}
                            />
                            <Button type="button" variant="secondary" onClick={() => { window.history.replaceState({}, "", "/"); setTab("money"); }}>Back to Money</Button>
                        </section>
                    ) : <AnimatedPage key={tab} reducedMotion={reducedMotion} className={["money", "grow"].includes(tab) ? "density-route-page" : ""}>
                    {tab === "home" && (
                        <TodayTab
                            householdId={household.id}
                            tasks={tasks}
                            appointments={appointments}
                            balance={balance}
                            privateMode={privateMode}
                            reducedMotion={reducedMotion}
                            setTaskModal={setTaskModal}
                            openTaskDetail={setSelectedTask}
                            proposalCount={proposalCount}
                            proposalRefreshKey={proposalRefreshKey}
                            onProposalCount={onProposalCount}
                            onFlagsChanged={refreshFeatureFlags}
                            onToast={showToast}
                            memberTrack={memberTrack}
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
                            sharedImport={sharedImport?.kind === "csv" ? sharedImport : null}
                            onSharedImportHandled={clearSharedCsv}
                            memberTrack={memberTrack}
                            twinsDueDate={twinsDueWindow}
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
                                    householdId={household.id}
                                    appointments={appointments}
                                    setAppointmentModal={
                                        setAppointmentModal
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
                        <GrowTab
                            householdId={household.id}
                            currentUserId={session.user.id}
                            transactions={transactions}
                            opportunities={opportunities}
                            privateMode={privateMode}
                            reducedMotion={reducedMotion}
                            setTransactionModal={setTransactionModal}
                            setOpportunityModal={setOpportunityModal}
                            setOpportunityDraft={setOpportunityDraft}
                            onImported={loadData}
                        />
                    )}

                    </AnimatedPage>}
                </main>

                <nav className="bottom-nav" aria-label="Main navigation">
                    {tabs.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.id === "settings" ? settingsOpen : tab === item.id;

                        return (
                            <button
                                key={item.id}
                                className={isActive ? "active" : ""}
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => {
                                    if (item.id === "settings") setSettingsOpen(true);
                                    else setTab(item.id);
                                }}
                            >
                                {isActive ? (
                                    <motion.span
                                        className="nav-indicator"
                                        layoutId="nav-indicator"
                                        aria-hidden="true"
                                        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                                    />
                                ) : null}
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

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onToggle={toggleTask}
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
                    memberTrack={memberTrack}
                    setMemberTrack={changeMemberTrack}
                    showThemeCatalog={isFeatureEnabled("theme_catalog")}
                    sharedLink={sharedImport?.kind === "link" ? sharedImport : null}
                    onSharedLinkHandled={clearSharedLink}
                    onClose={() => setSettingsOpen(false)}
                />
            )}
        </div>
    );
}
