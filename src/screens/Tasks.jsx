/**
 * Tasks — who has what, and each task from given to done.
 *
 * A manager opens on the TEAM: one row per person with what they have open,
 * late, 5+ days late (needs a decision) and waiting for Got it, whether they
 * were reminded today, and WhatsApp / Email to remind them now.
 *
 * Tap any task for its sheet. What it offers depends on whose it is:
 *   yours   — Got it (if it was given to you), Done (a note is required),
 *             Move date (a reason is required)
 *   a manager on someone else's — Move date, Reassign, Close (with a note),
 *             Remind on WhatsApp
 * Every one of those is recorded server-side (Task_Events) and shows in the
 * manager's evening summary. Owner's rules, 18 Nov 2026.
 *
 * WhatsApp reminders open WhatsApp with the text typed in. Someone still has to
 * press Send, and WhatsApp tells nobody whether they did, so the ERP records
 * "opened", never "sent".
 */
import React from 'react';
import { T } from '../theme.js';
import { Spin, Sheet, StaleNote } from '../components/tiles.jsx';
import { call, batch } from '../api.js';
import { cached, enqueue } from '../db.js';

const CLOSED = ['closed', 'done', 'completed', 'complete', 'cancelled', 'canceled'];
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const isClosed = t => CLOSED.includes(norm(t.Status));
const textOf = t => String(t.Description || t.Task || '').replace(/\s+/g, ' ').trim();
const whoOf = t => String(t.Assignee || t.AssignedTo || '').replace(/\s+/g, ' ').trim();
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const APP_URL = 'https://semtrainersvalsad-droid.github.io/sem-mobile/';
// Got it applies to tasks given from this day on (server: TF_ACK_SINCE).
const ACK_SINCE = '2026-11-18';

/**
 * Strict, like the server: ISO or dd/mm/yyyy, nothing else. new Date() reads
 * "~Feb 2026 (verify)" as a real deadline; a date nobody can read is shown as
 * unreadable rather than guessed into one.
 */
function strictDate(v) {
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/))) { y = +m[3]; mo = +m[2]; d = +m[1]; }
  else return null;
  const x = new Date(y, mo - 1, d);
  return x.getMonth() === mo - 1 && x.getDate() === d ? x : null;
}

function midnight(n = 0) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + n * 86400000);
}

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/** { days, label, color, level } — days is null when there is no usable date. */
function dueOf(t) {
  const raw = String(t.DueDate || '').trim();
  const d = strictDate(raw);
  if (!d) return { days: null, label: raw ? 'Date unreadable' : 'No date', color: T.faint, level: 0 };
  const days = Math.round((d - midnight()) / 86400000);
  const level = days <= -5 ? 2 : days <= -3 ? 1 : 0;
  if (days < 0) return { days, level, label: -days + (days === -1 ? ' day late' : ' days late'), color: T.red };
  if (days === 0) return { days, level, label: 'Today', color: T.amber };
  if (days === 1) return { days, level, label: 'Tomorrow', color: T.text };
  return { days, level, label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
           color: days <= 7 ? T.text : T.sub };
}

/** Late first, then today, then soonest; no date last. */
function byDue(a, b) {
  const x = dueOf(a).days, y = dueOf(b).days;
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
}

/** Given to this person by someone else, on or after ACK_SINCE, not yet confirmed. */
function needsAck(t, me) {
  if (isClosed(t) || String(t.AckAt || '').trim()) return false;
  if (norm(t.Category) === 'routine') return false;      // agreed once, when set up
  const by = norm(t.CreatedBy), to = norm(whoOf(t));
  if (!by || !to || by === to || to !== me) return false;
  return String(t.CreatedDate || '').slice(0, 10) >= ACK_SINCE;
}

function phoneOf(e) {
  let c = String((e && (e.WhatsApp || e.Phone)) || '').replace(/\D/g, '');
  if (c.startsWith('0091')) c = c.slice(4);
  else if (c.length === 12 && c.startsWith('91')) c = c.slice(2);
  else if (c.length === 11 && c.startsWith('0')) c = c.slice(1);
  return c.length === 10 && /^[6-9]/.test(c) ? c : '';
}

const wa = (phone, text) => phone ? 'https://wa.me/91' + phone + '?text=' + encodeURIComponent(text) : '';

/** Recorded as "opened" — WhatsApp does not say whether Send was pressed. */
function logTap(name, what) {
  try { call('logTaskReminderTap', name, what).catch(() => {}); } catch {}
}

// ── Small pieces ───────────────────────────────────────────────────────────

function Pill({ on, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: on ? T.accent : T.raised, color: on ? T.onAccent : T.sub,
      border: 'none', borderRadius: 999, padding: '7px 13px', fontSize: 12.5,
      whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0
    }}>{children}</button>
  );
}

