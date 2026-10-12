/**
 * Service worker — the reason this app lives outside Apps Script at all.
 *
 * A service worker cannot be registered from an Apps Script web app: the page
 * runs in a sandboxed iframe on an ephemeral googleusercontent.com origin, and
 * registration needs an origin you control. No service worker means no install
 * prompt, no offline, no standalone window. That single fact is what moved the
 * frontend to static hosting.
 *
 * WHAT IS AND IS NOT CACHED
 *
 *   App shell (this build's JS, CSS, icons) — precached, cache-first. It only
 *   changes when a new version is deployed, and a new version gets new
 *   filenames, so a stale shell cannot be served by accident.
 *
 *   API calls (POST to /exec) — NEVER cached here. A POST is not idempotent and
 *   caching one would be a way to replay a write. Data caching belongs in
 *   IndexedDB where the app can decide what is stale; see db.js.
 *
 * The version string is what evicts old caches. Bump it on every deploy.
 */

/**
 * The cache name carries the build.
 *
 * This was the constant 'sem-mobile-v1', with a comment telling whoever came
 * next to bump it on every deploy. Nobody ever did, including me, across a
 * dozen deploys — so `activate` deleted every cache except the one it was
 * already using, old assets accumulated forever, and nothing was ever evicted.
 * A rule that depends on remembering is not a rule. The build writes it now.
 */
const VERSION = /*__BUILDID__*/'dev';
const SHELL = 'sem-mobile-' + VERSION + '-shell';

// Filled by the build. Vite fingerprints asset names, so precaching the
// manifest is what makes a new deploy take effect rather than lingering.
// __PRECACHE__ is replaced at build time by scripts/postbuild.mjs with the
// real, fingerprinted asset list. If you ever see the literal placeholder in a
// deployed file, the post-build step did not run and this app is not offline-
// capable — which is precisely the failure that is easy to miss, because
// everything else still works.
const PRECACHE = /*__PRECACHE__*/['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      // One missing file must not leave the app with no worker at all; a
      // partially warm cache still beats none.
      .catch(err => console.warn('[sw] precache incomplete', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Writes are never served from a cache, and never stored in one.
  if (req.method !== 'GET') return;

  // Anything crossing to the ERP backend goes straight to the network. The app
  // layer handles offline for those, because only it knows what a stale answer
  // means for a given screen.
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') ||
      url.hostname.endsWith('googleusercontent.com')) return;

  /**
   * Navigations: network first, cache only as a fallback.
   *
   * This was cache-first, and that is how an installed app pins itself to the
   * version it was first opened with. index.html names the fingerprinted
   * bundle; serve a cached index.html and the browser asks for the old bundle,
   * finds it cached too, and runs last week's app forever. Every deploy landed
   * correctly on the server and changed nothing on the phone.
   *
   * The HTML is one small request and it is the only file that decides which
   * build runs, so it is worth fetching when there is signal. Offline still
   * works: the cached copy answers, and that is the case cache-first was for.
   */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }).then(hit => hit ||
          new Response('<h1>Offline</h1><p>Open the app again once you have signal.</p>',
            { headers: { 'Content-Type': 'text/html' } })))
    );
    return;
  }

  // Same-origin assets: cache first, since their names change when they change.
  if (url.origin === self.location.origin) {
    e.respondWith(
      // ignoreVary is not optional here. Vite serves JS assets with
      // Vary: Origin, and Cache.match honours Vary by default — so the one
      // file the app cannot run without missed every time while the shell and
      // the icons, which carry no Vary, matched fine and hid it. Offline, that
      // is a blank screen with a service worker reporting itself healthy.
      caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit))
    );
  }
});

/**
 * A nudge from the page when the connection returns.
 *
 * Background Sync is Chromium-only and absent on iOS, so the outbox is not
 * drained in the background there. The app drains it when it is next opened,
 * which for a field engineer who logs visits all afternoon and opens the app
 * again on the way home is the same outcome. Pretending otherwise would be the
 * kind of promise that fails silently at the worst moment.
 */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
