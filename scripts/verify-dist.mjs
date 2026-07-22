import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = new URL("../dist/assets/", import.meta.url).pathname;

const REQUIRED = [
    {
        needle: "twinpath-control-plane.srodriguez46.workers.dev",
        label: "control-plane Worker URL",
    },
    {
        needle: "wtdmjybpfimmsojsdobx.supabase.co",
        label: "Supabase project URL",
    },
];

const files = (await readdir(assetsDir)).filter((name) =>
    name.endsWith(".js")
);

if (files.length === 0) {
    throw new Error("dist/assets contains no JavaScript bundles.");
}

const found = new Map(REQUIRED.map((item) => [item.needle, false]));

for (const name of files) {
    const content = await readFile(join(assetsDir, name), "utf8");
    for (const { needle } of REQUIRED) {
        if (content.includes(needle)) {
            found.set(needle, true);
        }
    }
}

const missing = REQUIRED.filter(({ needle }) => !found.get(needle));

if (missing.length > 0) {
    throw new Error(
        `Production build is missing required configuration: ${missing
            .map(({ label }) => label)
            .join(", ")}. Refusing to ship a build that cannot reach its backends.`
    );
}

console.log(
    `Verified ${files.length} bundles: control-plane and Supabase URLs are baked in.`
);
