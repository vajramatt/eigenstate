// SPDX-License-Identifier: MIT
import type { Universe } from '../core/types.ts';
export interface TerminalLine { id: string; age: number; channel: string; text: string; event: boolean }
export function telemetryLine(u: Universe): TerminalLine {
  const tick = Math.floor(u.age), e = u.experiments[tick % u.experiments.length];
  const channels = ['inference', 'quantum', 'solver', 'branches'];
  const texts = [
    `route=${u.inference.routing.map(v => v.toFixed(3)).join('/')} tokens=${Math.floor(u.inference.tokens)} rate=${u.inference.throughput.toFixed(0)}/s ctx=${u.inference.context.toFixed(4)}`,
    `q=${u.quantum.registers} depth=${u.quantum.depth} state=|${u.quantum.collapsed.toString(2).padStart(3, '0')}⟩ p=${u.quantum.probabilities[u.quantum.collapsed].toFixed(6)} corrections=${Math.floor(u.quantum.corrections)}`,
    `${e.id} iter=${Math.floor(e.iteration)} residual=${e.uncertainty.toFixed(6)} convergence=${e.convergence.toFixed(6)} agents=${e.agents.length}`,
    `evaluated=${Math.floor(u.branches.explored)} active=${Math.floor(u.branches.active)} pruned=${Math.floor(u.branches.pruned)} H=${u.branches.entropy.toFixed(6)}`,
  ];
  return { id: `sample-${u.age}`, age: u.age, channel: channels[tick % 4], text: texts[tick % 4], event: false };
}
export function eventLines(u: Universe, since: number): TerminalLine[] {
  return u.events.filter(e => e.seq > since).map(e => ({ id: `event-${e.seq}`, age: e.age, channel: e.kind, text: `${e.subject} ${e.message}`, event: true }));
}
