// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUniverse } from '../src/core/universe.ts';
import { LIMITS, type CausalTrace, type Universe } from '../src/core/types.ts';
import { drawWorld, GROWTH_SECONDS, tendrilGrowth, tendrilPath, traceHash } from '../src/rendering/world.ts';
import { quantumLayout } from '../src/rendering/panes.ts';
import { getTheme, themes } from '../src/rendering/themes.ts';

function trace(u: Universe, n: number, age = u.age): CausalTrace {
  return { id: `TRC-${n.toString(16).toUpperCase().padStart(6, '0')}`, age, eventSeq: n, agent: u.agents[0].id, experiment: u.experiments[n % u.experiments.length].id, cause: 'c', experimentEffect: 'e', worldEffect: 'w' };
}

test('tendrils grow from bud to bloom over simulated time', () => {
  const u = createUniverse(3), item = trace(u, 1, 100);
  assert.equal(tendrilGrowth(item, 99), 0);
  assert.equal(tendrilGrowth(item, 100), 0);
  assert.equal(tendrilGrowth(item, 100 + GROWTH_SECONDS), 1);
  let previous = 0;
  for (let age = 100; age <= 100 + GROWTH_SECONDS; age += 0.5) { const g = tendrilGrowth(item, age); assert.ok(g >= previous); previous = g; }
});

test('tendril shape derives from trace identity and roots in its experiment', () => {
  const u = createUniverse(11), before = structuredClone(u);
  for (let n = 0; n < 20; n++) {
    const item = trace(u, n), path = tendrilPath(u, item)!, experiment = u.experiments.findIndex(e => e.id === item.experiment);
    assert.deepEqual(path, tendrilPath(u, item));
    const root = u.world.coordinates.findIndex(v => v.every((value, axis) => Math.abs(value - path[0][axis]) < 1e-12));
    assert.ok(root >= 0 && root % 7 === experiment);
    assert.ok(path.flat().every(Number.isFinite));
  }
  assert.equal(tendrilPath(u, { ...trace(u, 1), experiment: 'EXP-GONE' }), undefined);
  assert.notEqual(traceHash('TRC-000001'), traceHash('TRC-000002'));
  assert.deepEqual(u, before);
});

test('a full causal garden keeps ambient view label-free, bounded, and read-only', () => {
  const u = createUniverse(42);
  for (let n = 0; n < LIMITS.traces; n++) u.traces.push(trace(u, n, u.age - n));
  const before = structuredClone(u), labels: unknown[] = [], rectangles: unknown[] = [], radii: number[] = [];
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key === 'fillText') return (value: unknown) => labels.push(value);
      if (key === 'fillRect') return (...args: unknown[]) => rectangles.push(args);
      if (key === 'arc') return (_x: number, _y: number, radius: number) => radii.push(radius);
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
  }) as CanvasRenderingContext2D;
  drawWorld(ctx, u, getTheme('solarpunk'), 1440, 900, 120, true);
  assert.equal(labels.length, 0);
  assert.equal(rectangles.length, 1);
  assert.ok(radii.every(r => r >= 0 && r < 140));
  assert.deepEqual(u, before);
});

test('quantum pane zones never overlap at dashboard or phone sizes', () => {
  for (const [w, h] of [[300, 135], [302, 180], [360, 250], [520, 320], [180, 120]]) {
    const q = quantumLayout(w, h);
    assert.ok(q.cx + q.r < q.left, `sphere clears readout at ${w}×${h}`);
    assert.ok(q.cy - q.r - 14 >= 0 && q.cy + q.r <= h, `sphere fits vertically at ${w}×${h}`);
    assert.ok(q.caption + 4 < q.bottom - q.chartHeight, `caption sits above chart at ${w}×${h}`);
  }
});

test('every theme supplies daylight and growth colors', () => {
  assert.ok(themes.some(t => t.id === 'solarpunk'));
  for (const t of themes) for (const color of [t.sun, t.leaf]) assert.match(color, /^#[0-9a-f]{6}$/);
});
