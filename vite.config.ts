// SPDX-License-Identifier: MIT
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
const packageMeta = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
export default defineConfig({
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(packageMeta.version) },
  build: { target: 'es2022' },
});