function Note({ children, tone }) {
  const bg = tone === 'warn' ? T.amberBg : tone === 'bad' ? T.redBg : T.card;
  const fg = tone === 'warn' ? T.amber : tone === 'bad' ? T.red : T.sub;
  return (
    <div style={{ background: bg, color: fg, borderRadius: 14, padding: '10px 13px',
                  fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{children}</div>
  );
}

const btn = (primary, disabled) => ({
  background: disabled ? T.raised : primary ? T.accent : T.raised,
  color: disabled ? T.faint : primary ? T.onAccent : T.text,
  border: 'none', borderRadius: 11, padding: '9px 0', fontSize: 12.5, flex: 1,
  textAlign: 'center', textDecoration: 'none', cursor: disabled ? 'default' : 'pointer',
  display: 'block'
});

const field = {
  width: '100%', boxSizing: 'border-box', background: T.card, color: T.text,
  border: '1px solid ' + T.line, borderRadius: 13, padding: '12px 13px',
  fontSize: 14.5, outline: 'none', marginBottom: 12, fontFamily: 'inherit'
};

const label = { fontSize: 10.5, color: T.faint, letterSpacing: '0.08em',
                textTransform: 'uppercase', margin: '4px 2px 7px' };

// ── Screen ─────────────────────────────────────────────────────────────────

export default function Tasks({ user, isMgr, online, onQueued }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [view, setView] = React.useState(isMgr ? 'team' : 'open');
  const [who, setWho] = React.useState('');
  const [adding, setAdding] = React.useState(null);     // null, or { assignee }
  const [open, setOpen] = React.useState(null);         // null, or { task, mode }
  const [busy, setBusy] = React.useState({});
  const [msg, setMsg] = React.useState({});             // per-person result line
  const [flash, setFlash] = React.useState('');         // "saved on this phone"

  const load = React.useCallback(() => {
    const key = isMgr ? 'tasks:mgr' : 'tasks';
    cached(key, async () => {
      if (!isMgr) {
        const tasks = await call('getTasks', {});
        return { tasks: Array.isArray(tasks) ? tasks : [] };
      }
      const [tasks, team, emps] = await batch([['getTasks', {}], ['getTaskTeam'], ['getAllEmployees']]);
      return {
        tasks: Array.isArray(tasks) ? tasks : [],
        team: team && team.success ? team : null,
        teamErr: team && team.success === false ? (team.error || '') : '',
        emps: Array.isArray(emps) ? emps : []
      };
    }, (v, m) => {
      // An older cache entry for 'tasks' was a bare array.
      setData(Array.isArray(v) ? { tasks: v } : v);
      setStale(m.fromCache ? m.at : null);
      setStaleErr(m.error || '');
    }).catch(e => setData(d => d || { tasks: [], loadErr: e.message || String(e) }));
  }, [isMgr]);
  React.useEffect(load, [load]);

  if (data === null) return <Spin />;

  const me = norm(user.name);
  const tasks = data.tasks || [];
  const emps = data.emps || [];
  const empByName = {};
  emps.forEach(e => { empByName[norm(e.Name || e.name)] = e; });
  const team = data.team;

  const openList = tasks.filter(t => !isClosed(t) && textOf(t));
  const done = tasks.filter(t => isClosed(t)).sort((a, b) =>
    String(b.ClosureDate || b.LastModified || '').localeCompare(String(a.ClosureDate || a.LastModified || '')));
  const blank = tasks.filter(t => !isClosed(t) && !textOf(t)).length;
  const waitingMine = openList.filter(t => needsAck(t, me));

  const scoped = list => {
    if (!isMgr) return list.filter(t => norm(whoOf(t)) === me || !whoOf(t));
    return who ? list.filter(t => norm(whoOf(t)) === norm(who)) : list;
  };

  /**
   * Run a task action. Your own work may wait on the phone without signal;
   * reassigning someone else's work needs the server there and then.
   */
  const act = async (name, args, label, queueable) => {
    const id = args[0];
    const keep = async () => {
      await enqueue(name, args, label);
      onQueued && onQueued();
      setFlash('Saved on this phone — it goes to the ERP when you have signal. Until then it still shows here as before.');
      return { success: true, queued: true };
    };
    setBusy(b => ({ ...b, [id]: true }));
    try {
      if (!navigator.onLine) {
        if (!queueable) return { success: false, error: 'Needs signal.' };
        return await keep();
      }
      const r = await call(name, ...args);
      if (r && r.success !== false) setFlash('');
      return r || { success: false, error: 'No answer from the server.' };
    } catch (e) {
      if (!queueable) return { success: false, error: e.message || String(e) };
      return await keep();
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
      load();
    }
  };

  const gotIt = t => act('ackTask', [t.TaskID], 'Got it — ' + textOf(t).slice(0, 40), true);

  const emailPerson = async (name) => {
    if (!online) { setMsg(m => ({ ...m, [name]: 'Needs signal — the ERP sends the email.' })); return; }
    setMsg(m => ({ ...m, [name]: 'Sending…' }));
    try {
      const r = await call('remindPersonNow', name);
      setMsg(m => ({ ...m, [name]: r && r.success ? (r.message || 'Emailed.') : ((r && r.error) || 'Could not send.') }));
      if (r && r.success) load();
    } catch (e) {
      setMsg(m => ({ ...m, [name]: e.message || String(e) }));
    }
  };

  const views = isMgr ? [['team', 'Team'], ['open', 'Open'], ['done', 'Done'], ['routine', 'Routine']]
                      : [['open', 'My tasks'], ['done', 'Done']];

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {views.map(([id, lbl]) => (
          <Pill key={id} on={view === id} onClick={() => { setView(id); if (id === 'team') setWho(''); }}>
            {lbl}{id === 'open' ? ' ' + scoped(openList).length : ''}
          </Pill>
        ))}
        {who && view !== 'team' && (
          <Pill on onClick={() => setWho('')}>{who} ✕</Pill>
        )}
      </div>

      <StaleNote at={stale} error={staleErr} onRetry={load} />
      {data.loadErr && <Note tone="bad">Could not load tasks. {data.loadErr}</Note>}
      {flash && <Note tone="warn">{flash}</Note>}

      {waitingMine.length > 0 && view !== 'done' && (
        <Note tone="warn">
          {waitingMine.length === 1 ? 'A task was' : waitingMine.length + ' tasks were'} given to you.
          Tap Got it so they know you have seen it.
        </Note>
      )}

      {view === 'team' && (
        <TeamView team={team} teamErr={data.teamErr} blank={blank} me={me}
                  msg={msg} onEmail={emailPerson}
                  onPick={name => { setWho(name); setView('open'); }}
                  onGive={name => setAdding({ assignee: name })} />
      )}

      {view === 'open' && (
        <TaskList list={scoped(openList).sort(byDue)} isMgr={isMgr} showWho={isMgr && !who}
                  me={me} busy={busy} onOpen={(t, mode) => setOpen({ task: t, mode })} onGotIt={gotIt}
                  empty={who ? first(who) + ' has nothing open.' : isMgr ? 'No open tasks.' : 'Nothing assigned to you.'} />
      )}

      {view === 'done' && (
        <TaskList list={scoped(done).slice(0, 60)} done isMgr={isMgr} showWho={isMgr && !who}
                  me={me} busy={busy} onOpen={(t, mode) => setOpen({ task: t, mode })}
                  empty="Nothing closed yet." />
      )}

      {view === 'routine' && isMgr && <RoutineView emps={emps} online={online} />}

      {open && (
        <TaskSheet task={open.task} startMode={open.mode} user={user} isMgr={isMgr} me={me}
                   emps={emps} empByName={empByName} online={online} act={act}
                   onClose={() => setOpen(null)} />
      )}

      {adding && (
        <TaskAdd user={user} isMgr={isMgr} online={online} emps={emps} preset={adding.assignee}
                 onQueued={onQueued} onClose={() => setAdding(null)}
                 onSaved={() => { load(); }} />
      )}

      {view !== 'routine' && (
        <button onClick={() => setAdding({ assignee: '' })} style={{
          position: 'fixed', right: 18, bottom: 88, zIndex: 20,
          background: T.accent, color: T.onAccent, border: 'none',
          borderRadius: 999, padding: '14px 20px', fontSize: 14,
          boxShadow: '0 6px 20px rgba(0,0,0,0.45)', cursor: 'pointer'
        }}>+ Task</button>
      )}
      <div style={{ height: 70 }} />
    </>
  );
}

// ── Routine jobs ───────────────────────────────────────────────────────────

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The manager's routine jobs, by person. A routine makes the same task for the
 * same person on its days; it lands in their 10:30 list, Done needs a note, and
 * a copy left undone escalates like any task. One open copy at a time, so a
 * neglected routine is one task getting later — not a pile.
 */
function RoutineView({ emps, online }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [edit, setEdit] = React.useState(null);           // null | {} for new | a routine
  const load = React.useCallback(() => {
    setErr('');
    cached('routines', () => call('getRoutines'), v => setData(v))
      .catch(e => setErr(e.message || String(e)));
  }, []);
  React.useEffect(load, [load]);

  if (!data && !err) return <Spin />;
  if (data && data.success === false) return <Note tone="warn">{data.error}</Note>;
  const list = (data && data.routines) || [];
  const byPerson = {};
  list.forEach(r => { (byPerson[r.assignee] = byPerson[r.assignee] || []).push(r); });

  return (
    <>
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, margin: '0 2px 12px' }}>
        Each routine makes the same task for one person on its days. It arrives in their 10:30 list,
        Done needs a note, and an undone copy gets later and escalates. No new copy until the last one is done.
      </div>
      {err && <Note tone="bad">Could not load routines. {err}</Note>}
      {!list.length && !err && <Note>No routine jobs yet.</Note>}
      {Object.keys(byPerson).sort().map(name => (
        <div key={name} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, color: T.faint, letterSpacing: '0.08em', textTransform: 'uppercase',
                        margin: '0 2px 7px' }}>{name}</div>
          {byPerson[name].map(r => (
            <div key={r.id} onClick={() => setEdit(r)} style={{
              background: T.card, borderRadius: 16, padding: '12px 14px', marginBottom: 8,
              cursor: 'pointer', opacity: r.active ? 1 : 0.6
            }}>
              <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.4 }}>{r.description}</div>
              <div style={{ fontSize: 11.5, color: T.faint, marginTop: 4, lineHeight: 1.4 }}>
                {r.repeatText}{r.active ? (r.next ? ' · next ' + r.next : '') : ' · paused'}
                {r.lastStatus === 'open' && <span style={{ color: T.amber }}> · last copy still open</span>}
                {r.lastStatus === 'done' && <span style={{ color: T.green }}> · last copy done</span>}
              </div>
              {r.lastStatus === 'done' && r.lastNote && (
                <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, lineHeight: 1.4 }}>{r.lastNote}</div>
              )}
            </div>
          ))}
        </div>
      ))}
      <button onClick={() => setEdit({})} style={{ ...btn(true), width: '100%', padding: '13px 0', fontSize: 14 }}>
        + Routine job
      </button>
      {edit && <RoutineForm routine={edit} emps={emps} online={online}
                            onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function RoutineForm({ routine, emps, online, onClose, onSaved }) {
  const isNew = !routine.id;
  const people = emps.map(e => String(e.Name || e.name || '').trim()).filter(Boolean);
  const [f, setF] = React.useState({
    description: routine.description || '',
    assignee: routine.assignee || '',
    repeat: routine.repeat || 'Daily',
    days: routine.repeat === 'Weekly' ? String(routine.days || '').split(/[,\s]+/).filter(Boolean) : [],
    dom: routine.repeat === 'Monthly' ? String(routine.days || '1') : '1',
    priority: routine.priority || 'Medium'
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  // From the latest state, not this render's copy: two quick taps on Mon and
  // Thu kept only Thu when this read f.days.
  const toggleDay = d => setF(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));

  // Routines are shared settings, so they are saved only with signal.
  const send = async (name, ...args) => {
    if (!online) { setErr('Needs signal — routine jobs are not saved on the phone.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await call(name, ...args);
      if (!r || r.success === false) { setErr((r && r.error) || 'Could not save.'); return; }
      onSaved();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };
  const save = () => send('saveRoutine', {
    id: routine.id, description: f.description, assignee: f.assignee, repeat: f.repeat, priority: f.priority,
    days: f.repeat === 'Weekly' ? f.days : f.repeat === 'Monthly' ? f.dom : ''
  });

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, color: T.text, marginBottom: 14 }}>{isNew ? 'New routine job' : 'Routine job'}</div>
      <textarea autoFocus={isNew} style={{ ...field, minHeight: 72, resize: 'vertical' }}
                placeholder="e.g. Check GeM for new bids and mark each GO or NO-GO"
                value={f.description} onChange={e => set('description', e.target.value)} />
      <div style={label}>Who does it</div>
      <select value={f.assignee} onChange={e => set('assignee', e.target.value)} style={field}>
        <option value="">Choose a person</option>
        {people.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <div style={label}>How often</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {['Daily', 'Weekly', 'Monthly'].map(x => (
          <Pill key={x} on={f.repeat === x} onClick={() => set('repeat', x)}>
            {x === 'Daily' ? 'Every working day' : x}
          </Pill>
        ))}
      </div>
      {f.repeat === 'Weekly' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {WEEK.map(d => <Pill key={d} on={f.days.includes(d)} onClick={() => toggleDay(d)}>{d}</Pill>)}
        </div>
      )}
      {f.repeat === 'Monthly' && (
        <>
          <div style={label}>On day</div>
          <select value={f.dom} onChange={e => set('dom', e.target.value)} style={field}>
            {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: T.faint, margin: '-6px 2px 12px' }}>
            If that day is a Sunday or a holiday, it comes on the next working day.
          </div>
        </>
      )}
      <div style={label}>Priority</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['High', 'Medium', 'Low'].map(p => <Pill key={p} on={f.priority === p} onClick={() => set('priority', p)}>{p}</Pill>)}
      </div>
      {err && <div style={{ fontSize: 12.5, color: T.red, margin: '0 2px 10px' }}>{err}</div>}
      <button disabled={busy} onClick={save}
              style={{ ...btn(true, busy), width: '100%', padding: '13px 0', fontSize: 14 }}>
        {busy ? 'Saving…' : isNew ? 'Start this routine' : 'Save changes'}
      </button>
      {!isNew && (
        <button disabled={busy} onClick={() => send('setRoutineActive', routine.id, !routine.active)}
                style={{ ...btn(false, busy), width: '100%', padding: '13px 0', fontSize: 14, marginTop: 8 }}>
          {routine.active ? 'Pause it' : 'Resume it'}
        </button>
      )}
      {isNew && (
        <div style={{ fontSize: 11.5, color: T.faint, margin: '10px 2px 0', lineHeight: 1.5 }}>
          The first copy is made on its next working day and arrives in their 10:30 list.
        </div>
      )}
    </Sheet>
  );
}

