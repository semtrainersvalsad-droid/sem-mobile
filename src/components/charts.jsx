/**
 * The chart primitives. Inline SVG, no library.
 *
 * WHY NO CHART LIBRARY
 * Every candidate is 50-200KB before a single pixel is drawn, and this app has
 * to open over a hospital car park's connection and work with none at all. The
 * charts here are a dozen rects and a path; a library would cost more than the
 * rest of the bundle to save code that fits on one screen.
 *
 * WHAT EVERY CHART IN HERE OBEYS
 *  - Figures use tabular numerals, so a column of money lines up.
 *  - A number never wears a series colour. The mark carries identity; the text
 *    stays in ink, or it starts to read as a status.
 *  - Three series maximum on anything categorical (see SERIES in theme.js).
 *  - A 2px gap of surface between adjacent fills, so two bars never merge into
 *    one shape.
 *  - Every chart takes a `label` and renders it as the SVG's accessible name,
 *    because a chart nobody can read aloud is a chart half the people cannot
 *    read at all.
 */
import React from 'react';
import { T, RAMP, NEUTRAL_MARK, tick } from '../theme.js';

const FIG = { fontVariantNumeric: 'tabular-nums' };

/** Section heading plus optional subtitle. Used above every chart. */
export function ChartHead({ title, sub, right }) {
  return (
    <div style={{ marginBottom: sub ? 12 : 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13.5, color: T.text }}>{title}</div>
        {right && <div style={{ fontSize: 17, color: T.text, ...FIG }}>{right}</div>}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/**
 * Why a panel is empty, in words, where the chart would have been.
 *
 * The alternative is a zero, and a zero is a lie: "win rate 0%" reads as "we
 * lost everything" when the truth is that nobody recorded the outcome. This
 * component exists so that distinction survives all the way to the screen.
 */
export function Blank({ title, why }) {
  return (
    <div style={{ background: T.card, borderRadius: 20, padding: 15 }}>
      <div style={{ fontSize: 13.5, color: T.sub }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T.faint, marginTop: 6, lineHeight: 1.5 }}>
        {why || 'Not enough data recorded yet.'}
      </div>
    </div>
  );
}

/**
 * A month-by-month column chart.
 *
 * The tallest column is highlighted and labelled, because on a twelve-month
 * revenue chart the question is almost always "which month was the spike".
 * The final column is drawn as an outline when `lastPartial` is set: October's
 * bar being short does not mean sales collapsed, it means October is not over,
 * and a solid bar there invites exactly the wrong conclusion.
 */
export function MonthBars({ months, lastPartial, label }) {
  const W = 292, H = 104, base = 84, maxH = 72;
  const vals = months.map(m => m.value || 0);
  const peak = Math.max(...vals, 1);
  const n = months.length || 1;
  const gap = 6;
  const bw = Math.max(6, (W - 10 - gap * (n - 1)) / n);
  const peakIdx = vals.indexOf(peak);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}
         role="img" aria-label={label}>
      {months.map((m, i) => {
        const h = Math.max(2, (m.value / peak) * maxH);
        const x = 5 + i * (bw + gap);
        const isLast = i === n - 1;
        const outline = isLast && lastPartial;
        return (
          <rect key={m.key || i} x={x} y={base - h} width={bw} height={h} rx="4"
                fill={outline ? 'none' : (i === peakIdx ? T.accent : NEUTRAL_MARK)}
                stroke={outline ? NEUTRAL_MARK : 'none'}
                strokeWidth={outline ? 1.5 : 0}
                strokeDasharray={outline ? '3 2' : undefined} />
        );
      })}
      {peak > 0 && (
        <text x={5 + peakIdx * (bw + gap) + bw / 2} y={base - (maxH) - 4}
              textAnchor="middle" fontSize="10" fill={T.text} style={FIG}>
          {tick(peak)}
        </text>
      )}
      {months.map((m, i) => (
        <text key={'l' + i} x={5 + i * (bw + gap) + bw / 2} y={H - 7}
              textAnchor="middle" fontSize="9"
              fill={i === peakIdx || (i === n - 1) ? T.sub : T.faint}>
          {String(m.label || '').charAt(0)}
        </text>
      ))}
    </svg>
  );
}

/**
 * Horizontal bars for ordered categories — ageing buckets and the like.
 *
 * Single hue, light to dark, because these categories have an order. A
 * categorical palette here would say "unrelated things" when the whole point
 * is that 90+ days is the same thing as 0-30 days, only worse. `alertFrom`
 * marks the index at which a bucket stops being normal and becomes a problem,
 * and that one bar leaves the ramp for the status colour.
 */
