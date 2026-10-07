import React from 'react';
import { Btn, PRIMARY } from '../components/tiles.jsx';
import { login } from '../api.js';

export default function Login({ onIn }) {
  const [phone, setPhone] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const go = async () => {
    if (!phone.trim() || !pw) { setErr('Enter your phone number and password.'); return; }
    setBusy(true); setErr('');
    try { onIn(await login(phone, pw)); }
    catch (e) { setErr(e.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  const field = {
    width: '100%', padding: '0.85rem 0.9rem', fontSize: '1rem',
    border: '1px solid #DFE2E7', borderRadius: 12, marginBottom: '0.7rem',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', background: PRIMARY, display: 'flex',
                  flexDirection: 'column', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.6rem' }}>
        <img src="./icons/icon-192.png" alt="" width="76" height="76"
             style={{ borderRadius: 20, background: 'white' }} />
        <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 800, marginTop: '0.7rem' }}>
          SEM Trainers
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 20, padding: '1.2rem' }}>
        <input style={field} type="tel" inputMode="numeric" placeholder="Phone number"
               value={phone} onChange={e => setPhone(e.target.value)} autoComplete="username" />
        <input style={field} type="password" placeholder="Password"
               value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password"
               onKeyDown={e => e.key === 'Enter' && go()} />
        {err && <div style={{ color: '#B4232A', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{err}</div>}
        <Btn onClick={go} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </div>
      {/* Stated up front, because being signed out mid-visit with queued work
          is the surprise worth avoiding. */}
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem',
                    textAlign: 'center', marginTop: '1rem' }}>
        You stay signed in for 24 hours.
      </div>
    </div>
  );
}
