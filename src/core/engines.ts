// SPDX-License-Identifier: MIT
import type { Universe } from './types.ts';
import { clamp, count, random, weightedIndex } from './random.ts';
import { event, experiment, linkAgents, spawn } from './universe.ts';
import { triggerAnomaly } from './anomalies.ts';

export function agentEngine(u: Universe, dt: number): void {
  for (const a of u.agents) {
    a.tasks = count(a.tasks + dt * (0.03 + a.confidence * 0.08));
    a.confidence = clamp(a.confidence + (random(u) - 0.5) * 0.002, 0.4, 0.999);
    a.memory = clamp(a.memory + (random(u) - 0.5), 32, 1024);
  }
  if (random(u) < 1 - Math.exp(-dt / 260) && u.agents.length > 12) {
    const a = u.agents.splice(Math.floor(random(u) * u.agents.length), 1)[0];
    for (const other of u.agents) other.dependencies = other.dependencies.filter(id => id !== a.id);
    u.totals.retired++;
    event(u, 'merge', a.id, `Results merged into ${a.experiment}. Agent retired.`);
  }
  if (random(u) < 1 - Math.exp(-dt / 180)) spawn(u);
  if (dt > 600) { const churn = Math.floor(dt / 260); u.totals.spawned = count(u.totals.spawned + churn); u.totals.retired = count(u.totals.retired + churn); }
  if (random(u) < 1 - Math.exp(-dt / 22) && u.agents.length > 1) {
    const a = u.agents[Math.floor(random(u) * u.agents.length)];
    const peers = u.agents.filter(peer => peer.id !== a.id);
    const b = peers[Math.floor(random(u) * peers.length)];
    a.status = a.status === 'active' ? 'waiting' : 'active';
    if (!a.dependencies.includes(b.id)) a.dependencies = [...a.dependencies, b.id].slice(-3);
    event(u, 'sync', a.id, `State exchange → ${b.id} / ${a.experiment}`);
  }
}
export function experimentEngine(u: Universe, dt: number): void {
  linkAgents(u);
  for (let i = 0; i < u.experiments.length; i++) {
    let e = u.experiments[i];
    if (e.status !== 'running') {
      const old = e.id; e = experiment(u, e.kind); u.experiments[i] = e;
      for (const a of u.agents) if (a.experiment === old) { a.experiment = e.id; a.objective = e.kind; }
    }
    const capacity = e.agents.reduce((sum, id) => sum + (u.agents.find(a => a.id === id)?.status === 'active' ? 1 : 0.35), 0);
    e.iteration = count(e.iteration + dt * (8 + capacity));
    e.branches = count(e.branches + dt * e.allocation * 550);
    e.convergence = 1 - (1 - e.convergence) * Math.exp(-dt * 0.000012 * (1 + capacity));
    e.uncertainty = 1 - e.convergence;
    if (e.convergence > 0.985) { e.status = 'converged'; u.totals.converged++; event(u, 'result', e.id, `${e.kind} converged; result accepted`); }
    else if (random(u) < 1 - Math.exp(-dt / 300000)) { e.status = 'failed'; u.totals.failed++; event(u, 'result', e.id, 'Hypothesis rejected; resources released'); }
  }
  linkAgents(u);
  const weights = u.experiments.map(e => 0.3 + e.uncertainty + e.agents.reduce((sum, id) => sum + (u.agents.find(a => a.id === id)?.status === 'active' ? 0.1 : 0.035), 0));
  const total = weights.reduce((a, b) => a + b);
  u.experiments.forEach((e, i) => e.allocation = weights[i] / total);
}
export function branchEngine(u: Universe, dt: number): void {
  const b = u.branches, evaluated = dt * (420 + 280 * u.resources.compute);
  b.explored = count(b.explored + evaluated); b.pruned = count(b.pruned + evaluated * (0.72 + 0.12 * b.confidence));
  b.active += (1200 + 5000 * b.divergence - b.active) * (1 - Math.exp(-dt / 180));
  b.divergence = clamp(b.divergence + (random(u) - 0.5) * 0.004, 0.05, 0.95);
  const convergence = u.experiments.reduce((s, e) => s + e.convergence, 0) / 7;
  b.entropy = clamp(0.18 + b.divergence * 0.6 + (1 - convergence) * 0.2);
  b.confidence = 1 - b.entropy * 0.3;
}
export function quantumEngine(u: Universe, dt: number): void {
  const q = u.quantum;
  q.entanglement = clamp(q.entanglement + (random(u) - 0.5) * 0.004, 0.2, 0.99);
  q.decoherence = 0.003 + u.branches.entropy * 0.012;
  q.corrections = count(q.corrections + dt * q.decoherence * 120); q.measurements = count(q.measurements + dt * 4);
  q.probabilities = q.probabilities.map(v => Math.max(0.001, v + (random(u) - 0.5) * 0.004));
  const total = q.probabilities.reduce((a, b) => a + b);
  q.probabilities = q.probabilities.map(v => v / total);
  q.phases = q.phases.map((v, i) => (v + dt * 0.004 * (i + 1)) % (Math.PI * 2));
  if (random(u) < 1 - Math.exp(-dt / 90)) q.collapsed = weightedIndex(q.probabilities, random(u));
}
export function inferenceEngine(u: Universe, dt: number): void {
  const n = u.inference;
  n.load = clamp(0.2 + u.agents.length / 60 + u.branches.divergence * 0.2);
  n.context = u.branches.entropy * 0.7 + n.load * 0.2;
  n.agreement = u.agents.reduce((s, a) => s + a.confidence, 0) / u.agents.length;
  n.throughput = 1800 + n.load * 3200;
  n.tokens = count(n.tokens + dt * n.throughput); n.retrievals = count(n.retrievals + dt * n.load * 14); n.tools = count(n.tools + dt * n.load * 3);
  n.routing = [n.agreement * 0.5, n.load * 0.4, 1 - n.agreement * 0.5 - n.load * 0.4];
  n.layers = n.layers.map(v => clamp(v + (random(u) - 0.5) * 0.014, 0.02, 0.98));
  u.resources.compute = n.load * 0.6 + u.quantum.entanglement * 0.4;
  u.resources.memory = u.agents.reduce((s, a) => s + a.memory, 0) / 1024;
  u.resources.allocations = [n.load * 0.5, u.quantum.entanglement * 0.3, u.branches.divergence * 0.2, 0];
  u.resources.allocations[3] = 1 - u.resources.allocations.slice(0, 3).reduce((a, b) => a + b);
}
export function worldEngine(u: Universe, dt: number): void {
  const theta = Math.min(dt, 600) * 0.00035, c = Math.cos(theta), s = Math.sin(theta);
  u.world.coordinates = u.world.coordinates.map(([x, y, z], i) => {
    const target = u.experiments[i % 7].convergence;
    return [clamp(x * c - z * s, -1, 1), clamp(y + (target - 0.5) * Math.min(dt, 100) * 0.0001, -1, 1), clamp(x * s + z * c, -1, 1)];
  });
  const index = Math.floor(random(u) * 64);
  u.world.coupling[index] = random(u) < u.branches.divergence ? random(u) : 0;
}
export function anomalyEngine(u: Universe, dt: number, rate: number): void {
  const mean = dt * rate / 3600, total = Math.floor(mean) + (random(u) < 1 - Math.exp(-(mean % 1)) ? 1 : 0);
  for (let i = 0; i < Math.min(8, total); i++) triggerAnomaly(u);
  if (total > 8) { u.totals.anomalies = count(u.totals.anomalies + total - 8); event(u, 'summary', u.id.slice(0, 8), `${total - 8} additional anomalies summarized`); }
}
