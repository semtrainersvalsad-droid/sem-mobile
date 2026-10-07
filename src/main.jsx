import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

// Register the service worker. This is the line that makes the app installable
// and is the thing Apps Script could never do — registration needs an origin we
// control, and HtmlService serves from a sandboxed googleusercontent.com frame.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(err => console.warn('[pwa] service worker did not register', err));
  });
}
