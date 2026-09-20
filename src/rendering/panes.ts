// SPDX-License-Identifier: MIT
import type { Universe } from '../core/types.ts';
import type { Theme } from './themes.ts';
import { compact } from '../core/simulation.ts';
import { dot, grid, line, plot, text, type Ctx } from './drawing.ts';
import { drawWorld } from './world.ts';

export type PaneKind = 'world' | 'agents' | 'branches' | 'quantum' | 'inference' | 'resources';
export const REFRESH: Record<PaneKind, number> = { world: 2400, agents: 3900, branches: 3100, quantum: 1800, inference: 1300, resources: 4700 };

function drawAgents(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age): void {
  grid(ctx, w, h, t, 28);
  const graphWidth = w * 0.72, middle = graphWidth * 0.51;
  const points = u.agents.map((a, i) => {
    const id = parseInt(a.id.slice(4), 16) || i;
    const angle = id * 2.399963 + Math.sin(time * 0.13 + id) * 0.08;
    const ring = 0.61 + (id % 3) * 0.13 + Math.sin(time * 0.19 + id) * 0.025;
    return { id: a.id, x: middle + Math.cos(angle) * graphWidth * 0.38 * ring, y: h * 0.49 + Math.sin(angle) * h * 0.35 * ring };
  });
  u.agents.forEach((a, i) => {
    a.dependencies.forEach(id => {
      const other = points.find(p => p.id === id); if (!other) return;
      const p = points[i]; line(ctx, p.x, p.y, other.x, other.y, `${t.secondary}66`);
      if (a.status === 'active') {
        const progress = (time * 0.3 + i * 0.17) % 1;
        dot(ctx, p.x + (other.x - p.x) * progress, p.y + (other.y - p.y) * progress, t.secondary, 1.8);
      }
    });
  });
  u.agents.forEach((a, i) => {
    const p = points[i]; dot(ctx, p.x, p.y, a.status === 'active' ? t.accent : t.faint, a.status === 'active' ? 3 : 2);
    if (i % 3 === 0) text(ctx, a.id, p.x + 7, p.y - 7, t.muted, 8);
  });
  line(ctx, w * 0.74, 18, w * 0.74, h - 18, t.line);
  const x = w * 0.78;
  text(ctx, `${u.agents.length}`, x, 36, t.text, 27);
  text(ctx, 'agents', x, 60, t.muted, 10);
  text(ctx, `${u.agents.filter(a => a.status === 'active').length} active`, x, 85, t.accent, 10);
  text(ctx, `${u.agents.filter(a => a.status === 'waiting').length} waiting`, x, 105, t.muted, 10);
  if (h > 190) {
    text(ctx, 'CONSENSUS', x, h - 48, t.faint, 8);
    text(ctx, u.inference.agreement.toFixed(6), x, h - 29, t.secondary, 11);
  }
  text(ctx, `${u.agents[0].id} → ${u.agents[0].experiment}`, 15, h - 13, t.muted, 8);
}
function drawBranches(ctx: Ctx, u: Universe, t: Theme, w: number, h: number): void {
  const history = u.history, totalHeight = h * 0.64;
  grid(ctx, w, totalHeight, t, 28);
  const root: [number, number] = [20, totalHeight * 0.5];
  dot(ctx, ...root, t.accent, 3);
  // A summary fan per experiment, not a fabricated explicit branch tree.
  u.experiments.forEach((e, i) => {
    const x = w * 0.44, y = 15 + i / 6 * (totalHeight - 30);
    line(ctx, ...root, x, y, `${t.secondary}88`); dot(ctx, x, y, t.secondary, 2);
    const end = w - 22, endY = y + (e.convergence - 0.5) * 20;
    line(ctx, x, y, end, endY, `${t.accent}99`); dot(ctx, end, endY, t.accent, 2.5);
    text(ctx, e.id.slice(4), x + 8, y - 9, t.faint, 8);
  });
  const y = totalHeight + 10;
  line(ctx, 12, y, w - 12, y, t.line);
  plot(ctx, history.map(p => p.entropy), 12, y + 10, w - 24, h - y - 26, t.secondary);
  plot(ctx, history.map(p => p.confidence), 12, y + 10, w - 24, h - y - 26, t.accent);
  text(ctx, 'entropy / confidence', 12, h - 9, t.muted, 8);
}
function drawQuantum(ctx: Ctx, u: Universe, t: Theme, w: number, h: number): void {
  const q = u.quantum, cx = w * 0.3, cy = h * 0.31, r = Math.min(w * 0.2, h * 0.25);
  for (const ratio of [1, 0.37]) {
    ctx.beginPath(); ctx.strokeStyle = t.line; ctx.lineWidth = 0.8; ctx.ellipse(cx, cy, r, r * ratio, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.37, r, 0, 0, Math.PI * 2); ctx.stroke();
  const phase = q.phases[q.collapsed];
  const x = cx + Math.cos(phase) * r * Math.sqrt(q.probabilities[q.collapsed]), y = cy - Math.sin(phase) * r;
  line(ctx, cx, cy, x, y, t.accent, 1.3); dot(ctx, x, y, t.accent, 3);
  text(ctx, '|0⟩', cx, cy - r - 8, t.muted, 9, 'center');
  text(ctx, 'ENTANGLEMENT', w * 0.58, cy - 16, t.faint, 8); text(ctx, q.entanglement.toFixed(4), w * 0.58, cy + 5, t.accent, 18);
  text(ctx, `depth ${q.depth}`, w * 0.58, cy + 28, t.muted, 9);
  const bottom = h - 24, chartHeight = h * 0.32, bw = (w - 32) / 8;
  q.probabilities.forEach((p, i) => {
    ctx.fillStyle = i === q.collapsed ? t.accent : `${t.secondary}80`;
    ctx.fillRect(16 + i * bw + 2, bottom - p * chartHeight * 3, bw - 7, p * chartHeight * 3);
    text(ctx, i.toString(2).padStart(3, '0'), 16 + i * bw + bw / 2, bottom + 13, t.faint, 8, 'center');
  });
  line(ctx, 16, bottom + 1, w - 16, bottom + 1, t.line);
}
function drawInference(ctx: Ctx, u: Universe, t: Theme, w: number, h: number): void {
  const n = u.inference, cols = 12, cellW = (w - 32) / cols, cellH = Math.min(13, h * 0.045);
  text(ctx, 'LAYER ACTIVATION', 16, 15, t.muted, 8);
  n.layers.forEach((v, i) => { ctx.fillStyle = `${i % 3 === 0 ? t.secondary : t.accent}${Math.floor(v * 210 + 35).toString(16).padStart(2, '0')}`; ctx.fillRect(16 + i % cols * cellW, 30 + Math.floor(i / cols) * (cellH + 3), cellW - 3, cellH); });
  const startY = 42 + 4 * (cellH + 3), rowSpacing = Math.max(18, (h - startY - 24) / 3);
  for (const [i, value] of [n.context, n.load, n.agreement].entries()) {
    const y = startY + i * rowSpacing;
    text(ctx, ['context', 'inference load', 'agreement'][i], 16, y, t.muted, 9);
    text(ctx, `${(value * 100).toFixed(1)}%`, w - 16, y, t.accent, 9, 'right');
    ctx.fillStyle = t.line; ctx.fillRect(16, y + 7, w - 32, 2); ctx.fillStyle = t.secondary; ctx.fillRect(16, y + 7, (w - 32) * value, 2);
  }
  if (h > 190) text(ctx, `${compact(n.retrievals)} retrievals`, 16, h - 11, t.faint, 8);
}
function drawResources(ctx: Ctx, u: Universe, t: Theme, w: number, h: number): void {
  const names = ['inference', 'quantum', 'branches', 'reserve'], colors = [t.accent, t.secondary, t.third, t.faint];
  u.resources.allocations.forEach((v, i) => {
    const y = 22 + i * (h - 35) / 4;
    text(ctx, names[i], 12, y, t.muted, 9); text(ctx, `${(v * 100).toFixed(1)}%`, w - 12, y, colors[i], 9, 'right');
    ctx.fillStyle = t.line; ctx.fillRect(12, y + 14, w - 24, 4); ctx.fillStyle = colors[i]; ctx.fillRect(12, y + 14, (w - 24) * v, 4);
  });
}
export function drawPane(kind: PaneKind, ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age): void {
  ctx.clearRect(0, 0, w, h); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ({ world: drawWorld, agents: drawAgents, branches: drawBranches, quantum: drawQuantum, inference: drawInference, resources: drawResources }[kind])(ctx, u, t, w, h, time);
  ctx.restore();
}
