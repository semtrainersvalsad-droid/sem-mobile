import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

/**
 * Register the service worker, and — the part that was missing — make sure a
 * new version actually reaches the phone.
 *
 * Registration used to be fire-and-forget: register once, never check again.
 * Combined with a cache-first navigation handler, that meant an installed app
 * kept running the build it was first opened with. Deploys landed on the server
 * and changed nothing in anyone's hand, which is a worse failure than a broken
 * deploy because everything reports success.
 *
 * Three things make an update land:
 *
 *  1. Ask. A browser only checks sw.js on a real navigation, and an installed
 *     PWA that is resumed from the background never makes one. So check on
 *     load, and again whenever the app comes back to the foreground.
 *
 *  2. Take over. skipWaiting in the worker means a new one activates without
 *     waiting for every tab to close.
 *
 *  3. Reload. A page already running the old bundle keeps running it even after
 *     a new worker takes control, so the page has to reload itself. Once — the
 *     guard matters, because controllerchange can fire more than once and a
 *     reload loop is worse than a stale app.
 *
 * Reloading under someone is normally rude. It is safe here because nothing on
 * screen holds unsaved state: queued work lives in IndexedDB and survives, and
 * the screens all re-read from cache on mount.
 */
if ('serviceWorker' in navigator) {
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when there was already a controller. On a first install the
    // worker takes control of a page that is by definition current, and
    // reloading there would make every first launch flicker.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        // A resumed app makes no navigation, so nothing would otherwise
        // prompt the browser to look for a new worker.
        const check = () => { reg.update().catch(() => {}); };
        check();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        // A worker that installed while the app was closed sits waiting until
        // something tells it to proceed.
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              next.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => console.warn('[pwa] service worker did not register', err));
  });
}
