/**
 * The SEM Mobile design system, lifted from MobileApp.html unchanged.
 *
 * "Bold tiles — GPay-style, sunlight-glanceable." The palette is dark text on
 * light colour rather than the other way round, because the people using this
 * are standing in a hospital corridor or a car park in Gujarat, reading a phone
 * at arm's length in daylight. That constraint produced these colours; keep
 * them.
 */
import React from 'react';

export const MT = {
  teal:    { bg: '#9FE1CB', fg: '#04342C', sub: '#085041' },
  blue:    { bg: '#B5D4F4', fg: '#042C53', sub: '#0C447C' },
  amber:   { bg: '#FAC775', fg: '#412402', sub: '#633806' },
  red:     { bg: '#F7C1C1', fg: '#501313', sub: '#791F1F' },
  neutral: { bg: '#F1EFE8', fg: '#2C2C2A', sub: '#5F5E5A' }
};

export const PRIMARY = '#0077b6';

/** Indian money, short. 1.25 Cr reads faster than 12,500,000 on a phone. */
export function fmtL(n) {
  const v = parseFloat(n) || 0;
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  return '₹' + Math.round(v).toLocaleString('en-IN');
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
      {icon && <i className={'fas fa-' + icon} style={{ fontSize: '0.9rem', color: t.fg, opacity: 0.85 }} />}
      <div style={{
        fontSize: small ? '1.05rem' : '1.25rem', fontWeight: 800,
        color: t.fg, lineHeight: 1.15, marginTop: icon ? '0.2rem' : 0
      }}>{value}</div>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: t.sub }}>{label}</div>
    </div>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'white', borderRadius: 16, padding: '0.9rem',
      marginBottom: '0.7rem', border: '1px solid #ECEDF0', ...(style || {})
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, disabled, color, outline, style }) {
  const bg = outline ? 'transparent' : (color || PRIMARY);
  return (
    <button disabled={disabled} onClick={onClick} style={{
      background: disabled ? '#C9CDD4' : bg,
      color: outline ? (color || PRIMARY) : 'white',
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
        border: '3px solid #E3E6EA', borderTopColor: PRIMARY,
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
        background: '#F6F7F9', width: '100%', borderRadius: '20px 20px 0 0',
        padding: '1rem', maxHeight: '88vh', overflowY: 'auto',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'
      }}>
        <div style={{
          width: 38, height: 4, background: '#D3D7DD', borderRadius: 2,
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
            background: on ? PRIMARY : 'white',
            color: on ? 'white' : '#44474C',
            border: '1px solid ' + (on ? PRIMARY : '#DFE2E7'),
            borderRadius: 999, padding: '0.4rem 0.8rem',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
          }}>{o}</button>
        );
      })}
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
        {offline ? <><i className="fas fa-wifi" style={{ opacity: 0.6 }} /> Offline
          {age ? ' — showing data from ' + age : ''}</> : 'Online'}
      </span>
      {pending > 0 && <span>{pending} waiting to sync</span>}
    </div>
  );
}
