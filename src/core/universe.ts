// SPDX-License-Identifier: MIT
import { KINDS, LIMITS, type Universe, type Experiment } from './types.ts';
import { random } from './random.ts';

export function identity(u: Universe, prefix: string): string { return `${prefix}-${(++u.serial).toString(16).toUpperCase().padStart(4, '0')}`; }
export function event(u: Universe, kind: string, subject: string, message: string): void {
  const entry = { seq: ++u.sequence, age: u.age, kind, subject, message };
  u.events.push(entry); if (u.events.length > LIMITS.events) u.events.shift();
  if (kind === 'anomaly') { u.anomalies.push(entry); if (u.anomalies.length > LIMITS.anomalies) u.anomalies.shift(); }
}
export function experiment(u: Universe, kind: Experiment['kind']): Experiment {
  return { id: identity(u, 'EXP'), kind, born: u.age, iteration: 0, branches: 0,
    convergence: 0.14 + random(u) * 0.55, uncertainty: 0, agents: [], allocation: 1 / 7, status: 'running' };
}
export function spawn(u: Universe): void {
  if (u.agents.length >= LIMITS.agents) return;
  const parent = u.agents[Math.floor(random(u) * u.agents.length)]?.id ?? null;
  const exp = u.experiments[Math.floor(random(u) * u.experiments.length)];
  const roles = ['observer', 'planner', 'critic', 'solver', 'router', 'synthesizer'];
  const role = roles[Math.floor(random(u) * roles.length)];
  const agent = { id: identity(u, 'AGT'), born: u.age, parent, role, objective: exp.kind,
    status: 'active' as const, confidence: 0.78 + random(u) * 0.2, memory: 80 + random(u) * 420,
    tasks: 0, dependencies: parent ? [parent] : [], experiment: exp.id };
  u.agents.push(agent); u.totals.spawned++;
  event(u, 'agent', agent.id, `${role} assigned to ${exp.id}`);
}
export function linkAgents(u: Universe): void {
  for (const e of u.experiments) e.agents = u.agents.filter(a => a.experiment === e.id).map(a => a.id);
}
export function createUniverse(seed: number, now = Date.now(), id = crypto.randomUUID() as string): Universe {
  const u: Universe = {
    id, seed: seed >>> 0, rng: seed >>> 0, createdAt: now, age: 0, epoch: 0, serial: 0, sequence: 0,
    agents: [], experiments: [], branches: { explored: 0, active: 2048, pruned: 0, divergence: 0.32, entropy: 0.42, confidence: 0.89 },
    quantum: { registers: 8, depth: 64, entanglement: 0.73, decoherence: 0.008, corrections: 0, measurements: 0,
      probabilities: [0.08, 0.13, 0.04, 0.27, 0.18, 0.09, 0.07, 0.14], phases: [0.1, 0.8, 1.2, 2.1, 3, 3.5, 4.4, 5.8], collapsed: 3 },
    inference: { load: 0.63, context: 0.44, throughput: 3800, tokens: 0, retrievals: 0, tools: 0, agreement: 0.91, layers: [], routing: [0.42, 0.31, 0.27] },
    resources: { compute: 0.64, memory: 4.8, allocations: [0.38, 0.24, 0.22, 0.16] },
    world: { coordinates: [], coupling: [] }, totals: { spawned: 0, retired: 0, converged: 0, failed: 0, anomalies: 0 },
    events: [], anomalies: [], history: [],
  };
  for (const kind of KINDS) { const e = experiment(u, kind); e.uncertainty = 1 - e.convergence; u.experiments.push(e); }
  for (let i = 0; i < 20; i++) spawn(u);
  linkAgents(u);
  u.inference.layers = Array.from({ length: 48 }, () => 0.1 + random(u) * 0.8);
  // A bounded latent world state, evolved by the simulation and only projected by renderers.
  u.world.coordinates = Array.from({ length: 144 }, (_, i) => {
    const t = i / 143 * Math.PI * 5.5, radius = 0.35 + random(u) * 0.4;
    return [Math.cos(t) * radius, (i / 143 - 0.5) * 1.7, Math.sin(t) * radius];
  });
  u.world.coupling = Array.from({ length: 64 }, () => random(u) < 0.65 ? 0 : random(u));
  event(u, 'system', u.id.slice(0, 8).toUpperCase(), 'Universe initialized. Local synthetic computation.');
  return u;
}
