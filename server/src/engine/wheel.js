import { MAX_NUMBER, STRONG_MAX, PICK } from './config.js';
import { passesFilters, keyOf } from './filters.js';
import { buildContext, runModel } from './models.js';

export const PRICE_PER_LINE = 5.9; // מחיר משוער לטור בודד (₪)
const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return Math.round(r); };

// כל הזוגות בתוך טור
function pairsOf(nums) {
  const s = [...nums].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) out.push(s[i] + '-' + s[j]);
  return out;
}

// מחולל טורים: מ-pool נתון (או מדורג לפי המודל המשוקלל), ממקסם כיסוי זוגות וחוסם כפילויות.
export function generateTickets(ctx, { count = 6, pool = null } = {}) {
  count = Math.max(1, Math.min(50, count));
  const ctxFilter = { sumMin: ctx.sumMin, sumMax: ctx.sumMax, existingSet: ctx.existingSet };
  // pool ברירת מחדל: 16 המספרים המובילים לפי ציון סטטיסטי
  let basePool = pool && pool.length >= PICK
    ? [...new Set(pool.filter((n) => n >= 1 && n <= MAX_NUMBER))]
    : [...ctx.nstats].sort((a, b) => b.score - a.score).slice(0, 16).map((s) => s.number);
  if (basePool.length < PICK) basePool = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);

  const covered = new Set();
  const chosen = [];
  const usedKeys = new Set();
  let guard = 0;
  while (chosen.length < count && guard++ < 20000) {
    let best = null, bestNew = -1;
    // נסה מועמדים אקראיים מה-pool, בחר את זה שמוסיף הכי הרבה זוגות חדשים
    for (let t = 0; t < 250; t++) {
      const cand = sample(basePool, PICK).sort((a, b) => a - b);
      const k = keyOf(cand);
      if (usedKeys.has(k)) continue;
      if (!passesFilters(cand, ctxFilter).ok) continue;
      const newPairs = pairsOf(cand).filter((p) => !covered.has(p)).length;
      if (newPairs > bestNew) { bestNew = newPairs; best = { cand, k }; }
    }
    if (!best) { // הרפיית סינון אם נתקענו
      const cand = sample(basePool, PICK).sort((a, b) => a - b);
      best = { cand, k: keyOf(cand) };
    }
    if (usedKeys.has(best.k)) continue;
    usedKeys.add(best.k);
    for (const p of pairsOf(best.cand)) covered.add(p);
    chosen.push(best.cand);
  }

  // מספר חזק לכל טור: סבב על המספרים החזקים החמים
  const strongOrder = [...ctx.sstats.list].sort((a, b) => b.count - a.count).map((x) => x.number);
  const tickets = chosen.map((nums, i) => ({ numbers: nums, strong: strongOrder[i % strongOrder.length] }));

  return { tickets, pool: basePool.sort((a, b) => a - b), coverage: coverageStats(tickets, basePool) };
}

export function coverageStats(tickets, pool) {
  const nums = new Set();
  const pairs = new Set();
  for (const t of tickets) {
    for (const n of t.numbers) nums.add(n);
    for (const p of pairsOf(t.numbers)) pairs.add(p);
  }
  const poolSize = pool ? pool.length : MAX_NUMBER;
  const possiblePairs = C(poolSize, 2);
  return {
    numbersCovered: nums.size,
    numbersTotal: MAX_NUMBER,
    pairsCovered: pairs.size,
    pairsPossibleInPool: possiblePairs,
    pairCoveragePct: possiblePairs ? Math.round((pairs.size / possiblePairs) * 1000) / 10 : 0,
  };
}

// עלות והסתברויות — מוצג בכנות (תוחלת שלילית).
export function costAndOdds(count) {
  const totalCombos = C(MAX_NUMBER, PICK); // 2,324,784
  const jackpotSpace = totalCombos * STRONG_MAX; // 16,273,488
  const odds = {
    'פגיעה ב-6+חזק (ג\'קפוט)': jackpotSpace,
    'פגיעה ב-6': Math.round(totalCombos / 1),
    'פגיעה ב-5+חזק': Math.round(jackpotSpace / (PICK * (MAX_NUMBER - PICK))),
    'פגיעה ב-5': Math.round(totalCombos / (PICK * (MAX_NUMBER - PICK))),
  };
  return {
    lines: count,
    pricePerLine: PRICE_PER_LINE,
    totalCost: Math.round(count * PRICE_PER_LINE * 100) / 100,
    jackpotOddsOneIn: jackpotSpace,
    jackpotChanceWithLines: count + ' מתוך ' + jackpotSpace.toLocaleString('en-US'),
    odds,
    note: 'תוחלת ההחזר בלוטו שלילית מהותית. מחולל הטורים משפר כיסוי ופיזור בלבד — הוא אינו מעלה את סיכויי הזכייה האמיתיים, שנותרים אקראיים.',
  };
}
function sample(arr, k) {
  const a = [...arr]; const out = [];
  for (let i = 0; i < k && a.length; i++) out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  return out;
}
