// SPDX-License-Identifier: MIT
/** Mulberry32. State and each draw are part of the persisted universe. */
export function random(source: { rng: number }): number {
  source.rng = (source.rng + 0x6D2B79F5) >>> 0;
  let t = source.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const count = (value: number) => Math.min(Number.MAX_SAFE_INTEGER / 4, Math.max(0, value));
export function freshSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function weightedIndex(weights: number[], draw: number): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) { sum += weights[i]; if (draw < sum) return i; }
  return weights.length - 1;
}
