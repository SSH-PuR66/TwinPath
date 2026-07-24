import { validateImportedTheme } from "./themeValidation";

export const DEFAULT_THEME_KEY = "aurora";

export const includedThemes = {
  nursery: {
    name: "Cozy Nursery",
    description: "A soft moon, floating mobile, and gentle clouds create a calm bedtime scene.",
    background: "#211722",
    accent: "#ffc1d9",
    accent2: "#b7d8ff",
    scene: "nursery",
    included: true,
  },
  campus: {
    name: "Campus",
    description: "Emerald campus silhouettes beneath a warm golden horizon.",
    background: "#0b1513",
    accent: "#8ce0bd",
    accent2: "#e6b86a",
    scene: "campus",
    included: true,
  },
  "midnight-ledger": {
    name: "Midnight Ledger",
    description: "Quiet financial lines pulse across a focused midnight desk.",
    background: "#060a12",
    accent: "#7bdcb5",
    accent2: "#7e9cff",
    scene: "ledger",
    included: true,
  },
  "aurora-grid": {
    name: "Aurora Grid",
    description: "A cool luminous grid drifts under soft violet auroras.",
    background: "#07101c",
    accent: "#65e8ff",
    accent2: "#9b7cff",
    scene: "aurora-grid",
    included: true,
  },
  aurora: {
    name: "Aurora Glass",
    description: "Calm cyan and violet light floats behind polished glass.",
    background: "#07111f",
    accent: "#65e8ff",
    accent2: "#8b7cff",
    scene: "aurora",
    wallpaper: "aurora.webm",
    included: true,
  },
  orbit: {
    name: "Midnight Orbit",
    description: "Silver orbital rings trace a deep blue night sky.",
    background: "#05070d",
    accent: "#d8e2ff",
    accent2: "#487dff",
    scene: "orbit",
    included: true,
  },
  rose: {
    name: "Rose Nebula",
    description: "Rose clouds and amber stars bloom through velvet space.",
    background: "#170817",
    accent: "#ff79bd",
    accent2: "#ffbf69",
    scene: "nebula",
    included: true,
  },
  ocean: {
    name: "Ocean Pearl",
    description: "Pearlescent currents roll through a tranquil deep ocean.",
    background: "#041617",
    accent: "#52e0cf",
    accent2: "#b8fff5",
    scene: "ocean",
    wallpaper: "ocean-dusk.webm",
    included: true,
  },
  cyber: {
    name: "Cyber Grid",
    description: "Electric cyan scan lines move across a cobalt grid.",
    background: "#03070c",
    accent: "#00e5ff",
    accent2: "#2d65ff",
    scene: "cyber",
    included: true,
  },
  sunrise: {
    name: "Sunrise Home",
    description: "Warm dawn light rises slowly through a peaceful interior.",
    background: "#21130f",
    accent: "#ffb16e",
    accent2: "#ffe2a8",
    scene: "sunrise",
    included: true,
  },
  sakura: {
    name: "Sakura Drift",
    description: "Soft cherry petals drift across a plum evening breeze.",
    background: "#170d1a",
    accent: "#ff9ac6",
    accent2: "#ffd6e7",
    scene: "sakura",
    included: true,
  },
  solar: {
    name: "Solar Flare",
    description: "Radiant amber flares arc around a smoldering sun.",
    background: "#180804",
    accent: "#ff7b32",
    accent2: "#ffd166",
    scene: "solar",
    included: true,
  },
  rain: {
    name: "Rainy Neon",
    description: "Neon rain streaks over a reflective violet city night.",
    background: "#080818",
    accent: "#52f7ff",
    accent2: "#d66bff",
    scene: "rain",
    wallpaper: "rain-window.webm",
    included: true,
  },
  fireflies: {
    name: "Forest Fireflies",
    description: "Tiny golden lights wander through a moonlit green forest.",
    background: "#06130d",
    accent: "#b8f26d",
    accent2: "#ffd166",
    scene: "fireflies",
    included: true,
  },
  cosmic: {
    name: "Cosmic Bloom",
    description: "Layered violet petals unfurl inside a bright blue cosmos.",
    background: "#0b0718",
    accent: "#9c7dff",
    accent2: "#48d7ff",
    scene: "cosmic",
    included: true,
  },
  arctic: {
    name: "Arctic Halo",
    description: "Ice-blue halos glide over a quiet polar horizon.",
    background: "#06131a",
    accent: "#9fe8ff",
    accent2: "#d9fbff",
    scene: "arctic",
    included: true,
  },
  desert: {
    name: "Desert Mirage",
    description: "Copper dunes shimmer beneath a distant turquoise mirage.",
    background: "#1a0f09",
    accent: "#ffb36b",
    accent2: "#5eead4",
    scene: "desert",
    included: true,
  },
  clouds: {
    name: "Moonlit Clouds",
    description: "Silver cloud banks cross a soft indigo moonlit sky.",
    background: "#080d1c",
    accent: "#b9c8ff",
    accent2: "#eef3ff",
    scene: "clouds",
    wallpaper: "clouds.webm",
    included: true,
  },
  prism: {
    name: "Prism Pulse",
    description: "Iridescent color waves pulse through a dark glass prism.",
    background: "#090711",
    accent: "#ff5fd2",
    accent2: "#59f0ff",
    scene: "prism",
    included: true,
  },
};

