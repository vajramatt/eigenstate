// SPDX-License-Identifier: MIT
import type { Preferences, Snapshot } from '../core/types.ts';
import { decodeSnapshot, encodeSnapshot, FutureVersionError } from './snapshot.ts';

export class SnapshotStore {
  readonly name: string;
  private db?: IDBDatabase;
  notice = '';
  constructor(name = 'eigenstate-v1') { this.name = name; }
  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('settings'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database upgrade blocked. Close other Eigenstate tabs and reload.'));
    });
    this.db.onversionchange = () => this.close();
  }
  close(): void { this.db?.close(); this.db = undefined; }
  private async read(store: string, key: string): Promise<unknown> {
    await this.open();
    return new Promise((resolve, reject) => {
      const request = this.db!.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  private async write(store: string, action: (object: IDBObjectStore) => void): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Save transaction aborted'));
      try { action(tx.objectStore(store)); } catch (error) { tx.abort(); reject(error); }
    });
  }
  /** Called under the origin-wide Web Lock. All replacement writes are one IDB transaction. */
  async save(snapshot: Snapshot): Promise<void> {
    const encoded = await encodeSnapshot(snapshot);
    await this.write('state', object => {
      const old = object.get('current');
      old.onsuccess = () => { if (old.result) object.put(old.result, 'previous'); object.put(encoded, 'current'); };
    });
  }
  async load(recover = true): Promise<Snapshot | null> {
    this.notice = '';
    const raw = await this.read('state', 'current');
    if (!raw) return null;
    try { return await decodeSnapshot(raw); }
    catch (error) {
      if (error instanceof FutureVersionError || !recover) throw error;
      const backups = await this.read('state', 'quarantine');
      await this.write('state', object => {
        object.put([...(Array.isArray(backups) ? backups : []), { detectedAt: Date.now(), snapshot: raw }].slice(-3), 'quarantine');
        object.delete('current');
      });
      const previous = await this.read('state', 'previous');
      this.notice = 'Damaged snapshot preserved. Started a new universe.';
      if (previous) {
        try { const restored = await decodeSnapshot(previous); this.notice = 'Damaged snapshot preserved. Recovered the previous checkpoint.'; return restored; }
        catch (backupError) { if (backupError instanceof FutureVersionError) throw backupError; }
      }
      return null;
    }
  }
  async reset(snapshot: Snapshot): Promise<void> {
    const encoded = await encodeSnapshot(snapshot);
    await this.write('state', object => { object.clear(); object.put(encoded, 'current'); });
  }
  async loadPreferences(): Promise<Partial<Preferences>> {
    const value = await this.read('settings', 'preferences');
    return value && typeof value === 'object' ? value as Partial<Preferences> : {};
  }
  async savePreferences(value: Preferences): Promise<void> { await this.write('settings', object => object.put(value, 'preferences')); }
  async diagnosticExport(): Promise<string> {
    return JSON.stringify({ current: await this.read('state', 'current'), quarantine: await this.read('state', 'quarantine') }, null, 2);
  }
}
