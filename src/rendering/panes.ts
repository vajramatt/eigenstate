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
  const trace = u.traces.at(-1), traceAge = trace ? u.age - trace.age : Infinity;
  // Confidence rings and causal emphasis describe the actual nodes.
  for (const radius of [0.23, 0.34]) {
    ctx.beginPath(); ctx.strokeStyle = t.line; ctx.lineWidth = 0.5;
    ctx.ellipse(middle, h * 0.49, graphWidth * radius, h * radius, 0, 0, Math.PI * 2); ctx.stroke();
  }
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
    const p = points[i], affected = traceAge < 10 && trace?.experiment === a.experiment;
    const color = affected ? t.warning : a.status === 'active' ? t.accent : t.faint;
    dot(ctx, p.x, p.y, `${color}18`, 10);
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.arc(p.x, p.y, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.confidence); ctx.stroke();
    dot(ctx, p.x, p.y, color, a.status === 'active' ? 3 : 2);
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
function drawBranches(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age): void {
  const history = u.history, totalHeight = h * 0.64;
  grid(ctx, w, totalHeight, t, 28);
  const root: [number, number] = [20, totalHeight * 0.5];
  dot(ctx, ...root, t.accent, 3);
  const trace = u.traces.at(-1), traceAge = trace ? u.age - trace.age : Infinity;
  // A summary fan per experiment, not a fabricated explicit branch tree.
  u.experiments.forEach((e, i) => {
    const x = w * 0.44, y = 15 + i / Math.max(1, u.experiments.length - 1) * (totalHeight - 30);
    const end = w - 22, endY = y + (e.convergence - 0.5) * 12;
    const affected = traceAge < 10 && trace?.experiment === e.id, color = affected ? t.warning : t.accent;
    const point = (p: number): [number, number] => {
      const smooth = p * p * (3 - 2 * p);
      const inverse = 1 - p;
      return [inverse ** 3 * root[0] + 3 * inverse ** 2 * p * w * 0.38 + 3 * inverse * p ** 2 * w * 0.58 + p ** 3 * end, root[1] + (endY - root[1]) * smooth];
    };
    ctx.beginPath(); ctx.moveTo(...root);
    ctx.bezierCurveTo(w * 0.38, root[1], w * 0.58, endY, end, endY);
    ctx.strokeStyle = `${color}65`; ctx.lineWidth = 0.6 + e.allocation * 5; ctx.stroke();
    dot(ctx, end, endY, `${color}20`, 5 + e.convergence * 3);
    dot(ctx, end, endY, color, 2.5);
    // One result packet crosses each path at a different phase. This is a
    // read-only presentation clock: it never advances branch state or PRNG.
    const packet = (time * 0.16 + i * 0.137) % 1;
    dot(ctx, ...point(packet), color, 2);
    if (affected) {
      const flare = traceAge % 2;
      ctx.beginPath(); ctx.strokeStyle = `${t.warning}${Math.round((1 - flare / 2) * 190).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 1; ctx.arc(end, endY, 3 + flare * 5, 0, Math.PI * 2); ctx.stroke();
    }
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
  // Eight synthetic basis phases, with probability encoded as node size.
  q.phases.forEach((angle, i) => {
    const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r * 0.54;
    const color = i === q.collapsed ? t.warning : t.secondary;
    line(ctx, cx, cy, px, py, `${color}35`);
    dot(ctx, px, py, `${color}20`, 4 + q.probabilities[i] * 10);
    dot(ctx, px, py, color, 1.3 + q.probabilities[i] * 5);
  });
  const phase = q.phases[q.collapsed];
  const x = cx + Math.cos(phase) * r * Math.sqrt(q.probabilities[q.collapsed]), y = cy - Math.sin(phase) * r;
  line(ctx, cx, cy, x, y, t.accent, 1.3); dot(ctx, x, y, t.accent, 3);
  text(ctx, '|0⟩', cx, cy - r - 8, t.muted, 9, 'center');
  text(ctx, 'ENTANGLEMENT', w * 0.58, cy - 16, t.faint, 8); text(ctx, q.entanglement.toFixed(4), w * 0.58, cy + 5, t.accent, 18);
  text(ctx, `depth ${q.depth}`, w * 0.58, cy + 28, t.muted, 9);
  const bottom = h - 24, chartHeight = h * 0.32, bw = (w - 32) / 8;
  q.probabilities.forEach((p, i) => {
    const height = p * chartHeight, left = 16 + i * bw + 2;
    ctx.fillStyle = t.line; ctx.fillRect(left, bottom - chartHeight, bw - 7, chartHeight);
    ctx.fillStyle = i === q.collapsed ? `${t.warning}80` : `${t.secondary}80`;
    ctx.fillRect(left, bottom - height, bw - 7, height);
    line(ctx, left, bottom - height, left + bw - 7, bottom - height, i === q.collapsed ? t.warning : t.accent, 1.5);
    text(ctx, i.toString(2).padStart(3, '0'), 16 + i * bw + bw / 2, bottom + 13, t.faint, 8, 'center');
  });
  line(ctx, 16, bottom + 1, w - 16, bottom + 1, t.line);
  text(ctx, 'BASIS PROBABILITY / 0–1', 16, bottom - chartHeight - 10, t.faint, 7);
}
function drawInference(ctx: Ctx, u: Universe, t: Theme, w: number, h: number, time = u.age): void {
  const n = u.inference, cols = 12, cellW = (w - 32) / cols, cellH = Math.min(13, h * 0.045);
  text(ctx, 'LAYER ACTIVATION', 16, 15, t.muted, 8);
  const scan = time * 2.4 % cols;
  n.layers.forEach((v, i) => {
    const column = i % cols, wave = (Math.sin(time * 1.35 + i * 0.58) + 1) * 0.5;
    const distance = Math.min(Math.abs(column - scan), cols - Math.abs(column - scan));
    const sweep = Math.max(0, 1 - distance / 1.7), level = Math.min(1, v * 0.72 + wave * 0.18 + sweep * 0.3);
    ctx.fillStyle = `${i % 3 === 0 ? t.secondary : t.accent}${Math.floor(level * 210 + 35).toString(16).padStart(2, '0')}`;
    ctx.fillRect(16 + column * cellW, 30 + Math.floor(i / cols) * (cellH + 3), cellW - 3, cellH);
  });
  const startY = 42 + 4 * (cellH + 3), rowSpacing = Math.max(18, (h - startY - 24) / 3);
  for (const [i, value] of [n.context, n.load, n.agreement].entries()) {
    const y = startY + i * rowSpacing;
    text(ctx, ['context', 'inference load', 'agreement'][i], 16, y, t.muted, 9);
    text(ctx, `${(value * 100).toFixed(1)}%`, w - 16, y, t.accent, 9, 'right');
    ctx.fillStyle = t.line; ctx.fillRect(16, y + 7, w - 32, 2); ctx.fillStyle = t.secondary; ctx.fillRect(16, y + 7, (w - 32) * value, 2);
    const packet = (time * (0.24 + i * 0.07) + i * 0.31) % 1;
    dot(ctx, 16 + (w - 32) * value * packet, y + 8, i === 1 ? t.warning : t.accent, 1.6);
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
