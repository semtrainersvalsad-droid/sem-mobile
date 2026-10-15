/**
 * Sign in.
 *
 * WHY THIS WAS REBUILT
 * It was a full-bleed orange field with white text and a white card — the only
 * light screen in a dark app, so the first thing anyone saw looked like a
 * different product from everything after it. Worse, it failed on contrast:
 * white on #F08A1E measures 2.51:1 against a 4.5:1 floor, and the "stay signed
 * in" note was white at 75% opacity, which is worse still. Brand orange is a
 * strong colour to put text on; it is far better under text than behind it.
 *
 * So: the same surfaces as the rest of the app, with the orange doing what it
 * does everywhere else — carrying the one action, in near-black ink at 7.2:1.
 */
import React from 'react';
import { T, R } from '../theme.js';
import { login } from '../api.js';

export default function Login({ onIn }) {
  const [phone, setPhone] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  async function go() {
    if (!phone.trim() || !pw) { setErr('Enter your phone number and password.'); return; }
    setBusy(true); setErr('');
    try {
      const user = await login(phone.trim(), pw);
      onIn(user);
    } catch (e) {
      setErr(e.message || 'Sign-in failed.');
    } finally { setBusy(false); }
  }

  const field = {
    width: '100%', boxSizing: 'border-box', background: T.bg,
    border: '1px solid ' + T.rule, borderRadius: 12, color: T.text,
    padding: '14px 14px', fontSize: 16,   // 16px: anything smaller zooms iOS
    marginBottom: 10, outline: 'none'
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg, display: 'flex',
      flexDirection: 'column', justifyContent: 'center',
      padding: 'max(1.5rem, env(safe-area-inset-top)) 1.5rem 1.5rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <img src="./icons/icon-192.png" alt="" width="72" height="72"
             style={{ borderRadius: 20 }} />
        <div style={{ color: T.text, fontSize: 21, marginTop: 12 }}>SEM Trainers</div>
        <div style={{ color: T.sub, fontSize: 12.5, marginTop: 3 }}>
          Simulation equipment · Valsad
        </div>
      </div>

      <div style={{ background: T.card, borderRadius: R.card, padding: 16 }}>
        <label style={{ fontSize: 11.5, color: T.sub }}>Phone number</label>
        <input style={field} type="tel" inputMode="numeric"
               value={phone} onChange={e => setPhone(e.target.value)}
               autoComplete="username" />

        <label style={{ fontSize: 11.5, color: T.sub }}>Password</label>
        <input style={field} type="password"
               value={pw} onChange={e => setPw(e.target.value)}
               autoComplete="current-password"
               onKeyDown={e => e.key === 'Enter' && go()} />

        {err && (
          <div role="alert" style={{
            background: T.redBg, color: T.red, borderRadius: 11,
            padding: '11px 12px', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5
          }}>{err}</div>
        )}

        {/* Near-black on orange, 7.2:1. White here would be 2.51:1. */}
        <button onClick={go} disabled={busy} style={{
          width: '100%', background: busy ? T.raised : T.accent,
          color: busy ? T.sub : T.onAccent, border: 'none', borderRadius: 12,
          padding: '15px 0', fontSize: 15, cursor: busy ? 'default' : 'pointer'
        }}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </div>

      {/* Said up front: being signed out mid-visit with queued work is the
          surprise worth avoiding. T.sub, not translucent white. */}
      <div style={{ color: T.sub, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
        You stay signed in for 24 hours.
      </div>
    </div>
  );
}