export function AgeBars({ rows, alertFrom, label }) {
  const W = 292, rowH = 22;
  // Lay the three columns out from the text, not from a guessed constant. With
  // a fixed bar width the money and the category ran into each other as soon
  // as a label grew past "0-30d" — "₹5.38 L" and "21 · over 2 years" collided
  // on the very first real data this chart was given.
  const CH_R = 5.3, CH_V = 6.0;                      // approx px per character
  const rightW = Math.max(...rows.map(r => String(r.label || '').length)) * CH_R;
  const valueW = Math.max(...rows.map(r => String(r.text || '').length)) * CH_V;
  const labelX = Math.max(90, W - rightW - valueW - 16);
  const barMax = Math.max(60, labelX - 10);
  const peak = Math.max(...rows.map(r => Math.abs(r.value) || 0), 1);
  const H = rows.length * rowH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}
         role="img" aria-label={label}>
      {rows.map((r, i) => {
        const w = Math.max(2, (Math.abs(r.value) / peak) * barMax);
        const y = i * rowH + 2;
        const alert = alertFrom !== undefined && i >= alertFrom;
        const fill = alert ? T.red : RAMP[Math.min(i, RAMP.length - 1)];
        // Dim ink for a bucket that is immaterial, so the eye goes to the money.
        const faded = Math.abs(r.value) / peak < 0.03;
        return (
          <g key={r.label || i}>
            <rect x="0" y={y} width={w} height="15" rx="4" fill={fill} />
            <text x={labelX} y={y + 11.5} fontSize="11"
                  fill={alert ? '#FF8A7D' : (faded ? T.sub : T.text)} style={FIG}>
              {r.text}
            </text>
            <text x={W} y={y + 11.5} textAnchor="end" fontSize="10.5"
                  fill={alert ? '#FF8A7D' : T.faint}>
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * One bar split in two: the part that matters against the rest.
 *
 * Used for "of the deposits lodged, this much is on expired instruments". A
 * two-slice donut would be the obvious reach here and would be worse — it
 * spends a circle and a legend to show one ratio that a bar states in 10px of
 * height.
 */
export function SplitBar({ part, whole, color }) {
  const frac = whole ? Math.max(0, Math.min(1, part / whole)) : 0;
  const W = 120, w = Math.round(frac * W);
  return (
    <svg viewBox={`0 0 ${W} 10`} width="100%" height="10" style={{ display: 'block' }}
         aria-hidden="true">
      {w > 0 && <rect x="0" y="0" width={Math.max(3, w - 3)} height="10" rx="3" fill={color || T.amber} />}
      <rect x={Math.max(3, w)} y="0" width={Math.max(0, W - Math.max(3, w))} height="10" rx="3" fill="#3A3F47" />
    </svg>
  );
}

/**
 * A stacked bar for a part-to-whole split.
 *
 * This is the form a donut wants to be. A donut compares every segment to
 * every other, which is what forces its three-colour ceiling; a bar only ever
 * asks you to compare neighbours, so the same palette carries more segments
 * safely — and it costs a fifth of the vertical space on a phone.
 */
export function StackBar({ rows, colors }) {
  const total = rows.reduce((a, r) => a + (Math.abs(r.value) || 0), 0) || 1;
  const W = 292, gap = 2;
  let x = 0;
  return (
    <svg viewBox={`0 0 ${W} 20`} width="100%" height="20" style={{ display: 'block' }}
         aria-hidden="true">
      {rows.map((r, i) => {
        const w = (Math.abs(r.value) / total) * (W - gap * (rows.length - 1));
        const seg = <rect key={i} x={x} y="2" width={Math.max(3, w)} height="16" rx="4"
                          fill={colors[i % colors.length]} />;
        x += w + gap;
        return seg;
      })}
    </svg>
  );
}

/**
 * The legend. Always present for two or more series, because identity must
 * never rest on colour alone — a swatch plus a word survives colourblindness,
 * a greyscale print and a cracked screen in sunlight.
 */
export function Legend({ rows, colors, fmt }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 11, flexWrap: 'wrap' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 9, height: 9, borderRadius: 3,
                        background: colors[i % colors.length], flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: T.sub }}>{r.label}</span>
          <span style={{ fontSize: 11, color: T.text, ...FIG }}>
            {fmt ? fmt(r.value) : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A progress ring against a target.
 *
 * Correct for exactly one thing: a single ratio with a real target, where the
 * target is drawn as a tick on the track so "are we short" is answered without
 * reading a number. One per screen. Concentric rings for several metrics are
 * not offered, because the inner ring is physically shorter and the same
 * percentage draws less arc there — the comparison the shape invites is the
 * one it cannot support.
 */
export function Ring({ pct, target, centre, sub, size = 104, label }) {
  const r = (size - 24) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, (pct || 0) / 100));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
         style={{ display: 'block' }} role="img" aria-label={label}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={T.line} strokeWidth="10" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={T.green} strokeWidth="10"
              strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`}
              transform={`rotate(-90 ${c} ${c})`} />
      {target != null && (
        <circle cx={c} cy={c - r} r="3" fill={T.text}
                transform={`rotate(${(target / 100) * 360} ${c} ${c})`} />
      )}
      <text x={c} y={c + 2} textAnchor="middle" fontSize="24" fill={T.text} style={FIG}>
        {centre}
      </text>
      {sub && <text x={c} y={c + 17} textAnchor="middle" fontSize="9.5" fill={T.sub}>{sub}</text>}
    </svg>
  );
}
