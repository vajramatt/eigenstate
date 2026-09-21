// SPDX-License-Identifier: MIT
import type { Universe } from '../core/types.ts';
import type { Theme } from './themes.ts';
import { dot, line, text, type Ctx } from './drawing.ts';

export function drawWorld(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age, ambient = false): void {
  const phase = time + u.seed % 997;
  const size = ambient ? Math.min(w, h) * (0.64 + Math.sin(phase * 0.019) * 0.07) : Math.min(w * 0.7, h * 0.95);
  const cx = w * (ambient ? 0.5 + Math.sin(phase * 0.013) * 0.16 : 0.49);
  const cy = h * (ambient ? 0.5 + Math.cos(phase * 0.017) * 0.13 : 0.5);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  halo.addColorStop(0, `${t.secondary}20`); halo.addColorStop(0.55, `${t.accent}09`); halo.addColorStop(1, `${t.background}00`);
  ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
  const angle = time * 0.055, c = Math.cos(angle), s = Math.sin(angle);
  const tilt = ambient ? Math.sin(phase * 0.023) * 0.32 : 0;
  const project = ([x, y, z]: number[]): [number, number] => {
    const rx = x * c - z * s, rz = x * s + z * c;
    const perspective = 3.8 / (3.8 + rz);
    const py = y * 0.88 - rz * 0.3;
    return [cx + (rx * Math.cos(tilt) - py * Math.sin(tilt)) * size * 0.5 * perspective, cy + (rx * Math.sin(tilt) + py * Math.cos(tilt)) * size * 0.5 * perspective];
  };
  // Slow camera orbit reveals the persisted state geometry; it does not change it.
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(project);
  for (let orbit = 0; orbit < 3; orbit++) {
    let previous: [number, number] | undefined;
    for (let j = 0; j <= 96; j++) {
      const a = j / 96 * Math.PI * 2, r = 1.12 + orbit * 0.1;
      const p = project(orbit === 0 ? [Math.cos(a)*r, Math.sin(a)*r, 0] : orbit === 1 ? [Math.cos(a)*r, 0, Math.sin(a)*r] : [0, Math.cos(a)*r, Math.sin(a)*r]);
      if (previous) line(ctx, ...previous, ...p, `${t.secondary}45`, 0.65);
      if (j % 8 === 0) dot(ctx, ...p, `${t.accent}80`, 1);
      previous = p;
    }
  }
  const points = u.world.coordinates.map(project);
  const trace = u.traces.at(-1), focus = trace && u.age - trace.age < 10 ? u.experiments.findIndex(e => e.id === trace.experiment) : -1;
  points.forEach((p, i) => {
    if (i > 0) line(ctx, ...points[i - 1], ...p, `${i % 7 < 3 ? t.accent : t.secondary}55`, 0.65);
    if (i + 26 < points.length && u.world.coupling[i % 64] > 0.55) {
      const other = points[i + 26], travel = (time * 0.23 + i * 0.173) % 1;
      line(ctx, ...p, ...other, `${t.secondary}40`);
      dot(ctx, p[0] + (other[0] - p[0]) * travel, p[1] + (other[1] - p[1]) * travel, t.accent, 1.7);
    }
    const e = u.experiments[i % 7];
    const depth = u.world.coordinates[i][0] * s + u.world.coordinates[i][2] * c;
    const color = i % 7 === focus ? t.warning : i % 7 < 3 ? t.accent : t.secondary;
    const radius = (1 + e.convergence * 1.6) * 3.8 / (3.8 + depth);
    dot(ctx, ...p, `${color}14`, radius * 3.5);
    dot(ctx, ...p, color, radius);
    if (depth < -0.3) dot(ctx, ...p, t.text, 0.7);
  });
  if (ambient) return; // No labels, leader lines, axes, or corner matrix in idle scenes.
  u.experiments.forEach((e, index) => {
    const group = points.filter((_, i) => i % 7 === index);
    const x = group.reduce((sum, p) => sum + p[0], 0) / group.length, y = group.reduce((sum, p) => sum + p[1], 0) / group.length;
    const side = index % 2 ? 1 : -1, lx = cx + side * Math.min(w * 0.33, size * 0.88), ly = 50 + index / 6 * Math.max(0, h - 100);
    line(ctx, x, y, lx - side * 6, ly, index === focus ? `${t.warning}aa` : `${t.secondary}40`, 0.6);
    text(ctx, e.id, lx, ly - 3, index === focus ? t.warning : t.muted, 8, side > 0 ? 'left' : 'right');
    text(ctx, `${(e.convergence * 100).toFixed(1)}%`, lx, ly + 9, t.faint, 7, side > 0 ? 'left' : 'right');
    if (index === focus) {
      const radius = 8 + (time * 0.45 % 1) * size * 0.35;
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * 0.4, -0.3, 0, Math.PI * 2); ctx.strokeStyle = `${t.warning}70`; ctx.lineWidth = 0.8; ctx.stroke();
    }
  });
  text(ctx, 'LATENT OBSERVATORY / 3D', 16, 20, t.muted, 9);
  text(ctx, '144 LATENT VECTORS', 16, h - 18, t.muted, 9);
  text(ctx, focus >= 0 ? `${trace!.id} / PROPAGATING` : `H(S) ${u.branches.entropy.toFixed(6)}`, w - 16, h - 18, focus >= 0 ? t.warning : t.accent, 9, 'right');
  text(ctx, '+ψ₃', corners[6][0] + 8, corners[6][1], t.faint, 9);
  const cell = 4, ox = w - 64, oy = 18;
  u.world.coupling.forEach((v, i) => { ctx.fillStyle = v > 0 ? `${t.accent}${Math.floor(70 + v * 185).toString(16).padStart(2, '0')}` : t.line; ctx.fillRect(ox + i % 8 * 6, oy + Math.floor(i / 8) * 6, cell, cell); });
}
