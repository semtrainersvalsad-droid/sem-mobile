/**
 * Tasks — who has what, and reminding each of them.
 *
 * A manager opens on the TEAM: one row per person with what they have open and
 * late, whether they have been reminded today, and two ways to remind them.
 *
 *   WhatsApp — opens WhatsApp with that person's whole list already typed.
 *              Costs nothing. Somebody still has to press Send, and WhatsApp
 *              tells nobody whether they did, so the ERP records "opened" and
 *              never "sent".
 *   Email    — the ERP sends it. Only for people with an address on file.
 *
 * Staff open on their own list.
 *
 * The add form used to send Task / DueDate / AssignedTo. The server reads
 * description / dueDate / assignee, so every task added here before 18 Nov
 * 2026 was saved with no words and no date. It now sends the server's names,
 * and the server accepts both, so anything still queued offline lands whole.
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

/** { days, label, color } — days is null when there is no usable date. */
function dueOf(t) {
  const raw = String(t.DueDate || '').trim();
  const d = strictDate(raw);
  if (!d) return { days: null, label: raw ? 'Date unreadable' : 'No date', color: T.faint };
  const days = Math.round((d - midnight()) / 86400000);
  if (days < 0) return { days, label: -days + (days === -1 ? ' day late' : ' days late'), color: T.red };
  if (days === 0) return { days, label: 'Today', color: T.amber };
  if (days === 1) return { days, label: 'Tomorrow', color: T.text };
  return { days, label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
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

// ── Screen ─────────────────────────────────────────────────────────────────

export default function Tasks({ user, isMgr, online, onQueued }) {
  const [data, setData] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [view, setView] = React.useState(isMgr ? 'team' : 'open');
  const [who, setWho] = React.useState('');
  const [adding, setAdding] = React.useState(null);     // null, or { assignee }
  const [closing, setClosing] = React.useState({});
  const [msg, setMsg] = React.useState({});             // per-person result line

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

  const open = tasks.filter(t => !isClosed(t) && textOf(t));
  const done = tasks.filter(t => isClosed(t)).sort((a, b) =>
    String(b.ClosureDate || b.LastModified || '').localeCompare(String(a.ClosureDate || a.LastModified || '')));
  const blank = tasks.filter(t => !isClosed(t) && !textOf(t)).length;

  const scoped = list => {
    if (!isMgr) return list.filter(t => norm(whoOf(t)) === me || !whoOf(t));
    return who ? list.filter(t => norm(whoOf(t)) === norm(who)) : list;
  };

  const close = async (t) => {
    const id = t.TaskID;
    setClosing(c => ({ ...c, [id]: true }));
    const args = [id, { Status: 'Closed' }, user.name];
    try {
      if (!navigator.onLine) throw new Error('offline');
      await call('updateTask', ...args);
    } catch {
      await enqueue('updateTask', args, 'Close task — ' + textOf(t).slice(0, 40));
      onQueued && onQueued();
    } finally {
      setClosing(c => ({ ...c, [id]: false }));
      load();
    }
  };

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

  const views = isMgr ? [['team', 'Team'], ['open', 'Open'], ['done', 'Done']]
                      : [['open', 'My tasks'], ['done', 'Done']];

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {views.map(([id, label]) => (
          <Pill key={id} on={view === id} onClick={() => { setView(id); if (id === 'team') setWho(''); }}>
            {label}{id === 'open' ? ' ' + scoped(open).length : ''}
          </Pill>
        ))}
        {who && view !== 'team' && (
          <Pill on onClick={() => setWho('')}>{who} ✕</Pill>
        )}
      </div>

      <StaleNote at={stale} error={staleErr} onRetry={load} />
      {data.loadErr && <Note tone="bad">Could not load tasks. {data.loadErr}</Note>}

      {view === 'team' && (
        <TeamView team={team} teamErr={data.teamErr} open={open} blank={blank} me={me}
                  msg={msg} onEmail={emailPerson}
                  onPick={name => { setWho(name); setView('open'); }}
                  onGive={name => setAdding({ assignee: name })} />
      )}

      {view === 'open' && (
        <TaskList list={scoped(open).sort(byDue)} isMgr={isMgr} showWho={isMgr && !who}
                  me={me} empByName={empByName} user={user} closing={closing} onClose={close}
                  empty={who ? first(who) + ' has nothing open.' : isMgr ? 'No open tasks.' : 'Nothing assigned to you.'} />
      )}

      {view === 'done' && (
        <TaskList list={scoped(done).slice(0, 60)} done isMgr={isMgr} showWho={isMgr && !who}
                  me={me} empByName={empByName} user={user} closing={closing}
                  empty="Nothing closed yet." />
      )}

      {adding && (
        <TaskAdd user={user} isMgr={isMgr} online={online} emps={emps} preset={adding.assignee}
                 onQueued={onQueued} onClose={() => setAdding(null)}
                 onSaved={() => { load(); }} />
      )}

      <button onClick={() => setAdding({ assignee: '' })} style={{
        position: 'fixed', right: 18, bottom: 88, zIndex: 20,
        background: T.accent, color: T.onAccent, border: 'none',
        borderRadius: 999, padding: '14px 20px', fontSize: 14,
        boxShadow: '0 6px 20px rgba(0,0,0,0.45)', cursor: 'pointer'
      }}>+ Task</button>
      <div style={{ height: 70 }} />
    </>
  );
}

// ── Team ───────────────────────────────────────────────────────────────────

function TeamView({ team, teamErr, open, blank, me, msg, onEmail, onPick, onGive }) {
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

  return (
    <>
      <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5, margin: '0 2px 12px' }}>
        {team.on
          ? 'Each person with an email gets their own list at about 8 am.'
          : 'Daily reminder emails are off — nothing goes to staff by itself. WhatsApp below opens with their list typed in.'}
      </div>

      {!busy.length && <Note>Nobody has an open task.</Note>}

      {busy.map(p => (
        <div key={p.name} style={{ background: T.card, borderRadius: 18, padding: '13px 14px', marginBottom: 9 }}>
          <div onClick={() => onPick(p.name)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 15, color: T.text }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: T.faint }}>See tasks ›</div>
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4, color: T.sub }}>
              {p.open} open
              {p.overdue > 0 && <span style={{ color: T.red }}> · {p.overdue} late</span>}
              {p.dueToday > 0 && <span style={{ color: T.amber }}> · {p.dueToday} today</span>}
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
              : <span style={btn(false, true)}>No email</span>}
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
            Nothing open
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

      {(stray > 0 || team.unassigned > 0 || blank > 0) && (
        <div style={{ marginTop: 14 }}>
          {stray > 0 && (
            <Note tone="warn">
              {stray} open task{stray === 1 ? ' is' : 's are'} assigned to a name no current employee has
              ({team.unmatched.map(u => u.name + ' ' + u.count).join(', ')}). They reach nobody until reassigned.
            </Note>
          )}
          {team.unassigned > 0 && (
            <Note>{team.unassigned} open task{team.unassigned === 1 ? ' has' : 's have'} nobody assigned.</Note>
          )}
          {blank > 0 && (
            <Note>
              {blank} open task{blank === 1 ? ' has' : 's have'} no description — added from the phone
              before 18 Nov, when this form lost the text. They cannot be recovered; close them on the desktop
              and re-enter what they were.
            </Note>
          )}
        </div>
      )}
    </>
  );
}

