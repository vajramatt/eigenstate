// SPDX-License-Identifier: MIT
import type { Snapshot } from '../core/types.ts';
import { KINDS, LIMITS } from '../core/types.ts';

export const VERSION = 3;
export const MAX_BYTES = 2_000_000;
export interface Envelope { version: number; payload: string; checksum: string }
export class FutureVersionError extends Error { constructor() { super('This universe was saved by a newer Eigenstate. Update the app to open it. Your saved state was preserved.'); } }

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid snapshot: ${message}`);
}
function finiteTree(value: unknown, depth = 0): void {
  requireValue(depth < 16, 'nesting');
  if (typeof value === 'number') requireValue(Number.isFinite(value) && Math.abs(value) <= 1e16, 'numeric range');
  else if (typeof value === 'string') requireValue(value.length < 1024, 'text length');
  else if (Array.isArray(value)) { requireValue(value.length <= 144, 'array bound'); value.forEach(v => finiteTree(v, depth + 1)); }
  else if (value && typeof value === 'object') {
    requireValue(Object.keys(value).length < 64, 'object bound');
    Object.values(value).forEach(v => finiteTree(v, depth + 1));
  }
}
export function validateSnapshot(value: unknown): asserts value is Snapshot {
  requireValue(value && typeof value === 'object', 'document');
  finiteTree(value);
  const s = value as Snapshot, u = s.universe;
  const num = (v: unknown, min = 0, max = 1e16): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const unit = (v: unknown) => num(v, 0, 1);
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 160;
  const array = (v: unknown, min: number, max = min): v is unknown[] => Array.isArray(v) && v.length >= min && v.length <= max;
  if (s.crashSchedule !== undefined) requireValue(s.crashSchedule && ['off', 'rare', 'occasional'].includes(s.crashSchedule.frequency) && num(s.crashSchedule.remaining, 0, 5400), 'crash schedule');
  requireValue(u && str(u.id) && /^[0-9a-f-]{36}$/i.test(u.id), 'universe identity');
  requireValue(num(u.seed, 0, 0xffffffff) && Number.isInteger(u.seed) && num(u.rng, 0, 0xffffffff) && Number.isInteger(u.rng), 'PRNG state');
  requireValue(num(s.savedAt, 0, 8.64e15) && num(s.anomalyRate, 0, 60) && num(u.createdAt, 0, 8.64e15) && num(u.age, 0, 1e15) && num(u.epoch) && num(u.serial) && num(u.sequence), 'clocks and counters');
  requireValue(array(u.agents, 1, LIMITS.agents) && array(u.experiments, 7), 'entity bounds');
  requireValue(array(u.events, 0, LIMITS.events) && array(u.anomalies, 0, LIMITS.anomalies) && array(u.history, 0, LIMITS.history) && array(u.traces, 0, LIMITS.traces), 'history bounds');
  const agents = new Set(u.agents.map(a => a.id)), experiments = new Set(u.experiments.map(e => e.id));
  requireValue(agents.size === u.agents.length && experiments.size === 7, 'duplicate identities');
  for (const a of u.agents) {
    requireValue(str(a.id) && str(a.role) && str(a.objective) && (a.parent === null || str(a.parent)) && num(a.born, 0, u.age), 'agent identity');
    requireValue(['active', 'waiting'].includes(a.status) && unit(a.confidence) && num(a.memory, 0, 1024) && num(a.tasks), 'agent values');
    requireValue(experiments.has(a.experiment) && array(a.dependencies, 0, 3) && a.dependencies.every(id => agents.has(id)), 'agent references');
  }
  for (const e of u.experiments) {
    requireValue(str(e.id) && KINDS.includes(e.kind) && num(e.born, 0, u.age) && num(e.iteration) && num(e.branches), 'experiment identity');
    requireValue(['running', 'failed', 'converged'].includes(e.status) && unit(e.convergence) && unit(e.uncertainty) && unit(e.allocation), 'experiment values');
    const expected = u.agents.filter(a => a.experiment === e.id).map(a => a.id).sort();
    requireValue(Array.isArray(e.agents) && JSON.stringify([...e.agents].sort()) === JSON.stringify(expected), 'experiment membership');
  }
  const b = u.branches, q = u.quantum, n = u.inference, r = u.resources;
  requireValue(b && q && n && r && u.world && u.totals, 'subsystems');
  requireValue(num(b.explored) && num(b.pruned) && num(b.active, 0, 1e6) && unit(b.divergence) && unit(b.entropy) && unit(b.confidence), 'branches');
  requireValue(num(q.registers, 1, 64) && num(q.depth, 1, 8192) && unit(q.entanglement) && unit(q.decoherence) && num(q.corrections) && num(q.measurements) && Number.isInteger(q.collapsed) && num(q.collapsed, 0, 7), 'quantum');
  requireValue(array(q.probabilities, 8) && q.probabilities.every(unit) && Math.abs(q.probabilities.reduce((a, b) => a + b, 0) - 1) < 1e-8 && array(q.phases, 8) && q.phases.every(v => num(v, 0, Math.PI * 2)), 'quantum vectors');
  requireValue(unit(n.load) && unit(n.context) && unit(n.agreement) && num(n.throughput, 0, 1e9) && num(n.tokens) && num(n.retrievals) && num(n.tools), 'inference');
  requireValue(array(n.layers, 48) && n.layers.every(unit) && array(n.routing, 3) && n.routing.every(unit), 'inference vectors');
  requireValue(unit(r.compute) && num(r.memory, 0, 1024) && array(r.allocations, 4) && r.allocations.every(unit), 'resources');
  requireValue(array(u.world.coordinates, 144) && u.world.coordinates.every(v => array(v, 3) && v.every(x => num(x, -1, 1))), 'world coordinates');
  requireValue(array(u.world.coupling, 64) && u.world.coupling.every(unit), 'coupling');
  for (const key of ['spawned', 'retired', 'converged', 'failed', 'anomalies'] as const) requireValue(num(u.totals[key]), 'totals');
  for (const e of [...u.events, ...u.anomalies]) requireValue(num(e.seq, 0, u.sequence) && num(e.age, 0, u.age) && str(e.kind) && str(e.subject) && typeof e.message === 'string' && e.message.length <= 512, 'event');
  for (const trace of u.traces) requireValue(str(trace.id) && num(trace.age, 0, u.age) && num(trace.eventSeq, 0, u.sequence) && str(trace.agent) && str(trace.experiment) && typeof trace.cause === 'string' && trace.cause.length <= 512 && typeof trace.experimentEffect === 'string' && trace.experimentEffect.length <= 512 && typeof trace.worldEffect === 'string' && trace.worldEffect.length <= 512, 'causal trace');
  for (const h of u.history) requireValue(num(h.age, 0, u.age) && unit(h.entropy) && unit(h.confidence) && unit(h.load), 'history');
}
async function digest(payload: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
export async function encodeSnapshot(snapshot: Snapshot): Promise<Envelope> {
  validateSnapshot(snapshot);
  const payload = JSON.stringify(snapshot);
  if (payload.length > MAX_BYTES) throw new Error('Snapshot exceeds 2 MB');
  return { version: VERSION, payload, checksum: await digest(payload) };
}
export async function decodeSnapshot(raw: unknown): Promise<Snapshot> {
  requireValue(raw && typeof raw === 'object', 'envelope');
  const envelope = raw as Envelope;
  requireValue(Number.isInteger(envelope.version), 'version');
  if (envelope.version > VERSION) throw new FutureVersionError();
  requireValue(typeof envelope.payload === 'string' && envelope.payload.length <= MAX_BYTES, 'payload size');
  requireValue(typeof envelope.checksum === 'string' && await digest(envelope.payload) === envelope.checksum, 'checksum');
  let parsed = JSON.parse(envelope.payload);
  if (envelope.version === 1) parsed = { universe: parsed.universe, savedAt: parsed.lastSavedAt, anomalyRate: 0.35 };
  else requireValue(envelope.version === 2 || envelope.version === VERSION, 'unsupported historical version');
  parsed.universe.traces ??= [];
  validateSnapshot(parsed);
  return parsed;
}
