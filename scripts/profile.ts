// SPDX-License-Identifier: MIT
import { performance } from 'node:perf_hooks';
import { createUniverse } from '../src/core/universe.ts';
import { advance } from '../src/core/simulation.ts';
import { validateSnapshot } from '../src/persistence/snapshot.ts';

const universe = createUniverse(41342, 1789857060000, '7fa922c1-4862-4bb1-9119-f442c870663a');
const collect = () => { if (global.gc) global.gc(); return process.memoryUsage().heapUsed; };
for (let i = 0; i < 10000; i++) advance(universe, 1);
const baseline = collect();
const samples: number[] = [];
for (let i = 0; i < 100000; i++) {
  const start = performance.now(); advance(universe, 1); samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const p50 = samples[50000], p99 = samples[99000]; samples.length = 0;
const after = collect();
const start = performance.now(); advance(universe, 100 * 365 * 86400);
const centuryMs = performance.now() - start;
const snapshot = { universe, savedAt: Date.now(), anomalyRate: 0.35 };
validateSnapshot(snapshot);
console.log(JSON.stringify({ node: process.version, liveSteps: 100000, p50Ms: p50,
  p99Ms: p99, heapDeltaBytesAfterGC: after - baseline, centuryMs,
  snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
  counts: { agents: universe.agents.length, experiments: universe.experiments.length,
    events: universe.events.length, anomalies: universe.anomalies.length, history: universe.history.length }
}, null, 2));
