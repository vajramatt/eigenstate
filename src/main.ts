// SPDX-License-Identifier: MIT
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const check = async () => {
      await registration.update();
      const response = await fetch('/version.json', { cache: 'no-store' });
      if (!response.ok) return;
      const release = await response.json() as { version?: string };
      if (release.version && release.version !== __APP_VERSION__) {
        window.dispatchEvent(new CustomEvent('eigenstate:update-available', { detail: release.version }));
        await registration.update();
      }
    };
    void check();
    setInterval(() => void check(), 60 * 60 * 1000);
  }).catch(() => { /* Offline support is optional. */ });
}
