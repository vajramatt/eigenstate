// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUniverse } from '../src/core/universe.ts';
import { telemetryLine, eventLines } from '../src/rendering/terminal.ts';
import { blendVisual, PresentationClock } from '../src/rendering/motion.ts';

test('shared presentation clock survives view switches without resetting or advancing twice', () => {
  const clock = new PresentationClock();
  assert.equal(clock.sample('world-a', 900, 1000, true), 900);
  assert.equal(clock.sample('world-a', 999, 1050, true, 2), 900.1);
  // A newly mounted view supplies simulation age, but keeps the existing camera.
  assert.equal(clock.sample('world-a', 1200, 1050, true, 2), 900.1);
  assert.equal(clock.sample('world-a', 1200, 1100, true, 2), 900.2);
  assert.equal(clock.sample('world-a', 1200, 5000, false), 900.2);
  assert.equal(clock.sample('world-a', 1200, 6000, false), 900.2);
  assert.ok(Math.abs(clock.sample('world-a', 1200, 6050, true) - 900.25) < 1e-9);
  // Hidden tabs cannot turn hours away into a camera jump.
  assert.ok(clock.sample('world-a', 1200, 9_000_000, true) < 900.36);
  assert.equal(clock.sample('world-b', 12, 9_000_000, true), 12);
});

test('terminal samples expose actual subsystem state without mutating the universe', () => {
  const u = createUniverse(7);
  for (let age = 0; age < 4; age++) {
    u.age = age; const before = structuredClone(u), line = telemetryLine(u);
    assert.equal(line.age, age); assert.deepEqual(u, before);
    if (age === 0) assert.ok(line.text.includes(`tokens=${Math.floor(u.inference.tokens)}`));
    if (age === 1) assert.ok(line.text.includes(`corrections=${Math.floor(u.quantum.corrections)}`));
    if (age === 2) assert.ok(line.text.includes(u.experiments[2].id));
    if (age === 3) assert.ok(line.text.includes(`evaluated=${Math.floor(u.branches.explored)}`));
  }
  assert.equal(eventLines(u, u.sequence).length, 0);
  assert.equal(eventLines(u, -1).length, u.events.length);
});
test('visual interpolation crosses phase wrap by shortest arc and never writes simulation state', () => {
  const target = createUniverse(7), visual = structuredClone(target);
  visual.quantum.phases[0] = Math.PI * 2 - 0.1; target.quantum.phases[0] = 0.1;
  const before = structuredClone(target);
  blendVisual(visual, target, 0.5);
  assert.ok(Math.abs(visual.quantum.phases[0] - Math.PI * 2) < 1e-9);
  for (let i = 0; i < 100; i++) blendVisual(visual, target, 0.2);
  assert.deepEqual(target, before);
  assert.ok(Math.abs(visual.quantum.probabilities.reduce((a,b) => a+b) - 1) < 1e-9);
});
