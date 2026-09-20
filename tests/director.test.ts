// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directUniverse } from '../src/rendering/director.ts';
import { createUniverse } from '../src/core/universe.ts';

test('director is deterministic and never mutates universe state', () => {
  const universe = createUniverse(42), before = structuredClone(universe);
  assert.deepEqual(directUniverse(universe), directUniverse(universe));
  assert.deepEqual(universe, before);
});

test('recent anomalies and imminent crashes override normal visual cadence', () => {
  const universe = createUniverse(42);
  universe.age = 100; universe.anomalies.push({ seq: universe.sequence, age: 95, kind: 'anomaly', subject: universe.id, message: 'test' });
  assert.equal(directUniverse(universe, { frequency: 'rare', remaining: 10 }).phase, 'anomaly');
  universe.anomalies = [];
  const hush = directUniverse(universe, { frequency: 'rare', remaining: 10 });
  assert.equal(hush.phase, 'hush'); assert.ok(hush.tempo < 0.25);
});
