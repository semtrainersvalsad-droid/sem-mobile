/**
 * Tasks — what is due, and marking it done.
 *
 * Closing a task offline is queued: it is a status on your own work, not a
 * record other people are acting on at the same moment.
 */
import React from 'react';
import { Icon, Card, Btn, Spin, Sheet, Chips, MT, PRIMARY } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached, enqueue } from '../db.js';

const field = {
  width: '100%', padding: '0.85rem', fontSize: '0.95rem', borderRadius: 12,
  border: '1px solid #DFE2E7', marginBottom: '0.6rem', boxSizing: 'border-box'
};

export default function Tasks({ user, isMgr, online, onQueued }) {
  const [tasks, setTasks] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [closing, setClosing] = React.useState({});

  const load = React.useCallback(() => {
    cached('tasks', () => call('getTasks', {}), (v, m) => {
      setTasks(Array.isArray(v) ? v : []);
      setStale(m.fromCache ? m.at : null);
    }).catch(() => setTasks([]));
  }, []);
  React.useEffect(load, [load]);

  if (tasks === null) return <Spin />;

  const open = tasks.filter(t => String(t.Status || '').toLowerCase() !== 'closed');
  const list = showAll ? tasks : open;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const close = async (t) => {
    const id = t.TaskID || t.id;
    setClosing(c => ({ ...c, [id]: true }));
    const args = [id, { Status: 'Closed' }, user.name];
    try {
      if (!navigator.onLine) throw new Error('offline');
      await call('updateTask', ...args);
    } catch {
      await enqueue('updateTask', args, 'Close task — ' + String(t.Task || t.Description || '').slice(0, 40));
      onQueued && onQueued();
    } finally {
      setClosing(c => ({ ...c, [id]: false }));
      load();
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.7rem', alignItems: 'center' }}>
        <Chips options={['Open', 'All']} value={showAll ? 'All' : 'Open'}
               onChange={v => setShowAll(v === 'All')} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setAdding(true)} style={{
          background: PRIMARY, color: 'white', border: 'none', borderRadius: 12,
          padding: '0.55rem 1rem', fontWeight: 800, fontSize: '0.82rem'
        }}><Icon name="plus" /> New</button>
      </div>

      {stale && (
        <div style={{ fontSize: '0.72rem', color: '#8A6212', marginBottom: '0.5rem' }}>
          Saved list from {new Date(stale).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {adding && <TaskAdd user={user} isMgr={isMgr} online={online} onQueued={onQueued}
                          onClose={() => setAdding(false)}
                          onSaved={() => { setAdding(false); load(); }} />}

      {list.slice(0, 80).map((t, i) => {
        const id = t.TaskID || t.id || i;
        const due = t.DueDate ? new Date(t.DueDate) : null;
        const late = due && !isNaN(due) && due < today &&
                     String(t.Status || '').toLowerCase() !== 'closed';
        const done = String(t.Status || '').toLowerCase() === 'closed';
        return (
          <Card key={id}>
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600,
                              textDecoration: done ? 'line-through' : 'none',
                              color: done ? '#9AA0A6' : 'inherit' }}>
                  {t.Task || t.Description || 'Task'}
                </div>
                <div style={{ fontSize: '0.73rem', color: late ? MT.red.sub : '#9AA0A6', marginTop: 2 }}>
                  {due && !isNaN(due) ? due.toLocaleDateString('en-IN') : 'No due date'}
                  {late ? ' · overdue' : ''}{t.Priority ? ' · ' + t.Priority : ''}
                  {t.AssignedTo ? ' · ' + t.AssignedTo : ''}
                </div>
              </div>
              {!done && (
                <button disabled={!!closing[id]} onClick={() => close(t)} style={{
                  background: MT.teal.bg, color: MT.teal.fg, border: 'none', borderRadius: 10,
                  padding: '0.5rem 0.7rem', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0
                }}>{closing[id] ? '…' : 'Done'}</button>
              )}
            </div>
          </Card>
        );
      })}
      {!list.length && <Card><div style={{ fontSize: '0.88rem', color: '#6B7280' }}>Nothing here.</div></Card>}
    </>
  );
}

function TaskAdd({ user, isMgr, online, onQueued, onClose, onSaved }) {
  const [f, setF] = React.useState({ task: '', dueDate: '', priority: 'Medium', assignedTo: '' });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.task.trim()) { setMsg('What is the task?'); return; }
    setBusy(true); setMsg('');
    const args = [{
      Task: f.task, DueDate: f.dueDate, Priority: f.priority,
      AssignedTo: f.assignedTo || user.name, Status: 'Open'
    }, user.name];
    try {
      if (!navigator.onLine) throw new Error('offline');
      const r = await call('addTask', ...args);
      if (r && r.success === false) { setMsg(r.error || 'Could not save.'); return; }
      onSaved();
    } catch {
      await enqueue('addTask', args, 'New task — ' + f.task.slice(0, 40));
      onQueued && onQueued();
      setMsg('Saved on this phone.');
      setTimeout(onSaved, 900);
    } finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontWeight: 800, fontSize: '1.08rem', marginBottom: '0.85rem' }}>
        <Icon name="list-check" style={{ color: PRIMARY, marginRight: '0.4rem' }} />New task
      </div>
      <textarea style={{ ...field, minHeight: 70 }} placeholder="What needs doing?"
                value={f.task} onChange={e => set('task', e.target.value)} />
      <input type="date" style={field} value={f.dueDate} onChange={e => set('dueDate', e.target.value)} />
      <Chips options={['High', 'Medium', 'Low']} value={f.priority} onChange={v => set('priority', v)} />
      {isMgr && (
        <input style={{ ...field, marginTop: '0.6rem' }} placeholder="Assign to (blank = yourself)"
               value={f.assignedTo} onChange={e => set('assignedTo', e.target.value)} />
      )}
      {!online && (
        <div style={{ background: MT.amber.bg, color: MT.amber.fg, borderRadius: 10,
                      padding: '0.5rem 0.7rem', fontSize: '0.78rem', margin: '0.7rem 0' }}>
          Offline — kept on the phone until you have signal.
        </div>
      )}
      {msg && <div style={{ fontSize: '0.8rem', color: '#B4232A', margin: '0.5rem 0' }}>{msg}</div>}
      <Btn disabled={busy} onClick={save} style={{ marginTop: '0.6rem' }}>
        {busy ? 'Saving…' : 'Save task'}
      </Btn>
    </Sheet>
  );
}
