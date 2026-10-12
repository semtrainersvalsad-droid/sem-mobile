/**
 * The SEM Mobile design system.
 *
 * Dark, deliberately. The original was dark ink on light colour tiles, chosen
 * for daylight glanceability, and the objection to dark on a phone used
 * outdoors is real. The answer is contrast rather than brightness: pure white
 * on near-black, and a secondary grey (#99A3B0) that sits well above the
 * #6B7280 most dark themes settle for. Anything dimmer than `sub` fails in
 * sunlight, which is why there is no third text colour to reach for.
 *
 * Every surface and ink value lives in theme.js, and this file re-exports the
 * status pairs from it. One palette, one place — a colour invented at a call
 * site is how a design system quietly stops being one.
 */
import React from 'react';
import { T } from '../theme.js';

export const MT = {
  teal:    { bg: T.greenBg, fg: T.green,  sub: '#7FCFB0' },
  blue:    { bg: T.blueBg,  fg: T.blue,   sub: '#93C9E8' },
  amber:   { bg: T.amberBg, fg: T.amber,  sub: '#D9A862' },
  red:     { bg: T.redBg,   fg: T.red,    sub: '#E09A93' },
  neutral: { bg: T.raised,  fg: T.text,   sub: T.sub }
};

export const PRIMARY = T.accent;

/**
 * Icons, inline.
 *
 * The old mobile view used Font Awesome, loaded by Index.html. A CDN icon font
 * is the wrong choice for an app whose purpose is working without a
 * connection: offline the font never arrives and every control becomes a blank
 * square. These are drawn from paths in the bundle, so they are there whenever
 * the app is.
 */
const PATHS = {
  home:        'M12 3 2 12h3v8h6v-6h2v6h6v-8h3z',
  'user-plus': 'M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM6 10V7H4v3H1v2h3v3h2v-3h3v-2zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z',
  'list-check':'M3 5h2v2H3zm0 6h2v2H3zm0 6h2v2H3zM7 5h14v2H7zm0 6h14v2H7zm0 6h14v2H7z',
  ellipsis:    'M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  'sign-out':  'M10 17v-2H5V9h5V7l5 5zM19 3H9v2h10v14H9v2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
  plus:        'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  phone:       'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11 11 0 0 0 3.5.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.5 1 1 0 0 1-.3 1z',
  clock:       'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11H7v-2h4V6h2z',
  rupee:       'M6 3h12v2h-4.2a4 4 0 0 1 1.5 2H18v2h-2.5a4.5 4.5 0 0 1-4.3 4H9.8l6 6h-2.9l-6-6v-2h3.4a2.5 2.5 0 0 0 2.4-2H6V7h6.6a2 2 0 0 0-2-2H6z',
  file:        'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm2 16H8v-2h8zm0-4H8v-2h8zm-3-5V3.5L18.5 9z',
  wifi:        'M12 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm0-4a6 6 0 0 0-4.2 1.8l1.4 1.4a4 4 0 0 1 5.6 0l1.4-1.4A6 6 0 0 0 12 14zm0-4a10 10 0 0 0-7.1 2.9l1.4 1.4a8 8 0 0 1 11.4 0l1.4-1.4A10 10 0 0 0 12 10z',
  external:    'M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z',
  chart:       'M4 20h3V10H4zm6.5 0h3V4h-3zM17 20h3v-7h-3z'
};

export function Icon({ name, size = 16, style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"
         aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-0.15em', ...(style || {}) }}>
      <path d={d} />
    </svg>
  );
}