// ── Lists ──────────────────────────────────────────────────────────────────

function TaskList({ list, done, isMgr, showWho, me, empByName, user, closing, onClose, empty }) {
  if (!list.length) return <Note>{empty}</Note>;
  return list.slice(0, 200).map((t, i) => {
    const d = dueOf(t);
    const owner = whoOf(t);
    const mine = norm(owner) === me;
    const phone = isMgr && !mine && !done ? phoneOf(empByName[norm(owner)]) : '';
    const remind = phone ? wa(phone,
      'Hi ' + first(owner) + ' — reminder from ' + first(user.name) + ':\n' + textOf(t) +
      '\n(' + (d.days === null ? 'no due date' : d.label.toLowerCase()) + ')\n\nMark it done in the app: ' + APP_URL) : '';
    return (
      <div key={t.TaskID || i} style={{
        background: T.card, borderRadius: 16, padding: '12px 14px', marginBottom: 8,
        display: 'flex', gap: 10, alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.4, color: done ? T.faint : T.text,
                        textDecoration: done ? 'line-through' : 'none' }}>{textOf(t) || '(no description)'}</div>
          <div style={{ fontSize: 11.5, marginTop: 4, color: T.faint, lineHeight: 1.4 }}>
            {!done && <span style={{ color: d.color }}>{d.label}</span>}
            {done && <span>Closed {String(t.ClosureDate || '').slice(0, 10)}</span>}
            {norm(t.Priority) === 'high' && <span style={{ color: T.amber }}> · High</span>}
            {showWho && <span> · {owner || 'nobody'}</span>}
          </div>
          {remind && (
            <a href={remind} target="_blank" rel="noopener noreferrer"
               onClick={() => logTap(owner, 'task')}
               style={{ display: 'inline-block', marginTop: 7, fontSize: 12, color: T.accent,
                        textDecoration: 'none' }}>Remind on WhatsApp ↗</a>
          )}
        </div>
        {!done && (
          <button disabled={!!closing[t.TaskID]} onClick={() => onClose(t)} style={{
            background: T.greenBg, color: T.green, border: 'none', borderRadius: 10,
            padding: '8px 11px', fontSize: 12, flexShrink: 0, cursor: 'pointer'
          }}>{closing[t.TaskID] ? '…' : 'Done'}</button>
        )}
      </div>
    );
  });
}

// ── New task ───────────────────────────────────────────────────────────────

const field = {
  width: '100%', boxSizing: 'border-box', background: T.card, color: T.text,
  border: '1px solid ' + T.line, borderRadius: 13, padding: '12px 13px',
  fontSize: 14.5, outline: 'none', marginBottom: 12, fontFamily: 'inherit'
};

const label = { fontSize: 10.5, color: T.faint, letterSpacing: '0.08em',
                textTransform: 'uppercase', margin: '4px 2px 7px' };

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
          {forMe ? 'It is on your list.' : 'Assigned to ' + after.assignee + '. '}
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