// ── Team ───────────────────────────────────────────────────────────────────

function TeamView({ team, teamErr, blank, me, msg, onEmail, onPick, onGive }) {
  if (!team) {
    return (
      <Note tone="warn">
        The team view needs the latest server update{teamErr ? ' (' + teamErr + ')' : ''}.
        Every open task is under Open in the meantime.
      </Note>
    );
  }
  const busy = team.people.filter(p => p.open > 0);
  const idle = team.people.filter(p => !p.open);
  const stray = (team.unmatched || []).reduce((n, u) => n + u.count, 0);
  const u = team.unowned || {};
  const many = (n, one, more) => n + ' ' + (n === 1 ? one : more);
  const unowned = [u.leads && many(u.leads, 'lead', 'leads'), u.docs && many(u.docs, 'tender document', 'tender documents'),
                   u.tenders && many(u.tenders, 'bid closing this week', 'bids closing this week'),
                   u.complaints && many(u.complaints, 'complaint', 'complaints')]
                  .filter(Boolean);

  return (
    <>
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, margin: '0 2px 12px' }}>
        {team.on
          ? 'Each person’s list goes at 10:30, Monday to Saturday; you get the WhatsApp buttons by email then.'
          : 'The 10:30 lists are off — nothing goes to staff by itself. WhatsApp below opens with their whole list typed in.'}
        {' '}Counts cover tasks, follow-ups, complaints, tender documents and bids.
      </div>

      {!busy.length && <Note>Nobody has anything due this week.</Note>}

      {busy.map(p => (
        <div key={p.name} style={{ background: T.card, borderRadius: 18, padding: '13px 14px', marginBottom: 9 }}>
          <div onClick={() => onPick(p.name)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: T.text }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: T.faint }}>Tasks ›</div>
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4, color: T.sub, lineHeight: 1.5 }}>
              {p.open} open
              {p.overdue > 0 && <span style={{ color: T.red }}> · {p.overdue} late</span>}
              {p.esc2 > 0 && <span style={{ color: T.red }}> · {p.esc2} at 5+ days</span>}
              {p.dueToday > 0 && <span style={{ color: T.amber }}> · {p.dueToday} today</span>}
              {p.unacked > 0 && <span style={{ color: T.blue }}> · {p.unacked} waiting for Got it</span>}
            </div>
            <div style={{ fontSize: 11.5, marginTop: 3, color: p.reached ? T.green : T.faint }}>
              {p.reached || 'Not reminded today'}
            </div>
          </div>
          {norm(p.name) === me ? (
            <div style={{ marginTop: 11 }}>
              <button onClick={() => onPick(p.name)} style={{ ...btn(false), width: '100%' }}>
                Your own list
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
              {p.waLink
                ? <a href={p.waLink} target="_blank" rel="noopener noreferrer"
                     onClick={() => logTap(p.name, 'manual')} style={btn(true)}>WhatsApp</a>
                : <span style={btn(false, true)}>No mobile no.</span>}
              {p.hasEmail
                ? <button onClick={() => onEmail(p.name)} style={btn(false)}>Email</button>
                : <span style={btn(false, true)}>No own email</span>}
            </div>
          )}
          {msg[p.name] && (
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 8, lineHeight: 1.45 }}>{msg[p.name]}</div>
          )}
        </div>
      ))}

      {idle.length > 0 && (
        <div style={{ margin: '16px 2px 6px' }}>
          <div style={{ fontSize: 10, color: T.faint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Nothing due
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {idle.map(p => (
              <button key={p.name} onClick={() => onGive(p.name)} style={{
                background: T.raised, color: T.text, border: 'none', borderRadius: 999,
                padding: '7px 12px', fontSize: 12.5, cursor: 'pointer'
              }}>{p.name} <span style={{ color: T.accent }}>+ task</span></button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {unowned.length > 0 && (
          <Note tone="warn">Nobody owns {unowned.join(', ')}. Until someone does, no list mentions them.</Note>
        )}
        {stray > 0 && (
          <Note tone="warn">
            {stray} open item{stray === 1 ? ' is' : 's are'} held by a name no current employee has
            ({team.unmatched.map(x => x.name + ' ' + x.count).join(', ')}). They reach nobody until reassigned.
          </Note>
        )}
        {team.unassigned > 0 && (
          <Note>{team.unassigned} open task{team.unassigned === 1 ? ' has' : 's have'} nobody assigned.</Note>
        )}
        {blank > 0 && (
          <Note>
            {blank} open task{blank === 1 ? ' has' : 's have'} no description — added from the phone
            before 18 Nov, when this form lost the text. Close them on the desktop and re-enter what they were.
          </Note>
        )}
      </div>
    </>
  );
}

// ── Lists ──────────────────────────────────────────────────────────────────

function TaskList({ list, done, isMgr, showWho, me, busy, onOpen, onGotIt, empty }) {
  if (!list.length) return <Note>{empty}</Note>;
  return list.slice(0, 200).map((t, i) => {
    const d = dueOf(t);
    const owner = whoOf(t);
    const mine = norm(owner) === me;
    const ack = !done && needsAck(t, me);
    const moves = parseInt(t.DueMoves, 10) || 0;
    return (
      <div key={t.TaskID || i} onClick={() => onOpen(t, 'view')} style={{
        background: T.card, borderRadius: 16, padding: '12px 14px', marginBottom: 8,
        display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
        borderLeft: d.level === 2 && !done ? '3px solid ' + T.red : 'none'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.4, color: done ? T.faint : T.text,
                        textDecoration: done ? 'line-through' : 'none' }}>{textOf(t) || '(no description)'}</div>
          <div style={{ fontSize: 11.5, marginTop: 4, color: T.faint, lineHeight: 1.4 }}>
            {!done && <span style={{ color: d.color }}>{d.label}</span>}
            {done && <span>Closed {String(t.ClosureDate || '').slice(0, 10)}</span>}
            {norm(t.Priority) === 'high' && <span style={{ color: T.amber }}> · High</span>}
            {moves > 0 && !done && <span> · moved {moves}×</span>}
            {norm(t.Category) === 'routine' && <span> · routine</span>}
            {showWho && <span> · {owner || 'nobody'}</span>}
            {ack && <span style={{ color: T.blue }}> · new</span>}
          </div>
          {done && t.DoneNote && (
            <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4, lineHeight: 1.4 }}>{t.DoneNote}</div>
          )}
        </div>
        {!done && ack && (
          <button disabled={!!busy[t.TaskID]} onClick={e => { e.stopPropagation(); onGotIt(t); }} style={{
            background: T.blueBg, color: T.blue, border: 'none', borderRadius: 10,
            padding: '8px 11px', fontSize: 12, flexShrink: 0, cursor: 'pointer'
          }}>{busy[t.TaskID] ? '…' : 'Got it'}</button>
        )}
        {!done && !ack && (mine || isMgr) && (
          <button disabled={!!busy[t.TaskID]} onClick={e => { e.stopPropagation(); onOpen(t, 'done'); }} style={{
            background: T.greenBg, color: T.green, border: 'none', borderRadius: 10,
            padding: '8px 11px', fontSize: 12, flexShrink: 0, cursor: 'pointer'
          }}>{busy[t.TaskID] ? '…' : 'Done'}</button>
        )}
      </div>
    );
  });
}

// ── One task ───────────────────────────────────────────────────────────────

function TaskSheet({ task, startMode, user, isMgr, me, emps, empByName, online, act, onClose }) {
  const [mode, setMode] = React.useState(startMode || 'view');     // view | done | move | reassign | told
  const [note, setNote] = React.useState('');
  const [date, setDate] = React.useState(ymd(midnight(1)));
  const [reason, setReason] = React.useState('');
  const [to, setTo] = React.useState('');
  const [err, setErr] = React.useState('');
  const [working, setWorking] = React.useState(false);
  const [told, setTold] = React.useState(null);

  const t = task;
  const d = dueOf(t);
  const owner = whoOf(t);
  const mine = norm(owner) === me;
  const closed = isClosed(t);
  const ack = needsAck(t, me);
  const canEdit = !closed && (mine || isMgr);
  const people = emps.map(e => String(e.Name || e.name || '').trim()).filter(Boolean)
                     .filter(n => norm(n) !== norm(owner));
  const phone = isMgr && !mine && !closed ? phoneOf(empByName[norm(owner)]) : '';
  const remind = phone ? wa(phone,
    'Hi ' + first(owner) + ' — reminder from ' + first(user.name) + ':\n' + textOf(t) +
    '\n(' + (d.days === null ? 'no due date' : d.label.toLowerCase()) + ')\n\nMark it done in the app: ' + APP_URL) : '';

  const run = async (name, args, lbl, queueable, after) => {
    setErr(''); setWorking(true);
    const r = await act(name, args, lbl, queueable);
    setWorking(false);
    if (!r || r.success === false) { setErr((r && r.error) || 'Could not save.'); return; }
    if (after) after(r); else onClose();
  };

  const quick = [['Tomorrow', 1], ['In 3 days', 3], ['In a week', 7]];

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 17, color: T.text, lineHeight: 1.35 }}>{textOf(t) || '(no description)'}</div>
      <div style={{ fontSize: 12, color: T.sub, marginTop: 6, lineHeight: 1.6 }}>
        {closed ? 'Closed ' + String(t.ClosureDate || '').slice(0, 10) : <span style={{ color: d.color }}>{d.label}</span>}
        {' · '}{owner || 'nobody'}{t.Priority ? ' · ' + t.Priority : ''}
        <br />
        Given by {t.CreatedBy || 'unknown'}{t.CreatedDate ? ' on ' + String(t.CreatedDate).slice(0, 10) : ''}
        {t.AckAt ? ' · Got it ' + String(t.AckAt).slice(0, 16) : ack ? ' · waiting for Got it' : ''}
        {parseInt(t.DueMoves, 10) > 0 ? ' · date moved ' + t.DueMoves + '×' : ''}
      </div>
      {closed && t.DoneNote && (
        <div style={{ background: T.card, borderRadius: 12, padding: '10px 12px', marginTop: 12,
                      fontSize: 13, color: T.text, lineHeight: 1.5 }}>{t.DoneNote}</div>
      )}
      {d.level === 2 && !closed && isMgr && (
        <Note tone="bad">5+ days late. Extend it, hand it to someone else, or close it with a note.</Note>
      )}

      <div style={{ height: 14 }} />

      {mode === 'view' && !closed && (
        <div style={{ display: 'grid', gap: 8 }}>
          {ack && (
            <button disabled={working} onClick={() => run('ackTask', [t.TaskID], 'Got it — ' + textOf(t).slice(0, 40), true)}
                    style={{ ...btn(true, working), padding: '13px 0', fontSize: 14 }}>Got it</button>
          )}
          {canEdit && (
            <button onClick={() => setMode('done')} style={{ ...btn(!ack), padding: '13px 0', fontSize: 14 }}>
              {mine ? 'Done' : 'Close it'}
            </button>
          )}
          {canEdit && (
            <button onClick={() => setMode('move')} style={{ ...btn(false), padding: '13px 0', fontSize: 14 }}>Move date</button>
          )}
          {isMgr && !mine && (
            <button onClick={() => setMode('reassign')} style={{ ...btn(false), padding: '13px 0', fontSize: 14 }}>
              Give to someone else
            </button>
          )}
          {remind && (
            <a href={remind} target="_blank" rel="noopener noreferrer" onClick={() => logTap(owner, 'task')}
               style={{ ...btn(false), padding: '13px 0', fontSize: 14 }}>Remind {first(owner)} on WhatsApp</a>
          )}
        </div>
      )}

      {mode === 'done' && (
        <>
          <div style={label}>What was done?</div>
          <textarea autoFocus style={{ ...field, minHeight: 80, resize: 'vertical' }}
                    placeholder="e.g. Sent by DTDC, docket 4471 — they confirmed receipt"
                    value={note} onChange={e => setNote(e.target.value)} />
          <button disabled={working || !note.trim()}
                  onClick={() => run('closeTask', [t.TaskID, note.trim()], 'Done — ' + textOf(t).slice(0, 40), true)}
                  style={{ ...btn(true, working || !note.trim()), width: '100%', padding: '13px 0', fontSize: 14 }}>
            {working ? 'Saving…' : 'Mark done'}
          </button>
        </>
      )}

      {mode === 'move' && (
        <>
          <div style={label}>New date</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
            {quick.map(([l, n]) => (
              <Pill key={l} on={date === ymd(midnight(n))} onClick={() => setDate(ymd(midnight(n)))}>{l}</Pill>
            ))}
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...field, colorScheme: 'dark' }} />
          <div style={label}>Why is it moving?</div>
          <input style={field} placeholder="e.g. Waiting for the principal's signature"
                 value={reason} onChange={e => setReason(e.target.value)} />
          <div style={{ fontSize: 11.5, color: T.faint, margin: '-4px 2px 12px' }}>
            The manager sees every move and the reason.
          </div>
          <button disabled={working || !reason.trim() || !date}
                  onClick={() => run('moveTaskDue', [t.TaskID, date, reason.trim()], 'Move date — ' + textOf(t).slice(0, 40), true)}
                  style={{ ...btn(true, working || !reason.trim() || !date), width: '100%', padding: '13px 0', fontSize: 14 }}>
            {working ? 'Saving…' : 'Move date'}
          </button>
        </>
      )}

      {mode === 'reassign' && (
        <>
          <div style={label}>Give it to</div>
          <select value={to} onChange={e => setTo(e.target.value)} style={field}>
            <option value="">Choose a person</option>
            {people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {!online && <Note tone="warn">Needs signal — handing work over is not saved on the phone.</Note>}
          <button disabled={working || !to || !online}
                  onClick={() => run('reassignTask', [t.TaskID, to], 'Reassign', false,
                                     r => { setTold({ name: to, notify: r.notify || null }); setMode('told'); })}
                  style={{ ...btn(true, working || !to || !online), width: '100%', padding: '13px 0', fontSize: 14 }}>
            {working ? 'Saving…' : 'Give it to ' + (first(to) || '…')}
          </button>
        </>
      )}

      {mode === 'told' && told && (
        <>
          <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, marginBottom: 14 }}>
            Now with {told.name}. They need to tap Got it.
            {told.notify && told.notify.channel === 'email' ? ' They have been emailed.' : ''}
          </div>
          {told.notify && told.notify.waLink && (
            <a href={told.notify.waLink} target="_blank" rel="noopener noreferrer"
               onClick={() => logTap(told.name, 'assigned')}
               style={{ ...btn(true), padding: '13px 0', fontSize: 14, marginBottom: 10 }}>
              Tell {first(told.name)} on WhatsApp
            </a>
          )}
          <button onClick={onClose} style={{ ...btn(false), width: '100%', padding: '13px 0', fontSize: 14 }}>Done</button>
        </>
      )}

      {err && <div style={{ fontSize: 12.5, color: T.red, margin: '10px 2px 0' }}>{err}</div>}
      {mode !== 'view' && mode !== 'told' && (
        <button onClick={() => { setMode('view'); setErr(''); }} style={{
          background: 'none', border: 'none', color: T.faint, fontSize: 12.5, marginTop: 12, cursor: 'pointer'
        }}>‹ Back</button>
      )}
    </Sheet>
  );
}

