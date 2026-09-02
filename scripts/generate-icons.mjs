/**
 * Génère les icônes PWA et les écrans de démarrage iOS : dégradé teal Sumeria + « S »
 * vectoriel (aucune police requise).
 * Usage : npm run icons
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");
const splashDir = join(__dirname, "..", "public", "splash");
mkdirSync(iconsDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

const S_PATH = "M69 32 C69 20 31 20 31 34 C31 49 69 49 69 64 C69 79 31 79 31 68";
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#1f8f86"/>
  <stop offset="1" stop-color="#0a3440"/>
</linearGradient>`;

/**
 * @param {object} o
 * @param {number} o.radius  arrondi des coins (0 = plein cadre, pour maskable / Apple)
 * @param {number} o.scale   taille du S (1 = normal, <1 = plus petit pour la zone sûre maskable)
 */
function iconSvg({ radius, scale }) {
  const s = 50 - 50 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>${GRADIENT}</defs>
  <rect width="100" height="100" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${s} ${s}) scale(${scale})">
    <path d="${S_PATH}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`;
}

/** Écran de démarrage : fond dégradé plein cadre, « S » centré (≈ 22 % de la largeur). */
function splashSvg(w, h) {
  const size = Math.round(w * 0.22);
  const x = (w - size) / 2;
  const y = (h - size) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${GRADIENT}</defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">
    <path d="${S_PATH}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
  </svg>
</svg>`;
}

const icons = [
  ["icon-192.png", 192, { radius: 22, scale: 1 }],
  ["icon-512.png", 512, { radius: 22, scale: 1 }],
  ["icon-512-maskable.png", 512, { radius: 0, scale: 0.8 }],
  ["apple-touch-icon.png", 180, { radius: 0, scale: 1 }],
];

for (const [name, size, opts] of icons) {
  await sharp(Buffer.from(iconSvg(opts))).resize(size, size).png().toFile(join(iconsDir, name));
  console.log(`✅ public/icons/${name} (${size}x${size})`);
}

// Même liste que lib/splash.ts
const splashSizes = [
  [1320, 2868], [1206, 2622], [1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532], [1125, 2436],
  [1242, 2688], [828, 1792], [1242, 2208], [750, 1334], [1640, 2360], [1668, 2388], [2048, 2732], [1536, 2048],
];

for (const [w, h] of splashSizes) {
  await sharp(Buffer.from(splashSvg(w, h))).png({ compressionLevel: 9, palette: true }).toFile(join(splashDir, `${w}x${h}.png`));
  console.log(`✅ public/splash/${w}x${h}.png`);
}
