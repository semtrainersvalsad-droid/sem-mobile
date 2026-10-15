/**
 * Today — what needs a person, and what they can put down.
 *
 * This replaces a dashboard that opened with ₹5.34 Cr. Revenue is not the
 * question at 7am; "did anything go wrong" is. So the largest thing on screen
 * is the answer to that, the figures sit below it as a quiet list, and the
 * charts moved inside the topics they belong to.
 *
 * SNOOZE IS THE LOAD-BEARING PART
 * A government PBG release letter routinely takes six months. Without a way to
 * put an alert down, "two things need you" is true on day one and furniture by
 * day forty — and a list you have learned to ignore hides the one new thing on
 * it. Snoozing is therefore not a convenience; it is what keeps the screen
 * worth reading. Snoozed items are counted at the bottom, never silently
 * dropped, and they come back by themselves.
 *
 * CAVEATS WHISPER
 * Each figure carries one grey provenance line — "Tally · excludes tax · 10:28"
 * — instead of a sentence. The old screen wrote the qualification out in full
 * twelve times and the result was exhausting. Nothing is hidden; it is just no
 * longer shouting.
 */
import React from 'react';
import { T, R, money } from '../theme.js';
import { Spin, StaleNote } from '../components/tiles.jsx';
import { call, batch } from '../api.js';
import { cached } from '../db.js';

const FIG = { fontVariantNumeric: 'tabular-nums' };

function greetingFor(d) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 10, color: T.faint, letterSpacing: '0.1em',
                  textTransform: 'uppercase' }}>{children}</div>
  );
}

/** A figure, its provenance, and nothing else. */
function Figure({ label, prov, value, first, onOpen }) {
  return (
    <div onClick={onOpen} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '13px 0', borderTop: first ? 'none' : '1px solid ' + T.line,
      cursor: onOpen ? 'pointer' : 'default'
    }}>
      <div style={{ minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontSize: 12.5, color: T.text }}>{label}</div>
        {prov && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{prov}</div>}
      </div>
      <div style={{ fontSize: 15, color: T.text, flexShrink: 0, ...FIG }}>{value}</div>
    </div>
  );
}

