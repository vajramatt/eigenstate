// SPDX-License-Identifier: MIT
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { observeUpdates } from './persistence/updates.ts';

createApp(App).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  observeUpdates(navigator.serviceWorker, () => window.dispatchEvent(new Event('eigenstate:update-available')));
  void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    const check = async () => {
      try { await registration.update(); }
      catch { /* Offline checks can wait until the next interval or navigation. */ }
    };
    void check();
    setInterval(() => void check(), 60 * 60 * 1000);
  }).catch(() => { /* Offline support is optional. */ });
}
