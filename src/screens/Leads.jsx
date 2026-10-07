/**
 * Leads — searchable list, tap to call, log an outcome, add a new one.
 *
 * Adding a lead and logging a call outcome both work offline. Both are
 * append-only in the sense that matters: a new lead is a new row, and an
 * outcome adds a comment. A follow-up also sets the lead's temperature, which
 * is genuinely shared — but the worst case there is a stale "warm" where it
 * should say "hot", which costs nothing. That is a different order of risk
 * from a tender stage or a payment, which stay online-only.
 */
import React from 'react';
import { Card, Btn, Spin, Sheet, Chips, MT, PRIMARY, initials } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached, enqueue } from '../db.js';

const field = {
  width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: 12,
  border: '1px solid #DFE2E7', marginBottom: '0.6rem', boxSizing: 'border-box'
};

const tempTile = t => {
  const s = String(t || '').toLowerCase();
  return s === 'hot' ? MT.red : s === 'cold' ? MT.blue : MT.amber;
};

export default function Leads({ user, online, onQueued }) {
  const [leads, setLeads] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    cached('leads', () => call('getLeads', {}), (v, m) => {
      setLeads(Array.isArray(v) ? v : []);
      setStale(m.fromCache ? m.at : null);
    }).catch(() => setLeads([]));
  }, []);
  React.useEffect(load, [load]);

  if (leads === null) return <Spin />;

  const ql = q.toLowerCase();
  const list = leads.filter(l => !ql || JSON.stringify(l).toLowerCase().includes(ql)).slice(0, 60);

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <input style={{ ...field, flex: 1, marginBottom: 0 }} placeholder="Search name, org, city…"
               value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={() => setAdding(true)} style={{
          background: PRIMARY, color: 'white', border: 'none', borderRadius: 12,
          padding: '0 1.05rem', fontWeight: 800, fontSize: '0.85rem', minHeight: 50, whiteSpace: 'nowrap'
        }}><i className="fas fa-plus" /> New</button>
      </div>

      {stale && (
        <div style={{ fontSize: '0.72rem', color: '#8A6212', marginBottom: '0.5rem' }}>
          Saved list from {new Date(stale).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {adding && <LeadAdd user={user} online={online} onQueued={onQueued}
                          onClose={() => setAdding(false)}
                          onSaved={() => { setAdding(false); load(); }} />}

      {list.map((l, i) => {
        const phone = String(l.Phone || l.Mobile || l.ContactNumber || '').replace(/[^\d+]/g, '');
        const tt = tempTile(l.Temperature);
        return (
          <Card key={l.LeadID || i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <div onClick={() => setSel(l)} style={{
                width: 42, height: 42, borderRadius: '50%', background: tt.bg, color: tt.fg,
                display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0
              }}>{initials(l.ContactName || l.Name || l.Organization)}</div>
              <div onClick={() => setSel(l)} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{l.ContactName || l.Name || '—'}</div>
                <div style={{ fontSize: '0.73rem', color: '#9AA0A6', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.Organization || ''}{l.City ? ' · ' + l.City : ''}
                </div>
                {(l.Temperature || l.Status) && (
                  <span style={{ background: tt.bg, color: tt.fg, borderRadius: 8,
                                 padding: '1px 8px', fontSize: '0.64rem', fontWeight: 800 }}>
                    {l.Temperature || l.Status}
                  </span>
                )}
              </div>
              {/* A tel: link works with no connection at all — it is the one
                  thing on this screen that never needs the server. */}
              {phone && (
                <a href={'tel:' + phone} style={{
                  width: 46, height: 46, borderRadius: '50%', background: MT.teal.bg,
                  color: MT.teal.fg, display: 'grid', placeItems: 'center',
                  fontSize: '1rem', textDecoration: 'none', flexShrink: 0
                }}><i className="fas fa-phone" /></a>
              )}
            </div>
          </Card>
        );
      })}

      {!list.length && <Card><div style={{ fontSize: '0.88rem', color: '#6B7280' }}>No leads match.</div></Card>}
      {sel && <LeadDetail lead={sel} user={user} online={online} onQueued={onQueued}
                          onClose={() => setSel(null)} onSaved={() => { setSel(null); load(); }} />}
    </>
  );
}

function LeadDetail({ lead, user, online, onQueued, onClose, onSaved }) {
  const [outcome, setOutcome] = React.useState('warm');
  const [notes, setNotes] = React.useState('');
  const [nextDate, setNextDate] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const id = lead.LeadID || lead.id || lead._rowNum;

  const submit = async () => {
    setBusy(true); setMsg('');
    const payload = { outcome, notes, comment: notes, nextFollowUpDate: nextDate, by: user.name };
    try {
      if (!navigator.onLine) {
        await enqueue('logFollowUp', [id, payload], 'Call outcome — ' + (lead.ContactName || lead.Organization || ''));
        onQueued && onQueued();
        setMsg('Saved on this phone. It will go up when you have signal.');
        setTimeout(onSaved, 900);
        return;
      }
      const r = await call('logFollowUp', id, payload);
      if (r && r.success) onSaved();
      else setMsg((r && r.error) || 'Could not save.');
    } catch (e) {
      // A call that failed mid-flight is queued rather than lost. The server
      // de-duplicates by id, so if it did land, the retry is harmless.
      await enqueue('logFollowUp', [id, payload], 'Call outcome — ' + (lead.ContactName || ''));
      onQueued && onQueued();
      setMsg('Connection failed — saved on this phone and queued.');
      setTimeout(onSaved, 1200);
    } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: '1.08rem' }}>{lead.ContactName || lead.Name}</div>
      <div style={{ fontSize: '0.78rem', color: '#9AA0A6', marginBottom: '0.9rem' }}>
        {lead.Organization || ''}{lead.City ? ' · ' + lead.City : ''}{lead.Status ? ' · ' + lead.Status : ''}
      </div>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5F5E5A',
                    letterSpacing: '0.05em', marginBottom: '0.45rem' }}>LOG CALL OUTCOME</div>
      <Chips options={['hot', 'warm', 'cold', 'quoted', 'negotiation', 'won', 'lost']}
             value={outcome} onChange={setOutcome} />
      <textarea style={{ ...field, marginTop: '0.6rem', minHeight: 72 }} placeholder="Call notes…"
                value={notes} onChange={e => setNotes(e.target.value)} />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '0.78rem', color: '#5F5E5A', whiteSpace: 'nowrap', fontWeight: 700 }}>
          Next follow-up:
        </span>
        <input type="date" style={{ ...field, marginBottom: 0, fontSize: '0.88rem' }}
               value={nextDate} onChange={e => setNextDate(e.target.value)} />
      </div>
      {!online && (
        <div style={{ background: MT.amber.bg, color: MT.amber.fg, borderRadius: 10,
                      padding: '0.5rem 0.7rem', fontSize: '0.78rem', marginBottom: '0.7rem' }}>
          You are offline. This will be saved on the phone and sent when you have signal.
        </div>
      )}
      {msg && <div style={{ fontSize: '0.8rem', color: '#1C5D3A', marginBottom: '0.6rem' }}>{msg}</div>}
      <Btn disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save outcome'}</Btn>
    </Sheet>
  );
}

