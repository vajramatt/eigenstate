// SPDX-License-Identifier: MIT
export const LIMITS = { agents: 32, experiments: 7, events: 80, anomalies: 16, history: 96 } as const;
export const KINDS = ['world model', 'causal inference', 'optimization', 'recursive planning', 'quantum simulation', 'adversarial evaluation', 'representation learning'] as const;
export type ExperimentKind = typeof KINDS[number];
export interface Agent {
  id: string; born: number; parent: string | null; role: string; objective: string;
  status: 'active' | 'waiting'; confidence: number; memory: number; tasks: number;
  dependencies: string[]; experiment: string;
}
export interface Experiment {
  id: string; kind: ExperimentKind; born: number; iteration: number; branches: number;
  convergence: number; uncertainty: number; agents: string[]; allocation: number;
  status: 'running' | 'converged' | 'failed';
}
export interface SimulationEvent { seq: number; age: number; kind: string; subject: string; message: string }
export interface Universe {
  id: string; seed: number; rng: number; createdAt: number; age: number; epoch: number; serial: number; sequence: number;
  agents: Agent[]; experiments: Experiment[];
  branches: { explored: number; active: number; pruned: number; divergence: number; entropy: number; confidence: number };
  quantum: { registers: number; depth: number; entanglement: number; decoherence: number; corrections: number; measurements: number; probabilities: number[]; phases: number[]; collapsed: number };
  inference: { load: number; context: number; throughput: number; tokens: number; retrievals: number; tools: number; agreement: number; layers: number[]; routing: number[] };
  resources: { compute: number; memory: number; allocations: number[] };
  world: { coordinates: number[][]; coupling: number[] };
  totals: { spawned: number; retired: number; converged: number; failed: number; anomalies: number };
  events: SimulationEvent[]; anomalies: SimulationEvent[];
  history: { age: number; entropy: number; confidence: number; load: number }[];
}
export type CrashFrequency = 'off' | 'rare' | 'occasional';
export interface CrashSchedule { frequency: CrashFrequency; remaining: number }
export interface Snapshot { universe: Universe; savedAt: number; anomalyRate: number; crashSchedule?: CrashSchedule }
export interface Preferences { theme: string; layout: 'adaptive' | 'observatory' | 'analysis'; quiet: boolean }
