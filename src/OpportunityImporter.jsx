import { useMemo, useState } from "react";

import {
    Bot,
    CheckCircle2,
    ClipboardPaste,
    FileJson,
    Loader2,
    RotateCcw,
    ShieldCheck,
} from "lucide-react";

import { supabase } from "./supabase";
import { safeExternalUrl } from "./safeUrl";

const MAX_JSON_LENGTH = 50_000;

const ALLOWED_FIELDS = new Set([
    "title",
    "hypothesis",
    "targetCustomer",
    "offer",
    "estimatedCost",
    "expectedPrice",
    "estimatedHours",
    "score",
    "validationMethod",
    "successThreshold",
    "stopRule",
    "sourceUrls",
    "risks",
]);

const SAMPLE_PROPOSAL = {
    title: "Authorized cyber lab evidence pack",
    hypothesis:
        "Cybersecurity students may pay for an original system that helps them organize authorized lab notes, screenshots, findings, remediation, and portfolio-safe summaries.",
    targetCustomer:
        "Cybersecurity students completing authorized labs",
    offer:
        "An original editable evidence register, screenshot index, finding template, redaction checklist, and portfolio publishing workflow.",
    estimatedCost: 0,
    expectedPrice: 9,
    estimatedHours: 6,
    score: 75,
    validationMethod:
        "Publish a free local-only lab report formatter and measure qualified visits, completions, product clicks, and verified purchases.",
    successThreshold:
        "At least 10 product clicks from 100 qualified visitors or 3 verified purchases.",
    stopRule:
        "Pause or redesign after 100 qualified visitors if fewer than 5 visitors click the product page.",
    sourceUrls: [],
    risks: [
        "Demand has not yet been verified.",
        "The product must contain only original material.",
        "Users must test only systems they are authorized to test.",
    ],
};

function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
        prototype === Object.prototype ||
        prototype === null
    );
}

function stripMarkdownFence(value) {
    const trimmed = String(value || "").trim();

    const match = trimmed.match(
        /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );

    return match ? match[1].trim() : trimmed;
}

function cleanText(value, maximumLength) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .trim()
        .slice(0, maximumLength);
}

function requireText(input, field, maximumLength) {
    const result = cleanText(
        input[field],
        maximumLength
    );

    if (!result) {
        throw new Error(
            `Missing or invalid required field: ${field}`
        );
    }

    return result;
}

function optionalText(value, maximumLength) {
    const result = cleanText(value, maximumLength);
    return result || null;
}

function validateNumber(
    value,
    {
        field,
        minimum = 0,
        maximum,
        integer = false,
    }
) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 0;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw new Error(
            `${field} must be a valid number.`
        );
    }

    if (
        number < minimum ||
        number > maximum
    ) {
        throw new Error(
            `${field} must be between ${minimum} and ${maximum}.`
        );
    }

    return integer ? Math.round(number) : number;
}

function normalizeSourceUrl(value) {
    const url = safeExternalUrl(value, {
        allowLocalHttp: false,
    });

    if (!url) return null;

    try {
        const parsed = new URL(url);

        if (
            parsed.protocol !== "https:" ||
            parsed.username ||
            parsed.password
        ) {
            return null;
        }

        const hostname =
            parsed.hostname.toLowerCase();

        const blocked =
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname.endsWith(".local") ||
            hostname.endsWith(".internal") ||
            /^10\./.test(hostname) ||
            /^192\.168\./.test(hostname) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(
                hostname
            );

        if (blocked) return null;

        parsed.hash = "";

        return parsed.toString();
    } catch {
        return null;
    }
}

function normalizeSourceUrls(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new Error(
            "sourceUrls must be an array."
        );
    }

    const supplied = value.slice(0, 20);

    const valid = [
        ...new Set(
            supplied
                .map(normalizeSourceUrl)
                .filter(Boolean)
        ),
    ];

    if (supplied.length && !valid.length) {
        throw new Error(
            "No valid public HTTPS source URLs were provided."
        );
    }

    return valid;
}

function normalizeRisks(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new Error("risks must be an array.");
    }

    return [
        ...new Set(
            value
                .filter(
                    (item) => typeof item === "string"
                )
                .map((item) => cleanText(item, 500))
                .filter(Boolean)
                .slice(0, 20)
        ),
    ];
}