/** Indian money, short. 1.25 Cr reads faster than 12,500,000 on a phone. */
export function fmtL(n) {
  const v = parseFloat(n) || 0;
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

/**
 * "Wed 8 Oct" rather than "8/10/2026".
 *
 * A numeric Indian date is ambiguous to read quickly and the year is almost
 * never the thing you need. The weekday is, because "is this before or after
 * the weekend" is the actual question when a deadline is three days out.
 */
export function shortDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  const days = Math.round((t - now) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  const s = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return days > 1 && days < 7 ? s + '  (' + days + 'd)' : s;
}

export function initials(name) {
  return String(name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Tile({ c, icon, value, label, small, onClick }) {
  const t = MT[c] || MT.neutral;
  return (
    <div onClick={onClick} style={{
      background: t.bg, borderRadius: 16,
      padding: small ? '0.7rem 0.8rem' : '0.85rem 0.9rem',
      cursor: onClick ? 'pointer' : 'default'
    }}>
      {icon && <Icon name={icon} size={15} style={{ color: t.fg, opacity: 0.85 }} />}
      <div style={{
        fontSize: small ? '1.05rem' : '1.25rem', fontWeight: 700,
        color: t.fg, lineHeight: 1.15, marginTop: icon ? '0.2rem' : 0,
        fontVariantNumeric: 'tabular-nums'
      }}>{value}</div>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: t.sub }}>{label}</div>
    </div>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.card, borderRadius: 18, padding: '0.9rem',
      marginBottom: '0.7rem', color: T.text, ...(style || {})
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, disabled, color, outline, style }) {
  const bg = outline ? 'transparent' : (color || PRIMARY);
  return (
    <button disabled={disabled} onClick={onClick} style={{
      background: disabled ? T.line : bg,
      color: outline ? (color || PRIMARY) : (bg === T.accent ? T.onAccent : '#fff'),
      border: outline ? '1.5px solid ' + (color || PRIMARY) : 'none',
      borderRadius: 12, padding: '0.8rem 1rem', fontSize: '0.92rem',
      fontWeight: 700, width: '100%', cursor: disabled ? 'default' : 'pointer',
      ...(style || {})
    }}>{children}</button>
  );
}

export function Spin() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{
        width: 28, height: 28, margin: '0 auto',
        border: '3px solid ' + T.line, borderTopColor: PRIMARY,
        borderRadius: '50%', animation: 'semspin 0.8s linear infinite'
      }} />
      <style>{'@keyframes semspin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

/** Bottom sheet. Thumb-reachable; a centred modal is not, one-handed. */
export function Sheet({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 50, display: 'flex', alignItems: 'flex-end'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, width: '100%', borderRadius: '20px 20px 0 0',
        color: T.text,
        padding: '1rem', maxHeight: '88vh', overflowY: 'auto',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
      }}>
        <div style={{
          width: 38, height: 4, background: T.line, borderRadius: 2,
          margin: '0 auto 0.9rem'
        }} />
        {children}
      </div>
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
      {options.map(o => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            background: on ? PRIMARY : T.raised,
            color: on ? T.onAccent : T.sub,
            border: '1px solid ' + (on ? PRIMARY : T.line),
            borderRadius: 999, padding: '0.4rem 0.8rem',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
          }}>{o}</button>
        );
      })}
    </div>
  );
}

/**
 * Why what you are looking at is not fresh, and what to do about it.
 *
 * The first version showed a permanent amber "showing saved data from 02:13 pm"
 * on every screen with no reason and no way to act. That reads as a broken app.
 * If the refresh simply has not finished, say nothing. If it failed, say so and
 * offer the retry.
 */
export function StaleNote({ at, error, onRetry }) {
  if (!at && !error) return null;
  const when = at ? new Date(at).toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div style={{
      background: error ? MT.red.bg : MT.neutral.bg,
      color: error ? MT.red.fg : MT.neutral.sub,
      borderRadius: 10, padding: '0.5rem 0.7rem', marginBottom: '0.7rem',
      fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
    }}>
      <span style={{ flex: 1 }}>
        {error
          ? <>Could not refresh — showing {when}. <span style={{ opacity: 0.8 }}>{error}</span></>
          : <>Showing saved data from {when}</>}
      </span>
      {onRetry && (
        <button onClick={onRetry} style={{
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
          padding: '0.25rem 0.6rem', fontSize: '0.74rem', fontWeight: 700,
          color: 'inherit', cursor: 'pointer', flexShrink: 0
        }}>Retry</button>
      )}
    </div>
  );
}

/**
 * The honesty strip.
 *
 * Shown whenever data on screen came from the cache rather than the server, or
 * when work is waiting to sync. An offline app that looks identical to an
 * online one is how people come to distrust it: they cannot tell whether what
 * they are reading is current, or whether what they typed has gone anywhere.
 */
export function StatusStrip({ offline, staleAt, pending }) {
  if (!offline && !pending) return null;
  const bg = offline ? MT.amber : MT.blue;
  const age = staleAt ? new Date(staleAt).toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div style={{
      background: bg.bg, color: bg.fg, fontSize: '0.74rem', fontWeight: 600,
      padding: '0.45rem 0.9rem', display: 'flex', justifyContent: 'space-between'
    }}>
      <span>
        {offline ? <><Icon name="wifi" size={13} style={{ opacity: 0.6 }} /> Offline
          {age ? ' — showing data from ' + age : ''}</> : 'Online'}
      </span>
      {pending > 0 && <span>{pending} waiting to sync</span>}
    </div>
  );
}
