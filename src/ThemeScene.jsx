import { useEffect, useRef, useState } from "react";
import { resolveThemeKey, themes } from "./themeCatalog";

export function usePageHidden() {
    const [pageHidden, setPageHidden] = useState(
        typeof document !== "undefined" ? document.hidden : false
    );

    useEffect(() => {
        const updateVisibility = () => setPageHidden(document.hidden);
        document.addEventListener("visibilitychange", updateVisibility);
        return () => document.removeEventListener("visibilitychange", updateVisibility);
    }, []);

    return pageHidden;
}

function useEnergySavingMode() {
    const prefersSaving = () => {
        if (typeof navigator === "undefined") return false;
        const connection = navigator.connection;
        const memory = Number(navigator.deviceMemory);
        return Boolean(
            connection?.saveData
            || ["slow-2g", "2g"].includes(connection?.effectiveType)
            || (memory > 0 && memory <= 2)
        );
    };
    const [saving, setSaving] = useState(prefersSaving);

    useEffect(() => {
        const connection = navigator.connection;
        if (!connection?.addEventListener) return undefined;
        const update = () => setSaving(prefersSaving());
        connection.addEventListener("change", update);
        return () => connection.removeEventListener("change", update);
    }, []);

    return saving;
}

function LocalLottieLayer({ asset, motionOff }) {
    const element = useRef(null);

    useEffect(() => {
        if (!asset?.path || !element.current) return undefined;
        let cancelled = false;
        let animation;
        const schedule = window.requestIdleCallback
            ? (callback) => window.requestIdleCallback(callback, { timeout: 1500 })
            : (callback) => window.setTimeout(callback, 300);
        const cancelSchedule = window.cancelIdleCallback || window.clearTimeout;
        const idleId = schedule(() => Promise.all([
            import("lottie-web/build/player/lottie_light"),
            fetch(asset.path, { credentials: "same-origin" })
                .then((response) => response.ok ? response.json() : Promise.reject(new Error("Local theme asset is unavailable."))),
        ]).then(([{ default: lottie }, animationData]) => {
                if (cancelled || !element.current) return;
                animation = lottie.loadAnimation({
                    container: element.current,
                    renderer: "svg",
                    loop: !motionOff,
                    autoplay: !motionOff,
                    animationData,
                    rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
                });
                if (motionOff) animation.goToAndStop(0, true);
            }).catch(() => {}));
        return () => {
            cancelled = true;
            cancelSchedule(idleId);
            animation?.destroy();
        };
    }, [asset?.path, motionOff]);

    return <div className="theme-local-lottie" ref={element} aria-hidden="true" />;
}

function useLocalThemeAssets(enabled) {
    const [assets, setAssets] = useState([]);
    useEffect(() => {
        if (!enabled) {
            setAssets([]);
            return undefined;
        }
        let active = true;
        fetch("/themes/manifest.json", { credentials: "same-origin" })
            .then((response) => response.ok ? response.json() : null)
            .then((manifest) => {
                const records = Array.isArray(manifest?.assets) ? manifest.assets : [];
                if (active) setAssets(records.filter((asset) => asset?.enabled && /^\/themes\/assets\/[a-z0-9][a-z0-9-]*\.json$/i.test(asset.path || "")));
            })
            .catch(() => active && setAssets([]));
        return () => { active = false; };
    }, [enabled]);
    return assets;
}

function ThemeArtwork({ themeKey, motionOff = false, preview = false }) {
    const validThemeKey = resolveThemeKey(themeKey);
    const theme = themes[validThemeKey];
    const assets = useLocalThemeAssets(!preview && !motionOff);
    const localAsset = assets.find((asset) => asset.id === validThemeKey);
    const wallpaper = /^[a-z0-9][a-z0-9-]*\.webm$/i.test(theme.wallpaper || "") ? theme.wallpaper : null;

    return (
        <div
            className={`${preview ? "theme-preview" : "static-theme"} theme-${theme.scene} ${
                motionOff ? "theme-motion-off" : ""
            }`}
            aria-hidden="true"
            data-theme={validThemeKey}
            style={{
                "--accent": theme.accent,
                "--accent-2": theme.accent2,
                "--theme-background": theme.background,
                backgroundColor: theme.background,
                backgroundImage: [
                    `radial-gradient(circle at 18% 18%, ${theme.accent}55 0%, transparent 42%)`,
                    `radial-gradient(circle at 82% 26%, ${theme.accent2}4D 0%, transparent 40%)`,
                    `radial-gradient(circle at 50% 90%, ${theme.accent}24 0%, transparent 38%)`,
                    `linear-gradient(145deg, ${theme.background}, #04060b)`,
                ].join(", "),
            }}
        >
            {!preview && !motionOff && wallpaper ? <video className="theme-wallpaper" autoPlay muted loop playsInline preload="metadata" poster={`/wallpapers/${wallpaper.replace(/\.webm$/i, ".jpg")}`}><source src={`/wallpapers/${wallpaper}`} type="video/webm" /></video> : null}
            <span className="theme-layer theme-layer-one" />
            <span className="theme-layer theme-layer-two" />
            <span className="theme-layer theme-layer-three" />
            {!preview && !motionOff && localAsset ? <LocalLottieLayer asset={localAsset} motionOff={motionOff} /> : null}
        </div>
    );
}

export function ThemePreview({ themeKey, motionOff = false }) {
    return <ThemeArtwork themeKey={themeKey} motionOff={motionOff} preview />;
}

export default function ThemeScene({
    themeKey = "aurora",
    reducedMotion = false,
    privateMode = false,
}) {
    const pageHidden = usePageHidden();
    const energySaving = useEnergySavingMode();

    return (
        <ThemeArtwork
            themeKey={themeKey}
            motionOff={reducedMotion || privateMode || pageHidden || energySaving}
        />
    );
}
