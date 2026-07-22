import { useEffect, useState } from "react";
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

function ThemeArtwork({ themeKey, motionOff = false, preview = false }) {
    const validThemeKey = resolveThemeKey(themeKey);
    const theme = themes[validThemeKey];

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
