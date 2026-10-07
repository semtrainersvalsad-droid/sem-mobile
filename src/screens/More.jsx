/**
 * More — stock lookup, the outbox, and the things that belong nowhere else.
 *
 * The outbox is shown here rather than hidden, because an offline app that
 * does not tell you what is still waiting is one you stop trusting. Each item
 * shows what it is, whether it failed, and why.
 */
import React from 'react';
import { Card, Btn, Spin, Chips, MT, PRIMARY, fmtL } from '../components/tiles.jsx';
import { call, EXEC_URL } from '../api.js';
import { cached, outbox, outboxRemove } from '../db.js';

export default function More({ user, online, onDrain, onQueued }) {
  const [view, setView] = React.useState('Outbox');
  return (
    <>
      <Chips options={['Outbox', 'Stock', 'Quotes', 'About']} value={view} onChange={setView} />
      <div style={{ height: '0.8rem' }} />
      {view === 'Outbox' && <Outbox online={online} onDrain={onDrain} onQueued={onQueued} />}
      {view === 'Stock' && <Stock />}
      {view === 'Quotes' && <Quotes />}
      {view === 'About' && <About user={user} />}
    </>
  );
}

function Outbox({ online, onDrain, onQueued }) {
  const [items, setItems] = React.useState(null);
  const refresh = React.useCallback(async () => setItems(await outbox()), []);
  React.useEffect(() => { refresh(); }, [refresh]);

  if (items === null) return <Spin />;
  if (!items.length) {
    return (
      <Card>
        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Nothing waiting</div>
        <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '0.25rem' }}>
          Everything you have entered has reached the office.
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          {items.length} item{items.length === 1 ? '' : 's'} on this phone
        </div>
        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '0.7rem' }}>
          {online ? 'These send automatically. Tap below to try now.'
                  : 'They will send on their own once you have signal.'}
        </div>
        <Btn disabled={!online} onClick={() => { onDrain && onDrain(); setTimeout(refresh, 1500); }}>
          {online ? 'Send now' : 'Waiting for signal'}
        </Btn>
      </Card>

      {items.map(it => (
        <Card key={it.id}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{it.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#9AA0A6', marginTop: 2 }}>
                {new Date(it.createdAt).toLocaleString('en-IN')}
                {it.attempts ? ' · ' + it.attempts + ' attempt' + (it.attempts === 1 ? '' : 's') : ''}
              </div>
              {it.error && (
                <div style={{ fontSize: '0.74rem', color: MT.red.sub, marginTop: '0.3rem' }}>{it.error}</div>
              )}
            </div>
            <span style={{
              background: it.state === 'sending' ? MT.blue.bg : MT.amber.bg,
              color: it.state === 'sending' ? MT.blue.fg : MT.amber.fg,
              borderRadius: 8, padding: '2px 8px', fontSize: '0.66rem', fontWeight: 800, flexShrink: 0
            }}>{it.state}</span>
          </div>
          {/* Discarding is deliberate and explicit. Silently dropping work
              someone typed in a hospital corridor is unforgivable; letting
              them choose to drop it is fine. */}
          {it.attempts >= 3 && (
            <button onClick={async () => {
              if (confirm('Discard "' + it.label + '"? It will not be sent.')) {
                await outboxRemove(it.id); onQueued && onQueued(); refresh();
              }
            }} style={{
              background: 'none', border: 'none', color: MT.red.sub, fontSize: '0.76rem',
              fontWeight: 700, padding: '0.4rem 0 0', cursor: 'pointer'
            }}>Discard this</button>
          )}
        </Card>
      ))}
    </>
  );
}

function Stock() {
  const [rows, setRows] = React.useState(null);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    cached('stock', () => call('getStockData', {}), v => {
      setRows(v && Array.isArray(v.products) ? v.products : (Array.isArray(v) ? v : []));
    }).catch(() => setRows([]));
  }, []);
  if (rows === null) return <Spin />;
  const ql = q.toLowerCase();
  const list = rows.filter(p => !ql || JSON.stringify(p).toLowerCase().includes(ql)).slice(0, 50);
  return (
    <>
      <input placeholder="Search product…" value={q} onChange={e => setQ(e.target.value)}
             style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: 12,
                      border: '1px solid #DFE2E7', marginBottom: '0.7rem', boxSizing: 'border-box' }} />
      {list.map((p, i) => {
        const bal = Number(p.balance ?? p.Balance ?? 0);
        const min = Number(p.minStockLevel ?? p.MinStockLevel ?? 0);
        const low = bal <= min;
        return (
          <Card key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
                {p.name || p.ProductName || p.Product || '—'}
              </div>
              <span style={{
                background: low ? MT.red.bg : MT.teal.bg, color: low ? MT.red.fg : MT.teal.fg,
                borderRadius: 8, padding: '2px 9px', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0
              }}>{bal}</span>
            </div>
          </Card>
        );
      })}
      {!list.length && <Card><div style={{ fontSize: '0.88rem', color: '#6B7280' }}>Nothing matches.</div></Card>}
    </>
  );
}

function Quotes() {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => {
    cached('quotes', () => call('getQuotations', {}), v => setRows(Array.isArray(v) ? v : []))
      .catch(() => setRows([]));
  }, []);
  if (rows === null) return <Spin />;
  if (!rows.length) return <Card><div style={{ fontSize: '0.88rem', color: '#6B7280' }}>No quotations.</div></Card>;
  return rows.slice(0, 40).map((qt, i) => (
    <Card key={qt.QuoteID || i}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            {qt.Institution || qt.Customer || qt.Organization || '—'}
          </div>
          <div style={{ fontSize: '0.73rem', color: '#9AA0A6', marginTop: 2 }}>
            {qt.QuoteID || ''}{qt.Status ? ' · ' + qt.Status : ''}
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, flexShrink: 0 }}>
          {fmtL(qt.Amount || qt.Total || qt.Value || 0)}
        </div>
      </div>
    </Card>
  ));
}

function About({ user }) {
  return (
    <>
      <Card>
        <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{user.name}</div>
        <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>{user.role || ''}</div>
      </Card>
      <Card>
        <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.6 }}>
          SEM Trainers mobile · v1<br />
          Signed in for 24 hours at a time.<br />
          Leads, tasks and call outcomes can be entered without signal; tenders,
          approvals and payments need a connection and will say so.
        </div>
      </Card>
      <Card>
        <a href={EXEC_URL} target="_blank" rel="noreferrer"
           style={{ color: PRIMARY, fontSize: '0.86rem', fontWeight: 700, textDecoration: 'none' }}>
          <i className="fas fa-external-link-alt" /> Open the full ERP
        </a>
      </Card>
    </>
  );
}
