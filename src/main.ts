// SPDX-License-Identifier: MIT
import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
    void registration.update();
    setInterval(() => void registration.update(), 60 * 60 * 1000);
  }).catch(() => { /* Offline support is optional. */ });
}
