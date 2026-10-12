/**
 * Actions, and the rule about doing them with no signal.
 *
 * The server declares, per action, whether it is append-only ('queue') or an
 * edit to a row other people also touch ('online'). This file is where that
 * declaration becomes behaviour the person holding the phone can see:
 *
 *   queue  — works offline. Goes to the outbox, sends when there is signal,
 *            carries its own id so a retry after a dropped reply cannot write
 *            it twice.
 *   online — refuses offline, and says why. Two people editing one project's
 *            stage with no signal produces a merge, and a wrong merge in an
 *            ERP writes a plausible wrong value and raises nothing.
 *
 * The refusal is deliberate and is explained in the sheet rather than hidden
 * behind a disabled button, because a disabled button with no reason is the
 * thing people file bugs about.
 */
import React from 'react';
import { T } from '../theme.js';
import { Sheet } from './tiles.jsx';
import { call } from '../api.js';
import { enqueue } from '../db.js';

/** What each action needs from the person, beyond the record it acts on. */
export const ACTION_FORMS = {
  'complaints.add': {
    label: 'Log a complaint', offline: 'queue', verb: 'Log it',
    fields: [
      { k: 'organization', label: 'Institution', required: true },
      { k: 'customerName', label: 'Contact name' },
      { k: 'phone', label: 'Phone', type: 'tel' },
      { k: 'productModel', label: 'Product or model' },
      { k: 'description', label: 'What is wrong', required: true, lines: 3 },
      { k: 'priority', label: 'Priority', options: ['Normal', 'High', 'Critical'] }
    ]
  },
  'complaints.stage': {
    label: 'Change stage', offline: 'online', verb: 'Save',
    fields: [
      { k: 'stage', label: 'New stage', required: true,
        options: ['Open', 'In Progress', 'Waiting for Customer', 'Waiting for OEM',
                  'Resolved', 'Closed'] },
      { k: 'resolution', label: 'What happened', lines: 2 }
    ]
  },
  'stock.move': {
    label: 'Record a movement', offline: 'queue', verb: 'Record it',
    fields: [
      { k: 'type', label: 'Direction', required: true,
        options: ['IN', 'OUT', 'DEMO_OUT', 'DEMO_RETURN'] },
      { k: 'quantity', label: 'Quantity', type: 'number', required: true },
      { k: 'reference', label: 'Reference (PO, challan)' },
      { k: 'notes', label: 'Note', lines: 2 }
    ]
  },
  'demos.out': {
    label: 'Send a demo out', offline: 'queue', verb: 'Send it',
    fields: [
      { k: 'sentTo', label: 'Going to', required: true },
      { k: 'quantity', label: 'Quantity', type: 'number' },
      { k: 'expectedReturn', label: 'Expected back', type: 'date' },
      { k: 'notes', label: 'Note', lines: 2 }
    ]
  },
  'demos.return': {
    label: 'Mark returned', offline: 'online', verb: 'Mark returned',
    fields: [{ k: 'notes', label: 'Condition / note', lines: 2 }]
  },
  'projects.stage': {
    label: 'Move stage', offline: 'online', verb: 'Move it',
    fields: [
      { k: 'stage', label: 'New stage', required: true,
        options: ['Prospect', 'Demand Building', 'Budget & Sanction', 'Specification',
                  'Tender Live', 'Bid Submitted', 'L1 Declared', 'Rate Contract Active',
                  'Order Won', 'Supply', 'Install & Train', 'Handover', 'Closed', 'Lost'] },
      { k: 'note', label: 'Why', lines: 2 }
    ]
  },
  'emd.returned': {
    label: 'Mark returned', offline: 'online', verb: 'Mark returned',
    fields: [{ k: 'note', label: 'Reference / note', lines: 2 }]
  },
  'pbg.released': {
    label: 'Mark released', offline: 'online', verb: 'Mark released',
    fields: [{ k: 'note', label: 'Release letter reference', lines: 2 }]
  }
};

/** Which actions a module offers, and whether each needs a record selected. */
export const MODULE_ACTIONS = {
  complaints: { add: 'complaints.add', row: 'complaints.stage' },
  stock:      { row: 'stock.move' },
  demos:      { row: 'demos.return' },
  projects:   { row: 'projects.stage' },
  emd:        { row: 'emd.returned' },
  pbg:        { row: 'pbg.released' }
};

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: T.bg,
  border: '1px solid ' + T.line, borderRadius: 11, color: T.text,
  padding: '11px 12px', fontSize: 14, outline: 'none', marginTop: 5
};