export default function Today({ user, isMgr, online, onGoTab }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);
  const [busyKey, setBusyKey] = React.useState('');
  const [showHeld, setShowHeld] = React.useState(false);

  React.useEffect(() => {
    let dead = false;
    const key = 'today:' + (isMgr ? 'mgr' : 'emp');
    cached(key, async () => {
      const calls = [['getTasks', {}]];
      if (isMgr) calls.push(['getMobileDashboard', false]);
      const [tasks, dash] = await batch(calls);
      return { tasks: Array.isArray(tasks) ? tasks : [], dash: dash || null };
    }, (v, m) => {
      if (dead) return;
      setData(v);
      setStale(m.fromCache ? m.at : null);
      setStaleErr(m.error || '');
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });
    return () => { dead = true; };
  }, [isMgr, nonce]);

  async function hold(key, days) {
    if (!online) return;
    setBusyKey(key);
    try {
      await call('snoozeAlert', key, days);
      setNonce(n => n + 1);
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setBusyKey(''); }
  }

  async function release(key) {
    if (!online) return;
    setBusyKey(key);
    try { await call('unsnoozeAlert', key); setNonce(n => n + 1); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusyKey(''); }
  }

  if (!data && !err) return <Spin />;
  if (!data) {
    return (
      <div style={{ background: T.card, borderRadius: R.card, padding: 16, marginTop: 10 }}>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>Could not load</div>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
          {online ? err : 'You are offline and this screen has not been opened with signal yet.'}
        </div>
      </div>
    );
  }

  const now = new Date();
  const dash = data.dash || {};
  const needs = dash.needsYou || [];
  const held = dash.snoozed || [];
  const tasks = (data.tasks || []).filter(t => String(t.Status || '').toLowerCase() !== 'closed');
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const overdue = tasks.filter(t => {
    const d = t.DueDate ? new Date(t.DueDate) : null;
    return d && !isNaN(d) && d < midnight;
  });

  const headline = !isMgr
    ? (tasks.length ? tasks.length + (tasks.length === 1 ? ' task today.' : ' tasks today.')
                    : 'Nothing assigned to you.')
    : needs.length
      ? (needs.length === 1 ? 'One thing needs you.' : needs.length + ' things need you.')
      : (dash.needsYou ? 'Nothing needs you.' : 'Still loading your figures.');

  return (
    <>
      <div style={{ padding: '6px 4px 0' }}>
        <Eyebrow>
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Eyebrow>
        <div style={{ fontSize: 14, color: T.sub, marginTop: 14 }}>
          {greetingFor(now)}, {String(user.name || '').split(' ')[0] || 'there'}.
        </div>
        <div style={{ fontSize: 25, color: T.text, lineHeight: 1.3, marginTop: 6 }}>
          {headline}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />
      </div>

      {/* ── What needs doing ─────────────────────────────────────────────── */}
      {needs.map(n => (
        <div key={n.key} style={{
          background: T.card, borderRadius: 17, padding: '14px 15px', marginBottom: 8
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                          background: n.sev === 'bad' ? T.red : T.amber }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.35 }}>{n.title}</div>
              {n.detail && (
                <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>{n.detail}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 11, paddingLeft: 17 }}>
            <button onClick={() => onGoTab && onGoTab(n.go || 'business')} style={{
              background: T.accent, color: T.onAccent, border: 'none', borderRadius: 9,
              padding: '8px 13px', fontSize: 11.5, cursor: 'pointer'
            }}>Open</button>
            {/* Offline snooze would be a lie: the next refresh would bring it
                straight back, because the hold lives on the server. */}
            <button disabled={!online || busyKey === n.key}
                    onClick={() => hold(n.key, 7)} style={{
              background: T.raised, color: online ? T.sub : T.faint, border: 'none',
              borderRadius: 9, padding: '8px 13px', fontSize: 11.5,
              cursor: online ? 'pointer' : 'default'
            }}>{busyKey === n.key ? 'Holding…' : 'Snooze 1 week'}</button>
          </div>
        </div>
      ))}

      {isMgr && dash.needsYou && needs.length === 0 && (
        <div style={{ background: T.greenBg, borderRadius: 17, padding: '14px 15px',
                      fontSize: 13, color: T.green, lineHeight: 1.5 }}>
          No expired guarantees, nothing new past 90 days.
        </div>
      )}

      {/* ── The figures, quietly ─────────────────────────────────────────── */}
      {isMgr && (dash.billed || dash.receivables || dash.tenders) && (
        <div style={{ padding: '22px 4px 0' }}>
          <Eyebrow>Worth knowing</Eyebrow>
          <div style={{ marginTop: 4 }}>
            {dash.billed && (
              <Figure first label="Billed this year"
                      prov={'Tally · excludes tax' + (dash.billed.rows ? ' · ' + dash.billed.rows + ' lines' : '')}
                      value={money(dash.billed.fy)}
                      onOpen={() => onGoTab && onGoTab('business')} />
            )}
            {dash.receivables && (
              <Figure label="Owed to you"
                      prov={dash.receivables.count + ' bills'}
                      value={money(dash.receivables.total)}
                      onOpen={() => onGoTab && onGoTab('business')} />
            )}
            {dash.tenders && (
              <Figure label="Live tenders"
                      prov={(dash.tenders.liveConfirmed || 0) + ' dated · ' +
                            (dash.tenders.liveUnreadable || 0) + ' written as text'}
                      value={String(dash.tenders.live)}
                      onOpen={() => onGoTab && onGoTab('tenders')} />
            )}
            {dash.emd && (
              <Figure label="Deposits lodged"
                      prov={dash.emd.count + ' instruments · status never updated'}
                      value={money(dash.emd.locked)}
                      onOpen={() => onGoTab && onGoTab('business')} />
            )}
          </div>
        </div>
      )}

      {/* ── Held, never silently dropped ─────────────────────────────────── */}
      {held.length > 0 && (
        <div style={{ padding: '18px 4px 0' }}>
          <div onClick={() => setShowHeld(s => !s)} style={{
            fontSize: 11.5, color: T.faint, cursor: 'pointer'
          }}>
            Snoozed ({held.length}) {showHeld ? '›' : '›'}
          </div>
          {showHeld && held.map(n => (
            <div key={n.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
              borderBottom: '1px solid ' + T.line
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.sub }}>{n.title}</div>
                <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>
                  back on {new Date(n.until).toLocaleDateString('en-IN',
                    { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button disabled={!online || busyKey === n.key}
                      onClick={() => release(n.key)} style={{
                background: 'none', border: 'none', color: T.accent,
                fontSize: 11.5, cursor: online ? 'pointer' : 'default'
              }}>Bring back</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Tasks, only when there are any ───────────────────────────────── */}
      {tasks.length > 0 && (
        <div style={{ padding: '24px 4px 0' }}>
          <Eyebrow>
            Your tasks{overdue.length ? ' · ' + overdue.length + ' overdue' : ''}
          </Eyebrow>
          <div style={{ marginTop: 10 }}>
            {tasks.slice(0, 6).map((t, i) => {
              const due = t.DueDate ? new Date(t.DueDate) : null;
              const late = due && !isNaN(due) && due < midnight;
              return (
                <div key={t.TaskID || i} onClick={() => onGoTab && onGoTab('tasks')} style={{
                  background: T.card, borderRadius: 15, padding: '12px 14px',
                  marginBottom: 7, cursor: 'pointer'
                }}>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.35 }}>
                    {t.Task || t.Description || 'Task'}
                  </div>
                  <div style={{ fontSize: 10.5, color: late ? T.red : T.faint, marginTop: 3 }}>
                    {due && !isNaN(due)
                      ? (late ? 'overdue · ' : '') + due.toLocaleDateString('en-IN',
                          { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'no due date'}
                    {/* The assignee is not repeated: every task here is already
                        this person's, and the name on all six rows is noise. */}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
