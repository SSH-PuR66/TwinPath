import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.resolve("public/icon.svg");
const outputDirectory = path.resolve("public/icons");
const splashDirectory = path.resolve("public/splash");
const background = "#14100e";

await fs.mkdir(outputDirectory, {
  recursive: true,
});
await fs.mkdir(splashDirectory, {
  recursive: true,
});

const icons = [
  { name: "icon-180.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const icon of icons) {
  const artwork = await sharp(source)
    .resize(icon.maskable ? Math.round(icon.size * 0.8) : icon.size, icon.maskable ? Math.round(icon.size * 0.8) : icon.size, {
      fit: "cover",
    })
    .png()
    .toBuffer();
  const canvas = icon.maskable
    ? sharp({ create: { width: icon.size, height: icon.size, channels: 4, background } }).composite([{ input: artwork, top: Math.round(icon.size * 0.1), left: Math.round(icon.size * 0.1) }])
    : sharp(artwork);

  await canvas.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path.join(outputDirectory, icon.name));

  console.log(`Generated ${icon.name}`);
}

const splashScreens = [
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
];
const splashArtwork = await sharp(source).resize(360, 360, { fit: "cover" }).png().toBuffer();

for (const [width, height] of splashScreens) {
  await sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: splashArtwork, top: Math.round((height - 360) / 2), left: Math.round((width - 360) / 2) }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(splashDirectory, `twinpath-launch-${width}x${height}.png`));
  console.log(`Generated splash ${width}x${height}`);
}
