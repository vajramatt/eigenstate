// SPDX-License-Identifier: MIT
import type { CausalTrace, Universe } from '../core/types.ts';
import type { Theme } from './themes.ts';
import { alpha, dot, label, line, mix, text, type Ctx } from './drawing.ts';

type Vec = [number, number, number];
/** Simulated seconds for a new causal trace to grow into a full tendril. */
export const GROWTH_SECONDS = 12;
const TENDRIL_SEGMENTS = 18;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const normalize = ([x, y, z]: Vec): Vec => { const length = Math.hypot(x, y, z) || 1; return [x / length, y / length, z / length]; };
const cross = ([ax, ay, az]: Vec, [bx, by, bz]: Vec): Vec => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

/** FNV-1a. Presentation-only shape seed: tendril form derives from trace identity, never from the simulation PRNG. */
export function traceHash(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** Growth from bud (0) to bloom (1), measured in simulated time since the trace was retained. */
export function tendrilGrowth(trace: CausalTrace, age: number): number {
  const p = clamp01((age - trace.age) / GROWTH_SECONDS);
  return 1 - (1 - p) ** 3;
}

/** A helical tendril rooted at one of the experiment's latent vectors, in world coordinates. */
export function tendrilPath(u: Universe, trace: CausalTrace): Vec[] | undefined {
  const experiment = u.experiments.findIndex(e => e.id === trace.experiment), count = u.world.coordinates.length;
  if (experiment < 0 || experiment >= count) return undefined;
  const hash = traceHash(trace.id), anchor = experiment + 7 * (hash % (Math.floor((count - 1 - experiment) / 7) + 1));
  const [x, y, z] = u.world.coordinates[anchor];
  const outward = normalize(Math.hypot(x, z) < 0.05 ? [1, 0, 0] : [x, y * 0.35, z]);
  const side = normalize(cross(outward, [0, 1, 0])), lift = cross(side, outward);
  const reach = 0.3 + (hash >>> 8 & 255) / 255 * 0.26, curl = 0.05 + (hash >>> 16 & 255) / 255 * 0.07, twist = (hash & 1023) / 1023 * Math.PI * 2;
  return Array.from({ length: TENDRIL_SEGMENTS + 1 }, (_, s) => {
    const p = s / TENDRIL_SEGMENTS, a = twist + p * 3.1, r = curl * (Math.sin(p * Math.PI) * 1.2 + p * 0.8);
    return [0, 1, 2].map(axis => [x, y, z][axis] + outward[axis] * reach * p + (side[axis] * Math.cos(a) + lift[axis] * Math.sin(a)) * r) as Vec;
  });
}

/** Milestone festival intensity for a presentation-time offset: rise, hold, then a long fade. */
export function festivalEnvelope(ms: number): number {
  const s = ms / 1000;
  if (!(s >= 0 && s < 45)) return 0;
  const rise = Math.min(1, s / 2.5), fade = s < 20 ? 1 : 1 - (s - 20) / 25;
  return (rise * (2 - rise)) * fade * fade * (3 - 2 * fade);
}

export function drawWorld(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age, ambient = false, celebration = 0): void {
  const phase = time + u.seed % 997;
  const size = ambient ? Math.min(w, h) * (0.56 + Math.sin(phase * 0.019) * 0.05) : Math.min(w * 0.7, h * 0.95);
  const detailScale = ambient ? Math.min(2.2, Math.max(1, Math.sqrt(size / 280))) : 1;
  const strokeScale = Math.min(1.7, detailScale);
  // Ambient drift stays inside a centered safe frame so every moment composes.
  const cx = w * (ambient ? 0.5 + Math.sin(phase * 0.013) * 0.07 : 0.49);
  const cy = h * (ambient ? 0.5 + Math.cos(phase * 0.017) * 0.05 : 0.5);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  halo.addColorStop(0, `${t.secondary}20`); halo.addColorStop(0.55, `${t.accent}09`); halo.addColorStop(1, `${t.background}00`);
  ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
  const angle = time * 0.055, c = Math.cos(angle), s = Math.sin(angle);
  const view = ([x, y, z]: number[]): Vec => [x * c - z * s, y, x * s + z * c];
  const screen = ([rx, y, rz]: Vec): [number, number] => {
    const perspective = 3.8 / (3.8 + rz), py = y * 0.88 - rz * 0.3;
    return [cx + rx * size * 0.5 * perspective, cy + py * size * 0.5 * perspective];
  };
  const project = (p: number[]) => screen(view(p));
  // Near (−1) to far (+1): far geometry recedes instead of competing with the near side.
  const nearness = (rz: number) => 0.42 + 0.58 * clamp01(0.5 - rz * 0.6);
  // First light: a slow sun in camera space sweeps day across the world as the camera orbits beneath it.
  const sun = normalize([-0.62 + Math.sin(phase * 0.011) * 0.34, -0.58 + Math.cos(phase * 0.008) * 0.16, -0.5]);
  const daylight = (v: Vec) => { const n = normalize(v); return clamp01(n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) ** 1.3; };

  // Slow camera orbit reveals the persisted state geometry; it does not change it.
  for (let orbit = 0; orbit < 3; orbit++) {
    let previous: [number, number] | undefined;
    for (let j = 0; j <= 96; j++) {
      const a = j / 96 * Math.PI * 2, r = 1.12 + orbit * 0.1;
      const p = project(orbit === 0 ? [Math.cos(a)*r, Math.sin(a)*r, 0] : orbit === 1 ? [Math.cos(a)*r, 0, Math.sin(a)*r] : [0, Math.cos(a)*r, Math.sin(a)*r]);
      if (previous) line(ctx, ...previous, ...p, `${t.secondary}45`, 0.65 * strokeScale);
      if (j % 8 === 0) dot(ctx, ...p, `${t.accent}80`, detailScale);
      previous = p;
    }
  }
  // The terminator: where night turns to day. Brighter on the near side.
  const east = normalize(cross(sun, [0, 1, 0])), north = cross(east, sun);
  let dawn: [number, number] | undefined;
  for (let j = 0; j <= 72; j++) {
    const a = j / 72 * Math.PI * 2, v: Vec = [0, 1, 2].map(axis => (east[axis] * Math.cos(a) + north[axis] * Math.sin(a)) * 1.04) as Vec;
    const p = screen(v);
    if (dawn) line(ctx, ...dawn, ...p, `${t.sun}${alpha(0.07 + 0.2 * clamp01(-v[2]))}`, 0.8 * strokeScale);
    dawn = p;
  }
  const sunPoint = screen([sun[0] * 1.5, sun[1] * 1.5, sun[2] * 1.5]);
  ctx.globalCompositeOperation = 'lighter';
  const corona = ctx.createRadialGradient(...sunPoint, 0, ...sunPoint, 60 * detailScale);
  corona.addColorStop(0, `${t.sun}26`); corona.addColorStop(0.35, `${t.sun}0c`); corona.addColorStop(1, `${t.sun}00`);
  ctx.fillStyle = corona; ctx.beginPath(); ctx.arc(...sunPoint, 60 * detailScale, 0, Math.PI * 2); ctx.fill();
  dot(ctx, ...sunPoint, `${t.sun}10`, 9 * detailScale); dot(ctx, ...sunPoint, `${t.sun}28`, 4.5 * detailScale); dot(ctx, ...sunPoint, t.sun, 1.6 * detailScale);
  ctx.globalCompositeOperation = 'source-over';

  const views = u.world.coordinates.map(view), points = views.map(screen);
  const trace = u.traces.at(-1), focus = trace && u.age - trace.age < 10 ? u.experiments.findIndex(e => e.id === trace.experiment) : -1;
  points.forEach((p, i) => {
    const fade = nearness(views[i][2]);
    if (i > 0) line(ctx, ...points[i - 1], ...p, `${i % 7 < 3 ? t.accent : t.secondary}${alpha(0.33 * fade)}`, 0.65 * strokeScale);
    if (i + 26 < points.length && u.world.coupling[i % 64] > 0.55) {
      const other = points[i + 26], travel = (time * 0.23 + i * 0.173) % 1;
      line(ctx, ...p, ...other, `${t.secondary}${alpha(0.25 * fade)}`, 0.7 * strokeScale);
      dot(ctx, p[0] + (other[0] - p[0]) * travel, p[1] + (other[1] - p[1]) * travel, t.accent, 1.7 * detailScale);
    }
  });

  // The causal garden: every retained trace grows a tendril, oldest dimmest, so the history the
  // universe keeps becomes something you can see. Bounded by the trace limit.
  u.traces.forEach((item, k) => {
    const path = tendrilPath(u, item); if (!path) return;
    // A milestone festival brings every tendril, even a new bud, into bloom at once.
    const growth = Math.max(tendrilGrowth(item, u.age), celebration), reach = growth * TENDRIL_SEGMENTS;
    if (reach <= 0) return;
    // Recent growth leads; older tendrils recede toward the bound where they are pruned.
    const settled = 0.22 + 0.78 * ((k + 1) / u.traces.length) ** 1.6, sway = Math.sin(time * 0.6 + k) * 0.012;
    const color = mix(t.warning, t.leaf, growth), tip = Math.min(TENDRIL_SEGMENTS, Math.ceil(reach));
    let previous = screen(view(path[0]));
    for (let segment = 1; segment <= tip; segment++) {
      const partial = Math.min(1, reach - segment + 1), from = path[segment - 1], to = path[segment];
      const v = view(from.map((value, axis) => value + (to[axis] - value) * partial + (axis === 1 ? sway * segment : 0)));
      const next = screen(v), light = daylight(v);
      line(ctx, ...previous, ...next, `${mix(color, t.sun, light * 0.3)}${alpha((0.3 + 0.55 * light) * nearness(v[2]) * settled)}`, (1.25 - segment / TENDRIL_SEGMENTS * 0.8) * strokeScale);
      if (segment % 4 === 2 && partial === 1) dot(ctx, ...next, `${t.leaf}${alpha(0.75 * settled)}`, 1.1 * detailScale);
      previous = next;
    }
    ctx.globalCompositeOperation = 'lighter';
    if (growth < 1) { dot(ctx, ...previous, `${t.sun}30`, 4 * detailScale); dot(ctx, ...previous, t.sun, 1.5 * detailScale); }
    else { dot(ctx, ...previous, `${t.third}${alpha((0.2 + celebration * 0.12) * settled)}`, 4.6 * (1 + celebration * 0.4) * detailScale); dot(ctx, ...previous, `${t.third}${alpha(Math.min(1, settled + celebration * 0.6))}`, 1.7 * (1 + celebration * 0.3) * detailScale); }
    ctx.globalCompositeOperation = 'source-over';
  });

  // Far to near, so the lit near side reads as an object in front of its own night.
  const order = views.map((_, i) => i).sort((a, b) => views[b][2] - views[a][2]);
  for (const i of order) {
    const p = points[i], v = views[i], e = u.experiments[i % 7];
    const light = daylight(v), fade = nearness(v[2]);
    const base = i % 7 === focus ? t.warning : i % 7 < 3 ? t.accent : t.secondary;
    const color = i % 7 === focus ? base : mix(base, t.sun, light * 0.42);
    const radius = (1 + e.convergence * 1.6) * 3.8 / (3.8 + v[2]) * detailScale;
    ctx.globalCompositeOperation = 'lighter';
    dot(ctx, ...p, `${color}${alpha((0.05 + light * 0.1) * fade)}`, radius * 3.5);
    ctx.globalCompositeOperation = 'source-over';
    dot(ctx, ...p, `${color}${alpha(fade * (0.62 + light * 0.38))}`, radius);
    if (v[2] < -0.3) dot(ctx, ...p, light > 0.45 ? t.sun : t.text, 0.7 * detailScale);
  }

  const motes = Math.round((ambient ? 36 : 0) + celebration * 60);
  if (motes) {
    // Pollen: drifting motes lit by the sun. Position is a pure function of presentation time.
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < motes; k++) {
      const rise = (time * (0.011 + celebration * 0.03) + k * 0.1379) % 1, a = k * 2.399963 + time * 0.018;
      const r = 0.95 + (k % 5) * 0.14 + rise * 0.25, v: Vec = [Math.cos(a) * r, 1.15 - rise * 2.5, Math.sin(a) * r];
      const glow = Math.sin(rise * Math.PI) * (0.25 + 0.75 * daylight(v)) * nearness(v[2]);
      dot(ctx, ...screen(v), `${k % 3 ? t.sun : k % 2 ? t.leaf : t.third}${alpha(glow * (0.8 + celebration * 0.2))}`, (0.8 + (k % 4) * 0.25) * detailScale);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const narrow = w < 480;
  u.experiments.forEach((e, index) => {
    if ((ambient || narrow) && index !== focus) return;
    const group = points.filter((_, i) => i % 7 === index);
    const x = group.reduce((sum, p) => sum + p[0], 0) / group.length, y = group.reduce((sum, p) => sum + p[1], 0) / group.length;
    if (!ambient && !narrow) {
      const side = index % 2 ? 1 : -1, lx = cx + side * Math.min(w * 0.33, size * 0.88), ly = 50 + index / 6 * Math.max(0, h - 100);
      line(ctx, x, y, lx - side * 6, ly, index === focus ? `${t.warning}aa` : `${t.secondary}40`, 0.6);
      text(ctx, e.id, lx, ly - 3, index === focus ? t.warning : t.muted, 8, side > 0 ? 'left' : 'right');
      text(ctx, `${(e.convergence * 100).toFixed(1)}%`, lx, ly + 9, t.faint, 7, side > 0 ? 'left' : 'right');
    }
    if (index === focus) {
      const radius = 8 + (time * 0.45 % 1) * size * 0.35;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 0.4, -0.3, 0, Math.PI * 2); ctx.strokeStyle = `${t.warning}70`; ctx.lineWidth = 0.8 * strokeScale; ctx.stroke();
    }
  });
  if (ambient) return; // Keep moving highlights; omit labels, axes, and corner matrix.
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(project);
  label(ctx, 'LATENT OBSERVATORY / 3D', 16, 20, t.muted, t.panel, 9);
  label(ctx, `144 LATENT VECTORS · ${u.traces.length} TENDRIL${u.traces.length === 1 ? '' : 'S'}`, 16, h - 18, t.muted, t.panel, 9);
  label(ctx, focus >= 0 ? `${trace!.id} / PROPAGATING` : `H(S) ${u.branches.entropy.toFixed(6)}`, w - 16, h - 18, focus >= 0 ? t.warning : t.accent, t.panel, 9, 'right');
  if (!narrow) text(ctx, '+ψ₃', corners[6][0] + 8, corners[6][1], t.faint, 9);
  const cell = 4, ox = w - 64, oy = 18;
  u.world.coupling.forEach((v, i) => { ctx.fillStyle = v > 0 ? `${t.accent}${Math.floor(70 + v * 185).toString(16).padStart(2, '0')}` : t.line; ctx.fillRect(ox + i % 8 * 6, oy + Math.floor(i / 8) * 6, cell, cell); });
}
