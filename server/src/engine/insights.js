// מנוע תובנות מרוכז — מסנתז את כל הניתוחים באתר לציון אחד לכל מספר,
// ומייצר טורים "הגיוניים" ומאוזנים לפי התובנות.
import { MAX_NUMBER, PICK, decadeOf, isEven, isLow } from './config.js';
import { numberStats, strongStats, intervalStats, drawNumbers, patternOf } from './stats.js';
import { buildNetwork } from './network.js';
import { passesFilters, keyOf, humanLikenessPenalty } from './filters.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const norm = (v, max) => (max ? v / max : 0);

// משקלי התובנות (מסוכמים ל-1) — מוצגים למשתמש לשקיפות
export const INSIGHT_WEIGHTS = {
  freq: 0.22,    // תדירות היסטורית (מספר חזק/סטטיסטיקה)
  recent: 0.20,  // עדכניות — חם ב-25 האחרונות (חזרתיות)
  due: 0.24,     // "מאחר" — עבר יותר מהמרווח הממוצע (פרופיל/מרווחים)
  layer: 0.18,   // מרכזיות ברשת הקשרים (מפת קשרים)
  trend: 0.16,   // מגמת הופעה עולה (סטטיסטיקה)
};

const LAYER_W = { core: 1, bridge: 0.62, periphery: 0.32 };

// מחשב ציון תובנות משוקלל לכל מספר 1..37
export function buildInsightModel(draws) {
  const total = draws.length;
  const ns = numberStats(draws);
  const iv = intervalStats(draws);
  const net = buildNetwork(draws);
  const ss = strongStats(draws);

  const maxFreq = Math.max(...ns.map((s) => s.count), 1);
  const maxRecent = Math.max(...ns.map((s) => s.last25), 1);

  // lift matrix מתוך רשת הקו-הופעה
  const { W, freq, layerOf } = net;
  const lift = (i, j) => {
    const exp = total ? (freq[i] / total) * (freq[j] / total) * total : 0;
    return exp ? W[i][j] / exp : 0;
  };

  const nodes = [];
  for (let n = 1; n <= MAX_NUMBER; n++) {
    const s = ns[n - 1];
    const it = iv[n - 1];
    const freqN = norm(s.count, maxFreq);
    const recentN = norm(s.last25, maxRecent);
    const dueN = clamp((it.currentGap) / (it.avgGap || 1), 0, 2) / 2;
    const layer = layerOf[n] || 'periphery';
    const layerN = LAYER_W[layer];
    const trendN = s.trend === 'עולה' ? 1 : s.trend === 'יורד' ? 0 : 0.5;

    const composite =
      INSIGHT_WEIGHTS.freq * freqN +
      INSIGHT_WEIGHTS.recent * recentN +
      INSIGHT_WEIGHTS.due * dueN +
      INSIGHT_WEIGHTS.layer * layerN +
      INSIGHT_WEIGHTS.trend * trendN;

    const tags = [];
    if (recentN > 0.6) tags.push('חם');
    if (dueN > 0.65) tags.push('מאחר');
    if (s.trend === 'עולה') tags.push('מגמה עולה');
    tags.push(layer === 'core' ? 'ליבה' : layer === 'bridge' ? 'גשר' : 'פריפריה');
    if (n > 31) tags.push('מעל 31');

    nodes.push({
      number: n, composite: Math.round(composite * 1000) / 1000,
      layer, freqN: r2(freqN), recentN: r2(recentN), dueN: r2(dueN), trend: s.trend,
      currentGap: it.currentGap, avgGap: it.avgGap, tags,
    });
  }
  const ranked = [...nodes].sort((a, b) => b.composite - a.composite);
  return { total, nodes, ranked, layerOf, lift, ss, net, iv, ns };
}

function r2(x) { return Math.round(x * 100) / 100; }

// בדיקת "היגיון" לטור לפי כל התובנות (מעבר לפילטרים הבסיסיים)
function isBalanced(nums, layerOf) {
  const comp = { core: 0, bridge: 0, periphery: 0 };
  for (const n of nums) comp[layerOf[n]]++;
  // איזון שכבות: לפחות 1 ליבה, לא יותר מ-4; לפחות מספר אחד לא-ליבה
  if (comp.core < 1 || comp.core > 4) return false;
  if (comp.periphery + comp.bridge < 2) return false;
  return true;
}

