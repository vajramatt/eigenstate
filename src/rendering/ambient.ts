// SPDX-License-Identifier: MIT
export interface AmbientState {
  world: boolean;
  alternateLayout: boolean;
  brightness: number;
  worldBrightness: number;
}

/** Presentation time only: simulation speed, pauses, and PRNG never drive idle time. */
export class AmbientDirector {
  private lastActivity: number;
  private worldStarted: number | undefined;
  private manual = false;

  constructor(now = 0) { this.lastActivity = now; }

  reset(now: number): void { this.lastActivity = now; this.worldStarted = undefined; this.manual = false; }

  enterWorld(now: number): void { this.lastActivity = now; this.worldStarted = now; this.manual = true; }

  update(now: number, options: { blocked?: boolean; worldEvent?: boolean; still?: boolean } = {}): AmbientState {
    if (options.blocked) this.reset(now);
    const idle = Math.max(0, (now - this.lastActivity) / 1000);
    if (this.worldStarted === undefined && (idle >= 75 || idle >= 60 && options.worldEvent)) {
      this.worldStarted = Math.min(now, this.lastActivity + 75_000);
    }
    const elapsed = this.worldStarted === undefined ? -1 : Math.max(0, (now - this.worldStarted) / 1000);
    const cycle = Math.floor(Math.max(0, elapsed) / 225), phase = Math.max(0, elapsed) % 225;
    const world = elapsed >= 0 && phase < 180;
    const brightness = 1 - Math.min(1, Math.max(0, idle - 75) / 900) * 0.62;
    return {
      world,
      alternateLayout: elapsed >= 0 && (cycle + (world ? 0 : 1)) % 2 === 1,
      brightness,
      // Still images fade completely instead of leaving a frozen model on screen.
      worldBrightness: brightness * (this.manual && cycle === 0 ? 1 : 0.75) * (options.still ? Math.max(0, 1 - phase / 30) : 1),
    };
  }
}
