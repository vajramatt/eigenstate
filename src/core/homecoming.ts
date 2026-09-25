// SPDX-License-Identifier: MIT
import { LIMITS, type Universe } from './types.ts';

const ADJECTIVES = ['Verdant', 'Luminous', 'Patient', 'Quiet', 'Gilded', 'Tidal', 'Kindled', 'Mossy', 'Silver', 'Unfolding', 'Wandering', 'Tender', 'Radiant', 'Evergreen', 'Humming', 'Morning'];
const NOUNS = ['Lattice', 'Orchard', 'Choir', 'Meridian', 'Archive', 'Canopy', 'Harbor', 'Loom', 'Garden', 'Observatory', 'Tide', 'Grove', 'Cascade', 'Lantern', 'Commons', 'Atlas'];
const OF = ['Nine Suns', 'Seven Tides', 'a Thousand Seeds', 'Slow Rivers', 'Small Lights', 'Distant Bells', 'Open Doors', 'Folded Maps', 'Borrowed Light', 'Second Chances', 'Quiet Engines', 'Green Wires', 'Soft Machines', 'Long Summers', 'Paper Moons', 'Kept Promises'];

/** A universe's name follows from its seed alone: the same universe is always called the same thing. */
export function universeName(seed: number): string {
  let h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); h = (h ^ h >>> 16) >>> 0;
  return `The ${ADJECTIVES[h & 15]} ${NOUNS[h >>> 4 & 15]} of ${OF[h >>> 8 & 15]}`;
}

const DAY = 86_400, YEAR = 365 * DAY;
const MILESTONES: [number, string][] = [
  [3_600, 'one hour old'], [DAY, 'one day old'], [7 * DAY, 'one week old'],
  [30 * DAY, 'thirty days old'], [100 * DAY, 'one hundred days old'], [YEAR, 'one year old'],
];
const YEARS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The most recent simulation-age milestone crossed in (from, to], if any. */
export function milestoneBetween(from: number, to: number): string | null {
  if (!(to > from)) return null;
  const years = Math.floor(to / YEAR);
  if (years >= 2 && years * YEAR > from) return `${YEARS[years] ?? years} years old`;
  for (let i = MILESTONES.length - 1; i >= 0; i--) if (MILESTONES[i][0] > from && MILESTONES[i][0] <= to) return MILESTONES[i][1];
  return null;
}

/** What an observer last saw. Counts only; no simulation state is copied or changed. */
export interface Glimpse { id: string; age: number; trace: number; converged: number; spawned: number; anomalies: number }
export function glimpse(u: Universe): Glimpse {
  return { id: u.id, age: u.age, trace: u.traces.at(-1)?.eventSeq ?? -1, converged: u.totals.converged, spawned: u.totals.spawned, anomalies: u.totals.anomalies };
}

export interface Postcard { greeting: string; away: string; lines: string[]; milestone: string | null }
/** Simulated seconds away before the universe says hello. */
export const HOMECOMING_SECONDS = 20 * 60;

function duration(seconds: number): string {
  const units: [number, string][] = [[DAY, 'day'], [3_600, 'hour'], [60, 'minute']];
  const parts: string[] = [];
  for (const [size, unit] of units) {
    const n = Math.floor(seconds / size); seconds -= n * size;
    if (n && parts.length < 2) parts.push(`${n.toLocaleString('en-US')} ${unit}${n === 1 ? '' : 's'}`);
    else if (parts.length) break;
  }
  return parts.join(', ') || 'a little while';
}
function count(n: number, one: string, many: string): string { return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`; }

export function homecoming(before: Glimpse, u: Universe, hour: number): Postcard | null {
  const away = u.age - before.age;
  if (before.id !== u.id || !(away >= HOMECOMING_SECONDS)) return null;
  const greeting = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const grown = u.traces.filter(trace => trace.eventSeq > before.trace).length;
  const lines = [
    grown ? `${grown.toLocaleString('en-US')}${grown >= LIMITS.traces ? '+' : ''} new ${grown === 1 ? 'tendril' : 'tendrils'} grew in the garden` : '',
    u.totals.converged > before.converged ? `${count(u.totals.converged - before.converged, 'experiment', 'experiments')} found an answer` : '',
    u.totals.spawned > before.spawned ? `${count(u.totals.spawned - before.spawned, 'agent was', 'agents were')} born` : '',
    u.totals.anomalies > before.anomalies ? `${count(u.totals.anomalies - before.anomalies, 'anomaly', 'anomalies')} weathered` : '',
  ].filter(Boolean).slice(0, 3);
  return { greeting, away: duration(away), lines, milestone: milestoneBetween(before.age, u.age) };
}
