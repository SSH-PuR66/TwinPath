import "./validate-theme-assets.mjs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "theme-assets");
const outputRoot = path.join(root, "public", "themes", "assets");
const manifest = JSON.parse(await readFile(path.join(sourceRoot, "manifest.json"), "utf8"));
const enabled = manifest.assets.filter((asset) => asset.enabled);

await mkdir(outputRoot, { recursive: true });
for (const asset of enabled) {
  const filename = `${asset.id}.json`;
  await copyFile(path.resolve(sourceRoot, asset.assetFile), path.join(outputRoot, filename));
}

await writeFile(path.join(root, "public", "themes", "manifest.json"), `${JSON.stringify({
  version: 1,
  assets: enabled.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    creator: asset.creator,
    license: asset.license,
    attribution: asset.attribution,
    sha256: asset.sha256,
    path: `/themes/assets/${asset.id}.json`,
    enabled: true,
  })),
}, null, 2)}\n`);

console.log(`Packaged ${enabled.length} local theme asset(s).`);
