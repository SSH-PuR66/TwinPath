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

const REQUIRED_STRING_FIELDS = [
    "title",
    "hypothesis",
    "targetCustomer",
    "offer",
];

const PRIVATE_OR_LOCAL_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::1$/i,
    /^fc[0-9a-f]{2}:/i,
    /^fd[0-9a-f]{2}:/i,
    /\.local$/i,
    /\.internal$/i,
];

const SAMPLE_PROPOSAL = {
    title: "Authorized cyber lab evidence pack",
    hypothesis:
        "Cybersecurity students may pay for an original system that helps them organize authorized lab notes, screenshots, findings, remediation, and portfolio-safe summaries.",
    targetCustomer:
        "First- and second-year cybersecurity students completing authorized labs",
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
        "Users must test only systems for which they have explicit authorization.",
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

function removeMarkdownCodeFence(value) {
    const trimmed = String(value || "").trim();

    const fencedMatch = trimmed.match(
        /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    );

    return fencedMatch
        ? fencedMatch[1].trim()
        : trimmed;
}

function cleanText(value, maximumLength) {
    return String(value ?? "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .trim()
        .slice(0, maximumLength);
}

function requireText(input, field, maximumLength) {
    if (
        typeof input[field] !== "string" ||
        !input[field].trim()
    ) {
        throw new Error(
            `Missing or invalid required field: ${field}`
        );
    }

    return cleanText(input[field], maximumLength);
}

function optionalText(value, maximumLength) {
    const result = cleanText(value, maximumLength);

    return result || null;
}

function finiteNumber(
    value,
    {
        field,
        minimum = 0,
        maximum = Number.MAX_SAFE_INTEGER,
        integer = false,
    }
) {
    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return 0;
    }

    const result = Number(value);

    if (!Number.isFinite(result)) {
        throw new Error(`${field} must be a valid number.`);
    }

    if (result < minimum || result > maximum) {
        throw new Error(
            `${field} must be between ${minimum} and ${maximum}.`
        );
    }

    return integer ? Math.round(result) : result;
}

function isPrivateOrLocalHostname(hostname) {
    return PRIVATE_OR_LOCAL_HOST_PATTERNS.some((pattern) =>
        pattern.test(hostname)
    );
}

function normalizeSourceUrl(value) {
    if (typeof value !== "string") {
        return null;
    }

    const safeUrl = safeExternalUrl(value, {
        allowLocalHttp: false,
    });

    if (!safeUrl) {
        return null;
    }

    try {
        const url = new URL(safeUrl);

        if (url.protocol !== "https:") {
            return null;
        }

        if (url.username || url.password) {
            return null;
        }

        if (isPrivateOrLocalHostname(url.hostname)) {
            return null;
        }

        url.hash = "";

        return url.toString();
    } catch {
        return null;
    }
}

function normalizeSourceUrls(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new Error("sourceUrls must be an array.");
    }

    const suppliedValues = value.slice(0, 20);

    const validUrls = suppliedValues
        .map(normalizeSourceUrl)
        .filter(Boolean);

    const uniqueUrls = [...new Set(validUrls)];

    if (
        suppliedValues.length > 0 &&
        uniqueUrls.length === 0
    ) {
        throw new Error(
            "No valid public HTTPS source URLs were provided."
        );
    }

    return uniqueUrls;
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
                .filter((item) => typeof item === "string")
                .map((item) => cleanText(item, 500))
                .filter(Boolean)
                .slice(0, 20)
        ),
    ];
}

function validateKnownFields(input) {
    const unknownFields = Object.keys(input).filter(
        (field) => !ALLOWED_FIELDS.has(field)
    );

    if (unknownFields.length) {
        throw new Error(
            `Unsupported field${unknownFields.length === 1 ? "" : "s"
            }: ${unknownFields.join(", ")}`
        );
    }
}

