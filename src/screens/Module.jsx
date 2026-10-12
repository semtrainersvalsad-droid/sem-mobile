/**
 * One screen that renders any ERP module.
 *
 * WHY ONE SCREEN AND NOT NINE
 * Complaints, stock, demos, projects, tenders, EMDs, guarantees, OEM letters
 * and certificates are the same interaction: a list you scan, a search you
 * narrow with, a chip row for state, and a detail you open. Writing nine
 * screens would mean nine places to fix a scroll bug and nine bundles to ship.
 * The server normalises every module to the same shape (see MobileModules.gs),
 * so the differences live in data, not in code.
 *
 * Search and filtering happen HERE, on the cached rows, not on the server.
 * These sheets are hundreds of rows, not hundreds of thousands, and a filter
 * that works with no signal beats one costing a four-second round trip per
 * keystroke. It is also the difference between usable and unusable in a
 * hospital basement.
 */
import React from 'react';
import { T, R, money, when as whenStr, urgency } from '../theme.js';
import { Spin, Sheet, StaleNote } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached } from '../db.js';
import { ActionSheet, MODULE_ACTIONS, ACTION_FORMS } from '../components/actions.jsx';

const FIG = { fontVariantNumeric: 'tabular-nums' };

/** Colour a status word without needing to know every module's vocabulary. */
function statusTone(s) {
  const v = String(s || '').toLowerCase();
  if (/expired|overdue|lost|rejected|cancelled|blocked|critical|no-go/.test(v)) return T.red;
  if (/pending|open|waiting|progress|submitted|review|sent|with buyer/.test(v)) return T.amber;
  if (/closed|done|complete|returned|released|resolved|won|delivered|handover/.test(v)) return T.green;
  return T.sub;
}

