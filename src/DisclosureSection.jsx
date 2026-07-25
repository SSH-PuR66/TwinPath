import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

function storageKey(id) {
    return `twinpath-disclosure-${id}`;
}

function readStored(id) {
    try {
        const raw = localStorage.getItem(storageKey(id));
        if (raw === "open") return true;
        if (raw === "closed") return false;
    } catch (storageError) {
        // Private browsing or a locked-down webview — fall back to the default.
    }
    return null;
}

function isNarrow() {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(max-width: 480px)").matches);
}

/**
 * A real disclosure: an aria-expanded button, not a div with a click handler.
 * Collapse state persists per section in localStorage. Children mount on the
 * first open and stay mounted, so a collapsed section never pays for a fetch
 * it may never need.
 */
export default function DisclosureSection({
    id,
    title,
    hint,
    defaultOpen = true,
    collapseOnPhone = false,
    children,
}) {
    const [open, setOpen] = useState(() => {
        const stored = readStored(id);
        if (stored !== null) return stored;
        if (collapseOnPhone && isNarrow()) return false;
        return defaultOpen;
    });
    const [everOpen, setEverOpen] = useState(open);
    const panelId = `${useId()}-panel`;

    useEffect(() => {
        if (open) setEverOpen(true);
    }, [open]);

    const toggle = useCallback(() => {
        setOpen((current) => {
            const next = !current;
            try {
                localStorage.setItem(storageKey(id), next ? "open" : "closed");
            } catch (storageError) {
                // Nothing to do — the section still opens for this session.
            }
            return next;
        });
    }, [id]);

    return (
        <section className="disclosure-section" data-open={open ? "yes" : "no"}>
            <button
                type="button"
                className="disclosure-summary"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={toggle}
            >
                <span className="disclosure-heading">
                    <span className="disclosure-title">{title}</span>
                    {hint ? <span className="disclosure-hint">{hint}</span> : null}
                </span>

                <ChevronDown className="disclosure-chevron" size={18} aria-hidden="true" />
            </button>

            <div className="disclosure-panel" id={panelId} hidden={!open}>
                {everOpen ? children : null}
            </div>
        </section>
    );
}
