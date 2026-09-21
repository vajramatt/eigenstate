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
  assert.equal(director.update(5_000).worldBrightness, 0.75);
  assert.equal(director.update(184_999).world, true);
  assert.equal(director.update(185_000).world, false);
  director.enterWorld(190_000);
  assert.equal(director.update(190_000, { still: true }).worldBrightness, 0.75);
  director.reset(195_000);
  assert.equal(director.update(195_000).world, false);
  assert.equal(director.update(269_999).world, false);
  assert.equal(director.update(270_000).world, true);
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
