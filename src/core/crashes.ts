// SPDX-License-Identifier: MIT
import type { CrashFrequency, CrashSchedule } from './types.ts';
import { random } from './random.ts';

export interface CrashSequence { remaining: number; preview: boolean }
export const CRASH_SECONDS = 8;

/** Independent seeded draw: scheduling never consumes the simulation's PRNG. */
export function crashSchedule(seed: number, frequency: CrashFrequency = 'rare'): CrashSchedule {
  const draw = random({ rng: (seed ^ 0xc011a95e) >>> 0 });
  const minimum = frequency === 'occasional' ? 600 : 2700;
  return { frequency, remaining: minimum * (1 + draw) };
}

/** Count only active viewing, never background time, sleep, or accelerated simulation. */
export function viewingSeconds(elapsed: number): number { return Math.min(2, Math.max(0, elapsed)); }
