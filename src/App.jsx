/**
 * The shell: session, connection state, the outbox drain, and the bottom nav.
 *
 * Everything that is true across every screen lives here, so no individual
 * screen has to remember to check whether it is online or whether there is
 * queued work — forgetting that in one place is how an offline app starts
 * lying to the person holding it.
 */
import React from 'react';
import { Icon, Spin, StatusStrip, PRIMARY, initials } from './components/tiles.jsx';
import { checkSession, getToken, setToken, sendQueued, NeedsLogin, Offline } from './api.js';
import { outbox, outboxSet, outboxRemove, pendingCount } from './db.js';
import { T } from './theme.js';
import Login from './screens/Login.jsx';
import Home from './screens/Home.jsx';
import Business from './screens/Business.jsx';
import Leads from './screens/Leads.jsx';
import Tasks from './screens/Tasks.jsx';
import More from './screens/More.jsx';

/**
 * Managers get Business first; everyone else never sees it.
 *
 * The dashboard is company-wide money — billing, receivables, deposits — and an
 * engineer opening the app in a hospital corridor needs their own day, not the
 * receivable book. Role decides the tab set rather than hiding panels inside a
 * shared screen, because a screen that is mostly hidden for most users is a
 * screen nobody designed for either of them.
 */
const TABS_MGR = [
  { id: 'business', label: 'Business', icon: 'chart' },
  { id: 'home',     label: 'Home',     icon: 'house' },
  { id: 'leads',    label: 'Leads',    icon: 'user-plus' },
  { id: 'tasks',    label: 'Tasks',    icon: 'list-check' },
  { id: 'more',     label: 'More',     icon: 'ellipsis' }
];

const TABS_STAFF = [
  { id: 'home',   label: 'Home',   icon: 'house' },
  { id: 'leads',  label: 'Leads',  icon: 'user-plus' },
  { id: 'tasks',  label: 'Tasks',  icon: 'list-check' },
  { id: 'more',   label: 'More',   icon: 'ellipsis' }
];

export default function App() {
  const [user, setUser] = React.useState(null);
  const [booting, setBooting] = React.useState(true);
  const [tab, setTab] = React.useState(null);   // set once the role is known
  const [online, setOnline] = React.useState(navigator.onLine);
  const [pending, setPending] = React.useState(0);

  // ── Session ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let dead = false;
    (async () => {
      if (!getToken()) { setBooting(false); return; }
      try {
        const r = await checkSession();   // already unwrapped to the user
        if (!dead) setUser(r);
      } catch (e) {
        // Offline at startup with a stored token: let them in and work from
        // the cache. Refusing here would make the app useless in exactly the
        // situation it exists for.
        if (!dead && e instanceof Offline) setUser({ offlineResume: true });
      } finally { if (!dead) setBooting(false); }
    })();
    return () => { dead = true; };
  }, []);

  // ── Connection ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    const up = () => { setOnline(true); drain(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const refreshPending = React.useCallback(async () => setPending(await pendingCount()), []);
  React.useEffect(() => { refreshPending(); }, [refreshPending]);

  /**
   * Send queued work, one item at a time.
   *
   * Sequential on purpose: the server is three to six seconds a call and a
   * burst of parallel requests was observed to fail outright. Each item
   * carries its own id, and the server rejects an id it has already written,
   * so a retry after a dropped connection cannot create the same visit twice.
   */
  const drain = React.useCallback(async () => {
    if (!navigator.onLine || !getToken()) return;
    const items = (await outbox()).filter(i => i.state !== 'synced');
    for (const item of items) {
      try {
        await outboxSet(item.id, { state: 'sending' });
        await sendQueued(item.id, item.call, item.args || []);
        await outboxRemove(item.id);
      } catch (e) {
        if (e instanceof NeedsLogin) {
          // Hold the queue rather than discard it. The work is still valid;
          // only the session is not.
          await outboxSet(item.id, { state: 'pending', error: 'Sign in again to send this' });
          setUser(null);
          break;
        }
        await outboxSet(item.id, {
          state: 'pending',
          attempts: (item.attempts || 0) + 1,
          error: String(e.message || e)
        });
        if (e instanceof Offline) break;      // no point trying the rest
      }
      await refreshPending();
    }
    await refreshPending();
  }, [refreshPending]);

  React.useEffect(() => { if (user && online) drain(); }, [user, online, drain]);

  if (booting) return <Spin />;
  if (!user) return <Login onIn={u => { setUser(u); drain(); }} />;

  const isMgr = String(user.role || '').toLowerCase().indexOf('manager') >= 0 ||
                String(user.role || '').toLowerCase().indexOf('admin') >= 0;
  const tabs = isMgr ? TABS_MGR : TABS_STAFF;
  const active = tab && tabs.some(t => t.id === tab) ? tab : tabs[0].id;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 76 }}>
      <header style={{
        background: T.bg, padding: 'calc(0.9rem + env(safe-area-inset-top)) 1rem 0.8rem',
        display: 'flex', alignItems: 'center', gap: '0.7rem'
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: T.accent, color: T.onAccent,
          display: 'grid', placeItems: 'center', fontSize: '0.85rem'
        }}>{initials(user.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', color: T.text, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name || 'SEM Trainers'}
          </div>
          <div style={{ fontSize: '0.72rem', color: T.sub }}>{user.role || ''}</div>
        </div>
        <button onClick={() => { setToken(''); setUser(null); }} style={{
          background: T.raised, border: 'none', color: T.sub,
          borderRadius: 12, width: 40, height: 40
        }} aria-label="Sign out"><Icon name="sign-out" /></button>
      </header>

      <StatusStrip offline={!online} pending={pending} />

      <main style={{ padding: '0 0.75rem 0.9rem' }}>
        {active === 'business' && <Business online={online} />}
        {active === 'home'     && <Home  user={user} isMgr={isMgr} online={online} />}
        {active === 'leads'    && <Leads user={user} online={online} onQueued={refreshPending} />}
        {active === 'tasks'    && <Tasks user={user} isMgr={isMgr} online={online} onQueued={refreshPending} />}
        {active === 'more'     && <More  user={user} online={online} onDrain={drain} onQueued={refreshPending} />}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#121519',
        borderTop: '1px solid ' + T.line, display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        {tabs.map(t => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'none', border: 'none', padding: '0.5rem 0 0.6rem',
              color: on ? T.text : T.faint, cursor: 'pointer'
            }}>
              {/* The active tab wears the accent as a pill rather than tinted
                  ink: at 10px a colour change alone is not a reliable signal in
                  daylight, and the filled shape reads at a glance. */}
              <div style={{
                background: on ? T.accent : 'transparent', borderRadius: 999,
                margin: '0 14px', padding: '3px 0', color: on ? T.onAccent : T.faint
              }}>
                <Icon name={t.icon} size={17} />
              </div>
              <div style={{ fontSize: '0.6rem', marginTop: 3 }}>{t.label}</div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