export function ActionSheet({ action, record, online, onClose, onDone }) {
  const form = ACTION_FORMS[action];
  const [vals, setVals] = React.useState(() => {
    const v = {};
    (form.fields || []).forEach(f => { v[f.k] = f.options ? f.options[0] : ''; });
    return v;
  });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [queued, setQueued] = React.useState(false);

  const canQueue = form.offline === 'queue';
  const blocked = !online && !canQueue;

  const set = (k, v) => setVals(s => ({ ...s, [k]: v }));

  async function submit() {
    const missing = (form.fields || []).filter(f => f.required && !String(vals[f.k] || '').trim());
    if (missing.length) { setErr('Fill in ' + missing.map(f => f.label).join(' and ')); return; }

    // The record this acts on travels with the payload, so the server never
    // has to guess which row the phone meant.
    const payload = { ...vals };
    if (record) {
      payload.id = record.id;
      if (record.sub) payload.modelNo = payload.modelNo || record.id;
      payload.productName = payload.productName || record.title;
    }

    setBusy(true); setErr('');
    try {
      if (!online && canQueue) {
        await enqueue('doMobileAction', [action, payload], form.label);
        setQueued(true);
        onDone && onDone({ queued: true });
        return;
      }
      const r = await call('doMobileAction', action, payload);
      if (r && r.success === false) { setErr(r.error || 'The server refused it.'); return; }
      onDone && onDone({ queued: false });
      onClose();
    } catch (e) {
      // Online but the call failed. Queue it if it is safe to; otherwise say so
      // rather than leaving someone unsure whether it went.
      if (canQueue) {
        await enqueue('doMobileAction', [action, payload], form.label);
        setQueued(true);
        onDone && onDone({ queued: true });
      } else {
        setErr(e.message || String(e));
      }
    } finally { setBusy(false); }
  }

  if (queued) {
    return (
      <Sheet onClose={onClose}>
        <div style={{ fontSize: 16, color: T.text }}>Saved on this phone</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 8, lineHeight: 1.55 }}>
          It will send by itself when you have signal. You can close the app;
          it will not be lost, and it cannot be sent twice.
        </div>
        <button onClick={onClose} style={{
          background: T.accent, color: T.onAccent, border: 'none', borderRadius: 12,
          padding: '13px 0', width: '100%', fontSize: 14, marginTop: 16, cursor: 'pointer'
        }}>Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 16, color: T.text }}>{form.label}</div>
      {record && (
        <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{record.title}</div>
      )}

      {blocked && (
        <div style={{ background: T.amberBg, borderRadius: 12, padding: '12px 13px',
                      marginTop: 13, fontSize: 12.5, color: T.amber, lineHeight: 1.55 }}>
          This one needs signal. It changes a record other people also work on,
          and saving it from two phones at once would quietly overwrite one of
          them. Logging something new always works offline — only edits wait.
        </div>
      )}

      {!blocked && (form.fields || []).map(f => (
        <div key={f.k} style={{ marginTop: 13 }}>
          <label style={{ fontSize: 11.5, color: T.sub }}>
            {f.label}{f.required ? ' *' : ''}
          </label>
          {f.options ? (
            <select value={vals[f.k]} onChange={e => set(f.k, e.target.value)} style={inputStyle}>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.lines ? (
            <textarea value={vals[f.k]} onChange={e => set(f.k, e.target.value)}
                      rows={f.lines} style={{ ...inputStyle, resize: 'vertical' }} />
          ) : (
            <input type={f.type || 'text'} value={vals[f.k]}
                   onChange={e => set(f.k, e.target.value)} style={inputStyle} />
          )}
        </div>
      ))}

      {err && (
        <div style={{ background: T.redBg, borderRadius: 11, padding: '10px 12px',
                      marginTop: 13, fontSize: 12.5, color: T.red }}>{err}</div>
      )}

      {!blocked && (
        <button disabled={busy} onClick={submit} style={{
          background: busy ? T.line : T.accent, color: busy ? T.sub : T.onAccent,
          border: 'none', borderRadius: 12, padding: '13px 0', width: '100%',
          fontSize: 14, marginTop: 18, cursor: busy ? 'default' : 'pointer'
        }}>{busy ? 'Saving…' : form.verb}</button>
      )}

      {!online && canQueue && (
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 10, textAlign: 'center' }}>
          You are offline — this will be held and sent later.
        </div>
      )}
    </Sheet>
  );
}
