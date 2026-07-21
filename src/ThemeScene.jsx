import { useEffect, useState } from "react";

export const themes = {
    campus: {
        name: "Campus",
        background: "#0b1513",
        accent: "#8ce0bd",
        accent2: "#e6b86a",
        scene: "campus",
    },
    "midnight-ledger": {
        name: "Midnight Ledger",
        background: "#060a12",
        accent: "#7bdcb5",
        accent2: "#7e9cff",
        scene: "ledger",
    },
    "aurora-grid": {
        name: "Aurora Grid",
        background: "#07101c",
        accent: "#65e8ff",
        accent2: "#9b7cff",
        scene: "aurora-grid",
    },
    aurora: {
        name: "Aurora Glass",
        background: "#07111f",
        accent: "#65e8ff",
        accent2: "#8b7cff",
        scene: "aurora",
    },
    orbit: {
        name: "Midnight Orbit",
        background: "#05070d",
        accent: "#d8e2ff",
        accent2: "#487dff",
    },
    rose: {
        name: "Rose Nebula",
        background: "#170817",
        accent: "#ff79bd",
        accent2: "#ffbf69",
    },
    ocean: {
        name: "Ocean Pearl",
        background: "#041617",
        accent: "#52e0cf",
        accent2: "#b8fff5",
    },
    cyber: {
        name: "Cyber Grid",
        background: "#03070c",
        accent: "#00e5ff",
        accent2: "#2d65ff",
    },
    sunrise: {
        name: "Sunrise Home",
        background: "#21130f",
        accent: "#ffb16e",
        accent2: "#ffe2a8",
    },
};

const sceneClasses = {
    campus: "theme-campus",
    ledger: "theme-ledger",
    "aurora-grid": "theme-aurora-grid",
    grid: "theme-grid",
    aurora: "theme-aurora",
};

export default function ThemeScene({
    themeKey = "aurora",
    reducedMotion = false,
    privateMode = false,
}) {
    const [pageHidden, setPageHidden] = useState(
        typeof document !== "undefined" ? document.hidden : false
    );

    useEffect(() => {
        const updateVisibility = () => setPageHidden(document.hidden);
        document.addEventListener("visibilitychange", updateVisibility);
        return () => document.removeEventListener("visibilitychange", updateVisibility);
    }, []);

    const validThemeKey =
        typeof themeKey === "string" && themes[themeKey]
            ? themeKey
            : "aurora";

    const theme = themes[validThemeKey];

    return (
        <div
            className={`static-theme ${sceneClasses[theme.scene || validThemeKey] || ""} ${
                reducedMotion || privateMode || pageHidden ? "theme-motion-off" : ""
            }`}
            aria-hidden="true"
            style={{
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
