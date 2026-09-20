// SPDX-License-Identifier: MIT
import type { Universe } from '../core/types.ts';
import type { Theme } from './themes.ts';
import { dot, grid, line, text, type Ctx } from './drawing.ts';

export function drawWorld(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age): void {
  grid(ctx, w, h, t, 32);
  const size = Math.min(w * 0.58, h * 0.79), cx = w * 0.49, cy = h * 0.5;
  const angle = time * 0.035, c = Math.cos(angle), s = Math.sin(angle);
  const project = ([x, y, z]: number[]): [number, number] => {
    const rx = x * c - z * s, rz = x * s + z * c;
    return [cx + (rx * 0.85 + rz * 0.45) * size * 0.5, cy + (y * 0.83 - rz * 0.25) * size * 0.5];
  };
  // Slow camera orbit reveals the persisted state geometry; it does not change it.
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(project);
  for (const [a, b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) line(ctx, ...corners[a], ...corners[b], `${t.line}cc`);
  const points = u.world.coordinates.map(project);
  points.forEach((p, i) => {
    if (i > 0) line(ctx, ...points[i - 1], ...p, `${i % 7 < 3 ? t.accent : t.secondary}55`, 0.65);
    if (i + 26 < points.length && u.world.coupling[i % 64] > 0.55) line(ctx, ...p, ...points[i + 26], `${t.secondary}40`);
    const e = u.experiments[i % 7];
    dot(ctx, ...p, i % 7 < 3 ? t.accent : t.secondary, 1 + e.convergence * 1.2);
  });
  const labels = [0, 38, 75, 115];
  labels.forEach(i => { const p = points[i]; line(ctx, p[0], p[1], p[0] + 22, p[1] - 16, t.faint); text(ctx, u.experiments[i % 7].id, p[0] + 26, p[1] - 16, t.muted, 8); });
  text(ctx, 'PROJECTION   ψ₁ / ψ₂ / ψ₃', 16, 20, t.muted, 9);
  text(ctx, '144 LATENT VECTORS', 16, h - 18, t.muted, 9);
  text(ctx, `H(S) ${u.branches.entropy.toFixed(6)}`, w - 16, h - 18, t.accent, 9, 'right');
  text(ctx, '+ψ₃', corners[6][0] + 8, corners[6][1], t.faint, 9);
  const cell = 4, ox = w - 64, oy = 18;
  u.world.coupling.forEach((v, i) => { ctx.fillStyle = v > 0 ? `${t.accent}${Math.floor(70 + v * 185).toString(16).padStart(2, '0')}` : t.line; ctx.fillRect(ox + i % 8 * 6, oy + Math.floor(i / 8) * 6, cell, cell); });
}