export function generateInsightTickets(draws, ctx, count = 10) {
  const model = buildInsightModel(draws);
  const { nodes, ranked, layerOf, lift, ss } = model;
  const scoreOf = {}; for (const n of nodes) scoreOf[n.number] = n.composite;
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };

  const pool = ranked.slice(0, 20).map((n) => n.number);
  const maxLift = Math.max(1, ...pairsMaxLift(pool, lift));

  function scoreTicket(nums) {
    const comp = nums.reduce((s, n) => s + scoreOf[n], 0) / PICK;         // תובנות
    let conn = 0;
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) conn += lift(nums[i], nums[j]);
    const connN = conn / (maxLift * (PICK * (PICK - 1) / 2));             // קישוריות (lift)
    const human = humanLikenessPenalty(nums) / 100;                       // אנטי-פופולריות
    return { raw: comp * 0.6 + connN * 0.25 - human * 0.15, comp, connN };
  }

  const seen = new Set();
  const cands = [];
  for (let t = 0; t < 15000 && cands.length < 800; t++) {
    const nums = sample(pool, PICK).sort((a, b) => a - b);
    const k = keyOf(nums);
    if (seen.has(k)) continue; seen.add(k);
    if (!passesFilters(nums, ctxFilter).ok) continue;
    if (!isBalanced(nums, layerOf)) continue;
    cands.push({ numbers: nums, ...scoreTicket(nums) });
  }
  // אם הפול הצר לא הניב מספיק — הרחב לכל המספרים
  if (cands.length < count) {
    const wide = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);
    for (let t = 0; t < 15000 && cands.length < count * 3; t++) {
      const nums = sample(wide, PICK).sort((a, b) => a - b);
      const k = keyOf(nums); if (seen.has(k)) continue; seen.add(k);
      if (!passesFilters(nums, ctxFilter).ok) continue;
      cands.push({ numbers: nums, ...scoreTicket(nums) });
    }
  }
  cands.sort((a, b) => b.raw - a.raw);

  const slice = cands.slice(0, count);
  const maxRaw = slice[0]?.raw ?? 1, minRaw = slice[slice.length - 1]?.raw ?? 0, span = (maxRaw - minRaw) || 1;

  // מספר חזק לפי תובנות: תדירות + "מאחר"
  const strongRank = [...ss.list].map((x) => ({
    number: x.number, s: 0.5 * (x.count / Math.max(...ss.list.map((y) => y.count), 1)) + 0.5 * clamp(x.drawsSince / 7, 0, 1),
  })).sort((a, b) => b.s - a.s).map((x) => x.number);

  const nodeByNum = {}; for (const n of nodes) nodeByNum[n.number] = n;
  const tickets = slice.map((c, i) => {
    const comp = { core: 0, bridge: 0, periphery: 0 };
    for (const n of c.numbers) comp[layerOf[n]]++;
    return {
      rank: i + 1,
      numbers: c.numbers,
      strong: strongRank[i % strongRank.length],
      score: Math.round((70 + ((c.raw - minRaw) / span) * 28) * 10) / 10,
      connectivity: Math.round(c.connN * 1000) / 10,
      composition: comp,
      reasons: c.numbers.map((n) => ({ number: n, tags: nodeByNum[n].tags })),
      pattern: patternOf(c.numbers),
    };
  });

  return {
    weights: INSIGHT_WEIGHTS,
    topInsights: buildInsightSummary(model),
    ranked: ranked.slice(0, 12).map((n) => ({ number: n.number, composite: n.composite, tags: n.tags })),
    tickets,
  };
}

function buildInsightSummary(model) {
  const { nodes } = model;
  const hot = nodes.filter((n) => n.recentN > 0.6).map((n) => n.number).slice(0, 6);
  const due = [...nodes].sort((a, b) => b.dueN - a.dueN).slice(0, 6).map((n) => n.number);
  const core = nodes.filter((n) => n.layer === 'core').map((n) => n.number);
  const up = nodes.filter((n) => n.trend === 'עולה').map((n) => n.number).slice(0, 6);
  return [
    `חמים לאחרונה: ${hot.join(', ') || '—'}`,
    `מאחרים (מעל המרווח הממוצע): ${due.join(', ')}`,
    `ליבת הרשת: ${core.join(', ')}`,
    `במגמת עלייה: ${up.join(', ') || '—'}`,
    'המחולל משלב את כל התובנות לציון אחד למספר, ואז בונה טורים מאוזנים בין השכבות ובעלי קישוריות גבוהה — לצירוף הגיוני, לא לניבוי.',
  ];
}

function pairsMaxLift(pool, lift) {
  const out = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) out.push(lift(pool[i], pool[j]));
  return out;
}
function sample(arr, k) {
  const a = [...arr]; const o = [];
  for (let i = 0; i < k && a.length; i++) o.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return o;
}
