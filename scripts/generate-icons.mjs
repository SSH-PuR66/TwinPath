import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.resolve("public/icon.svg");
const outputDirectory = path.resolve("public/icons");

await fs.mkdir(outputDirectory, {
  recursive: true,
});

const icons = [
  { name: "icon-180.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
];

for (const icon of icons) {
  await sharp(source)
    .resize(icon.size, icon.size, {
      fit: "cover",
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toFile(
      path.join(outputDirectory, icon.name)
    );

  console.log(`Generated ${icon.name}`);
}
