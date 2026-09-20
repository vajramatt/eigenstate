// SPDX-License-Identifier: MIT
import type { CrashSchedule, Universe } from '../core/types.ts';
import type { PaneKind } from './panes.ts';

export type DirectorPhase = 'observe' | 'trace' | 'surge' | 'resolve' | 'hush' | 'anomaly';
export type DirectorFocus = PaneKind | 'experiment' | 'terminal';
export interface DirectorState {
  phase: DirectorPhase;
  focus: DirectorFocus;
  label: string;
  tempo: number;
  intensity: number;
  experimentIndex: number;
  pulse: boolean;
}

/** Pure presentation direction. Reads universe state without consuming its PRNG. */
export function directUniverse(u: Universe, schedule?: CrashSchedule): DirectorState {
  const experiments = Math.max(1, u.experiments.length);
  const eventExperiment = u.experiments.findIndex(experiment => experiment.id === u.events.at(-1)?.subject);
  const experimentIndex = eventExperiment >= 0 ? eventExperiment : (Math.floor(u.age / 8) + u.seed) % experiments;
  const pulse = Math.floor(u.age) % 8 < 1;
  const latestAnomaly = u.anomalies.at(-1);
  const anomalyAge = latestAnomaly ? u.age - latestAnomaly.age : Infinity;

  if (anomalyAge >= 0 && anomalyAge < 18) {
    return { phase: 'anomaly', focus: 'terminal', label: 'ANOMALY RESPONSE', tempo: 1.65, intensity: 1, experimentIndex, pulse: true };
  }
  if (schedule && schedule.frequency !== 'off' && schedule.remaining <= 22) {
    return { phase: 'hush', focus: 'world', label: 'SIGNAL CONTRACTION', tempo: 0.18, intensity: 0.06, experimentIndex, pulse: false };
  }

  const cycle = (u.age + u.seed % 29) % 96;
  if (cycle < 38) return { phase: 'observe', focus: 'world', label: 'PASSIVE OBSERVATION', tempo: 0.72, intensity: 0.22, experimentIndex, pulse: false };
  if (cycle < 62) return { phase: 'trace', focus: 'branches', label: 'BRANCH TRACE', tempo: 1.2, intensity: 0.48, experimentIndex, pulse };
  if (cycle < 78) return { phase: 'surge', focus: 'experiment', label: 'EXPERIMENT SURGE', tempo: 1.85, intensity: 0.82, experimentIndex, pulse };
  if (cycle < 90) return { phase: 'resolve', focus: 'terminal', label: 'RESULT ASSIMILATION', tempo: 1.15, intensity: 0.52, experimentIndex, pulse };
  return { phase: 'observe', focus: 'quantum', label: 'COHERENCE WATCH', tempo: 0.58, intensity: 0.18, experimentIndex, pulse: false };
}
