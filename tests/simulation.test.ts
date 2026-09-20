// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUniverse } from '../src/core/universe.ts';
import { random } from '../src/core/random.ts';
import { advance, reconcile } from '../src/core/simulation.ts';
import { ANOMALIES, triggerAnomaly } from '../src/core/anomalies.ts';
import { encodeSnapshot, decodeSnapshot, validateSnapshot } from '../src/persistence/snapshot.ts';
import type { Snapshot } from '../src/core/types.ts';

const epoch = 1789857060000;
export const fixture = (): Snapshot => ({ universe: createUniverse(0xA17E, epoch, '7fa922c1-4862-4bb1-9119-f442c870663a'), savedAt: epoch, anomalyRate: 0.35 });
test('Mulberry32 has a stable reference vector and resumable state', () => {
  const a = { rng: 1 }; assert.equal(random(a), 0.6270739405881613);
  const b = structuredClone(a); assert.deepEqual(Array.from({ length: 100 }, () => random(a)), Array.from({ length: 100 }, () => random(b)));
});
test('same initial snapshot plus ten hours produces the same reconciled state', async () => {
  const encoded = await encodeSnapshot(fixture()), a = await decodeSnapshot(encoded), b = await decodeSnapshot(encoded);
  reconcile(a, epoch + 36_000_000); reconcile(b, epoch + 36_000_000);
  assert.deepEqual(a, b); assert.equal(a.universe.age, 36000); assert.ok(a.universe.branches.explored > 18_000_000);
  assert.equal(a.universe.id, fixture().universe.id); validateSnapshot(a);
});
test('backward clocks and repeat reconciliation never double-count', () => {
  const s = fixture(); assert.equal(reconcile(s, epoch - 1000), 0); assert.equal(s.savedAt, epoch);
  reconcile(s, epoch + 1000); const copy = structuredClone(s); reconcile(s, epoch + 1000); assert.deepEqual(s, copy);
});
test('live agent links and probabilities remain valid with anomalies disabled', () => {
  const s = fixture();
  for (let i = 0; i < 3600; i++) advance(s.universe, 1, 0);
  assert.equal(s.universe.totals.anomalies, 0); assert.ok(s.universe.agents.some(a => a.tasks > 1)); validateSnapshot(s);
});
test('topology changes alter experiments and retain bounded world-model traces', () => {
  const s = fixture();
  for (let i = 0; i < 120 && !s.universe.traces.length; i++) advance(s.universe, 1, 0);
  const trace = s.universe.traces.at(-1); assert.ok(trace);
  assert.match(trace.experimentEffect, /capacity .* convergence .* allocation/);
  assert.match(trace.worldEffect, /latent displacement/);
  assert.ok(s.universe.events.some(event => event.kind === 'trace' && event.subject === trace.id));
  assert.ok(s.universe.traces.length <= 48); validateSnapshot(s);
});
test('each anomaly changes a real subsystem and adds bounded history', () => {
  ANOMALIES.forEach((name, i) => {
    const s = fixture(), before = structuredClone(s.universe); triggerAnomaly(s.universe, i);
    assert.equal(s.universe.anomalies.at(-1)?.message, name);
    assert.ok(['agents', 'experiments', 'branches', 'quantum', 'inference', 'world'].some(k => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(s.universe[k as keyof typeof before])));
    validateSnapshot(s);
  });
});
test('twenty-four years stay bounded and compact', async () => {
  const s = fixture();
  for (let i = 0; i < 24; i++) advance(s.universe, 365 * 86400, 6);
  validateSnapshot(s); assert.ok(s.universe.events.length <= 80); assert.ok(s.universe.anomalies.length <= 16);
  assert.ok(s.universe.history.length <= 96); assert.ok(s.universe.traces.length <= 48); assert.ok(s.universe.agents.length <= 32); assert.equal(s.universe.experiments.length, 7);
  assert.ok((await encodeSnapshot(s)).payload.length < 150_000);
});
test('non-finite and invalid inputs cannot advance state', () => {
  const s = fixture(), copy = structuredClone(s); advance(s.universe, NaN); advance(s.universe, -1); assert.deepEqual(s, copy);
  assert.throws(() => advance(s.universe, 1, Infinity));
});
test('simulation cost is bounded for a century of catch-up', () => {
  const s = fixture(), start = performance.now(); advance(s.universe, 100 * 365 * 86400);
  assert.ok(performance.now() - start < 2000); validateSnapshot(s);
});
