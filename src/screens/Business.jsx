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
import { Spin, StaleNote } from '../components/tiles.jsx';
import { call } from '../api.js';
import { cached } from '../db.js';

const FIG = { fontVariantNumeric: 'tabular-nums' };

function Card({ children, tone }) {
  const bg = tone === 'alert' ? '#2A1008' : tone === 'bad' ? T.redBg : T.card;
  return (
    <div style={{ background: bg, borderRadius: R.card, padding: 15, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default function Business({ online }) {
  const [d, setD] = React.useState(null);
  const [stale, setStale] = React.useState(null);
  const [staleErr, setStaleErr] = React.useState('');
  const [err, setErr] = React.useState('');
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let dead = false;
    cached('business', () => call('getMobileDashboard'), (v, m) => {
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
      <StaleNote at={stale} error={staleErr} onRetry={() => setNonce(n => n + 1)} />

      {/* ── Cash in ─────────────────────────────────────────────────────── */}
      {d.billed ? (
        <Card>
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
          <div style={{ marginTop: 12 }}>
            <MonthBars months={d.billed.months} lastPartial={partial}
                       label={'Billing by month: ' + d.billed.months
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
        return (
          <Card tone="alert">
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
            <div style={{ background: T.card, borderRadius: 19, padding: 14 }}>
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
                {money(d.emd.expiredValue)} expired
              </div>
            </div>
          )}
          {d.pbg && (
            <div style={{ background: T.card, borderRadius: 19, padding: 14 }}>
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
      {d.demos && d.demos.out > 0 && (
        <Card>
          <ChartHead title="Demos out" right={String(d.demos.out)} />
          {(d.demos.longest || []).map((x, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 0',
              borderBottom: i < d.demos.longest.length - 1 ? '1px solid ' + T.line : 'none'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, color: T.text }}>{x.product || 'Unnamed'}</div>
                <div style={{ fontSize: 11, color: T.sub }}>{x.who || '—'}</div>
              </div>
              <div style={{ fontSize: 13, color: T.amber, ...FIG }}>{x.days}d</div>
            </div>
          ))}
          {!d.demos.longest.length && (
            <div style={{ fontSize: 11.5, color: T.sub }}>
              None out longer than 90 days. Oldest is {d.demos.oldestDays}d.
            </div>
          )}
          <div style={{ fontSize: 11, color: T.faint, marginTop: 10 }}>
            Counted from dispatch{why('demos') ? ' — ' + why('demos').toLowerCase() : ''}
          </div>
        </Card>
      )}

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
