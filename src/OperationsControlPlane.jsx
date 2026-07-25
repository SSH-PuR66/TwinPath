import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    BadgeCheck,
    Blocks,
    Check,
    ChevronRight,
    CirclePause,
    CirclePlay,
    CircleStop,
    Clock3,
    ExternalLink,
    Eye,
    EyeOff,
    FileCheck2,
    FileText,
    Gauge,
    Loader2,
    LockKeyhole,
    PackageOpen,
    PenTool,
    Radar,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    X,
} from "lucide-react";

import {
    getOperationsEngine,
    operationsCatalog,
    operationsSafetyText,
} from "./operationsCatalog";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";
import { CONTROL_PLANE_TIMEOUT_MS, readControlPlaneResponse } from "./useControlPlane";
import DisclosureSection from "./DisclosureSection";

const operationsStyles = `
.operations-shell{--operations-ink:#172033;--operations-muted:#667085;--operations-border:#e6e9ef;--operations-surface:#fff;--operations-soft:#f7f8fb;display:grid;gap:20px;color:var(--operations-ink);font-family:inherit}
.operations-shell *{box-sizing:border-box}.operations-shell button,.operations-shell input,.operations-shell textarea,.operations-shell select{font:inherit}
.operations-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:28px;border:1px solid var(--operations-border);border-radius:24px;background:linear-gradient(135deg,#101827 0%,#1c2940 62%,#263653 100%);color:#fff;box-shadow:0 18px 45px rgba(16,24,39,.16)}
.operations-hero:after{content:"";position:absolute;width:260px;height:260px;right:-85px;top:-130px;border-radius:50%;background:radial-gradient(circle,rgba(124,92,255,.44),transparent 67%);pointer-events:none}
.operations-kicker,.operations-label{margin:0 0 7px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.operations-kicker{color:#a9b9d6}.operations-hero h2{margin:0;font-size:clamp(26px,4vw,40px);line-height:1.05;letter-spacing:-.035em}.operations-hero p{max-width:720px;margin:12px 0 0;color:#cbd5e5;line-height:1.6}
.operations-hero-status{position:relative;z-index:1;display:flex;align-items:center;gap:10px;padding:12px 15px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.08);font-size:13px;white-space:nowrap}.operations-status-dot{width:8px;height:8px;border-radius:50%;background:#57d39b;box-shadow:0 0 0 5px rgba(87,211,155,.14)}.operations-status-dot[data-offline="true"]{background:#f0b35c;box-shadow:0 0 0 5px rgba(240,179,92,.13)}
.operations-banner{display:flex;gap:13px;align-items:flex-start;padding:15px 17px;border:1px solid #dce4f2;border-radius:16px;background:#f5f8ff;color:#34405a;line-height:1.5}.operations-banner[data-tone="warning"]{border-color:#f2d5a4;background:#fff9ed}.operations-banner[data-tone="danger"]{border-color:#efc1c1;background:#fff5f5}.operations-banner strong{display:block;margin-bottom:2px}.operations-banner p{margin:0;color:var(--operations-muted);font-size:13px}
.operations-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.operations-stat{padding:17px;border:1px solid var(--operations-border);border-radius:16px;background:var(--operations-surface);box-shadow:0 7px 22px rgba(24,33,52,.05)}.operations-stat span{display:block;color:var(--operations-muted);font-size:12px}.operations-stat strong{display:block;margin-top:5px;font-size:25px;letter-spacing:-.03em}.operations-stat small{display:block;margin-top:3px;color:#7b8495}
.operations-toolbar{display:flex;justify-content:space-between;gap:16px;align-items:center}.operations-toolbar h3,.operations-panel h3{margin:0;font-size:20px;letter-spacing:-.02em}.operations-toolbar p,.operations-panel-heading p{margin:5px 0 0;color:var(--operations-muted);font-size:13px;line-height:1.5}
.operations-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:9px 14px;border:1px solid transparent;border-radius:11px;background:#172033;color:#fff;font-weight:750;font-size:13px;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}.operations-button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 7px 18px rgba(23,32,51,.17)}.operations-button:focus-visible,.operations-engine-card:focus-visible,.operations-icon-button:focus-visible{outline:3px solid rgba(41,121,255,.28);outline-offset:2px}.operations-button:disabled{opacity:.52;cursor:not-allowed}.operations-button[data-variant="secondary"]{border-color:var(--operations-border);background:#fff;color:#293247}.operations-button[data-variant="danger"]{border-color:#f0c8c8;background:#fff6f6;color:#ad2f2f}.operations-button[data-variant="approve"]{background:#087e68}.operations-button[data-compact="true"]{min-height:34px;padding:7px 10px;font-size:12px}
.operations-engine-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.operations-engine-card{position:relative;display:flex;min-height:214px;flex-direction:column;gap:12px;padding:18px;text-align:left;border:1px solid var(--operations-border);border-radius:18px;background:#fff;color:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(25,33,48,.045);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.operations-engine-card:hover{transform:translateY(-2px);box-shadow:0 13px 30px rgba(25,33,48,.09)}.operations-engine-card[aria-pressed="true"]{border-color:var(--operations-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--operations-accent) 14%,transparent),0 14px 30px rgba(25,33,48,.08)}.operations-engine-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.operations-engine-icon{display:grid;width:40px;height:40px;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--operations-accent) 12%,white);color:var(--operations-accent)}.operations-pill{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;padding:5px 8px;border-radius:999px;background:#f1f3f7;color:#505a6e;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.operations-pill[data-tone="green"]{background:#eaf8f3;color:#08745f}.operations-pill[data-tone="amber"]{background:#fff4df;color:#966113}.operations-pill[data-tone="red"]{background:#ffeded;color:#a72b2b}.operations-pill[data-tone="blue"]{background:#edf3ff;color:#315ea7}.operations-engine-card h4{margin:0;font-size:16px}.operations-engine-card p{margin:0;color:var(--operations-muted);font-size:12px;line-height:1.55}.operations-engine-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;color:#778196;font-size:11px}
.operations-detail-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.75fr);gap:15px}.operations-panel{padding:20px;border:1px solid var(--operations-border);border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(25,33,48,.045)}.operations-panel-heading{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:17px}.operations-panel-heading-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.operations-capabilities{display:grid;grid-template-columns:1fr 1fr;gap:13px}.operations-subpanel{padding:15px;border-radius:14px;background:var(--operations-soft)}.operations-subpanel h4{display:flex;align-items:center;gap:7px;margin:0 0 10px;font-size:13px}.operations-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.operations-list li{display:flex;gap:8px;align-items:flex-start;color:#4b5568;font-size:12px;line-height:1.45}.operations-list svg{flex:0 0 auto;margin-top:2px;color:#16866f}.operations-safety{margin-top:13px;padding:14px 15px;border-left:3px solid var(--operations-accent);border-radius:0 12px 12px 0;background:color-mix(in srgb,var(--operations-accent) 6%,white);color:#475166;font-size:12px;line-height:1.55}
.operations-readiness{display:grid;gap:11px}.operations-readiness-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid #edf0f4}.operations-readiness-row:last-child{border-bottom:0}.operations-readiness-row strong{display:block;font-size:12px}.operations-readiness-row span{display:block;margin-top:2px;color:var(--operations-muted);font-size:11px}.operations-readiness-icon{display:grid;width:30px;height:30px;place-items:center;border-radius:9px;background:#edf8f4;color:#16866f}.operations-readiness-icon[data-failed="true"]{background:#fff0f0;color:#b43b3b}
.operations-section-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.operations-timeline,.operations-artifacts,.operations-queue{display:grid;gap:10px}.operations-run{padding:15px;border:1px solid #e9ecf1;border-radius:14px;background:#fff}.operations-run-head,.operations-artifact-head,.operations-approval-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.operations-run-title{display:flex;gap:10px;align-items:flex-start}.operations-run-title strong,.operations-artifact strong,.operations-approval strong{display:block;font-size:13px}.operations-run-title small,.operations-artifact small,.operations-approval small{display:block;margin-top:4px;color:var(--operations-muted);font-size:11px;line-height:1.45}.operations-run-actions{display:flex;gap:6px;margin-top:12px}.operations-icon-button{display:grid;width:34px;height:34px;place-items:center;border:1px solid var(--operations-border);border-radius:10px;background:#fff;color:#4b5568;cursor:pointer}.operations-icon-button:disabled{opacity:.45;cursor:not-allowed}.operations-timeline-steps{position:relative;display:grid;gap:8px;margin:13px 0 0 13px;padding-left:18px;border-left:1px solid #dfe3ea}.operations-step{position:relative;color:#5a6477;font-size:11px;line-height:1.4}.operations-step:before{content:"";position:absolute;left:-22px;top:4px;width:7px;height:7px;border:2px solid #fff;border-radius:50%;background:#9aa4b6;box-shadow:0 0 0 1px #cfd5df}.operations-step strong{display:inline;font-size:11px;color:#374156}
.operations-artifact{padding:14px;border:1px solid #e9ecf1;border-radius:14px;background:#fff}.operations-artifact-copy{display:flex;gap:10px;align-items:flex-start}.operations-artifact-body{margin:12px 0 0;padding:12px;border-radius:10px;background:#121a29;color:#e4eaf4;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.operations-redacted{display:flex;gap:8px;align-items:center;margin-top:10px;padding:10px;border-radius:10px;background:#f7f1e8;color:#74562b;font-size:11px}
.operations-approval{padding:16px;border:1px solid #e3e7ee;border-radius:15px;background:#fff}.operations-consequences{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.operations-consequence{padding:10px;border-radius:10px;background:#f7f8fa}.operations-consequence span{display:block;color:#7a8496;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.operations-consequence strong{margin-top:3px;font-size:11px}.operations-approval-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
.operations-scope-form{display:grid;gap:12px}.operations-field{display:grid;gap:6px}.operations-field span{font-size:11px;font-weight:750;color:#4c5669}.operations-field input,.operations-field textarea,.operations-field select{width:100%;border:1px solid #dce1e9;border-radius:10px;background:#fff;color:#222c40;padding:10px 11px;outline:none}.operations-field textarea{min-height:76px;resize:vertical}.operations-field input:focus,.operations-field textarea:focus,.operations-field select:focus{border-color:#2979ff;box-shadow:0 0 0 3px rgba(41,121,255,.12)}.operations-field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.operations-help{margin:0;color:var(--operations-muted);font-size:11px;line-height:1.5}
.operations-empty{display:grid;place-items:center;min-height:130px;padding:20px;text-align:center;border:1px dashed #d9dee7;border-radius:14px;background:#fafbfc;color:#687286}.operations-empty svg{margin-bottom:9px;color:#9aa4b6}.operations-empty strong{display:block;color:#3f495d;font-size:13px}.operations-empty p{max-width:420px;margin:5px 0 0;font-size:11px;line-height:1.5}.operations-error{padding:11px 13px;border-radius:11px;background:#fff0f0;color:#a72b2b;font-size:12px}.operations-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.operations-spin{animation:operations-spin 1s linear infinite}@keyframes operations-spin{to{transform:rotate(360deg)}}
@media(max-width:1050px){.operations-engine-grid,.operations-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.operations-detail-grid,.operations-section-grid{grid-template-columns:1fr}}
@media(max-width:620px){.operations-hero{grid-template-columns:1fr;padding:22px}.operations-hero-status{width:max-content}.operations-engine-grid,.operations-summary-grid,.operations-capabilities,.operations-field-row{grid-template-columns:1fr}.operations-toolbar,.operations-panel-heading{align-items:stretch;flex-direction:column}.operations-panel-heading-actions{justify-content:flex-start}.operations-consequences{grid-template-columns:1fr}.operations-panel{padding:16px}}
@media(prefers-reduced-motion:reduce){.operations-shell *{scroll-behavior:auto!important;transition:none!important}}
`;

