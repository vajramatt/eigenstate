// SPDX-License-Identifier: MIT
import type { Universe } from '../core/types.ts';

// Render-only interpolation. Neither the simulation nor its PRNG is advanced here.
export function blendVisual(current: Universe, target: Universe, amount: number): void {
  const mix = (a: number, b: number) => a + (b - a) * amount;
  current.world.coordinates.forEach((p, i) => p.forEach((v, axis) => p[axis] = mix(v, target.world.coordinates[i][axis])));
  current.quantum.probabilities.forEach((v, i) => current.quantum.probabilities[i] = mix(v, target.quantum.probabilities[i]));
  current.quantum.phases.forEach((v, i) => {
    const delta = Math.atan2(Math.sin(target.quantum.phases[i] - v), Math.cos(target.quantum.phases[i] - v));
    current.quantum.phases[i] = v + delta * amount;
  });
  current.quantum.collapsed = target.quantum.collapsed;
  current.quantum.entanglement = mix(current.quantum.entanglement, target.quantum.entanglement);
  current.inference.layers.forEach((v, i) => current.inference.layers[i] = mix(v, target.inference.layers[i]));
  for (const key of ['load', 'context', 'agreement'] as const) current.inference[key] = mix(current.inference[key], target.inference[key]);
  current.inference.retrievals = target.inference.retrievals;
  current.agents = target.agents; current.experiments = target.experiments;
  current.branches = target.branches; current.history = target.history; current.events = target.events;
  current.resources = target.resources; current.world.coupling = target.world.coupling;
}