// These retain each project's canonical base and accent swatches. Keep the
// metadata separate so the theme records remain compatible with the same
// validation contract used for proposed/imported themes.
const communityThemeRecords = {
  "catppuccin-mocha": { name: "Catppuccin Mocha", description: "The soothing pastel Mocha palette, with blue and mauve highlights.", background: "#1e1e2e", accent: "#89b4fa", accent2: "#cba6f7", scene: "aurora", included: true },
  "catppuccin-latte": { name: "Catppuccin Latte", description: "The light Catppuccin flavor, tuned for a bright, gentle workspace.", background: "#eff1f5", accent: "#1e66f5", accent2: "#8839ef", scene: "aurora", included: true },
  nord: { name: "Nord", description: "An arctic blue-gray palette with frost and aurora accents.", background: "#2e3440", accent: "#88c0d0", accent2: "#a3be8c", scene: "aurora", included: true },
  "rose-pine": { name: "Rosé Pine", description: "A muted pine-and-iris dusk palette for calmer financial planning.", background: "#191724", accent: "#9ccfd8", accent2: "#c4a7e7", scene: "aurora", included: true },
  "rose-pine-dawn": { name: "Rosé Pine Dawn", description: "The warm daylight Rosé Pine variant with pine and iris accents.", background: "#faf4ed", accent: "#286983", accent2: "#907aa9", scene: "aurora", included: true },
  "tokyo-night": { name: "Tokyo Night", description: "A deep indigo night with electric blue and soft violet accents.", background: "#1a1b26", accent: "#7aa2f7", accent2: "#bb9af7", scene: "aurora", included: true },
  everforest: { name: "Everforest", description: "A low-contrast forest palette with sage and teal highlights.", background: "#2b3339", accent: "#a7c080", accent2: "#7fbbb3", scene: "aurora", included: true },
};

for (const [key, theme] of Object.entries(communityThemeRecords)) {
  const validation = validateImportedTheme(key, theme);
  if (!validation.valid) throw new Error(`Invalid built-in community theme ${key}: ${validation.problems.join(" ")}`);
}

export const communityThemeCredits = [
  { name: "Catppuccin", url: "https://github.com/catppuccin/catppuccin" },
  { name: "Nord", url: "https://www.nordtheme.com/" },
  { name: "Rosé Pine", url: "https://rosepinetheme.com/palette/" },
  { name: "Tokyo Night", url: "https://github.com/folke/tokyonight.nvim" },
  { name: "Everforest", url: "https://github.com/sainnhe/everforest" },
];

Object.assign(includedThemes, communityThemeRecords);

const shopPalettes = [
  { id: "lullaby", pack: "Cozy baby", name: "Lullaby", background: "#211722", accent: "#ffc1d9", accent2: "#b7d8ff" },
  { id: "cloud-cotton", pack: "Cozy baby", name: "Cloud Cotton", background: "#182033", accent: "#f9e6ff", accent2: "#bfdcff" },
  { id: "honey-moon", pack: "Cozy baby", name: "Honey Moon", background: "#241b15", accent: "#ffd8a0", accent2: "#ffecc2" },
  { id: "storybook", pack: "Cozy baby", name: "Storybook", background: "#1b172b", accent: "#d9c3ff", accent2: "#ffd4e4" },
  { id: "peach-fizz", pack: "Soft pastels", name: "Peach Fizz", background: "#29181b", accent: "#ffb6a3", accent2: "#ffe5ad" },
  { id: "mint-milk", pack: "Soft pastels", name: "Mint Milk", background: "#13221f", accent: "#b8efd6", accent2: "#e8fff7" },
  { id: "violet-dream", pack: "Soft pastels", name: "Violet Dream", background: "#18152b", accent: "#c9b5ff", accent2: "#e8dcff" },
  { id: "starlight", pack: "Night skies", name: "Starlight", background: "#070a1a", accent: "#b6c9ff", accent2: "#fff1b5" },
  { id: "deep-ocean", pack: "Night skies", name: "Deep Ocean", background: "#031827", accent: "#7ee7ff", accent2: "#75a8ff" },
  { id: "neon-candy", pack: "Bright worlds", name: "Neon Candy", background: "#18041d", accent: "#ff79dc", accent2: "#73e7ff" },
];

function createShopThemes() {
  return Object.fromEntries(
    shopPalettes.flatMap((palette) =>
      Object.entries(includedThemes).map(([baseKey, baseTheme]) => {
        const key = `shop-${palette.id}-${baseKey}`;
        return [key, {
          ...baseTheme,
          name: `${palette.name} ${baseTheme.name}`,
          description: `${palette.pack} collection · ${baseTheme.description}`,
          background: palette.background,
          accent: palette.accent,
          accent2: palette.accent2,
          included: true,
          pack: palette.pack,
          source: "TwinPath Theme Shop",
        }];
      })
    )
  );
}

export const shopThemes = createShopThemes();
export const themes = { ...includedThemes, ...shopThemes };

export function resolveThemeKey(value) {
  return typeof value === "string" && Object.hasOwn(themes, value)
    ? value
    : DEFAULT_THEME_KEY;
}
