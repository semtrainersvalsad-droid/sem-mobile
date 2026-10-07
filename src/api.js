/**
 * The only way this app talks to the ERP.
 *
 * Everything here was established by testing against the live endpoint from a
 * foreign origin on 2026-10-07, not by reading documentation:
 *
 *   POST /exec            -> 200, CORS response readable
 *   GET  /exec            -> TypeError: Failed to fetch
 *   median round trip      3-6 SECONDS, even for a call rejected before it
 *                          touched a sheet
 *   five rapid calls       one failed outright; treat bursts as unsafe
 *
 * THREE RULES THAT MUST NOT BE BROKEN
 *
 * 1. Content-Type stays text/plain. That is what makes this a CORS "simple
 *    request" with no preflight. Apps Script cannot answer a preflight OPTIONS
 *    at all, so the moment any custom header is added — an Authorization header
 *    above all — every call in the app starts failing.
 * 2. The token goes in the BODY. Same reason.
 * 3. Nothing renders behind a network call. Three to six seconds is forever on
 *    a phone, and that is the floor, not the average. Screens read from the
 *    local cache and refresh behind; see db.js.
 */

export const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbxo3ZMJs-x-CQWBUQfjtQ-S0Mk-SfGVIeDeX9wtqemir701rXP3ZjxW4VKBp8jM_kyJ/exec';

const TOKEN_KEY = 'sessionToken';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export class NeedsLogin extends Error {
  constructor(msg) { super(msg || 'Session expired'); this.name = 'NeedsLogin'; }
}
export class Offline extends Error {
  constructor() { super('No connection'); this.name = 'Offline'; }
}

/** Raw POST. Everything else goes through here. */
async function send(payload, { timeoutMs = 30000 } = {}) {
  if (!navigator.onLine) throw new Offline();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(EXEC_URL, {
      method: 'POST',
      // Deliberate. See rule 1 above.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'mobile', token: getToken(), ...payload }),
      signal: ctl.signal,
      redirect: 'follow'
    });
  } catch (e) {
    // An abort, a dropped connection and a throttle all land here and are
    // indistinguishable from the browser's side.
    throw new Offline();
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('The server replied with something that was not JSON.'); }

  if (json.needsLogin) { setToken(''); throw new NeedsLogin(json.error); }
  if (!json.ok) throw new Error(json.error || 'The call failed.');
  return json;
}

/**
 * One call.
 *
 * `call` is any name the desktop ERP already exposes through clientCall, which
 * is where session checking and role enforcement live. Nothing is reimplemented
 * on this side; a second set of rules would drift from the first.
 */
export async function call(name, ...args) {
  const json = await send({ call: name, args });
  return json.result;
}

/**
 * Several calls, one round trip.
 *
 * At three to six seconds each, a home screen built from three separate calls
 * can take the better part of twenty seconds. Batched it costs one. The server
 * caps a batch at eight.
 *
 *   const [leads, tasks] = await batch([['getLeads', {}], ['getTasks', {}]]);
 */
export async function batch(pairs) {
  if (!pairs.length) return [];
  if (pairs.length > 8) throw new Error('At most 8 calls per batch.');
  const json = await send({ calls: pairs.map(([c, ...args]) => ({ call: c, args })) });
  return json.results;
}

/**
 * Send one queued, append-only item exactly once.
 *
 * The id goes to the server, which refuses an id it has already written and
 * returns the original result with duplicate:true. That is what makes a retry
 * after a dropped reply safe — without it, a visit logged on a train gets
 * written twice and nobody notices until someone reads the sheet.
 */
export async function sendQueued(id, name, args) {
  const json = await send({ queued: { id, call: name, args: args || [] } });
  return { result: json.result, duplicate: !!json.duplicate };
}

/**
 * Sign in.
 *
 * Two things here were wrong on the first attempt and both failed in the same
 * indistinguishable way:
 *
 *   The server routed this through clientCall, which refuses any call with no
 *   token — including the one that obtains a token. Login could never succeed.
 *   MobileApi.gs now calls the pre-auth functions directly, the same way
 *   Index.html's _DIRECT_CALL_FNS has always done.
 *
 *   The token comes back as `sessionToken`, not `token`. Reading the wrong
 *   field would have let a successful login appear to fail, or worse, appear
 *   to succeed and then reject every subsequent call.
 */
export async function login(phone, password) {
  const json = await send({
    call: 'loginWithPhoneAndPassword',
    args: [String(phone).trim(), password]
  });
  const r = json.result;
  if (!r || !r.success) throw new Error((r && r.error) || 'Sign-in failed.');

  const tok = r.sessionToken || r.token;
  if (!tok) throw new Error('Signed in, but no session was returned. Tell Claude.');
  setToken(tok);
  // The person is nested: { success, sessionToken, user:{ name, role, ... } }.
  // Treating the envelope as the user is why the app greeted "there".
  return r.user || r;
}

/**
 * Is the session still good?
 *
 * Sessions last 24 hours. For a field engineer that means a day away from
 * signal can expire the session while work is still queued — Phase 2 has to
 * decide whether queued items are held or the engineer is asked to sign in
 * again before they sync. Flagged here because it is the part of the offline
 * design most likely to be discovered the hard way.
 */
export async function checkSession() {
  if (!getToken()) return null;
  try {
    const r = await call('validateToken', getToken());
    return r && r.success ? (r.user || r) : null;
  } catch (e) { if (e instanceof NeedsLogin) return null; throw e; }
}