function validateProposal(input) {
    if (!isPlainObject(input)) {
        throw new Error(
            "The imported JSON must contain one proposal object."
        );
    }

    validateKnownFields(input);

    for (const field of REQUIRED_STRING_FIELDS) {
        if (
            typeof input[field] !== "string" ||
            !input[field].trim()
        ) {
            throw new Error(
                `Missing or invalid required field: ${field}`
            );
        }
    }

    const estimatedCost = finiteNumber(
        input.estimatedCost,
        {
            field: "estimatedCost",
            minimum: 0,
            maximum: 10,
        }
    );

    const expectedPrice = finiteNumber(
        input.expectedPrice,
        {
            field: "expectedPrice",
            minimum: 0,
            maximum: 100_000,
        }
    );

    const estimatedHours = finiteNumber(
        input.estimatedHours,
        {
            field: "estimatedHours",
            minimum: 0,
            maximum: 10_000,
        }
    );

    const score = finiteNumber(input.score, {
        field: "score",
        minimum: 0,
        maximum: 100,
        integer: true,
    });

    return {
        title: requireText(input, "title", 180),
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
        offer: requireText(input, "offer", 2000),

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

        estimated_hours: estimatedHours,
        estimated_cost: estimatedCost,
        expected_price: expectedPrice,

        source_urls: normalizeSourceUrls(
            input.sourceUrls
        ),

        risks: normalizeRisks(input.risks),

        score,
        status: "proposed",
        visibility: "private",
    };
}

function explainSupabaseError(error) {
    const message =
        error?.message ||
        "The opportunity could not be imported.";

    const normalizedMessage = message.toLowerCase();

    if (
        normalizedMessage.includes(
            "could not find the table"
        ) &&
        normalizedMessage.includes(
            "business_experiments"
        )
    ) {
        return (
            "The Opportunity Lab database migration is missing. " +
            "Run supabase/v5-opportunity-lab.sql in the connected " +
            "Supabase project, then reload the schema."
        );
    }

    if (
        normalizedMessage.includes("schema cache") &&
        normalizedMessage.includes(
            "business_experiments"
        )
    ) {
        return (
            "Supabase has not loaded the Opportunity Lab schema. " +
            "Run: notify pgrst, 'reload schema';"
        );
    }

    if (
        normalizedMessage.includes(
            "row-level security"
        )
    ) {
        return (
            "Supabase rejected the import under its privacy policy. " +
            "Confirm that this account belongs to the household and " +
            "that the Opportunity Lab RLS policies are installed."
        );
    }

    if (
        normalizedMessage.includes(
            "violates check constraint"
        )
    ) {
        return (
            "The proposal contains a value outside the database limits. " +
            "Review its cost, price, hours, score, and text lengths."
        );
    }

    return message;
}

