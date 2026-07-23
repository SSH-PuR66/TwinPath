import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useControlPlane } from "./useControlPlane";

const sample = "Date,Description,Amount,Category\n2026-07-20,Example deposit,25.00,Income";

export default function CsvImportPanel({ householdId, onImported, onToast }) {
    const { request, configured } = useControlPlane(householdId);
    const [csv, setCsv] = useState("");
    const [sourceLabel, setSourceLabel] = useState("import");
    const [invert, setInvert] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [summary, setSummary] = useState(null);
    const [dragging, setDragging] = useState(false);

    async function refreshSummary() {
        try {
            const payload = await request("/v1/financial/summary");
            setSummary(payload);
        } catch { /* import result remains useful if summary is temporarily unavailable */ }
    }

    useEffect(() => { if (configured) refreshSummary(); }, [configured]); // eslint-disable-line react-hooks/exhaustive-deps

    async function readFile(file) {
        if (!file) return;
        if (file.size > 512 * 1024) {
            setError("Choose a CSV smaller than 512 KB.");
            return;
        }
        setCsv(await file.text());
        setError("");
    }

    function dropFile(event) {
        event.preventDefault();
        setDragging(false);
        readFile(event.dataTransfer.files?.[0]);
    }

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const payload = await request("/v1/financial/import/csv", {
                method: "POST",
                body: JSON.stringify({ csv, source_label: sourceLabel.trim() || "import", invert }),
            });
            setResult(payload);
            await Promise.all([refreshSummary(), onImported?.()]);
            onToast?.(`${payload.imported} transaction${payload.imported === 1 ? "" : "s"} imported.`);
        } catch (importError) {
            setError(importError.message);
        } finally {
            setBusy(false);
        }
    }

    if (!configured) return null;
    return (
        <section className="money-tool-panel" aria-labelledby="csv-import-title">
            <header className="money-tool-heading">
                <FileSpreadsheet size={23} />
                <div>
                    <span className="eyebrow">CSV FALLBACK</span>
                    <h3 id="csv-import-title">Import an account the bank connection cannot reach</h3>
                    <p>Paste or drop a bank CSV. Duplicate rows are safely ignored; no credentials are uploaded.</p>
                </div>
            </header>
            <form className="csv-import-form" onSubmit={submit}>
                <label className={`csv-drop-zone ${dragging ? "dragging" : ""}`} onDragEnter={() => setDragging(true)} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropFile}>
                    <Upload size={19} />
                    <span>Drop a CSV here or choose a file</span>
                    <input type="file" accept=".csv,text/csv" onChange={(event) => readFile(event.target.files?.[0])} />
                </label>
                <textarea value={csv} onChange={(event) => setCsv(event.target.value)} placeholder={sample} aria-label="CSV data" required />
                <div className="csv-import-options">
                    <label>Source label<input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))} maxLength={41} /></label>
                    <label className="toggle-row"><span><strong>Reverse signs</strong><small>Use if your bank exports debits as positive.</small></span><input type="checkbox" checked={invert} onChange={(event) => setInvert(event.target.checked)} /></label>
                </div>
                <button className="button primary" type="submit" disabled={busy || !csv.trim()}>{busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />} Import transactions</button>
            </form>
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {!busy && !result && !error ? <div className="import-empty">Choose an export or paste its rows. We will check the columns before anything is imported.</div> : null}
            {result ? <div className="tool-success"><strong>{result.imported} imported</strong><span>{result.skipped_lines?.length ? `${result.skipped_lines.length} incomplete row(s) skipped.` : "Every valid row was processed."}</span></div> : null}
            {summary ? <div className="money-tool-summary"><span>Last 90 days</span><strong>${Number(summary.net || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} net</strong><small>{summary.transaction_count} transaction{summary.transaction_count === 1 ? "" : "s"} tracked</small></div> : null}
        </section>
    );
}
