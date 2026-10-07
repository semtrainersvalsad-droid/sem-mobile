# SEM Trainers — mobile

An installable PWA for SEM Trainers & Systems. The backend is the existing
Google Apps Script ERP; this is only the phone frontend.

## Why this is a separate app

A service worker cannot be registered from an Apps Script web app — HtmlService
serves its output inside a sandboxed iframe on an ephemeral
`googleusercontent.com` origin, and registration needs an origin you control.
No service worker means no install prompt, no offline, and no standalone
window. That one fact is why the frontend lives here instead.

## How it talks to the ERP

One POST endpoint, `action: 'mobile'`, handled by `src/MobileApi.gs` in the
Apps Script project. It routes into the ERP's existing `clientCall` whitelist,
which is where session checking and role enforcement already live — nothing is
reimplemented on this side.

Three rules that must not be broken, each established by testing against the
live endpoint rather than from documentation:

1. `Content-Type` stays `text/plain`. That keeps it a CORS simple request.
   Apps Script cannot answer a preflight `OPTIONS`, so any custom header — an
   `Authorization` header above all — breaks every call in the app.
2. The session token travels in the body, for the same reason.
3. Nothing renders behind a network call. The measured round trip is 3–6
   seconds even for a call rejected before it touches a sheet. Screens read
   from IndexedDB and refresh behind.

## Offline

Append-only work is queued and syncs when signal returns: new leads, call
outcomes, task completions. Each carries a client-generated id, and the server
refuses an id it has already written, so a retry after a dropped reply cannot
create the row twice.

Edits to records other people act on — tender stages, approvals, payments,
stock adjustments — are online only and say so. A wrong merge in an ERP does
not raise an error; it writes a plausible wrong number and stays quiet.

## Running it

    npm install
    npm run dev          # development
    npm run build        # production build into dist/, with PWA checks

`npm run build` fails if the service worker, manifest or icons are missing.
