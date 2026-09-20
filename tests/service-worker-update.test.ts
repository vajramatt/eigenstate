// SPDX-License-Identifier: MIT
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('service worker takes over installed apps and refreshes navigation from network', async () => {
  const worker = await readFile(new URL('../scripts/build-sw.mjs', import.meta.url), 'utf8');
  const registration = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(worker, /skipWaiting/);
  assert.match(worker, /clients\.claim/);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(registration, /registration\.update/);
  assert.match(registration, /updateViaCache:\s*'none'/);
  assert.match(registration, /fetch\('\/version\.json', \{ cache: 'no-store' \}\)/);
  assert.match(worker, /dist\/version\.json/);
});
