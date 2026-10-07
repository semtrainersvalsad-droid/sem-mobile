/**
 * Home — what matters, in one screen, from cache first.
 *
 * Built on cached(), so a second visit paints immediately and the three to six
 * second round trip happens behind. The three calls go out as ONE batch; made
 * separately they could take the better part of twenty seconds, which is most
 * of what "slow and awkward" meant on the old mobile view.
 */
import React from 'react';
import { Tile, Card, Spin, greeting, fmtL } from '../components/tiles.jsx';
import { batch } from '../api.js';
import { cached } from '../db.js';

export default function Home({ user, isMgr, online }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    let dead = false;
    const key = 'home:' + (isMgr ? 'mgr' : 'emp');

    cached(key, async () => {
      const calls = [['getTasks', {}]];
      if (isMgr) {
        calls.push(['getTallyFinanceDashboard', {}]);
        calls.push(['getAutopilotDashboard', {}]);
      }
      const [tasks, fin, auto] = await batch(calls);
      return { tasks: Array.isArray(tasks) ? tasks : [], fin: fin || null, auto: auto || null };
    }, (value, meta) => {
      if (dead) return;
      setData(value);
      setStale(meta.fromCache ? meta.at : null);
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });

    return () => { dead = true; };
  }, [isMgr]);

  if (!data && !err) return <Spin />;
  if (!data && err) {
    return (
      <Card>
        <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>Could not load</div>
        <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>
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
  const fin = data.fin || {};

  return (
    <>
      <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '0.15rem' }}>
        {greeting()}
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.9rem' }}>
        {String(user.name || '').split(' ')[0] || 'there'}
      </div>

      {stale && (
        <div style={{ fontSize: '0.72rem', color: '#8A6212', marginBottom: '0.6rem' }}>
          Showing saved data from {new Date(stale).toLocaleTimeString('en-IN',
            { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <Tile c="blue"  icon="list-check" value={open.length} label="Open tasks" />
        <Tile c={overdue.length ? 'red' : 'teal'} icon="clock"
              value={overdue.length} label="Overdue" />
        {isMgr && fin.receivables != null && (
          <Tile c="amber" icon="indian-rupee-sign"
                value={fmtL(fin.receivables)} label="Receivables" small />
        )}
        {isMgr && fin.payables != null && (
          <Tile c="neutral" icon="file-invoice"
                value={fmtL(fin.payables)} label="Payables" small />
        )}
      </div>

      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#44474C', margin: '0.2rem 0 0.5rem' }}>
        Next up
      </div>
      {open.slice(0, 6).map((t, i) => (
        <Card key={t.TaskID || t.id || i}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {t.Task || t.Description || 'Task'}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#6B7280', marginTop: '0.2rem' }}>
            {t.DueDate ? new Date(t.DueDate).toLocaleDateString('en-IN') : 'No due date'}
            {t.Priority ? ' · ' + t.Priority : ''}
          </div>
        </Card>
      ))}
      {!open.length && (
        <Card><div style={{ fontSize: '0.88rem', color: '#6B7280' }}>Nothing open.</div></Card>
      )}
    </>
  );
}