function validateProposal(input) {
    if (!isPlainObject(input)) {
        throw new Error(
            "The imported JSON must contain one proposal object."
        );
    }

    const unknownFields = Object.keys(
        input
    ).filter(
        (field) => !ALLOWED_FIELDS.has(field)
    );

    if (unknownFields.length) {
        throw new Error(
            `Unsupported field${unknownFields.length === 1 ? "" : "s"
            }: ${unknownFields.join(", ")}`
        );
    }

    return {
        title: requireText(
            input,
            "title",
            180
        ),

        hypothesis: requireText(
            input,
            "hypothesis",
            3000
        ),

        target_customer: requireText(
            input,
            "targetCustomer",
            500
        ),

        offer: requireText(
            input,
            "offer",
            2000
        ),

        validation_method: optionalText(
            input.validationMethod,
            2000
        ),

        success_threshold: optionalText(
            input.successThreshold,
            1000
        ),

        stop_rule: optionalText(
            input.stopRule,
            1000
        ),

        estimated_cost: validateNumber(
            input.estimatedCost,
            {
                field: "estimatedCost",
                minimum: 0,
                maximum: 10,
            }
        ),

        expected_price: validateNumber(
            input.expectedPrice,
            {
                field: "expectedPrice",
                minimum: 0,
                maximum: 100_000,
            }
        ),

        estimated_hours: validateNumber(
            input.estimatedHours,
            {
                field: "estimatedHours",
                minimum: 0,
                maximum: 10_000,
            }
        ),

        score: validateNumber(input.score, {
            field: "score",
            minimum: 0,
            maximum: 100,
            integer: true,
        }),

        source_urls: normalizeSourceUrls(
            input.sourceUrls
        ),

        risks: normalizeRisks(input.risks),

        status: "proposed",
        visibility: "private",
    };
}

function explainSupabaseError(error) {
    const message =
        error?.message ||
        "The opportunity could not be imported.";

    const normalized = message.toLowerCase();

    if (
        normalized.includes("schema cache") ||
        normalized.includes(
            "could not find the table"
        )
    ) {
        return (
            "The Opportunity Lab table is unavailable. " +
            "Run supabase/v5-opportunity-lab.sql, then run: " +
            "notify pgrst, 'reload schema';"
        );
    }

    if (
        normalized.includes(
            "row-level security"
        )
    ) {
        return (
            "Supabase rejected this import under its privacy rules. " +
            "Confirm the account belongs to the household and that " +
            "the Opportunity Lab RLS policies are installed."
        );
    }

    if (
        normalized.includes(
            "violates check constraint"
        )
    ) {
        return (
            "A proposal value exceeds the database limits. " +
            "Review its cost, price, hours, score, and text lengths."
        );
    }

    return message;
}

async function readClipboard() {
    if (!navigator.clipboard?.readText) {
        throw new Error(
            "Clipboard reading is unavailable. Paste the JSON manually."
        );
    }

    return navigator.clipboard.readText();
}