function LeadAdd({ user, online, onQueued, onClose, onSaved }) {
  const [f, setF] = React.useState({
    contactName: '', organization: '', phone: '', city: '',
    productInterest: '', notes: '', temperature: 'Warm'
  });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.contactName && !f.organization) { setMsg('Give a name or an organisation.'); return; }
    setBusy(true); setMsg('');
    try {
      if (!navigator.onLine) {
        await enqueue('addLead', [f, user.name], 'New lead — ' + (f.contactName || f.organization));
        onQueued && onQueued();
        setMsg('Saved on this phone.');
        setTimeout(onSaved, 900);
        return;
      }
      const r = await call('addLead', f, user.name);
      if (r && r.success) onSaved();
      else setMsg((r && r.error) || 'Could not save.');
    } catch (e) {
      await enqueue('addLead', [f, user.name], 'New lead — ' + (f.contactName || f.organization));
      onQueued && onQueued();
      setMsg('Connection failed — saved on this phone and queued.');
      setTimeout(onSaved, 1200);
    } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: '1.08rem', marginBottom: '0.85rem' }}>
        <i className="fas fa-user-plus" style={{ color: PRIMARY, marginRight: '0.4rem' }} />New lead
      </div>
      <input style={field} placeholder="Contact name" value={f.contactName}
             onChange={e => set('contactName', e.target.value)} />
      <input style={field} placeholder="Organisation / college" value={f.organization}
             onChange={e => set('organization', e.target.value)} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input style={{ ...field, flex: 1 }} type="tel" inputMode="tel" placeholder="Phone"
               value={f.phone} onChange={e => set('phone', e.target.value)} />
        <input style={{ ...field, flex: 1 }} placeholder="City"
               value={f.city} onChange={e => set('city', e.target.value)} />
      </div>
      <input style={field} placeholder="Product interest (e.g. CPR manikin)"
             value={f.productInterest} onChange={e => set('productInterest', e.target.value)} />
      <Chips options={['Hot', 'Warm', 'Cold']} value={f.temperature} onChange={v => set('temperature', v)} />
      <textarea style={{ ...field, marginTop: '0.6rem', minHeight: 60 }} placeholder="Notes…"
                value={f.notes} onChange={e => set('notes', e.target.value)} />
      {!online && (
        <div style={{ background: MT.amber.bg, color: MT.amber.fg, borderRadius: 10,
                      padding: '0.5rem 0.7rem', fontSize: '0.78rem', marginBottom: '0.7rem' }}>
          Offline — this lead is kept on the phone until you have signal.
        </div>
      )}
      {msg && <div style={{ fontSize: '0.8rem', color: '#B4232A', marginBottom: '0.6rem' }}>{msg}</div>}
      <Btn disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save lead'}</Btn>
    </Sheet>
  );
}
