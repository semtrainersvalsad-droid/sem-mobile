/**
 * Business — the owner's dashboard, built only from what the data supports.
 *
 * THE RULE THIS SCREEN EXISTS TO ENFORCE
 * getMobileDashboard returns a value or null for each panel, plus a coverage
 * entry saying how many rows carried the field it needed. A null panel renders
 * as a sentence explaining why, never as a zero. Four panels are null today —
 * win rate and its two breakdowns, plus order book — because the Tenders sheet
 * has 795 rows and has never recorded a single bid outcome. A "0% win rate"
 * there would read as "we lose everything" when the truth is that nobody wrote
 * the result down, and those are opposite problems with opposite responses.
 *
 * The screen is ordered by what costs money soonest, not by what is easiest to
 * compute: cash collected, then cash owed, then cash lodged elsewhere, then the
 * funnel that refills it.
 */
import React from 'react';
import { T, R, money, SERIES, tick, fyMonthsElapsed } from '../theme.js';
import { ChartHead, Blank, MonthBars, AgeBars, SplitBar, StackBar, Legend } from '../components/charts.jsx';
import { Spin, StaleNote, Sheet } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached } from '../db.js';

const FIG = { fontVariantNumeric: 'tabular-nums' };

/**
 * A card, optionally one you can open.
 *
 * When `onOpen` is set the card gets a footer row naming what is behind it —
 * "See all 47 who owe you" — rather than relying on the card simply looking
 * tappable. The first thing anyone said about this screen was "I want to see
 * who owes me the money, it shows me only the cumulative figure": the data
 * was there, the way in was not, and an invisible tap target is the same as
 * no tap target.
 */
function Card({ children, tone, onOpen, openLabel }) {
  const bg = tone === 'alert' ? '#2A1008' : tone === 'bad' ? T.redBg : T.card;
  return (
    <div onClick={onOpen} style={{
      background: bg, borderRadius: R.card, padding: 15, marginBottom: 10,
      cursor: onOpen ? 'pointer' : 'default'
    }}>
      {children}
      {onOpen && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 12, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.09)',
          fontSize: 12, color: T.accent
        }}>
          <span>{openLabel}</span>
          <span style={{ fontSize: 15, lineHeight: 1 }}>›</span>
        </div>
      )}
    </div>
  );
}

