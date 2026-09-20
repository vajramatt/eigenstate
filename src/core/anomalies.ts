// SPDX-License-Identifier: MIT
import type { Universe } from './types.ts';
import { clamp, random } from './random.ts';
import { event } from './universe.ts';

export const ANOMALIES = ['CONVERGENCE DETECTED', 'OBSERVER STATE UPDATED', 'UNMODELED CAUSAL PATH',
  'AGENT CONSENSUS: 1.000000', 'MODEL OF MODEL DETECTED', 'STATE SPACE COLLAPSED',
  'RECURSIVE DEPTH LIMIT REMOVED', 'NONLOCAL CORRELATION EXCEEDED BASELINE'] as const;
export function triggerAnomaly(u: Universe, index = Math.floor(random(u) * ANOMALIES.length)): void {
  if (!Number.isInteger(index) || index < 0 || index >= ANOMALIES.length) throw new Error('Invalid anomaly');
  switch (index) {
    case 0: u.experiments[0].convergence = 0.999; u.experiments[0].uncertainty = 0.001; break;
    case 1: u.agents[0].objective = 'observer model revision'; u.agents[0].confidence = 0.999; break;
    case 2: u.branches.active += 1024; u.branches.divergence = clamp(u.branches.divergence + 0.15); break;
    case 3: u.agents.forEach(a => a.confidence = 1); u.inference.agreement = 1; break;
    case 4: u.experiments[0].kind = 'recursive planning'; u.experiments[0].convergence *= 0.5; u.experiments[0].uncertainty = 1 - u.experiments[0].convergence; break;
    case 5:
      u.branches.pruned += Math.floor(u.branches.active / 2); u.branches.active = Math.ceil(u.branches.active / 2); u.branches.entropy *= 0.5;
      u.quantum.collapsed = Math.floor(random(u) * 8); u.quantum.probabilities = Array.from({ length: 8 }, (_, i) => i === u.quantum.collapsed ? 0.93 : 0.01); break;
    case 6: u.quantum.depth = Math.min(8192, u.quantum.depth + 32); break;
    case 7: u.quantum.entanglement = 0.999; u.world.coupling = u.world.coupling.map(v => v ? clamp(v + 0.15) : v); break;
  }
  u.totals.anomalies++;
  event(u, 'anomaly', u.experiments[0].id, ANOMALIES[index]);
}
