/**
 * The SEM dark theme. One file, so a colour is never invented at a call site.
 *
 * Dark only — agreed deliberately, not defaulted into. The usual objection to
 * dark on a phone used outdoors is real, and the answer is contrast: pure
 * white on near-black, and a secondary grey (#99A3B0) that sits well above the
 * #6B7280 most dark themes use. Anything dimmer than SUB fails in daylight,
 * so there is no third text colour to reach for.
 *
 * Accent is SEM's own orange rather than a fashionable lime. It is the brand,
 * and orange on near-black is the strongest contrast pairing available.
 */

export const T = {
  bg:      '#0B0D10',   // page
  card:    '#171B21',   // the default surface for anything in a list
  raised:  '#1E232A',   // chips, avatars, icon wells
  /**
   * Two dividers, because one value cannot serve both jobs honestly.
   * `line` is decorative — rows it separates are also separated by padding,
   * so it may sit below the 3:1 non-text floor. `rule` is load-bearing: in a
   * detail sheet it is the only thing dividing one field from the next, so it
   * meets 3:1 (3.08 on card).
   */
  line:    '#2A3039',
  rule:    '#64686D',

  text:    '#FFFFFF',   // 17.3:1 on card — AAA
  sub:     '#99A3B0',   // 6.8:1 — AA. Lifted for daylight; do not darken
  /**
   * Measured, not chosen. #6B7684 gave 3.74:1 on the card and 3.97:1 in the
   * nav — both below the 4.5:1 WCAG AA floor for text this size, and it was
   * carrying chart axis labels and inactive tab labels, not just placeholders.
   * #7A8490 is the nearest shade along the same hue that clears it: 4.55:1 on
   * card, 4.82:1 in the nav.
   */
  faint:   '#7A8490',

  accent:  '#F08A1E',   // SEM orange
  onAccent:'#1F1405',   // text on accent — near-black, not brown

  red:     '#FF6B61',   // late, lost, failed
  amber:   '#FFB443',   // needs a decision
  green:   '#45D9A0',   // on track, done

  redBg:   '#3A1512',
  amberBg: '#3A2A0D',
  greenBg: '#0E3A2B',
  blueBg:  '#132A3A',
  blue:    '#5BB8E8'
};

export const R = { card: 22, tile: 20, hero: 26, pill: 999, well: 14 };

/**
 * Chart colour, by the job the colour does. Three jobs, three sets, never mixed.
 *
 * SERIES — identity. Three slots and no more. These exact three were run
 * through the palette validator against the #171B21 card surface and pass on
 * every pair, including under deuteranopia and protanopia. A fourth hue could
 * not be added without a pair falling below the separation floor, which is why
 * anything beyond three segments folds into "Other" or becomes a bar chart.
 * SEM orange is deliberately absent: it is UI chrome, and a colour cannot mean
 * "the brand" and "category two" on the same screen.
 *
 * RAMP — magnitude. One hue, light to dark. For receivables ageing and anything
 * else where the categories have an inherent order, so a categorical palette
 * would imply they are unrelated.
 *
 * STATE — condition. Reserved for late, needs-a-decision and on-track, and
 * never reused as a series colour. Always paired with a label, never alone.
 */
export const SERIES = ['#3987e5', '#199e70', '#9085e9'];
export const RAMP   = ['#CFE3F7', '#8FC2EE', '#4E9BDD', '#2E6FB0', '#1B4D80'];
/**
 * A bar carrying no meaning but its own size — still data, so it must clear
 * the 3:1 non-text floor. #4C555F measured 2.28:1 against the card and failed:
 * eleven of the twelve bars on the billing chart were below the line.
 */
export const NEUTRAL_MARK = '#606871';   // 3.06:1 on #171B21

/** Indian-format short money for an axis label, where every character costs. */
export function tick(n) {
  const v = Math.abs(parseFloat(n) || 0);
  if (v >= 10000000) return (v / 10000000).toFixed(v >= 100000000 ? 0 : 1) + 'Cr';
  if (v >= 100000)   return Math.round(v / 100000) + 'L';
  if (v >= 1000)     return Math.round(v / 1000) + 'k';
  return v ? String(Math.round(v)) : '0';
}

/**
 * How many months of the financial year have begun, April counting as one.
 *
 * Needed to turn a year-to-date total into a monthly run rate. Dividing by the
 * length of a twelve-month chart instead gave 6.8 months of receivables
 * outstanding where the truth was 4.0 — the chart window and the year to date
 * are different spans, and only one of them is what has actually been billed.
 */
export function fyMonthsElapsed(ref) {
  const d = ref || new Date();
  return d.getMonth() >= 3 ? d.getMonth() - 2 : d.getMonth() + 10;
}

/** Indian money, short. 2.15 Cr reads faster than 21,500,000 on a phone. */
export function money(n) {
  const v = parseFloat(n) || 0;
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  if (!v) return '—';
  return '₹' + Math.round(v).toLocaleString('en-IN');
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/** Whole days from today. Negative is the past. */
export function daysUntil(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

/** "Today", "2d", "Wed 22 Oct" — whichever answers the question fastest. */
export function when(v) {
  const n = daysUntil(v);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return Math.abs(n) + 'd ago';
  if (n <= 14) return n + 'd';
  return new Date(v).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Colour for a deadline. Red inside a week, amber inside a fortnight. */
export function urgency(v) {
  const n = daysUntil(v);
  if (n === null) return T.faint;
  if (n < 0) return T.red;
  if (n <= 3) return T.red;
  if (n <= 10) return T.amber;
  return T.green;
}

/**
 * Thirteen project stages collapsed to four bars.
 *
 * The real pipeline runs Prospect → Closed across thirteen stages. Thirteen
 * segments on a phone is a grey smear; four is a glance. The grouping follows
 * the money: nothing is owed until an order exists, which is why Order Won
 * starts "delivering" rather than ending "bidding".
 */
export const STAGE_GROUPS = [
  { name: 'Finding',    stages: ['Prospect', 'Demand Building', 'Budget & Sanction', 'Specification'] },
  { name: 'Bidding',    stages: ['Tender Live', 'Bid Submitted', 'L1 Declared', 'Rate Contract Active'] },
  { name: 'Delivering', stages: ['Order Won', 'Supply', 'Install & Train'] },
  { name: 'Done',       stages: ['Handover', 'Closed'] }
];

export function stageProgress(stage) {
  const s = String(stage || '').replace(/^\d+\s*[.\-—]?\s*/, '').trim().toLowerCase();
  for (let i = 0; i < STAGE_GROUPS.length; i++) {
    if (STAGE_GROUPS[i].stages.some(x => x.toLowerCase() === s)) {
      return { step: i + 1, of: 4, label: STAGE_GROUPS[i].name };
    }
  }
  // Lost or Dormant, or a stage nobody has told this file about.
  return { step: 0, of: 4, label: String(stage || 'Unknown') };
}
