// Deterministic brand-asset generation from the SVG masters (run: node scripts/generate-brand-assets.mjs)
import sharp from 'sharp';

const CLOCK = `
  <circle cx="512" cy="546" r="222" fill="none" stroke="{COLOR}" stroke-width="60"/>
  <line x1="512" y1="546" x2="512" y2="410" stroke="{COLOR}" stroke-width="60" stroke-linecap="round"/>
  <line x1="512" y1="546" x2="418" y2="606" stroke="{COLOR}" stroke-width="60" stroke-linecap="round"/>
  <path d="M 751 308 A 325 325 0 0 0 324 222" fill="none" stroke="{ARROW}" stroke-width="68" stroke-linecap="round"/>
  <polygon points="256,120 222,290 376,238" fill="{ARROW}"/>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${body}</svg>`;

const GRADIENT = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#4FA8FF"/><stop offset="1" stop-color="#2C7BD4"/>
</linearGradient></defs>`;

// Full tile (rounded square + mark) — the iOS/store icon and splash image.
const tile = svg(`${GRADIENT}<rect width="1024" height="1024" rx="240" fill="url(#bg)"/>
  ${CLOCK.replaceAll('{COLOR}', '#FFFFFF').replaceAll('{ARROW}', '#FFB84C')}`);

// Adaptive foreground: mark only, scaled into the ~66% safe zone, transparent bg.
const foreground = svg(`<g transform="translate(512 512) scale(0.62) translate(-512 -512)">
  ${CLOCK.replaceAll('{COLOR}', '#FFFFFF').replaceAll('{ARROW}', '#FFB84C')}</g>`);

// Adaptive background: the gradient, full bleed (no rounding — the launcher masks it).
const background = svg(`${GRADIENT}<rect width="1024" height="1024" fill="url(#bg)"/>`);

// Monochrome (themed icons): white-only mark, transparent bg.
const monochrome = svg(`<g transform="translate(512 512) scale(0.62) translate(-512 -512)">
  ${CLOCK.replaceAll('{COLOR}', '#FFFFFF').replaceAll('{ARROW}', '#FFFFFF')}</g>`);

const out = async (svgStr, size, file) =>
  sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(file);

await out(tile, 1024, 'assets/icon.png');
await out(foreground, 1024, 'assets/android-icon-foreground.png');
await out(background, 1024, 'assets/android-icon-background.png');
await out(monochrome, 1024, 'assets/android-icon-monochrome.png');
await out(tile, 512, 'assets/splash-icon.png');
console.log('brand assets generated');
