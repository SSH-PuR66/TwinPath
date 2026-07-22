import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDirectory = path.join(root, "src");

async function listFiles(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (
      entry.name.endsWith(".jsx") ||
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".tsx") ||
      entry.name.endsWith(".ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractLiteralClasses(source) {
  const classes = new Set();

  const patterns = [
    /className\s*=\s*"([^"]+)"/g,
    /className\s*=\s*'([^']+)'/g,
    /className\s*=\s*{\s*`([^`]+)`\s*}/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const classText = match[1]
        .replace(/\$\{[^}]+\}/g, " ")
        .replace(/[{}()[\],?:]/g, " ");

      for (const className of classText.split(/\s+/)) {
        const normalized = className.trim();

        if (
          normalized &&
          // A template such as `theme-${theme.scene}` becomes `theme-` after
          // expression removal. It is a dynamic prefix, not a CSS class.
          !normalized.endsWith("-") &&
          /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(normalized)
        ) {
          classes.add(normalized);
        }
      }
    }
  }

  return classes;
}

function extractCssSelectors(source) {
  const classes = new Set();

  for (const match of source.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
    classes.add(match[1]);
  }

  return classes;
}

const sourceFiles = await listFiles(sourceDirectory);

const componentFiles = sourceFiles.filter((file) =>
  /\.(jsx|tsx)$/.test(file)
);

const cssEntries = await fs.readdir(sourceDirectory, {
  withFileTypes: true,
});

const cssFiles = cssEntries
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".css")
  )
  .map((entry) => path.join(sourceDirectory, entry.name));

const usedClasses = new Map();
const definedClasses = new Set();

for (const file of componentFiles) {
  const source = await fs.readFile(file, "utf8");
  const classes = extractLiteralClasses(source);

  for (const className of classes) {
    if (!usedClasses.has(className)) {
      usedClasses.set(className, new Set());
    }

    usedClasses
      .get(className)
      .add(path.relative(root, file));
  }
}

for (const file of cssFiles) {
  const source = await fs.readFile(file, "utf8");

  for (const className of extractCssSelectors(source)) {
    definedClasses.add(className);
  }
}

const ignoredClasses = new Set([
  // Third-party React Day Picker classes.
  "rdp-root",
  "rdp-months",
  "rdp-month",
  "rdp-month_grid",
  "rdp-month_caption",
  "rdp-weekday",
  "rdp-day",
  "rdp-day_button",
  "rdp-selected",
  "rdp-outside",

  // Dynamically supplied state/tone classes.
  "active",
  "open",
  "checked",
  "completed",
  "positive",
  "negative",
  "featured",
  "private-display",
  "spin",

  // Common status classes that may be styled through
  // attribute combinations or generated dynamically.
  "pending",
  "approved",
  "rejected",
  "purchased",
  "cancelled",
  "submitted",
  "denied",
  "closed",
  "applying",
  "researching",
]);

const missing = [...usedClasses.entries()]
  .filter(
    ([className]) =>
      !definedClasses.has(className) &&
      !ignoredClasses.has(className)
  )
  .sort(([left], [right]) =>
    left.localeCompare(right)
  );

console.log(
  `Checked ${componentFiles.length} component files and ` +
    `${cssFiles.length} CSS files.`
);

console.log(`Used literal classes: ${usedClasses.size}`);
console.log(`Defined CSS classes: ${definedClasses.size}`);

if (!missing.length) {
  console.log("CSS class audit passed.");
  process.exit(0);
}

console.error("\nMissing CSS classes:");

for (const [className, files] of missing) {
  console.error(`\n.${className}`);

  for (const file of [...files].sort()) {
    console.error(`  - ${file}`);
  }
}

console.error(
  "\nNote: this audit detects literal class names. " +
    "It cannot fully interpret every dynamically generated class."
);

process.exit(1);
