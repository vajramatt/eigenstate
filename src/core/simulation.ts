// SPDX-License-Identifier: MIT
import type { Snapshot, Universe } from './types.ts';
import { LIMITS } from './types.ts';
import { agentEngine, experimentEngine, branchEngine, quantumEngine, inferenceEngine, worldEngine, anomalyEngine } from './engines.ts';
import { event } from './universe.ts';
import { captureCausalFrame, retainCausalTraces } from './traces.ts';

/** Bounded reconciliation. Equal starting states + equal durations reproduce equal results. */
export function advance(u: Universe, duration: number, anomalyRate = 0.35): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  if (!Number.isFinite(anomalyRate) || anomalyRate < 0 || anomalyRate > 60) throw new Error('Invalid anomaly rate');
  const elapsed = Math.min(duration, 1e12), steps = Math.min(96, Math.max(1, Math.ceil(elapsed / 30))), dt = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    const causal = captureCausalFrame(u);
    u.age += dt; u.epoch = Math.floor(u.age / 900);
    agentEngine(u, dt); experimentEngine(u, dt); branchEngine(u, dt); quantumEngine(u, dt);
    inferenceEngine(u, dt); worldEngine(u, dt); anomalyEngine(u, dt, anomalyRate);
    retainCausalTraces(u, causal);
    if (u.age - (u.history.at(-1)?.age ?? -10) >= 10) {
      u.history.push({ age: u.age, entropy: u.branches.entropy, confidence: u.branches.confidence, load: u.inference.load });
      if (u.history.length > LIMITS.history) u.history.shift();
    }
  }
}
export function reconcile(snapshot: Snapshot, now = Date.now()): number {
  if (!Number.isFinite(now)) return 0;
  const elapsed = Math.max(0, (now - snapshot.savedAt) / 1000);
  if (!elapsed) return 0;
  const before = snapshot.universe.branches.explored;
  advance(snapshot.universe, elapsed, snapshot.anomalyRate);
  snapshot.savedAt = now;
  if (elapsed >= 60) event(snapshot.universe, 'resume', snapshot.universe.id.slice(0, 8).toUpperCase(), `${Math.floor(elapsed / 60)}m reconciled / ${Math.floor(snapshot.universe.branches.explored - before).toLocaleString('en-US')} branches evaluated`);
  return elapsed;
}
export function formatAge(age: number): string {
  const s = Math.floor(age), pad = (n: number, width = 2) => n.toString().padStart(width, '0');
  return `${pad(Math.floor(s / 86400), 3)}d ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}
export function compact(value: number): string {
  return value >= 1e9 ? `${(value / 1e9).toFixed(3)}G` : value >= 1e6 ? `${(value / 1e6).toFixed(3)}M` : value >= 1e4 ? `${(value / 1e3).toFixed(2)}K` : Math.floor(value).toLocaleString('en-US');
}
