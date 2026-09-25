// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmbientDirector } from '../src/rendering/ambient.ts';
import { drawWorld } from '../src/rendering/world.ts';
import { createUniverse } from '../src/core/universe.ts';
import { getTheme } from '../src/rendering/themes.ts';

test('manual world entry starts immediately with a fresh scene and normal exit behavior', () => {
  const director = new AmbientDirector();
  director.enterWorld(5_000);
  assert.equal(director.update(5_000).world, true);
  assert.equal(director.update(5_000).worldBrightness, 1);
  assert.equal(director.update(80_000).worldBrightness, 1);
  assert.ok(director.update(95_000).worldBrightness < 1);
  assert.equal(director.update(184_999).world, true);
  assert.equal(director.update(185_000).world, false);
  assert.ok(director.update(230_000).worldBrightness < 0.75);
  director.enterWorld(190_000);
  assert.equal(director.update(190_000, { still: true }).worldBrightness, 1);
  director.reset(195_000);
  assert.equal(director.update(195_000).world, false);
  assert.equal(director.update(269_999).world, false);
  assert.equal(director.update(270_000).world, true);
});

test('fullscreen keeps camera orientation, scales details within bounds, and retains moving highlights', () => {
  const universe = createUniverse(42), theme = getTheme('eigenstate');
  function render(w: number, h: number, ambient: boolean) {
    const radii: number[] = [], strokes: number[] = [], starts: number[][] = [], labels: string[] = [], highlights: number[][] = [];
    let halo: number[] = [], width = 0;
    const ctx = new Proxy({}, {
      set(_target, key, value) { if (key === 'lineWidth') width = value; return true; },
      get(_target, key) {
        if (key === 'arc') return (_x: number, _y: number, radius: number) => radii.push(radius);
        if (key === 'moveTo') return (...args: number[]) => starts.push(args);
        if (key === 'stroke') return () => strokes.push(width);
        if (key === 'fillText') return (value: string) => labels.push(value);
        if (key === 'ellipse') return (...args: number[]) => highlights.push(args);
        if (key === 'createRadialGradient') return (...args: number[]) => { if (!halo.length) halo = args; return { addColorStop() {} }; };
        return () => {};
      },
    }) as CanvasRenderingContext2D;
    drawWorld(ctx, universe, theme, w, h, 90, ambient);
    return { radii, strokes, labels, highlights, direction: starts[0].map((coordinate, axis) => (coordinate - halo[axis]) / halo[5]) };
  }
  const dashboard = render(500, 300, false), full = render(1440, 1000, true), huge = render(7680, 4320, true);
  full.direction.forEach((value, axis) => assert.ok(Math.abs(value - dashboard.direction[axis]) < 1e-9));
  assert.ok(full.radii[0] > dashboard.radii[0]);
  assert.ok(full.strokes[0] > dashboard.strokes[0]);
  assert.ok(Math.max(...huge.radii) <= Math.max(...dashboard.radii) * 2.2 + 1e-9);
  assert.ok(huge.strokes[0] <= dashboard.strokes[0] * 1.7);
  assert.equal(full.highlights.length, 0);
  universe.traces.push({ id: 'TRC-000001', age: universe.age, eventSeq: 1, agent: universe.agents[0].id, experiment: universe.experiments[0].id, cause: 'topology', experimentEffect: 'capacity', worldEffect: 'displacement' });
  const before = structuredClone(universe), highlighted = render(1440, 1000, true);
  assert.equal(highlighted.highlights.length, 1);
  assert.equal(highlighted.labels.length, 0);
  assert.deepEqual(universe, before);
});

test('idle view has a bounded dashboard dwell and alternates return layouts', () => {
  const director = new AmbientDirector(1000);
  assert.equal(director.update(75_999).world, false);
  assert.equal(director.update(76_000).world, true);
  assert.equal(director.update(255_999).world, true);
  const dashboard = director.update(256_000);
  assert.equal(dashboard.world, false);
  assert.equal(dashboard.alternateLayout, true);
  assert.equal(director.update(301_000).world, true);
  const secondDashboard = director.update(481_000);
  assert.equal(secondDashboard.world, false);
  assert.equal(secondDashboard.alternateLayout, false);
});

test('world events can start a scene after one minute without restarting its cycle', () => {
  const director = new AmbientDirector();
  assert.equal(director.update(59_999, { worldEvent: true }).world, false);
  assert.equal(director.update(60_000, { worldEvent: true }).world, true);
  assert.equal(director.update(239_999, { worldEvent: true }).world, true);
  assert.equal(director.update(240_000, { worldEvent: true }).world, false);
});

test('input and blocked states restore brightness, layout, and a fresh idle countdown', () => {
  const director = new AmbientDirector();
  director.update(75_000);
  director.update(270_000);
  director.reset(270_000);
  const restored = director.update(270_000);
  assert.equal(restored.world, false);
  assert.equal(restored.brightness, 1);
  assert.equal(restored.alternateLayout, false);
  assert.equal(director.update(344_999).world, false);
  assert.equal(director.update(345_000).world, true);
  for (const time of [400_000, 800_000, 1_000_000]) {
    assert.equal(director.update(time, { blocked: true }).world, false);
  }
  assert.equal(director.update(1_074_999).world, false);
  assert.equal(director.update(1_075_000).world, true);
});

test('dimming is bounded and still scenes reach black without disabling idle protection', () => {
  const director = new AmbientDirector();
  assert.equal(director.update(75_000, { still: true }).worldBrightness, 0.75);
  assert.ok(director.update(90_000, { still: true }).worldBrightness < 0.375);
  const black = director.update(105_000, { still: true });
  assert.equal(black.world, true); assert.equal(black.worldBrightness, 0);
  let previous = 1;
  for (let time = 105_000; time < 86_400_000; time += 17_000) {
    const state = director.update(time);
    assert.ok(state.brightness <= previous && state.brightness >= 0.38);
    previous = state.brightness;
  }
});

test('ambient rendering removes every text label and matrix cell, moves its glow, and preserves state', () => {
  const universe = createUniverse(42), before = structuredClone(universe);
  const labels: unknown[][] = [], rectangles: unknown[][] = [], glows: number[][] = [];
  let dots = 0;
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key === 'fillText') return (...args: unknown[]) => labels.push(args);
      if (key === 'fillRect') return (...args: unknown[]) => rectangles.push(args);
      if (key === 'arc') return () => dots++;
      if (key === 'createRadialGradient') return (...args: number[]) => { glows.push(args); return { addColorStop() {} }; };
      return () => {};
    },
  }) as CanvasRenderingContext2D;
  drawWorld(ctx, universe, getTheme('eigenstate'), 1440, 900, 0, true);
  assert.equal(labels.length, 0);
  assert.equal(rectangles.length, 1); // Only the moving halo, no fixed corner cells.
  assert.ok(dots >= 144);
  drawWorld(ctx, universe, getTheme('eigenstate'), 1440, 900, 90, true);
  assert.notDeepEqual(glows[0], glows[1]);
  assert.deepEqual(universe, before);
  drawWorld(ctx, universe, getTheme('eigenstate'), 1440, 900, 90);
  assert.ok(labels.length > 0); // Normal dashboard still includes its readouts.
  assert.ok(rectangles.length > 64);
});
