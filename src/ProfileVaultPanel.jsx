import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useControlPlane } from "./useControlPlane";
import { Skeleton } from "./Skeleton";

export default function ProfileVaultPanel({ householdId }) {
    const { request, configured } = useControlPlane(householdId);
    const [profile, setProfile] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [status, setStatus] = useState("loading");
    const refresh = useCallback(async () => {
        if (!configured) return;
        setStatus("loading");
        try { const payload = await request("/v1/profile"); setProfile(payload.profile || {}); setError(""); setStatus("ready"); }
        catch (loadError) { setError(loadError.message); setStatus("error"); }
    }, [configured, request]);
    useEffect(() => { refresh(); }, [refresh]);
    async function save(event) {
        event.preventDefault(); setBusy(true); setSaved(false); setError("");
        try { await request("/v1/profile", { method: "PUT", body: JSON.stringify({ profile }) }); setSaved(true); }
        catch (saveError) { setError(saveError.message); }
        finally { setBusy(false); }
    }
    if (!configured) return null;
    if (status === "loading") return <section className="profile-vault-panel" aria-label="Loading family profile"><Skeleton className="skeleton-list" /></section>;
    if (status === "error") return <section className="profile-vault-panel"><strong>Family profile is temporarily unavailable.</strong><p>{error}</p><button className="button secondary" type="button" onClick={refresh}>Retry</button></section>;
    return <section className="profile-vault-panel" aria-labelledby="profile-vault-title"><header className="watched-sources-heading"><span className="watched-sources-icon"><ShieldCheck size={19} /></span><div><span className="eyebrow">FAMILY PROFILE</span><h3 id="profile-vault-title">Private application profile</h3><p>This vault refuses SSNs, IDs, and bank numbers by design — those never leave your hands.</p></div></header><form className="stack" onSubmit={save}><label className="field"><span>Household details for local application packets</span><textarea value={JSON.stringify(profile, null, 2)} onChange={(event) => { try { setProfile(JSON.parse(event.target.value)); setError(""); } catch { setError("Use valid JSON for the pre-seeded household profile."); } }} rows={10} aria-label="Family profile JSON" /></label><small className="muted">Only ordinary profile details belong here—names, contact details, household members, school, and application notes.</small><button className="button primary" type="submit" disabled={busy || Boolean(error)}>{busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />} Save family profile</button>{saved ? <div className="success-box compact">Family profile saved locally to your household vault.</div> : null}{error ? <div className="error-box" role="alert">{error}</div> : null}</form></section>;
}
