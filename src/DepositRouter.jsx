import { useState } from "react";
import { ArrowRight, Landmark, Loader2, Sparkles } from "lucide-react";
import { useControlPlane } from "./useControlPlane";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function DepositRouter({ householdId, onToast }) {
    const { request, configured } = useControlPlane(householdId);
    const [amount, setAmount] = useState("");
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function route(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const payload = await request("/v1/financial/allocate", {
                method: "POST",
                body: JSON.stringify({ amount: Number(amount) }),
            });
            setResult(payload);
            onToast?.("A suggested deposit plan is ready. You stay in control of every transfer.");
        } catch (routeError) {
            setError(routeError.message);
        } finally {
            setBusy(false);
        }
    }

    if (!configured) return null;
    return (
        <section className="deposit-router" aria-labelledby="deposit-router-title">
            <header><Sparkles size={21} /><div><span className="eyebrow">DEPOSIT ROUTER</span><h3 id="deposit-router-title">Give new income a calm next step</h3></div></header>
            <p>Get an explained default split. TwinPath never transfers money or opens an account for you.</p>
            <form onSubmit={route} className="deposit-router-form">
                <label>Deposit amount<input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25.00" required /></label>
                <button className="button primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Landmark size={16} />} Show my plan</button>
            </form>
            {error ? <div className="error-box" role="alert">{error}</div> : null}
            {result ? <div className="deposit-steps"><strong>{money.format(result.amount)} suggested split</strong>{result.steps.map((step) => <div key={step.bucket}><ArrowRight size={15} /><span><b>{step.bucket.replaceAll("_", " ")}: {money.format(step.amount)}</b><small>{step.why}</small></span></div>)}<p className="muted">{result.disclaimer}</p></div> : null}
        </section>
    );
}
