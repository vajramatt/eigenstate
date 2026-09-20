// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { SnapshotStore } from '../src/persistence/store.ts';
import { decodeSnapshot, encodeSnapshot, FutureVersionError, validateSnapshot } from '../src/persistence/snapshot.ts';
import { createUniverse } from '../src/core/universe.ts';
import { advance } from '../src/core/simulation.ts';
import type { Snapshot } from '../src/core/types.ts';

const fresh = (): Snapshot => ({ universe: createUniverse(43), savedAt: Date.now(), anomalyRate: 0.35 });
function store() { return new SnapshotStore(`eigenstate-test-${crypto.randomUUID()}`); }
async function overwrite(s: SnapshotStore, value: unknown, key = 'current') {
  await new Promise<void>((resolve, reject) => { const r = indexedDB.open(s.name); r.onsuccess = () => { const db = r.result, tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(value, key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
}
test('checksummed snapshots round-trip exactly', async () => { const s = fresh(); advance(s.universe, 36000); assert.deepEqual(await decodeSnapshot(await encodeSnapshot(s)), s); });
test('version one migrates lastSavedAt and defaults anomaly rate', async () => {
  const s = fresh(), payload = JSON.stringify({ universe: s.universe, lastSavedAt: s.savedAt });
  const checksum = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))).toString('hex');
  assert.deepEqual(await decodeSnapshot({ version: 1, payload, checksum }), s);
});
test('version two snapshots migrate with an empty causal trace ledger', async () => {
  const s = fresh(), legacy = structuredClone(s) as Snapshot;
  delete (legacy.universe as Partial<typeof legacy.universe>).traces;
  const payload = JSON.stringify(legacy), checksum = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))).toString('hex');
  const decoded = await decodeSnapshot({ version: 2, payload, checksum });
  assert.deepEqual(decoded.universe.traces, []); validateSnapshot(decoded);
});
test('checksum changes and malformed vectors are rejected', async () => {
  const s = fresh(), e = await encodeSnapshot(s); await assert.rejects(decodeSnapshot({ ...e, checksum: '0'.repeat(64) }));
  s.universe.quantum.probabilities = []; assert.throws(() => validateSnapshot(s));
});
test('database saves and loads exact state', async () => { const db = store(), s = fresh(); await db.save(s); assert.deepEqual(await db.load(), s); db.close(); });
test('failed validation leaves previous atomic checkpoint intact', async () => {
  const db = store(), s = fresh(); await db.save(s); const broken = structuredClone(s); broken.universe.agents = [];
  await assert.rejects(db.save(broken)); assert.deepEqual(await db.load(), s); db.close();
});
test('reset replaces identity and age without changing theme', async () => {
  const db = store(), s = fresh(); advance(s.universe, 86400); await db.save(s);
  await db.savePreferences({ theme: 'synthwave84', layout: 'adaptive', quiet: true });
  const next = fresh(); next.universe.seed = 44; await db.reset(next);
  const loaded = await db.load(); assert.equal(loaded?.universe.age, 0); assert.notEqual(loaded?.universe.id, s.universe.id);
  assert.equal((await db.loadPreferences()).theme, 'synthwave84'); db.close();
});
test('corrupt snapshot is quarantined and previous checkpoint recovered', async () => {
  const db = store(), a = fresh(), b = structuredClone(a); advance(b.universe, 100); await db.save(a); await db.save(b);
  await overwrite(db, { broken: true }); assert.deepEqual(await db.load(), a); assert.match(db.notice, /Recovered/);
  assert.match(await db.diagnosticExport(), /broken/); db.close();
});
test('unrecoverable snapshot returns a new-universe signal and preserves evidence', async () => {
  const db = store(); await db.open(); await overwrite(db, 'not JSON'); assert.equal(await db.load(), null);
  assert.match(await db.diagnosticExport(), /not JSON/); db.close();
});
test('future snapshot remains untouched', async () => {
  const db = store(), e = { ...await encodeSnapshot(fresh()), version: 99 }; await db.open(); await overwrite(db, e);
  await assert.rejects(db.load(), FutureVersionError); assert.deepEqual(JSON.parse(await db.diagnosticExport()).current, e); db.close();
});
test('followers cannot recover or replace corrupt state', async () => {
  const db = store(); await db.open(); await overwrite(db, 'broken'); await assert.rejects(db.load(false));
  assert.equal(JSON.parse(await db.diagnosticExport()).current, 'broken'); db.close();
});
test('corruption quarantine retains at most three snapshots', async () => {
  const db = store(); await db.open();
  for (let i = 0; i < 5; i++) { await overwrite(db, { bad: i }); await db.load(); }
  assert.equal(JSON.parse(await db.diagnosticExport()).quarantine.length, 3); db.close();
});
