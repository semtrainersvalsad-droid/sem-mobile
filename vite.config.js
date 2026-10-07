import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base, so the build works both at a GitHub Pages project path
// (/sem-mobile/) and at a custom domain root. A custom domain is worth setting
// up: a service worker's scope is its own directory, and a root-served app
// avoids every subpath question before it is asked.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The whole point of leaving Apps Script was to stop compiling JSX in the
    // browser. Index.html is 513 KB of JSX that Babel compiles on every single
    // page load, which is seconds of phone CPU before anything appears.
    target: 'es2018',
    sourcemap: false
  }
});
