export const themes = {
    aurora: {
        name: "Aurora Glass",
        background: "#07111f",
        accent: "#65e8ff",
        accent2: "#8b7cff",
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

export default function ThemeScene({
    themeKey = "aurora",
}) {
    const validThemeKey =
        typeof themeKey === "string" && themes[themeKey]
            ? themeKey
            : "aurora";

    const theme = themes[validThemeKey];

    return (
        <div
            className="static-theme"
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
        />
    );
}
