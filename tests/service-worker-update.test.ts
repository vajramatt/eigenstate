// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { observeUpdates } from '../src/persistence/updates.ts';

test('generated service worker installs and activates without navigating open windows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eigenstate-worker-'));
  try {
    await mkdir(join(directory, 'dist/assets'), { recursive: true });
    await mkdir(join(directory, 'docs/licenses'), { recursive: true });
    await Promise.all([
      writeFile(join(directory, 'dist/index.html'), '<html>worker fixture</html>'),
      writeFile(join(directory, 'dist/assets/app.js'), '// fixture'),
      writeFile(join(directory, 'package.json'), '{"version":"test"}'),
      writeFile(join(directory, 'LICENSE'), 'fixture'),
      writeFile(join(directory, 'THIRD_PARTY_NOTICES.md'), 'fixture'),
    ]);
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL('../scripts/build-sw.mjs', import.meta.url))], { cwd: directory });
    const handlers = new Map<string, (event: unknown) => void>();
    const deleted: string[] = [], cached: string[] = [];
    let skipped = 0, claimed = 0, navigated = 0;
    runInNewContext(await readFile(join(directory, 'dist/sw.js'), 'utf8'), {
      URL,
      self: {
        location: { origin: 'https://eigenstate.test' },
        addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
        skipWaiting: async () => { skipped++; },
        clients: {
          claim: async () => { claimed++; },
          matchAll: async () => [{ url: 'https://eigenstate.test/', navigate: async () => { navigated++; } }],
        },
      },
      caches: {
        open: async () => ({ addAll: async (paths: string[]) => cached.push(...paths) }),
        keys: async () => ['eigenstate-old-build', 'unrelated-cache'],
        delete: async (key: string) => { deleted.push(key); return true; },
      },
    });
    for (const event of ['install', 'activate']) {
      let pending: Promise<unknown> | undefined;
      handlers.get(event)!({ waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
      assert.ok(pending); await pending;
    }
    assert.equal(skipped, 1); assert.equal(claimed, 1);
    assert.ok(cached.includes('/') && cached.includes('/assets/app.js'));
    assert.deepEqual(deleted, ['eigenstate-old-build']);
    assert.equal(navigated, 0, 'Activating an update must not reload the running universe');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

class Workers extends EventTarget {
  controller: ServiceWorker | null = null;
  replace(controller: ServiceWorker | null) { this.controller = controller; this.dispatchEvent(new Event('controllerchange')); }
}

test('first service-worker install is quiet; replacements notify once and can be unsubscribed', () => {
  const workers = new Workers(); let notices = 0;
  const stop = observeUpdates(workers as unknown as ServiceWorkerContainer, () => notices++);
  const first = {} as ServiceWorker, second = {} as ServiceWorker;
  workers.replace(first); assert.equal(notices, 0);
  workers.replace(second); assert.equal(notices, 1);
  workers.replace(second); assert.equal(notices, 1);
  stop(); workers.replace({} as ServiceWorker); assert.equal(notices, 1);
});

test('an already controlled page detects a new worker even when package version stays unchanged', () => {
  const workers = new Workers(); workers.controller = {} as ServiceWorker;
  let notices = 0;
  observeUpdates(workers as unknown as ServiceWorkerContainer, () => notices++);
  workers.replace({} as ServiceWorker);
  assert.equal(notices, 1);
});