export default function Module({ mod, online, onBack, onQueued }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);
  const [q, setQ] = React.useState('');
  const [chip, setChip] = React.useState('');
  const [open, setOpen] = React.useState(null);
  const [act, setAct] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    setData(null); setErr(''); setQ(''); setChip('');
    cached('mod:' + mod.id, () => call('getMobileModule', mod.id), (v, m) => {
      if (dead) return;
      setData(v);
      setStale(m.fromCache ? m.at : null);
      setStaleErr(m.error || '');
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });
    return () => { dead = true; };
  }, [mod.id, nonce]);

  const rows = React.useMemo(() => {
    if (!data || !data.rows) return [];
    const needle = q.trim().toLowerCase();
    return data.rows.filter(r => {
      if (chip && r.status !== chip) return false;
      if (!needle) return true;
      // Search the detail fields too. People look for a serial number or a
      // DD reference far more often than they look for a title.
      return (r.title + ' ' + r.sub + ' ' + r.status + ' ' +
              (r.fields || []).map(f => f.v).join(' ')).toLowerCase().includes(needle);
    });
  }, [data, q, chip]);

  if (!data && !err) return <Spin />;
  if (!data || data.success === false) {
    return (
      <div style={{ background: T.card, borderRadius: R.card, padding: 16 }}>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>
          Could not load {mod.label}
        </div>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
          {online ? ((data && data.error) || err) :
            'You are offline and this list has not been opened with signal yet.'}
        </div>
      </div>
    );
  }

  const actions = MODULE_ACTIONS[mod.id] || {};
  const rowAction = actions.row;
  const addAction = actions.add;

  const shownTotal = data.hasAmount
    ? rows.reduce((a, r) => a + (r.amount || 0), 0) : 0;

  return (
    <>
      {act && (
        <ActionSheet action={act.action} record={act.record} online={online}
                     onClose={() => setAct(null)}
                     onDone={r => {
                       setAct(null); setOpen(null);
                       if (r && r.queued) { onQueued && onQueued(); }
                       else { setNonce(n => n + 1); }   // re-read so the change shows
                     }} />
      )}

      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <div style={{ fontSize: 16, color: T.text, lineHeight: 1.3 }}>{open.title}</div>
          {open.sub && (
            <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{open.sub}</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '11px 0 4px' }}>
            {open.status && (
              <span style={{ fontSize: 11, color: statusTone(open.status),
                             background: T.raised, borderRadius: 999, padding: '3px 10px' }}>
                {open.status}
              </span>
            )}
            {!!open.amount && (
              <span style={{ fontSize: 13, color: T.text, ...FIG }}>{money(open.amount)}</span>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            {(open.fields || []).map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0',
                                    borderBottom: '1px solid ' + T.line }}>
                <div style={{ fontSize: 11.5, color: T.sub, width: 118, flexShrink: 0 }}>{f.k}</div>
                <div style={{ fontSize: 12.5, color: T.text, flex: 1, wordBreak: 'break-word' }}>
                  {f.v}
                </div>
              </div>
            ))}
            {!(open.fields || []).length && (
              <div style={{ fontSize: 12, color: T.sub }}>No further detail recorded.</div>
            )}
          </div>
          {rowAction && data.writable && (
            <button onClick={() => { setAct({ action: rowAction, record: open }); }} style={{
              background: T.accent, color: T.onAccent, border: 'none', borderRadius: 12,
              padding: '13px 0', width: '100%', fontSize: 14, marginTop: 18, cursor: 'pointer'
            }}>{ACTION_FORMS[rowAction].label}</button>
          )}
          {!data.writable && (
            <div style={{ fontSize: 11.5, color: T.faint, marginTop: 14, lineHeight: 1.5 }}>
              {mod.id === 'tenders'
                ? 'Read-only on the phone by choice. Nobody edits a bid standing in a corridor, and an accidental stage change here is expensive to unpick.'
                : 'Read-only for now — this sheet’s columns have not been confirmed yet, and writing to a column nobody has checked is how a record gets quietly corrupted.'}
            </div>
          )}
        </Sheet>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          background: T.raised, border: 'none', color: T.text, borderRadius: 11,
          width: 36, height: 36, fontSize: 17, cursor: 'pointer', flexShrink: 0
        }} aria-label="Back">‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, color: T.text }}>{data.label}</div>
          <div style={{ fontSize: 11.5, color: T.sub }}>
            {rows.length === data.count
              ? data.count + ' records'
              : rows.length + ' of ' + data.count}
            {data.hasAmount && shownTotal ? ' · ' + money(shownTotal) : ''}
            {!data.writable ? ' · read-only' : ''}
          </div>
        </div>
      </div>

      <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />

      <input value={q} onChange={e => setQ(e.target.value)}
             placeholder={'Search ' + data.label.toLowerCase()}
             style={{
               width: '100%', boxSizing: 'border-box', background: T.card,
               border: '1px solid ' + T.line, borderRadius: 13, color: T.text,
               padding: '11px 13px', fontSize: 14, marginBottom: 10, outline: 'none'
             }} />

      {data.statuses.length > 1 && (
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginBottom: 12,
                      paddingBottom: 2 }}>
          {['', ...data.statuses].map(s => {
            const on = chip === s;
            return (
              <button key={s || 'all'} onClick={() => setChip(s)} style={{
                background: on ? T.accent : T.raised, color: on ? T.onAccent : T.sub,
                border: 'none', borderRadius: 999, padding: '7px 13px',
                fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0
              }}>{s || 'All'}</button>
            );
          })}
        </div>
      )}

      {!rows.length && (
        <div style={{ background: T.card, borderRadius: 16, padding: 15,
                      fontSize: 12.5, color: T.sub }}>
          {q || chip ? 'Nothing matches that.' : 'This list is empty.'}
        </div>
      )}

      {rows.slice(0, 300).map(r => (
        <div key={r.id + r.i} onClick={() => setOpen(r)} style={{
          background: T.card, borderRadius: 16, padding: '13px 14px',
          marginBottom: 8, cursor: 'pointer', display: 'flex', gap: 11
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {r.title}
            </div>
            {r.sub && (
              <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              {r.status && (
                <span style={{ fontSize: 10.5, color: statusTone(r.status) }}>{r.status}</span>
              )}
              {r.when && (
                <span style={{ fontSize: 10.5, color: urgency(r.when), ...FIG }}>
                  {whenStr(r.when)}
                </span>
              )}
              {r.qty != null && r.qty !== 0 && (
                <span style={{ fontSize: 10.5, color: T.sub, ...FIG }}>{r.qty} in stock</span>
              )}
            </div>
          </div>
          {!!r.amount && (
            <div style={{ fontSize: 13, color: T.text, flexShrink: 0, ...FIG }}>
              {money(r.amount)}
            </div>
          )}
        </div>
      ))}

      {addAction && (
        <button onClick={() => setAct({ action: addAction, record: null })} style={{
          position: 'fixed', right: 18, bottom: 88, zIndex: 20,
          background: T.accent, color: T.onAccent, border: 'none',
          borderRadius: 999, padding: '14px 20px', fontSize: 14,
          boxShadow: '0 6px 20px rgba(0,0,0,0.45)', cursor: 'pointer'
        }}>+ {ACTION_FORMS[addAction].label.replace(/^Log a /, '')}</button>
      )}

      {rows.length > 300 && (
        <div style={{ fontSize: 11.5, color: T.faint, padding: '8px 2px' }}>
          Showing the first 300 of {rows.length}. Search to narrow it.
        </div>
      )}
    </>
  );
}
