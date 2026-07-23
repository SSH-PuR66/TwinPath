// Validation for imported/proposed themes. Themes are DATA ONLY: named
// colors and a scene identifier from the built-in allowlist. No CSS
// strings, no URLs, no scripts — an imported theme can restyle the app
// but can never become an injection vector.

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const THEME_KEY = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX_TEXT = 160;

export const ALLOWED_SCENES = new Set([
    "nursery",
    "campus",
    "ledger",
    "aurora-grid",
    "aurora",
    "orbit",
    "rose",
    "meadow",
    "ocean",
    "ember",
]);

const REQUIRED_COLOR_FIELDS = ["background", "accent", "accent2"];

export function validateImportedTheme(key, theme) {
    const problems = [];

    if (typeof key !== "string" || !THEME_KEY.test(key)) {
        problems.push(
            "Theme key must be 2-40 lowercase letters, digits, or dashes."
        );
    }

    if (typeof theme !== "object" || theme === null || Array.isArray(theme)) {
        return { valid: false, problems: ["Theme must be a plain object."] };
    }

    if (
        typeof theme.name !== "string" ||
        !theme.name.trim() ||
        theme.name.length > MAX_TEXT
    ) {
        problems.push("Theme name is required (at most 160 characters).");
    }

    if (
        theme.description !== undefined &&
        (typeof theme.description !== "string" ||
            theme.description.length > 500)
    ) {
        problems.push("Description must be a string of at most 500 characters.");
    }

    for (const field of REQUIRED_COLOR_FIELDS) {
        if (typeof theme[field] !== "string" || !HEX_COLOR.test(theme[field])) {
            problems.push(`${field} must be a 6-digit hex color like #07111f.`);
        }
    }

    if (
        typeof theme.scene !== "string" ||
        !ALLOWED_SCENES.has(theme.scene)
    ) {
        problems.push(
            `scene must be one of: ${[...ALLOWED_SCENES].join(", ")}.`
        );
    }

    const allowedKeys = new Set([
        "name",
        "description",
        "background",
        "accent",
        "accent2",
        "scene",
        "included",
    ]);
    for (const presentKey of Object.keys(theme)) {
        if (!allowedKeys.has(presentKey)) {
            problems.push(`Unknown theme field "${presentKey}" is not allowed.`);
        }
    }

    return { valid: problems.length === 0, problems };
}
