// SPDX-License-Identifier: MIT
import type { Snapshot } from './types.ts';
import { createUniverse } from './universe.ts';
import { freshSeed } from './random.ts';
import { advance, reconcile } from './simulation.ts';
import { triggerAnomaly } from './anomalies.ts';
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
          if (saved) this.snapshot = saved;
          if (this.paused) this.snapshot.savedAt = Math.max(this.snapshot.savedAt, Date.now());
          else reconcile(this.snapshot);
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
    if (!this.paused) {
      // A sleeping machine may advance wall time without advancing performance.now().
      const wallGap = Math.max(0, (now - this.snapshot.savedAt) / 1000);
      const dt = wallGap > elapsed + 5 ? wallGap : elapsed;
      advance(this.snapshot.universe, dt * this.speed, this.snapshot.anomalyRate);
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
  canMutate(): boolean { return !this.replacing && (this.mode === 'writer' || this.mode === 'memory'); }
  canPause(): boolean { return !this.replacing && ['writer', 'memory', 'follower'].includes(this.mode); }
  setPaused(value: boolean): void {
    if (!this.canPause()) return;
    if (this.mode !== 'follower') this.tick();
    this.paused = value; this.lastTick = performance.now(); this.onChange();
  }
  setSpeed(value: number): void { if (!this.canMutate()) return; this.tick(); this.speed = [1, 10, 100, 1000].includes(value) ? value : 1; this.lastTick = performance.now(); }
  async reset(): Promise<void> {
    if (!this.canMutate()) throw new Error('Open the active universe tab to reset.');
    const next = { universe: createUniverse(freshSeed()), savedAt: Date.now(), anomalyRate: this.snapshot.anomalyRate };
    await this.replace(next);
  }
  async import(snapshot: Snapshot): Promise<void> {
    if (!this.canMutate()) throw new Error('Open the active universe tab to import.');
    const next = structuredClone(snapshot); reconcile(next);
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
}
