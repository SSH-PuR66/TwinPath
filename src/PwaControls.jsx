import { Download, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DISMISS_KEY = "twinpath-install-prompt-dismissed";

function wasDismissed() {
    try {
        return window.localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
        return false;
    }
}

function dismissInstallPrompt() {
    try {
        window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
        // Storage can be unavailable in private browsing. The prompt still works.
    }
}

function isStandalone() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function PwaControls() {
    const [installEvent, setInstallEvent] = useState(null);
    const [waitingRegistration, setWaitingRegistration] = useState(null);
    const refreshingRef = useRef(false);

    useEffect(() => {
        if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return undefined;

        let active = true;
        let registration;

        const setWaitingWorker = (candidate) => {
            if (active && candidate.waiting && navigator.serviceWorker.controller) {
                setWaitingRegistration(candidate);
            }
        };

        const observeInstallingWorker = () => {
            const worker = registration?.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
                if (worker.state === "installed") setWaitingWorker(registration);
            });
        };

        const observeRegistration = (candidate) => {
            registration = candidate;
            setWaitingWorker(registration);
            registration.addEventListener("updatefound", observeInstallingWorker);
        };

        const registerServiceWorker = () => {
            navigator.serviceWorker.register("/sw.js", { scope: "/" })
                .then(observeRegistration)
                .catch((error) => console.error("Service worker registration failed:", error));
        };

        const onControllerChange = () => {
            if (refreshingRef.current) window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        if (document.readyState === "complete") registerServiceWorker();
        else window.addEventListener("load", registerServiceWorker, { once: true });

        return () => {
            active = false;
            window.removeEventListener("load", registerServiceWorker);
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            registration?.removeEventListener("updatefound", observeInstallingWorker);
        };
    }, []);

    useEffect(() => {
        if (isStandalone() || wasDismissed()) return undefined;

        const onBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setInstallEvent(event);
        };
        const onInstalled = () => setInstallEvent(null);

        window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    async function install() {
        if (!installEvent) return;
        const choice = await installEvent.prompt();
        if (choice?.outcome === "accepted") dismissInstallPrompt();
        setInstallEvent(null);
    }

    function update() {
        refreshingRef.current = true;
        waitingRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    }

    const isUpdate = Boolean(waitingRegistration);
    if (!isUpdate && !installEvent) return null;

    return (
        <aside className="pwa-action-prompt" role="status" aria-live="polite">
            <div className="pwa-action-icon">{isUpdate ? <RefreshCw size={19} /> : <Download size={19} />}</div>
            <div className="pwa-action-copy">
                <strong>{isUpdate ? "An update is ready" : "Install TwinPath"}</strong>
                <span>{isUpdate ? "Refresh when you are ready for the latest fixes. Your saved work stays here." : "Keep your shared planning space one tap away, with useful screens available between connections."}</span>
            </div>
            <div className="pwa-action-buttons">
                <button className="button primary" type="button" onClick={isUpdate ? update : install}>{isUpdate ? "Refresh" : "Install"}</button>
                {!isUpdate ? <button className="icon-button" type="button" onClick={() => { dismissInstallPrompt(); setInstallEvent(null); }} aria-label="Dismiss install prompt"><X size={18} /></button> : null}
            </div>
        </aside>
    );
}
