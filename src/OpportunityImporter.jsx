import { useState } from "react";
import {
    Bot,
    CheckCircle2,
    FileJson,
    Loader2,
    ShieldCheck,
} from "lucide-react";

import { supabase } from "./supabase";

function normalizeUrl(value) {
    try {
        const url = new URL(value);

        if (url.protocol !== "https:") {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
}

function validateProposal(input) {
    if (!input || typeof input !== "object") {
        throw new Error("The imported value must be a JSON object.");
    }

    const requiredStrings = [
        "title",
        "hypothesis",
        "targetCustomer",
        "offer",
    ];

    for (const field of requiredStrings) {
        if (
            typeof input[field] !== "string" ||
            !input[field].trim()
        ) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    const estimatedCost = Number(input.estimatedCost || 0);
    const expectedPrice = Number(input.expectedPrice || 0);
    const estimatedHours = Number(input.estimatedHours || 0);
    const score = Math.round(Number(input.score || 0));

    if (
        !Number.isFinite(estimatedCost) ||
        estimatedCost < 0 ||
        estimatedCost > 10
    ) {
        throw new Error(
            "Estimated cost must be between \$0 and \$10."
        );
    }

    if (
        !Number.isFinite(expectedPrice) ||
        expectedPrice < 0
    ) {
        throw new Error("Expected price is invalid.");
    }

    if (
        !Number.isFinite(estimatedHours) ||
        estimatedHours < 0
    ) {
        throw new Error("Estimated hours is invalid.");
    }

    if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100
    ) {
        throw new Error("Score must be between 0 and 100.");
    }

    const sourceUrls = Array.isArray(input.sourceUrls)
        ? input.sourceUrls
            .map(normalizeUrl)
            .filter(Boolean)
            .slice(0, 20)
        : [];

    const risks = Array.isArray(input.risks)
        ? input.risks
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    return {
        title: input.title.trim().slice(0, 180),
        hypothesis: input.hypothesis.trim().slice(0, 3000),
        target_customer:
            input.targetCustomer.trim().slice(0, 500),
        offer: input.offer.trim().slice(0, 2000),
        validation_method:
            String(input.validationMethod || "")
                .trim()
                .slice(0, 2000) || null,
        success_threshold:
            String(input.successThreshold || "")
                .trim()
                .slice(0, 1000) || null,
        stop_rule:
            String(input.stopRule || "")
                .trim()
                .slice(0, 1000) || null,
        estimated_hours: estimatedHours,
        estimated_cost: estimatedCost,
        expected_price: expectedPrice,
        source_urls: sourceUrls,
        risks,
        score,
        status: "proposed",
        visibility: "private",
    };
}

export default function OpportunityImporter({
    householdId,
    currentUserId,
    onImported,
}) {
    const [jsonText, setJsonText] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function importProposal(event) {
        event.preventDefault();

        setBusy(true);
        setError("");
        setMessage("");

        try {
            const parsed = JSON.parse(jsonText);
            const proposal = validateProposal(parsed);

            const { error: insertError } = await supabase
                .from("business_experiments")
                .insert({
                    ...proposal,
                    household_id: householdId,
                    owner_user_id: currentUserId,
                });

            if (insertError) {
                throw insertError;
            }

            setJsonText("");
            setMessage("Opportunity imported for review.");
            await onImported?.();
        } catch (importError) {
            setError(
                importError?.message ||
                "The opportunity could not be imported."
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="opportunity-importer">
            <div className="section-title">
                <div>
                    <span className="eyebrow">AI OPPORTUNITY INBOX</span>
                    <h3>Import Claude research</h3>
                    <p>
                        Claude proposes experiments. TwinPath validates and
                        stores them privately.
                    </p>
                </div>

                <Bot size={25} />
            </div>

            <form className="stack" onSubmit={importProposal}>
                <label className="field">
                    <span>Opportunity JSON</span>

                    <textarea
                        required
                        rows="12"
                        spellCheck="false"
                        value={jsonText}
                        onChange={(event) =>
                            setJsonText(event.target.value)
                        }
                        placeholder={`{
  "title": "Authorized cyber lab evidence pack",
  "hypothesis": "...",
  "targetCustomer": "...",
  "offer": "...",
  "estimatedCost": 0,
  "expectedPrice": 9,
  "estimatedHours": 6,
  "score": 82,
  "validationMethod": "...",
  "successThreshold": "...",
  "stopRule": "...",
  "sourceUrls": ["https://..."],
  "risks": ["..."]
}`}
                    />
                </label>

                {error && (
                    <div className="error-box">{error}</div>
                )}

                {message && (
                    <div className="success-box compact">
                        <CheckCircle2 size={18} />
                        <span>{message}</span>
                    </div>
                )}

                <button
                    className="button primary"
                    type="submit"
                    disabled={busy}
                >
                    {busy ? (
                        <Loader2 className="spin" size={17} />
                    ) : (
                        <FileJson size={17} />
                    )}

                    Validate and import
                </button>
            </form>

            <div className="warning-inline">
                <ShieldCheck size={18} />

                <span>
                    Importing a proposal does not authorize spending,
                    publishing, customer contact or financial activity.
                </span>
            </div>
        </section>
    );
}
