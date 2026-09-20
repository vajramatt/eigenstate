// SPDX-License-Identifier: MIT
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../src/assets/og-background.png', import.meta.url));
const output = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const overlay = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#080e18" stop-opacity="0.98"/>
      <stop offset="0.40" stop-color="#080e18" stop-opacity="0.88"/>
      <stop offset="0.68" stop-color="#080e18" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#080e18" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#veil)"/>
  <g transform="translate(76 74)">
    <path d="M0 0h26l15 21-15 21H0l15-21z" fill="none" stroke="#78dce8" stroke-width="2"/>
    <circle cx="15" cy="21" r="4" fill="#78dce8"/>
    <text x="58" y="26" fill="#8c9eb5" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="13" letter-spacing="4">CROSSING INTO / TOOL 01</text>
  </g>
  <text x="76" y="300" fill="#d1e0ed" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="78" font-weight="500" letter-spacing="1">Eigenstate</text>
  <text x="80" y="349" fill="#78dce8" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="17" letter-spacing="3">A PERSISTENT SYNTHETIC UNIVERSE</text>
  <line x1="80" y1="381" x2="420" y2="381" stroke="#203044" stroke-width="1"/>
  <text x="80" y="424" fill="#8c9eb5" font-family="Inter, Helvetica Neue, Arial, sans-serif" font-size="20">Browser screensaver · local · evolving</text>
  <text x="80" y="552" fill="#536981" font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="13" letter-spacing="2">SCREENSAVER.CROSSINGINTO.AI</text>
</svg>`);

await sharp(source)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([{ input: overlay }])
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(output);

console.log('OpenGraph image: public/og-image.png (1200×630)');