// ── New task ───────────────────────────────────────────────────────────────

function TaskAdd({ user, isMgr, online, emps, preset, onQueued, onClose, onSaved }) {
  const people = emps.map(e => String(e.Name || e.name || '').trim()).filter(Boolean);
  const [f, setF] = React.useState({
    description: '', dueDate: ymd(midnight()), priority: 'Medium',
    assignee: preset || user.name
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [after, setAfter] = React.useState(null);      // the server's answer, once saved
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const quick = [['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['In a week', 7]];

  const save = async () => {
    const text = f.description.trim();
    if (!text) { setErr('What needs doing?'); return; }
    setBusy(true); setErr('');
    // The names addTask reads. See the note at the top of this file.
    const args = [{ description: text, dueDate: f.dueDate, priority: f.priority,
                    assignee: f.assignee || user.name }, user.name];
    try {
      if (!navigator.onLine) throw new Error('offline');
      const r = await call('addTask', ...args);
      if (r && r.success === false) { setErr(r.error || 'Could not save.'); return; }
      onSaved();
      setAfter({ assignee: args[0].assignee, notify: (r && r.notify) || null, offline: false });
    } catch {
      await enqueue('addTask', args, 'New task — ' + text.slice(0, 40));
      onQueued && onQueued();
      onSaved();
      setAfter({ assignee: args[0].assignee, notify: null, offline: true });
    } finally { setBusy(false); }
  };

  if (after) {
    const forMe = norm(after.assignee) === norm(user.name);
    const n = after.notify || {};
    return (
      <Sheet onClose={onClose}>
        <div style={{ fontSize: 18, color: T.text, marginBottom: 6 }}>
          {after.offline ? 'Saved on this phone.' : 'Saved.'}
        </div>
        <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, marginBottom: 16 }}>
          {forMe ? 'It is on your list.' : 'Given to ' + after.assignee + '. They need to tap Got it. '}
          {!forMe && after.offline && 'It goes to the ERP when you have signal; tell them yourself in the meantime.'}
          {!forMe && !after.offline && (n.channel === 'email'
            ? 'They have been emailed.'
            : 'They have not been told yet' + (n.reason ? ' — ' + n.reason : '') + '.')}
        </div>
        {!forMe && n.waLink && (
          <a href={n.waLink} target="_blank" rel="noopener noreferrer"
             onClick={() => logTap(after.assignee, 'assigned')}
             style={{ ...btn(true), padding: '13px 0', fontSize: 14, marginBottom: 10 }}>
            Tell {first(after.assignee)} on WhatsApp
          </a>
        )}
        <button onClick={onClose} style={{ ...btn(false), width: '100%', padding: '13px 0', fontSize: 14 }}>
          Done
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, color: T.text, marginBottom: 14 }}>New task</div>

      <textarea autoFocus style={{ ...field, minHeight: 84, resize: 'vertical' }}
                placeholder="What needs doing?"
                value={f.description} onChange={e => set('description', e.target.value)} />

      {isMgr && (
        <>
          <div style={label}>For</div>
          <select value={f.assignee} onChange={e => set('assignee', e.target.value)} style={field}>
            {!people.some(p => norm(p) === norm(user.name)) && <option value={user.name}>{user.name} (me)</option>}
            {people.map(p => <option key={p} value={p}>{p}{norm(p) === norm(user.name) ? ' (me)' : ''}</option>)}
          </select>
        </>
      )}

      <div style={label}>Due</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
        {quick.map(([l, n]) => (
          <Pill key={l} on={f.dueDate === ymd(midnight(n))} onClick={() => set('dueDate', ymd(midnight(n)))}>{l}</Pill>
        ))}
        <Pill on={!f.dueDate} onClick={() => set('dueDate', '')}>No date</Pill>
      </div>
      <input type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)}
             style={{ ...field, colorScheme: 'dark' }} />

      <div style={label}>Priority</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['High', 'Medium', 'Low'].map(p => (
          <Pill key={p} on={f.priority === p} onClick={() => set('priority', p)}>{p}</Pill>
        ))}
      </div>

      {!online && <Note tone="warn">Offline — kept on this phone until you have signal.</Note>}
      {err && <div style={{ fontSize: 12.5, color: T.red, margin: '0 2px 10px' }}>{err}</div>}

      <button disabled={busy} onClick={save} style={{
        ...btn(true, busy), width: '100%', padding: '14px 0', fontSize: 15
      }}>{busy ? 'Saving…' : 'Save task'}</button>
    </Sheet>
  );
}
