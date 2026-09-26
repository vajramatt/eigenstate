// SPDX-License-Identifier: MIT
// The Eigenstate mark: a Bloch sphere whose state vector precesses in superposition,
// is measured onto the |0⟩ pole, rests there as an eigenstate, then is released.
// Pure geometry so the loop can be tested; components turn it into SMIL keyframes.

export const MARK = { cx: 20, cy: 20, r: 14, tilt: 0.3 } as const;
/** Polar angle of the precession cone, in radians from the |0⟩ pole. */
export const CONE = 55 * Math.PI / 180;
/** Loop phases as fractions of one cycle: precess → measure → rest → release. */
export const PHASES = { measure: 0.62, rest: 0.72, release: 0.9 } as const;
const STEPS = { precess: 24, measure: 5, release: 5 };

export interface MarkPoint { x: number; y: number; front: boolean }
export interface MarkFrame extends MarkPoint { t: number }

/** Orthographic projection of a unit Bloch vector, viewed from slightly above the equator. */
export function project(theta: number, phi: number): MarkPoint {
  const { cx, cy, r, tilt } = MARK, lean = Math.sqrt(1 - tilt * tilt);
  const x = Math.sin(theta) * Math.cos(phi), y = Math.sin(theta) * Math.sin(phi), z = Math.cos(theta);
  const depth = y * lean + z * tilt;
  return { x: round(cx + r * x), y: round(cy - r * (z * lean - y * tilt)), front: depth >= -1e-9 };
}

/** One seamless cycle. The first and last frames share a pose so SMIL loops without a seam. */
export function markFrames(): MarkFrame[] {
  const frames: MarkFrame[] = [];
  const push = (t: number, theta: number, phi: number) => frames.push({ t: round(t, 4), ...project(theta, phi) });
  for (let i = 0; i <= STEPS.precess; i++) push(PHASES.measure * i / STEPS.precess, CONE, 2 * Math.PI * i / STEPS.precess);
  // Measurement spirals the vector onto the pole while it keeps turning.
  for (let i = 1; i <= STEPS.measure; i++) {
    const k = ease(i / STEPS.measure);
    push(PHASES.measure + (PHASES.rest - PHASES.measure) * i / STEPS.measure, CONE * (1 - k), 2 * Math.PI + Math.PI / 2 * k);
  }
  push(PHASES.release, 0, 0);
  // Release: the vector leaves the pole and rejoins the cone where the cycle began.
  for (let i = 1; i <= STEPS.release; i++) {
    const k = ease(i / STEPS.release);
    push(PHASES.release + (1 - PHASES.release) * i / STEPS.release, CONE * k, -Math.PI / 2 * (1 - k));
  }
  return frames;
}

/** SMIL `values` / `keyTimes` strings for one channel of the cycle. */
export function smil(frames: MarkFrame[], pick: (f: MarkFrame) => number | string): { values: string; keyTimes: string } {
  return { values: frames.map(pick).join(';'), keyTimes: frames.map(f => f.t).join(';') };
}

/** Screen geometry of a latitude ring at the given polar angle. */
export function latitude(theta: number): { cy: number; rx: number; ry: number } {
  const { cy, r, tilt } = MARK, lean = Math.sqrt(1 - tilt * tilt);
  return { cy: round(cy - r * Math.cos(theta) * lean), rx: round(r * Math.sin(theta)), ry: round(r * Math.sin(theta) * tilt) };
}

function ease(k: number): number { return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; }
function round(v: number, places = 3): number { const f = 10 ** places; return Math.round(v * f) / f; }
