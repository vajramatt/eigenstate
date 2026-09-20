// SPDX-License-Identifier: MIT
import { LIMITS, type SimulationEvent, type Universe } from './types.ts';
import { event } from './universe.ts';

interface ExperimentFrame { agents: number; capacity: number; convergence: number; allocation: number }
export interface CausalFrame { sequence: number; experiments: Map<string, ExperimentFrame>; coordinates: number[][]; coupling: number[] }

function capacity(u: Universe, experiment: string): number {
  return u.agents.filter(agent => agent.experiment === experiment).reduce((sum, agent) => sum + (agent.status === 'active' ? 1 : 0.35), 0);
}
export function captureCausalFrame(u: Universe): CausalFrame {
  return {
    sequence: u.sequence,
    experiments: new Map(u.experiments.map(experiment => [experiment.id, {
      agents: experiment.agents.length, capacity: capacity(u, experiment.id), convergence: experiment.convergence, allocation: experiment.allocation,
    }])),
    coordinates: u.world.coordinates.map(vector => [...vector]), coupling: [...u.world.coupling],
  };
}
function eventExperiment(u: Universe, source: SimulationEvent): string {
  const explicit = source.message.match(/EXP-[0-9A-F]+/)?.[0];
  return explicit ?? u.agents.find(agent => agent.id === source.subject)?.experiment ?? 'unresolved';
}
function worldDelta(u: Universe, frame: CausalFrame): { displacement: number; couplings: number } {
  let total = 0, values = 0;
  u.world.coordinates.forEach((vector, i) => vector.forEach((value, axis) => { total += Math.abs(value - (frame.coordinates[i]?.[axis] ?? value)); values++; }));
  return { displacement: values ? total / values : 0, couplings: u.world.coupling.filter((value, i) => value !== frame.coupling[i]).length };
}
export function retainCausalTraces(u: Universe, frame: CausalFrame): void {
  const sources = u.events.filter(source => source.seq > frame.sequence && ['agent', 'merge', 'sync'].includes(source.kind));
  if (!sources.length) return;
  const world = worldDelta(u, frame);
  for (const source of sources) {
    const experiment = eventExperiment(u, source), before = frame.experiments.get(experiment), after = u.experiments.find(item => item.id === experiment);
    const afterCapacity = after ? capacity(u, experiment) : 0;
    const experimentEffect = before && after
      ? `capacity ${before.capacity.toFixed(2)}→${afterCapacity.toFixed(2)} · convergence ${before.convergence.toFixed(4)}→${after.convergence.toFixed(4)} · allocation ${(before.allocation * 100).toFixed(1)}→${(after.allocation * 100).toFixed(1)}%`
      : `${experiment} retired or replaced during cycle`;
    const worldEffect = `latent displacement Δ${world.displacement.toFixed(6)} · coupling edits ${world.couplings}`;
    const trace = { id: `TRC-${source.seq.toString(16).toUpperCase().padStart(6, '0')}`, age: u.age, eventSeq: source.seq, agent: source.subject, experiment, cause: source.message, experimentEffect, worldEffect };
    u.traces.push(trace); if (u.traces.length > LIMITS.traces) u.traces.shift();
    event(u, 'trace', trace.id, `${experiment} causal chain retained · ${worldEffect}`);
  }
}
