# SEM mobile — notes for every Claude session

This repository is PUBLIC (GitHub Pages needs that on the free plan). Never
commit business data, people's names or numbers, figures, or any key or token.

## How it fits together

- React + Vite PWA. The backend is a Google Apps Script web app whose code is
  in a separate private repository; its `CLAUDE.md` has the owner's rules —
  read it when a session has both repositories.
- `src/api.js` is the only way the app talks to the server. Its three rules
  (text/plain POST, token in the body, never render behind a network call)
  must not be broken.
- Every call name the app uses must exist as a case in the server's
  `clientCall`, and the field names must be the ones the server reads. Twice
  the app sent other names and data was saved blank or overwritten.
- Push to `main` → `.github/workflows/deploy.yml` builds and publishes. Phones
  pick it up on next open (service worker, network-first). When a change needs
  a server change too, deploy the server first.

## Conventions

- Colours only from `src/theme.js` (contrast-measured dark theme). Status
  colours mean late / needs a decision / done and nothing else.
- Offline: append-only work (a new lead, a call outcome, your own task's Got it,
  Done or date move) queues with `enqueue`; edits to records other people act
  on refuse without signal. See `src/db.js`.
- Business dates are parsed strictly (ISO or dd/mm/yyyy). Never `new Date(string)`.
- `src/dev.jsx` and `dev.html` are a screen-audit harness, git-ignored because
  they hold real figures. Use made-up data for any harness committed here.
- `npx vite build` must pass before pushing.