export default function OpportunityImporter({
    householdId,
    currentUserId,
    onImported,
}) {
    const [jsonText, setJsonText] =
        useState("");

    const [busy, setBusy] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");

    const preview = useMemo(() => {
        if (!jsonText.trim()) {
            return {
                valid: false,
                proposal: null,
                error: "",
            };
        }

        if (
            jsonText.length > MAX_JSON_LENGTH
        ) {
            return {
                valid: false,
                proposal: null,
                error:
                    `Maximum length is ${MAX_JSON_LENGTH.toLocaleString()} characters.`,
            };
        }

        try {
            const parsed = JSON.parse(
                stripMarkdownFence(jsonText)
            );

            return {
                valid: true,
                proposal: validateProposal(parsed),
                error: "",
            };
        } catch (validationError) {
            return {
                valid: false,
                proposal: null,
                error:
                    validationError?.message ||
                    "The proposal JSON is invalid.",
            };
        }
    }, [jsonText]);

    function clearMessages() {
        setMessage("");
        setError("");
    }

    function loadSample() {
        clearMessages();

        setJsonText(
            JSON.stringify(
                SAMPLE_PROPOSAL,
                null,
                2
            )
        );
    }

    async function pasteProposal() {
        clearMessages();

        try {
            const text = await readClipboard();

            if (!text.trim()) {
                throw new Error(
                    "The clipboard is empty."
                );
            }

            if (
                text.length > MAX_JSON_LENGTH
            ) {
                throw new Error(
                    "The clipboard content is too large."
                );
            }

            setJsonText(text);
        } catch (clipboardError) {
            setError(
                clipboardError?.message ||
                "TwinPath could not read the clipboard."
            );
        }
    }

    async function importProposal(event) {
        event.preventDefault();

        if (busy) return;

        clearMessages();

        if (!householdId || !currentUserId) {
            setError(
                "The current account or household could not be identified."
            );
            return;
        }

        if (!preview.valid) {
            setError(
                preview.error ||
                "Enter a valid proposal."
            );
            return;
        }

        setBusy(true);

        try {
            const proposal = preview.proposal;

            const { data: duplicateRows, error: lookupError } =
                await supabase
                    .from("business_experiments")
                    .select("id")
                    .eq("household_id", householdId)
                    .eq("owner_user_id", currentUserId)
                    .ilike("title", proposal.title)
                    .limit(1);

            if (lookupError) {
                throw lookupError;
            }

            if (
                Array.isArray(duplicateRows) &&
                duplicateRows.length
            ) {
                throw new Error(
                    "An opportunity with this title already exists."
                );
            }

            const {
                data: inserted,
                error: insertError,
            } = await supabase
                .from("business_experiments")
                .insert({
                    ...proposal,
                    household_id: householdId,
                    owner_user_id: currentUserId,
                })
                .select("id,title,score,status")
                .single();

            if (insertError) {
                throw insertError;
            }

            setJsonText("");

            setMessage(
                `"${inserted.title}" was imported privately with a score of ${inserted.score}/100.`
            );

            try {
                await onImported?.(inserted);
            } catch (refreshError) {
                console.error(
                    "Opportunity imported, but refresh failed:",
                    refreshError
                );
            }
        } catch (importError) {
            setError(
                explainSupabaseError(importError)
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="opportunity-importer">
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        AI OPPORTUNITY INBOX
                    </span>

                    <h3>
                        Import reviewed AI research
                    </h3>

                    <p>
                        Paste one structured proposal.
                        TwinPath validates it and stores it
                        privately for review.
                    </p>
                </div>

                <Bot size={25} />
            </div>

            <div className="opportunity-importer-actions">
                <button
                    className="button secondary"
                    type="button"
                    onClick={pasteProposal}
                    disabled={busy}
                >
                    <ClipboardPaste size={16} />
                    Paste
                </button>

                <button
                    className="button ghost"
                    type="button"
                    onClick={loadSample}
                    disabled={busy}
                >
                    <FileJson size={16} />
                    Sample
                </button>

                <button
                    className="button ghost"
                    type="button"
                    onClick={() => {
                        clearMessages();
                        setJsonText("");
                    }}
                    disabled={busy || !jsonText}
                >
                    <RotateCcw size={16} />
                    Clear
                </button>
            </div>

            <form
                className="stack"
                onSubmit={importProposal}
            >
                <label className="field">
                    <span>Opportunity JSON</span>

                    <textarea
                        required
                        rows="14"
                        maxLength={MAX_JSON_LENGTH}
                        spellCheck="false"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={jsonText}
                        onChange={(event) => {
                            setJsonText(
                                event.target.value
                            );

                            clearMessages();
                        }}
                        aria-describedby="opportunity-json-status"
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

                <div
                    id="opportunity-json-status"
                    className="opportunity-importer-status"
                >
                    <span>
                        {jsonText.length.toLocaleString()}
                        {" / "}
                        {MAX_JSON_LENGTH.toLocaleString()}
                    </span>

                    {jsonText.trim() && (
                        <span
                            className={
                                preview.valid
                                    ? "valid"
                                    : "invalid"
                            }
                        >
                            {preview.valid
                                ? "JSON validated"
                                : preview.error}
                        </span>
                    )}
                </div>

                {preview.valid && (
                    <div className="opportunity-preview">
                        <div>
                            <span>Title</span>
                            <strong>
                                {preview.proposal.title}
                            </strong>
                        </div>

                        <div>
                            <span>Score</span>
                            <strong>
                                {preview.proposal.score}/100
                            </strong>
                        </div>

                        <div>
                            <span>Cost</span>
                            <strong>
                                $
                                {preview.proposal
                                    .estimated_cost}
                            </strong>
                        </div>

                        <div>
                            <span>Price</span>
                            <strong>
                                $
                                {preview.proposal
                                    .expected_price}
                            </strong>
                        </div>
                    </div>
                )}

                {error && (
                    <div
                        className="error-box"
                        role="alert"
                    >
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

                <button
                    className="button primary"
                    type="submit"
                    disabled={
                        busy ||
                        !preview.valid ||
                        !householdId ||
                        !currentUserId
                    }
                >
                    {busy ? (
                        <Loader2
                            className="spin"
                            size={17}
                        />
                    ) : (
                        <FileJson size={17} />
                    )}

                    {busy
                        ? "Importing…"
                        : "Validate and import privately"}
                </button>
            </form>

            <div className="warning-inline">
                <ShieldCheck size={18} />

                <span>
                    Importing research does not authorize
                    spending, publishing, customer contact,
                    application submission, or financial
                    activity. Verify every source and claim
                    before acting.
                </span>
            </div>
        </section>
    );
}
