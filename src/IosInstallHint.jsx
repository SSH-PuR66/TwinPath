import { Plus, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "twinpath-ios-install-hint-dismissed";

function isIosSafari() {
    const userAgent = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return isIOS && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isDismissed() {
    try {
        return window.localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
        return false;
    }
}

export default function IosInstallHint() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isDismissed() || !isIosSafari() || isStandalone()) return;
        const timer = window.setTimeout(() => setVisible(true), 1200);
        return () => window.clearTimeout(timer);
    }, []);

    function dismiss() {
        try {
            window.localStorage.setItem(DISMISS_KEY, "true");
        } catch {
            // Private browsing can deny storage; the hint can still be closed for this visit.
        }
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <aside className="ios-install-hint" aria-label="Add TwinPath to your Home Screen">
            <div className="ios-install-hint-icon"><Share2 size={19} /></div>
            <div>
                <strong>Add TwinPath to your Home Screen</strong>
                <span>Tap Share <Share2 size={14} /> then <b>Add to Home Screen</b> <Plus size={14} /> for the full-screen app.</span>
            </div>
            <button className="icon-button" type="button" onClick={dismiss} aria-label="Dismiss install hint"><X size={18} /></button>
        </aside>
    );
}
