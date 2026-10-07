/**
 * Inject the real asset list into the service worker, and refuse to finish if
 * anything is missing.
 *
 * The first build "succeeded" and silently omitted sw.js entirely, because Vite
 * only rewrites new URL(...) for Worker constructors, not for
 * serviceWorker.register. The result would have installed as a bookmark with no
 * offline capability and no install prompt, and nothing would have said so.
 *
 * So this script does two jobs: fill in the precache list, and then assert that
 * every file a PWA actually needs is present. A build that cannot produce a
 * working PWA should fail loudly rather than produce a plausible one.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'dist');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (!existsSync(dist)) { console.error('postbuild: no dist/. Run the build first.'); process.exit(1); }

const files = walk(dist).map(p => './' + relative(dist, p).split('\\').join('/'));

// Everything except the worker itself — a service worker precaching itself is
// how a stale worker becomes impossible to replace.
const precache = files
  .filter(f => f !== './sw.js')
  .filter(f => !/\.map$/.test(f));
precache.unshift('./');

const swPath = join(dist, 'sw.js');
if (!existsSync(swPath)) {
  console.error('postbuild: dist/sw.js is missing. Without it this is not a PWA.');
  process.exit(1);
}

let sw = readFileSync(swPath, 'utf8');
if (!sw.includes('/*__PRECACHE__*/')) {
  console.error('postbuild: the precache placeholder is not in sw.js. Refusing to ship a half-wired worker.');
  process.exit(1);
}
sw = sw.replace('/*__PRECACHE__*/', JSON.stringify(precache, null, 0) + ' || ');
writeFileSync(swPath, sw);

// The things whose absence makes an app merely a web page.
const required = ['./index.html', './manifest.json', './sw.js',
                  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const missing = required.filter(r => !files.includes(r));
if (missing.length) {
  console.error('postbuild: missing from the build —\n  ' + missing.join('\n  '));
  process.exit(1);
}

const js = files.filter(f => /\.js$/.test(f) && f !== './sw.js');
console.log('postbuild: precached ' + precache.length + ' files');
js.forEach(f => console.log('           ' + f));
console.log('postbuild: PWA requirements present — index, manifest, worker, 3 icons');