/** A list behind a card. One row per thing, the number on the right. */
function DetailSheet({ title, sub, rows, onClose }) {
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 16, color: T.text, marginBottom: sub ? 3 : 12 }}>{title}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 12 }}>{sub}</div>}
      {!rows.length && (
        <div style={{ fontSize: 12.5, color: T.sub, padding: '10px 0' }}>Nothing to show.</div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
          borderBottom: i < rows.length - 1 ? '1px solid ' + T.line : 'none'
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, color: T.text, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
            {r.meta && <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{r.meta}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: T.text, ...FIG }}>{r.value}</div>
            {r.tag && <div style={{ fontSize: 10.5, color: r.tagColor || T.sub, ...FIG }}>{r.tag}</div>}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

export default function Business({ online }) {
  const [d, setD] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);
  const [sheet, setSheet] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    // The server caches this for ten minutes. A manual retry asks for a fresh
    // build, because someone who taps Retry wants today's number, not the one
    // from nine minutes ago that they are already looking at.
    cached('business', () => call('getMobileDashboard', nonce > 0), (v, m) => {
      if (dead) return;
      setD(v);
      setStale(m.fromCache ? m.at : null);
      setStaleErr(m.error || '');
    }).catch(e => { if (!dead) setErr(e.message || String(e)); });
    return () => { dead = true; };
  }, [nonce]);

  if (!d && !err) return <Spin />;
  if (!d) {
    return (
      <Card>
        <div style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>Could not load</div>
        <div style={{ fontSize: 12, color: T.sub, lineHeight: 1.5 }}>
          {online ? err : 'You are offline and this screen has not been opened with signal yet.'}
        </div>
      </Card>
    );
  }

  const cov = d.coverage || {};
  const why = k => (cov[k] && cov[k].why) || '';

  // The month in progress must not read as a collapse in sales.
  const partial = true;

  return (
    <>
      {sheet && <DetailSheet {...sheet} onClose={() => setSheet(null)} />}

      <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />

      {/* ── Cash in ─────────────────────────────────────────────────────── */}
      {d.billed ? (
        <Card
          onOpen={(d.billed.parties || []).length ? () => setSheet({
            title: 'Who you billed',
            sub: d.billed.partyCount + ' customers this year · ' + money(d.billed.fy),
            rows: d.billed.parties.map(p => ({
              name: p.name,
              meta: p.invoices + (p.invoices > 1 ? ' invoices' : ' invoice'),
              value: money(p.value),
              tag: d.billed.fy ? Math.round((p.value / d.billed.fy) * 100) + '%' : '',
              tagColor: T.sub
            }))
          }) : undefined}
          openLabel={'See all ' + (d.billed.partyCount || 0) + ' customers billed'}>
          <div style={{ fontSize: 11.5, color: T.sub }}>Billed this financial year</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 3 }}>
            <div style={{ fontSize: 38, color: T.text, lineHeight: 1, ...FIG }}>
              {money(d.billed.fy).replace(/ (Cr|L)$/, '')}
            </div>
            <div style={{ fontSize: 15, color: T.sub }}>
              {d.billed.fy >= 10000000 ? 'crore' : 'lakh'}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.sub, marginTop: 5 }}>
            {money(d.billed.fy / (fyMonthsElapsed() || 1))} a month across{' '}
            {fyMonthsElapsed()} months · from Tally
          </div>
          {!Array.isArray(d.billed.months) && (
            <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
              Monthly breakdown needs the updated server.
            </div>
          )}
          <div style={{ marginTop: 12, display: Array.isArray(d.billed.months) && d.billed.months.length ? 'block' : 'none' }}>
            <MonthBars months={d.billed.months || []} lastPartial={partial}
                       label={'Billing by month: ' + (d.billed.months || [])
                         .map(m => m.label + ' ' + tick(m.value)).join(', ')} />
          </div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>
            This month still running{why('billed') ? ' · ' + why('billed') : ''}
          </div>
        </Card>
      ) : (
        <Card><Blank title="Billed this year" why={why('billed')} /></Card>
      )}

      {/* ── Cash owed ───────────────────────────────────────────────────── */}
      {d.receivables ? (() => {
        const b = d.receivables.buckets || {};
        const order = ['Not Due', '0-30', '31-60', '61-90', '90+'];
        const rows = order.filter(k => b[k]).map(k => ({
          label: k === 'Not Due' ? 'not due' : k === '90+' ? 'over 90d' : k + 'd',
          value: b[k], text: money(b[k])
        }));
        const late = b['90+'] || 0;
        const share = d.receivables.total ? Math.round((late / d.receivables.total) * 100) : 0;
        // Against the monthly run rate for the year to DATE, not across the
        // twelve-month chart window — those are different spans, and using the
        // chart's gave 6.8 months outstanding where the answer was 4.0.
        const elapsed = fyMonthsElapsed();
        const months = d.billed && d.billed.fy && elapsed
          ? d.receivables.total / (d.billed.fy / elapsed)
          : null;
        const parties = d.receivables.parties || d.receivables.topOverdue || [];
        return (
          <Card tone="alert"
                onOpen={parties.length ? () => setSheet({
                  title: 'Who owes you',
                  sub: parties.length + ' parties · largest first',
                  rows: parties.map(p => ({
                    name: p.party,
                    meta: (p.bills ? p.bills + (p.bills > 1 ? ' bills' : ' bill') : '') +
                          (p.company ? ' · ' + p.company : ''),
                    value: money(p.amount),
                    tag: p.maxOverdue > 0 ? p.maxOverdue + 'd late' : 'not due',
                    tagColor: p.maxOverdue > 90 ? T.red : p.maxOverdue > 0 ? T.amber : T.sub
                  }))
                }) : undefined}
                openLabel={'See all ' + parties.length + ' who owe you'}>
            <ChartHead title="Money owed to you" right={money(d.receivables.total)} />
            {months != null && (
              <div style={{ fontSize: 11.5, color: '#FF8A7D', marginTop: -6, marginBottom: 13 }}>
                About {months.toFixed(1)} months of billing sitting unpaid
              </div>
            )}
            <AgeBars rows={rows} alertFrom={order.filter(k => b[k]).indexOf('90+')}
                     label={'Receivables ageing: ' + rows.map(r => r.label + ' ' + r.text).join(', ')} />
            {share > 0 && (
              <div style={{ fontSize: 11.5, color: '#FF8A7D', lineHeight: 1.5, marginTop: 10 }}>
                {share} paise in every rupee owed is more than 90 days late.
              </div>
            )}
          </Card>
        );
      })() : (
        <Card><Blank title="Money owed to you" why={why('receivables')} /></Card>
      )}

      {/* ── Cash lodged elsewhere ───────────────────────────────────────── */}
      {(d.emd || d.pbg) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
          {d.emd && (
            <div onClick={(d.emd.items || []).length ? () => setSheet({
                   title: 'Expired deposits',
                   sub: d.emd.expired + ' instruments · most recent first',
                   rows: d.emd.items.map(x => ({
                     name: x.who || 'Unnamed',
                     meta: [x.bank, x.ref].filter(Boolean).join(' · '),
                     value: money(x.amount),
                     tag: x.days + 'd ago',
                     tagColor: x.days < 180 ? T.red : T.sub
                   }))
                 }) : undefined}
                 style={{ background: T.card, borderRadius: 19, padding: 14,
                          cursor: (d.emd.items || []).length ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 10.5, color: T.sub }}>Deposits lodged</div>
              <div style={{ fontSize: 21, color: T.text, marginTop: 2, ...FIG }}>
                {money(d.emd.locked)}
              </div>
              <div style={{ fontSize: 10.5, color: T.sub, marginTop: 1 }}>
                {d.emd.count} EMDs
              </div>
              <div style={{ marginTop: 9 }}>
                <SplitBar part={d.emd.expiredValue} whole={d.emd.locked} color={T.amber} />
              </div>
              <div style={{ fontSize: 10.5, color: T.amber, marginTop: 6 }}>
                {money(d.emd.expiredValue)} expired{(d.emd.items || []).length ? ' ›' : ''}
              </div>
            </div>
          )}
          {d.pbg && (
            <div onClick={(d.pbg.items || []).length ? () => setSheet({
                   title: 'Open guarantees',
                   sub: d.pbg.open + ' PBGs · soonest to expire first',
                   rows: d.pbg.items.map(x => ({
                     name: x.who || 'Unnamed',
                     meta: x.bank || '',
                     value: money(x.amount),
                     tag: x.days < 0 ? Math.abs(x.days) + 'd expired' : 'in ' + x.days + 'd',
                     tagColor: x.days < 0 ? T.red : x.days <= 30 ? T.amber : T.sub
                   }))
                 }) : undefined}
                 style={{ background: T.card, borderRadius: 19, padding: 14,
                          cursor: (d.pbg.items || []).length ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 10.5, color: T.sub }}>Guarantees open</div>
              <div style={{ fontSize: 21, color: T.text, marginTop: 2, ...FIG }}>
                {money(d.pbg.value)}
              </div>
              <div style={{ fontSize: 10.5, color: T.sub, marginTop: 1 }}>
                {d.pbg.open} PBGs
              </div>
              <div style={{ marginTop: 9 }}>
                <SplitBar part={d.pbg.expired} whole={d.pbg.open} color={T.red} />
              </div>
              <div style={{ fontSize: 10.5, color: d.pbg.expired ? T.red : T.sub, marginTop: 6 }}>
                {d.pbg.expired ? d.pbg.expired + ' expired' : 'all current'}
                {(d.pbg.items || []).length ? ' ›' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* How long the expired deposits have sat. The age is the whole point:
          two years is settled paperwork, two months may be real money. */}
      {d.emd && d.emd.ageBands && d.emd.ageBands.length > 1 && (
        <Card>
          <ChartHead title="How long deposits have sat expired"
                     sub={d.emd.expired + ' of ' + d.emd.count + ' instruments are past validity'} />
          <AgeBars
            rows={d.emd.ageBands.map(b => ({
              label: b.n + ' · ' + b.label.replace('expired ', '').replace(' ago', ''),
              value: b.value, text: money(b.value)
            }))}
            label={'Expired deposits by age: ' + d.emd.ageBands
              .map(b => b.label + ' ' + b.n + ' worth ' + money(b.value)).join(', ')} />
          {!d.emd.statusUsable && (
            <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.5, marginTop: 10 }}>
              Nothing is ever marked returned in the sheet, so treat this as an upper
              bound. The oldest are most likely refunded and never written down.
            </div>
          )}
        </Card>
      )}

      {/* ── The funnel that refills the cash ───────────────────────────── */}
      {d.tenders && d.tenders.live === 0 ? (
        <Card tone="bad">
          <div style={{ fontSize: 13.5, color: T.text, marginBottom: 4 }}>
            Nothing in the bid pipeline
          </div>
          <div style={{ fontSize: 11.5, color: '#FF8A7D', lineHeight: 1.55, marginBottom: 12 }}>
            Not one of {d.tenders.total} tenders has a deadline still ahead.
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[['no-go', d.tenders.noGo], ['expired', d.tenders.open], ['live', d.tenders.live]]
              .map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 17, color: k === 'live' ? T.red : T.text, ...FIG }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: '#FF8A7D' }}>{k}</div>
                </div>
              ))}
          </div>
        </Card>
      ) : d.tenders ? (
        <Card>
          <ChartHead title="Live tenders" right={String(d.tenders.live)}
                     sub={d.tenders.closingThisWeek
                       ? d.tenders.closingThisWeek + ' close within a week'
                       : 'none closing this week'} />
          {/* "Live" mixes two different facts and must not pretend otherwise.
              A deadline nobody can read counts as live — assuming a bid is dead
              on the strength of an unreadable date is how a tender gets missed
              — but it is not the same as a confirmed open deadline, and the
              gap between them is a list someone can go and fix. */}
          {d.tenders.liveUnreadable > 0 && (
            <div style={{ fontSize: 11.5, color: T.amber, lineHeight: 1.55, marginTop: 4 }}>
              {d.tenders.liveConfirmed} have a deadline still ahead.{' '}
              {d.tenders.liveUnreadable} are counted live only because the
              deadline is written as text, not a date
              {d.tenders.liveNoDate ? ', and ' + d.tenders.liveNoDate + ' have none recorded' : ''}.
            </div>
          )}
          {(d.tenders.unreadableSamples || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              {d.tenders.unreadableSamples.slice(0, 3).map((x, i) => (
                <div key={i} style={{ fontSize: 11, color: T.sub, padding: '4px 0' }}>
                  <span style={{ color: T.faint }}>“{x.raw}”</span>{' '}
                  {String(x.title).substring(0, 34)}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {d.pipeline ? (
        <Card>
          <ChartHead title="Pipeline" right={money(d.pipeline.total)}
                     sub={d.pipeline.count + ' projects'} />
          <StackBar rows={d.pipeline.rows.map(r => ({ value: r.value }))} colors={SERIES} />
          <Legend rows={d.pipeline.rows.map(r => ({ label: r.group, value: r.value }))}
                  colors={SERIES} fmt={money} />
          {d.pipeline.unvalued > 0 && (
            <div style={{ fontSize: 11.5, color: T.amber, lineHeight: 1.5, marginTop: 11 }}>
              {d.pipeline.unvalued} of {d.pipeline.count} carry no value, so this total is
              lower than the real pipeline.
            </div>
          )}
        </Card>
      ) : (
        <Card><Blank title="Pipeline" why={why('pipeline')} /></Card>
      )}

      {/* ── Demos out ──────────────────────────────────────────────────── */}
      {/* Every field below is read defensively. The API this screen calls can
          be an older deployment than the code that renders it — the Apps
          Script project caps at 200 versions and was full when this shipped —
          so a missing field must leave a gap, not throw and blank the screen. */}
      {d.demos && d.demos.out > 0 && (() => {
        const longest = d.demos.longest || [];
        return (
        <Card>
          <ChartHead title="Demos out" right={String(d.demos.out)} />
          {longest.map((x, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0',
              borderBottom: i < longest.length - 1 ? '1px solid ' + T.line : 'none'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, color: T.text }}>{x.product || 'Unnamed'}</div>
                <div style={{ fontSize: 11, color: T.sub }}>{x.who || '—'}</div>
              </div>
              <div style={{ fontSize: 13, color: T.amber, ...FIG }}>{x.days}d</div>
            </div>
          ))}
          {!longest.length && (
            <div style={{ fontSize: 11.5, color: T.sub }}>
              {d.demos.oldestDays != null
                ? 'None out longer than 90 days. Oldest is ' + d.demos.oldestDays + 'd.'
                : d.demos.out + ' units are with customers.'}
            </div>
          )}
          <div style={{ fontSize: 11, color: T.faint, marginTop: 10 }}>
            {d.demos.basis ? 'Counted from dispatch' : 'From Demo_Tracking'}
            {why('demos') ? ' — ' + why('demos').toLowerCase() : ''}
          </div>
        </Card>
        );
      })()}

      {/* ── Breakdowns, where the columns hold what they claim ─────────── */}
      {d.salesByState ? (
        <Card>
          <ChartHead title="Where the money comes from" sub="By state, all recorded sales" />
          <AgeBars
            rows={d.salesByState.rows.map(r => ({
              label: r.orders + ' orders', value: r.value, text: money(r.value)
            }))}
            label={'Sales by state: ' + d.salesByState.rows
              .map(r => r.state + ' ' + money(r.value)).join(', ')} />
          <div style={{ marginTop: 8 }}>
            {d.salesByState.rows.map((r, i) => (
              <div key={i} style={{ fontSize: 11, color: T.sub }}>{r.state}</div>
            ))}
          </div>
        </Card>
      ) : (
        <Card><Blank title="Where the money comes from" why={why('salesByState')} /></Card>
      )}

      {d.customers ? (
        <Card>
          <ChartHead title="Who buys twice"
                     right={d.customers.repeatPct + '%'}
                     sub={d.customers.repeat + ' of ' + d.customers.total +
                          ' customers have bought more than once'} />
          {d.customers.top.map((c, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < d.customers.top.length - 1 ? '1px solid ' + T.line : 'none'
            }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                <div style={{ fontSize: 12.5, color: T.text, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer}</div>
                <div style={{ fontSize: 11, color: T.sub }}>{c.orders} orders</div>
              </div>
              <div style={{ fontSize: 12.5, color: T.text, ...FIG }}>{money(c.value)}</div>
            </div>
          ))}
        </Card>
      ) : (
        <Card><Blank title="Who buys twice" why={why('customers')} /></Card>
      )}

      {d.productMix ? (
        <Card>
          <ChartHead title="What sells"
                     sub={d.productMix.distinct + ' distinct products'} />
          <StackBar rows={d.productMix.rows.concat(
                      d.productMix.otherValue ? [{ value: d.productMix.otherValue }] : [])}
                    colors={SERIES.concat([T.blue, '#6B7684'])} />
          <Legend rows={d.productMix.rows.map(r => ({ label: r.product, value: r.value }))
                    .concat(d.productMix.otherValue
                      ? [{ label: '+' + d.productMix.otherCount + ' more', value: d.productMix.otherValue }]
                      : [])}
                  colors={SERIES.concat([T.blue, '#6B7684'])} fmt={money} />
        </Card>
      ) : (
        <Card><Blank title="What sells" why={why('productMix')} /></Card>
      )}

      {/* ── What cannot be built, and why ──────────────────────────────── */}
      <Card>
        <Blank title="Win rate" why={why('winRate')} />
      </Card>

      <div style={{ background: T.raised, borderRadius: 20, padding: 15, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
          <span style={{ color: T.text }}>
            {Object.keys(cov).filter(k => cov[k].ok).length} of {Object.keys(cov).length} panels
            are live.
          </span>{' '}
          The rest stay blank rather than showing a zero, because a zero and a
          missing record look identical on a chart and mean opposite things.
        </div>
      </div>
    </>
  );
}