const iconByName = {
    blocks: Blocks,
    radar: Radar,
    package: PackageOpen,
    pen: PenTool,
};

const terminalStatuses = new Set([
    "cancelled",
    "canceled",
    "completed",
    "succeeded",
    "failed",
    "rejected",
]);

function operationsClass(...names) {
    return names.filter(Boolean).map((name) => `operations-${name}`).join(" ");
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function formatDate(value) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function readable(value, fallback = "Unknown") {
    if (!value) return fallback;
    return String(value).replaceAll("_", " ");
}

function statusTone(status) {
    const normalized = String(status || "").toLowerCase();
    if (["ready", "completed", "succeeded", "approved", "active", "passed"].includes(normalized)) return "green";
    if (["failed", "cancelled", "canceled", "rejected", "blocked"].includes(normalized)) return "red";
    if (["running", "review", "pending", "pending_review"].includes(normalized)) return "blue";
    return "amber";
}

function normalizeDashboard(payload) {
    const source = payload?.dashboard || payload?.data || payload || {};
    return {
        engines: asArray(source.engines),
        projects: asArray(source.projects),
        runs: asArray(source.runs),
        artifacts: asArray(source.artifacts),
        approvals: asArray(source.approvals || source.approval_queue),
        scopes: asArray(source.scopes || source.authorized_scopes),
        readiness: source.readiness || {},
    };
}

function engineIdFor(item) {
    return item?.engine_id || item?.engineId || item?.engine || "";
}

function EmptyState({ icon: Icon = Sparkles, title, children }) {
    return (
        <div className={operationsClass("empty")}>
            <div>
                <Icon size={25} aria-hidden="true" />
                <strong>{title}</strong>
                {children && <p>{children}</p>}
            </div>
        </div>
    );
}

function Pill({ status, children }) {
    return (
        <span className={operationsClass("pill")} data-tone={statusTone(status)}>
            {children}
        </span>
    );
}

export default function OperationsControlPlane({
    householdId,
    currentUserId,
    privateMode = false,
}) {
    const workerUrl = String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim().replace(/\/+$/, "");
    const [dashboard, setDashboard] = useState(() => normalizeDashboard({}));
    const [selectedEngineId, setSelectedEngineId] = useState(operationsCatalog[0].id);
    const [loading, setLoading] = useState(Boolean(workerUrl));
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [busyKey, setBusyKey] = useState("");
    const [revealedArtifacts, setRevealedArtifacts] = useState(() => new Set());
    const [artifactUrls, setArtifactUrls] = useState({});
    const [showAllRuns, setShowAllRuns] = useState(false);
    const [showAllArtifacts, setShowAllArtifacts] = useState(false);
    const [showAllApprovals, setShowAllApprovals] = useState(false);
    const [scopeOpen, setScopeOpen] = useState(false);
    const [scopeForm, setScopeForm] = useState({
        name: "",
        assetPattern: "",
        policyUrl: "",
        allowedTechniques: "Passive reconnaissance only",
        exclusions: "",
        expiresAt: "",
    });

    const apiRequest = useCallback(async (path, options = {}) => {
        if (!workerUrl) throw new Error("Control Plane Worker is not configured.");

        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.access_token) throw new Error("Sign in again to access the control plane.");

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), CONTROL_PLANE_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(`${workerUrl}${path}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                    "X-Household-Id": String(householdId),
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...options.headers,
                },
            });
        } catch (fetchError) {
            if (fetchError?.name === "AbortError") throw new Error("Control plane took longer than 8 seconds. Please retry.");
            throw fetchError;
        } finally { window.clearTimeout(timeout); }
        const payload = await readControlPlaneResponse(response);

        if (!response.ok) {
            throw new Error(
                payload.error?.message ||
                payload.message ||
                `Control plane request failed (${response.status}).`
            );
        }

        return payload;
    }, [workerUrl]);

    const loadDashboard = useCallback(async ({ quiet = false } = {}) => {
        if (!workerUrl || !householdId || !currentUserId) {
            setLoading(false);
            return;
        }

        if (quiet) setRefreshing(true);
        else setLoading(true);
        setError("");

        try {
            const payload = await apiRequest("/v1/dashboard");
            setDashboard(normalizeDashboard(payload));
        } catch (requestError) {
            setError(
                navigator.onLine
                    ? requestError.message
                    : "You appear to be offline. Existing control-plane data may be unavailable."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [apiRequest, currentUserId, householdId, workerUrl]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    async function mutate(key, path, body, successMessage) {
        setBusyKey(key);
        setError("");

        try {
            await apiRequest(path, {
                method: "POST",
                body: JSON.stringify({
                    ...body,
                }),
            });
            await loadDashboard({ quiet: true });
            if (successMessage) setError("");
            return true;
        } catch (requestError) {
            setError(requestError.message);
            return false;
        } finally {
            setBusyKey("");
        }
    }

    async function startRun(engineId) {
        await mutate(
            `start:${engineId}`,
            "/v1/runs",
            { engine_id: engineId, mode: "sandbox" },
            "Sandbox run started."
        );
    }

    async function changeRun(runId, action) {
        await mutate(
            `${action}:${runId}`,
            `/v1/runs/${encodeURIComponent(runId)}/${action}`,
            { action },
            `Run ${action} requested.`
        );
    }

    async function decideApproval(approvalId, decision) {
        await mutate(
            `${decision}:${approvalId}`,
            `/v1/approvals/${encodeURIComponent(approvalId)}/decision`,
            { decision },
            `Approval ${decision} recorded.`
        );
    }

    async function createScope(event) {
        event.preventDefault();
        const safePolicyUrl = safeExternalUrl(scopeForm.policyUrl, { allowLocalHttp: false });

        if (!safePolicyUrl) {
            setError("Enter a valid HTTPS program policy URL.");
            return;
        }

        const created = await mutate("create-scope", "/v1/scopes", {
            engine_id: "bounty_recon",
            name: scopeForm.name.trim(),
            asset_pattern: scopeForm.assetPattern.trim(),
            policy_url: safePolicyUrl,
            allowed_techniques: scopeForm.allowedTechniques.trim(),
            exclusions: scopeForm.exclusions.trim(),
            expires_at: scopeForm.expiresAt || null,
        });

        if (created) {
            setScopeOpen(false);
            setScopeForm({
                name: "",
                assetPattern: "",
                policyUrl: "",
                allowedTechniques: "Passive reconnaissance only",
                exclusions: "",
                expiresAt: "",
            });
        }
    }

    function toggleArtifact(artifactId) {
        setRevealedArtifacts((current) => {
            const next = new Set(current);
            if (next.has(artifactId)) next.delete(artifactId);
            else next.add(artifactId);
            return next;
        });
    }

    async function requestArtifactUrl(artifactId) {
        setBusyKey(`artifact:${artifactId}`);
        setError("");
        try {
            const payload = await apiRequest(
                `/v1/artifacts/${encodeURIComponent(artifactId)}/signed-url`,
                { method: "POST", body: "{}" }
            );
            setArtifactUrls((current) => ({
                ...current,
                [artifactId]: payload.signed_url,
            }));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusyKey("");
        }
    }

    const selectedEngine = getOperationsEngine(selectedEngineId) || operationsCatalog[0];
    const selectedState = dashboard.engines.find(
        (engine) => engineIdFor(engine) === selectedEngineId || engine.id === selectedEngineId
    );
    const selectedRuns = dashboard.runs.filter((run) => engineIdFor(run) === selectedEngineId);
    const selectedProjects = dashboard.projects.filter(
        (project) =>
            engineIdFor(project) === selectedEngineId
    );
    const selectedArtifacts = dashboard.artifacts.filter(
        (artifact) => engineIdFor(artifact) === selectedEngineId
    );
    const selectedReadiness = asArray(
        dashboard.readiness?.[selectedEngineId] || selectedState?.readiness
    );
    const activeRuns = dashboard.runs.filter(
        (run) => !terminalStatuses.has(String(run.status || "").toLowerCase())
    ).length;
    const pendingApprovals = dashboard.approvals.filter((approval) =>
        ["pending", "pending_review", "review"].includes(String(approval.status || "pending").toLowerCase())
    );
    const failedPolicies = useMemo(() => {
        const all = Object.values(dashboard.readiness || {}).flatMap(asArray);
        return all.filter((check) =>
            ["failed", "blocked"].includes(String(check.status || "").toLowerCase())
        ).length;
    }, [dashboard.readiness]);

    const canUseWorker = Boolean(workerUrl && householdId && currentUserId);

    return (
        <section className={operationsClass("shell")} aria-labelledby="operations-title">
            <style>{operationsStyles}</style>

            <header className={operationsClass("hero")}>
                <div>
                    <p className={operationsClass("kicker")}>OPERATIONS CONTROL PLANE</p>
                    <h2 id="operations-title">Build safely. Approve deliberately.</h2>
                    <p>
                        Four sandboxed engines turn ideas into reviewable work. Every external,
                        irreversible, sensitive, or financial consequence stops at the approval queue.
                    </p>
                </div>
                <div className={operationsClass("hero-status")} role="status">
                    <span
                        className={operationsClass("status-dot")}
                        data-offline={!navigator.onLine || !workerUrl}
                        aria-hidden="true"
                    />
                    {!workerUrl ? "Worker not configured" : navigator.onLine ? "Control plane connected" : "Offline"}
                </div>
            </header>

            {!workerUrl && (
                <div className={operationsClass("banner")} data-tone="warning" role="status">
                    <AlertTriangle size={20} aria-hidden="true" />
                    <div>
                        <strong>Control Plane Worker is not configured</strong>
                        <p>
                            Add VITE_CONTROL_PLANE_URL to the deployment environment. The catalog remains
                            available, but runs, scopes, and approvals are read-only.
                        </p>
                    </div>
                </div>
            )}

            {workerUrl && (!householdId || !currentUserId) && (
                <div className={operationsClass("banner")} data-tone="warning" role="status">
                    <LockKeyhole size={20} aria-hidden="true" />
                    <div>
                        <strong>A household session is required</strong>
                        <p>Select a household and sign in before loading operational data.</p>
                    </div>
                </div>
            )}

            <div className={operationsClass("banner")}>
                <ShieldCheck size={20} aria-hidden="true" />
                <div>
                    <strong>Sandbox is the default boundary</strong>
                    <p>{operationsSafetyText.sandbox}</p>
                </div>
            </div>

            {error && (
                <div className={operationsClass("error")} role="alert">
                    {error}
                </div>
            )}

            <div className={operationsClass("summary-grid")} aria-label="Operations summary">
                <div className={operationsClass("stat")}>
                    <span>Engines</span>
                    <strong>{operationsCatalog.length}</strong>
                    <small>All sandbox-first</small>
                </div>
                <div className={operationsClass("stat")}>
                    <span>Active runs</span>
                    <strong>{activeRuns}</strong>
                    <small>Across all engines</small>
                </div>
                <div className={operationsClass("stat")}>
                    <span>Awaiting approval</span>
                    <strong>{pendingApprovals.length}</strong>
                    <small>Human decision required</small>
                </div>
                <div className={operationsClass("stat")}>
                    <span>Policy failures</span>
                    <strong>{failedPolicies}</strong>
                    <small>{failedPolicies ? "Action needed" : "No failures reported"}</small>
                </div>
            </div>

            <DisclosureSection id="ops-engines" title="Engines" hint="Choose an automation workspace">
            <div className={operationsClass("toolbar")}>
                <div>
                    <h3>Engine portfolio</h3>
                    <p>Select an engine to inspect its controls, runs, and artifacts.</p>
                </div>
                <button
                    type="button"
                    className={operationsClass("button")}
                    data-variant="secondary"
                    onClick={() => loadDashboard({ quiet: true })}
                    disabled={!canUseWorker || refreshing}
                >
                    <RefreshCw
                        size={15}
                        className={refreshing ? operationsClass("spin") : undefined}
                        aria-hidden="true"
                    />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </button>
            </div>

            <div className={operationsClass("engine-grid")}>
                {operationsCatalog.map((engine) => {
                    const Icon = iconByName[engine.icon] || Blocks;
                    const engineState = dashboard.engines.find(
                        (item) => engineIdFor(item) === engine.id || item.id === engine.id
                    );
                    const engineRuns = dashboard.runs.filter((run) => engineIdFor(run) === engine.id);
                    const status = engineState?.status || (engineRuns.length ? "ready" : "idle");

                    return (
                        <button
                            type="button"
                            key={engine.id}
                            className={operationsClass("engine-card")}
                            style={{ "--operations-accent": engine.color }}
                            aria-pressed={selectedEngineId === engine.id}
                            onClick={() => setSelectedEngineId(engine.id)}
                        >
                            <span className={operationsClass("engine-top")}>
                                <span className={operationsClass("engine-icon")}>
                                    <Icon size={20} aria-hidden="true" />
                                </span>
                                <Pill status={status}>{readable(status, "idle")}</Pill>
                            </span>
                            <span>
                                <span className={operationsClass("label")}>{engine.eyebrow}</span>
                                <h4>{engine.title}</h4>
                            </span>
                            <p>{engine.description}</p>
                            <span className={operationsClass("engine-foot")}>
                                <span>{engineRuns.length} run{engineRuns.length === 1 ? "" : "s"}</span>
                                <ChevronRight size={15} aria-hidden="true" />
                            </span>
                        </button>
                    );
                })}
            </div>

            </DisclosureSection>

            <DisclosureSection id="ops-automation" title="Automation details" hint="Policy readiness, runs, and artifacts" collapseOnPhone>
            <div className={operationsClass("detail-grid")}>
                <article
                    className={operationsClass("panel")}
                    style={{ "--operations-accent": selectedEngine.color }}
                >
                    <div className={operationsClass("panel-heading")}>
                        <div>
                            <p className={operationsClass("label")}>{selectedEngine.eyebrow}</p>
                            <h3>{selectedEngine.title}</h3>
                            <p>{selectedEngine.objective}</p>
                        </div>
                        <div className={operationsClass("panel-heading-actions")}>
                            {selectedEngine.id === "bounty_recon" && (
                                <button
                                    type="button"
                                    className={operationsClass("button")}
                                    data-variant="secondary"
                                    onClick={() => setScopeOpen((open) => !open)}
                                    disabled={!canUseWorker}
                                >
                                    <ShieldCheck size={15} aria-hidden="true" />
                                    {scopeOpen ? "Close scope form" : "Authorize scope"}
                                </button>
                            )}
                            <button
                                type="button"
                                className={operationsClass("button")}
                                onClick={() => startRun(selectedEngine.id)}
                                disabled={!canUseWorker || busyKey === `start:${selectedEngine.id}`}
                            >
                                {busyKey === `start:${selectedEngine.id}` ? (
                                    <Loader2
                                        size={15}
                                        className={operationsClass("spin")}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <CirclePlay size={15} aria-hidden="true" />
                                )}
                                Start sandbox run
                            </button>
                        </div>
                    </div>

                    <div className={operationsClass("capabilities")}>
                        <div className={operationsClass("subpanel")}>
                            <h4><Sparkles size={15} aria-hidden="true" /> Prepared in sandbox</h4>
                            <ul className={operationsClass("list")}>
                                {selectedEngine.capabilities.map((item) => (
                                    <li key={item}><Check size={14} aria-hidden="true" /> {item}</li>
                                ))}
                            </ul>
                        </div>
                        <div className={operationsClass("subpanel")}>
                            <h4><ShieldAlert size={15} aria-hidden="true" /> Hard boundaries</h4>
                            <ul className={operationsClass("list")}>
                                {selectedEngine.guardrails.map((item) => (
                                    <li key={item}><LockKeyhole size={14} aria-hidden="true" /> {item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className={operationsClass("safety")}>
                        <strong>Approval boundary:</strong> {selectedEngine.approvalExamples}
                    </div>

                    {selectedProjects.length > 0 && (
                        <div className={operationsClass("subpanel")}>
                            <h4>
                                <Blocks size={15} aria-hidden="true" />
                                Experiment pipeline
                            </h4>
                            <ul className={operationsClass("list")}>
                                {selectedProjects.slice(0, 5).map((project) => (
                                    <li key={project.id}>
                                        <Check size={14} aria-hidden="true" />
                                        <span>
                                            {project.name}
                                            {" · "}
                                            {readable(project.status)}
                                            {project.experiment_id
                                                ? " · linked to Opportunity Lab"
                                                : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {selectedEngine.id === "bounty_recon" && scopeOpen && (
                        <form className={operationsClass("scope-form")} onSubmit={createScope}>
                            <div className={operationsClass("banner")} data-tone="warning">
                                <Radar size={19} aria-hidden="true" />
                                <div>
                                    <strong>Written authorization is mandatory</strong>
                                    <p>{selectedEngine.scopeNotice}</p>
                                </div>
                            </div>
                            <div className={operationsClass("field-row")}>
                                <label className={operationsClass("field")}>
                                    <span>Program or authorization name</span>
                                    <input
                                        required
                                        maxLength={120}
                                        value={scopeForm.name}
                                        onChange={(event) =>
                                            setScopeForm({ ...scopeForm, name: event.target.value })
                                        }
                                    />
                                </label>
                                <label className={operationsClass("field")}>
                                    <span>Authorized asset pattern</span>
                                    <input
                                        required
                                        maxLength={240}
                                        placeholder="example.com or *.example.com"
                                        value={scopeForm.assetPattern}
                                        onChange={(event) =>
                                            setScopeForm({ ...scopeForm, assetPattern: event.target.value })
                                        }
                                    />
                                </label>
                            </div>
                            <label className={operationsClass("field")}>
                                <span>HTTPS policy or authorization URL</span>
                                <input
                                    required
                                    type="url"
                                    inputMode="url"
                                    placeholder="https://…"
                                    value={scopeForm.policyUrl}
                                    onChange={(event) =>
                                        setScopeForm({ ...scopeForm, policyUrl: event.target.value })
                                    }
                                />
                            </label>
                            <div className={operationsClass("field-row")}>
                                <label className={operationsClass("field")}>
                                    <span>Allowed techniques</span>
                                    <textarea
                                        required
                                        maxLength={1000}
                                        value={scopeForm.allowedTechniques}
                                        onChange={(event) =>
                                            setScopeForm({ ...scopeForm, allowedTechniques: event.target.value })
                                        }
                                    />
                                </label>
                                <label className={operationsClass("field")}>
                                    <span>Exclusions and prohibited actions</span>
                                    <textarea
                                        required
                                        maxLength={1000}
                                        value={scopeForm.exclusions}
                                        onChange={(event) =>
                                            setScopeForm({ ...scopeForm, exclusions: event.target.value })
                                        }
                                    />
                                </label>
                            </div>
                            <label className={operationsClass("field")}>
                                <span>Authorization expires (optional)</span>
                                <input
                                    type="date"
                                    value={scopeForm.expiresAt}
                                    onChange={(event) =>
                                        setScopeForm({ ...scopeForm, expiresAt: event.target.value })
                                    }
                                />
                            </label>
                            <p className={operationsClass("help")}>
                                Creating a scope records the boundary; it does not authorize out-of-scope
                                testing or bypass per-action approvals.
                            </p>
                            <button
                                className={operationsClass("button")}
                                type="submit"
                                disabled={busyKey === "create-scope"}
                            >
                                {busyKey === "create-scope" ? (
                                    <Loader2
                                        size={15}
                                        className={operationsClass("spin")}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <ShieldCheck size={15} aria-hidden="true" />
                                )}
                                Create authorized scope
                            </button>
                        </form>
                    )}
                </article>

                <aside className={operationsClass("panel")}>
                    <div className={operationsClass("panel-heading")}>
                        <div>
                            <h3>Policy readiness</h3>
                            <p>Failures block consequential actions.</p>
                        </div>
                        <Gauge size={21} aria-hidden="true" />
                    </div>
                    {loading ? (
                        <EmptyState icon={Loader2} title="Loading readiness">
                            Verifying policy and engine state…
                        </EmptyState>
                    ) : selectedReadiness.length ? (
                        <div className={operationsClass("readiness")}>
                            {selectedReadiness.map((check, index) => {
                                const failed = ["failed", "blocked"].includes(
                                    String(check.status || "").toLowerCase()
                                );
                                return (
                                    <div className={operationsClass("readiness-row")} key={check.id || index}>
                                        <span
                                            className={operationsClass("readiness-icon")}
                                            data-failed={failed}
                                        >
                                            {failed ? <X size={15} /> : <Check size={15} />}
                                        </span>
                                        <span>
                                            <strong>{check.label || check.name || "Policy check"}</strong>
                                            <span>{check.summary || check.message || "No additional detail."}</span>
                                        </span>
                                        <Pill status={check.status}>{readable(check.status)}</Pill>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState icon={FileCheck2} title="No readiness report">
                            Start a sandbox run to generate policy checks for this engine.
                        </EmptyState>
                    )}
                </aside>
            </div>

            <div className={operationsClass("section-grid")}>
                <section className={operationsClass("panel")} aria-labelledby="operations-runs-title">
                    <div className={operationsClass("panel-heading")}>
                        <div>
                            <h3 id="operations-runs-title">Run timeline</h3>
                            <p>Newest {selectedEngine.shortName} activity first.</p>
                        </div>
                        <Clock3 size={21} aria-hidden="true" />
                    </div>
                    {selectedRuns.length ? (
                        <>
                        <div className={operationsClass("timeline")}>
                            {(showAllRuns ? selectedRuns : selectedRuns.slice(0, 8)).map((run) => {
                                const status = String(run.status || "unknown").toLowerCase();
                                const canPause = ["running", "queued"].includes(status);
                                const canCancel = !terminalStatuses.has(status);
                                return (
                                    <article className={operationsClass("run")} key={run.id}>
                                        <div className={operationsClass("run-head")}>
                                            <div className={operationsClass("run-title")}>
                                                <CirclePlay size={17} aria-hidden="true" />
                                                <span>
                                                    <strong>{run.title || run.objective || "Sandbox run"}</strong>
                                                    <small>Started {formatDate(run.started_at || run.created_at)}</small>
                                                </span>
                                            </div>
                                            <Pill status={status}>{readable(status)}</Pill>
                                        </div>
                                        {asArray(run.timeline || run.events).length > 0 && (
                                            <div className={operationsClass("timeline-steps")}>
                                                {asArray(run.timeline || run.events).map((event, index) => (
                                                    <div className={operationsClass("step")} key={event.id || index}>
                                                        <strong>{event.label || event.type || "Update"}:</strong>{" "}
                                                        {event.summary || event.message || formatDate(event.created_at)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className={operationsClass("run-actions")}>
                                            <button
                                                type="button"
                                                className={operationsClass("icon-button")}
                                                aria-label={`Pause ${run.title || "run"}`}
                                                title="Pause run"
                                                disabled={!canPause || busyKey === `pause:${run.id}`}
                                                onClick={() => changeRun(run.id, "pause")}
                                            >
                                                <CirclePause size={16} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                className={operationsClass("icon-button")}
                                                aria-label={`Cancel ${run.title || "run"}`}
                                                title="Cancel run"
                                                disabled={!canCancel || busyKey === `cancel:${run.id}`}
                                                onClick={() => changeRun(run.id, "cancel")}
                                            >
                                                <CircleStop size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                        {selectedRuns.length > 8 && !showAllRuns ? (
                            <button type="button" className={operationsClass("button")} data-variant="secondary" onClick={() => setShowAllRuns(true)}>
                                Show all {selectedRuns.length}
                            </button>
                        ) : null}
                        </>
                    ) : (
                        <EmptyState icon={CirclePlay} title="No runs yet">
                            Start a sandbox run when you are ready to produce a reviewable plan.
                        </EmptyState>
                    )}
                </section>

                <section className={operationsClass("panel")} aria-labelledby="operations-artifacts-title">
                    <div className={operationsClass("panel-heading")}>
                        <div>
                            <h3 id="operations-artifacts-title">Artifacts</h3>
                            <p>Drafts and evidence stay private until intentionally opened.</p>
                        </div>
                        <FileText size={21} aria-hidden="true" />
                    </div>
                    {selectedArtifacts.length ? (
                        <>
                        <div className={operationsClass("artifacts")}>
                            {(showAllArtifacts ? selectedArtifacts : selectedArtifacts.slice(0, 8)).map((artifact) => {
                                const artifactId = artifact.id || `${artifact.name}-${artifact.created_at}`;
                                const isConfidential =
                                    artifact.confidential !== false &&
                                    (artifact.confidential || artifact.kind === "evidence" || artifact.sensitivity);
                                const revealed = !privateMode && revealedArtifacts.has(artifactId);
                                const externalUrl = safeExternalUrl(
                                    artifactUrls[artifactId] ||
                                    artifact.url ||
                                    artifact.external_url,
                                    { allowLocalHttp: false }
                                );
                                return (
                                    <article className={operationsClass("artifact")} key={artifactId}>
                                        <div className={operationsClass("artifact-head")}>
                                            <div className={operationsClass("artifact-copy")}>
                                                {isConfidential ? (
                                                    <LockKeyhole size={17} aria-hidden="true" />
                                                ) : (
                                                    <FileText size={17} aria-hidden="true" />
                                                )}
                                                <span>
                                                    <strong>
                                                        {!privateMode || !isConfidential
                                                            ? artifact.name || artifact.title || "Artifact"
                                                            : "Confidential evidence"}
                                                    </strong>
                                                    <small>
                                                        {readable(artifact.type || artifact.kind, "draft")} ·{" "}
                                                        {formatDate(artifact.created_at)}
                                                    </small>
                                                </span>
                                            </div>
                                            <Pill status={artifact.status || "draft"}>
                                                {readable(artifact.status, "draft")}
                                            </Pill>
                                        </div>
                                        {isConfidential && (
                                            <div className={operationsClass("redacted")}>
                                                <EyeOff size={14} aria-hidden="true" />
                                                Evidence body hidden by default.
                                            </div>
                                        )}
                                        {artifact.body && isConfidential && !privateMode && (
                                            <button
                                                type="button"
                                                className={operationsClass("button")}
                                                data-variant="secondary"
                                                data-compact="true"
                                                onClick={() => toggleArtifact(artifactId)}
                                                aria-expanded={revealed}
                                            >
                                                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                                {revealed ? "Hide evidence" : "Reveal privately"}
                                            </button>
                                        )}
                                        {artifact.body && (!isConfidential || revealed) && (
                                            <pre className={operationsClass("artifact-body")}>{artifact.body}</pre>
                                        )}
                                        {!externalUrl && (
                                            <button
                                                type="button"
                                                className={operationsClass("button")}
                                                data-variant="secondary"
                                                data-compact="true"
                                                disabled={
                                                    privateMode ||
                                                    busyKey === `artifact:${artifactId}`
                                                }
                                                onClick={() =>
                                                    requestArtifactUrl(artifactId)
                                                }
                                            >
                                                <LockKeyhole size={14} aria-hidden="true" />
                                                {privateMode
                                                    ? "Private mode locked"
                                                    : busyKey === `artifact:${artifactId}`
                                                      ? "Creating private link…"
                                                      : "Create 60-second private link"}
                                            </button>
                                        )}
                                        {externalUrl && (
                                            <a
                                                className={operationsClass("button")}
                                                data-variant="secondary"
                                                data-compact="true"
                                                href={externalUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Open artifact <ExternalLink size={14} aria-hidden="true" />
                                            </a>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                        {selectedArtifacts.length > 8 && !showAllArtifacts ? (
                            <button type="button" className={operationsClass("button")} data-variant="secondary" onClick={() => setShowAllArtifacts(true)}>
                                Show all {selectedArtifacts.length}
                            </button>
                        ) : null}
                        </>
                    ) : (
                        <EmptyState icon={FileText} title="No artifacts yet">
                            Drafts, reports, and redacted evidence from sandbox runs will appear here.
                        </EmptyState>
                    )}
                </section>
            </div>

            </DisclosureSection>

            <DisclosureSection id="ops-approvals" title="Approvals" hint="Consequential actions awaiting review" collapseOnPhone>
            <section className={operationsClass("panel")} aria-labelledby="operations-approvals-title">
                <div className={operationsClass("panel-heading")}>
                    <div>
                        <p className={operationsClass("label")}>UNIFIED QUEUE</p>
                        <h3 id="operations-approvals-title">Consequential action approvals</h3>
                        <p>{operationsSafetyText.approvals}</p>
                    </div>
                    <BadgeCheck size={22} aria-hidden="true" />
                </div>
                {pendingApprovals.length ? (
                    <>
                    <div className={operationsClass("queue")}>
                        {(showAllApprovals ? pendingApprovals : pendingApprovals.slice(0, 8)).map((approval) => {
                            const engine = getOperationsEngine(engineIdFor(approval));
                            const consequence = approval.consequence_summary || approval.consequences || {};
                            return (
                                <article className={operationsClass("approval")} key={approval.id}>
                                    <div className={operationsClass("approval-head")}>
                                        <span>
                                            <Pill status="pending">{engine?.shortName || "Operation"}</Pill>
                                            <strong>
                                                {approval.title || approval.action || "Action requires approval"}
                                            </strong>
                                            <small>
                                                Requested {formatDate(approval.created_at)} by{" "}
                                                {approval.requested_by_label || "an operations engine"}
                                            </small>
                                        </span>
                                        <ShieldAlert size={19} aria-hidden="true" />
                                    </div>
                                    <div className={operationsClass("consequences")}>
                                        <div className={operationsClass("consequence")}>
                                            <span>External effect</span>
                                            <strong>{consequence.external_effect || approval.external_effect || "Not specified"}</strong>
                                        </div>
                                        <div className={operationsClass("consequence")}>
                                            <span>Audience / recipient</span>
                                            <strong>{consequence.audience || approval.audience || "Not specified"}</strong>
                                        </div>
                                        <div className={operationsClass("consequence")}>
                                            <span>Cost</span>
                                            <strong>{consequence.cost || approval.cost_summary || "No cost reported"}</strong>
                                        </div>
                                        <div className={operationsClass("consequence")}>
                                            <span>Reversibility</span>
                                            <strong>{consequence.reversibility || approval.reversibility || "Not specified"}</strong>
                                        </div>
                                        <div className={operationsClass("consequence")}>
                                            <span>Data exposure</span>
                                            <strong>{consequence.data_exposure || approval.data_exposure || "None reported"}</strong>
                                        </div>
                                        <div className={operationsClass("consequence")}>
                                            <span>Policy basis</span>
                                            <strong>{consequence.policy_basis || approval.policy_basis || "Review required"}</strong>
                                        </div>
                                    </div>
                                    <div className={operationsClass("approval-actions")}>
                                        <button
                                            type="button"
                                            className={operationsClass("button")}
                                            data-variant="approve"
                                            disabled={busyKey === `approve:${approval.id}`}
                                            onClick={() => decideApproval(approval.id, "approve")}
                                        >
                                            <BadgeCheck size={15} aria-hidden="true" />
                                            Approve exact action
                                        </button>
                                        <button
                                            type="button"
                                            className={operationsClass("button")}
                                            data-variant="danger"
                                            disabled={busyKey === `reject:${approval.id}`}
                                            onClick={() => decideApproval(approval.id, "reject")}
                                        >
                                            <X size={15} aria-hidden="true" />
                                            Reject
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                    {pendingApprovals.length > 8 && !showAllApprovals ? (
                        <button type="button" className={operationsClass("button")} data-variant="secondary" onClick={() => setShowAllApprovals(true)}>
                            Show all {pendingApprovals.length}
                        </button>
                    ) : null}
                    </>
                ) : (
                    <EmptyState icon={BadgeCheck} title="Approval queue is clear">
                        Nothing can cross a consequential boundary without appearing here first.
                    </EmptyState>
                )}
            </section>
            </DisclosureSection>

            <span className={operationsClass("sr-only")} aria-live="polite">
                {loading ? "Loading operations dashboard" : `${pendingApprovals.length} approvals pending`}
            </span>
        </section>
    );
}
