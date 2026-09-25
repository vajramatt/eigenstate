// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUniverse } from '../src/core/universe.ts';
import { advance } from '../src/core/simulation.ts';
import { glimpse, homecoming, HOMECOMING_SECONDS, milestoneBetween, universeName } from '../src/core/homecoming.ts';
import { drawWorld, festivalEnvelope } from '../src/rendering/world.ts';
import { getTheme } from '../src/rendering/themes.ts';

test('a universe is always called the same thing, and names vary across seeds', () => {
  assert.equal(universeName(12345), universeName(12345));
  assert.match(universeName(12345), /^The \w+ \w+ of [\w ]+$/);
  const names = new Set(Array.from({ length: 400 }, (_, seed) => universeName(seed * 7919 + 1)));
  assert.ok(names.size > 300);
});

test('milestones report the most recent one crossed, once', () => {
  assert.equal(milestoneBetween(3_599, 3_600), 'one hour old');
  assert.equal(milestoneBetween(3_600, 3_601), null);
  assert.equal(milestoneBetween(0, 8 * 86_400), 'one week old');
  assert.equal(milestoneBetween(364 * 86_400, 366 * 86_400), 'one year old');
  assert.equal(milestoneBetween(729 * 86_400, 731 * 86_400), 'two years old');
  assert.equal(milestoneBetween(100, 50), null);
});

test('the universe says hello only after a real absence, with honest counts', () => {
  const u = createUniverse(21), before = glimpse(u), untouched = structuredClone(u);
  assert.equal(homecoming(before, u, 9), null);
  advance(u, HOMECOMING_SECONDS - 1);
  assert.equal(homecoming(before, u, 9), null);
  advance(u, 3 * 86_400);
  const card = homecoming(before, u, 9)!;
  assert.equal(card.greeting, 'Good morning.');
  assert.match(card.away, /^3 days/);
  assert.equal(card.milestone, 'one day old');
  assert.ok(card.lines.length > 0 && card.lines.length <= 3);
  assert.ok(card.lines.some(line => /grew in the garden/.test(line)));
  assert.equal(homecoming({ ...before, id: 'another' }, u, 9), null);
  assert.equal(homecoming(before, u, 2)!.greeting, 'Still up?');
  assert.equal(homecoming(before, u, 20)!.greeting, 'Good evening.');
  assert.notDeepEqual(u, untouched); // advance changed it; homecoming itself only reads:
  const snapshot = structuredClone(u); homecoming(before, u, 9); assert.deepEqual(u, snapshot);
});

test('festival rises, holds, and fades completely; bloom stays read-only and label-free', () => {
  assert.equal(festivalEnvelope(-1), 0);
  assert.equal(festivalEnvelope(0), 0);
  assert.equal(festivalEnvelope(10_000), 1);
  assert.ok(festivalEnvelope(30_000) > 0 && festivalEnvelope(30_000) < 1);
  assert.equal(festivalEnvelope(45_000), 0);
  const u = createUniverse(8); advance(u, 600);
  const before = structuredClone(u), labels: unknown[] = [];
  let dots = 0;
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key === 'fillText') return (value: unknown) => labels.push(value);
      if (key === 'arc') return () => dots++;
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
  }) as CanvasRenderingContext2D;
  drawWorld(ctx, u, getTheme('solarpunk'), 1440, 900, 60, true, 0);
  const calm = dots; dots = 0;
  drawWorld(ctx, u, getTheme('solarpunk'), 1440, 900, 60, true, 1);
  assert.ok(dots > calm + 50); // extra pollen and blooms
  assert.equal(labels.length, 0);
  assert.deepEqual(u, before);
});
