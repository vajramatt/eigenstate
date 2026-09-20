// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { UniverseRuntime } from '../src/core/runtime.ts';
import { SnapshotStore } from '../src/persistence/store.ts';
import { createUniverse } from '../src/core/universe.ts';
const isolated = () => new SnapshotStore(`runtime-test-${crypto.randomUUID()}`);

test('Web Locks allow one writer; follower takes over without changing universe ID', async t => {
  const store = isolated(), writer = new UniverseRuntime(store), follower = new UniverseRuntime(new SnapshotStore(store.name));
  t.after(async () => { await writer.suspend(); await follower.suspend(); store.close(); follower.store.close(); });
  await writer.start(); await follower.start();
  assert.equal(writer.mode, 'writer'); assert.equal(follower.mode, 'follower');
  assert.equal(follower.snapshot.universe.id, writer.snapshot.universe.id);
  const age = follower.snapshot.universe.age;
  follower.tick(Date.now(), performance.now() + 1); assert.equal(follower.snapshot.universe.age, age);
  await writer.suspend(); await new Promise(resolve => setImmediate(resolve));
  follower.tick(Date.now(), performance.now() + 6000);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(follower.mode, 'writer'); assert.equal(follower.snapshot.universe.id, writer.snapshot.universe.id);
});
test('paused runtime does not advance and stopped runtime does no work', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); });
  await r.start(); r.setPaused(true); const age = r.snapshot.universe.age;
  r.tick(Date.now() + 1000, performance.now() + 1000); assert.equal(r.snapshot.universe.age, age);
  await r.suspend(); const state = structuredClone(r.snapshot);
  r.tick(Date.now() + 3600000, performance.now() + 3600000); assert.deepEqual(r.snapshot, state);
  await new Promise(resolve => setImmediate(resolve)); await r.resume();
  assert.equal(r.snapshot.universe.age, age, 'resuming a paused session must not reconcile hidden time');
});
test('reset is serialized with pending checkpoints and does not resurrect old state', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); });
  await r.start(); const old = r.snapshot.universe.id, oldSeed = r.snapshot.universe.seed;
  const saving = r.checkpoint(), resetting = r.reset();
  r.tick(Date.now() + 60000, performance.now() + 60000);
  await Promise.all([saving, resetting]); await r.checkpoint();
  const loaded = await r.store.load(); assert.notEqual(loaded?.universe.id, old); assert.notEqual(loaded?.universe.seed, oldSeed); assert.equal(loaded?.universe.age, 0);
});
test('import reconciles elapsed time and preserves imported identity', async t => {
  const r = new UniverseRuntime(isolated()); t.after(async () => { await r.suspend(); r.store.close(); }); await r.start();
  const timestamp = Date.now() - 3600000, u = createUniverse(17, timestamp);
  await r.import({ universe: u, savedAt: timestamp, anomalyRate: 0 });
  assert.equal(r.snapshot.universe.id, u.id); assert.ok(r.snapshot.universe.age >= 3600); assert.deepEqual(await r.store.load(), r.snapshot);
});
test('storage failure keeps an exportable session without destructive writes', async t => {
  class BrokenStore extends SnapshotStore { override async open(): Promise<void> { throw new Error('Storage denied'); } }
  const r = new UniverseRuntime(new BrokenStore('blocked-test')); t.after(async () => r.suspend());
  await r.start(); assert.equal(r.mode, 'memory'); assert.match(r.message, /Storage denied/);
  r.tick(Date.now() + 1000, performance.now() + 1000); assert.ok(r.snapshot.universe.age > 0);
});

test('a follower can pause its own view without stopping the writer', async t => {
  const store = isolated(), writer = new UniverseRuntime(store), follower = new UniverseRuntime(new SnapshotStore(store.name));
  t.after(async () => { await writer.suspend(); await follower.suspend(); store.close(); follower.store.close(); });
  await writer.start(); await follower.start();
  assert.equal(follower.canPause(), true); follower.setPaused(true);
  const frozen = structuredClone(follower.snapshot);
  writer.tick(Date.now() + 1000, performance.now() + 1000); await writer.checkpoint();
  follower.tick(Date.now(), performance.now() + 6000);
  assert.equal(writer.paused, false); assert.deepEqual(follower.snapshot, frozen);
  follower.setPaused(false); follower.tick(Date.now(), performance.now() + 12000);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(follower.snapshot.universe.age > frozen.universe.age);
});
