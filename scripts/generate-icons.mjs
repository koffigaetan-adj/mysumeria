/**
 * Génère les icônes PWA : dégradé teal Sumeria + « S » vectoriel (aucune police requise).
 * Usage : npm run icons
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

/**
 * @param {object} o
 * @param {number} o.radius  arrondi des coins (0 = plein cadre, pour maskable / Apple)
 * @param {number} o.scale   taille du S (1 = normal, <1 = plus petit pour la zone sûre maskable)
 */
function svg({ radius, scale }) {
  const s = 50 - 50 * scale; // translation pour recentrer après mise à l'échelle
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f8f86"/>
      <stop offset="1" stop-color="#0a3440"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${s} ${s}) scale(${scale})">
    <path d="M69 32 C69 20 31 20 31 34 C31 49 69 49 69 64 C69 79 31 79 31 68"
          fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
  </g>
</svg>`;
}

const targets = [
  ["icon-192.png", 192, { radius: 22, scale: 1 }],
  ["icon-512.png", 512, { radius: 22, scale: 1 }],
  ["icon-512-maskable.png", 512, { radius: 0, scale: 0.8 }],
  ["apple-touch-icon.png", 180, { radius: 0, scale: 1 }],
];

for (const [name, size, opts] of targets) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(join(outDir, name));
  console.log(`✅ public/icons/${name} (${size}x${size})`);
}
