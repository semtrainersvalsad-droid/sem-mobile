/**
 * Home — what needs a person today, then what they personally owe.
 *
 * WHY THIS WAS REBUILT
 * The first version showed four tiles and a task list. On the live data it
 * rendered "0 open tasks, ₹0 receivables, ₹0 payables, Nothing open" — a blank
 * screen on a morning when ₹1.12 Cr was more than ninety days late and a bank
 * guarantee had already expired. Two separate faults produced that:
 *
 *  1. getTallyFinanceDashboard returns receivables and payables as OBJECTS
 *     ({ total, count, buckets }). Passed whole to a number formatter they
 *     became NaN, then ₹0, while the Business screen read .total from the same
 *     call and showed ₹3.02 Cr. A wrong number that looks like a real one is
 *     worse than an error.
 *  2. Even with the money right, an empty task list is not news. The things
 *     that actually needed attention were all computed and none were shown.
 *
 * So Home now leads with needsYou from the dashboard — the same cached payload
 * the Business tab uses, so this costs no extra round trip — and keeps tasks
 * below it, where they belong when there are none.
 */
import React from 'react';
import { T, R, money } from '../theme.js';
import { Card, Spin, greeting, shortDate, StaleNote } from '../components/tiles.jsx';
import { batch } from '../api.js';
import { cached } from '../db.js';

const SEV = {
  bad:  { dot: T.red,   bg: T.redBg },
  warn: { dot: T.amber, bg: T.amberBg }
};

function NeedRow({ item, onGo }) {
  const s = SEV[item.sev] || SEV.warn;
  return (
    <div onClick={onGo} style={{
      display: 'flex', gap: 11, alignItems: 'flex-start',
      background: T.card, borderRadius: 16, padding: '13px 14px',
      marginBottom: 8, cursor: onGo ? 'pointer' : 'default'
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot,
                    flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.35 }}>{item.title}</div>
        {item.detail && (
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>{item.detail}</div>
        )}
      </div>
      {onGo && <div style={{ fontSize: 15, color: T.faint, flexShrink: 0 }}>›</div>}
    </div>
  );
}

export default function Home({ user, isMgr, online, onGoTab }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let dead = false;
    const key = 'home:' + (isMgr ? 'mgr' : 'emp');

    cached(key, async () => {
      // One batch. Made as separate calls these take three to six seconds
      // EACH, which is most of what "the app takes time to open" means.
      const calls = [['getTasks', {}]];
      if (isMgr) calls.push(['getMobileDashboard', false]);
      const [tasks, dash] = await batch(calls);
      return { tasks: Array.isArray(tasks) ? tasks : [], dash: dash || null };
    }, (value, meta) => {
      if (dead) return;
      setData(value);
      setStale(meta.fromCache ? meta.at : null);
      setStaleErr(meta.error || '');
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });

    return () => { dead = true; };
  }, [isMgr, nonce]);

  if (!data && !err) return <Spin />;
  if (!data) {
    return (
      <Card>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>Could not load</div>
        <div style={{ fontSize: 12, color: T.sub }}>
          {online ? err : 'You are offline and nothing has been cached yet. Open this screen once with signal.'}
        </div>
      </Card>
    );
  }

  const tasks = data.tasks || [];
  const open = tasks.filter(t => String(t.Status || '').toLowerCase() !== 'closed');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdue = open.filter(t => {
    const d = t.DueDate ? new Date(t.DueDate) : null;
    return d && !isNaN(d) && d < today;
  });
  const dash = data.dash || {};
  const needs = dash.needsYou || [];

  return (
    <>
      <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 1, paddingTop: 2 }}>
        {greeting()}
      </div>
      <div style={{ fontSize: 22, color: T.text, marginBottom: 14 }}>
        {String(user.name || '').split(' ')[0] || 'there'}
      </div>

      <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />

      {isMgr && needs.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: T.sub, margin: '2px 0 8px' }}>
            {needs.length} {needs.length === 1 ? 'thing needs' : 'things need'} you
          </div>
          {needs.map((n, i) => (
            <NeedRow key={i} item={n}
                     onGo={onGoTab ? () => onGoTab(n.go || 'business') : undefined} />
          ))}
        </>
      )}

      {/* Only claim all-clear when the check actually ran. With no dashboard
          in the payload this screen knows nothing about PBGs or receivables,
          and "nothing needs you" would be a guess wearing a tick. */}
      {isMgr && dash.needsYou && needs.length === 0 && (
        <div style={{ background: T.greenBg, borderRadius: 16, padding: '13px 14px',
                      marginBottom: 10, fontSize: 13, color: T.green }}>
          Nothing urgent. No expired guarantees, no bills past 90 days.
        </div>
      )}

      <div style={{ fontSize: 12, color: T.sub, margin: '16px 0 8px' }}>
        Your tasks
      </div>
      {open.length > 0 && (
        <div style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
          <div style={{ flex: 1, background: T.card, borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ fontSize: 20, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
              {open.length}
            </div>
            <div style={{ fontSize: 11, color: T.sub }}>open</div>
          </div>
          <div style={{ flex: 1, background: overdue.length ? T.redBg : T.card,
                        borderRadius: 16, padding: '12px 14px' }}>
            <div style={{ fontSize: 20, color: overdue.length ? T.red : T.text,
                          fontVariantNumeric: 'tabular-nums' }}>
              {overdue.length}
            </div>
            <div style={{ fontSize: 11, color: T.sub }}>overdue</div>
          </div>
        </div>
      )}
      {open.slice(0, 6).map((t, i) => (
        <div key={t.TaskID || t.id || i} style={{
          background: T.card, borderRadius: 16, padding: '12px 14px', marginBottom: 8
        }}>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.35 }}>
            {t.Task || t.Description || 'Task'}
          </div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 3 }}>
            {t.DueDate ? shortDate(t.DueDate) : 'No due date'}
            {t.Priority ? ' · ' + t.Priority : ''}
          </div>
        </div>
      ))}
      {!open.length && (
        <div style={{ background: T.card, borderRadius: 16, padding: '13px 14px',
                      fontSize: 12.5, color: T.sub }}>
          No open tasks assigned to you.
        </div>
      )}
    </>
  );
}
