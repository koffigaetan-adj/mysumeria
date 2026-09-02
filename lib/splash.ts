// Écrans de démarrage iOS (apple-touch-startup-image) : une image par taille d'écran.
// Générés par scripts/generate-icons.mjs (qui garde la même liste) dans public/splash/.
export const SPLASH_SIZES: Array<{ w: number; h: number; cssW: number; cssH: number; ratio: number }> = [
  { w: 1320, h: 2868, cssW: 440, cssH: 956, ratio: 3 }, // iPhone 16 Pro Max
  { w: 1206, h: 2622, cssW: 402, cssH: 874, ratio: 3 }, // iPhone 16 Pro
  { w: 1290, h: 2796, cssW: 430, cssH: 932, ratio: 3 }, // 14 Pro Max / 15 Pro Max / 16 Plus
  { w: 1179, h: 2556, cssW: 393, cssH: 852, ratio: 3 }, // 14 Pro / 15 / 16
  { w: 1284, h: 2778, cssW: 428, cssH: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 1170, h: 2532, cssW: 390, cssH: 844, ratio: 3 }, // 12/13/14
  { w: 1125, h: 2436, cssW: 375, cssH: 812, ratio: 3 }, // X/XS/11 Pro/12 mini/13 mini
  { w: 1242, h: 2688, cssW: 414, cssH: 896, ratio: 3 }, // XS Max/11 Pro Max
  { w: 828, h: 1792, cssW: 414, cssH: 896, ratio: 2 }, // XR/11
  { w: 1242, h: 2208, cssW: 414, cssH: 736, ratio: 3 }, // 6/7/8 Plus
  { w: 750, h: 1334, cssW: 375, cssH: 667, ratio: 2 }, // 6/7/8/SE 2-3
  { w: 1640, h: 2360, cssW: 820, cssH: 1180, ratio: 2 }, // iPad Air
  { w: 1668, h: 2388, cssW: 834, cssH: 1194, ratio: 2 }, // iPad Pro 11
  { w: 2048, h: 2732, cssW: 1024, cssH: 1366, ratio: 2 }, // iPad Pro 12.9
  { w: 1536, h: 2048, cssW: 768, cssH: 1024, ratio: 2 }, // iPad 9.7
];

export function splashMedia(s: { cssW: number; cssH: number; ratio: number }): string {
  return `(device-width: ${s.cssW}px) and (device-height: ${s.cssH}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)`;
}

export function splashUrl(s: { w: number; h: number }): string {
  return `/splash/${s.w}x${s.h}.png`;
}
