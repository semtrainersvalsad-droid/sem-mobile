/**
 * Everything — the directory, and the stack that modules open into.
 *
 * Nine modules cannot each have a bottom tab; five is already the most a thumb
 * can hit reliably. So they live behind one tab as a list of tiles, each saying
 * how many records are behind it — because "Complaints" tells you nothing and
 * "Complaints · 14" tells you whether to bother.
 *
 * Counts come from one call and are cached, so the directory paints instantly
 * on every visit after the first. A count that could not be read shows as a
 * blank rather than a zero: nobody should read "Stock · 0" and conclude the
 * warehouse is empty when the truth is the sheet could not be opened.
 */
import React from 'react';
import { T, R } from '../theme.js';
import { Icon, Spin, StaleNote } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached } from '../db.js';
import Module from './Module.jsx';
import More from './More.jsx';

export default function Everything({ online, user, onDrain, onQueued, pending }) {
  const [mods, setMods] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);
  const [open, setOpen] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    cached('modules', () => call('getMobileModuleCounts'), (v, m) => {
      if (dead) return;
      setMods(v && v.modules ? v.modules : []);
      setStale(m.fromCache ? m.at : null);
      setStaleErr(m.error || '');
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });
    return () => { dead = true; };
  }, [nonce]);

  // More is not a sheet-backed module, so it is not in the registry — but it
  // holds the outbox and the quote list, and losing the outbox would mean work
  // queued offline had nowhere to be seen. It opens from the same directory.
  if (open && open.id === '_more') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => setOpen(null)} style={{
            background: T.raised, border: 'none', color: T.text, borderRadius: 11,
            width: 36, height: 36, fontSize: 17, cursor: 'pointer', flexShrink: 0
          }} aria-label="Back">‹</button>
          <div style={{ fontSize: 17, color: T.text }}>Sync &amp; app</div>
        </div>
        <More user={user} online={online} onDrain={onDrain} onQueued={onQueued} />
      </>
    );
  }
  if (open) return <Module mod={open} online={online} onBack={() => setOpen(null)} />;

  if (!mods && !err) return <Spin />;
  if (!mods) {
    return (
      <div style={{ background: T.card, borderRadius: R.card, padding: 16 }}>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>Could not load</div>
        <div style={{ fontSize: 12, color: T.sub }}>
          {online ? err : 'You are offline and this has not been opened with signal yet.'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 22, color: T.text, margin: '2px 0 14px' }}>Everything</div>

      <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {mods.map(m => (
          <div key={m.id} onClick={() => setOpen(m)} style={{
            background: T.card, borderRadius: 18, padding: '15px 14px', cursor: 'pointer'
          }}>
            <div style={{ color: T.accent, marginBottom: 9 }}>
              <Icon name={m.icon || 'file'} size={19} />
            </div>
            <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.25 }}>{m.label}</div>
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3,
                          fontVariantNumeric: 'tabular-nums' }}>
              {/* -1 means the sheet could not be read. A zero there would be a
                  lie with consequences — "Stock · 0" reads as an empty
                  warehouse rather than a failed lookup. */}
              {m.count < 0 ? 'count unavailable'
                           : m.count + (m.count === 1 ? ' record' : ' records')}
              {m.writable === false ? ' · read-only' : ''}
            </div>
          </div>
        ))}
      </div>

      <div onClick={() => setOpen({ id: '_more', label: 'Sync & app' })} style={{
        background: pending ? T.amberBg : T.card, borderRadius: 18,
        padding: '15px 14px', marginTop: 9, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 11
      }}>
        <div style={{ color: pending ? T.amber : T.accent }}><Icon name="wifi" size={19} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: T.text }}>Sync &amp; app</div>
          <div style={{ fontSize: 11.5, color: pending ? T.amber : T.sub }}>
            {pending ? pending + ' waiting to send' : 'Outbox, quotes, about'}
          </div>
        </div>
        <div style={{ fontSize: 15, color: T.faint }}>›</div>
      </div>

      <div style={{ background: T.raised, borderRadius: 18, padding: 15, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.6 }}>
          Signed in as {user && user.name ? user.name : 'this device'}. Tenders are
          read-only here by design — everything else can be opened and searched,
          including with no signal once you have opened it once.
        </div>
      </div>
    </>
  );
}
