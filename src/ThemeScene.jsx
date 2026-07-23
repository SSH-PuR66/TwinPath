import { useEffect, useRef, useState } from "react";
import lottie from "lottie-web";
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

function LocalLottieLayer({ asset, motionOff }) {
    const element = useRef(null);

    useEffect(() => {
        if (!asset?.path || !element.current) return undefined;
        let cancelled = false;
        let animation;
        fetch(asset.path, { credentials: "same-origin" })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error("Local theme asset is unavailable.")))
            .then((animationData) => {
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
            })
            .catch(() => {});
        return () => {
            cancelled = true;
            animation?.destroy();
        };
    }, [asset?.path, motionOff]);

    return <div className="theme-local-lottie" ref={element} aria-hidden="true" />;
}

function useLocalThemeAssets() {
    const [assets, setAssets] = useState([]);
    useEffect(() => {
        let active = true;
        fetch("/themes/manifest.json", { credentials: "same-origin" })
            .then((response) => response.ok ? response.json() : null)
            .then((manifest) => {
                const records = Array.isArray(manifest?.assets) ? manifest.assets : [];
                if (active) setAssets(records.filter((asset) => asset?.enabled && /^\/themes\/assets\/[a-z0-9][a-z0-9-]*\.json$/i.test(asset.path || "")));
            })
            .catch(() => active && setAssets([]));
        return () => { active = false; };
    }, []);
    return assets;
}

function ThemeArtwork({ themeKey, motionOff = false, preview = false }) {
    const validThemeKey = resolveThemeKey(themeKey);
    const theme = themes[validThemeKey];
    const assets = useLocalThemeAssets();
    const localAsset = assets.find((asset) => asset.id === validThemeKey);

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
            <span className="theme-layer theme-layer-one" />
            <span className="theme-layer theme-layer-two" />
            <span className="theme-layer theme-layer-three" />
            {!preview && localAsset ? <LocalLottieLayer asset={localAsset} motionOff={motionOff} /> : null}
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

    return (
        <ThemeArtwork
            themeKey={themeKey}
            motionOff={reducedMotion || privateMode || pageHidden}
        />
    );
}