function proposalFingerprint(proposal) {
    return JSON.stringify({
        title: proposal.title.toLowerCase(),
        target_customer:
            proposal.target_customer.toLowerCase(),
        offer: proposal.offer.toLowerCase(),
    });
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

    const characterCount = jsonText.length;

    const parsedPreview = useMemo(() => {
        if (!jsonText.trim()) {
            return {
                valid: false,
                proposal: null,
                error: "",
            };
        }

        if (jsonText.length > MAX_JSON_LENGTH) {
            return {
                valid: false,
                proposal: null,
                error:
                    `The import exceeds the ${MAX_JSON_LENGTH.toLocaleString()}-character limit.`,
            };
        }

        try {
            const cleaned = removeMarkdownCodeFence(
                jsonText
            );

            const parsed = JSON.parse(cleaned);
            const proposal = validateProposal(parsed);

            return {
                valid: true,
                proposal,
                error: "",
            };
        } catch (previewError) {
            return {
                valid: false,
                proposal: null,
                error:
                    previewError?.message ||
                    "The proposal JSON is invalid.",
            };
        }
    }, [jsonText]);

    function resetFeedback() {
        setError("");
        setMessage("");
    }

    function loadSample() {
        resetFeedback();

        setJsonText(
            JSON.stringify(SAMPLE_PROPOSAL, null, 2)
        );
    }

    function clearEditor() {
        resetFeedback();
        setJsonText("");
    }

    async function pasteFromClipboard() {
        resetFeedback();

        if (!navigator.clipboard?.readText) {
            setError(
                "Clipboard reading is unavailable. Paste the JSON into the editor manually."
            );
            return;
        }

        try {
            const clipboardText =
                await navigator.clipboard.readText();

            if (!clipboardText.trim()) {
                setError("The clipboard is empty.");
                return;
            }

            if (
                clipboardText.length > MAX_JSON_LENGTH
            ) {
                setError(
                    `The clipboard content exceeds the ${MAX_JSON_LENGTH.toLocaleString()}-character limit.`
                );
                return;
            }

            setJsonText(clipboardText);
        } catch {
            setError(
                "TwinPath could not read the clipboard. Paste the JSON manually."
            );
        }
    }

    async function importProposal(event) {
        event.preventDefault();

        if (busy) return;

        resetFeedback();

        if (!householdId || !currentUserId) {
            setError(
                "The current account or household could not be identified."
            );
            return;
        }

        if (!parsedPreview.valid) {
            setError(
                parsedPreview.error ||
                "Enter a valid proposal before importing."
            );
            return;
        }

        setBusy(true);

        try {
            const proposal = parsedPreview.proposal;

            /*
             * A lightweight duplicate check prevents accidental
             * double-imports caused by repeated taps. Database RLS
             * remains the authoritative access control.
             */
            const { data: existingRows, error: lookupError } =
                await supabase
                    .from("business_experiments")
                    .select(
                        "id,title,target_customer,offer"
                    )
                    .eq("household_id", householdId)
                    .eq("owner_user_id", currentUserId)
                    .limit(100);

            if (lookupError) {
                throw lookupError;
            }

            const incomingFingerprint =
                proposalFingerprint(proposal);

            const duplicate = (
                Array.isArray(existingRows)
                    ? existingRows
                    : []
            ).some((item) => {
                return (
                    proposalFingerprint({
                        title: item.title || "",
                        target_customer:
                            item.target_customer || "",
                        offer: item.offer || "",
                    }) === incomingFingerprint
                );
            });

            if (duplicate) {
                throw new Error(
                    "This opportunity already appears in your private experiment list."
                );
            }

            const {
                data: insertedRecord,
                error: insertError,
            } = await supabase
                .from("business_experiments")
                .insert({
                    ...proposal,
                    household_id: householdId,
                    owner_user_id: currentUserId,
                })
                .select("id,title,status,score")
                .single();

            if (insertError) {
                throw insertError;
            }

            setJsonText("");

            setMessage(
                `"${insertedRecord.title}" was imported privately with a score of ${insertedRecord.score}.`
            );

            /*
             * The database insert has already succeeded. A parent
             * refresh failure must not incorrectly report that the
             * proposal itself failed to import.
             */
            try {
                await onImported?.(insertedRecord);
            } catch (refreshError) {
                console.error(
                    "Opportunity imported, but parent refresh failed:",
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

                    <h3>Import reviewed AI research</h3>

                    <p>
                        Paste one structured proposal. TwinPath validates
                        it and stores it privately for human review.
                    </p>
                </div>

                <Bot size={25} />
            </div>

            <div className="opportunity-importer-actions">
                <button
                    className="button secondary"
                    type="button"
                    onClick={pasteFromClipboard}
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
                    Load sample
                </button>

                <button
                    className="button ghost"
                    type="button"
                    onClick={clearEditor}
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
                        spellCheck="false"
                        autoCapitalize="none"
                        autoCorrect="off"
                        maxLength={MAX_JSON_LENGTH}
                        value={jsonText}
                        onChange={(event) => {
                            setJsonText(event.target.value);
                            resetFeedback();
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
                        {characterCount.toLocaleString()} /{" "}
                        {MAX_JSON_LENGTH.toLocaleString()}
                    </span>

                    {jsonText.trim() && (
                        <span
                            className={
                                parsedPreview.valid
                                    ? "valid"
                                    : "invalid"
                            }
                        >
                            {parsedPreview.valid
                                ? "JSON validated"
                                : parsedPreview.error}
                        </span>
                    )}
                </div>

                {parsedPreview.valid && (
                    <div className="opportunity-preview">
                        <div>
                            <span>Title</span>
                            <strong>
                                {parsedPreview.proposal.title}
                            </strong>
                        </div>

                        <div>
                            <span>Score</span>
                            <strong>
                                {parsedPreview.proposal.score}/100
                            </strong>
                        </div>

                        <div>
                            <span>Estimated cost</span>
                            <strong>
                                $
                                {parsedPreview.proposal
                                    .estimated_cost}
                            </strong>
                        </div>

                        <div>
                            <span>Expected price</span>
                            <strong>
                                $
                                {parsedPreview.proposal
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
                        !parsedPreview.valid ||
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
                    Imported research is not permission to spend,
                    publish, contact customers, submit applications,
                    or perform financial activity. Verify sources and
                    claims before acting.
                </span>
            </div>
        </section>
    );
}
