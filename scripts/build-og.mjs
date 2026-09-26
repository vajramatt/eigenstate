// SPDX-License-Identifier: MIT
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CONE, MARK, latitude, project } from '../src/rendering/eigenmark.ts';

// Crossing Into family card (Luminous Commons, Dusk). Words are pre-outlined from the
// bundled fonts by scripts/og-text.py, so the card never depends on installed fonts.
const source = fileURLToPath(new URL('../src/assets/og-background.png', import.meta.url));
const output = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const text = JSON.parse(await readFile(new URL('./og-text.json', import.meta.url), 'utf8'));
const INK = '#F1EFE6', BODY = '#BAC3CD', MUTED = '#909BA8', SUN = '#F2A649', SUN_INK = '#F2B06A', PAPER = '#0D1520';
const words = (key, x, y, fill) => `<path transform="translate(${x} ${y})" fill="${fill}" d="${text[key].d}"/>`;

// The mark at rest: the same geometry as the app's header mark.
const pole = project(0, 0), south = project(Math.PI, 0), tip = project(CONE, -Math.PI / 5), cone = latitude(CONE), eq = latitude(Math.PI / 2);
const { cx, cy, r } = MARK;
const mark = `<g transform="translate(70 58) scale(1.45)" fill="none" stroke-linecap="round">
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${INK}" stroke-width="1.1" opacity=".62"/>
    <ellipse cx="${cx}" cy="${eq.cy}" rx="${eq.rx}" ry="${eq.ry}" stroke="${INK}" stroke-width=".7" stroke-dasharray="1.2 1.8" opacity=".28"/>
    <path d="M${cx - r} ${cy}A${eq.rx} ${eq.ry} 0 0 0 ${cx + r} ${cy}" stroke="${INK}" stroke-width=".9" opacity=".5"/>
    <line x1="${cx}" y1="${pole.y}" x2="${cx}" y2="${south.y}" stroke="${INK}" stroke-width=".6" stroke-dasharray=".8 1.6" opacity=".32"/>
    <ellipse cx="${cx}" cy="${cone.cy}" rx="${cone.rx}" ry="${cone.ry}" stroke="${SUN}" stroke-width=".6" stroke-dasharray=".6 1.4" opacity=".5"/>
    <circle cx="${tip.x}" cy="${tip.y}" r="5.5" fill="url(#halo)"/>
    <line x1="${cx}" y1="${cy}" x2="${tip.x}" y2="${tip.y}" stroke="${SUN}" stroke-width="1.6"/>
    <circle cx="${cx}" cy="${cy}" r=".9" fill="${INK}" opacity=".7"/>
    <circle cx="${tip.x}" cy="${tip.y}" r="2" fill="${SUN}"/>
  </g>`;

const overlay = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${PAPER}" stop-opacity="0.97"/>
      <stop offset="0.40" stop-color="${PAPER}" stop-opacity="0.86"/>
      <stop offset="0.68" stop-color="${PAPER}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${PAPER}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="dawn" cx="0.12" cy="1.08" r="0.62" gradientTransform="scale(1 1.9) translate(0 -0.47)">
      <stop offset="0" stop-color="${SUN}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${SUN}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="${SUN}" stop-opacity=".55"/><stop offset="1" stop-color="${SUN}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#veil)"/>
  <rect width="1200" height="630" fill="url(#dawn)"/>
  ${mark}
  <line x1="138" y1="87" x2="162" y2="87" stroke="${SUN}" stroke-width="1.2"/>
  ${words('eyebrow', 174, 92, SUN_INK)}
  ${words('title', 74, 302, INK)}
  ${words('lede', 80, 354, BODY)}
  <line x1="80" y1="390" x2="460" y2="390" stroke="${INK}" stroke-opacity="0.12" stroke-width="1"/>
  ${words('tagline', 80, 430, SUN_INK)}
  ${words('url', 80, 552, MUTED)}
</svg>`);

await sharp(source)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([{ input: overlay }])
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(output);

console.log('OpenGraph image: public/og-image.png (1200×630)');
