// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { crashSchedule, viewingSeconds } from '../src/core/crashes.ts';
import { UniverseRuntime } from '../src/core/runtime.ts';
import { SnapshotStore } from '../src/persistence/store.ts';
import { createUniverse } from '../src/core/universe.ts';
import { encodeSnapshot, decodeSnapshot, validateSnapshot } from '../src/persistence/snapshot.ts';
import type { Snapshot } from '../src/core/types.ts';

const isolated = () => new SnapshotStore(`crash-test-${crypto.randomUUID()}`);
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
const fresh = (): Snapshot => ({ universe: createUniverse(42), savedAt: Date.now(), anomalyRate: 0.35 });
function tickSeconds(r: UniverseRuntime, seconds: number) {
  const now = Date.now(), mono = performance.now();
  for (let i = 1; i <= seconds; i++) r.tick(now + i * 1000, mono + i * 1000);
}

test('crash timing is seeded, bounded, and ignores sleeping time', () => {
  assert.deepEqual(crashSchedule(123), crashSchedule(123));
  assert.notDeepEqual(crashSchedule(123), crashSchedule(124));
  for (let seed = 0; seed < 100; seed++) {
    const rare = crashSchedule(seed), occasional = crashSchedule(seed, 'occasional');
    assert.ok(rare.remaining >= 2700 && rare.remaining <= 5400);
    assert.ok(occasional.remaining >= 600 && occasional.remaining <= 1200);
  }
  assert.equal(viewingSeconds(86400), 2); assert.equal(viewingSeconds(-1), 0);
});

test('optional crash schedule round-trips and rejects malformed imports', async () => {
  const s = fresh(); s.crashSchedule = crashSchedule(42);
  assert.deepEqual(await decodeSnapshot(await encodeSnapshot(s)), s);
  s.crashSchedule.remaining = -1; assert.throws(() => validateSnapshot(s), /crash schedule/);
  s.crashSchedule.remaining = 5500; assert.throws(() => validateSnapshot(s), /crash schedule/);
});

test('collapse archives exactly one universe and reset/import retain that archive', async t => {
  const db = isolated(); t.after(() => db.close());
  const a = fresh(), b = fresh(), c = fresh(); await db.save(a);
  await db.collapse(a, b); assert.deepEqual(await db.load(), b); assert.deepEqual(await db.loadCollapsed(), a);
  await db.collapse(b, c); assert.deepEqual(await db.loadCollapsed(), b);
  await db.reset(a); assert.deepEqual(await db.loadCollapsed(), b);
  const bad = fresh(); bad.universe.agents = [];
  await assert.rejects(db.collapse(c, bad)); assert.deepEqual(await db.load(), a); assert.deepEqual(await db.loadCollapsed(), b);
});

test('automatic crash freezes simulation then archives and starts fresh', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); });
  await r.start(); r.snapshot.crashSchedule = { frequency: 'rare', remaining: 0 };
  r.tick(); assert.equal(r.crash?.preview, false); const old = structuredClone(r.snapshot);
  assert.equal(r.canMutate(), false); assert.equal(r.canPause(), false);
  tickSeconds(r, 8); await settle();
  assert.equal(r.crash, null); assert.notEqual(r.snapshot.universe.id, old.universe.id);
  assert.notEqual(r.snapshot.universe.seed, old.universe.seed); assert.equal(r.snapshot.universe.age, 0);
  assert.deepEqual((await r.store.loadCollapsed())?.universe, old.universe);
  assert.deepEqual(await r.store.load(), r.snapshot); assert.ok(r.snapshot.crashSchedule!.remaining >= 2700);
});

test('visual preview neither resets nor archives the universe', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); });
  await r.start(); const old = structuredClone(r.snapshot.universe), schedule = structuredClone(r.snapshot.crashSchedule);
  r.previewCrash(); tickSeconds(r, 8);
  assert.equal(r.crash, null); assert.deepEqual(r.snapshot.universe, old); assert.deepEqual(r.snapshot.crashSchedule, schedule);
  assert.equal(await r.store.loadCollapsed(), null);
});

test('pause, suspension, speed and disabled crashes cannot consume hidden hours', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); });
  await r.start(); r.setSpeed(1000); r.setPaused(true);
  r.snapshot.crashSchedule = { frequency: 'rare', remaining: 500 };
  tickSeconds(r, 4); assert.equal(r.snapshot.crashSchedule.remaining, 500);
  r.setPaused(false); r.tick(Date.now() + 3600000, performance.now() + 3600000);
  assert.ok(r.snapshot.crashSchedule.remaining >= 498);
  r.setCrashFrequency('off'); tickSeconds(r, 8); assert.equal(r.crash, null);
  r.previewCrash(); await r.suspend(); const remaining = r.crash!.remaining;
  tickSeconds(r, 8); assert.equal(r.crash!.remaining, remaining);
});

test('reload and follower takeover preserve pending collapse without offline catch-up', async t => {
  const db = isolated(), r = new UniverseRuntime(db), follower = new UniverseRuntime(new SnapshotStore(db.name));
  t.after(async () => { await r.suspend(); await follower.suspend(); db.close(); follower.store.close(); });
  await r.start(); r.snapshot.crashSchedule = { frequency: 'rare', remaining: 0 }; r.snapshot.savedAt = Date.now() - 86400000;
  await r.checkpoint(); await follower.start(); follower.tick(); assert.equal(follower.crash, null);
  const age = r.snapshot.universe.age; await r.suspend(); await settle();
  follower.tick(Date.now(), performance.now() + 6000); await settle();
  assert.equal(follower.mode, 'writer'); assert.ok(follower.snapshot.universe.age < age + 5);
  follower.tick(); assert.ok(Boolean(follower.crash));
});

test('archive write failure cancels reboot and preserves current identity', async t => {
  class FailingArchive extends SnapshotStore { override async collapse(): Promise<void> { throw new Error('Quota exceeded'); } }
  const r = new UniverseRuntime(new FailingArchive(`failure-${crypto.randomUUID()}`));
  t.after(async () => { await r.suspend(); r.store.close(); }); await r.start();
  r.snapshot.crashSchedule = { frequency: 'rare', remaining: 0 }; r.tick(); const id = r.snapshot.universe.id;
  tickSeconds(r, 8); await settle();
  assert.equal(r.crash, null); assert.equal(r.snapshot.universe.id, id); assert.equal(r.snapshot.crashSchedule.frequency, 'off');
  assert.match(r.message, /Reboot cancelled/); assert.equal(await r.store.loadCollapsed(), null);
});

test('restoring collapsed snapshot starts a new grace period', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); }); await r.start();
  const old = fresh(); old.crashSchedule = { frequency: 'rare', remaining: 0 };
  await r.import(old); r.tick(); assert.equal(r.snapshot.universe.id, old.universe.id);
  assert.equal(r.crash, null); assert.ok(r.snapshot.crashSchedule!.remaining > 2600);
});
