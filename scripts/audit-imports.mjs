import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDirectory = path.join(root, "src");

const supportedSourceExtensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".css",
];

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
            /\.(js|jsx|ts|tsx)$/.test(entry.name)
        ) {
            files.push(fullPath);
        }
    }

    return files;
}

async function pathExists(candidate) {
    try {
        await fs.access(candidate);
        return true;
    } catch {
        return false;
    }
}

async function resolveLocalImport(
    importingFile,
    specifier
) {
    const base = path.resolve(
        path.dirname(importingFile),
        specifier
    );

    const extension = path.extname(base);

    const candidates = extension
        ? [base]
        : [
            base,
            ...supportedSourceExtensions.map(
                (item) => `${base}${item}`
            ),
            ...supportedSourceExtensions.map(
                (item) => path.join(base, `index${item}`)
            ),
        ];

    for (const candidate of candidates) {
        if (await pathExists(candidate)) {
            return candidate;
        }
    }

    return null;
}

function extractImports(source) {
    const imports = new Set();

    const patterns = [
        /from\s+["']([^"']+)["']/g,
        /import\s+["']([^"']+)["']/g,
        /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    ];

    for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) {
            imports.add(match[1]);
        }
    }

    return [...imports];
}

const files = await listFiles(sourceDirectory);
const missingImports = [];

for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const imports = extractImports(source);

    for (const specifier of imports) {
        if (
            !specifier.startsWith("./") &&
            !specifier.startsWith("../")
        ) {
            continue;
        }

        const resolved = await resolveLocalImport(
            file,
            specifier
        );

        if (!resolved) {
            missingImports.push({
                file: path.relative(root, file),
                specifier,
            });
        }
    }
}

if (!missingImports.length) {
    console.log(
        `Local import audit passed for ${files.length} source files.`
    );

    process.exit(0);
}

console.error("\nMissing local imports:");

for (const item of missingImports) {
    console.error(
        `- ${item.file} imports ${item.specifier}`
    );
}

process.exit(1);
