// SPDX-License-Identifier: MIT
import type { CrashFrequency, Snapshot } from './types.ts';
import { crashSchedule, CRASH_SECONDS, viewingSeconds, type CrashSequence } from './crashes.ts';
import { createUniverse } from './universe.ts';
import { freshSeed } from './random.ts';
import { advance, reconcile } from './simulation.ts';
import { triggerAnomaly } from './anomalies.ts';
import { glimpse, type Glimpse } from './homecoming.ts';
import { SnapshotStore } from '../persistence/store.ts';
import { FutureVersionError } from '../persistence/snapshot.ts';

export class UniverseRuntime {
  readonly store: SnapshotStore;
  snapshot: Snapshot;
  mode: 'starting' | 'writer' | 'follower' | 'memory' | 'blocked' = 'starting';
  message = '';
  paused = false;
  speed = 1;
  lastSave = 0;
  stepMs = 0;
  crash: CrashSequence | null = null;
  /** The saved universe as last seen, captured before elapsed time is reconciled. */
  arrival: Glimpse | undefined;
  onChange: () => void = () => {};
  private lastTick = 0;
  private lastPoll = 0;
  private release?: () => void;
  private writes: Promise<void> = Promise.resolve();
  private stopped = false;
  private replacing = false;
  private checkpointPending = false;
  constructor(store = new SnapshotStore()) {
    this.store = store;
    this.snapshot = { universe: createUniverse(freshSeed()), savedAt: Date.now(), anomalyRate: 0.35 };
  }
  async start(): Promise<void> {
    this.stopped = false;
    this.lastTick = performance.now();
    if (!navigator.locks) { this.mode = 'memory'; this.message = 'Safe browser storage unavailable. Export your universe before closing.'; return; }
    await this.acquire();
  }
  private async acquire(): Promise<void> {
    return new Promise<void>(resolve => {
      void navigator.locks.request('eigenstate-universe-writer', { ifAvailable: true }, async lock => {
        if (this.stopped || (this.paused && this.mode === 'follower')) { resolve(); return; }
        if (!lock) {
          this.mode = 'follower';
          try { const snapshot = await this.store.load(false); if (snapshot && !this.paused) this.snapshot = snapshot; }
          catch (error) { this.message = String(error); }
          this.onChange(); resolve(); return;
        }
        const hold = new Promise<void>(release => { this.release = release; });
        try {
          const saved = await this.store.load();
          if (saved) {
            if (saved.universe.id !== this.snapshot.universe.id) this.crash = null;
            this.snapshot = saved;
          }
          this.snapshot.crashSchedule ??= crashSchedule(this.snapshot.universe.seed);
          if (this.paused || this.crash || (this.snapshot.crashSchedule.frequency !== 'off' && this.snapshot.crashSchedule.remaining === 0)) this.snapshot.savedAt = Math.max(this.snapshot.savedAt, Date.now());
          else { this.arrival = glimpse(this.snapshot.universe); reconcile(this.snapshot); }
          this.mode = 'writer'; this.message = this.store.notice;
          await this.checkpoint();
        } catch (error) {
          this.mode = error instanceof FutureVersionError ? 'blocked' : 'memory';
          this.message = error instanceof Error ? error.message : 'Browser storage unavailable. Export before closing.';
          this.release?.();
        }
        this.lastTick = performance.now(); this.onChange(); resolve();
        await hold;
      }).catch(error => { this.mode = 'memory'; this.message = String(error); resolve(); });
    });
  }
  tick(now = Date.now(), monotonic = performance.now()): void {
    if (this.stopped || this.replacing) return;
    if (this.mode === 'follower') {
      if (this.paused) return;
      if (monotonic - this.lastPoll > 5000) { this.lastPoll = monotonic; void this.acquire(); }
      return;
    }
    if (this.mode === 'blocked' || this.mode === 'starting') return;
    const elapsed = Math.max(0, monotonic - this.lastTick) / 1000;
    this.lastTick = monotonic;
    const started = performance.now();
    const due = this.snapshot.crashSchedule;
    if (!this.crash && !this.paused && this.mode === 'writer' && due && due.frequency !== 'off' && due.remaining === 0) {
      this.crash = { remaining: CRASH_SECONDS, preview: false };
      this.snapshot.savedAt = Math.max(this.snapshot.savedAt, now);
      void this.checkpoint(); this.onChange(); return;
    }
    if (this.crash) {
      this.snapshot.savedAt = Math.max(this.snapshot.savedAt, now);
      this.crash.remaining = Math.max(0, this.crash.remaining - viewingSeconds(elapsed));
      if (this.crash.remaining === 0) void this.finishCrash();
      this.onChange(); return;
    }
    if (!this.paused) {
      // A sleeping machine may advance wall time without advancing performance.now().
      const wallGap = Math.max(0, (now - this.snapshot.savedAt) / 1000);
      const dt = wallGap > elapsed + 5 ? wallGap : elapsed;
      advance(this.snapshot.universe, dt * this.speed, this.snapshot.anomalyRate);
      // Automatic reboots require durable storage and exclusive writer ownership.
      const schedule = this.snapshot.crashSchedule ??= crashSchedule(this.snapshot.universe.seed);
      if (this.mode === 'writer' && schedule.frequency !== 'off') {
        schedule.remaining = Math.max(0, schedule.remaining - viewingSeconds(elapsed));
        if (schedule.remaining === 0) { this.crash = { remaining: CRASH_SECONDS, preview: false }; void this.checkpoint(); }
      }
    }
    this.snapshot.savedAt = Math.max(this.snapshot.savedAt, now);
    this.stepMs = performance.now() - started;
    if (this.mode === 'writer' && now - this.lastSave >= 15000) void this.checkpoint();
    this.onChange();
  }
  private queue(action: () => Promise<void>): Promise<void> {
    const next = this.writes.then(action);
    this.writes = next.catch(error => { this.message = `Save failed. Export a backup. ${error instanceof Error ? error.message : ''}`; this.onChange(); });
    return next;
  }
  async checkpoint(): Promise<void> {
    if (this.mode !== 'writer' || this.replacing || this.checkpointPending) return;
    this.checkpointPending = true;
    const copy = structuredClone(this.snapshot);
    try { await this.queue(() => this.store.save(copy)); this.lastSave = Date.now(); }
    catch { /* queue exposes the save failure to the UI; later checkpoints can retry. */ }
    finally { this.checkpointPending = false; }
  }
  async suspend(): Promise<void> {
    this.tick(); this.stopped = true;
    // An in-flight checkpoint may predate the final tick. Flush it before copying
    // the final state, and retain writer ownership until both writes complete.
    await this.writes; await this.checkpoint(); this.release?.(); this.release = undefined;
  }
  async resume(): Promise<void> { if (this.stopped) await this.start(); }
  canMutate(): boolean { return !this.replacing && !this.crash && (this.mode === 'writer' || this.mode === 'memory'); }
  canPause(): boolean { return !this.replacing && !this.crash && ['writer', 'memory', 'follower'].includes(this.mode); }
  setPaused(value: boolean): void {
    if (!this.canPause()) return;
    if (this.mode !== 'follower') this.tick();
    this.paused = value; this.lastTick = performance.now(); this.onChange();
  }
  setSpeed(value: number): void { if (!this.canMutate()) return; this.tick(); this.speed = [1, 10, 100, 1000].includes(value) ? value : 1; this.lastTick = performance.now(); }
  async reset(): Promise<void> {
    if (!this.canMutate()) throw new Error('Open the active universe tab to reset.');
    const next = this.freshSnapshot();
    await this.replace(next);
  }
  async import(snapshot: Snapshot): Promise<void> {
    if (!this.canMutate()) throw new Error('Open the active universe tab to import.');
    const next = structuredClone(snapshot); reconcile(next);
    if (next.crashSchedule?.remaining === 0) next.crashSchedule = crashSchedule(next.universe.seed, next.crashSchedule.frequency);
    await this.replace(next);
  }
  private async replace(next: Snapshot): Promise<void> {
    this.replacing = true;
    try {
      if (this.mode === 'writer') await this.queue(() => this.store.reset(next));
      this.snapshot = next; this.lastTick = performance.now(); this.lastSave = Date.now();
    } finally { this.replacing = false; this.onChange(); }
  }
  anomaly(): void { if (this.canMutate()) { triggerAnomaly(this.snapshot.universe); this.onChange(); void this.checkpoint(); } }
  setCrashFrequency(value: string): void {
    if (!this.canMutate() || !['off', 'rare', 'occasional'].includes(value)) return;
    this.snapshot.crashSchedule = crashSchedule(this.snapshot.universe.seed, value as CrashFrequency);
    this.onChange(); void this.checkpoint();
  }
  previewCrash(): void {
    if (!this.canMutate()) return;
    this.crash = { remaining: CRASH_SECONDS, preview: true };
    this.lastTick = performance.now(); this.onChange();
  }
  private freshSnapshot(): Snapshot {
    const universe = createUniverse(freshSeed());
    return { universe, savedAt: Date.now(), anomalyRate: this.snapshot.anomalyRate, crashSchedule: crashSchedule(universe.seed, this.snapshot.crashSchedule?.frequency) };
  }
  private async finishCrash(): Promise<void> {
    if (!this.crash || this.replacing) return;
    if (this.crash.preview) { this.crash = null; this.lastTick = performance.now(); this.onChange(); return; }
    this.replacing = true;
    try {
      const previous = structuredClone(this.snapshot), next = this.freshSnapshot();
      await this.queue(() => this.store.collapse(previous, next));
      this.snapshot = next; this.lastSave = Date.now();
    } catch {
      // Never discard a universe when its archive could not be saved.
      this.snapshot.crashSchedule = crashSchedule(this.snapshot.universe.seed, 'off');
      this.message = 'Reboot cancelled: the universe could not be archived. Current universe preserved; simulated crashes disabled.';
    } finally {
      this.replacing = false; this.crash = null; this.lastTick = performance.now(); this.onChange();
    }
  }
}
