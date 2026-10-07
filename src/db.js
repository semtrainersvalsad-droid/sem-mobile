/**
 * Local storage: the read cache, and the outbox.
 *
 * Two stores, deliberately separate because they answer different questions.
 *
 *   cache  — the last known answer to a call. Screens render from this
 *            instantly and refresh behind. With the server at three to six
 *            seconds a round trip, this is the difference between an app that
 *            feels immediate and one nobody opens twice.
 *
 *   outbox — work done offline that has not reached the server yet. ONLY
 *            append-only work belongs here: a new visit, a new complaint, a new
 *            lead, a photograph, a task marked done. These create rows and
 *            cannot conflict with anything.
 *
 * WHAT MUST NEVER GO IN THE OUTBOX
 * Edits to records other people also act on — tender stages, project stages,
 * approvals, payments, stock adjustments. Two people editing one record offline
 * produces a merge, and a wrong merge in an ERP does not raise an error, it
 * writes a plausible wrong number and says nothing. Those screens refuse while
 * offline instead of queueing. That refusal is the design, not a shortcoming.
 */

const DB_NAME = 'sem-mobile';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_OUTBOX = 'outbox';

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const s = db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
        s.createIndex('state', 'state', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

// ── Read cache ─────────────────────────────────────────────────────────────

export async function cacheGet(key) {
  try {
    const row = await tx(STORE_CACHE, 'readonly', s => s.get(key));
    return row ? { value: row.value, at: row.at } : null;
  } catch { return null; }          // a cache that fails is a cache miss
}

export async function cachePut(key, value) {
  try { await tx(STORE_CACHE, 'readwrite', s => s.put({ key, value, at: Date.now() })); }
  catch {}                           // never let caching break a working screen
}

/**
 * Render now, refresh behind.
 *
 * Calls onData once with whatever is cached (if anything), then again with the
 * fresh answer. A screen built on this never shows a spinner on a second visit.
 */
export async function cached(key, fetcher, onData) {
  const hit = await cacheGet(key);
  if (hit) onData(hit.value, { fromCache: true, at: hit.at });
  try {
    const fresh = await fetcher();
    await cachePut(key, fresh);
    onData(fresh, { fromCache: false, at: Date.now() });
    return fresh;
  } catch (e) {
    // Offline with a cached copy is a normal state, not a failure.
    if (hit) return hit.value;
    throw e;
  }
}

// ── Outbox ─────────────────────────────────────────────────────────────────

/**
 * Queue append-only work.
 *
 * The id is generated here and sent with the item. The server rejects an id it
 * has already written, so a retry after a flaky connection cannot create the
 * same visit twice — which is the failure mode that makes people stop trusting
 * an offline app.
 */
export async function enqueue(call, args, label) {
  const item = {
    id: (crypto.randomUUID ? crypto.randomUUID()
         : String(Date.now()) + '-' + Math.random().toString(16).slice(2)),
    call, args, label: label || call,
    state: 'pending', attempts: 0, error: '',
    createdAt: Date.now()
  };
  await tx(STORE_OUTBOX, 'readwrite', s => s.put(item));
  return item;
}

export async function outbox() {
  try {
    const rows = await tx(STORE_OUTBOX, 'readonly', s => s.getAll());
    return (rows || []).sort((a, b) => a.createdAt - b.createdAt);
  } catch { return []; }
}

export async function outboxSet(id, patch) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_OUTBOX, 'readwrite');
    const s = t.objectStore(STORE_OUTBOX);
    const g = s.get(id);
    g.onsuccess = () => {
      if (!g.result) { resolve(null); return; }
      s.put({ ...g.result, ...patch });
    };
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error);
  });
}

export async function outboxRemove(id) {
  await tx(STORE_OUTBOX, 'readwrite', s => s.delete(id));
}

export async function pendingCount() {
  const all = await outbox();
  return all.filter(x => x.state !== 'synced').length;
}
